import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { NextRequest } from "next/server";

export const runtime = "nodejs";

function stripMarkdown(text: string): string {
    return text
        .replace(/```[\s\S]*?```/g, "")
        .replace(/`[^`]+`/g, "")
        .replace(/#{1,6}\s+/g, "")
        .replace(/\*\*([^*]+)\*\*/g, "$1")
        .replace(/\*([^*]+)\*/g, "$1")
        .replace(/~~([^~]+)~~/g, "$1")
        .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
        .replace(/^[-*+]\s+/gm, "")
        .replace(/^\d+\.\s+/gm, "")
        .replace(/^>\s+/gm, "")
        .replace(/\n{2,}/g, " ")
        .trim();
}

export interface WordTimestamp {
    word: string;
    start: number;
    end: number;
}

function buildWordTimestamps(text: string): WordTimestamp[] {
    const rawWords = text.split(/\s+/).filter(Boolean);
    const AVG_CHARS_PER_SEC = 14;
    let cursor = 0;
    return rawWords.map((word) => {
        const duration = Math.max(0.15, word.replace(/[^a-zA-Z]/g, "").length / AVG_CHARS_PER_SEC);
        const start = cursor;
        const end = cursor + duration;
        cursor = end + 0.05;
        return { word, start, end };
    });
}

export async function POST(req: NextRequest) {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
        return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { text } = await req.json();
    if (!text?.trim()) {
        return Response.json({ error: "text is required" }, { status: 400 });
    }

    const apiKey = process.env.DEEPGRAM_API_KEY;
    if (!apiKey) {
        return Response.json({ error: "DEEPGRAM_API_KEY not configured" }, { status: 500 });
    }

    const cleanText = stripMarkdown(text).slice(0, 2000);
    const voice = "aura-2-odysseus-en";

    const deepgramRes = await fetch(
        `https://api.deepgram.com/v1/speak?model=${voice}&encoding=mp3`,
        {
            method: "POST",
            headers: {
                "Authorization": `Token ${apiKey}`,
                "Content-Type": "application/json",
                "Accept": "audio/mpeg",
            },
            body: JSON.stringify({ text: cleanText }),
        }
    );

    if (!deepgramRes.ok) {
        const err = await deepgramRes.text();
        console.error("Deepgram TTS error:", deepgramRes.status, err);
        return Response.json({ error: "TTS request failed" }, { status: 500 });
    }

    // Build word timestamps and send as header before streaming audio
    const words = buildWordTimestamps(cleanText);
    const wordsHeader = Buffer.from(JSON.stringify(words)).toString("base64");

    // Pipe Deepgram audio stream directly to client — no buffering
    return new Response(deepgramRes.body, {
        status: 200,
        headers: {
            "Content-Type": "audio/mpeg",
            "Transfer-Encoding": "chunked",
            "Cache-Control": "no-cache",
            "X-Content-Type-Options": "nosniff",
            "X-Word-Timestamps": wordsHeader,
            "Access-Control-Expose-Headers": "X-Word-Timestamps",
        },
    });
}