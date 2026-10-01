import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getUserResources } from "@/lib/db";

export async function GET() {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
        return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    try {
        const resources = await getUserResources(session.user.email);
        return Response.json({ resources });
    } catch (err) {
        console.error("Failed to load user resources:", err);
        return Response.json({ error: "Failed to load resources" }, { status: 500 });
    }
}
