/** Split extracted text into semantically coherent, overlapping chunks for embeddings. */
export function chunkText(
    text: string,
    targetChunkSize = 600,
    overlap = 80
): string[] {
    const paragraphs = text
        .split(/\n{2,}/)
        .map((paragraph) => paragraph.replace(/\s+/g, " ").trim())
        .filter((paragraph) => paragraph.length > 20);

    const chunks: string[] = [];
    let buffer: string[] = [];
    let bufferWordCount = 0;

    const flush = () => {
        if (buffer.length === 0) return;
        const chunk = buffer.join(" ").trim();
        if (chunk.length > 30) chunks.push(chunk);
        const words = chunk.split(/\s+/);
        buffer = [words.slice(-overlap).join(" ")];
        bufferWordCount = Math.min(overlap, words.length);
    };

    for (const paragraph of paragraphs) {
        const words = paragraph.split(/\s+/);

        if (words.length > targetChunkSize * 1.5) {
            const sentences = paragraph.match(/[^.!?]+[.!?]+/g) ?? [paragraph];
            for (const sentence of sentences) {
                const sentenceWords = sentence.trim().split(/\s+/);
                if (bufferWordCount + sentenceWords.length > targetChunkSize) flush();
                buffer.push(sentence.trim());
                bufferWordCount += sentenceWords.length;
            }
        } else {
            if (bufferWordCount + words.length > targetChunkSize) flush();
            buffer.push(paragraph);
            bufferWordCount += words.length;
        }
    }

    flush();
    return chunks;
}
