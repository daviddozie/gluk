"use client";

import Image from "next/image";

export type TypingMemberPayload = {
  name: string;
  avatarUrl?: string | null;
};

export function WorkspaceTypingIndicator({
  typingMembers,
  members = [],
  isDark = true,
}: {
  typingMembers: Record<string, TypingMemberPayload | string>;
  members?: { email: string; name: string; avatarUrl: string | null }[];
  isDark?: boolean;
}) {
  const entries = Object.entries(typingMembers);
  if (!entries.length) return null;

  // Resolve list of typing users with avatar & name
  const typers = entries.map(([email, val]) => {
    const rawName = typeof val === "string" ? val : val.name;
    const rawAvatar = typeof val === "string" ? null : val.avatarUrl;
    const member = members.find((m) => m.email.toLowerCase() === email.toLowerCase());
    return {
      email,
      name: rawName || member?.name || "Member",
      avatarUrl: rawAvatar || member?.avatarUrl || null,
    };
  });

  const namesLabel =
    typers.length === 1
      ? `${typers[0].name} is typing…`
      : typers.length === 2
      ? `${typers[0].name} and ${typers[1].name} are typing…`
      : `${typers[0].name} and ${typers.length - 1} others are typing…`;

  return (
    <div
      role="status"
      aria-live="polite"
      className="flex items-center gap-2.5 py-1.5 px-1 animate-in fade-in zoom-in-95 slide-in-from-bottom-2 duration-200"
    >
      {/* Avatars */}
      <div className="flex -space-x-2 overflow-hidden shrink-0">
        {typers.slice(0, 3).map((typer) => (
          <span
            key={typer.email}
            className="relative grid h-7 w-7 place-items-center overflow-hidden rounded-full border-2 border-background bg-muted text-[10px] font-semibold text-muted-foreground shadow-xs transition-transform duration-200 hover:scale-110"
            title={`${typer.name} is typing`}
          >
            {typer.avatarUrl ? (
              <Image
                src={typer.avatarUrl}
                alt={typer.name}
                fill
                sizes="28px"
                unoptimized
                className="object-cover"
              />
            ) : (
              typer.name
                .trim()
                .split(/\s+/)
                .slice(0, 2)
                .map((p) => p[0])
                .join("")
                .toUpperCase() || "?"
            )}
          </span>
        ))}
      </div>

      {/* Speech bubble with 3 dancing dots */}
      <div className="flex items-center gap-2">
        <div className="inline-flex items-center gap-1 rounded-2xl rounded-bl-xs border border-border/80 bg-card/90 px-3 py-1.5 shadow-xs backdrop-blur-xs">
          {[0, 1, 2].map((dot) => (
            <span
              key={dot}
              className={`h-1.5 w-1.5 rounded-full animate-typing-dot ${
                isDark ? "bg-neutral-300" : "bg-neutral-600"
              }`}
              style={{
                animationDelay: `${dot * 180}ms`,
              }}
            />
          ))}
        </div>
        <span className="text-xs font-medium text-muted-foreground animate-pulse select-none">
          {namesLabel}
        </span>
      </div>
    </div>
  );
}
