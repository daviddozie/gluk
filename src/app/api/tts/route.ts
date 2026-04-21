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

    const cleanText = stripMarkdown(text);

    const truncated = cleanText.slice(0, 2500);

    let VOICE_ID = "JBFqnCBsd6RMkjVDRTpX";
    try {
        const voicesRes = await fetch("https://api.elevenlabs.io/v1/voices", {
            headers: { "xi-api-key": apiKey },
        });
        if (voicesRes.ok) {
            const voicesData = await voicesRes.json() as { voices: { voice_id: string; name: string }[] };
            if (voicesData.voices?.length > 0) {
                VOICE_ID = voicesData.voices[0].voice_id;
                console.log("[tts] using voice:", voicesData.voices[0].name, VOICE_ID);
            }
        }
    } catch {
        console.warn("[tts] could not fetch voices, using fallback voice id");
    }

    const response = await fetch(
        `https://api.elevenlabs.io/v1/text-to-speech/${VOICE_ID}`,
        {
            method: "POST",
            headers: {
                "xi-api-key": apiKey,
                "Content-Type": "application/json",
                "Accept": "audio/mpeg",
            },
            body: JSON.stringify({
                text: truncated,
                model_id: "eleven_flash_v2_5",
                voice_settings: {
                    stability: 0.5,
                    similarity_boost: 0.75,
                },
            }),
        }
    );

    if (!response.ok) {
        const err = await response.text();
        console.error("ElevenLabs TTS error:", response.status, err);
        return Response.json({ error: "TTS request failed" }, { status: 500 });
    }

    const arrayBuffer = await response.arrayBuffer();
    const base64 = Buffer.from(arrayBuffer).toString("base64");

    return Response.json({ audioContent: base64 });
}