"use client";

import GlukLogo from "@/components/svg";
import { Google, Github } from "@/components/svg";
import { signIn, useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

const FEATURES = [
    { icon: "🔍", label: "Deep research on any topic" },
    { icon: "📄", label: "Summarise & query your documents" },
    { icon: "🌐", label: "Live web search with cited sources" },
    { icon: "⚖️", label: "Compare ideas, papers, or sources" },
];

export default function LoginPage() {
    const { status } = useSession();
    const router = useRouter();
    const [loadingProvider, setLoadingProvider] = useState<string | null>(null);
    const [isDark, setIsDark] = useState(true);

    // Mirror the same theme detection used everywhere else in the app
    useEffect(() => {
        const stored = localStorage.getItem("theme");
        const systemDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
        setIsDark(stored === "light" ? false : stored === "dark" ? true : systemDark);
    }, []);

    useEffect(() => {
        if (status === "authenticated") router.push("/");
    }, [status, router]);

    const handleSignIn = async (provider: string) => {
        setLoadingProvider(provider);
        await signIn(provider, { callbackUrl: "/" });
    };

    const bg      = isDark ? "bg-[#0a0a0a]"   : "bg-[#f5f5f5]";
    const card    = isDark ? "bg-white/[0.03] border-white/[0.08]" : "bg-white border-black/10";
    const divider = isDark ? "bg-white/6"       : "bg-black/10";
    const orText  = isDark ? "text-white/25"    : "text-black/30";
    const foot    = isDark ? "text-white/20"    : "text-black/30";
    const footHi  = isDark ? "text-white/50 hover:text-white/70" : "text-black/50 hover:text-black/70";
    const logoBox = isDark
        ? "bg-white/[0.06] border-white/[0.1] shadow-[0_0_40px_rgba(255,255,255,0.05)]"
        : "bg-black/[0.04] border-black/[0.08] shadow-[0_8px_32px_rgba(0,0,0,0.08)]";
    const heading = isDark ? "text-white"       : "text-black";
    const sub     = isDark ? "text-white/40"    : "text-black/45";
    const logoColor = isDark ? "text-white"     : "text-black";
    const chipBg  = isDark ? "bg-white/[0.04] border-white/[0.07] text-white/50" : "bg-black/[0.04] border-black/[0.07] text-black/50";
    const githubBtn = isDark
        ? "bg-white/[0.06] border-white/[0.08] text-white hover:bg-white/[0.1] hover:border-white/[0.15]"
        : "bg-black/[0.06] border-black/[0.12] text-black hover:bg-black/[0.1] hover:border-black/[0.2]";

    if (status === "loading") {
        return (
            <div className={`min-h-screen ${bg} flex items-center justify-center transition-colors duration-300`}>
                <div className={`w-5 h-5 border-2 rounded-full animate-spin ${
                    isDark ? "border-white/20 border-t-white" : "border-black/20 border-t-black"
                }`} />
            </div>
        );
    }

    return (
        <div className={`min-h-screen ${bg} flex items-center justify-center px-4 transition-colors duration-300`}>

            {/* Subtle background texture */}
            <div
                className="fixed inset-0 pointer-events-none"
                style={{
                    opacity: isDark ? 0.015 : 0.03,
                    backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E")`,
                    backgroundRepeat: "repeat",
                    backgroundSize: "128px",
                }}
            />

            <div className="w-full max-w-lg relative">

                {/* Logo + headline */}
                <div className="flex flex-col items-center mb-8">
                    <div className={`w-14 h-14 rounded-2xl border flex items-center justify-center mb-5 ${logoBox} ${logoColor}`}>
                        <GlukLogo size={36} />
                    </div>
                    <h1 className={`text-2xl font-semibold tracking-tight mb-1 ${heading}`}>
                        Research smarter with Gluk
                    </h1>
                    <p className={`text-sm text-center leading-relaxed ${sub}`}>
                        AI-powered research — search the web, analyse documents,<br className="hidden sm:block" />
                        and synthesise answers with cited sources.
                    </p>
                </div>

                {/* Feature chips */}
                <div className="grid grid-cols-2 gap-2 mb-8">
                    {FEATURES.map(({ icon, label }) => (
                        <div key={label} className={`flex items-center gap-2 px-3 py-4 rounded-xl border text-xs ${chipBg}`}>
                            <span className="text-base leading-none">{icon}</span>
                            <span>{label}</span>
                        </div>
                    ))}
                </div>

                {/* Sign-in card */}
                <div className={`border rounded-2xl p-6 space-y-3 ${card}`}>
                    {/* Google */}
                    <button
                        onClick={() => handleSignIn("google")}
                        disabled={!!loadingProvider}
                        className="w-full cursor-pointer flex items-center justify-center gap-3 px-4 py-3 rounded-xl bg-white text-black text-sm font-medium hover:bg-white/90 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
                    >
                        {loadingProvider === "google" ? (
                            <div className="w-4 h-4 border-2 border-black/20 border-t-black rounded-full animate-spin" />
                        ) : (
                            <Google />
                        )}
                        Continue with Google
                    </button>

                    {/* Divider */}
                    <div className="flex items-center gap-3">
                        <div className={`flex-1 h-px ${divider}`} />
                        <span className={`text-xs ${orText}`}>or</span>
                        <div className={`flex-1 h-px ${divider}`} />
                    </div>

                    {/* GitHub */}
                    <button
                        onClick={() => handleSignIn("github")}
                        disabled={!!loadingProvider}
                        className={`w-full cursor-pointer flex items-center justify-center gap-3 px-4 py-3 rounded-xl border text-sm font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed ${githubBtn}`}
                    >
                        {loadingProvider === "github" ? (
                            <div className={`w-4 h-4 border-2 rounded-full animate-spin ${
                                isDark ? "border-white/20 border-t-white" : "border-black/20 border-t-black"
                            }`} />
                        ) : (
                            <Github />
                        )}
                        Continue with GitHub
                    </button>
                </div>

                {/* Footer */}
                <p className={`text-center text-xs mt-5 ${foot}`}>
                    By continuing, you agree to Gluk&apos;s{" "}
                    <span className={`cursor-pointer transition-colors ${footHi}`}>Terms</span>
                    {" "}and{" "}
                    <span className={`cursor-pointer transition-colors ${footHi}`}>Privacy Policy</span>
                </p>
            </div>
        </div>
    );
}