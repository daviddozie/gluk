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
    const indexName = process.env.PINECONE_INDEX ?? "gluk";
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

    const vectors = chunks.map((chunk, i) => ({
        id: chunk.id,
        values: embeddings[i],
        metadata: {
            text: chunk.text,
            fileName: chunk.fileName,
            fileType: chunk.fileType,
            userEmail: chunk.userEmail,
            conversationId: chunk.conversationId,
            chunkIndex: chunk.chunkIndex,
        },
    }));

    // Pinecone recommends batches of 100
    const batchSize = 100;
    for (let i = 0; i < vectors.length; i += batchSize) {
        await index.upsert(vectors.slice(i, i + batchSize) as any);
    }
}

// Search for relevant chunks
export async function searchSimilarChunks(
    query: string,
    userEmail: string,
    conversationId: string,
    topK = 5
): Promise<{ text: string; fileName: string; score: number }[]> {
    const index = getIndex();
    const queryEmbedding = await embedText(query);

    const results = await index.query({
        vector: queryEmbedding,
        topK,
        includeMetadata: true,
        filter: {
            userEmail: { $eq: userEmail },
            conversationId: { $eq: conversationId },
        },
    });

    return (results.matches ?? [])
        .filter((m) => m.score && m.score > 0.4)
        .map((m) => ({
            text: m.metadata?.text as string,
            fileName: m.metadata?.fileName as string,
            score: m.score ?? 0,
        }));
}

// Delete all chunks for a conversation
export async function deleteConversationChunks(
    userEmail: string,
    conversationId: string
) {
    const index = getIndex();
    await index.deleteMany({
        filter: {
            userEmail: { $eq: userEmail },
            conversationId: { $eq: conversationId },
        },
    });
}