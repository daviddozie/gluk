"use client";

import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { useSession, signOut } from "next-auth/react";

interface LogoutModalProps {
    isOpen: boolean;
    onClose: () => void;
    theme: "light" | "dark";
}

function getInitials(name: string): string {
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) {
        return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return name.slice(0, 2).toUpperCase();
}

export default function LogoutModal({ isOpen, onClose, theme }: LogoutModalProps) {
    const { data: session } = useSession();
    const [isLoggingOut, setIsLoggingOut] = useState(false);
    const [mounted, setMounted] = useState(false);
    const isDark = theme === "dark";

    useEffect(() => {
        setMounted(true);
    }, []);

    useEffect(() => {
        if (!isOpen) return;
        const onKeyDown = (e: KeyboardEvent) => {
            if (e.key === "Escape") onClose();
        };
        window.addEventListener("keydown", onKeyDown);
        return () => window.removeEventListener("keydown", onKeyDown);
    }, [isOpen, onClose]);

    if (!isOpen || !mounted) return null;

    const handleConfirmLogout = async () => {
        setIsLoggingOut(true);
        await signOut({ callbackUrl: "/" });
    };

    const userName = session?.user?.name || "User";
    const userEmail = session?.user?.email || "";
    const initials = getInitials(userName || userEmail || "U");

    return createPortal(
        <div
            onClick={(e) => {
                if (e.target === e.currentTarget && !isLoggingOut) {
                    onClose();
                }
            }}
            style={{
                backdropFilter: "blur(5px)",
                WebkitBackdropFilter: "blur(5px)",
            }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/55 backdrop-blur-md animate-in fade-in duration-200 select-none"
            role="dialog"
            aria-modal="true"
            aria-labelledby="logout-modal-title"
        >
            <div
                className={`relative w-full max-w-sm sm:max-w-md p-6 sm:p-8 rounded-3xl border shadow-2xl transition-all duration-200 ${
                    isDark
                        ? "bg-[#212121] border-white/10 text-white shadow-black/50"
                        : "bg-white border-black/10 text-black shadow-black/15"
                }`}
            >
                {/* Title */}
                <h2
                    id="logout-modal-title"
                    className="text-xl sm:text-2xl font-semibold tracking-tight text-center leading-snug mb-6"
                >
                    Are you sure you<br />want to log out?
                </h2>

                {/* User Info Box */}
                <div
                    className={`w-full flex items-center gap-3.5 p-3.5 rounded-2xl border mb-6 ${
                        isDark ? "bg-white/[0.04] border-white/10" : "bg-black/[0.03] border-black/10"
                    }`}
                >
                    {session?.user?.image ? (
                        <img
                            src={session.user.image}
                            alt={userName}
                            className="w-10 h-10 rounded-full object-cover shrink-0"
                        />
                    ) : (
                        <div className="w-10 h-10 rounded-full bg-amber-600 text-white font-semibold text-xs flex items-center justify-center shrink-0 shadow-sm">
                            {initials}
                        </div>
                    )}
                    <div className="flex-1 min-w-0 text-left">
                        <div className="text-sm font-semibold truncate text-foreground">
                            {userName}
                        </div>
                        {userEmail && (
                            <div className={`text-xs truncate ${isDark ? "text-white/50" : "text-black/50"}`}>
                                {userEmail}
                            </div>
                        )}
                    </div>
                </div>

                {/* Actions */}
                <div className="w-full space-y-3">
                    <button
                        onClick={handleConfirmLogout}
                        disabled={isLoggingOut}
                        className={`w-full py-3 px-5 rounded-full font-semibold text-sm transition-all cursor-pointer disabled:opacity-50 flex items-center justify-center gap-2 shadow-sm ${
                            isDark
                                ? "bg-white text-black hover:bg-white/90 active:scale-[0.99]"
                                : "bg-black text-white hover:bg-black/90 active:scale-[0.99]"
                        }`}
                    >
                        {isLoggingOut && (
                            <div className="w-4 h-4 border-2 border-current/30 border-t-current rounded-full animate-spin" />
                        )}
                        Log out
                    </button>

                    <button
                        onClick={onClose}
                        disabled={isLoggingOut}
                        className={`w-full py-3 px-5 rounded-full border text-sm font-medium transition-colors cursor-pointer text-center ${
                            isDark
                                ? "border-white/15 hover:bg-white/8 text-white"
                                : "border-black/15 hover:bg-black/5 text-black"
                        }`}
                    >
                        Cancel
                    </button>
                </div>
            </div>
        </div>,
        document.body
    );
}
