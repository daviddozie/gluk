import { Pinecone } from "@pinecone-database/pinecone";
import { embedText, embedBatch } from "./embeddings";

let _pinecone: Pinecone | null = null;

function getPinecone() {
    if (!_pinecone) {
        _pinecone = new Pinecone({
            apiKey: process.env.PINECONE_API_KEY!,
        });
    }
    return _pinecone;
}

function getIndex() {
    const indexName = process.env.PINECONE_INDEX ?? "gluk-123";
    const host = process.env.PINECONE_HOST;
    if (host) {
        return getPinecone().index(indexName, host);
    }
    return getPinecone().index(indexName);
}

export interface DocumentChunk {
    id: string;
    text: string;
    fileName: string;
    fileType: string;
    userEmail: string;
    conversationId: string;
    chunkIndex: number;
}

// Store document chunks in Pinecone
export async function storeDocumentChunks(chunks: DocumentChunk[]) {
    const index = getIndex();
    const texts = chunks.map((c) => c.text);
    const embeddings = await embedBatch(texts);

    const rawMapped = chunks.map((chunk, i) => {
        const values = embeddings[i];
        if (values == null) return null;
        return {
            id: chunk.id,
            values,
            metadata: {
                text: chunk.text,
                fileName: chunk.fileName,
                fileType: chunk.fileType,
                userEmail: chunk.userEmail,
                conversationId: chunk.conversationId,
                chunkIndex: chunk.chunkIndex,
            },
        };
    });

    const vectors = rawMapped.filter((v): v is NonNullable<typeof v> => v != null);

    if (vectors.length === 0) {
        throw new Error("No valid embeddings returned — all chunks failed to embed");
    }

    const sanitizedVectors = vectors.map((v) => ({
        ...v,
        values: Array.from(v.values) as number[],
    }));

    const batchSize = 100;
    for (let i = 0; i < sanitizedVectors.length; i += batchSize) {
        await index.upsert({ records: sanitizedVectors.slice(i, i + batchSize) });
    }
}

export async function searchSimilarChunks(
    query: string,
    conversationId: string,
    topK = 6
): Promise<{ text: string; fileName: string; score: number }[]> {
    const index = getIndex();
    const queryEmbedding = await embedText(query);

    if (!queryEmbedding) return [];

    const fetchK = Math.min(topK * 3, 20);

    const results = await index.query({
        vector: queryEmbedding,
        topK: fetchK,
        includeMetadata: true,
        filter: {
            conversationId: { $eq: conversationId },
        },
    });

    const candidates = (results.matches ?? [])
        .filter((m) => m.score && m.score > 0.1)
        .map((m) => ({
            text: m.metadata?.text as string,
            fileName: m.metadata?.fileName as string,
            vectorScore: m.score ?? 0,
            values: m.values ?? [],
        }));

    if (candidates.length === 0) return [];

    const queryTerms = new Set(
        query.toLowerCase().split(/\W+/).filter((t) => t.length > 2)
    );

    const hybrid = candidates.map((c) => {
        const docTerms = c.text.toLowerCase().split(/\W+/);
        const overlap = docTerms.filter((t) => queryTerms.has(t)).length;
        const keywordScore = Math.min(overlap / Math.max(queryTerms.size, 1), 1);

        const score = c.vectorScore * 0.7 + keywordScore * 0.3;
        return { ...c, score };
    });

    const selected = mmrSelect(hybrid, topK);

    return selected.map((c) => ({
        text: c.text,
        fileName: c.fileName,
        score: parseFloat(c.score.toFixed(4)),
    }));
}

function mmrSelect<T extends { text: string; score: number }>(
    candidates: T[],
    k: number,
    lambda = 0.6
): T[] {
    if (candidates.length <= k) return candidates;

    const selected: T[] = [];
    const remaining = [...candidates];

    while (selected.length < k && remaining.length > 0) {
        let bestIdx = 0;
        let bestScore = -Infinity;

        for (let i = 0; i < remaining.length; i++) {
            const relevance = remaining[i].score;

            const maxSim =
                selected.length === 0
                    ? 0
                    : Math.max(
                        ...selected.map((s) => jaccardSim(remaining[i].text, s.text))
                    );

            const mmrScore = lambda * relevance - (1 - lambda) * maxSim;
            if (mmrScore > bestScore) {
                bestScore = mmrScore;
                bestIdx = i;
            }
        }

        selected.push(remaining[bestIdx]);
        remaining.splice(bestIdx, 1);
    }

    return selected;
}

function jaccardSim(a: string, b: string): number {
    const setA = new Set(a.toLowerCase().split(/\W+/).filter((t) => t.length > 2));
    const setB = new Set(b.toLowerCase().split(/\W+/).filter((t) => t.length > 2));
    if (setA.size === 0 && setB.size === 0) return 1;
    let intersection = 0;
    for (const t of setA) if (setB.has(t)) intersection++;
    const union = setA.size + setB.size - intersection;
    return union === 0 ? 0 : intersection / union;
}

// Delete all chunks for a conversation
export async function deleteConversationChunks(
    userEmail: string,
    conversationId: string
) {
    const index = getIndex();
    await index.deleteMany({
        filter: {
            conversationId: { $eq: conversationId },
        },
    });
}