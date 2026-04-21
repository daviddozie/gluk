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


function chunkText(
    text: string,
    targetChunkSize = 600,
    overlap = 80
): string[] {
    // First split into natural paragraphs
    const paragraphs = text
        .split(/\n{2,}/)
        .map((p) => p.replace(/\s+/g, " ").trim())
        .filter((p) => p.length > 20);

    const chunks: string[] = [];
    let buffer: string[] = [];
    let bufferWordCount = 0;

    const flush = () => {
        if (buffer.length === 0) return;
        const chunk = buffer.join(" ").trim();
        if (chunk.length > 30) chunks.push(chunk);
        // Keep overlap words from the end
        const allWords = chunk.split(/\s+/);
        buffer = [allWords.slice(-overlap).join(" ")];
        bufferWordCount = Math.min(overlap, allWords.length);
    };

    for (const para of paragraphs) {
        const words = para.split(/\s+/);

        if (words.length > targetChunkSize * 1.5) {
            const sentences = para.match(/[^.!?]+[.!?]+/g) ?? [para];
            for (const sentence of sentences) {
                const sentWords = sentence.trim().split(/\s+/);
                if (bufferWordCount + sentWords.length > targetChunkSize) {
                    flush();
                }
                buffer.push(sentence.trim());
                bufferWordCount += sentWords.length;
            }
        } else {
            if (bufferWordCount + words.length > targetChunkSize) {
                flush();
            }
            buffer.push(para);
            bufferWordCount += words.length;
        }
    }

    flush();
    return chunks;
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