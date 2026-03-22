import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { deleteConversation, pinConversation } from "@/lib/db";
import { NextRequest } from "next/server";

export async function DELETE(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
        return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    try {
        const { id } = await params;
        await deleteConversation(session.user.email, id);
        return Response.json({ success: true });
    } catch (err) {
        console.error("Failed to delete conversation:", err);
        return Response.json({ error: "Failed to delete" }, { status: 500 });
    }
}

export async function PATCH(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
        return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    try {
        const { id } = await params;
        const { pinned } = await req.json();
        await pinConversation(session.user.email, id, Boolean(pinned));
        return Response.json({ success: true });
    } catch (err) {
        console.error("Failed to pin conversation:", err);
        return Response.json({ error: "Failed to pin" }, { status: 500 });
    }
}
