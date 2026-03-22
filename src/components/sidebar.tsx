"use client";

import { useState } from "react";
import { useSession, signOut } from "next-auth/react";
import { Conversation } from "@/types/chat";
import GlukLogo from "./svg";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Settings, HelpCircle, LogOut, ChevronUp, Pin, PinOff, Trash2, MoreHorizontal, Search, X } from "lucide-react";

interface SidebarProps {
    conversations: Conversation[];
    activeConversationId: string | null;
    onSelect: (id: string) => void;
    onNew: () => void;
    onDelete: (id: string) => void;
    onPin: (id: string, pinned: boolean) => void;
    isOpen: boolean;
    onToggle: () => void;
    theme: "light" | "dark";
}

export default function Sidebar({
    conversations,
    activeConversationId,
    onSelect,
    onNew,
    onDelete,
    onPin,
    isOpen,
    onToggle,
    theme,
}: SidebarProps) {
    const { data: session } = useSession();
    const [search, setSearch] = useState("");

    if (!isOpen) return null;

    const isDark = theme === "dark";

    const filtered = search.trim()
        ? conversations.filter((c) =>
              c.title.toLowerCase().includes(search.toLowerCase())
          )
        : conversations;

    const pinned   = filtered.filter((c) => c.pinned);
    const unpinned = filtered.filter((c) => !c.pinned);

    return (
        <div className={`w-65 shrink-0 flex flex-col h-full transition-colors duration-300 ${
            isDark ? "bg-[#111111] border-r border-white/6 text-white" : "bg-white border-r border-black/10 text-black"
        }`}>
            {/* Header */}
            <div className={`flex items-center justify-between px-3 py-3 border-b transition-colors duration-300 ${
                isDark ? "border-white/6" : "border-black/10"
            }`}>
                <div className="flex items-center gap-2">
                    <div className={`w-7 h-7 flex items-center justify-center ${isDark ? "text-white" : "text-black"}`}>
                        <GlukLogo size={28} />
                    </div>
                    <span className="font-semibold text-sm tracking-wide">Gluk</span>
                </div>
                <div className="flex items-center gap-1">
                    <button
                        onClick={onNew}
                        className={`p-1.5 rounded-lg cursor-pointer transition-colors ${
                            isDark ? "hover:bg-white/8 text-white/60 hover:text-white" : "hover:bg-black/6 text-black/60 hover:text-black"
                        }`}
                        title="New chat"
                    >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M12 5v14M5 12h14" />
                        </svg>
                    </button>
                    <button
                        onClick={onToggle}
                        className={`p-1.5 rounded-lg cursor-pointer transition-colors ${
                            isDark ? "hover:bg-white/8 text-white/60 hover:text-white" : "hover:bg-black/6 text-black/60 hover:text-black"
                        }`}
                        title="Close sidebar"
                    >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M15 18l-6-6 6-6" />
                        </svg>
                    </button>
                </div>
            </div>

            {/* Search field */}
            <div className={`px-2 py-2 border-b transition-colors duration-300 ${isDark ? "border-white/6" : "border-black/10"}`}>
                <div className={`flex items-center gap-2 px-2.5 py-2 rounded-sm transition-colors ${
                    isDark ? "bg-white/6 text-white/60" : "bg-black/5 text-black/50"
                }`}>
                    <Search className="w-3.5 h-3.5 shrink-0" />
                    <input
                        type="text"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        placeholder="Search chats…"
                        className={`flex-1 bg-transparent text-xs outline-none placeholder:text-current min-w-0 ${
                            isDark ? "text-white" : "text-black"
                        }`}
                    />
                    {search && (
                        <button onClick={() => setSearch("")} className="shrink-0 opacity-60 hover:opacity-100 cursor-pointer transition-opacity">
                            <X className="w-3 h-3" />
                        </button>
                    )}
                </div>
            </div>

            {/* Conversations list */}
            <div className="flex-1 overflow-y-auto py-2 px-2 space-y-0.5">
                {filtered.length === 0 ? (
                    <p className={`text-xs text-center mt-8 ${isDark ? "text-white/30" : "text-black/40"}`}>
                        {search ? "No chats match your search" : "No conversations yet"}
                    </p>
                ) : (
                    <>
                        {/* Pinned section */}
                        {pinned.length > 0 && (
                            <>
                                <p className={`px-3 pt-1 pb-0.5 text-[10px] font-semibold uppercase tracking-widest ${
                                    isDark ? "text-white/30" : "text-black/35"
                                }`}>Pinned</p>
                                {pinned.map((conv) => (
                                    <ConvRow
                                        key={conv.id}
                                        conv={conv}
                                        isActive={conv.id === activeConversationId}
                                        isDark={isDark}
                                        onSelect={onSelect}
                                        onDelete={onDelete}
                                        onPin={onPin}
                                    />
                                ))}
                                {unpinned.length > 0 && (
                                    <p className={`px-3 pt-2 pb-0.5 text-[10px] font-semibold uppercase tracking-widest ${
                                        isDark ? "text-white/30" : "text-black/35"
                                    }`}>Chats</p>
                                )}
                            </>
                        )}

                        {/* Unpinned section */}
                        {unpinned.map((conv) => (
                            <ConvRow
                                key={conv.id}
                                conv={conv}
                                isActive={conv.id === activeConversationId}
                                isDark={isDark}
                                onSelect={onSelect}
                                onDelete={onDelete}
                                onPin={onPin}
                            />
                        ))}
                    </>
                )}
            </div>

            {/* Footer with dropdown */}
            <div className={`p-2 border-t transition-colors duration-300 ${isDark ? "border-white/6" : "border-black/10"}`}>
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <button className={`w-full flex items-center gap-2 px-2 py-2 rounded-lg cursor-pointer transition-colors group ${
                            isDark ? "hover:bg-white/6" : "hover:bg-black/6"
                        }`}>
                            {session?.user?.image ? (
                                <img src={session.user.image} alt="avatar" className="w-7 h-7 rounded-full shrink-0" />
                            ) : (
                                <div className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 text-xs font-semibold ${
                                    isDark ? "bg-white/10 text-white" : "bg-black/10 text-black"
                                }`}>
                                    {session?.user?.name?.[0]?.toUpperCase() ?? "U"}
                                </div>
                            )}
                            <div className="flex-1 text-left min-w-0">
                                <p className="text-xs font-medium truncate">{session?.user?.name ?? "Guest"}</p>
                            </div>
                            <ChevronUp className={`w-3.5 h-3.5 shrink-0 ${isDark ? "text-white/40" : "text-black/40"}`} />
                        </button>
                    </DropdownMenuTrigger>

                    <DropdownMenuContent
                        side="top"
                        align="start"
                        className={`w-60 mb-1 transition-colors duration-300 ${
                            isDark ? "bg-[#1a1a1a] border-white/8 text-white" : "bg-white border-black/10 text-black"
                        }`}
                    >
                        <DropdownMenuLabel className="py-2">
                            <div className="flex items-center gap-2">
                                {session?.user?.image ? (
                                    <img src={session.user.image} alt="avatar" className="w-8 h-8 rounded-full" />
                                ) : (
                                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold ${
                                        isDark ? "bg-white/10" : "bg-black/10"
                                    }`}>
                                        {session?.user?.name?.[0]?.toUpperCase() ?? "U"}
                                    </div>
                                )}
                                <div className="min-w-0">
                                    <p className="text-sm font-medium truncate">{session?.user?.name ?? "Guest"}</p>
                                    <p className={`text-xs truncate ${isDark ? "text-white/40" : "text-black/50"}`}>
                                        {session?.user?.email ?? ""}
                                    </p>
                                </div>
                            </div>
                        </DropdownMenuLabel>

                        <DropdownMenuSeparator className={isDark ? "bg-white/6" : "bg-black/10"} />

                        <DropdownMenuItem className={`gap-2 cursor-pointer ${
                            isDark ? "text-white/70 hover:text-white focus:text-white focus:bg-white/6" : "text-black/70 hover:text-black focus:text-black focus:bg-black/6"
                        }`}>
                            <Settings className="w-4 h-4" />
                            Settings
                        </DropdownMenuItem>

                        <DropdownMenuItem className={`gap-2 cursor-pointer ${
                            isDark ? "text-white/70 hover:text-white focus:text-white focus:bg-white/6" : "text-black/70 hover:text-black focus:text-black focus:bg-black/6"
                        }`}>
                            <HelpCircle className="w-4 h-4" />
                            Help
                        </DropdownMenuItem>

                        <DropdownMenuSeparator className={isDark ? "bg-white/6" : "bg-black/10"} />

                        <DropdownMenuItem
                            onClick={() => signOut({ callbackUrl: "/login" })}
                            className={`gap-2 cursor-pointer ${
                                isDark ? "text-white/70 hover:text-white focus:text-white focus:bg-white/6" : "text-black/70 hover:text-black focus:text-black focus:bg-black/6"
                            }`}
                        >
                            <LogOut className="w-4 h-4" />
                            Log out
                        </DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>
            </div>
        </div>
    );
}

/* ─── Per-conversation row with hover 3-dot menu ─── */

interface ConvRowProps {
    conv: Conversation;
    isActive: boolean;
    isDark: boolean;
    onSelect: (id: string) => void;
    onDelete: (id: string) => void;
    onPin: (id: string, pinned: boolean) => void;
}

function ConvRow({ conv, isActive, isDark, onSelect, onDelete, onPin }: ConvRowProps) {
    return (
        <div
            className={`group flex items-center justify-between rounded-lg px-3 py-2 cursor-pointer transition-colors ${
                isActive
                    ? (isDark ? "bg-white/10 text-white" : "bg-black/8 text-black")
                    : (isDark ? "text-white/60 hover:bg-white/6 hover:text-white" : "text-black/60 hover:bg-black/6 hover:text-black")
            }`}
            onClick={() => onSelect(conv.id)}
        >
            {/* Title */}
            <div className="flex items-center gap-2 min-w-0 flex-1">
                {conv.pinned ? (
                    <Pin className="w-3.5 h-3.5 shrink-0 opacity-50" />
                ) : (
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="shrink-0 opacity-50">
                        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                    </svg>
                )}
                <span className="text-xs truncate">{conv.title}</span>
            </div>

            {/* 3-dot menu — visible on hover / when active */}
            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <button
                        onClick={(e) => e.stopPropagation()}
                        className={`opacity-0 group-hover:opacity-100 p-1 rounded cursor-pointer transition-all shrink-0 focus:opacity-100 ${
                            isDark ? "hover:bg-white/10 text-white/50 hover:text-white" : "hover:bg-black/10 text-black/40 hover:text-black"
                        }`}
                        title="More options"
                    >
                        <MoreHorizontal className="w-3.5 h-3.5" />
                    </button>
                </DropdownMenuTrigger>

                <DropdownMenuContent
                    side="right"
                    align="start"
                    onClick={(e) => e.stopPropagation()}
                    className={`w-44 ${isDark ? "bg-[#1a1a1a] border-white/8 text-white" : "bg-white border-black/10 text-black"}`}
                >
                    <DropdownMenuItem
                        onClick={(e) => { e.stopPropagation(); onPin(conv.id, !conv.pinned); }}
                        className={`gap-2 cursor-pointer text-xs ${
                            isDark ? "text-white/70 hover:text-white focus:text-white focus:bg-white/6" : "text-black/70 hover:text-black focus:text-black focus:bg-black/6"
                        }`}
                    >
                        {conv.pinned ? <PinOff className="w-3.5 h-3.5" /> : <Pin className="w-3.5 h-3.5" />}
                        {conv.pinned ? "Unpin chat" : "Pin chat"}
                    </DropdownMenuItem>

                    <DropdownMenuSeparator className={isDark ? "bg-white/6" : "bg-black/10"} />

                    <DropdownMenuItem
                        onClick={(e) => { e.stopPropagation(); onDelete(conv.id); }}
                        className="gap-2 cursor-pointer text-xs text-red-400 hover:text-red-300 focus:text-red-300 focus:bg-red-500/10"
                    >
                        <Trash2 className="w-3.5 h-3.5" />
                        Delete chat
                    </DropdownMenuItem>
                </DropdownMenuContent>
            </DropdownMenu>
        </div>
    );
}

