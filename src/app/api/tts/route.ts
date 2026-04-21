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

let cachedVoiceId: string | null = null;

async function getVoiceId(apiKey: string): Promise<string> {
    if (cachedVoiceId) return cachedVoiceId;

    try {
        const res = await fetch("https://api.elevenlabs.io/v1/voices", {
            headers: { "xi-api-key": apiKey },
        });
        if (res.ok) {
            const data = await res.json() as { voices: { voice_id: string; name: string }[] };
            if (data.voices?.length > 0) {
                cachedVoiceId = data.voices[0].voice_id;
                console.log("[tts] using voice:", data.voices[0].name, cachedVoiceId);
                return cachedVoiceId;
            }
        }
    } catch {
        console.warn("[tts] could not fetch voices, using fallback");
    }

    return "JBFqnCBsd6RMkjVDRTpX";
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

    const apiKey = process.env.ELEVENLABS_API_KEY;
    if (!apiKey) {
        return Response.json({ error: "ELEVENLABS_API_KEY not configured" }, { status: 500 });
    }

    const cleanText = stripMarkdown(text).slice(0, 2500);
    const VOICE_ID = await getVoiceId(apiKey);

    const elevenRes = await fetch(
        `https://api.elevenlabs.io/v1/text-to-speech/${VOICE_ID}/stream`,
        {
            method: "POST",
            headers: {
                "xi-api-key": apiKey,
                "Content-Type": "application/json",
                Accept: "audio/mpeg",
            },
            body: JSON.stringify({
                text: cleanText,
                model_id: "eleven_flash_v2_5",
                voice_settings: {
                    stability: 0.5,
                    similarity_boost: 0.75,
                },
            }),
        }
    );

    if (!elevenRes.ok) {
        const err = await elevenRes.text();
        console.error("ElevenLabs TTS error:", elevenRes.status, err);
        return Response.json({ error: "TTS request failed" }, { status: 500 });
    }

    return new Response(elevenRes.body, {
        status: 200,
        headers: {
            "Content-Type": "audio/mpeg",
            "Transfer-Encoding": "chunked",
            "Cache-Control": "no-cache",
            "X-Content-Type-Options": "nosniff",
        },
    });
}