"use client";

import React, { useEffect, useState, useCallback } from "react";
import { X, Download, ExternalLink, FileSpreadsheet, Loader2, AlertCircle } from "lucide-react";
import { FileIcon, getFileCategory } from "@public/svg/icon";

export interface PreviewableFile {
    name: string;
    url?: string;
    type?: string;
}

interface FilePreviewModalProps {
    file: PreviewableFile | null;
    onClose: () => void;
    theme?: "light" | "dark";
}

export default function FilePreviewModal({
    file,
    onClose,
    theme = "dark",
}: FilePreviewModalProps) {
    const isDark = theme === "dark";
    const [csvData, setCsvData] = useState<{ headers: string[]; rows: string[][] } | null>(null);
    const [textContent, setTextContent] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [loadError, setLoadError] = useState<string | null>(null);

    const category = file ? getFileCategory(file.name, file.type) : "other";
    const ext = file?.name?.split(".").pop()?.toUpperCase() || category.toUpperCase();

    // Close on Escape key
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === "Escape") onClose();
        };
        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, [onClose]);

    // Fetch text or CSV content for inline preview
    const fetchContent = useCallback(async () => {
        if (!file?.url) return;

        if (category === "csv") {
            setIsLoading(true);
            setLoadError(null);
            try {
                const res = await fetch(file.url);
                if (!res.ok) throw new Error("Could not fetch CSV content");
                const text = await res.text();
                const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
                if (lines.length > 0) {
                    const headers = lines[0].split(",").map((h) => h.trim().replace(/^["']|["']$/g, ""));
                    const rows = lines.slice(1, 100).map((line) =>
                        line.split(",").map((c) => c.trim().replace(/^["']|["']$/g, ""))
                    );
                    setCsvData({ headers, rows });
                }
            } catch (err) {
                console.error("CSV preview fetch error:", err);
                setLoadError("Unable to load live CSV preview");
            } finally {
                setIsLoading(false);
            }
        } else if (category === "txt") {
            setIsLoading(true);
            setLoadError(null);
            try {
                const res = await fetch(file.url);
                if (!res.ok) throw new Error("Could not fetch text content");
                const text = await res.text();
                setTextContent(text);
            } catch (err) {
                console.error("Text preview fetch error:", err);
                setLoadError("Unable to load live text preview");
            } finally {
                setIsLoading(false);
            }
        }
    }, [file?.url, category]);

    useEffect(() => {
        setCsvData(null);
        setTextContent(null);
        setLoadError(null);
        if (file?.url) {
            fetchContent();
        }
    }, [file, fetchContent]);

    if (!file) return null;

    const handleDownload = async () => {
        if (!file.url) return;
        try {
            const res = await fetch(file.url);
            const blob = await res.blob();
            const blobUrl = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = blobUrl;
            a.download = file.name;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(blobUrl);
        } catch {
            // Fallback direct link
            const a = document.createElement("a");
            a.href = file.url;
            a.download = file.name;
            a.target = "_blank";
            a.click();
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
            {/* Backdrop click dismiss */}
            <div className="absolute inset-0" onClick={onClose} />

            {/* Modal Card */}
            <div
                className={`relative w-full max-w-5xl h-[85vh] flex flex-col rounded-2xl border shadow-2xl overflow-hidden z-10 transition-colors duration-300 ${
                    isDark ? "bg-[#141416] border-white/10 text-white" : "bg-white border-black/10 text-black"
                }`}
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div
                    className={`flex items-center justify-between px-5 py-3.5 border-b shrink-0 ${
                        isDark ? "border-white/10 bg-white/[0.02]" : "border-black/10 bg-black/[0.02]"
                    }`}
                >
                    <div className="flex items-center gap-3 min-w-0 mr-4">
                        <div className="shrink-0 flex items-center justify-center">
                            <FileIcon fileName={file.name} fileType={file.type} size={28} />
                        </div>
                        <div className="flex flex-col min-w-0">
                            <h3 className="text-sm font-semibold truncate leading-snug" title={file.name}>
                                {file.name}
                            </h3>
                            <span
                                className={`text-[10px] uppercase tracking-wider font-medium ${
                                    isDark ? "text-white/40" : "text-black/40"
                                }`}
                            >
                                {ext} Document
                            </span>
                        </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                        {file.url && (
                            <>
                                <button
                                    onClick={handleDownload}
                                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium cursor-pointer transition-all ${
                                        isDark
                                            ? "bg-white/10 hover:bg-white/20 text-white"
                                            : "bg-black/8 hover:bg-black/15 text-black"
                                    }`}
                                    title="Download file"
                                >
                                    <Download className="w-3.5 h-3.5" />
                                    <span>Download</span>
                                </button>

                                <a
                                    href={file.url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className={`p-1.5 rounded-lg cursor-pointer transition-all ${
                                        isDark
                                            ? "text-white/40 hover:text-white/90 hover:bg-white/10"
                                            : "text-black/40 hover:text-black/90 hover:bg-black/10"
                                    }`}
                                    title="Open raw file in new tab"
                                >
                                    <ExternalLink className="w-4 h-4" />
                                </a>
                            </>
                        )}

                        <button
                            onClick={onClose}
                            className={`p-1.5 rounded-lg cursor-pointer transition-all ${
                                isDark
                                    ? "text-white/40 hover:text-white/90 hover:bg-white/10"
                                    : "text-black/40 hover:text-black/90 hover:bg-black/10"
                            }`}
                            title="Close preview (Esc)"
                        >
                            <X className="w-4 h-4" />
                        </button>
                    </div>
                </div>

                {/* Content Viewport */}
                <div className="flex-1 overflow-auto p-4 flex items-center justify-center relative">
                    {!file.url ? (
                        <div className="flex flex-col items-center gap-2 text-center p-6 text-white/50">
                            <AlertCircle className="w-8 h-8 text-amber-400" />
                            <p className="text-sm font-medium">No live URL available for this file.</p>
                            <p className="text-xs text-white/40">File was processed locally for this session.</p>
                        </div>
                    ) : isLoading ? (
                        <div className="flex flex-col items-center gap-2 text-white/60">
                            <Loader2 className="w-8 h-8 animate-spin text-white/40" />
                            <span className="text-xs">Loading document preview…</span>
                        </div>
                    ) : category === "image" ? (
                        <div className="w-full h-full flex items-center justify-center p-2">
                            <img
                                src={file.url}
                                alt={file.name}
                                className="max-w-full max-h-full object-contain rounded-lg shadow-xl"
                            />
                        </div>
                    ) : category === "pdf" ? (
                        <iframe
                            src={`${file.url}#toolbar=1`}
                            className="w-full h-full rounded-xl border border-white/5 bg-[#1a1a1d]"
                            title={file.name}
                        />
                    ) : category === "csv" && csvData ? (
                        <div className="w-full h-full overflow-auto rounded-xl border border-white/10">
                            <table className="w-full text-left text-xs border-collapse">
                                <thead className={isDark ? "bg-white/10 sticky top-0" : "bg-black/10 sticky top-0"}>
                                    <tr>
                                        {csvData.headers.map((h, idx) => (
                                            <th key={idx} className="px-3 py-2 font-semibold border-b border-white/10">
                                                {h}
                                            </th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody>
                                    {csvData.rows.map((row, rIdx) => (
                                        <tr
                                            key={rIdx}
                                            className={`border-b transition-colors ${
                                                isDark
                                                    ? "border-white/5 hover:bg-white/[0.04] even:bg-white/[0.02]"
                                                    : "border-black/5 hover:bg-black/[0.04] even:bg-black/[0.02]"
                                            }`}
                                        >
                                            {row.map((cell, cIdx) => (
                                                <td key={cIdx} className="px-3 py-2 whitespace-nowrap">
                                                    {cell}
                                                </td>
                                            ))}
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    ) : category === "txt" && textContent ? (
                        <div className="w-full h-full overflow-auto p-4 rounded-xl border border-white/10 font-mono text-xs whitespace-pre-wrap leading-relaxed">
                            {textContent}
                        </div>
                    ) : category === "doc" ? (
                        <iframe
                            src={`https://docs.google.com/viewer?url=${encodeURIComponent(file.url)}&embedded=true`}
                            className="w-full h-full rounded-xl border border-white/5 bg-[#1a1a1d]"
                            title={file.name}
                        />
                    ) : loadError ? (
                        <div className="flex flex-col items-center gap-3 text-center p-6">
                            <FileSpreadsheet className="w-10 h-10 text-white/30" />
                            <p className="text-sm font-medium text-white/80">{loadError}</p>
                            <button
                                onClick={handleDownload}
                                className="px-4 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-medium cursor-pointer transition-all flex items-center gap-2"
                            >
                                <Download className="w-3.5 h-3.5" />
                                <span>Download to View</span>
                            </button>
                        </div>
                    ) : (
                        <iframe
                            src={file.url}
                            className="w-full h-full rounded-xl border border-white/5 bg-[#1a1a1d]"
                            title={file.name}
                        />
                    )}
                </div>
            </div>
        </div>
    );
}
