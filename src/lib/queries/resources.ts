import { Resource } from "@/types/resource";

async function readJson<T>(response: Response, fallback: string): Promise<T> {
    if (!response.ok) {
        const body = await response.json().catch(() => null);
        throw new Error(body?.error ?? fallback);
    }
    return response.json() as Promise<T>;
}

export async function fetchResources(signal?: AbortSignal) {
    const response = await fetch("/api/resources", { signal });
    const data = await readJson<{ resources: Resource[] }>(response, "Could not load resources");
    return data.resources ?? [];
}

export async function fetchResourceFolders(signal?: AbortSignal) {
    const response = await fetch("/api/resources/folders", { signal });
    const data = await readJson<{ folders: string[] }>(response, "Could not load folders");
    return data.folders ?? [];
}

export async function createResourceFolder(name: string) {
    const response = await fetch("/api/resources/folders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
    });
    return readJson<{ success: boolean; name: string }>(response, "Could not create folder");
}

export async function renameResourceFolder(name: string, newName: string) {
    const response = await fetch("/api/resources/folders", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, newName }),
    });
    return readJson<{ success: boolean; name: string }>(response, "Could not rename folder");
}

export async function deleteResourceFolder(name: string) {
    const response = await fetch(`/api/resources/folders?name=${encodeURIComponent(name)}`, { method: "DELETE" });
    return readJson<{ success: boolean }>(response, "Could not delete folder");
}

export async function setResourceFavorite(url: string, favorite: boolean) {
    const response = await fetch("/api/resources/favorite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url, favorite }),
    });
    await readJson<{ success: boolean }>(response, "Could not update favorite");
}

export interface ResourceUpdate {
    url: string;
    action: "rename" | "folder" | "delete";
    name?: string;
    folder?: string | null;
}

export async function updateResource(update: ResourceUpdate) {
    const response = await fetch("/api/resources/manage", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(update),
    });
    await readJson<{ success: boolean }>(response, "Could not update resource");
}
