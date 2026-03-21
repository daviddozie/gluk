const MODEL = "sentence-transformers/all-MiniLM-L6-v2";

async function withTimeout<T>(promise: Promise<T>, ms = 15000): Promise<T> {
    const timeout = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error(`Request timed out after ${ms}ms`)), ms)
    );
    return Promise.race([promise, timeout]);
}

export async function embedText(text: string, retries = 2): Promise<number[] | null> {
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
                const body = await response.text();
                // 503 = model loading, 500 = transient HuggingFace error — log and retry
                console.error(`HuggingFace API error: ${response.status} ${body}`);
                if (attempt === retries) return null; // soft fail — caller decides what to do
                await new Promise((r) => setTimeout(r, 3000 * (attempt + 1)));
                continue;
            }

            const result = await response.json() as number[] | number[][];

            // Flatten if nested array
            if (Array.isArray(result[0])) {
                return (result as number[][])[0];
            }
            return result as number[];

        } catch (err) {
            console.error(`Embedding attempt ${attempt + 1} failed:`, err);
            if (attempt === retries) return null; // soft fail
            await new Promise((r) => setTimeout(r, 2000));
        }
    }
    return null;
}

export async function embedBatch(texts: string[]): Promise<(number[] | null)[]> {
    const embeddings: (number[] | null)[] = [];
    for (const text of texts) {
        const embedding = await embedText(text);
        embeddings.push(embedding);
    }
    return embeddings;
}