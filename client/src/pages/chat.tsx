import { useState, useEffect, useRef } from "react";
import { useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { useToast } from "@/hooks/use-toast";
import { Phone, Settings as SettingsIcon, Send, LogOut } from "lucide-react";
import type { User, Message } from "@shared/schema";
import VoiceCallModal from "@/components/VoiceCallModal";
import FeedbackDialog from "@/components/FeedbackDialog";
import { useVoiceCall, type WebRTCSignalingMessage } from "@/hooks/useVoiceCall";

export default function ChatPage() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [messageText, setMessageText] = useState("");
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [feedbackDialogOpen, setFeedbackDialogOpen] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [unreadCounts, setUnreadCounts] = useState<Record<string, number>>({});

  const getInitials = (nickname?: string, username?: string) => {
    const source = (nickname?.trim() || username?.trim() || "");
    if (!source) return "";
    const parts = source.split(/\s+/).filter(Boolean);
    if (parts.length > 1) {
      const letters = parts.map((p) => p.charAt(0)).join("");
      return letters.slice(0, 3).toUpperCase();
    }
    return source.slice(0, 3).toUpperCase();
  };

  // Voice calling functionality
  const {
    callState,
    startCall,
    answerCall,
    rejectCall,
    endCall,
    toggleMute,
    toggleSpeaker,
    handleSignalingMessage,
    audioRef
  } = useVoiceCall(wsRef);

  useEffect(() => {
    const token = localStorage.getItem("token");
    const userId = localStorage.getItem("userId");
    if (!token || !userId) {
      setLocation("/");
      return;
    }

    const fetchCurrentUser = async () => {
      try {
        const user = await apiRequest("GET", `/api/users/${userId}`);
        setCurrentUser(user);
      } catch (error) {
        console.error("Failed to fetch current user:", error);
      }
    };

    const fetchUsers = async () => {
      try {
        const fetchedUsers = await apiRequest("GET", "/api/users");
        setUsers(fetchedUsers);
      } catch (error) {
        console.error("Failed to fetch users:", error);
      }
    };

    const fetchUnreadCounts = async () => {
      try {
        const response = await apiRequest("GET", "/api/messages/unread/by-sender");
        setUnreadCounts(response.unreadBySender || {});
      } catch (error) {
        console.error("Failed to fetch unread count:", error);
      }
    };

    fetchCurrentUser();
    fetchUsers();
    fetchUnreadCounts();

    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const wsUrl = `${protocol}//${window.location.host}/ws`;
    const socket = new WebSocket(wsUrl);

    socket.onopen = () => {
      socket.send(JSON.stringify({ type: "auth", token, userId }));
    };

    socket.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (data.type === "message") {
        queryClient.invalidateQueries({ queryKey: ["/api/messages"] });
        // Increment unread count for the sender
        if (data.message && data.message.senderId) {
          setUnreadCounts(prev => ({
            ...prev,
            [data.message.senderId]: (prev[data.message.senderId] || 0) + 1
          }));
        }
      } else if (data.type === "message_read") {
        // Update message read status in cache
        queryClient.invalidateQueries({ queryKey: ["/api/messages"] });
        // Refresh unread counts
        apiRequest("GET", "/api/messages/unread/by-sender")
          .then(response => setUnreadCounts(response.unreadBySender || {}))
          .catch(error => console.error("Failed to refresh unread counts:", error));
      } else if (data.type === "user_added") {
        // Add new user to the list if not already present
        setUsers(prevUsers => {
          const userExists = prevUsers.some(u => u.id === data.user.id);
          return userExists ? prevUsers : [...prevUsers, data.user];
        });
      } else if (data.type === "user_updated") {
        // Update existing user in the list
        setUsers(prevUsers => 
          prevUsers.map(u => 
            u.id === data.user.id ? { ...u, ...data.user } : u
          )
        );
      } else if (data.type === "call_offer" || data.type === "call_answer" || 
                 data.type === "ice_candidate" || data.type === "call_end" || 
                 data.type === "call_error") {
        // Handle WebRTC signaling messages
        handleSignalingMessage(data as WebRTCSignalingMessage, users);
      }
    };

    wsRef.current = socket;

    return () => {
      socket.close();
    };
  }, [setLocation]);

  const { data: messages = [] } = useQuery<Message[]>({
    queryKey: ["/api/messages", `?recipientId=${selectedUserId}`],
    enabled: !!selectedUserId,
  });

  const sendMessageMutation = useMutation({
    mutationFn: async (content: string) => {
      // Optimistically update the UI
      if (!currentUser || !selectedUserId) {
        throw new Error("Missing current user or selected recipient");
      }
      const optimisticMessage: Message = {
        id: `temp-${Date.now()}`,
        senderId: currentUser.id,
        recipientId: selectedUserId,
        content,
        timestamp: new Date(),
        isRead: false,
      };

      // Update local state immediately
      queryClient.setQueryData<Message[]>(["/api/messages", `?recipientId=${selectedUserId}`], 
        (oldMessages = []) => [...oldMessages, optimisticMessage]
      );

      try {
        const sentMessage = await apiRequest("POST", "/api/messages", {
          recipientId: selectedUserId,
          content,
        });

        // Replace the optimistic message with the actual sent message
        queryClient.setQueryData<Message[]>(["/api/messages", `?recipientId=${selectedUserId}`], 
          (oldMessages = []) => oldMessages.map(msg => 
            msg.id === optimisticMessage.id ? sentMessage : msg
          )
        );

        return sentMessage;
      } catch (error) {
        // Handle sending failure
        const errorResponse = (error as any).response;
        
        if (errorResponse?.status === 429) {
          // Rate limit error
          const remainingTime = errorResponse.data?.message?.match(/\d+/)?.[0] || 60;
          
          toast({
            title: "Message Send Blocked",
            description: `You're sending messages too quickly. Please wait ${remainingTime} seconds.`,
            variant: "destructive"
          });

          // Remove the optimistic message
          queryClient.setQueryData<Message[]>(["/api/messages", `?recipientId=${selectedUserId}`], 
            (oldMessages = []) => oldMessages.filter(msg => msg.id !== optimisticMessage.id)
          );
        }

        // Remove the optimistic message on generic error as well
        queryClient.setQueryData<Message[]>(["/api/messages", `?recipientId=${selectedUserId}`], 
          (oldMessages = []) => oldMessages.filter(msg => msg.id !== optimisticMessage.id)
        );
        throw error;
      }
    },
    onSuccess: () => {
      setMessageText("");
      // Trigger a background refetch to ensure consistency
      queryClient.invalidateQueries({ queryKey: ["/api/messages"] });
    },
    onError: (error) => {
      // Show generic error toast if not already handled
      const errorResponse = (error as any).response;
      
      if (errorResponse?.status !== 429) {
        toast({
          title: "Message Send Failed",
          description: "You spamming, please wait a 1 minute.",
          variant: "destructive"
        });
      }
    }
  });

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Mark unread messages as read when viewing a chat
  useEffect(() => {
    if (selectedUserId && messages.length > 0) {
      const unreadMessageIds = messages
        .filter(msg => msg.recipientId === currentUser?.id && !msg.isRead)
        .map(msg => msg.id);

      if (unreadMessageIds.length > 0) {
        apiRequest("POST", "/api/messages/read-batch", { messageIds: unreadMessageIds })
          .catch(error => console.error("Failed to mark messages as read:", error));
      }
    }
  }, [selectedUserId, messages, currentUser?.id]);

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!messageText.trim() || !selectedUserId) return;
    sendMessageMutation.mutate(messageText);
  };

  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("userId");
    setLocation("/");
  };

  const handleStartCall = () => {
    if (selectedUser) {
      startCall(selectedUser);
    }
  };

  const handleAnswerCall = () => {
    answerCall();
  };

  const handleRejectCall = () => {
    rejectCall();
  };

  const handleEndCall = () => {
    endCall();
  };

  const selectedUser = users.find((u) => u.id === selectedUserId);
  const otherUsers = users.filter((u) => u.id !== currentUser?.id);

  const formatTime = (timestamp: string | Date) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });
  };

  return (
    <div className="h-screen flex">
      {/* Left Sidebar - User List */}
      <div className="w-80 border-r flex flex-col bg-card">
        <div className="p-4 border-b flex items-center justify-between">
          <div className="flex items-center gap-3">
            {currentUser && (
              <>
                <Avatar className="w-10 h-10" style={{ backgroundColor: currentUser.avatarColor }}>
                  <AvatarFallback className="text-white font-semibold">
                    {currentUser.nickname.slice(0, 3).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <h2 className="font-semibold">{currentUser.nickname}</h2>
                  <p className="text-xs text-muted-foreground">@{currentUser.username}</p>
                </div>
              </>
            )}
          </div>
          <div className="flex gap-2">
            <FeedbackDialog open={feedbackDialogOpen} onOpenChange={setFeedbackDialogOpen} />
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setLocation("/settings")}
              data-testid="button-settings"
            >
              <SettingsIcon className="w-5 h-5" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={handleLogout}
              data-testid="button-logout"
            >
              <LogOut className="w-5 h-5" />
            </Button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {otherUsers.length === 0 ? (
            <div className="p-6 text-center text-muted-foreground">
              <p>No other users yet</p>
              <p className="text-sm mt-2">Invite friends to start chatting!</p>
            </div>
          ) : (
            otherUsers.map((user) => {
              const unreadCount = unreadCounts[user.id] || 0;
              return (
                <button
                  key={user.id}
                  onClick={() => setSelectedUserId(user.id)}
                  className={`w-full p-3 rounded-md flex items-center gap-3 transition-colors hover-elevate ${
                    selectedUserId === user.id ? "bg-accent" : ""
                  }`}
                  data-testid={`user-${user.id}`}
                >
                  <Avatar className="w-12 h-12" style={{ backgroundColor: user.avatarColor }}>
                    <AvatarFallback className="text-white font-semibold text-lg">
                      {user.nickname.slice(0, 3).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 text-left">
                    <p className="font-medium">{user.nickname}</p>
                    <p className="text-sm text-muted-foreground">@{user.username}</p>
                  </div>
                  {unreadCount > 0 && (
                    <div className="flex items-center justify-center w-6 h-6 rounded-full text-white text-xs font-semibold" style={{ backgroundColor: user.avatarColor }}>
                      {unreadCount > 99 ? '99+' : unreadCount}
                    </div>
                  )}
                </button>
              );
            })
          )}
        </div>
      </div>

      {/* Right Panel - Chat Area */}
      <div className="flex-1 flex flex-col">
        {selectedUser ? (
          <>
            {/* Chat Header */}
            <div className="h-16 border-b px-6 flex items-center justify-between bg-card">
              <div className="flex items-center gap-3">
                <Avatar className="w-10 h-10" style={{ backgroundColor: selectedUser.avatarColor }}>
                  <AvatarFallback className="text-white font-semibold">
                    {getInitials(selectedUser.nickname, selectedUser.username)}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <h2 className="font-semibold">{selectedUser.nickname}</h2>
                  <p className="text-xs text-muted-foreground">@{selectedUser.username}</p>
                </div>
              </div>
              <Button 
                variant="ghost" 
                size="icon" 
                onClick={handleStartCall}
                disabled={callState.isInCall}
                data-testid="button-call"
              >
                <Phone className="w-5 h-5" />
              </Button>
            </div>

            {/* Messages Area */}
            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              {messages.length === 0 ? (
                <div className="flex items-center justify-center h-full text-muted-foreground">
                  <p>No messages yet. Start the conversation!</p>
                </div>
              ) : (
                messages.map((message, index) => {
                  const isOwn = message.senderId === currentUser?.id;
                  return (
                    <div
                      key={message.id}
                      className={`flex ${isOwn ? "justify-end" : "justify-start"} transition-all duration-300 ease-in-out`}
                    >
                      <div className={`max-w-[70%] ${isOwn ? "items-end" : "items-start"} flex flex-col gap-1`}>
                        <div
                          className={`px-4 py-2 rounded-2xl ${
                            isOwn
                              ? "rounded-br-sm text-white"
                              : "rounded-bl-sm bg-muted"
                          }`}
                          style={isOwn ? { backgroundColor: currentUser?.avatarColor } : {}}
                          data-testid={`message-${message.id}`}
                        >
                          <p className="break-words">{message.content}</p>
                        </div>
                        <span className="text-xs text-muted-foreground px-2">
                          {formatTime(message.timestamp)}
                        </span>
                      </div>
                    </div>
                  );
                })
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Message Input */}
            <form onSubmit={handleSendMessage} className="p-4 border-t bg-card">
              <div className="flex gap-2">
                <Input
                  value={messageText}
                  onChange={(e) => setMessageText(e.target.value)}
                  placeholder="Type a message..."
                  className="flex-1"
                  data-testid="input-message"
                />
                <Button
                  type="submit"
                  disabled={!messageText.trim() || sendMessageMutation.isPending}
                  style={currentUser ? { backgroundColor: currentUser.avatarColor } : {}}
                  className="text-white"
                  data-testid="button-send"
                >
                  <Send className="w-5 h-5" />
                </Button>
              </div>
            </form>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-muted-foreground">
            <div className="text-center">
              <p className="text-lg mb-2">Select a user to start chatting</p>
              <p className="text-sm">Choose someone from the list on the left</p>
            </div>
          </div>
        )}
      </div>

      {/* Voice Call Modal */}
      <VoiceCallModal
        isOpen={callState.isInCall}
        onClose={handleEndCall}
        callType={callState.callType || 'incoming'}
        otherUser={callState.otherUser}
        onAnswer={handleAnswerCall}
        onReject={handleRejectCall}
        onEndCall={handleEndCall}
        onMuteToggle={toggleMute}
        onSpeakerToggle={toggleSpeaker}
        isMuted={callState.isMuted}
        isSpeakerOn={callState.isSpeakerOn}
        callDuration={callState.callDuration}
      />

      {/* Hidden audio element for remote audio */}
      <audio ref={audioRef} autoPlay />
    </div>
  );
}
