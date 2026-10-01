"use client";

import React, { useEffect, useState, useCallback } from "react";
import { X, Download, FileSpreadsheet, Loader2, AlertCircle } from "lucide-react";
import { FileIcon, getFileCategory } from "@public/svg/icon";

export interface DocumentViewerFile {
    name: string;
    url?: string;
    type?: string;
}

interface DocumentViewerProps {
    file: DocumentViewerFile;
    onClose: () => void;
    theme?: "light" | "dark";
}

export default function DocumentViewer({
    file,
    onClose,
    theme = "dark",
}: DocumentViewerProps) {
    const isDark = theme === "dark";
    const [csvData, setCsvData] = useState<{ headers: string[]; rows: string[][] } | null>(null);
    const [textContent, setTextContent] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [loadError, setLoadError] = useState<string | null>(null);

    const category = getFileCategory(file.name, file.type);
    const ext = file.name.split(".").pop()?.toUpperCase() || category.toUpperCase();

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
        if (!file.url) return;

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
                    const rows = lines.slice(1, 200).map((line) =>
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
    }, [file.url, category]);

    useEffect(() => {
        setCsvData(null);
        setTextContent(null);
        setLoadError(null);
        if (file.url) {
            fetchContent();
        }
    }, [file, fetchContent]);

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
            const a = document.createElement("a");
            a.href = file.url;
            a.download = file.name;
            a.click();
        }
    };

    return (
        <div className="flex flex-col flex-1 h-full w-full min-h-0 bg-background text-foreground transition-colors duration-300">
            {/* Top Navigation Bar — matches ChatGPT canvas header */}
            <div
                className={`flex items-center justify-between h-14 px-4 border-b shrink-0 transition-colors duration-300 ${
                    isDark ? "border-white/10 bg-[#171717]" : "border-black/10 bg-[#f7f7f8]"
                }`}
            >
                {/* Left: Close button + Breadcrumb */}
                <div className="flex items-center gap-3 min-w-0 mr-4">
                    <button
                        onClick={onClose}
                        className={`p-2 rounded-lg cursor-pointer transition-colors shrink-0 ${
                            isDark
                                ? "text-white/70 hover:text-white hover:bg-white/10"
                                : "text-black/70 hover:text-black hover:bg-black/10"
                        }`}
                        title="Close document (Esc)"
                        aria-label="Close document"
                    >
                        <X className="w-4 h-4" />
                    </button>

                    <div className="flex items-center gap-2 min-w-0 text-sm">
                        <span className={`text-xs ${isDark ? "text-white/40" : "text-black/40"}`}>
                            Documents
                        </span>
                        <span className={`text-xs ${isDark ? "text-white/20" : "text-black/20"}`}>
                            /
                        </span>
                        <div className="flex items-center gap-2 min-w-0">
                            <FileIcon fileName={file.name} fileType={file.type} size={18} />
                            <span className="font-medium truncate max-w-xs sm:max-w-md" title={file.name}>
                                {file.name}
                            </span>
                        </div>
                    </div>
                </div>

                {/* Right: Actions */}
                <div className="flex items-center gap-2 shrink-0">
                    <span
                        className={`hidden sm:inline-flex text-[10px] uppercase tracking-wider font-semibold px-2 py-0.5 rounded border ${
                            isDark
                                ? "border-white/10 text-white/50 bg-white/5"
                                : "border-black/10 text-black/50 bg-black/5"
                        }`}
                    >
                        {ext}
                    </span>

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

                        </>
                    )}
                </div>
            </div>

            {/* Document Body Area — takes the full conversation interface space */}
            <div className="flex-1 w-full h-full min-h-0 overflow-hidden relative flex items-center justify-center">
                {!file.url ? (
                    <div className="flex flex-col items-center gap-2 text-center p-6 text-muted-foreground">
                        <AlertCircle className="w-8 h-8 text-amber-400" />
                        <p className="text-sm font-medium">No live URL available for this file.</p>
                        <p className="text-xs opacity-60">File was processed locally for this session.</p>
                    </div>
                ) : isLoading ? (
                    <div className="flex flex-col items-center gap-2 text-muted-foreground">
                        <Loader2 className="w-8 h-8 animate-spin opacity-50" />
                        <span className="text-xs">Loading document…</span>
                    </div>
                ) : category === "image" ? (
                    <div className="w-full h-full flex items-center justify-center p-4 sm:p-8 overflow-auto">
                        <img
                            src={file.url}
                            alt={file.name}
                            className="max-w-full max-h-full object-contain rounded-xl shadow-2xl"
                        />
                    </div>
                ) : category === "pdf" ? (
                    <object
                        data={`${file.url}#toolbar=0&navpanes=0&scrollbar=0`}
                        type="application/pdf"
                        className="w-full h-full border-0 bg-[#212121]"
                        title={file.name}
                    >
                        <iframe
                            src={`${file.url}#toolbar=0&navpanes=0&scrollbar=0`}
                            className="w-full h-full border-0 bg-[#212121]"
                            title={file.name}
                        />
                    </object>
                ) : category === "csv" && csvData ? (
                    <div className="w-full h-full overflow-auto p-4 sm:p-6">
                        <div className={`rounded-xl border overflow-hidden shadow-sm ${
                            isDark ? "border-white/10" : "border-black/10"
                        }`}>
                            <table className="w-full text-left text-xs border-collapse">
                                <thead className={isDark ? "bg-white/10 sticky top-0" : "bg-black/8 sticky top-0"}>
                                    <tr>
                                        {csvData.headers.map((h, idx) => (
                                            <th key={idx} className="px-3.5 py-2.5 font-semibold border-b border-border/60">
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
                                                    ? "border-white/5 hover:bg-white/4 even:bg-white/2"
                                                    : "border-black/5 hover:bg-black/4 even:bg-black/2"
                                            }`}
                                        >
                                            {row.map((cell, cIdx) => (
                                                <td key={cIdx} className="px-3.5 py-2.5 whitespace-nowrap">
                                                    {cell}
                                                </td>
                                            ))}
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                ) : category === "txt" && textContent ? (
                    <div className="w-full h-full overflow-auto p-6 sm:p-10 max-w-4xl mx-auto">
                        <div className={`p-6 rounded-2xl border font-mono text-xs whitespace-pre-wrap leading-relaxed shadow-sm ${
                            isDark ? "border-white/10 bg-white/[0.02]" : "border-black/10 bg-black/[0.02]"
                        }`}>
                            {textContent}
                        </div>
                    </div>
                ) : category === "doc" ? (
                    <iframe
                        src={`https://docs.google.com/viewer?url=${encodeURIComponent(file.url)}&embedded=true`}
                        className="w-full h-full border-0 bg-[#212121]"
                        title={file.name}
                    />
                ) : loadError ? (
                    <div className="flex flex-col items-center gap-3 text-center p-6">
                        <FileSpreadsheet className="w-10 h-10 opacity-30" />
                        <p className="text-sm font-medium">{loadError}</p>
                        <button
                            onClick={handleDownload}
                            className="px-4 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-xs font-medium cursor-pointer transition-all flex items-center gap-2"
                        >
                            <Download className="w-3.5 h-3.5" />
                            <span>Download to View</span>
                        </button>
                    </div>
                ) : (
                    <iframe
                        src={file.url}
                        className="w-full h-full border-0 bg-[#212121]"
                        title={file.name}
                    />
                )}
            </div>
        </div>
    );
}
