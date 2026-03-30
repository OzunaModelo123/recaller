"use client";

import { useEffect, useState } from "react";

import { cn } from "@/lib/utils";

type GreetingPhrase =
  | "Hello"
  | "Good morning"
  | "Good afternoon"
  | "Good evening";

function phraseForHour(h: number): GreetingPhrase {
  if (h >= 5 && h < 12) return "Good morning";
  if (h >= 12 && h < 17) return "Good afternoon";
  if (h >= 17 && h < 22) return "Good evening";
  return "Hello";
}

type Props = {
  firstName: string;
  className?: string;
};

export function TimeOfDayGreeting({ firstName, className }: Props) {
  const [phrase, setPhrase] = useState<GreetingPhrase>("Hello");

  useEffect(() => {
    const id = requestAnimationFrame(() => {
      setPhrase(phraseForHour(new Date().getHours()));
    });
    return () => cancelAnimationFrame(id);
  }, []);

  return (
    <h1
      className={cn(
        "mt-2 text-3xl font-semibold tracking-tight text-sidebar-foreground",
        className,
      )}
    >
      <span className="font-normal text-sidebar-foreground/90">{phrase}, </span>
      {firstName}
    </h1>
  );
}
