import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { FaGoogle, FaGithub } from "react-icons/fa";

const benefits = [
  {
    title: "Real-time messaging",
    description: "Instant message delivery with WebSocket technology",
    features: ["Zero latency", "Always connected", "Live updates"],
  },
  {
    title: "Secure encryption",
    description: "Your conversations are protected with industry-standard security",
    features: ["OAuth authentication", "Secure sessions", "Privacy first"],
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
  const [currentBenefit, setCurrentBenefit] = useState(0);

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (token) {
      setLocation("/chat");
    }

    // Handle OAuth callback
    const params = new URLSearchParams(window.location.search);
    const callbackToken = params.get("token");
    const userId = params.get("userId");
    const profileSetupComplete = params.get("profileSetupComplete");
    const authError = params.get("error");

    if (authError) {
      toast({
        title: "Authentication failed",
        description: "Could not authenticate with the provider. Please try again.",
        variant: "destructive",
      });
      // Clean URL
      window.history.replaceState({}, document.title, "/auth");
    } else if (callbackToken && userId) {
      localStorage.setItem("token", callbackToken);
      localStorage.setItem("userId", userId);
      
      if (profileSetupComplete === "true") {
        setLocation("/chat");
      } else {
        setLocation("/profile-setup");
      }
    }
  }, [setLocation, toast]);

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentBenefit((prev) => (prev + 1) % benefits.length);
    }, 4000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="min-h-screen flex">
      {/* Left Panel - Black Background */}
      <div className="w-full lg:w-1/2 bg-black flex items-center justify-center p-8">
        <div className="w-full max-w-md space-y-8 animate-fade-in">
          <div className="text-center">
            <h1 className="text-4xl font-semibold text-white mb-2">ASSM</h1>
            <p className="text-gray-400">Sign in or sign up</p>
          </div>

          {/* OAuth Buttons */}
          <div className="space-y-3">
            <Button
              type="button"
              variant="outline"
              className="w-full bg-white hover:bg-gray-100 text-black border-white/20"
              onClick={() => window.location.href = "/api/auth/google"}
            >
              <FaGoogle className="mr-2 h-5 w-5" />
              Continue with Google
            </Button>
            
            <Button
              type="button"
              variant="outline"
              className="w-full bg-white hover:bg-gray-100 text-black border-white/20"
              onClick={() => window.location.href = "/api/auth/github"}
            >
              <FaGithub className="mr-2 h-5 w-5" />
              Continue with GitHub
            </Button>
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
