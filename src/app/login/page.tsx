"use client";

import GlukLogo from "@/components/svg";
import { Google } from "@/components/svg";
import { Github } from "@/components/svg";

import { signIn, useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

export default function LoginPage() {
    const { data: session, status } = useSession();
    const router = useRouter();
    const [loadingProvider, setLoadingProvider] = useState<string | null>(null);

    useEffect(() => {
        if (status === "authenticated") {
            router.push("/");
        }
    }, [status, router]);

    const handleSignIn = async (provider: string) => {
        setLoadingProvider(provider);
        await signIn(provider, { callbackUrl: "/" });
    };

    if (status === "loading") {
        return (
            <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
                <div className="w-5 h-5 border-2 border-white/20 border-t-white rounded-full animate-spin" />
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center px-4">
            {/* Background grain */}
            <div className="fixed inset-0 opacity-[0.015] pointer-events-none"
                style={{
                    backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E")`,
                    backgroundRepeat: "repeat",
                    backgroundSize: "128px",
                }}
            />

            <div className="w-full max-w-sm">
                {/* Logo */}
                <div className="flex flex-col items-center mb-10">
                    <div className="w-14 h-14 rounded-2xl bg-white/[0.06] border border-white/[0.1] flex items-center justify-center mb-4 shadow-[0_0_40px_rgba(255,255,255,0.05)]">
                        <GlukLogo size={40} />
                    </div>
                    <h1 className="text-2xl font-semibold text-white tracking-tight">Welcome to Gluk</h1>
                    <p className="text-white/40 text-sm mt-1.5 text-center">
                        Sign in to start your conversation
                    </p>
                </div>

                {/* Sign in card */}
                <div className="bg-white/[0.03] border border-white/[0.08] rounded-2xl p-6 space-y-3">
                    {/* Google */}
                    <button
                        onClick={() => handleSignIn("google")}
                        disabled={!!loadingProvider}
                        className="w-full cursor-pointer flex items-center justify-center gap-3 px-4 py-3 rounded-xl bg-white text-black text-sm font-medium hover:bg-white/90 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
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
                        <div className="flex-1 h-px bg-white/6" />
                        <span className="text-white/20 text-xs">or</span>
                        <div className="flex-1 h-px bg-white/6" />
                    </div>

                    {/* GitHub */}
                    <button
                        onClick={() => handleSignIn("github")}
                        disabled={!!loadingProvider}
                        className="w-full flex cursor-pointer items-center justify-center gap-3 px-4 py-3 rounded-xl bg-white/[0.06] border border-white/[0.08] text-white text-sm font-medium hover:bg-white/[0.1] hover:border-white/[0.15] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {loadingProvider === "github" ? (
                            <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                        ) : (
                            <Github />
                        )}
                        Continue with GitHub
                    </button>
                </div>

                {/* Footer */}
                <p className="text-center text-white/20 text-xs mt-6">
                    By continuing, you agree to Gluk&apos;s{" "}
                    <span className="text-white/40 hover:text-white/60 cursor-pointer transition-colors">Terms</span>
                    {" "}and{" "}
                    <span className="text-white/40 hover:text-white/60 cursor-pointer transition-colors">Privacy Policy</span>
                </p>
            </div>
        </div>
    );
}