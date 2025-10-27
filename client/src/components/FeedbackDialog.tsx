import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { MessageSquare, Send } from "lucide-react";

interface FeedbackDialogProps {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export default function FeedbackDialog({ open, onOpenChange }: FeedbackDialogProps) {
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const { toast } = useToast();

  const feedbackMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest("POST", "/api/feedback", {
        subject,
        message,
      });
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Your feedback has been sent! You'll be redirected to Telegram to continue.",
        variant: "default",
      });
      setSubject("");
      setMessage("");
      onOpenChange?.(false);
      
      // Redirect to Telegram bot after a short delay
      // Replace 'your_bot_username' with your actual bot username
      setTimeout(() => {
        const botUsername = import.meta.env.VITE_TELEGRAM_BOT_USERNAME || "your_bot_username";
        window.open(`https://t.me/${botUsername}`, "_blank");
      }, 1500);
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to send feedback",
        variant: "destructive",
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!subject.trim()) {
      toast({
        title: "Error",
        description: "Please enter a subject",
        variant: "destructive",
      });
      return;
    }
    
    if (!message.trim()) {
      toast({
        title: "Error",
        description: "Please enter your feedback message",
        variant: "destructive",
      });
      return;
    }

    feedbackMutation.mutate();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          title="Send Feedback"
          className="hover:bg-accent"
        >
          <MessageSquare className="w-5 h-5" />
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Send Feedback</DialogTitle>
          <DialogDescription>
            Help us improve by sharing your feedback. After sending, you'll be redirected to Telegram to continue the conversation.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <label htmlFor="subject" className="text-sm font-medium">
              Subject
            </label>
            <Input
              id="subject"
              placeholder="Brief subject of your feedback"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              disabled={feedbackMutation.isPending}
            />
          </div>
          <div className="space-y-2">
            <label htmlFor="message" className="text-sm font-medium">
              Message
            </label>
            <Textarea
              id="message"
              placeholder="Describe your feedback, bug report, or feature request..."
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              disabled={feedbackMutation.isPending}
              rows={5}
            />
          </div>
          <div className="flex gap-2 justify-end">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange?.(false)}
              disabled={feedbackMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={feedbackMutation.isPending}
              className="gap-2"
            >
              <Send className="w-4 h-4" />
              {feedbackMutation.isPending ? "Sending..." : "Send Feedback"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
