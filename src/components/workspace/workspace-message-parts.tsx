import type { ReactNode } from "react";
import type { MessageAttachment, MessageReaction } from "@/components/workspace/workspace-types";
import { FileIcon } from "@public/svg/icon";

export function AttachmentCards({
  attachments,
  isOwn = false,
  theme = "dark",
}: {
  attachments: MessageAttachment[];
  isOwn?: boolean;
  theme?: "light" | "dark";
}) {
  if (!attachments.length) return null;
  const isDark = theme === "dark";
  const cardCls = isOwn
    ? isDark
      ? "border-black/10 bg-black/[0.04] text-neutral-900 hover:bg-black/[0.08]"
      : "border-white/20 bg-white/[0.10] text-white hover:bg-white/[0.16]"
    : "border-border/70 bg-background/60 hover:bg-accent/60 text-foreground";
  const subtextCls = isOwn
    ? isDark
      ? "text-neutral-600"
      : "text-white/70"
    : "text-muted-foreground";

  return (
    <div className="mt-2 grid gap-1.5 sm:max-w-md">
      {attachments.map((attachment) =>
        attachment.url ? (
          <a
            key={attachment.id}
            href={attachment.url}
            target="_blank"
            rel="noreferrer"
            className={`flex min-w-0 items-center gap-2.5 rounded-lg border px-2.5 py-2 text-left transition-colors ${cardCls}`}
          >
            <span className="shrink-0 flex items-center justify-center">
              <FileIcon fileName={attachment.name} fileType={attachment.type} size={24} />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-xs font-medium">{attachment.name}</span>
              <span className={`block text-[10px] ${subtextCls}`}>
                {attachment.type} · {Math.max(1, Math.round(attachment.size / 1024))} KB
              </span>
            </span>
            <span className={`text-[10px] ${subtextCls}`}>Open</span>
          </a>
        ) : (
          <div
            key={attachment.id}
            className={`flex min-w-0 items-center gap-2.5 rounded-lg border px-2.5 py-2 ${cardCls}`}
          >
            <span className="shrink-0 flex items-center justify-center">
              <FileIcon fileName={attachment.name} fileType={attachment.type} size={24} />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-xs font-medium">{attachment.name}</span>
              <span className={`block text-[10px] ${subtextCls}`}>
                {attachment.type} · {Math.max(1, Math.round(attachment.size / 1024))} KB
              </span>
            </span>
          </div>
        )
      )}
    </div>
  );
}

export function MessageReactionChips({
  reactions,
  onToggle,
  isOwn = false,
  theme = "dark",
}: {
  reactions: MessageReaction[];
  onToggle: (emoji: string) => void;
  isOwn?: boolean;
  theme?: "light" | "dark";
}) {
  if (!reactions.length) return null;
  const isDark = theme === "dark";

  return (
    <div className="mt-2 flex flex-wrap items-center gap-1.5">
      {reactions.map((reaction) => {
        let chipCls = "";
        let countCls = "";

        if (isOwn) {
          if (isDark) {
            // Dark mode own message bubble is white/light (bg-primary: oklch(0.922 0 0))
            if (reaction.reacted) {
              chipCls = "border-sky-300/80 bg-sky-100 hover:bg-sky-200/90 shadow-xs";
              countCls = "text-sky-800 font-semibold";
            } else {
              chipCls = "border-black/10 bg-black/[0.05] hover:bg-black/[0.10] hover:border-black/20";
              countCls = "text-neutral-800 font-medium";
            }
          } else {
            // Light mode own message bubble is dark charcoal (bg-primary: oklch(0.205 0 0))
            if (reaction.reacted) {
              chipCls = "border-sky-400/50 bg-sky-500/25 hover:bg-sky-500/35 shadow-xs";
              countCls = "text-sky-200 font-semibold";
            } else {
              chipCls = "border-white/15 bg-white/[0.10] hover:bg-white/[0.16] hover:border-white/25";
              countCls = "text-white/90 font-medium";
            }
          }
        } else {
          // Standard card or assistant response
          if (reaction.reacted) {
            chipCls = "border-sky-500/40 bg-sky-500/15 hover:bg-sky-500/25 text-sky-600 dark:text-sky-300 shadow-xs";
            countCls = "text-sky-700 dark:text-sky-300 font-semibold";
          } else {
            chipCls = "border-border/80 bg-muted/60 hover:bg-muted text-muted-foreground hover:text-foreground";
            countCls = "text-muted-foreground group-hover/chip:text-foreground font-medium";
          }
        }

        return (
          <button
            key={reaction.emoji}
            type="button"
            onClick={() => onToggle(reaction.emoji)}
            aria-pressed={reaction.reacted}
            title={reaction.reacted ? `Remove ${reaction.emoji} reaction` : `React with ${reaction.emoji}`}
            className={`group/chip inline-flex h-7 items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs transition-all duration-150 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring select-none ${chipCls}`}
          >
            <span className="text-sm leading-none">{reaction.emoji}</span>
            <span className={`text-[11px] leading-none ${countCls}`}>{reaction.count}</span>
          </button>
        );
      })}
    </div>
  );
}

export function renderMessageContent(content: string, mentionLabels: string[]) {
  const labels = [...new Set(["Gluk", ...mentionLabels].filter(Boolean))].sort((a, b) => b.length - a.length).map((label) => label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  const pattern = new RegExp(`@(?:${labels.join("|")})(?=$|[\\s.,!?;:])|@[\\w][\\w.-]*`, "gi");
  const parts: ReactNode[] = [];
  let offset = 0;
  for (const match of content.matchAll(pattern)) {
    const index = match.index ?? 0;
    if (index > offset) parts.push(content.slice(offset, index));
    parts.push(<span key={`${index}-${match[0]}`} className="font-semibold text-sky-500">{match[0]}</span>);
    offset = index + match[0].length;
  }
  if (offset < content.length) parts.push(content.slice(offset));
  return parts;
}

export function messageMentionsUser(content: string, name?: string | null, email?: string | null) {
  const labels = [name, email, email?.split("@")[0]].filter((label): label is string => Boolean(label?.trim()));
  return labels.some((label) => {
    const escaped = label.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    return new RegExp(`(^|\\s)@${escaped}(?=$|[\\s.,!?;:])`, "i").test(content);
  });
}
