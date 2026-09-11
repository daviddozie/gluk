"use client";

import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import GlukLogo from "./svg";
import { Google } from "./svg";
import { Sparkles, ShieldCheck, Database, Zap, X } from "lucide-react";

interface LoginModalProps {
    isOpen: boolean;
    onClose?: () => void;
    mode?: "prompt_limit" | "new_chat";
    theme: "light" | "dark";
}

export default function LoginModal({
    isOpen,
    onClose,
    mode = "prompt_limit",
    theme,
}: LoginModalProps) {
    const router = useRouter();
    const [isLoading, setIsLoading] = useState(false);
    const [mounted, setMounted] = useState(false);
    const isDark = theme === "dark";

    useEffect(() => {
        setMounted(true);
    }, []);

    // Allow closing with Escape key for new_chat mode
    useEffect(() => {
        if (!isOpen || mode === "prompt_limit") return;
        const onKeyDown = (e: KeyboardEvent) => {
            if (e.key === "Escape") onClose?.();
        };
        window.addEventListener("keydown", onKeyDown);
        return () => window.removeEventListener("keydown", onKeyDown);
    }, [isOpen, mode, onClose]);

    if (!isOpen || !mounted) return null;

    const handleGoogleSignIn = async () => {
        setIsLoading(true);
        await signIn("google", { callbackUrl: "/" });
    };

    const handleGoToLogin = () => {
        router.push("/login");
    };

    return createPortal(
        <div
            onClick={(e) => {
                if (e.target === e.currentTarget && mode === "new_chat" && onClose) {
                    onClose();
                }
            }}
            style={{
                backdropFilter: "blur(12px)",
                WebkitBackdropFilter: "blur(12px)",
            }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/55 backdrop-blur-md animate-in fade-in duration-300 select-none"
            role="dialog"
            aria-modal="true"
            aria-labelledby="login-modal-title"
        >
            <div
                className={`relative w-full max-w-md p-6 sm:p-8 rounded-3xl border shadow-2xl transition-all duration-300 ${
                    isDark
                        ? "bg-[#181818]/98 border-white/10 text-white shadow-black/40"
                        : "bg-white/98 border-black/10 text-black shadow-black/15"
                }`}
            >
                {/* Close button for dismissible new_chat mode */}
                {mode === "new_chat" && onClose && (
                    <button
                        onClick={onClose}
                        className={`absolute top-4 right-4 p-1.5 rounded-full cursor-pointer transition-colors ${
                            isDark
                                ? "text-white/50 hover:text-white hover:bg-white/10"
                                : "text-black/50 hover:text-black hover:bg-black/10"
                        }`}
                        aria-label="Close"
                    >
                        <X className="w-5 h-5" />
                    </button>
                )}

                {/* Ambient glow decoration */}
                <div className="absolute -top-16 -left-16 w-36 h-36 rounded-full bg-purple-500/15 blur-3xl pointer-events-none" />
                <div className="absolute -bottom-16 -right-16 w-36 h-36 rounded-full bg-sky-500/10 blur-3xl pointer-events-none" />

                {mode === "new_chat" ? (
                    /* ── ChatGPT-style "Welcome back / New Chat" modal ── */
                    <div className="flex flex-col items-center text-center">
                        <h2
                            id="login-modal-title"
                            className="text-2xl font-semibold tracking-tight mb-1"
                        >
                            Welcome back
                        </h2>

                        <p
                            className={`text-sm mb-6 ${
                                isDark ? "text-white/60" : "text-black/60"
                            }`}
                        >
                            Choose an account to continue.
                        </p>

                        {/* Google Account Selector Card */}
                        <button
                            onClick={handleGoogleSignIn}
                            disabled={isLoading}
                            className={`w-full flex items-center gap-3.5 p-3.5 rounded-2xl border transition-all cursor-pointer text-left ${
                                isDark
                                    ? "bg-white/[0.05] hover:bg-white/[0.09] border-white/10 text-white"
                                    : "bg-black/[0.03] hover:bg-black/[0.07] border-black/10 text-black"
                            }`}
                        >
                            <div className="w-10 h-10 rounded-full bg-white text-black flex items-center justify-center shrink-0 shadow-sm">
                                <Google />
                            </div>
                            <div className="flex-1 min-w-0">
                                <div className="text-sm font-semibold truncate">Continue with Google</div>
                                <div className={`text-xs truncate ${isDark ? "text-white/50" : "text-black/50"}`}>
                                    Fast 1-click sign in
                                </div>
                            </div>
                            {isLoading && (
                                <div className="w-4 h-4 border-2 border-current/30 border-t-current rounded-full animate-spin shrink-0" />
                            )}
                        </button>

                        {/* Divider */}
                        <div className="relative my-6 w-full flex items-center justify-center">
                            <div className="absolute inset-0 flex items-center">
                                <div className={`w-full border-t ${isDark ? "border-white/10" : "border-black/10"}`} />
                            </div>
                            <span
                                className={`relative px-3 text-[11px] uppercase tracking-wider font-semibold ${
                                    isDark ? "bg-[#181818] text-white/40" : "bg-white text-black/40"
                                }`}
                            >
                                OR
                            </span>
                        </div>

                        {/* Action Buttons */}
                        <div className="w-full space-y-3">
                            <button
                                onClick={handleGoToLogin}
                                className={`w-full py-3 px-5 rounded-full border text-sm font-medium transition-colors cursor-pointer text-center ${
                                    isDark
                                        ? "border-white/15 hover:bg-white/8 text-white"
                                        : "border-black/15 hover:bg-black/5 text-black"
                                }`}
                            >
                                Log in to another account
                            </button>

                            <button
                                onClick={handleGoToLogin}
                                className={`w-full py-3 px-5 rounded-full border text-sm font-medium transition-colors cursor-pointer text-center ${
                                    isDark
                                        ? "border-white/15 hover:bg-white/8 text-white"
                                        : "border-black/15 hover:bg-black/5 text-black"
                                }`}
                            >
                                Create account
                            </button>
                        </div>
                    </div>
                ) : (
                    /* ── 3/3 Prompts Used (Trial Limit) modal ── */
                    <div className="flex flex-col items-center text-center">
                        <div
                            className={`w-14 h-14 rounded-2xl border flex items-center justify-center mb-4 transition-colors ${
                                isDark
                                    ? "bg-white/5 border-white/10 text-white shadow-[0_0_30px_rgba(255,255,255,0.06)]"
                                    : "bg-black/5 border-black/10 text-black shadow-md"
                            }`}
                        >
                            <GlukLogo size={36} />
                        </div>

                        <h2
                            id="login-modal-title"
                            className="text-xl sm:text-2xl font-semibold tracking-tight mb-2"
                        >
                            Log in to continue with Gluk
                        </h2>

                        <p
                            className={`text-xs sm:text-sm leading-relaxed mb-5 ${
                                isDark ? "text-white/60" : "text-black/60"
                            }`}
                        >
                            You&apos;ve reached the free trial limit of{" "}
                            <strong className="text-foreground">3 prompts</strong>. Sign in to unlock unlimited deep research, document uploads, and permanent chat history.
                        </p>

                        {/* Progress Bar Badge */}
                        <div
                            className={`w-full py-2.5 px-3.5 rounded-xl border mb-6 flex flex-col gap-1.5 ${
                                isDark ? "bg-white/[0.03] border-white/8" : "bg-black/[0.03] border-black/8"
                            }`}
                        >
                            <div className="flex justify-between items-center text-[11px] font-medium">
                                <span className="flex items-center gap-1 text-purple-400">
                                    <Sparkles className="w-3.5 h-3.5" />
                                    Free Trial Usage
                                </span>
                                <span className={isDark ? "text-white/70" : "text-black/70"}>
                                    3 / 3 Prompts Used
                                </span>
                            </div>
                            <div
                                className={`w-full h-1.5 rounded-full overflow-hidden ${
                                    isDark ? "bg-white/10" : "bg-black/10"
                                }`}
                            >
                                <div className="w-full h-full bg-gradient-to-r from-purple-500 to-indigo-500 rounded-full" />
                            </div>
                        </div>

                        {/* Feature Highlights */}
                        <div className="w-full space-y-2 mb-6 text-left text-xs">
                            <div className="flex items-center gap-2.5">
                                <Zap className="w-4 h-4 text-amber-400 shrink-0" />
                                <span className={isDark ? "text-white/80" : "text-black/80"}>
                                    Unlimited web research queries & synthesis
                                </span>
                            </div>
                            <div className="flex items-center gap-2.5">
                                <Database className="w-4 h-4 text-emerald-400 shrink-0" />
                                <span className={isDark ? "text-white/80" : "text-black/80"}>
                                    Saved chat threads & persistent memory
                                </span>
                            </div>
                            <div className="flex items-center gap-2.5">
                                <ShieldCheck className="w-4 h-4 text-sky-400 shrink-0" />
                                <span className={isDark ? "text-white/80" : "text-black/80"}>
                                    Sub-agent code audits & live fact-checking
                                </span>
                            </div>
                        </div>

                        {/* Action Buttons */}
                        <div className="w-full space-y-2.5">
                            <button
                                onClick={handleGoogleSignIn}
                                disabled={isLoading}
                                className="w-full cursor-pointer flex items-center justify-center gap-3 px-4 py-3 rounded-xl bg-white text-black text-sm font-semibold hover:bg-white/90 active:scale-[0.99] transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-md"
                            >
                                {isLoading ? (
                                    <div className="w-4 h-4 border-2 border-black/20 border-t-black rounded-full animate-spin" />
                                ) : (
                                    <Google />
                                )}
                                Continue with Google
                            </button>

                            <button
                                onClick={handleGoToLogin}
                                disabled={isLoading}
                                className={`w-full cursor-pointer flex items-center justify-center px-4 py-2.5 rounded-xl border text-xs font-medium transition-all ${
                                    isDark
                                        ? "border-white/10 hover:bg-white/6 text-white/80 hover:text-white"
                                        : "border-black/10 hover:bg-black/6 text-black/80 hover:text-black"
                                }`}
                            >
                                All sign in options (Email / GitHub)
                            </button>
                        </div>

                        <p
                            className={`text-[11px] mt-4 text-center ${
                                isDark ? "text-white/30" : "text-black/40"
                            }`}
                        >
                            Free to sign up. No credit card required.
                        </p>
                    </div>
                )}
            </div>
        </div>,
        document.body
    );
}
