"use client";

import { useState, useRef, useEffect } from "react";
import { Paperclip, X, FileText, Sheet, File } from "lucide-react";

export interface AttachedFile {
    id: string;
    file: File;
    preview?: string;
    type: "image" | "pdf" | "csv" | "txt" | "other";
    status: "uploading" | "done" | "error";
    progress: number;
}

interface ChatInputProps {
    onSend: (message: string, files?: AttachedFile[]) => void;
    onAbort: () => void;
    isStreaming: boolean;
    theme: "light" | "dark";
}

function getFileType(file: File): AttachedFile["type"] {
    if (file.type.startsWith("image/")) return "image";
    if (file.type === "application/pdf") return "pdf";
    if (file.type === "text/csv" || file.name.endsWith(".csv")) return "csv";
    if (file.type === "text/plain" || file.name.endsWith(".txt")) return "txt";
    return "other";
}

function FileTypeIcon({ type }: { type: AttachedFile["type"] }) {
    if (type === "pdf") return <FileText className="w-5 h-5 text-red-400" />;
    if (type === "csv") return <Sheet className="w-5 h-5 text-green-400" />;
    if (type === "txt") return <FileText className="w-5 h-5 text-blue-400" />;
    return <File className="w-5 h-5 text-white/60" />;
}

function CircularProgress({ progress }: { progress: number }) {
    const radius = 20;
    const circumference = 2 * Math.PI * radius;
    const offset = circumference - (progress / 100) * circumference;

    return (
        <div className="absolute inset-0 flex items-center justify-center bg-black/60 rounded-xl">
            <svg width="48" height="48" className="-rotate-90">
                <circle cx="24" cy="24" r={radius} fill="none" stroke="rgba(255,255,255,0.15)" strokeWidth="3" />
                <circle
                    cx="24" cy="24" r={radius}
                    fill="none" stroke="white" strokeWidth="3"
                    strokeDasharray={circumference}
                    strokeDashoffset={offset}
                    strokeLinecap="round"
                    style={{ transition: "stroke-dashoffset 0.3s ease" }}
                />
            </svg>
            <span className="absolute text-[10px] font-medium text-white">{progress}%</span>
        </div>
    );
}

function FilePreviewChip({ file, onRemove }: { file: AttachedFile; onRemove: () => void }) {
    return (
        <div className="relative group flex-shrink-0">
            <div className="w-16 h-16 rounded-xl overflow-hidden border border-white/[0.1] bg-white/[0.05] flex items-center justify-center">
                {file.type === "image" && file.preview ? (
                    <img src={file.preview} alt={file.file.name} className="w-full h-full object-cover" />
                ) : (
                    <div className="flex flex-col items-center gap-1 px-1">
                        <FileTypeIcon type={file.type} />
                        <span className="text-[9px] text-white/40 truncate w-full text-center">
                            {file.type.toUpperCase()}
                        </span>
                    </div>
                )}

                {file.status === "uploading" && <CircularProgress progress={file.progress} />}

                {file.status === "error" && (
                    <div className="absolute inset-0 flex items-center justify-center bg-red-500/40 rounded-xl">
                        <X className="w-5 h-5 text-red-300" />
                    </div>
                )}

                {file.status === "done" && (
                    <div className="absolute bottom-1 right-1 w-4 h-4 rounded-full bg-green-500 flex items-center justify-center">
                        <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3">
                            <path d="M20 6L9 17l-5-5" />
                        </svg>
                    </div>
                )}
            </div>

            <div className="absolute -bottom-5 left-0 right-0 text-center">
                <span className="text-[9px] text-white/40 truncate block max-w-[64px]">
                    {file.file.name.length > 8 ? file.file.name.slice(0, 7) + "…" : file.file.name}
                </span>
            </div>

            {file.status !== "uploading" && (
                <button
                    onClick={onRemove}
                    className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-white/20 hover:bg-white/40 flex items-center justify-center opacity-0 group-hover:opacity-100 cursor-pointer transition-opacity"
                >
                    <X className="w-2.5 h-2.5 text-white" />
                </button>
            )}
        </div>
    );
}

export default function ChatInput({ onSend, onAbort, isStreaming, theme }: ChatInputProps) {
    const [input, setInput] = useState("");
    const [attachedFiles, setAttachedFiles] = useState<AttachedFile[]>([]);
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const isDark = theme === "dark";

    useEffect(() => {
        if (textareaRef.current) {
            textareaRef.current.style.height = "auto";
            textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 160)}px`;
        }
    }, [input]);

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = Array.from(e.target.files ?? []);
        if (!files.length) return;

        const newFiles: AttachedFile[] = await Promise.all(
            files.map(async (file) => {
                const type = getFileType(file);
                let preview: string | undefined;

                if (type === "image") {
                    preview = await new Promise<string>((resolve) => {
                        const reader = new FileReader();
                        reader.onload = () => resolve(reader.result as string);
                        reader.readAsDataURL(file);
                    });
                }

                return {
                    id: crypto.randomUUID(),
                    file,
                    preview,
                    type,
                    status: "uploading" as const,
                    progress: 0,
                };
            })
        );

        setAttachedFiles((prev) => [...prev, ...newFiles]);
        e.target.value = "";

        // Animate progress and auto-mark done at 100%
        for (const f of newFiles) {
            let progress = 0;
            const interval = setInterval(() => {
                progress = Math.min(progress + 25, 100);
                setAttachedFiles((prev) =>
                    prev.map((af) => af.id === f.id ? { ...af, progress } : af)
                );
                if (progress >= 100) {
                    clearInterval(interval);
                    setAttachedFiles((prev) =>
                        prev.map((af) =>
                            af.id === f.id ? { ...af, status: "done" as const, progress: 100 } : af
                        )
                    );
                }
            }, 300);
        }
    };

    const removeFile = (id: string) => {
        setAttachedFiles((prev) => prev.filter((f) => f.id !== id));
    };

    const handleSend = () => {
        const allDone = attachedFiles.every((f) => f.status !== "uploading");
        if ((!input.trim() && attachedFiles.length === 0) || isStreaming || !allDone) return;
        onSend(input.trim(), attachedFiles.length > 0 ? attachedFiles : undefined);
        setInput("");
        setAttachedFiles([]);
        if (textareaRef.current) textareaRef.current.style.height = "auto";
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    };

    const allDone = attachedFiles.every((f) => f.status !== "uploading");
    const canSend = (input.trim().length > 0 || attachedFiles.length > 0) && !isStreaming && allDone;

    return (
        <div className="px-3 sm:px-4 pb-4 sm:pb-6 pt-2">
            <div className="max-w-3xl mx-auto">
                <div className={`border rounded-2xl focus-within:ring-1 transition-all duration-300 ${
                    isDark
                        ? "bg-white/5 border-white/10 focus-within:border-white/20 focus-within:ring-white/10"
                        : "bg-black/4 border-black/12 focus-within:border-black/25 focus-within:ring-black/10"
                }`}>

                    {attachedFiles.length > 0 && (
                        <div className="flex gap-3 px-4 pt-3 pb-1 flex-wrap">
                            {attachedFiles.map((f) => (
                                <FilePreviewChip key={f.id} file={f} onRemove={() => removeFile(f.id)} />
                            ))}
                        </div>
                    )}

                    <div className={`flex items-end gap-2 px-3 sm:px-4 py-3 ${attachedFiles.length > 0 ? "pt-6" : ""}`}>
                        <button
                            onClick={() => fileInputRef.current?.click()}
                            disabled={isStreaming}
                            className={`flex-shrink-0 p-1.5 rounded-lg cursor-pointer transition-all disabled:opacity-30 disabled:cursor-not-allowed ${
                                isDark
                                    ? "text-white/40 hover:text-white/80 hover:bg-white/8"
                                    : "text-black/40 hover:text-black/80 hover:bg-black/8"
                            }`}
                            title="Attach file"
                        >
                            <Paperclip className="w-4 h-4" />
                        </button>

                        <textarea
                            ref={textareaRef}
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            onKeyDown={handleKeyDown}
                            placeholder="Message Gluk..."
                            rows={1}
                            className={`flex-1 bg-transparent text-sm resize-none outline-none leading-6 max-h-[160px] overflow-y-auto transition-colors duration-300 ${
                                isDark ? "text-white placeholder-white/30" : "text-black placeholder-black/30"
                            }`}
                            disabled={isStreaming}
                        />

                        <div className="flex items-center flex-shrink-0">
                            {isStreaming ? (
                                <button
                                    onClick={onAbort}
                                    className={`flex items-center justify-center w-8 h-8 rounded-lg border cursor-pointer transition-all ${
                                        isDark
                                            ? "bg-white/10 hover:bg-white/20 border-white/20 text-white"
                                            : "bg-black/8 hover:bg-black/15 border-black/20 text-black"
                                    }`}
                                >
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                                        <rect x="6" y="6" width="12" height="12" rx="2" />
                                    </svg>
                                </button>
                            ) : (
                                <button
                                    onClick={handleSend}
                                    disabled={!canSend}
                                    className={`flex items-center justify-center w-8 h-8 rounded-lg transition-all ${
                                        canSend
                                            ? (isDark ? "bg-white text-black hover:bg-white/90" : "bg-black text-white hover:bg-black/85")
                                            : (isDark ? "bg-white/10 text-white/30 cursor-not-allowed" : "bg-black/8 text-black/30 cursor-not-allowed")
                                    }`}
                                >
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                                        <path d="M12 19V5M5 12l7-7 7 7" />
                                    </svg>
                                </button>
                            )}
                        </div>
                    </div>
                </div>

                <p className={`text-center text-xs mt-2 hidden sm:block transition-colors duration-300 ${
                    isDark ? "text-white/20" : "text-black/30"
                }`}>
                    Press Enter to send · Shift+Enter for new line
                </p>
            </div>

            <input
                ref={fileInputRef}
                type="file"
                multiple
                accept="image/*,.pdf,.txt,.csv,.md,.docx"
                onChange={handleFileChange}
                className="hidden"
            />
        </div>
    );
}