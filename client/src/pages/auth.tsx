import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

const benefits = [
  {
    title: "Real-time messaging",
    description: "Instant message delivery with WebSocket technology",
    features: ["Zero latency", "Always connected", "Live updates"],
  },
  {
    title: "Secure encryption",
    description: "Your conversations are protected with industry-standard security",
    features: ["Encrypted passwords", "Secure sessions", "Privacy first"],
  },
  {
    title: "Custom themes",
    description: "Personalize your experience with custom colors and themes",
    features: ["Light & dark modes", "Custom accent colors", "Your style"],
  },
  {
    title: "Simple & fast",
    description: "Clean, minimalist interface designed for productivity",
    features: ["No clutter", "Intuitive design", "Lightning fast"],
  },
  {
    title: "Everything for you",
    description: "The service adapts to your needs, offering the most convenient and useful solutions just for you.",
    features: [
      "Individual settings",
      "Easy profile setup",
      "Adaptive interface",
      "Thoughtful details",
      "Support in any situation"
    ],
  },
];

export default function AuthPage() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [isSignUp, setIsSignUp] = useState(false);
  const [currentBenefit, setCurrentBenefit] = useState(0);
  const [formData, setFormData] = useState({
    username: "",
    password: "",
  });
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (token) {
      setLocation("/chat");
    }
  }, [setLocation]);

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentBenefit((prev) => (prev + 1) % benefits.length);
    }, 4000);
    return () => clearInterval(interval);
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      if (isSignUp) {
        const response = await apiRequest("POST", "/api/auth/register", formData);
        localStorage.setItem("token", response.token);
        localStorage.setItem("userId", response.userId);
        toast({
          title: "Account created!",
          description: "Welcome to ASSM. Let's set up your profile.",
        });
        setLocation("/profile-setup");
      } else {
        const response = await apiRequest("POST", "/api/auth/login", {
          username: formData.username,
          password: formData.password,
        });
        localStorage.setItem("token", response.token);
        localStorage.setItem("userId", response.userId);
        
        if (response.profileSetupComplete) {
          setLocation("/chat");
        } else {
          setLocation("/profile-setup");
        }
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Something went wrong",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  return (
    <div className="min-h-screen flex">
      {/* Left Panel - Black Background */}
      <div className="w-full lg:w-1/2 bg-black flex items-center justify-center p-8">
        <div className="w-full max-w-md space-y-8 animate-fade-in">
          <div className="text-center">
            <h1 className="text-4xl font-semibold text-white mb-2">ASSM</h1>
            <p className="text-gray-400">
              {isSignUp ? "Create your account" : "Welcome back"}
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6" data-testid="form-auth">
            <div className="space-y-2">
              <Label htmlFor="username" className="text-white">
                Username
              </Label>
              <Input
                id="username"
                name="username"
                type="text"
                required
                value={formData.username}
                onChange={handleChange}
                className="bg-white/10 border-white/20 text-white placeholder:text-gray-500 focus:border-white/40"
                placeholder="Choose a username"
                data-testid="input-username"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password" className="text-white">
                Password
              </Label>
              <Input
                id="password"
                name="password"
                type="password"
                required
                value={formData.password}
                onChange={handleChange}
                className="bg-white/10 border-white/20 text-white placeholder:text-gray-500 focus:border-white/40"
                placeholder="Enter your password"
                data-testid="input-password"
              />
            </div>

            <Button
              type="submit"
              className="w-full"
              disabled={isLoading}
              data-testid="button-submit"
            >
              {isLoading ? "Please wait..." : isSignUp ? "Sign Up" : "Sign In"}
            </Button>
          </form>

          <div className="text-center">
            <button
              type="button"
              onClick={() => setIsSignUp(!isSignUp)}
              className="text-gray-400 hover:text-white transition-colors"
              data-testid="button-toggle-mode"
            >
              {isSignUp
                ? "Already have an account? Sign in"
                : "Don't have an account? Sign up"}
            </button>
          </div>
        </div>
      </div>

      {/* Right Panel - White Background with Animated Benefits */}
      <div className="hidden lg:flex w-1/2 bg-white items-center justify-center p-12">
        <div className="max-w-md w-full">
          {benefits.map((benefit, index) => (
            <div
              key={index}
              className={`transition-all duration-500 ${
                currentBenefit === index
                  ? "opacity-100 translate-x-0"
                  : "opacity-0 absolute translate-x-8 pointer-events-none"
              }`}
            >
              <h2 className="text-3xl font-semibold text-black mb-3">
                {benefit.title}
              </h2>
              <p className="text-gray-600 mb-6 text-lg">{benefit.description}</p>
              <ul className="space-y-3">
                {benefit.features.map((feature, idx) => (
                  <li key={idx} className="flex items-center text-gray-700">
                    <div className="w-2 h-2 rounded-full bg-primary mr-3" />
                    {feature}
                  </li>
                ))}
              </ul>
            </div>
          ))}

          {/* Dot Indicators */}
          <div className="flex gap-2 mt-8">
            {benefits.map((_, index) => (
              <button
                key={index}
                onClick={() => setCurrentBenefit(index)}
                className={`transition-all duration-300 rounded-full ${
                  currentBenefit === index
                    ? "w-8 h-2 bg-primary"
                    : "w-2 h-2 bg-gray-300 hover:bg-gray-400"
                }`}
                data-testid={`indicator-${index}`}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
