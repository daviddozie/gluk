const MODEL = "sentence-transformers/all-MiniLM-L6-v2";

async function withTimeout<T>(promise: Promise<T>, ms = 15000): Promise<T> {
    const timeout = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error(`Request timed out after ${ms}ms`)), ms)
    );
    return Promise.race([promise, timeout]);
}

export async function embedText(text: string, retries = 2): Promise<number[]> {
    for (let attempt = 0; attempt <= retries; attempt++) {
        try {
            const response = await withTimeout(
                fetch(`https://router.huggingface.co/hf-inference/models/${MODEL}/pipeline/feature-extraction`, {
                    method: "POST",
                    headers: {
                        "Authorization": `Bearer ${process.env.HUGGINGFACE_API_KEY}`,
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify({ inputs: text }),
                }),
                15000
            );

            if (!response.ok) {
                throw new Error(`HuggingFace API error: ${response.status} ${await response.text()}`);
            }

            const result = await response.json() as number[] | number[][];

            // Flatten if nested array
            if (Array.isArray(result[0])) {
                return (result as number[][])[0];
            }
            return result as number[];

        } catch (err) {
            console.error(`Embedding attempt ${attempt + 1} failed:`, err);
            if (attempt === retries) throw err;
            await new Promise((r) => setTimeout(r, 2000));
        }
    }
    throw new Error("Embedding failed after all retries");
}

export async function embedBatch(texts: string[]): Promise<number[][]> {
    const embeddings: number[][] = [];
    for (const text of texts) {
        const embedding = await embedText(text);
        embeddings.push(embedding);
    }
    return embeddings;
}