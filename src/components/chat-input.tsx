"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { Plus, X, Mic, LibraryBig, Paperclip, FolderOpen } from "lucide-react";
import { FileIcon, getFileCategory } from "@public/svg/icon";
import FilePreviewModal from "./file-preview-modal";
import { ResourceReference } from "@/types/resource";
import { ResourcePickerDialog } from "@/components/resources/resource-picker-dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

export interface AttachedFile {
    id: string;
    file: File;
    preview?: string;
    type: "image" | "pdf" | "csv" | "doc" | "txt" | "other";
    status: "uploading" | "done" | "error";
    progress: number;
}

interface ChatInputProps {
    onSend: (message: string, files?: AttachedFile[]) => void;
    onAbort: () => void;
    isStreaming: boolean;
    theme: "light" | "dark";
    referenceResource?: ResourceReference | null;
    onRemoveReference?: () => void;
    onSelectResource?: (resource: ResourceReference) => void;
}

function getFileType(file: File): AttachedFile["type"] {
    if (file.type.startsWith("image/")) return "image";
    const name = file.name.toLowerCase();
    if (file.type === "application/pdf" || name.endsWith(".pdf")) return "pdf";
    if (file.type === "text/csv" || name.endsWith(".csv")) return "csv";
    if (
        file.type === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
        file.type === "application/msword" ||
        name.endsWith(".docx") ||
        name.endsWith(".doc") ||
        name.endsWith(".odt") ||
        name.endsWith(".rtf")
    ) {
        return "doc";
    }
    if (file.type === "text/plain" || name.endsWith(".txt") || name.endsWith(".md") || name.endsWith(".markdown")) {
        return "txt";
    }
    return "other";
}


function CircularProgress({ progress }: { progress: number }) {
    const radius = 7;
    const circumference = 2 * Math.PI * radius;
    const offset = circumference - (progress / 100) * circumference;

    return (
        <div className="relative flex items-center justify-center w-5 h-5">
            <svg width="18" height="18" className="-rotate-90">
                <circle cx="9" cy="9" r={radius} fill="none" stroke="rgba(255,255,255,0.15)" strokeWidth="2" />
                <circle
                    cx="9" cy="9" r={radius}
                    fill="none" stroke="currentColor" strokeWidth="2"
                    strokeDasharray={circumference}
                    strokeDashoffset={offset}
                    strokeLinecap="round"
                    style={{ transition: "stroke-dashoffset 0.3s ease" }}
                />
            </svg>
        </div>
    );
}

function FilePreviewChip({
    file,
    onRemove,
    onPreview,
    isDark,
}: {
    file: AttachedFile;
    onRemove: () => void;
    onPreview?: () => void;
    isDark: boolean;
}) {
    const isImg = file.type === "image";
    const ext = file.file.name.split(".").pop()?.toUpperCase() || file.type.toUpperCase();

    return (
        <div
            className={`relative group flex items-center gap-3 px-3.5 py-2.5 rounded-2xl border transition-all duration-300 max-w-[280px] sm:max-w-[320px] flex-shrink-0 ${
                isDark
                    ? "bg-white/[0.06] border-white/10 text-white"
                    : "bg-black/[0.04] border-black/10 text-black"
            }`}
        >
            <div
                onClick={onPreview}
                className="flex items-center gap-3 min-w-0 flex-1 cursor-pointer"
            >
                {isImg && file.preview ? (
                    <div className="w-8 h-8 rounded-lg overflow-hidden shrink-0 border border-white/10">
                        <img src={file.preview} alt={file.file.name} className="w-full h-full object-cover" />
                    </div>
                ) : (
                    <div className="shrink-0 flex items-center justify-center">
                        <FileIcon fileName={file.file.name} fileType={file.file.type} size={26} />
                    </div>
                )}

                <div className="flex flex-col min-w-0 flex-1 text-left">
                    <span className="text-xs font-medium truncate block">
                        {file.file.name}
                    </span>
                    <span
                        className={`text-[10px] uppercase tracking-wider font-medium ${
                            isDark ? "text-white/40" : "text-black/40"
                        }`}
                    >
                        {ext}
                    </span>
                </div>
            </div>

            {/* Uploading progress spinner */}
            {file.status === "uploading" && (
                <div className="shrink-0 ml-1">
                    <CircularProgress progress={file.progress} />
                </div>
            )}

            {/* Error badge */}
            {file.status === "error" && (
                <div className="shrink-0 ml-1 w-5 h-5 rounded-full bg-red-500/20 text-red-400 flex items-center justify-center">
                    <X className="w-3.5 h-3.5" />
                </div>
            )}

            {/* Remove button */}
            {file.status !== "uploading" && (
                <button
                    type="button"
                    onClick={onRemove}
                    className={`shrink-0 ml-1 w-5 h-5 rounded-full flex items-center justify-center cursor-pointer transition-colors ${
                        isDark
                            ? "text-white/40 hover:text-white/90 hover:bg-white/10"
                            : "text-black/40 hover:text-black/90 hover:bg-black/10"
                    }`}
                    title="Remove file"
                >
                    <X className="w-3.5 h-3.5" />
                </button>
            )}
        </div>
    );
}

export default function ChatInput({ onSend, onAbort, isStreaming, theme, referenceResource, onRemoveReference, onSelectResource }: ChatInputProps) {
    const [input, setInput] = useState("");
    const [attachedFiles, setAttachedFiles] = useState<AttachedFile[]>([]);
    const [previewFile, setPreviewFile] = useState<{ name: string; url?: string; type?: string } | null>(null);
    const [isRecording, setIsRecording] = useState(false);
    const [isTranscribing, setIsTranscribing] = useState(false);
    const [resourcePickerOpen, setResourcePickerOpen] = useState(false);
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const audioChunksRef = useRef<Blob[]>([]);
    const audioContextRef = useRef<AudioContext | null>(null);
    const analyserRef = useRef<AnalyserNode | null>(null);
    const canvasRef = useRef<HTMLCanvasElement | null>(null);
    const animFrameRef = useRef<number>(0);
    const waveHistoryRef = useRef<number[]>([]);
    const isDarkRef = useRef(theme === "dark");
    const isDark = theme === "dark";

    useEffect(() => {
        isDarkRef.current = theme === "dark";
    }, [theme]);

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

    const drawWaveform = useCallback(() => {
        const canvas = canvasRef.current;
        const analyser = analyserRef.current;
        if (!canvas || !analyser) return;

        const ctx = canvas.getContext("2d");
        if (!ctx) return;

        const bufferLength = analyser.frequencyBinCount;
        const dataArray = new Uint8Array(bufferLength);
        analyser.getByteFrequencyData(dataArray);

        let sum = 0;
        for (let i = 0; i < bufferLength; i++) sum += dataArray[i];
        const avg = sum / bufferLength / 255;

        waveHistoryRef.current.push(avg);
        const maxBars = Math.floor(canvas.width / 3);
        if (waveHistoryRef.current.length > maxBars) {
            waveHistoryRef.current.shift();
        }

        // Draw
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        const barW = 2;
        const gap = 3;
        const midY = canvas.height / 2;
        const history = waveHistoryRef.current;

        for (let i = 0; i < history.length; i++) {
            const amp = history[i];
            const minH = 3;
            const barH = Math.max(minH, amp * canvas.height * 0.92);
            const x = i * (barW + gap);
            const alpha = 0.35 + amp * 0.65;
            ctx.fillStyle = isDarkRef.current
                ? `rgba(255,255,255,${alpha})`
                : `rgba(0,0,0,${alpha})`;
            ctx.beginPath();
            ctx.roundRect(x, midY - barH / 2, barW, barH, 1.5);
            ctx.fill();
        }

        animFrameRef.current = requestAnimationFrame(drawWaveform);
    }, []);

    const startRecording = async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            const audioCtx = new AudioContext();
            const source = audioCtx.createMediaStreamSource(stream);
            const analyser = audioCtx.createAnalyser();
            analyser.fftSize = 128;
            analyser.smoothingTimeConstant = 0.75;
            source.connect(analyser);
            audioContextRef.current = audioCtx;
            analyserRef.current = analyser;
            waveHistoryRef.current = [];

            // MediaRecorder
            const recorder = new MediaRecorder(stream);
            audioChunksRef.current = [];
            recorder.ondataavailable = (e) => {
                if (e.data.size > 0) audioChunksRef.current.push(e.data);
            };
            recorder.onstop = async () => {
                stream.getTracks().forEach((t) => t.stop());
                audioContextRef.current?.close();
                audioContextRef.current = null;
                analyserRef.current = null;
                cancelAnimationFrame(animFrameRef.current);

                const blob = new Blob(audioChunksRef.current, { type: "audio/webm" });
                setIsTranscribing(true);
                try {
                    const fd = new FormData();
                    fd.append("audio", blob, "recording.webm");
                    const res = await fetch("/api/stt", { method: "POST", body: fd });
                    const { transcript } = await res.json();
                    if (transcript) {
                        setInput((prev) => prev ? prev + " " + transcript : transcript);
                    }
                } catch (err) {
                    console.error("STT error:", err);
                } finally {
                    setIsTranscribing(false);
                }
            };
            recorder.start();
            mediaRecorderRef.current = recorder;
            setIsRecording(true);

            // Start animation after state update
            setTimeout(() => { animFrameRef.current = requestAnimationFrame(drawWaveform); }, 50);
        } catch (err) {
            console.error("Microphone access error:", err);
        }
    };

    const stopRecording = () => {
        if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
            mediaRecorderRef.current.stop();
        }
        setIsRecording(false);
    };

    const cancelRecording = () => {
        cancelAnimationFrame(animFrameRef.current);
        if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
            // Prevent onstop from transcribing by clearing chunks
            audioChunksRef.current = [];
            mediaRecorderRef.current.onstop = () => {
                mediaRecorderRef.current?.stream?.getTracks().forEach((t) => t.stop());
                audioContextRef.current?.close();
                audioContextRef.current = null;
                analyserRef.current = null;
            };
            mediaRecorderRef.current.stop();
        }
        setIsRecording(false);
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
                <div className={`border rounded-xl focus-within:ring-1 transition-all duration-300 ${
                    isDark
                        ? "bg-white/5 border-white/10 focus-within:border-white/20 focus-within:ring-white/10"
                        : "bg-black/4 border-black/12 focus-within:border-black/25 focus-within:ring-black/10"
                }`}>

                    {(attachedFiles.length > 0 || referenceResource) && (
                        <div className="flex gap-2.5 px-4 pt-3 pb-1 flex-wrap">
                            {referenceResource && (
                                <div className={`flex max-w-[280px] items-center gap-2 rounded-2xl border px-3 py-2 sm:max-w-[320px] ${isDark ? "border-blue-400/20 bg-blue-400/8 text-white" : "border-blue-600/20 bg-blue-500/5 text-black"}`}>
                                    {getFileCategory(referenceResource.name, referenceResource.type) === "image" ? (
                                        <img src={referenceResource.url} alt={referenceResource.name} className="h-8 w-8 shrink-0 rounded-lg object-cover" />
                                    ) : (
                                        <FileIcon fileName={referenceResource.name} fileType={referenceResource.type} size={25} />
                                    )}
                                    <span className="min-w-0 flex-1 truncate text-xs" title={`Reference: ${referenceResource.name}`}>{referenceResource.name}</span>
                                    {onRemoveReference && <button type="button" onClick={onRemoveReference} className={`rounded-full p-1 cursor-pointer ${isDark ? "text-white/50 hover:bg-white/10 hover:text-white" : "text-black/50 hover:bg-black/10 hover:text-black"}`} aria-label="Remove document reference"><X className="h-3.5 w-3.5" /></button>}
                                </div>
                            )}
                            {attachedFiles.map((f) => (
                                <FilePreviewChip
                                    key={f.id}
                                    file={f}
                                    onRemove={() => removeFile(f.id)}
                                    onPreview={() => setPreviewFile({ name: f.file.name, url: f.preview, type: f.file.type })}
                                    isDark={isDark}
                                />
                            ))}
                        </div>
                    )}

                    <div className="flex items-end gap-2 px-3 sm:px-4 py-3">

                        {isRecording ? (
                            <>
                                <div className="flex-1 flex items-center h-10 overflow-hidden">
                                    <canvas
                                        ref={(el) => {
                                            canvasRef.current = el;
                                            if (el) el.width = el.offsetWidth;
                                        }}
                                        height={40}
                                        className="w-full h-full"
                                        style={{ display: "block" }}
                                    />
                                </div>

                                {/* Cancel */}
                                <button
                                    onClick={cancelRecording}
                                    className={`flex-shrink-0 flex items-center justify-center w-8 h-8 rounded-full transition-all cursor-pointer ${
                                        isDark
                                            ? "text-white/50 hover:text-white hover:bg-white/10"
                                            : "text-black/40 hover:text-black hover:bg-black/8"
                                    }`}
                                    title="Cancel"
                                >
                                    <X className="w-4 h-4" />
                                </button>

                                {/* Confirm / send */}
                                <button
                                    onClick={stopRecording}
                                    className="flex-shrink-0 flex items-center justify-center w-8 h-8 rounded-full border-2 border-blue-400 text-blue-400 hover:bg-blue-400/10 transition-all cursor-pointer"
                                    title="Done"
                                >
                                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                                        <path d="M20 6L9 17l-5-5" />
                                    </svg>
                                </button>
                            </>
                        ) : (
                            /* ── Normal input UI ── */
                            <>
                                <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                        <button
                                            type="button"
                                            disabled={isStreaming || isTranscribing}
                                            className={`flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-full transition-colors disabled:cursor-not-allowed disabled:opacity-30 ${isDark ? "text-white/55 hover:bg-white/10 hover:text-white" : "text-black/55 hover:bg-black/8 hover:text-black"}`}
                                            title="Open attachment options"
                                            aria-label="Open attachment options"
                                        >
                                            <Plus className="h-5 w-5" />
                                        </button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="start" side="top" sideOffset={12} className={`w-[min(24rem,calc(100vw-2rem))] rounded-2xl p-2.5 shadow-2xl ${isDark ? "border-white/8 bg-[#252525] text-white" : "border-black/8 bg-white text-black"}`}>
                                        <DropdownMenuItem
                                            onSelect={() => fileInputRef.current?.click()}
                                            className={`h-12 cursor-pointer gap-3 rounded-xl px-3 ${isDark ? "focus:bg-white/8" : "focus:bg-black/5"}`}
                                        >
                                            <Paperclip className="h-5 w-5 shrink-0" />
                                            <span className="font-medium">Add photos &amp; files</span>
                                            <span className={`ml-auto text-xs ${isDark ? "text-white/45" : "text-black/45"}`}>From computer</span>
                                        </DropdownMenuItem>
                                        <DropdownMenuItem
                                            onSelect={() => setResourcePickerOpen(true)}
                                            className={`h-12 cursor-pointer gap-3 rounded-xl px-3 ${isDark ? "focus:bg-white/8" : "focus:bg-black/5"}`}
                                        >
                                            <FolderOpen className="h-5 w-5 shrink-0" />
                                            <span className="font-medium">Add from resources</span>
                                            <span className={`ml-auto text-xs ${isDark ? "text-white/45" : "text-black/45"}`}>Browse your files</span>
                                        </DropdownMenuItem>
                                    </DropdownMenuContent>
                                </DropdownMenu>

                                <button
                                    onClick={startRecording}
                                    disabled={isStreaming || isTranscribing}
                                    className={`flex-shrink-0 p-2 rounded-full cursor-pointer transition-all disabled:opacity-30 disabled:cursor-not-allowed ${
                                        isTranscribing
                                            ? isDark ? "text-white/30 animate-pulse" : "text-black/30 animate-pulse"
                                            : isDark
                                            ? "text-white/40 hover:text-white/80 hover:bg-white/8"
                                            : "text-black/40 hover:text-black/80 hover:bg-black/8"
                                    }`}
                                    title={isTranscribing ? "Transcribing…" : "Voice input"}
                                >
                                    <Mic className="w-5 h-5" />
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
                                            className={`flex items-center justify-center w-8 h-8 rounded-full border cursor-pointer transition-all ${
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
                                            className={`flex items-center justify-center w-8 h-8 rounded-full transition-all ${
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
                            </>
                        )}
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

            {previewFile && (
                <FilePreviewModal
                    file={previewFile}
                    onClose={() => setPreviewFile(null)}
                    theme={theme}
                />
            )}
            {onSelectResource && (
                <ResourcePickerDialog
                    open={resourcePickerOpen}
                    onOpenChange={setResourcePickerOpen}
                    theme={theme}
                    onSelect={onSelectResource}
                />
            )}
        </div>
    );
}
