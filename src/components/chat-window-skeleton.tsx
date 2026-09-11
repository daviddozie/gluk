"use client";

import { Skeleton } from "@/components/ui/skeleton";

interface ChatWindowSkeletonProps {
    theme: "light" | "dark";
}

export default function ChatWindowSkeleton({ theme }: ChatWindowSkeletonProps) {
    const isDark = theme === "dark";
    const shimHigh = isDark ? "bg-white/8" : "bg-black/8";
    const shimLow = isDark ? "bg-white/6" : "bg-black/5";

    return (
        <div className="flex-1 overflow-hidden">
            <div className="max-w-3xl mx-auto px-4 py-6 space-y-6 animate-pulse">
                {/* User message placeholder */}
                <div className="flex gap-3 flex-row-reverse items-end">
                    <Skeleton className={`w-8 h-8 rounded-full ${shimHigh} shrink-0`} />
                    <Skeleton className={`w-44 h-10 rounded-2xl rounded-tr-sm ${shimLow}`} />
                </div>

                {/* Assistant message placeholder */}
                <div className="flex gap-3 items-start">
                    <Skeleton className={`w-8 h-8 rounded-full ${shimHigh} shrink-0`} />
                    <div className="space-y-2.5 flex-1 max-w-lg mt-1">
                        <Skeleton className={`w-full h-3 rounded ${shimLow}`} />
                        <Skeleton className={`w-4/5 h-3 rounded ${shimLow}`} />
                        <Skeleton className={`w-2/3 h-3 rounded ${shimLow}`} />
                    </div>
                </div>

                {/* Second User message placeholder */}
                <div className="flex gap-3 flex-row-reverse items-end">
                    <Skeleton className={`w-8 h-8 rounded-full ${shimHigh} shrink-0`} />
                    <Skeleton className={`w-32 h-10 rounded-2xl rounded-tr-sm ${shimLow}`} />
                </div>

                {/* Second Assistant message placeholder */}
                <div className="flex gap-3 items-start">
                    <Skeleton className={`w-8 h-8 rounded-full ${shimHigh} shrink-0`} />
                    <div className="space-y-2.5 flex-1 max-w-lg mt-1">
                        <Skeleton className={`w-full h-3 rounded ${shimLow}`} />
                        <Skeleton className={`w-3/4 h-3 rounded ${shimLow}`} />
                    </div>
                </div>
            </div>
        </div>
    );
}
