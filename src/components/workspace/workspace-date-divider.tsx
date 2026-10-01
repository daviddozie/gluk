"use client";

import { ChevronDown } from "lucide-react";

export function formatChatDate(date: Date | string | number): string {
  const d = new Date(date);
  if (isNaN(d.getTime())) return "";

  const now = new Date();
  const isToday =
    d.getDate() === now.getDate() &&
    d.getMonth() === now.getMonth() &&
    d.getFullYear() === now.getFullYear();

  if (isToday) return "Today";

  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  const isYesterday =
    d.getDate() === yesterday.getDate() &&
    d.getMonth() === yesterday.getMonth() &&
    d.getFullYear() === yesterday.getFullYear();

  if (isYesterday) return "Yesterday";

  const isCurrentYear = d.getFullYear() === now.getFullYear();
  if (isCurrentYear) {
    // e.g. "Wednesday, 30 September"
    return d.toLocaleDateString("en-GB", {
      weekday: "long",
      day: "numeric",
      month: "long",
    });
  }

  // e.g. "Wednesday, 30 September 2025"
  return d.toLocaleDateString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

export function isSameChatDay(
  date1: Date | string | number,
  date2: Date | string | number
): boolean {
  const d1 = new Date(date1);
  const d2 = new Date(date2);
  if (isNaN(d1.getTime()) || isNaN(d2.getTime())) return false;
  return (
    d1.getFullYear() === d2.getFullYear() &&
    d1.getMonth() === d2.getMonth() &&
    d1.getDate() === d2.getDate()
  );
}

export function WorkspaceDateDivider({
  date,
  label,
  className = "",
}: {
  date?: Date | string | number;
  label?: string;
  className?: string;
}) {
  const displayText = label ?? (date ? formatChatDate(date) : "");
  if (!displayText) return null;

  return (
    <div
      role="separator"
      aria-label={displayText}
      className={`relative my-4 flex items-center justify-center select-none ${className}`}
    >
      <div className="absolute inset-0 flex items-center" aria-hidden="true">
        <div className="w-full border-t border-border/60" />
      </div>
      <div className="relative flex justify-center">
        <button
          type="button"
          tabIndex={-1}
          className="inline-flex items-center gap-1.5 rounded-full border border-border/80 bg-background px-3.5 py-1 text-xs font-semibold text-foreground/80 shadow-xs backdrop-blur-xs transition-colors hover:border-border hover:bg-accent/70 hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
        >
          <span>{displayText}</span>
          <ChevronDown className="h-3 w-3 text-muted-foreground opacity-70" />
        </button>
      </div>
    </div>
  );
}
