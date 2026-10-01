"use client";

import { useState } from "react";
import { AlertCircle, CheckCircle2, ChevronDown, ChevronUp, Folder, LoaderCircle, RotateCcw, X } from "lucide-react";
import { FileIcon } from "@public/svg/icon";

export type ResourceQueueKind = "upload" | "new-file" | "folder";
export type ResourceQueueStatus = "queued" | "running" | "completed" | "failed";

export interface ResourceQueueItem {
    id: string;
    kind: ResourceQueueKind;
    name: string;
    detail?: string;
    type: string;
    destinationFolder: string | null;
    progress: number;
    status: ResourceQueueStatus;
    attempt: number;
    error?: string;
}

interface UploadQueueProps {
    items: ResourceQueueItem[];
    isDark: boolean;
    onDismiss: () => void;
    onRetry: (id: string) => void;
}

export function UploadQueue({ items, isDark, onDismiss, onRetry }: UploadQueueProps) {
    const [collapsed, setCollapsed] = useState(false);
    if (items.length === 0) return null;

    const active = items.filter((item) => item.status === "queued" || item.status === "running").length;
    const completed = items.filter((item) => item.status === "completed").length;
    const failed = items.filter((item) => item.status === "failed").length;
    const title = active
        ? `${active} ${active === 1 ? "task" : "tasks"} in progress`
        : failed
            ? `${failed} ${failed === 1 ? "task" : "tasks"} failed`
            : `${completed} ${completed === 1 ? "task" : "tasks"} completed`;
    const secondary = isDark ? "text-white/50" : "text-black/50";

    return (
        <aside aria-live="polite" aria-label="Resource activity" className={`fixed bottom-5 right-5 z-50 w-[min(28rem,calc(100vw-2.5rem))] overflow-hidden rounded-2xl border shadow-2xl ${isDark ? "border-white/10 bg-[#202020] text-white" : "border-black/10 bg-white text-black"}`}>
            <div className={`flex items-center gap-3 border-b px-4 py-3 ${isDark ? "border-white/8" : "border-black/8"}`}>
                <span className="min-w-0 flex-1 truncate text-sm font-medium">{title}</span>
                <span className={`text-xs ${secondary}`}>{completed}/{items.length}</span>
                <button type="button" onClick={() => setCollapsed((value) => !value)} aria-label={collapsed ? "Expand activity" : "Collapse activity"} className={`cursor-pointer rounded-md p-1.5 ${isDark ? "hover:bg-white/10" : "hover:bg-black/5"}`}>
                    {collapsed ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                </button>
                {active === 0 && <button type="button" onClick={onDismiss} aria-label="Dismiss completed activity" className={`cursor-pointer rounded-md p-1.5 ${isDark ? "hover:bg-white/10" : "hover:bg-black/5"}`}><X className="h-4 w-4" /></button>}
            </div>
            {!collapsed && <ul className="max-h-80 divide-y overflow-y-auto">
                {items.map((item) => {
                    const isRunning = item.status === "running";
                    const isQueued = item.status === "queued";
                    const isFailed = item.status === "failed";
                    const label = item.kind === "folder" ? "Folder" : item.kind === "new-file" ? "New file" : "Upload";
                    const statusText = isQueued
                        ? "Waiting in queue"
                        : isRunning
                            ? item.error ?? (item.kind === "folder" ? "Creating folder…" : `${item.kind === "new-file" ? "Creating" : "Uploading"}… ${item.progress}%`)
                            : isFailed ? item.error ?? "Failed" : item.kind === "folder" ? "Folder created" : "Complete";

                    return (
                        <li key={item.id} className="flex items-center gap-3 px-4 py-3">
                            <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border ${isDark ? "border-white/8 bg-white/[0.03]" : "border-black/8 bg-black/[0.02]"}`}>
                                {isRunning ? <LoaderCircle className="h-4 w-4 animate-spin opacity-65" /> : isFailed ? <AlertCircle className="h-4 w-4 text-red-500" /> : item.status === "completed" ? <CheckCircle2 className="h-4 w-4 text-emerald-500" /> : item.kind === "folder" ? <Folder className="h-4 w-4 opacity-60" /> : <LoaderCircle className="h-4 w-4 opacity-40" />}
                            </span>
                            <div className="min-w-0 flex-1">
                                <p className="truncate text-sm">{item.name}</p>
                                <p className={`mt-0.5 truncate text-xs ${isFailed ? "text-red-400" : secondary}`}>
                                    {item.detail ? `${item.detail} · ` : ""}{label}{item.destinationFolder ? ` · ${item.destinationFolder}` : item.kind !== "folder" ? " · My resources" : ""} · {statusText}
                                </p>
                                {isRunning && item.kind !== "folder" && <div className={`mt-2 h-1 overflow-hidden rounded-full ${isDark ? "bg-white/10" : "bg-black/10"}`}><div className={`h-full rounded-full transition-[width] ${isDark ? "bg-white/80" : "bg-black/70"}`} style={{ width: `${item.progress}%` }} /></div>}
                            </div>
                            {item.kind === "folder" ? <Folder className="h-6 w-6 shrink-0 opacity-60" /> : <span className="shrink-0" aria-label={`${item.type} file`}><FileIcon fileName={item.name} fileType={item.type} size={30} /></span>}
                            {isFailed && <button type="button" onClick={() => onRetry(item.id)} aria-label={`Retry ${label.toLowerCase()} ${item.name}`} className={`cursor-pointer rounded-md p-2 ${isDark ? "hover:bg-white/10" : "hover:bg-black/5"}`}><RotateCcw className="h-4 w-4" /></button>}
                        </li>
                    );
                })}
            </ul>}
        </aside>
    );
}
