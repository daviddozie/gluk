import { Skeleton } from "@/components/ui/skeleton";

export default function ChatSkeleton() {
    return (
        <div className="flex h-screen bg-[#0a0a0a] text-white overflow-hidden">

            {/* Sidebar skeleton */}
            <div className="w-[260px] flex-shrink-0 flex flex-col bg-[#111111] border-r border-white/[0.06] h-full">
                {/* Sidebar header */}
                <div className="flex items-center justify-between px-3 py-3 border-b border-white/[0.06]">
                    <div className="flex items-center gap-2">
                        <Skeleton className="w-7 h-7 rounded-lg bg-white/[0.08]" />
                        <Skeleton className="w-10 h-4 bg-white/[0.08]" />
                    </div>
                    <div className="flex gap-1">
                        <Skeleton className="w-7 h-7 rounded-lg bg-white/[0.08]" />
                        <Skeleton className="w-7 h-7 rounded-lg bg-white/[0.08]" />
                    </div>
                </div>

                {/* Conversation items */}
                <div className="flex-1 py-2 px-2 space-y-1">
                    {[80, 60, 72, 55, 68].map((w, i) => (
                        <div key={i} className="flex items-center gap-2 px-3 py-2">
                            <Skeleton className="w-3.5 h-3.5 rounded bg-white/[0.06] flex-shrink-0" />
                            <Skeleton className={`h-3 rounded bg-white/[0.06]`} style={{ width: `${w}%` }} />
                        </div>
                    ))}
                </div>

                {/* Sidebar footer */}
                <div className="p-2 border-t border-white/[0.06]">
                    <div className="flex items-center gap-2 px-2 py-2">
                        <Skeleton className="w-7 h-7 rounded-full bg-white/[0.08] flex-shrink-0" />
                        <Skeleton className="flex-1 h-3 rounded bg-white/[0.08]" />
                    </div>
                </div>
            </div>

            {/* Main content skeleton */}
            <div className="flex flex-col flex-1 min-w-0">
                {/* Header */}
                <div className="flex items-center h-14 px-4 border-b border-white/[0.06]">
                    <Skeleton className="w-8 h-8 rounded-lg bg-white/[0.08] mr-3" />
                    <Skeleton className="w-32 h-4 rounded bg-white/[0.08]" />
                    <div className="ml-auto">
                        <Skeleton className="w-8 h-8 rounded-lg bg-white/[0.08]" />
                    </div>
                </div>

                {/* Chat messages skeleton */}
                <div className="flex-1 overflow-hidden">
                    <div className="max-w-3xl mx-auto px-4 py-6 space-y-6">

                        {/* User message */}
                        <div className="flex gap-3 flex-row-reverse">
                            <Skeleton className="w-8 h-8 rounded-full bg-white/[0.08] flex-shrink-0" />
                            <Skeleton className="w-48 h-10 rounded-2xl rounded-tr-sm bg-white/[0.06]" />
                        </div>

                        {/* Assistant message */}
                        <div className="flex gap-3">
                            <Skeleton className="w-8 h-8 rounded-full bg-white/[0.08] flex-shrink-0" />
                            <div className="space-y-2 flex-1 max-w-lg">
                                <Skeleton className="w-full h-3 rounded bg-white/[0.06]" />
                                <Skeleton className="w-5/6 h-3 rounded bg-white/[0.06]" />
                                <Skeleton className="w-4/6 h-3 rounded bg-white/[0.06]" />
                            </div>
                        </div>

                        {/* User message */}
                        <div className="flex gap-3 flex-row-reverse">
                            <Skeleton className="w-8 h-8 rounded-full bg-white/[0.08] flex-shrink-0" />
                            <Skeleton className="w-36 h-10 rounded-2xl rounded-tr-sm bg-white/[0.06]" />
                        </div>

                        {/* Assistant message */}
                        <div className="flex gap-3">
                            <Skeleton className="w-8 h-8 rounded-full bg-white/[0.08] flex-shrink-0" />
                            <div className="space-y-2 flex-1 max-w-lg">
                                <Skeleton className="w-full h-3 rounded bg-white/[0.06]" />
                                <Skeleton className="w-3/4 h-3 rounded bg-white/[0.06]" />
                            </div>
                        </div>

                    </div>
                </div>

                {/* Input skeleton */}
                <div className="px-4 pb-6 pt-2">
                    <div className="max-w-3xl mx-auto">
                        <Skeleton className="w-full h-[52px] rounded-2xl bg-white/[0.06]" />
                    </div>
                </div>
            </div>
        </div>
    );
}