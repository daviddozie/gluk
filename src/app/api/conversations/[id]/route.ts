import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { deleteConversation } from "@/lib/db";
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