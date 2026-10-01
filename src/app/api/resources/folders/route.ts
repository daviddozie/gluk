import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { createUserResourceFolder, deleteUserResourceFolder, getUserResourceFolders, renameUserResourceFolder } from "@/lib/db";
import { NextRequest } from "next/server";

export async function GET() {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) return Response.json({ error: "Unauthorized" }, { status: 401 });

    try {
        const folders = await getUserResourceFolders(session.user.email);
        return Response.json({ folders });
    } catch (error) {
        console.error("Failed to load resource folders:", error);
        return Response.json({ error: "Failed to load folders" }, { status: 500 });
    }
}

export async function POST(request: NextRequest) {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) return Response.json({ error: "Unauthorized" }, { status: 401 });

    try {
        const body = await request.json();
        const name = typeof body.name === "string" ? body.name.trim() : "";
        if (!name) return Response.json({ error: "Folder name is required" }, { status: 400 });
        if (name.length > 80) return Response.json({ error: "Folder names must be 80 characters or less" }, { status: 400 });

        const created = await createUserResourceFolder(session.user.email, name);
        if (!created) return Response.json({ error: "A folder with that name already exists" }, { status: 409 });
        return Response.json({ success: true, name });
    } catch (error) {
        console.error("Failed to create resource folder:", error);
        return Response.json({ error: "Failed to create folder" }, { status: 500 });
    }
}

export async function PATCH(request: NextRequest) {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) return Response.json({ error: "Unauthorized" }, { status: 401 });
    try {
        const body = await request.json();
        const oldName = typeof body.name === "string" ? body.name.trim() : "";
        const newName = typeof body.newName === "string" ? body.newName.trim() : "";
        if (!oldName || !newName) return Response.json({ error: "Current and new folder names are required" }, { status: 400 });
        if (newName.length > 80) return Response.json({ error: "Folder names must be 80 characters or less" }, { status: 400 });
        const renamed = await renameUserResourceFolder(session.user.email, oldName, newName);
        if (!renamed) return Response.json({ error: "A folder with that name already exists" }, { status: 409 });
        return Response.json({ success: true, name: newName });
    } catch (error) {
        console.error("Failed to rename resource folder:", error);
        return Response.json({ error: "Failed to rename folder" }, { status: 500 });
    }
}

export async function DELETE(request: NextRequest) {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) return Response.json({ error: "Unauthorized" }, { status: 401 });
    try {
        const { searchParams } = new URL(request.url);
        const name = searchParams.get("name")?.trim() ?? "";
        if (!name) return Response.json({ error: "Folder name is required" }, { status: 400 });
        await deleteUserResourceFolder(session.user.email, name);
        return Response.json({ success: true });
    } catch (error) {
        console.error("Failed to delete resource folder:", error);
        return Response.json({ error: "Failed to delete folder" }, { status: 500 });
    }
}
