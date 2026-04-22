import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
    try {
        const formData = await req.formData();
        const audio = formData.get("audio") as Blob | null;

        if (!audio) {
            return NextResponse.json({ error: "No audio provided" }, { status: 400 });
        }

        const apiKey = process.env.DEEPGRAM_API_KEY;
        if (!apiKey) {
            return NextResponse.json({ error: "DEEPGRAM_API_KEY not set" }, { status: 500 });
        }

        const arrayBuffer = await audio.arrayBuffer();

        const response = await fetch(
            "https://api.deepgram.com/v1/listen?model=nova-2&smart_format=true&punctuate=true",
            {
                method: "POST",
                headers: {
                    Authorization: `Token ${apiKey}`,
                    "Content-Type": audio.type || "audio/webm",
                },
                body: arrayBuffer,
            }
        );

        if (!response.ok) {
            const err = await response.text();
            console.error("Deepgram STT error:", err);
            return NextResponse.json({ error: "Transcription failed" }, { status: 500 });
        }

        const data = await response.json();
        const transcript =
            data?.results?.channels?.[0]?.alternatives?.[0]?.transcript ?? "";

        return NextResponse.json({ transcript });
    } catch (err) {
        console.error("STT route error:", err);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}
