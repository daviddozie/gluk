"use client";

import { useSession, signOut } from "next-auth/react";
import { Conversation } from "@/types/chat";
import GlukLogo from "./svg";

interface SidebarProps {
    conversations: Conversation[];
    activeConversationId: string | null;
    onSelect: (id: string) => void;
    onNew: () => void;
    onDelete: (id: string) => void;
    isOpen: boolean;
    onToggle: () => void;
}

export default function Sidebar({
    conversations,
    activeConversationId,
    onSelect,
    onNew,
    onDelete,
    isOpen,
    onToggle,
}: SidebarProps) {
    const { data: session } = useSession();
    if (!isOpen) return null;

    return (
        <div className="w-[260px] flex-shrink-0 flex flex-col bg-[#111111] border-r border-white/[0.06] h-full">
            {/* Header */}
            <div className="flex items-center justify-between px-3 py-3 border-b border-white/[0.06]">
                <div className="flex items-center gap-2">
                    <div className="w-7 h-7 flex items-center justify-center">
                        <GlukLogo size={28} />
                    </div>
                    <span className="font-semibold text-sm tracking-wide">Gluk</span>
                </div>
                <div className="flex items-center gap-1">
                    <button
                        onClick={onNew}
                        className="p-1.5 rounded-lg hover:bg-white/[0.08] transition-colors text-white/60 hover:text-white"
                        title="New chat"
                    >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M12 5v14M5 12h14" />
                        </svg>
                    </button>
                    <button
                        onClick={onToggle}
                        className="p-1.5 rounded-lg hover:bg-white/[0.08] transition-colors text-white/60 hover:text-white"
                        title="Close sidebar"
                    >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M15 18l-6-6 6-6" />
                        </svg>
                    </button>
                </div>
            </div>

            {/* Conversations list */}
            <div className="flex-1 overflow-y-auto py-2 px-2 space-y-0.5">
                {conversations.length === 0 ? (
                    <p className="text-white/30 text-xs text-center mt-8">No conversations yet</p>
                ) : (
                    conversations.map((conv) => (
                        <div
                            key={conv.id}
                            className={`group flex items-center justify-between rounded-lg px-3 py-2 cursor-pointer transition-colors ${conv.id === activeConversationId
                                    ? "bg-white/[0.1] text-white"
                                    : "text-white/60 hover:bg-white/[0.06] hover:text-white"
                                }`}
                            onClick={() => onSelect(conv.id)}
                        >
                            <div className="flex items-center gap-2 min-w-0">
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="flex-shrink-0 opacity-50">
                                    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                                </svg>
                                <span className="text-xs truncate">{conv.title}</span>
                            </div>
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    onDelete(conv.id);
                                }}
                                className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-white/[0.1] transition-all text-white/40 hover:text-white/80 flex-shrink-0"
                            >
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
                                </svg>
                            </button>
                        </div>
                    ))
                )}
            </div>

            {/* Footer */}
            <div className="p-3 border-t border-white/[0.06]">
                <div className="flex items-center justify-between px-2 py-2 rounded-lg hover:bg-white/[0.06] transition-colors group">
                    <div className="flex items-center gap-2 min-w-0">
                        {session?.user?.image ? (
                            <img
                                src={session.user.image}
                                alt="avatar"
                                className="w-7 h-7 rounded-full flex-shrink-0"
                            />
                        ) : (
                            <div className="w-7 h-7 rounded-full bg-white/10 flex items-center justify-center flex-shrink-0">
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                                    <circle cx="12" cy="7" r="4" />
                                </svg>
                            </div>
                        )}
                        <span className="text-xs text-white/60 truncate">
                            {session?.user?.name ?? session?.user?.email ?? "Guest"}
                        </span>
                    </div>
                    <button
                        onClick={() => signOut({ callbackUrl: "/login" })}
                        className="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg hover:bg-white/[0.1] transition-all text-white/40 hover:text-white/80"
                        title="Sign out"
                    >
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                            <polyline points="16 17 21 12 16 7" />
                            <line x1="21" y1="12" x2="9" y2="12" />
                        </svg>
                    </button>
                </div>
            </div>
        </div>
    );
}