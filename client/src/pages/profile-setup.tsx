import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { Check, X } from "lucide-react";

const AVATAR_COLORS = [
  { name: "Blue", value: "#2196F3" },
  { name: "Green", value: "#4CAF50" },
  { name: "Purple", value: "#9C27B0" },
  { name: "Orange", value: "#FF9800" },
  { name: "Red", value: "#F44336" },
  { name: "Teal", value: "#009688" },
  { name: "Pink", value: "#E91E63" },
  { name: "Indigo", value: "#3F51B5" },
  { name: "Amber", value: "#FFC107" },
];

export default function ProfileSetup() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [nickname, setNickname] = useState("");
  const [selectedColor, setSelectedColor] = useState(AVATAR_COLORS[0].value);
  const [isCheckingNickname, setIsCheckingNickname] = useState(false);
  const [nicknameStatus, setNicknameStatus] = useState<"idle" | "available" | "taken">("idle");
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) {
      setLocation("/");
    }
  }, [setLocation]);

  const handleNicknameChange = (value: string) => {
    // Limit nickname length to 20 characters
    if (value.length <= 20) {
      setNickname(value);
    }
  };

  useEffect(() => {
    const checkNickname = async () => {
      if (nickname.length < 2) {
        setNicknameStatus("idle");
        return;
      }

      setIsCheckingNickname(true);
      try {
        const response = await apiRequest("POST", "/api/auth/check-nickname", { nickname });
        setNicknameStatus(response.available ? "available" : "taken");
      } catch (error) {
        setNicknameStatus("idle");
      } finally {
        setIsCheckingNickname(false);
      }
    };

    const timeoutId = setTimeout(checkNickname, 500);
    return () => clearTimeout(timeoutId);
  }, [nickname]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (nicknameStatus !== "available" && nickname) {
      toast({
        title: "Invalid nickname",
        description: "Please choose an available nickname",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    try {
      await apiRequest("POST", "/api/profile/setup", {
        nickname,
        avatarColor: selectedColor,
      });
      
      toast({
        title: "Profile complete!",
        description: "Welcome to ASSM",
      });
      setLocation("/chat");
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to update profile",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-6">
      <div className="w-full max-w-lg space-y-8 animate-scale-in">
        <div className="text-center space-y-2">
          <h1 className="text-4xl font-semibold">Complete Your Profile</h1>
          <p className="text-muted-foreground">
            Personalize your avatar
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-8" data-testid="form-profile-setup">
          {/* Nickname Input */}
          <div className="space-y-2">
            <Label htmlFor="nickname">Nickname</Label>
            <div className="relative">
              <Input
                id="nickname"
                type="text"
                value={nickname}
                onChange={(e) => handleNicknameChange(e.target.value)}
                placeholder="Choose a display name (2-20 characters)"
                className="pr-10"
                data-testid="input-nickname-setup"
                maxLength={20}
              />
              <div className="absolute right-3 top-1/2 -translate-y-1/2">
                {isCheckingNickname && (
                  <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                )}
                {!isCheckingNickname && nicknameStatus === "available" && (
                  <Check className="w-5 h-5 text-green-500" data-testid="icon-available" />
                )}
                {!isCheckingNickname && nicknameStatus === "taken" && (
                  <X className="w-5 h-5 text-destructive" data-testid="icon-taken" />
                )}
              </div>
            </div>
            {nickname.length > 20 && (
              <p className="text-sm text-destructive">Nickname must be 20 characters or less</p>
            )}
            {nicknameStatus === "available" && (
              <p className="text-sm text-green-600">This nickname is available</p>
            )}
            {nicknameStatus === "taken" && (
              <p className="text-sm text-destructive">This nickname is already taken</p>
            )}
          </div>

          {/* Color Picker */}
          <div className="space-y-4">
            <Label>Avatar Color</Label>
            <div className="flex justify-center mb-6">
              <div
                className="w-24 h-24 rounded-full flex items-center justify-center text-white text-3xl font-semibold transition-all duration-300 shadow-lg"
                style={{ backgroundColor: selectedColor }}
              >
                {nickname ? nickname.slice(0, 2).toUpperCase() : "AA"}
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              {AVATAR_COLORS.map((color) => (
                <button
                  key={color.value}
                  type="button"
                  onClick={() => setSelectedColor(color.value)}
                  className={`group relative h-16 rounded-md transition-all duration-200 ${
                    selectedColor === color.value
                      ? "scale-110 ring-2 ring-primary ring-offset-2"
                      : "hover:scale-105"
                  }`}
                  style={{ backgroundColor: color.value }}
                  data-testid={`color-${color.name.toLowerCase()}`}
                >
                  <span className="absolute inset-0 flex items-center justify-center text-white font-medium opacity-0 group-hover:opacity-100 transition-opacity">
                    {color.name}
                  </span>
                  {selectedColor === color.value && (
                    <div className="absolute inset-0 flex items-center justify-center">
                      <Check className="w-6 h-6 text-white" />
                    </div>
                  )}
                </button>
              ))}
            </div>
          </div>

          <Button
            type="submit"
            className="w-full"
            disabled={isLoading || !!(nickname && nicknameStatus !== "available")}
            data-testid="button-continue"
          >
            {isLoading ? "Setting up..." : "Continue to Messenger"}
          </Button>
        </form>
      </div>
    </div>
  );
}
