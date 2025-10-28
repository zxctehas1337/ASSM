import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";

const benefits = [
  {
    title: "Real-time messaging",
    description: "Instant message delivery with WebSocket technology",
    features: ["Zero latency", "Always connected", "Live updates"],
  },
  {
    title: "Secure encryption",
    description: "Your conversations are protected with industry-standard security",
    features: ["Email verification", "Secure sessions", "Privacy first"],
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
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [isCodeSent, setIsCodeSent] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [resendIn, setResendIn] = useState(0);

  useEffect(() => {
    if (resendIn <= 0) return;
    const t = setInterval(() => setResendIn((s) => (s > 0 ? s - 1 : 0)), 1000);
    return () => clearInterval(t);
  }, [resendIn]);

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
      setError("");
      if (!isCodeSent) {
        await apiRequest("POST", "/api/auth/request-email-code", { email });
        setIsCodeSent(true);
        setResendIn(60);
        toast({ title: "Code sent", description: "Check your email for the 6-digit code." });
      } else {
        const response = await apiRequest("POST", "/api/auth/verify-email-code", { email, code });
        localStorage.setItem("token", response.token);
        localStorage.setItem("userId", response.userId);
        if (response.profileSetupComplete) {
          setLocation("/chat");
        } else {
          setLocation("/profile-setup");
        }
      }
    } catch (error: any) {
      const message = error.message || "Something went wrong";
      setError(message);
      toast({ title: "Error", description: message, variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex">
      {/* Left Panel - Black Background */}
      <div className="w-full lg:w-1/2 bg-black flex items-center justify-center p-8">
        <div className="w-full max-w-md space-y-8 animate-fade-in">
          <div className="text-center">
            <h1 className="text-4xl font-semibold text-white mb-2">ASSM</h1>
            <p className="text-gray-400">Sign in or sign up with your email</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6" data-testid="form-auth">
            <div className="space-y-2">
              <Label htmlFor="email" className="text-white">
                Email
              </Label>
              <Input
                id="email"
                name="email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="bg-white/10 border-white/20 text-white placeholder:text-gray-500 focus:border-white/40"
                placeholder="you@example.com"
                data-testid="input-email"
              />
              {error && (
                <p className="text-red-500 text-sm mt-1">{error}</p>
              )}
            </div>

            {isCodeSent && (
              <div className="space-y-2">
                <Label htmlFor="code" className="text-white">
                  Enter 6-digit code
                </Label>
                <div className="flex justify-center">
                  <InputOTP maxLength={6} value={code} onChange={setCode}>
                    <InputOTPGroup>
                      <InputOTPSlot index={0} />
                      <InputOTPSlot index={1} />
                      <InputOTPSlot index={2} />
                      <InputOTPSlot index={3} />
                      <InputOTPSlot index={4} />
                      <InputOTPSlot index={5} />
                    </InputOTPGroup>
                  </InputOTP>
                </div>
              </div>
            )}

            <Button
              type="submit"
              className="w-full"
              disabled={isLoading}
              data-testid="button-submit"
            >
              {isLoading ? "Please wait..." : isCodeSent ? "Verify Code" : "Send Code"}
            </Button>

            {isCodeSent && (
              <div className="text-center text-gray-400">
                {resendIn > 0 ? (
                  <span>Resend code in {resendIn}s</span>
                ) : (
                  <button
                    type="button"
                    className="hover:text-white transition-colors"
                    onClick={async () => {
                      try {
                        setIsLoading(true);
                        await apiRequest("POST", "/api/auth/request-email-code", { email });
                        setResendIn(60);
                        toast({ title: "Code re-sent", description: "Check your email again." });
                      } catch (err: any) {
                        toast({ title: "Error", description: err.message || "Failed to resend" , variant: "destructive"});
                      } finally {
                        setIsLoading(false);
                      }
                    }}
                  >
                    Resend code
                  </button>
                )}
              </div>
            )}
          </form>
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
