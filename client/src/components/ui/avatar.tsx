"use client"

import * as React from "react"
import * as AvatarPrimitive from "@radix-ui/react-avatar"
import { useState, useEffect } from "react";

import { cn } from "@/lib/utils"

const Avatar = React.forwardRef<
  React.ElementRef<typeof AvatarPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof AvatarPrimitive.Root>
>(({ className, ...props }, ref) => (
  <AvatarPrimitive.Root
    ref={ref}
    className={cn(`
      after:content-[''] after:block after:absolute after:inset-0 after:rounded-full after:pointer-events-none after:border after:border-black/10 dark:after:border-white/10
      relative flex h-10 w-10 shrink-0 overflow-hidden rounded-full`,
      className
    )}
    {...props}
  />
))
Avatar.displayName = AvatarPrimitive.Root.displayName

const AvatarImage = React.forwardRef<
  React.ElementRef<typeof AvatarPrimitive.Image>,
  React.ComponentPropsWithoutRef<typeof AvatarPrimitive.Image>
>(({ className, ...props }, ref) => (
  <AvatarPrimitive.Image
    ref={ref}
    className={cn("aspect-square h-full w-full", className)}
    {...props}
  />
))
AvatarImage.displayName = AvatarPrimitive.Image.displayName

const AvatarFallback = React.forwardRef<
  React.ElementRef<typeof AvatarPrimitive.Fallback>,
  React.ComponentPropsWithoutRef<typeof AvatarPrimitive.Fallback> & {
    nickname?: string;
    letterCount?: number;
  }
>(({ className, nickname, letterCount = 3, ...props }, ref) => {
  const [avatarColor, setAvatarColor] = useState<string | null>(null);

  // Function to get initials
  const getInitials = (name?: string) => {
    if (!name) return '';
    // Split by spaces and take first 3 words, then take first letter of each
    const words = name.trim().split(/\s+/);
    return words
      .slice(0, letterCount)
      .map(word => word[0].toUpperCase())
      .join('')
      .substring(0, letterCount);
  };

  useEffect(() => {
    // Retrieve avatar color from local storage or user profile
    const storedColor = localStorage.getItem('avatarColor');
    setAvatarColor(storedColor);
  }, []);

  return (
    <AvatarPrimitive.Fallback
      ref={ref}
      className={cn(
        "flex h-full w-full items-center justify-center rounded-full text-white text-sm font-medium",
        // Base styles for both light and dark themes
        "bg-opacity-30 dark:bg-opacity-50",
        // Fallback muted background if no color is set
        "bg-muted dark:bg-muted-dark",
        className
      )}
      style={{
        backgroundColor: avatarColor || undefined,
        // Adjust color opacity and brightness based on theme
        filter: `brightness(${
          document.documentElement.classList.contains('dark') ? '0.7' : '1'})`
      }}
      {...props}
    >
<<<<<<< HEAD
      {props.children}
=======
      {getInitials(nickname)}
>>>>>>> 728d8c20414b35e3e978f94a68fb312ffddf9537
    </AvatarPrimitive.Fallback>
  );
});
AvatarFallback.displayName = AvatarPrimitive.Fallback.displayName

export { Avatar, AvatarImage, AvatarFallback }
