const MODEL = "voyage-3"; // Anthropic's embedding model via Voyage AI

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
                fetch("https://api.voyageai.com/v1/embeddings", {
                    method: "POST",
                    headers: {
                        "Authorization": `Bearer ${process.env.VOYAGE_API_KEY}`,
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify({ input: [text], model: MODEL }),
                }),
                15000
            );

            if (!response.ok) {
                const body = await response.text();
                console.error(`Voyage API error: ${response.status} ${body}`);
                if (attempt === retries) return null;
                await new Promise((r) => setTimeout(r, 3000 * (attempt + 1)));
                continue;
            }

            const result = await response.json() as { data: { embedding: number[] }[] };
            return result.data[0].embedding;

        } catch (err) {
            console.error(`Embedding attempt ${attempt + 1} failed:`, err);
            if (attempt === retries) return null;
            await new Promise((r) => setTimeout(r, 2000));
        }
    }
    return null;
}

export async function embedBatch(texts: string[]): Promise<(number[] | null)[]> {
    // Voyage supports batching natively — send all texts in one request
    try {
        const response = await withTimeout(
            fetch("https://api.voyageai.com/v1/embeddings", {
                method: "POST",
                headers: {
                    "Authorization": `Bearer ${process.env.VOYAGE_API_KEY}`,
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({ input: texts, model: MODEL }),
            }),
            15000
        );

        if (!response.ok) {
            const body = await response.text();
            console.error(`Voyage batch API error: ${response.status} ${body}`);
            // Fall back to one-by-one
            return Promise.all(texts.map((t) => embedText(t)));
        }

        const result = await response.json() as { data: { embedding: number[] }[] };
        return result.data.map((d) => Array.isArray(d.embedding[0]) ? d.embedding[0] : d.embedding);

    } catch (err) {
        console.error("Voyage batch failed, falling back:", err);
        return Promise.all(texts.map((t) => embedText(t)));
    }
}