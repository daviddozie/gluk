"use client";

import { useState, useEffect, useMemo } from "react";
import {
    Brain,
    Sparkles,
    ChevronDown,
    Search,
    Globe,
    Shield,
    FileSpreadsheet,
    Database,
    Send,
    Check,
    Loader2,
    CheckCircle2,
} from "lucide-react";

interface ThoughtProcessProps {
    thoughtText: string;
    isThinking: boolean;
    isDark: boolean;
}

interface ProcessStep {
    id: string;
    iconType: "brain" | "search" | "fetch" | "factcheck" | "codereview" | "export" | "database" | "webhook" | "general";
    text: string;
    status: "running" | "completed";
}

const FALLBACK_THINKING_MESSAGES = [
    "Analyzing prompt and determining strategy…",
    "Selecting reasoning path and tools…",
    "Synthesizing gathered knowledge…",
];

function getStepIcon(type: ProcessStep["iconType"], status: ProcessStep["status"], isDark: boolean) {
    const iconClass = "w-3.5 h-3.5 shrink-0";

    switch (type) {
        case "search":
            return <Search className={`${iconClass} text-sky-400`} />;
        case "fetch":
            return <Globe className={`${iconClass} text-emerald-400`} />;
        case "factcheck":
            return <Shield className={`${iconClass} text-amber-400`} />;
        case "codereview":
            return <Shield className={`${iconClass} text-indigo-400`} />;
        case "export":
            return <FileSpreadsheet className={`${iconClass} text-emerald-400`} />;
        case "database":
            return <Database className={`${iconClass} text-violet-400`} />;
        case "webhook":
            return <Send className={`${iconClass} text-pink-400`} />;
        case "brain":
            return <Brain className={`${iconClass} text-purple-400`} />;
        default:
            return status === "running" ? (
                <Brain className={`${iconClass} text-purple-400 animate-pulse`} />
            ) : (
                <CheckCircle2 className={`${iconClass} text-green-400`} />
            );
    }
}

export default function ThoughtProcess({ thoughtText, isThinking, isDark }: ThoughtProcessProps) {
    const [isExpanded, setIsExpanded] = useState(isThinking);
    const [elapsedSeconds, setElapsedSeconds] = useState(0);
    const [fallbackIndex, setFallbackIndex] = useState(0);

    // Track elapsed time during active thinking
    useEffect(() => {
        if (!isThinking) return;

        const start = Date.now();
        const interval = setInterval(() => {
            const elapsed = ((Date.now() - start) / 1000).toFixed(1);
            setElapsedSeconds(parseFloat(elapsed));
        }, 100);

        return () => clearInterval(interval);
    }, [isThinking]);

    // Cycle through intelligent hints if no raw thought lines have arrived yet
    useEffect(() => {
        if (!isThinking) return;
        const hintTimer = setInterval(() => {
            setFallbackIndex((prev) => (prev + 1) % FALLBACK_THINKING_MESSAGES.length);
        }, 2200);
        return () => clearInterval(hintTimer);
    }, [isThinking]);

    // Keep it open while thinking; close once completed (unless user manually clicks)
    useEffect(() => {
        if (isThinking) {
            setIsExpanded(true);
        } else {
            setIsExpanded(false);
        }
    }, [isThinking]);

    // Parse thought text lines into structured timeline steps
    const steps = useMemo<ProcessStep[]>(() => {
        if (!thoughtText.trim()) return [];

        const lines = thoughtText
            .split("\n")
            .map((l) => l.trim())
            .filter((l) => l.length > 0);

        return lines.map((line, idx) => {
            const isLast = idx === lines.length - 1;
            const status: ProcessStep["status"] = isThinking && isLast ? "running" : "completed";

            let iconType: ProcessStep["iconType"] = "general";
            const lower = line.toLowerCase();

            if (lower.includes("search") || lower.includes("🔍")) iconType = "search";
            else if (lower.includes("reading") || lower.includes("deep reading") || lower.includes("fetch") || lower.includes("🌐")) iconType = "fetch";
            else if (lower.includes("fact-checker") || lower.includes("🕵️")) iconType = "factcheck";
            else if (lower.includes("code reviewer") || lower.includes("💻")) iconType = "codereview";
            else if (lower.includes("export") || lower.includes("report") || lower.includes("📥")) iconType = "export";
            else if (lower.includes("digest") || lower.includes("database") || lower.includes("💾")) iconType = "database";
            else if (lower.includes("webhook") || lower.includes("📡")) iconType = "webhook";
            else if (lower.includes("analyzing") || lower.includes("brain") || lower.includes("🧠")) iconType = "brain";

            // Clean line emojis for consistent typography
            const cleanText = line.replace(/^[🔍🌐📊📥💾📡🕵️💻🧠⚙️\s*_-]+/, "").replace(/[*_`]/g, "").trim() || line;

            return {
                id: `step-${idx}`,
                iconType,
                text: cleanText,
                status,
            };
        });
    }, [thoughtText, isThinking]);

    const activeStepText = steps.length > 0
        ? steps[steps.length - 1].text
        : FALLBACK_THINKING_MESSAGES[fallbackIndex];

    return (
        <div
            className={`w-full mb-3 rounded-xl border transition-all duration-300 overflow-hidden ${
                isDark
                    ? "bg-white/[0.03] border-white/8 hover:border-white/12"
                    : "bg-black/[0.02] border-black/8 hover:border-black/12"
            }`}
        >
            {/* Header Accordion Bar */}
            <button
                type="button"
                onClick={() => setIsExpanded((prev) => !prev)}
                className={`w-full flex items-center justify-between px-3 py-2 text-xs font-medium cursor-pointer transition-colors select-none ${
                    isDark
                        ? "text-white/70 hover:text-white hover:bg-white/[0.02]"
                        : "text-black/70 hover:text-black hover:bg-black/[0.02]"
                }`}
            >
                <div className="flex items-center gap-2 min-w-0 pr-2">
                    {isThinking ? (
                        <div className="relative flex items-center justify-center">
                            <span className="w-3.5 h-3.5 rounded-full bg-purple-500/25 animate-ping absolute" />
                            <Brain className="w-3.5 h-3.5 text-purple-400 animate-pulse relative z-10" />
                        </div>
                    ) : (
                        <Brain className="w-3.5 h-3.5 text-purple-400/80 shrink-0" />
                    )}

                    <span className="truncate">
                        {isThinking ? (
                            <span className="font-semibold text-purple-400 dark:text-purple-300">
                                Thinking ({elapsedSeconds > 0 ? `${elapsedSeconds}s` : "..."}):{" "}
                                <span className={`font-normal ${isDark ? "text-white/60" : "text-black/60"}`}>
                                    {activeStepText}
                                </span>
                            </span>
                        ) : (
                            <span>
                                Thought {elapsedSeconds > 0 ? `for ${elapsedSeconds}s` : "process"}
                                {steps.length > 0 && ` • ${steps.length} step${steps.length > 1 ? "s" : ""}`}
                            </span>
                        )}
                    </span>
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                    {isThinking && (
                        <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-purple-500/10 text-purple-400 border border-purple-500/20">
                            Active
                        </span>
                    )}
                    <ChevronDown
                        className={`w-3.5 h-3.5 transition-transform duration-200 opacity-60 ${
                            isExpanded ? "rotate-180" : "rotate-0"
                        }`}
                    />
                </div>
            </button>

            {/* Collapsible Timeline Content */}
            {isExpanded && (
                <div
                    className={`px-3.5 pb-3 pt-1 text-xs border-t transition-colors ${
                        isDark ? "border-white/6 bg-black/20 text-white/70" : "border-black/6 bg-black/[0.01] text-black/70"
                    }`}
                >
                    {steps.length === 0 ? (
                        <div className="flex items-center gap-2 py-1.5 opacity-70">
                            <Brain className="w-3.5 h-3.5 animate-pulse text-purple-400" />
                            <span>{FALLBACK_THINKING_MESSAGES[fallbackIndex]}</span>
                        </div>
                    ) : (
                        <div className="space-y-2 mt-1">
                            {steps.map((step) => {
                                const isRunning = step.status === "running";
                                return (
                                    <div
                                        key={step.id}
                                        className={`flex items-start gap-2.5 transition-opacity ${
                                            isRunning ? "opacity-100 font-medium" : "opacity-80"
                                        }`}
                                    >
                                        <div className="mt-0.5">
                                            {getStepIcon(step.iconType, step.status, isDark)}
                                        </div>
                                        <div className="flex-1 min-w-0 leading-relaxed break-words">
                                            <span>{step.text}</span>
                                        </div>
                                        {isRunning ? (
                                            <span className="relative flex h-2 w-2 shrink-0 mt-1.5 mr-0.5">
                                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-purple-400 opacity-75" />
                                                <span className="relative inline-flex rounded-full h-2 w-2 bg-purple-500" />
                                            </span>
                                        ) : (
                                            <Check className="w-3 h-3 text-emerald-400 shrink-0 mt-0.5" />
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
