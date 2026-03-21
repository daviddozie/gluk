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

/**
 * Semantic-aware chunker: splits on paragraph/sentence boundaries first,
 * then falls back to word-count when paragraphs are too large.
 * Overlap preserves context across chunk boundaries.
 */
function chunkText(
    text: string,
    targetChunkSize = 600,   // target words per chunk
    overlap = 80             // words to repeat across boundary
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
            // Paragraph is very long — split it at sentence boundaries
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
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const pdfParse = require("pdf-parse");
        const parsed = await pdfParse(buffer);
        text = parsed.text;

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
