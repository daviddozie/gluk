import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getUserConversations, saveConversation } from "@/lib/db";
import { NextRequest } from "next/server";

export async function GET() {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
        return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    try {
        const conversations = await getUserConversations(session.user.email);
        return Response.json({ conversations });
    } catch (err) {
        console.error("Failed to load conversations:", err);
        return Response.json({ error: "Failed to load conversations" }, { status: 500 });
    }
}

export async function POST(req: NextRequest) {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
        return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    try {
        const { id, title, messages } = await req.json();
        await saveConversation(session.user.email, id, title, messages);
        return Response.json({ success: true });
    } catch (err) {
        console.error("Failed to save conversation:", err);
        return Response.json({ error: "Failed to save conversation" }, { status: 500 });
    }
}