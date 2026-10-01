import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { setUserResourceFavorite } from "@/lib/db";
import { NextRequest } from "next/server";

export async function POST(req: NextRequest) {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
        return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    try {
        const body = await req.json();
        if (typeof body.url !== "string" || typeof body.favorite !== "boolean") {
            return Response.json({ error: "url and favorite are required" }, { status: 400 });
        }

        await setUserResourceFavorite(session.user.email, body.url, body.favorite);
        return Response.json({ success: true });
    } catch (err) {
        console.error("Failed to update resource favorite:", err);
        return Response.json({ error: "Failed to update favorite" }, { status: 500 });
    }
}
