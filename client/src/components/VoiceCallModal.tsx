import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Phone, PhoneOff, Mic, MicOff, Volume2, VolumeX } from "lucide-react";
import type { User } from "@shared/schema";

interface VoiceCallModalProps {
  isOpen: boolean;
  onClose: () => void;
  callType: 'incoming' | 'outgoing' | 'active';
  otherUser: User | null;
  onAnswer?: () => void;
  onReject?: () => void;
  onEndCall?: () => void;
  onMuteToggle?: () => void;
  onSpeakerToggle?: () => void;
  isMuted?: boolean;
  isSpeakerOn?: boolean;
  callDuration?: number;
}

export default function VoiceCallModal({
  isOpen,
  onClose,
  callType,
  otherUser,
  onAnswer,
  onReject,
  onEndCall,
  onMuteToggle,
  onSpeakerToggle,
  isMuted = false,
  isSpeakerOn = true,
  callDuration = 0
}: VoiceCallModalProps) {
  const [timeElapsed, setTimeElapsed] = useState(0);

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (callType === 'active') {
      interval = setInterval(() => {
        setTimeElapsed(prev => prev + 1);
      }, 1000);
    } else {
      setTimeElapsed(0);
    }
    return () => clearInterval(interval);
  }, [callType]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const getTitle = () => {
    switch (callType) {
      case 'incoming':
        return 'Incoming Call';
      case 'outgoing':
        return 'Calling...';
      case 'active':
        return 'Voice Call';
      default:
        return 'Voice Call';
    }
  };

  const getSubtitle = () => {
    if (callType === 'active') {
      return formatTime(timeElapsed);
    }
    if (callType === 'incoming') {
      return otherUser ? `${otherUser.nickname} is calling` : 'Incoming Call';
    }
    return otherUser ? `Calling ${otherUser.nickname}` : 'Connecting...';
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-center">{getTitle()}</DialogTitle>
        </DialogHeader>
        
        <div className="flex flex-col items-center space-y-6 py-6">
          {/* User Avatar */}
          <div className="relative">
            <Avatar className="w-24 h-24" style={{ backgroundColor: otherUser?.avatarColor }}>
              <AvatarFallback className="text-white font-semibold text-2xl">
                {otherUser?.nickname.slice(0, 3).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            {callType === 'active' && (
              <div className="absolute -bottom-2 -right-2 w-8 h-8 bg-green-500 rounded-full flex items-center justify-center">
                <div className="w-3 h-3 bg-white rounded-full animate-pulse"></div>
              </div>
            )}
          </div>

          {/* User Info */}
          <div className="text-center">
            <h3 className="text-xl font-semibold">{otherUser?.nickname}</h3>
            <p className="text-sm text-muted-foreground">@{otherUser?.username}</p>
            <p className="text-lg font-medium mt-2">{getSubtitle()}</p>
          </div>

          {/* Call Controls */}
          <div className="flex items-center space-x-4">
            {callType === 'incoming' && (
              <>
                <Button
                  size="lg"
                  variant="destructive"
                  className="rounded-full w-16 h-16"
                  onClick={onReject}
                >
                  <PhoneOff className="w-6 h-6" />
                </Button>
                <Button
                  size="lg"
                  className="rounded-full w-16 h-16 bg-green-500 hover:bg-green-600"
                  onClick={onAnswer}
                >
                  <Phone className="w-6 h-6" />
                </Button>
              </>
            )}

            {callType === 'outgoing' && (
              <Button
                size="lg"
                variant="destructive"
                className="rounded-full w-16 h-16"
                onClick={onEndCall}
              >
                <PhoneOff className="w-6 h-6" />
              </Button>
            )}

            {callType === 'active' && (
              <>
                <Button
                  size="lg"
                  variant="outline"
                  className="rounded-full w-12 h-12"
                  onClick={onMuteToggle}
                >
                  {isMuted ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
                </Button>
                <Button
                  size="lg"
                  variant="destructive"
                  className="rounded-full w-16 h-16"
                  onClick={onEndCall}
                >
                  <PhoneOff className="w-6 h-6" />
                </Button>
                <Button
                  size="lg"
                  variant="outline"
                  className="rounded-full w-12 h-12"
                  onClick={onSpeakerToggle}
                >
                  {isSpeakerOn ? <Volume2 className="w-5 h-5" /> : <VolumeX className="w-5 h-5" />}
                </Button>
              </>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
