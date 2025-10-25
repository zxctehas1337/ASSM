import type { Express } from "express";
import { createServer, type Server } from "http";
import { WebSocketServer, WebSocket } from "ws";
import { storage } from "./storage";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { z } from "zod";
import { insertUserSchema, loginSchema, updateProfileSchema, insertMessageSchema } from "@shared/schema";

const JWT_SECRET = process.env.SESSION_SECRET || "your-secret-key-change-in-production";

interface AuthRequest {
  userId?: string;
}

// Middleware to verify JWT token
const authenticate = (req: any, res: any, next: any) => {
  const token = req.headers.authorization?.replace("Bearer ", "");
  
  if (!token) {
    return res.status(401).json({ message: "Authentication required" });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as { userId: string };
    req.userId = decoded.userId;
    next();
  } catch (error) {
    res.status(401).json({ message: "Invalid token" });
  }
};

export async function registerRoutes(app: Express): Promise<Server> {
  const httpServer = createServer(app);

  // WebSocket server for real-time messaging
  const wss = new WebSocketServer({ server: httpServer, path: '/ws' });
  const connectedClients = new Map<string, WebSocket>();

  wss.on('connection', (ws, req) => {
    let userId: string | null = null;
    let isAuthenticated = false;

    ws.on('message', (data) => {
      try {
        const message = JSON.parse(data.toString());
        
        if (message.type === 'auth') {
          const token = message.token;
          
          if (!token) {
            ws.close(1008, 'Authentication required');
            return;
          }

          try {
            const decoded = jwt.verify(token, JWT_SECRET) as { userId: string };
            userId = decoded.userId;
            isAuthenticated = true;
            
            if (userId) {
              connectedClients.set(userId, ws);
              ws.send(JSON.stringify({ type: 'auth_success' }));
            }
          } catch (error) {
            ws.close(1008, 'Invalid token');
            return;
          }
        } else {
          if (!isAuthenticated) {
            ws.close(1008, 'Not authenticated');
            return;
          }

          // Handle WebRTC signaling messages
          if (message.type === 'call_offer' || message.type === 'call_answer' || message.type === 'ice_candidate') {
            const targetUserId = message.targetUserId;
            const targetClient = connectedClients.get(targetUserId);
            
            if (targetClient && targetClient.readyState === WebSocket.OPEN) {
              // Forward the signaling message to the target user
              targetClient.send(JSON.stringify({
                ...message,
                fromUserId: userId
              }));
            } else {
              // Target user is not online
              ws.send(JSON.stringify({
                type: 'call_error',
                error: 'User is not available'
              }));
            }
          } else if (message.type === 'call_end') {
            const targetUserId = message.targetUserId;
            const targetClient = connectedClients.get(targetUserId);
            
            if (targetClient && targetClient.readyState === WebSocket.OPEN) {
              targetClient.send(JSON.stringify({
                type: 'call_end',
                fromUserId: userId
              }));
            }
          }
        }
      } catch (error) {
        console.error('WebSocket message error:', error);
      }
    });

    ws.on('close', () => {
      if (userId) {
        connectedClients.delete(userId);
      }
    });
  });

  // Broadcast message to a specific user
  const notifyUser = (userId: string, data: any) => {
    const client = connectedClients.get(userId);
    if (client && client.readyState === WebSocket.OPEN) {
      client.send(JSON.stringify(data));
    }
  };

  // Broadcast to all connected clients
  const broadcastToAllClients = (data: any) => {
    for (const client of connectedClients.values()) {
      if (client.readyState === WebSocket.OPEN) {
        client.send(JSON.stringify(data));
      }
    }
  };

  // Auth Routes
  app.post("/api/auth/register", async (req: any, res) => {
    try {
      const data = insertUserSchema.parse(req.body);
      
      const existingUser = await storage.getUserByUsername(data.username);
      if (existingUser) {
        return res.status(400).json({ message: "Username already exists" });
      }

      // Optional nickname check
      if (data.nickname) {
        const existingNickname = await storage.getUserByNickname(data.nickname);
        if (existingNickname) {
          return res.status(400).json({ message: "Nickname already taken" });
        }
      }

      const hashedPassword = await bcrypt.hash(data.password, 10);
      const user = await storage.createUser({
        ...data,
        password: hashedPassword,
      });

      // Broadcast new user to all connected clients
      broadcastToAllClients({
        type: 'user_added',
        user: { 
          id: user.id, 
          username: user.username, 
          nickname: user.nickname,
          avatarColor: user.avatarColor
        }
      });

      const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: "7d" });

      res.json({
        token,
        userId: user.id,
        profileSetupComplete: user.profileSetupComplete,
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: error.errors[0].message });
      }
      res.status(500).json({ message: "Registration failed" });
    }
  });

  app.post("/api/auth/login", async (req, res) => {
    try {
      const data = loginSchema.parse(req.body);
      
      const user = await storage.getUserByUsername(data.username);
      if (!user) {
        return res.status(401).json({ message: "Invalid credentials" });
      }

      const isValidPassword = await bcrypt.compare(data.password, user.password);
      if (!isValidPassword) {
        return res.status(401).json({ message: "Invalid credentials" });
      }

      const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: "7d" });

      res.json({
        token,
        userId: user.id,
        profileSetupComplete: user.profileSetupComplete,
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: error.errors[0].message });
      }
      res.status(500).json({ message: "Login failed" });
    }
  });

  app.post("/api/auth/check-nickname", async (req, res) => {
    try {
      const { nickname } = req.body;
      
      // If no nickname is provided, return available
      if (!nickname) {
        return res.json({ available: true });
      }

      if (nickname.length < 2) {
        return res.json({ available: false });
      }

      const existing = await storage.getUserByNickname(nickname);
      res.json({ available: !existing });
    } catch (error) {
      res.status(500).json({ message: "Failed to check nickname" });
    }
  });

  // Profile Routes
  app.post("/api/profile/setup", authenticate, async (req: any, res) => {
    try {
      const { nickname, avatarColor } = req.body;
      
      // Nickname is now optional
      if (nickname) {
        const existingNickname = await storage.getUserByNickname(nickname);
        if (existingNickname && existingNickname.id !== req.userId) {
          return res.status(400).json({ message: "Nickname already taken" });
        }
      }

      const user = await storage.updateUser(req.userId, {
        ...(nickname && { nickname }),
        avatarColor: avatarColor || "#2196F3",
        profileSetupComplete: true,
      });

      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      res.json(user);
    } catch (error) {
      res.status(500).json({ message: "Failed to update profile" });
    }
  });

  app.patch("/api/profile/update", authenticate, async (req: any, res) => {
    try {
      const updates = updateProfileSchema.parse(req.body);
      
      if (updates.nickname) {
        const existingNickname = await storage.getUserByNickname(updates.nickname);
        if (existingNickname && existingNickname.id !== req.userId) {
          return res.status(400).json({ message: "Nickname already taken" });
        }
      }

      const user = await storage.updateUser(req.userId, updates);

      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      res.json(user);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: error.errors[0].message });
      }
      res.status(500).json({ message: "Failed to update profile" });
    }
  });

  // User Routes
  app.get("/api/users", authenticate, async (req: any, res) => {
    try {
      const users = await storage.getAllUsers();
      const sanitizedUsers = users.map(({ password, ...user }) => user);
      res.json(sanitizedUsers);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch users" });
    }
  });

  app.get("/api/users/:id", authenticate, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.params.id);
      
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      const { password, ...sanitizedUser } = user;
      res.json(sanitizedUser);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch user" });
    }
  });

  // Add route for updating user profile
  app.put("/api/users/:id", authenticate, async (req: any, res) => {
    try {
      const userId = req.params.id;
      const updateData = updateProfileSchema.parse(req.body);
      
      const updatedUser = await storage.updateUser(userId, updateData);
      
      if (!updatedUser) {
        return res.status(404).json({ message: "User not found" });
      }

      // Broadcast user update to all connected clients
      broadcastToAllClients({
        type: 'user_updated',
        user: { 
          id: updatedUser.id, 
          username: updatedUser.username, 
          nickname: updatedUser.nickname,
          avatarColor: updatedUser.avatarColor
        }
      });

      res.json(updatedUser);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: error.errors[0].message });
      }
      res.status(500).json({ message: "Profile update failed" });
    }
  });

  // Rate limiting for message sending
  const userMessageCounts = new Map<string, { count: number, resetTime: number, mutedUntil: number }>();

  const isRateLimited = (userId: string): { limited: boolean, remainingTime?: number } => {
    const userLimit = userMessageCounts.get(userId);
    const now = Date.now();

    // Check if user is currently muted
    if (userLimit?.mutedUntil && now < userLimit.mutedUntil) {
      return { 
        limited: true, 
        remainingTime: Math.ceil((userLimit.mutedUntil - now) / 1000) 
      };
    }

    // Reset count if time window has passed (1 minute)
    if (!userLimit || now > userLimit.resetTime) {
      userMessageCounts.set(userId, { 
        count: 1, 
        resetTime: now + 60000,
        mutedUntil: 0 
      });
      return { limited: false };
    }

    // Check if user has exceeded 20 messages in 1 minute
    if (userLimit.count >= 20) {
      // Mute for 1 minute
      const mutedUntil = now + 60000;
      userMessageCounts.set(userId, { 
        count: 0, 
        resetTime: mutedUntil,
        mutedUntil 
      });
      return { 
        limited: true, 
        remainingTime: 60 
      };
    }

    // Increment message count
    userMessageCounts.set(userId, { 
      count: userLimit.count + 1, 
      resetTime: userLimit.resetTime,
      mutedUntil: 0 
    });

    return { limited: false };
  };

  // Message Routes
  app.post("/api/messages", authenticate, async (req: any, res) => {
    try {
      // Check for rate limiting
      const { limited, remainingTime } = isRateLimited(req.userId);
      if (limited) {
        return res.status(429).json({ 
          message: `Too many messages. Please wait ${remainingTime} seconds before sending more.` 
        });
      }

      const data = insertMessageSchema.parse({
        senderId: req.userId,
        recipientId: req.body.recipientId,
        content: req.body.content,
      });

      const message = await storage.createMessage(data);

      notifyUser(data.recipientId, {
        type: 'message',
        message,
      });

      notifyUser(req.userId, {
        type: 'message',
        message,
      });

      res.json(message);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: error.errors[0].message });
      }
      res.status(500).json({ message: "Failed to send message" });
    }
  });

  app.get("/api/messages", authenticate, async (req: any, res) => {
    try {
      const recipientId = req.query.recipientId as string;
      
      if (!recipientId) {
        return res.status(400).json({ message: "recipientId is required" });
      }

      const messages = await storage.getMessagesBetweenUsers(req.userId, recipientId);
      res.json(messages);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch messages" });
    }
  });

  return httpServer;
}
