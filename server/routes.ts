import type { Express } from "express";
import { createServer, type Server } from "http";
import { WebSocketServer, WebSocket } from "ws";
import { storage } from "./storage";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { z } from "zod";
import { updateProfileSchema, insertMessageSchema, insertFeedbackSchema } from "@shared/schema";
import passport from "passport";
import { Strategy as GoogleStrategy } from "passport-google-oauth20";
import { Strategy as GitHubStrategy } from "passport-github2";

const JWT_SECRET = process.env.SESSION_SECRET || "LOTAKBAS1992";
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;

// OAuth Configuration
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const GITHUB_CLIENT_ID = process.env.GITHUB_CLIENT_ID;
const GITHUB_SECRET = process.env.GITHUB_SECRET;
const BASE_URL = process.env.BASE_URL || `http://localhost:${process.env.PORT || 3000}`;

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



  // Configure Passport for OAuth
  app.use(passport.initialize());

  // Passport serialization (required even without sessions)
  passport.serializeUser((user: any, done) => {
    done(null, user.id);
  });

  passport.deserializeUser(async (id: string, done) => {
    try {
      const user = await storage.getUser(id);
      done(null, user);
    } catch (error) {
      done(error);
    }
  });

  // Google OAuth Strategy
  const isGoogleConfigured = GOOGLE_CLIENT_ID && GOOGLE_CLIENT_SECRET;
  if (isGoogleConfigured) {
    console.log('✓ Configuring Google OAuth strategy');
    passport.use('google', new GoogleStrategy({
      clientID: GOOGLE_CLIENT_ID,
      clientSecret: GOOGLE_CLIENT_SECRET,
      callbackURL: `${BASE_URL}/api/auth/google/callback`,
    }, async (accessToken, refreshToken, profile, done) => {
      try {
        const email = profile.emails?.[0]?.value;
        if (!email) {
          return done(new Error("No email found in Google profile"));
        }

        let user = await storage.getUserByEmail(email);
        if (!user) {
          const base = profile.displayName?.replace(/[^a-zA-Z0-9_]/g, "_").slice(0, 15) || 'user';
          let candidate = base;
          let counter = 1;
          while (await storage.getUserByUsername(candidate)) {
            const suffix = `_${counter}`;
            candidate = (base + suffix).slice(0, 15);
            counter++;
          }

          const hashedPassword = await bcrypt.hash("oauth-placeholder", 10);
          user = await storage.createUser({
            username: candidate,
            password: hashedPassword,
            nickname: profile.displayName || candidate,
            email,
            avatarColor: '#2196F3',
            theme: 'light',
            profileSetupComplete: false,
          } as any);
        }

        return done(null, user);
      } catch (error) {
        return done(error);
      }
    }));
  } else {
    console.warn('⚠ Google OAuth not configured - missing GOOGLE_CLIENT_ID or GOOGLE_CLIENT_SECRET');
  }

  // GitHub OAuth Strategy
  const isGitHubConfigured = GITHUB_CLIENT_ID && GITHUB_SECRET;
  if (isGitHubConfigured) {
    console.log('✓ Configuring GitHub OAuth strategy');
    passport.use('github', new GitHubStrategy({
      clientID: GITHUB_CLIENT_ID,
      clientSecret: GITHUB_SECRET,
      callbackURL: `${BASE_URL}/api/auth/github/callback`,
      scope: ['user:email'],
    }, async (accessToken: string, refreshToken: string, profile: any, done: any) => {
      try {
        const email = profile.emails?.[0]?.value;
        if (!email) {
          return done(new Error("No email found in GitHub profile"));
        }

        let user = await storage.getUserByEmail(email);
        if (!user) {
          const base = profile.username?.replace(/[^a-zA-Z0-9_]/g, "_").slice(0, 15) || 'user';
          let candidate = base;
          let counter = 1;
          while (await storage.getUserByUsername(candidate)) {
            const suffix = `_${counter}`;
            candidate = (base + suffix).slice(0, 15);
            counter++;
          }

          const hashedPassword = await bcrypt.hash("oauth-placeholder", 10);
          user = await storage.createUser({
            username: candidate,
            password: hashedPassword,
            nickname: profile.displayName || profile.username || candidate,
            email,
            avatarColor: '#2196F3',
            theme: 'light',
            profileSetupComplete: false,
          } as any);
        }

        return done(null, user);
      } catch (error) {
        return done(error);
      }
    }));
  } else {
    console.warn('⚠ GitHub OAuth not configured - missing GITHUB_CLIENT_ID or GITHUB_SECRET');
  }



  // Add a new route for full user sync
  app.get("/api/users/sync", authenticate, async (req: any, res) => {
    try {
      const users = await storage.getAllUsers();
      const sanitizedUsers = users.map(({ password, ...user }) => user);
      res.json(sanitizedUsers);
    } catch (error) {
      res.status(500).json({ message: "Failed to sync users" });
    }
  });

  // Modify existing WebSocket connection to periodically sync users
  wss.on('connection', (ws, req) => {
    let userId: string | null = null;
    let isAuthenticated = false;
    let userSyncInterval: NodeJS.Timeout | null = null;

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
          } else if (message.type === 'check_user_availability') {
            const targetUserId = message.targetUserId as string;
            const available = !!(targetUserId && connectedClients.has(targetUserId));
            try {
              ws.send(JSON.stringify({
                type: 'user_availability',
                userId: targetUserId,
                available
              }));
            } catch (err) {
              console.error('Failed to send availability:', err);
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
        
        // Clear sync interval
        if (userSyncInterval) {
          clearInterval(userSyncInterval);
        }
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
    connectedClients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(JSON.stringify(data));
      }
    });
  };

  // Auth Routes

  // Google OAuth Routes
  if (isGoogleConfigured) {
    app.get("/api/auth/google", passport.authenticate('google', { 
      scope: ['profile', 'email'],
      session: false 
    }));

    app.get("/api/auth/google/callback", 
      passport.authenticate('google', { session: false, failureRedirect: '/auth?error=google_auth_failed' }),
      (req: any, res) => {
        const user = req.user as any;
        const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: "7d" });
        
        // Redirect to frontend with token
        res.redirect(`/auth?token=${token}&userId=${user.id}&profileSetupComplete=${user.profileSetupComplete}`);
      }
    );
  } else {
    app.get("/api/auth/google", (_req, res) => {
      res.status(503).json({ message: "Google OAuth is not configured" });
    });
    app.get("/api/auth/google/callback", (_req, res) => {
      res.redirect('/auth?error=google_not_configured');
    });
  }

  // GitHub OAuth Routes
  if (isGitHubConfigured) {
    app.get("/api/auth/github", passport.authenticate('github', { 
      scope: ['user:email'],
      session: false 
    }));

    app.get("/api/auth/github/callback",
      passport.authenticate('github', { session: false, failureRedirect: '/auth?error=github_auth_failed' }),
      (req: any, res) => {
        const user = req.user as any;
        const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: "7d" });
        
        // Redirect to frontend with token
        res.redirect(`/auth?token=${token}&userId=${user.id}&profileSetupComplete=${user.profileSetupComplete}`);
      }
    );
  } else {
    app.get("/api/auth/github", (_req, res) => {
      res.status(503).json({ message: "GitHub OAuth is not configured" });
    });
    app.get("/api/auth/github/callback", (_req, res) => {
      res.redirect('/auth?error=github_not_configured');
    });
  }

  // Profile Routes
  app.post("/api/auth/check-nickname", authenticate, async (req: any, res) => {
    try {
      const { nickname } = req.body;
      
      if (!nickname || nickname.length < 3) {
        return res.status(400).json({ message: "Nickname must be at least 3 characters" });
      }

      const existingUser = await storage.getUserByNickname(nickname);
      const available = !existingUser || existingUser.id === req.userId;
      
      res.json({ available });
    } catch (error) {
      res.status(500).json({ message: "Failed to check nickname" });
    }
  });

  app.post("/api/profile/setup", authenticate, async (req: any, res) => {
    try {
      const { nickname, avatarColor } = req.body;
      
      // Nickname is now optional
      if (nickname) {
        // Validate nickname length
        if (nickname.length < 2 || nickname.length > 20) {
          return res.status(400).json({ message: "Nickname must be between 2 and 20 characters" });
        }
        
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
        // Validate nickname length
        if (updates.nickname.length < 2 || updates.nickname.length > 20) {
          return res.status(400).json({ message: "Nickname must be between 2 and 20 characters" });
        }
        
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

  app.post("/api/messages/:id/read", authenticate, async (req: any, res) => {
    try {
      const messageId = req.params.id;
      const message = await storage.markMessageAsRead(messageId);
      
      if (!message) {
        return res.status(404).json({ message: "Message not found" });
      }

      // Broadcast read status to both users
      notifyUser(message.senderId, {
        type: 'message_read',
        messageId: message.id,
      });

      notifyUser(message.recipientId, {
        type: 'message_read',
        messageId: message.id,
      });

      res.json(message);
    } catch (error) {
      res.status(500).json({ message: "Failed to mark message as read" });
    }
  });

  app.post("/api/messages/read-batch", authenticate, async (req: any, res) => {
    try {
      const { messageIds } = req.body;
      
      if (!Array.isArray(messageIds)) {
        return res.status(400).json({ message: "messageIds must be an array" });
      }

      await storage.markMessagesAsRead(messageIds);

      // Broadcast read status for all messages
      messageIds.forEach(messageId => {
        notifyUser(req.userId, {
          type: 'message_read',
          messageId,
        });
      });

      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ message: "Failed to mark messages as read" });
    }
  });

  app.get("/api/messages/unread/count", authenticate, async (req: any, res) => {
    try {
      const count = await storage.getUnreadCount(req.userId);
      res.json({ unreadCount: count });
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch unread count" });
    }
  });

  app.get("/api/messages/unread/by-sender", authenticate, async (req: any, res) => {
    try {
      const unreadMessages = await storage.getUnreadMessages(req.userId);
      const unreadBySender: Record<string, number> = {};
      
      unreadMessages.forEach(msg => {
        unreadBySender[msg.senderId] = (unreadBySender[msg.senderId] || 0) + 1;
      });
      
      res.json({ unreadBySender });
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch unread messages by sender" });
    }
  });

  // Helper function to send feedback to Telegram
  const sendFeedbackToTelegram = async (user: any, subject: string, message: string) => {
    if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID) {
      console.warn("⚠️  Telegram credentials not configured");
      console.warn("   TELEGRAM_BOT_TOKEN:", TELEGRAM_BOT_TOKEN ? "✓ Set" : "✗ Missing");
      console.warn("   TELEGRAM_CHAT_ID:", TELEGRAM_CHAT_ID ? "✓ Set" : "✗ Missing");
      return false;
    }

    try {
      console.log("📤 Sending feedback to Telegram...");
      console.log("   User:", user.username);
      console.log("   Subject:", subject);
      
      const telegramMessage = `📧 <b>New Feedback</b>\n\n👤 <b>User:</b> ${user.nickname || user.username}\n🆔 <b>Username:</b> @${user.username}\n\n📌 <b>Subject:</b> ${subject}\n\n💬 <b>Message:</b>\n${message}\n\n⏰ <b>Time:</b> ${new Date().toLocaleString()}`;

      const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;
      console.log("   API URL:", url.replace(TELEGRAM_BOT_TOKEN, "***"));
      console.log("   Chat ID:", TELEGRAM_CHAT_ID);

      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: TELEGRAM_CHAT_ID,
          text: telegramMessage,
          parse_mode: "HTML",
        }),
      });

      const responseData = await response.json();
      
      if (!response.ok) {
        console.error("❌ Failed to send Telegram message:");
        console.error("   Status:", response.status);
        console.error("   Error:", responseData.description || responseData.error_code);
        console.error("   Full response:", JSON.stringify(responseData, null, 2));
        return false;
      }
      
      const messageId = responseData.result?.message_id;
      console.log("✅ Feedback sent to Telegram successfully!");
      console.log("   Message ID:", messageId);
      return true;
    } catch (error) {
      console.error("❌ Error sending feedback to Telegram:", error);
      if (error instanceof Error) {
        console.error("   Error message:", error.message);
        console.error("   Stack:", error.stack);
      }
      return false;
    }
  };

  // Feedback Routes
  app.post("/api/feedback", authenticate, async (req: any, res) => {
    try {
      const data = insertFeedbackSchema.parse({
        userId: req.userId,
        subject: req.body.subject,
        message: req.body.message,
      });

      const feedback = await storage.createFeedback(data);

      // Get user info for Telegram message
      const user = await storage.getUser(req.userId);
      if (user) {
        await sendFeedbackToTelegram(user, data.subject, data.message);
      }

      res.json({ 
        success: true, 
        message: "Feedback sent successfully",
        feedbackId: feedback.id 
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: error.errors[0].message });
      }
      res.status(500).json({ message: "Failed to send feedback" });
    }
  });

  app.get("/api/feedback", authenticate, async (req: any, res) => {
    try {
      const allFeedback = await storage.getAllFeedback();
      res.json(allFeedback);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch feedback" });
    }
  });

  return httpServer;
}
