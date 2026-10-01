"use client";
import { Fragment, useEffect, useMemo, type Dispatch, type FormEvent, type RefObject, type SetStateAction } from "react";
import Image from "next/image";
import { AtSign, Bot, Check, CircleAlert, Clock3, FileText, Mail, MessageSquareReply, MessageSquareText, Plus, Send, SmilePlus, UsersRound, X } from "lucide-react";
import MessageBubble from "@/components/message-bubble";
import { WorkspaceEmojiPicker } from "@/components/workspace/workspace-emoji-picker";
import { QUICK_WORKSPACE_REACTIONS } from "@/components/workspace/workspace-emoji-data";
import { AttachmentCards, MessageReactionChips, messageMentionsUser, renderMessageContent } from "@/components/workspace/workspace-message-parts";
import { WorkspaceDateDivider, isSameChatDay } from "@/components/workspace/workspace-date-divider";
import { WorkspaceTypingIndicator, type TypingMemberPayload } from "@/components/workspace/workspace-typing-indicator";
import type { MentionOption, Message, ReplyReference, Workspace, WorkspaceTheme } from "@/components/workspace/workspace-types";
import type { Message as ConversationMessage } from "@/types/chat";
import { FileIcon } from "@public/svg/icon";

type CurrentUser = { email?: string | null; name?: string | null; image?: string | null };
type WorkspaceChatPanelProps = {
  messageListRef: RefObject<HTMLDivElement | null>;
  composerRef: RefObject<HTMLTextAreaElement | null>;
  fileInputRef: RefObject<HTMLInputElement | null>;
  composerSelectionRef: RefObject<{ start: number; end: number }>;
  typingMembers: Record<string, TypingMemberPayload | string>;
  socketReady: boolean;
  messagesLoading?: boolean;
  workspaceMessages: Message[];
  session: { user?: CurrentUser | null };
  workspace: Workspace;
  theme: WorkspaceTheme;
  mentionLabels: string[];
  glukResponding: boolean;
  reactionPickerFor: string | null;
  setReactionPickerFor: Dispatch<SetStateAction<string | null>>;
  onToggleReaction: (message: Message, emoji: string) => void | Promise<void>;
  onReply: (message: Message) => void;
  onRetry: (message: Message) => void;
  replyTo: ReplyReference | null;
  setReplyTo: Dispatch<SetStateAction<ReplyReference | null>>;
  submitMessage: (event: FormEvent<HTMLFormElement>) => void;
  handleFilesSelected: (files: FileList | null) => void;
  attachedFiles: File[];
  setAttachedFiles: Dispatch<SetStateAction<File[]>>;
  mentionContext: { start: number; end: number; query: string } | null;
  filteredMentionOptions: MentionOption[];
  activeMentionIndex: number;
  selectMention: (option: MentionOption) => void;
  message: string;
  handleMessageChange: (value: string, caret: number) => void;
  onComposerKeyDown: (event: React.KeyboardEvent<HTMLTextAreaElement>) => void;
  emojiPickerOpen: boolean;
  setEmojiPickerOpen: Dispatch<SetStateAction<boolean>>;
  insertComposerText: (value: string) => number;
  openMentionPicker: () => void;
  onPreview?: (file: { name: string; url?: string; type?: string }) => void;
};

function MemberAvatar({ name, src, assistant = false }: { name: string; src?: string | null; assistant?: boolean }) {
  return <span className="relative grid h-8 w-8 shrink-0 place-items-center overflow-hidden rounded-full border border-border/70 bg-muted text-[11px] font-semibold text-muted-foreground">{assistant ? <Bot className="h-4 w-4" /> : src ? <Image src={src} alt={`${name}'s profile`} fill sizes="32px" unoptimized className="object-cover" /> : name.trim().split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toUpperCase() || "?"}</span>;
}

function WorkspaceFilePreviewChip({
  file,
  onRemove,
  onPreview,
  isDark,
}: {
  file: File;
  onRemove: () => void;
  onPreview?: () => void;
  isDark: boolean;
}) {
  const isImg = file.type.startsWith("image/");
  const ext = file.name.split(".").pop()?.toUpperCase() || (file.type ? file.type.split("/").pop()?.toUpperCase() : "FILE");

  const previewUrl = useMemo(() => {
    if (!isImg || typeof window === "undefined") return null;
    return URL.createObjectURL(file);
  }, [file, isImg]);

  useEffect(() => {
    return () => {
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, [previewUrl]);

  return (
    <div
      className={`relative group flex items-center gap-3 px-3.5 py-2.5 rounded-2xl border transition-all duration-300 max-w-[280px] sm:max-w-[320px] flex-shrink-0 ${
        isDark
          ? "bg-white/[0.06] border-white/10 text-white"
          : "bg-black/[0.04] border-black/10 text-black"
      }`}
    >
      <div
        onClick={onPreview}
        className={`flex items-center gap-3 min-w-0 flex-1 ${onPreview ? "cursor-pointer" : ""}`}
      >
        {isImg && previewUrl ? (
          <div className="w-8 h-8 rounded-lg overflow-hidden shrink-0 border border-white/10">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={previewUrl} alt={file.name} className="w-full h-full object-cover" />
          </div>
        ) : (
          <div className="shrink-0 flex items-center justify-center">
            <FileIcon fileName={file.name} fileType={file.type} size={26} />
          </div>
        )}

        <div className="flex flex-col min-w-0 flex-1 text-left">
          <span className="text-xs font-medium truncate block" title={file.name}>
            {file.name}
          </span>
          <span
            className={`text-[10px] uppercase tracking-wider font-medium ${
              isDark ? "text-white/40" : "text-black/40"
            }`}
          >
            {ext}
          </span>
        </div>
      </div>

      <button
        type="button"
        onClick={onRemove}
        className={`shrink-0 ml-1 w-5 h-5 rounded-full flex items-center justify-center cursor-pointer transition-colors ${
          isDark
            ? "text-white/40 hover:text-white/90 hover:bg-white/10"
            : "text-black/40 hover:text-black/90 hover:bg-black/10"
        }`}
        title={`Remove ${file.name}`}
        aria-label={`Remove ${file.name}`}
      >
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}

export function WorkspaceChatPanel(props: WorkspaceChatPanelProps) {
  const { messageListRef, composerRef, fileInputRef, composerSelectionRef, typingMembers, socketReady, messagesLoading, workspaceMessages, session, workspace: w, theme, mentionLabels, glukResponding, reactionPickerFor, setReactionPickerFor, onToggleReaction: toggleReaction, onReply: beginReply, onRetry: deliverWorkspaceMessage, replyTo, setReplyTo, submitMessage, handleFilesSelected, attachedFiles, setAttachedFiles, mentionContext, filteredMentionOptions, activeMentionIndex, selectMention, message, handleMessageChange, onComposerKeyDown, emojiPickerOpen, setEmojiPickerOpen, insertComposerText, openMentionPicker, onPreview } = props;
  const isDark = theme === "dark";
  return (
          <section className="flex min-h-0 flex-1 flex-col">
            <div ref={messageListRef} className="min-h-0 flex-1 space-y-3 overflow-y-auto py-4 pr-1">
              {!workspaceMessages.length && (messagesLoading ?? !socketReady) ? (
                <div className="space-y-4">
                  {[1, 2, 3].map((i) => (
                    <div
                      key={i}
                      className="h-16 animate-pulse rounded-2xl bg-muted"
                    />
                  ))}
                </div>
              ) : workspaceMessages.length ? (
                workspaceMessages.map((m, index) => {
                  const isOwn = m.role === "user" && m.userEmail === session.user?.email?.toLowerCase();
                  const member = w.members.find((item) => item.email === m.userEmail);
                  const senderName = m.role === "assistant" ? "Gluk" : m.userName;
                  const avatarUrl = member?.avatarUrl ?? (isOwn ? session.user?.image : null);
                  const sentAt = new Date(m.createdAt);
                  const isMentionForMe = messageMentionsUser(m.content, session.user?.name, session.user?.email);
                  const prevMessage = index > 0 ? workspaceMessages[index - 1] : null;
                  const showDateDivider = !prevMessage || !isSameChatDay(prevMessage.createdAt, m.createdAt);
                  if (m.role === "assistant") {
                    const assistantMessage: ConversationMessage = {
                      id: m.id,
                      role: "assistant",
                      content: m.content,
                      createdAt: sentAt,
                      isStreaming: m.isStreaming,
                    };
                    return (
                      <Fragment key={m.id}>
                        {showDateDivider && <WorkspaceDateDivider date={sentAt} />}
                        <article tabIndex={0} className={`group/message relative -mx-2 max-w-full rounded-2xl p-2 transition-colors hover:bg-muted/25 focus-within:bg-muted/25 focus-visible:outline-none ${isMentionForMe ? "bg-sky-500/5" : ""}`}>
                          {!m.isStreaming && <div className="absolute right-3 top-1 z-20 flex items-center gap-0.5 rounded-xl border border-border/80 bg-popover p-1 text-popover-foreground opacity-100 shadow-md transition-opacity sm:top-2 sm:opacity-0 sm:group-hover/message:opacity-100 sm:group-focus-within/message:opacity-100">
                            {QUICK_WORKSPACE_REACTIONS.map((emoji) => {
                              const isReacted = (m.reactions ?? []).some((r) => r.emoji === emoji && r.reacted);
                              return (
                                <button
                                  key={emoji}
                                  type="button"
                                  onClick={() => void toggleReaction(m, emoji)}
                                  aria-label={`React with ${emoji}`}
                                  aria-pressed={isReacted}
                                  className={`grid h-7 w-7 place-items-center rounded-md text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                                    isReacted ? "bg-sky-500/20 text-sky-600 dark:text-sky-300 ring-1 ring-sky-500/40" : "hover:bg-accent"
                                  }`}
                                >
                                  {emoji}
                                </button>
                              );
                            })}
                            <button type="button" onClick={() => setReactionPickerFor(reactionPickerFor === m.id ? null : m.id)} aria-label="Choose reaction" title="Choose reaction" className="grid h-7 w-7 place-items-center rounded-md hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"><SmilePlus className="h-4 w-4" /></button>
                            <button type="button" onClick={() => beginReply(m)} aria-label="Reply to Gluk" title="Reply" className="grid h-7 w-7 place-items-center rounded-md hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"><MessageSquareReply className="h-4 w-4" /></button>
                          </div>}
                          {reactionPickerFor === m.id && <div className="absolute right-3 top-11 z-30"><WorkspaceEmojiPicker onClose={() => setReactionPickerFor(null)} onSelect={(emoji) => void toggleReaction(m, emoji)} /></div>}
                          <div className="mb-1 flex items-center gap-2 px-1 text-[11px] text-muted-foreground">
                            <span className="font-medium text-foreground">Gluk</span>
                            <time dateTime={sentAt.toISOString()} title={sentAt.toLocaleString()}>{sentAt.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}</time>
                          </div>
                          {m.replyTo && <div className="mb-2 max-w-md rounded-md border-l-2 border-sky-500/70 bg-muted/40 px-2.5 py-1.5 text-xs"><span className="font-medium text-foreground">Replying to {m.replyTo.userName}</span><p className="mt-0.5 line-clamp-2 text-muted-foreground">{m.replyTo.content}</p></div>}
                          <MessageBubble message={assistantMessage} theme={theme} />
                          <AttachmentCards attachments={m.attachments ?? []} isOwn={false} theme={theme} />
                          <MessageReactionChips reactions={m.reactions ?? []} onToggle={(emoji) => void toggleReaction(m, emoji)} isOwn={false} theme={theme} />
                        </article>
                      </Fragment>
                    );
                  }
                  return (
                    <Fragment key={m.clientMessageId ?? m.id}>
                      {showDateDivider && <WorkspaceDateDivider date={sentAt} />}
                      <article tabIndex={0} className={`group/message relative -mx-2 flex items-end gap-2.5 rounded-xl p-2 transition-colors hover:bg-muted/25 focus-within:bg-muted/25 focus-visible:outline-none ${isOwn ? "justify-end" : "justify-start"} ${isMentionForMe ? "bg-sky-500/5" : ""}`}>
                        {m.deliveryStatus !== "sending" && m.deliveryStatus !== "failed" && <div className={`absolute top-0 z-20 flex items-center gap-0.5 rounded-xl border border-border/80 bg-popover p-1 text-popover-foreground opacity-100 shadow-md transition-opacity sm:top-1 sm:opacity-0 sm:group-hover/message:opacity-100 sm:group-focus-within/message:opacity-100 ${isOwn ? "right-14" : "left-14"}`}>
                          {QUICK_WORKSPACE_REACTIONS.map((emoji) => {
                            const isReacted = (m.reactions ?? []).some((r) => r.emoji === emoji && r.reacted);
                            return (
                              <button
                                key={emoji}
                                type="button"
                                onClick={() => void toggleReaction(m, emoji)}
                                aria-label={`React with ${emoji}`}
                                aria-pressed={isReacted}
                                className={`grid h-7 w-7 place-items-center rounded-md text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                                  isReacted ? "bg-sky-500/20 text-sky-600 dark:text-sky-300 ring-1 ring-sky-500/40" : "hover:bg-accent"
                                }`}
                              >
                                {emoji}
                              </button>
                            );
                          })}
                          <button type="button" onClick={() => setReactionPickerFor(reactionPickerFor === m.id ? null : m.id)} aria-label="Choose reaction" title="Choose reaction" className="grid h-7 w-7 place-items-center rounded-md hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"><SmilePlus className="h-4 w-4" /></button>
                          <button type="button" onClick={() => beginReply(m)} aria-label={`Reply to ${senderName}`} title="Reply" className="grid h-7 w-7 place-items-center rounded-md hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"><MessageSquareReply className="h-4 w-4" /></button>
                        </div>}
                        {reactionPickerFor === m.id && <div className={`absolute top-10 z-30 ${isOwn ? "right-14" : "left-14"}`}><WorkspaceEmojiPicker onClose={() => setReactionPickerFor(null)} onSelect={(emoji) => void toggleReaction(m, emoji)} /></div>}
                        {!isOwn && <MemberAvatar name={senderName} src={avatarUrl} />}
                        <div className={`max-w-[min(82%,48rem)] ${isOwn ? "items-end" : "items-start"}`}>
                          <div className={`mb-1 flex items-center gap-2 px-1 text-[11px] text-muted-foreground ${isOwn ? "justify-end" : "justify-start"}`}>
                            <span className="font-medium text-foreground">{senderName}</span>
                            <time dateTime={sentAt.toISOString()} title={sentAt.toLocaleString()}>
                              {sentAt.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}
                            </time>
                            {isOwn && m.deliveryStatus === "sending" && <Clock3 aria-label="Sending" className="h-3 w-3" />}
                            {isOwn && m.deliveryStatus === "sent" && <Check aria-label="Sent" className="h-3.5 w-3.5 text-sky-500" />}
                            {isOwn && m.deliveryStatus === "failed" && (
                              <button
                                type="button"
                                onClick={() => void deliverWorkspaceMessage(m)}
                                aria-label="Message failed. Retry sending"
                                title="Failed to send. Click to retry."
                                className="inline-flex items-center gap-1 text-destructive hover:underline"
                              >
                                <CircleAlert className="h-3.5 w-3.5" />
                                <span>Retry</span>
                              </button>
                            )}
                          </div>
                          <div className={`rounded-2xl px-3.5 py-2.5 ${isMentionForMe ? "rounded-br-md bg-sky-500/15 text-foreground" : isOwn ? "rounded-br-md bg-primary text-primary-foreground" : "rounded-bl-md border border-border/70 bg-card"}`}>
                            {m.replyTo && <div className={`mb-2 rounded-md border-l-2 border-sky-500/70 px-2 py-1 text-left text-xs ${isOwn ? "bg-black/10" : "bg-muted/40"}`}><span className="font-medium">Replying to {m.replyTo.userName}</span><p className="mt-0.5 line-clamp-2 opacity-75">{m.replyTo.content}</p></div>}
                            <p className="whitespace-pre-wrap break-words text-sm leading-5">{renderMessageContent(m.content, mentionLabels)}</p>
                            <AttachmentCards attachments={m.attachments ?? []} isOwn={isOwn} theme={theme} />
                            <MessageReactionChips reactions={m.reactions ?? []} onToggle={(emoji) => void toggleReaction(m, emoji)} isOwn={isOwn} theme={theme} />
                          </div>
                        </div>
                        {isOwn && <MemberAvatar name={senderName} src={avatarUrl} />}
                      </article>
                    </Fragment>
                  );
                })
              ) : (
                <div className="grid min-h-full place-items-center py-12 text-center">
                  <div>
                    <MessageSquareText className="mx-auto h-9 w-9 text-muted-foreground/50" />
                    <h2 className="mt-4 font-medium">
                      Start the workspace conversation
                    </h2>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Messages are visible to everyone in this workspace.
                      Mention <code>@Gluk</code> to ask the assistant.
                    </p>
                  </div>
                </div>
              )}
              {glukResponding && (
                <MessageBubble message={{ id: "gluk-pending-response", role: "assistant", content: "", createdAt: new Date(0), isStreaming: true }} theme={theme} />
              )}
              <WorkspaceTypingIndicator typingMembers={typingMembers} members={w.members} isDark={isDark} />
            </div>
            <form
              onSubmit={submitMessage}
              className="mb-3 mt-2 shrink-0 rounded-2xl border border-border bg-card p-2 shadow-md sm:p-2.5"
            >
              {replyTo && <div className="mb-2 flex items-start gap-3 rounded-xl bg-muted/60 px-3 py-2"><div className="min-w-0 flex-1 border-l-2 border-sky-500 pl-2"><p className="text-xs font-medium">Replying to {replyTo.userName}</p><p className="mt-0.5 line-clamp-1 text-xs text-muted-foreground">{replyTo.content}</p></div><button type="button" onClick={() => setReplyTo(null)} aria-label="Cancel reply" title="Cancel reply" className="rounded-md p-1 text-muted-foreground hover:bg-background hover:text-foreground"><X className="h-4 w-4" /></button></div>}
              <input ref={fileInputRef} type="file" multiple className="sr-only" onChange={(event) => handleFilesSelected(event.currentTarget.files)} />
              {attachedFiles.length > 0 && (
                <div className="flex gap-2.5 px-2 pt-1 pb-2 flex-wrap">
                  {attachedFiles.map((file, index) => (
                    <WorkspaceFilePreviewChip
                      key={`${file.name}-${file.size}-${index}`}
                      file={file}
                      onRemove={() => setAttachedFiles((current) => current.filter((_, i) => i !== index))}
                      onPreview={onPreview ? () => onPreview({ name: file.name, url: URL.createObjectURL(file), type: file.type }) : undefined}
                      isDark={isDark}
                    />
                  ))}
                </div>
              )}
              <div className="relative">
              {mentionContext && filteredMentionOptions.length > 0 && (
                <div role="listbox" aria-label="Mention suggestions" className="absolute bottom-full left-0 z-30 mb-2 max-h-64 w-full overflow-y-auto rounded-xl border border-border bg-popover p-1.5 text-popover-foreground shadow-xl sm:w-[min(26rem,100%)]">
                  <p className="px-2.5 py-1.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Mention someone or something</p>
                  {filteredMentionOptions.map((option, index) => {
                    const active = index === activeMentionIndex;
                    const Icon = option.kind === "assistant" ? Bot : option.kind === "member" ? UsersRound : option.kind === "resource" ? FileText : Mail;
                    return (
                      <button
                        key={`${option.kind}:${option.label}:${index}`}
                        type="button"
                        role="option"
                        aria-selected={active}
                        onMouseDown={(event) => event.preventDefault()}
                        onClick={() => selectMention(option)}
                        className={`flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left ${active ? "bg-accent text-accent-foreground" : "hover:bg-accent/60"}`}
                      >
                        <span className="grid h-7 w-7 shrink-0 place-items-center rounded-md bg-muted"><Icon className="h-4 w-4" /></span>
                        <span className="min-w-0 flex-1"><span className="block truncate text-sm font-medium">{option.label}</span><span className="block truncate text-[11px] text-muted-foreground">{option.detail}</span></span>
                        <span className="text-xs font-semibold text-sky-500">{option.kind === "invite" ? "↗" : `@${option.label}`}</span>
                      </button>
                    );
                  })}
                </div>
                )}
                <textarea
                  ref={composerRef}
                  value={message}
                  onChange={(event) => handleMessageChange(event.target.value, event.target.selectionStart)}
                  onSelect={(event) => { composerSelectionRef.current = { start: event.currentTarget.selectionStart, end: event.currentTarget.selectionEnd }; }}
                  onKeyDown={onComposerKeyDown}
                  rows={1}
                  maxLength={10000}
                  placeholder="Message your workspace… Use @Gluk to ask the assistant"
                  className="max-h-28 min-h-10 w-full resize-none bg-transparent px-2 py-2 text-sm leading-5 outline-none placeholder:text-muted-foreground"
                />
              </div>
              <div className="flex items-center justify-between px-1">
                <div className="flex items-center gap-1">
                  <button type="button" onClick={() => fileInputRef.current?.click()} aria-label="Add files" title="Add files" className="grid h-8 w-8 place-items-center rounded-full text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"><Plus className="h-4 w-4" /></button>
                  <div className="relative">
                    <button type="button" onClick={() => setEmojiPickerOpen((open) => !open)} aria-label="Insert emoji" aria-expanded={emojiPickerOpen} title="Add emoji" className="grid h-8 w-8 place-items-center rounded-full text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"><SmilePlus className="h-4 w-4" /></button>
                    {emojiPickerOpen && <div className="absolute bottom-full left-0 z-40 mb-2"><WorkspaceEmojiPicker onClose={() => setEmojiPickerOpen(false)} onSelect={(emoji) => { insertComposerText(emoji); setEmojiPickerOpen(false); }} /></div>}
                  </div>
                  <button type="button" onClick={openMentionPicker} aria-label="Mention a member or resource" title="Mention" className="grid h-8 w-8 place-items-center rounded-full text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"><AtSign className="h-4 w-4" /></button>
                  <p className="ml-1 hidden text-[11px] text-muted-foreground sm:block">Enter to send · Shift+Enter for new line</p>
                </div>
                <button disabled={!message.trim() && !attachedFiles.length} aria-label="Send message" className="grid h-8 w-8 place-items-center rounded-full bg-foreground text-background transition-opacity disabled:opacity-40"><Send className="h-4 w-4" /></button>
              </div>
            </form>
          </section>
  );
}
