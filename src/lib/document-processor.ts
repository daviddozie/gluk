import { chunkText } from "@/lib/text-chunking";

export interface ProcessedDocument {
    text: string;
    name: string;
    type: string;
    chunks: string[];
    metadata: {
        totalChunks: number;
        totalChars: number;
        avgChunkChars: number;
    };
}


export async function processDocument(
    buffer: Buffer,
    fileName: string,
    mimeType: string
): Promise<ProcessedDocument> {
    let text = "";

    if (mimeType === "application/pdf") {
        if (typeof (globalThis as Record<string, unknown>).DOMMatrix === "undefined") {
            (globalThis as Record<string, unknown>).DOMMatrix = class DOMMatrix {
                constructor() { }
            };
        }

        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const { PDFParse } = require("pdf-parse") as {
            PDFParse: new (options: { data: Buffer }) => { getText: () => Promise<{ text: string }> };
        };
        const parser = new PDFParse({ data: buffer });
        const result = await parser.getText();
        text = result.text;
    } else if (mimeType === "text/csv" || fileName.endsWith(".csv")) {
        const Papa = (await import("papaparse")).default;
        const csv = buffer.toString("utf-8");
        const result = Papa.parse(csv, { header: true, skipEmptyLines: true });
        text = result.data
            .map((row: unknown) => {
                const r = row as Record<string, unknown>;
                return Object.entries(r)
                    .map(([k, v]) => `${k}: ${v}`)
                    .join(", ");
            })
            .join("\n");

    } else if (
        mimeType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
        fileName.endsWith(".docx")
    ) {
        const mammoth = await import("mammoth");
        const result = await mammoth.extractRawText({ buffer });
        text = result.value;

    } else if (mimeType === "text/plain" || fileName.endsWith(".txt") || fileName.endsWith(".md")) {
        text = buffer.toString("utf-8");

    } else {
        throw new Error(`Unsupported file type: ${mimeType}`);
    }

    // Normalise whitespace while preserving paragraph breaks
    text = text.replace(/[ \t]+/g, " ").replace(/\r\n/g, "\n").trim();
    if (!text.includes("\n\n")) {
        text = text.replace(/\n/g, "\n\n");
    }
    const chunks = chunkText(text);

    return {
        text,
        name: fileName,
        type: mimeType,
        chunks,
        metadata: {
            totalChunks: chunks.length,
            totalChars: text.length,
            avgChunkChars: chunks.length ? Math.round(text.length / chunks.length) : 0,
        },
    };
}

export const REFERENCE_CONTEXT_MAX_CHARS = 24_000;
const REFERENCE_QUERY_STOP_WORDS = new Set([
    "what", "which", "where", "when", "who", "why", "how", "this", "that",
    "document", "file", "about", "tell", "please", "could", "would", "does",
    "the", "and", "for", "with", "from"
]);

export function selectReferenceContext(
    chunks: string[],
    query: string,
    maxChars = REFERENCE_CONTEXT_MAX_CHARS
): string {
    const queryTerms = new Set(
        (query.toLowerCase().match(/[a-z0-9]{3,}/g) ?? [])
            .filter((term) => !REFERENCE_QUERY_STOP_WORDS.has(term))
    );
    const ranked = chunks.map((text, index) => {
        const terms = text.toLowerCase().match(/[a-z0-9]{3,}/g) ?? [];
        let score = 0;
        for (const term of terms) if (queryTerms.has(term)) score++;
        return { text, index, score };
    });
    const relevant = queryTerms.size === 0 || ranked.every((chunk) => chunk.score === 0)
        ? ranked.slice(0, 10)
        : [...ranked].sort((a, b) => b.score - a.score || a.index - b.index).slice(0, 10);
    if (ranked.length > 0 && !relevant.some((chunk) => chunk.index === 0)) relevant.push(ranked[0]);

    let remaining = maxChars;
    return relevant
        .sort((a, b) => a.index - b.index)
        .map(({ text }) => {
            if (remaining <= 0) return "";
            const excerpt = text.slice(0, remaining);
            remaining -= excerpt.length;
            return excerpt;
        })
        .filter(Boolean)
        .join("\n\n");
}

export async function fetchOwnedResourceBuffer(url: string): Promise<Buffer> {
    const parsed = new URL(url);
    const isCloudinary = parsed.protocol === "https:" && parsed.hostname === "res.cloudinary.com";
    const isVercelBlob = parsed.protocol === "https:" && parsed.hostname.endsWith(".public.blob.vercel-storage.com");
    if (!isCloudinary && !isVercelBlob) throw new Error("Unsupported resource storage host");

    const response = await fetch(url, { cache: "no-store", redirect: "error", signal: AbortSignal.timeout(20_000) });
    if (!response.ok || !response.body) throw new Error("Resource download failed");
    const maxBytes = 15 * 1024 * 1024;
    const declaredLength = Number(response.headers.get("content-length") ?? 0);
    if (declaredLength > maxBytes) throw new Error("Resource is larger than the 15 MB chat limit");

    const reader = response.body.getReader();
    const parts: Uint8Array[] = [];
    let byteLength = 0;
    while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        byteLength += value.byteLength;
        if (byteLength > maxBytes) {
            await reader.cancel();
            throw new Error("Resource is larger than the 15 MB chat limit");
        }
        parts.push(value);
    }
    return Buffer.concat(parts.map((part) => Buffer.from(part)));
}

const parsedDocumentCache = new Map<string, { doc: ProcessedDocument; timestamp: number }>();
const CACHE_TTL_MS = 15 * 60 * 1000;

export async function getOrProcessResourceDocument(
    url: string,
    fileName: string,
    mimeType: string
): Promise<ProcessedDocument> {
    const cached = parsedDocumentCache.get(url);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
        return cached.doc;
    }
    const buffer = await fetchOwnedResourceBuffer(url);
    const doc = await processDocument(buffer, fileName, mimeType);
    parsedDocumentCache.set(url, { doc, timestamp: Date.now() });
    if (parsedDocumentCache.size > 50) {
        const oldestKey = parsedDocumentCache.keys().next().value;
        if (oldestKey) parsedDocumentCache.delete(oldestKey);
    }
    return doc;
}

