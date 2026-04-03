"use client";

import { useEffect, useState } from "react";
import { Skeleton } from "@/components/ui/skeleton";

export default function ChatSkeleton() {
    const [isDark, setIsDark] = useState(true);

    useEffect(() => {
        const stored = localStorage.getItem("theme");
        const systemDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
        setIsDark(stored === "light" ? false : stored === "dark" ? true : systemDark);
    }, []);

    const bg        = isDark ? "bg-[#0a0a0a]"   : "bg-white";
    const sidebar   = isDark ? "bg-[#111111]"   : "bg-[#f5f5f5]";
    const border    = isDark ? "border-white/6"  : "border-black/10";
    const shimHigh  = isDark ? "bg-white/8"      : "bg-black/8"; 
    const shimLow   = isDark ? "bg-white/6"      : "bg-black/5";

    return (
        <div className={`flex h-screen ${bg} overflow-hidden transition-colors duration-300`}>

            {/* Sidebar skeleton */}
            <div className={`w-65 shrink-0 flex flex-col ${sidebar} border-r ${border} h-full`}>
                {/* Sidebar header */}
                <div className={`flex items-center justify-between px-3 py-3 border-b ${border}`}>
                    <div className="flex items-center gap-2">
                        <Skeleton className={`w-7 h-7 rounded-lg ${shimHigh}`} />
                        <Skeleton className={`w-10 h-4 ${shimHigh}`} />
                    </div>
                    <div className="flex gap-1">
                        <Skeleton className={`w-7 h-7 rounded-lg ${shimHigh}`} />
                        <Skeleton className={`w-7 h-7 rounded-lg ${shimHigh}`} />
                    </div>
                </div>

                {/* Conversation items */}
                <div className="flex-1 py-2 px-2 space-y-1">
                    {[80, 60, 72, 55, 68].map((w, i) => (
                        <div key={i} className="flex items-center gap-2 px-3 py-2">
                            <Skeleton className={`w-3.5 h-3.5 rounded ${shimLow} shrink-0`} />
                            <Skeleton className={`h-3 rounded ${shimLow}`} style={{ width: `${w}%` }} />
                        </div>
                    ))}
                </div>

                {/* Sidebar footer */}
                <div className={`p-2 border-t ${border}`}>
                    <div className="flex items-center gap-2 px-2 py-2">
                        <Skeleton className={`w-7 h-7 rounded-full ${shimHigh} shrink-0`} />
                        <Skeleton className={`flex-1 h-3 rounded ${shimHigh}`} />
                    </div>
                </div>
            </div>

            {/* Main content skeleton */}
            <div className="flex flex-col flex-1 min-w-0">
                {/* Header */}
                <div className={`flex items-center h-14 px-4 border-b ${border}`}>
                    <Skeleton className={`w-8 h-8 rounded-lg ${shimHigh} mr-3`} />
                    <Skeleton className={`w-32 h-4 rounded ${shimHigh}`} />
                    <div className="ml-auto flex gap-2">
                        <Skeleton className={`w-8 h-8 rounded-lg ${shimHigh}`} />
                        <Skeleton className={`w-8 h-8 rounded-lg ${shimHigh}`} />
                    </div>
                </div>

                {/* Chat messages skeleton */}
                <div className="flex-1 overflow-hidden">
                    <div className="max-w-3xl mx-auto px-4 py-6 space-y-6">

                        {/* User message */}
                        <div className="flex gap-3 flex-row-reverse">
                            <Skeleton className={`w-8 h-8 rounded-full ${shimHigh} shrink-0`} />
                            <Skeleton className={`w-48 h-10 rounded-2xl rounded-tr-sm ${shimLow}`} />
                        </div>

                        {/* Assistant message */}
                        <div className="flex gap-3">
                            <Skeleton className={`w-8 h-8 rounded-full ${shimHigh} shrink-0`} />
                            <div className="space-y-2 flex-1 max-w-lg">
                                <Skeleton className={`w-full h-3 rounded ${shimLow}`} />
                                <Skeleton className={`w-5/6 h-3 rounded ${shimLow}`} />
                                <Skeleton className={`w-4/6 h-3 rounded ${shimLow}`} />
                            </div>
                        </div>

                        {/* User message */}
                        <div className="flex gap-3 flex-row-reverse">
                            <Skeleton className={`w-8 h-8 rounded-full ${shimHigh} shrink-0`} />
                            <Skeleton className={`w-36 h-10 rounded-2xl rounded-tr-sm ${shimLow}`} />
                        </div>

                        {/* Assistant message */}
                        <div className="flex gap-3">
                            <Skeleton className={`w-8 h-8 rounded-full ${shimHigh} shrink-0`} />
                            <div className="space-y-2 flex-1 max-w-lg">
                                <Skeleton className={`w-full h-3 rounded ${shimLow}`} />
                                <Skeleton className={`w-3/4 h-3 rounded ${shimLow}`} />
                            </div>
                        </div>

                    </div>
                </div>

                {/* Input skeleton */}
                <div className="px-4 pb-6 pt-2">
                    <div className="max-w-3xl mx-auto">
                        <Skeleton className={`w-full h-13 rounded-2xl ${shimLow}`} />
                    </div>
                </div>
            </div>
        </div>
    );
}