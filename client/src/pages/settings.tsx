import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { useToast } from "@/hooks/use-toast";
import { Check, X, ArrowLeft } from "lucide-react";
import type { User } from "@shared/schema";

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

const THEMES = [
  { name: "Light", value: "light" },
  { name: "Dark", value: "dark" },
];

export default function SettingsPage() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const userId = localStorage.getItem("userId");
  const [nickname, setNickname] = useState("");
  const [selectedColor, setSelectedColor] = useState(AVATAR_COLORS[0].value);
  const [selectedTheme, setSelectedTheme] = useState("light");
  const [isCheckingNickname, setIsCheckingNickname] = useState(false);
  const [nicknameStatus, setNicknameStatus] = useState<"idle" | "available" | "taken">("idle");
  const [originalNickname, setOriginalNickname] = useState("");

  const { data: currentUser } = useQuery<User>({
    queryKey: ["/api/users", userId],
    enabled: !!userId,
  });

  useEffect(() => {
    if (currentUser) {
      setNickname(currentUser.nickname);
      setOriginalNickname(currentUser.nickname);
      setSelectedColor(currentUser.avatarColor);
      setSelectedTheme(currentUser.theme);
      
      if (currentUser.theme === "dark") {
        document.documentElement.classList.add("dark");
      } else {
        document.documentElement.classList.remove("dark");
      }
    }
  }, [currentUser]);

  useEffect(() => {
    if (nickname === originalNickname) {
      setNicknameStatus("idle");
      return;
    }

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
  }, [nickname, originalNickname]);

  const updateProfileMutation = useMutation({
    mutationFn: async (updates: { nickname?: string; avatarColor?: string; theme?: string }) => {
      return apiRequest("PATCH", "/api/profile/update", updates);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      toast({
        title: "Settings saved",
        description: "Your profile has been updated successfully",
      });
    },
  });

  const handleSave = () => {
    const updates: any = {};
    
    if (nickname !== originalNickname && nicknameStatus === "available") {
      updates.nickname = nickname;
    }
    
    if (selectedColor !== currentUser?.avatarColor) {
      updates.avatarColor = selectedColor;
    }
    
    if (selectedTheme !== currentUser?.theme) {
      updates.theme = selectedTheme;
      if (selectedTheme === "dark") {
        document.documentElement.classList.add("dark");
      } else {
        document.documentElement.classList.remove("dark");
      }
    }

    if (Object.keys(updates).length > 0) {
      updateProfileMutation.mutate(updates);
    }
  };

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-2xl mx-auto space-y-8">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setLocation("/chat")}
            data-testid="button-back"
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div>
            <h1 className="text-3xl font-semibold">Settings</h1>
            <p className="text-muted-foreground">Manage your profile and preferences</p>
          </div>
        </div>

        {/* Profile Section */}
        <div className="space-y-6 bg-card p-6 rounded-lg border">
          <h2 className="text-xl font-semibold">Profile</h2>
          
          <div className="flex items-center gap-6">
            <Avatar className="w-20 h-20" style={{ backgroundColor: selectedColor }}>
              <AvatarFallback className="text-white font-semibold text-2xl">
                {nickname.slice(0, 2).toUpperCase() || "AA"}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1">
              <p className="font-medium">{nickname || "Your Nickname"}</p>
              <p className="text-sm text-muted-foreground">@{currentUser?.username}</p>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="nickname">Nickname</Label>
            <div className="relative">
              <Input
                id="nickname"
                type="text"
                value={nickname}
                onChange={(e) => setNickname(e.target.value)}
                placeholder="Your display name"
                className="pr-10"
                data-testid="input-nickname-settings"
              />
              <div className="absolute right-3 top-1/2 -translate-y-1/2">
                {isCheckingNickname && (
                  <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                )}
                {!isCheckingNickname && nickname !== originalNickname && nicknameStatus === "available" && (
                  <Check className="w-5 h-5 text-green-500" />
                )}
                {!isCheckingNickname && nickname !== originalNickname && nicknameStatus === "taken" && (
                  <X className="w-5 h-5 text-destructive" />
                )}
              </div>
            </div>
            {nickname !== originalNickname && nicknameStatus === "available" && (
              <p className="text-sm text-green-600">This nickname is available</p>
            )}
            {nickname !== originalNickname && nicknameStatus === "taken" && (
              <p className="text-sm text-destructive">This nickname is already taken</p>
            )}
          </div>

          <div className="space-y-4">
            <Label>Avatar Color</Label>
            <div className="grid grid-cols-3 gap-3">
              {AVATAR_COLORS.map((color) => (
                <button
                  key={color.value}
                  type="button"
                  onClick={() => setSelectedColor(color.value)}
                  className={`h-14 rounded-md transition-all duration-200 ${
                    selectedColor === color.value
                      ? "scale-110 ring-2 ring-primary ring-offset-2"
                      : "hover:scale-105"
                  }`}
                  style={{ backgroundColor: color.value }}
                  data-testid={`color-${color.name.toLowerCase()}`}
                >
                  {selectedColor === color.value && (
                    <Check className="w-5 h-5 text-white mx-auto" />
                  )}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Theme Section */}
        <div className="space-y-6 bg-card p-6 rounded-lg border">
          <h2 className="text-xl font-semibold">Theme</h2>
          
          <div className="grid grid-cols-2 gap-4">
            {THEMES.map((theme) => (
              <button
                key={theme.value}
                onClick={() => setSelectedTheme(theme.value)}
                className={`p-4 rounded-lg border-2 transition-all ${
                  selectedTheme === theme.value
                    ? "border-primary bg-accent"
                    : "border-border hover:border-primary/50"
                }`}
                data-testid={`theme-${theme.value}`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-medium">{theme.name}</span>
                  {selectedTheme === theme.value && (
                    <Check className="w-5 h-5 text-primary" />
                  )}
                </div>
                <div className="mt-3 h-16 rounded-md border overflow-hidden">
                  <div className={`h-full ${theme.value === "dark" ? "bg-gray-900" : "bg-white"}`}>
                    <div className={`h-2 ${theme.value === "dark" ? "bg-gray-800" : "bg-gray-100"}`} />
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Save Button */}
        <Button
          onClick={handleSave}
          disabled={updateProfileMutation.isPending}
          className="w-full"
          data-testid="button-save"
        >
          {updateProfileMutation.isPending ? "Saving..." : "Save Changes"}
        </Button>
      </div>
    </div>
  );
}
