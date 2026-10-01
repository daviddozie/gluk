"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useSession } from "next-auth/react";
import { DocumentViewerFile } from "@/components/document-viewer";
import { getFileCategory } from "@public/svg/icon";
import { Resource } from "@/types/resource";
import { queryKeys } from "@/lib/queries/keys";
import { createResourceFolder, deleteResourceFolder, fetchResourceFolders, fetchResources, renameResourceFolder, setResourceFavorite, updateResource } from "@/lib/queries/resources";
import { ResourceView } from "@/components/resources/resource-view";
import { ResourceToolbar } from "@/components/resources/resource-toolbar";
import { ResourceDialogState, ResourceDialogs } from "@/components/resources/resource-dialogs";
import { ResourceMenu } from "@/components/resources/resource-menu";
import { UploadQueue, ResourceQueueItem, ResourceQueueKind } from "@/components/resources/upload-queue";
import { NewFileDialog } from "@/components/resources/new-file-dialog";

interface ResourcesLibraryProps {
    theme: "light" | "dark";
    onPreview: (resource: DocumentViewerFile) => void;
    onChatAbout: (resource: Resource) => void;
}

type ResourceTab = "Suggested" | "Favorites" | "Folders" | "Images" | "All";
type ResourceLayout = "grid" | "list";
const tabs: ResourceTab[] = ["Suggested", "Favorites", "Folders", "Images", "All"];
const EMPTY_RESOURCES: Resource[] = [];
const tabFromParam = (value: string | null): ResourceTab => tabs.find((tab) => tab.toLowerCase() === value?.toLowerCase()) ?? "Suggested";

function readResourceUrlState() {
    const params = new URLSearchParams(window.location.search);
    const folder = params.get("folder");
    return { tab: folder ? "Folders" as const : tabFromParam(params.get("tab")), folder };
}

function writeResourceUrlState(tab: ResourceTab, folder: string | null) {
    const url = new URL(window.location.href);
    if (tab === "Suggested") url.searchParams.delete("tab");
    else url.searchParams.set("tab", tab.toLowerCase());
    if (tab === "Folders" && folder) url.searchParams.set("folder", folder);
    else url.searchParams.delete("folder");
    window.history.pushState(window.history.state, "", `${url.pathname}${url.search}${url.hash}`);
}

function uploadFileWithProgress(file: File, onProgress: (progress: number) => void): Promise<{ url: string }> {
    return new Promise((resolve, reject) => {
        const request = new XMLHttpRequest();
        request.open("POST", "/api/upload");
        request.upload.onprogress = (event) => {
            if (event.lengthComputable) onProgress(Math.min(99, Math.round((event.loaded / event.total) * 100)));
        };
        request.onerror = () => reject(new Error("Network error while uploading file"));
        request.onload = () => {
            let body: { error?: string; files?: { url: string }[] } | null = null;
            try { body = JSON.parse(request.responseText); } catch { /* handled as an invalid response below */ }
            if (request.status < 200 || request.status >= 300) {
                reject(new Error(body?.error ?? "Could not upload file"));
                return;
            }
            const uploadedFile = body?.files?.[0];
            if (!uploadedFile?.url) {
                reject(new Error("Upload returned no file URL"));
                return;
            }
            resolve(uploadedFile);
        };
        const formData = new FormData();
        formData.append("files", file);
        request.send(formData);
    });
}

export default function ResourcesLibrary({ theme, onPreview, onChatAbout }: ResourcesLibraryProps) {
    const { data: session, status } = useSession();
    const userEmail = session?.user?.email ?? null;
    const queryClient = useQueryClient();
    const resourcesKey = queryKeys.resources.list(userEmail ?? "guest");
    const foldersKey = queryKeys.resources.folders(userEmail ?? "guest");
    const resourcesQuery = useQuery({
        queryKey: resourcesKey,
        queryFn: ({ signal }) => fetchResources(signal),
        enabled: status === "authenticated" && Boolean(userEmail),
    });
    const foldersQuery = useQuery({
        queryKey: foldersKey,
        queryFn: ({ signal }) => fetchResourceFolders(signal),
        enabled: status === "authenticated" && Boolean(userEmail),
    });
    const resources = resourcesQuery.data ?? EMPTY_RESOURCES;
    const error = status === "unauthenticated"
        ? "Sign in to view your uploaded resources."
        : resourcesQuery.error instanceof Error
            ? resourcesQuery.error.message
            : null;
    const [search, setSearch] = useState("");
    const [activeTab, setActiveTab] = useState<ResourceTab>("Suggested");
    const [selectedFolder, setSelectedFolder] = useState<string | null>(null);
    const [layout, setLayout] = useState<ResourceLayout>("grid");
    const [feedback, setFeedback] = useState<string | null>(null);
    const [manageDialog, setManageDialog] = useState<ResourceDialogState>(null);
    const [manageValue, setManageValue] = useState("");
    const [folderDialog, setFolderDialog] = useState<{ action: "rename" | "delete"; folder: string } | null>(null);
    const [createFolderOpen, setCreateFolderOpen] = useState(false);
    const [newFolderName, setNewFolderName] = useState("");
    const [folderValue, setFolderValue] = useState("");
    const [isDragOver, setIsDragOver] = useState(false);
    const [uploadItems, setUploadItems] = useState<ResourceQueueItem[]>([]);
    const [newFileOpen, setNewFileOpen] = useState(false);
    const [newFileName, setNewFileName] = useState("");
    const [newFileContent, setNewFileContent] = useState("");
    const uploadInputRef = useRef<HTMLInputElement>(null);
    const queueSourcesRef = useRef(new Map<string, { kind: "upload" | "new-file"; file: File; destinationFolder: string | null; uploadedUrl?: string } | { kind: "folder"; name: string; created?: boolean } | { kind: "assign-folder"; name: string; resourceUrl: string; resourceName: string; created?: boolean; assigned?: boolean }>());
    const runningQueueIdsRef = useRef(new Set<string>());
    const isDark = theme === "dark";
    const loading = status === "loading" || (status === "authenticated" && (resourcesQuery.isPending || (activeTab === "Folders" && foldersQuery.isPending)));
    const uploading = uploadItems.some((item) => (item.kind === "upload" || item.kind === "new-file") && (item.status === "queued" || item.status === "running"));

    useEffect(() => {
        const sync = () => {
            const state = readResourceUrlState();
            setActiveTab(state.tab);
            setSelectedFolder(state.folder);
        };
        sync();
        window.addEventListener("popstate", sync);
        return () => window.removeEventListener("popstate", sync);
    }, []);

    const navigateToResourceState = (tab: ResourceTab, folder: string | null = null) => {
        setActiveTab(tab);
        setSelectedFolder(folder);
        writeResourceUrlState(tab, folder);
    };

    const favoriteMutation = useMutation({
        mutationFn: ({ url, favorite }: { url: string; favorite: boolean }) => setResourceFavorite(url, favorite),
        onMutate: async ({ url, favorite }) => {
            await queryClient.cancelQueries({ queryKey: resourcesKey });
            const previous = queryClient.getQueryData<Resource[]>(resourcesKey);
            queryClient.setQueryData<Resource[]>(resourcesKey, (current) => current?.map((item) => item.url === url ? { ...item, favorite } : item));
            return { previous };
        },
        onError: (_error, _variables, context) => {
            if (context?.previous) queryClient.setQueryData(resourcesKey, context.previous);
        },
        onSettled: () => queryClient.invalidateQueries({ queryKey: resourcesKey }),
    });

    const resourceMutation = useMutation({
        mutationFn: updateResource,
        onMutate: async (update) => {
            await queryClient.cancelQueries({ queryKey: resourcesKey });
            const previous = queryClient.getQueryData<Resource[]>(resourcesKey);
            queryClient.setQueryData<Resource[]>(resourcesKey, (current) => {
                if (!current) return current;
                if (update.action === "delete") return current.filter((item) => item.url !== update.url);
                return current.map((item) => item.url !== update.url ? item : update.action === "rename"
                    ? { ...item, name: update.name ?? item.name }
                    : { ...item, folder: update.folder ?? null });
            });
            return { previous };
        },
        onError: (_error, _variables, context) => {
            if (context?.previous) queryClient.setQueryData(resourcesKey, context.previous);
        },
        onSettled: () => {
            void queryClient.invalidateQueries({ queryKey: resourcesKey });
            void queryClient.invalidateQueries({ queryKey: foldersKey });
        },
    });

    const folderMutation = useMutation({
        mutationFn: async ({ action, name, newName }: { action: "rename" | "delete"; name: string; newName?: string }) =>
            action === "rename" ? renameResourceFolder(name, newName ?? "") : deleteResourceFolder(name),
        onSuccess: (_result, variables) => {
            if (variables.action === "rename") {
                const newName = variables.newName ?? "";
                queryClient.setQueryData<string[]>(foldersKey, (current) => (current ?? []).map((name) => name === variables.name ? newName : name));
                queryClient.setQueryData<Resource[]>(resourcesKey, (current) => current?.map((resource) => resource.folder === variables.name ? { ...resource, folder: newName } : resource));
                if (selectedFolder === variables.name) navigateToResourceState("Folders", newName);
                setFeedback("Folder renamed");
            } else {
                queryClient.setQueryData<string[]>(foldersKey, (current) => (current ?? []).filter((name) => name !== variables.name));
                queryClient.setQueryData<Resource[]>(resourcesKey, (current) => current?.map((resource) => resource.folder === variables.name ? { ...resource, folder: null } : resource));
                if (selectedFolder === variables.name) navigateToResourceState("Folders");
                setFeedback("Folder deleted; its resources remain in your library");
            }
            setFolderDialog(null);
        },
        onError: (error) => setFeedback(error instanceof Error ? error.message : "Could not update folder"),
        onSettled: () => {
            void queryClient.invalidateQueries({ queryKey: foldersKey });
            void queryClient.invalidateQueries({ queryKey: resourcesKey });
        },
    });

    const filtered = useMemo(() => {
        const query = search.trim().toLowerCase();
        return resources.filter((resource) => {
            const matchesSearch = !query || resource.name.toLowerCase().includes(query);
            const isImage = resource.type.startsWith("image/") || getFileCategory(resource.name, resource.type) === "image";
            const matchesTab = activeTab === "Favorites"
                ? resource.favorite
                : activeTab === "Images"
                    ? isImage
                    : activeTab === "Folders"
                        ? selectedFolder !== null && resource.folder === selectedFolder
                        : true;
            return matchesSearch && matchesTab;
        });
    }, [activeTab, resources, search, selectedFolder]);

    const folderNames = useMemo(() => Array.from(new Set([
        ...(foldersQuery.data ?? []),
        ...resources.map((resource) => resource.folder).filter((folder): folder is string => Boolean(folder)),
    ])).sort((a, b) => a.localeCompare(b)), [foldersQuery.data, resources]);
    const folderCounts = useMemo(() => resources.reduce<Record<string, number>>((counts, resource) => {
        if (resource.folder) counts[resource.folder] = (counts[resource.folder] ?? 0) + 1;
        return counts;
    }, {}), [resources]);

    useEffect(() => {
        if (!feedback) return;
        const timer = window.setTimeout(() => setFeedback(null), 2500);
        return () => window.clearTimeout(timer);
    }, [feedback]);

    const toggleFavorite = async (resource: Resource) => {
        const favorite = !resource.favorite;
        try {
            await favoriteMutation.mutateAsync({ url: resource.url, favorite });
        } catch {
            setFeedback("Could not update favorite");
        }
    };

    const downloadResource = async (resource: Resource) => {
        try {
            const response = await fetch(resource.url);
            if (!response.ok) throw new Error("Download failed");
            const blobUrl = URL.createObjectURL(await response.blob());
            const anchor = document.createElement("a");
            anchor.href = blobUrl;
            anchor.download = resource.name;
            document.body.appendChild(anchor);
            anchor.click();
            anchor.remove();
            URL.revokeObjectURL(blobUrl);
        } catch {
            window.open(resource.url, "_blank", "noopener,noreferrer");
        }
    };

    const submitManageDialog = async () => {
        if (!manageDialog) return;
        const { action, resource } = manageDialog;
        if (action === "rename" && !manageValue.trim()) {
            setFeedback("Resource name cannot be empty");
            return;
        }
        const update = action === "rename"
            ? { url: resource.url, action, name: manageValue.trim() }
            : action === "folder"
                ? { url: resource.url, action, folder: manageValue.trim() || null }
                : { url: resource.url, action };
        try {
            await resourceMutation.mutateAsync(update);
            setManageDialog(null);
        } catch {
            setFeedback(action === "delete" ? "Could not delete resource" : action === "rename" ? "Could not rename resource" : "Could not update folder");
        }
    };

    const enqueue = (tasks: { kind: ResourceQueueKind; name: string; detail?: string; type: string; destinationFolder: string | null; source: { kind: "upload" | "new-file"; file: File; destinationFolder: string | null } | { kind: "folder"; name: string } | { kind: "assign-folder"; name: string; resourceUrl: string; resourceName: string } }[]) => {
        if (!tasks.length) return;
        const items = tasks.map(({ kind, name, detail, type, destinationFolder, source }) => {
            const id = crypto.randomUUID();
            queueSourcesRef.current.set(id, source);
            return { id, kind, name, detail, type, destinationFolder, progress: 0, status: "queued" as const, attempt: 1 };
        });
        setUploadItems((current) => [...current, ...items]);
    };

    const uploadIntoFolder = (files: FileList | File[] | null) => {
        if (!files?.length) return;
        const destinationFolder = selectedFolder;
        enqueue(Array.from(files).map((file) => ({
            kind: "upload" as const,
            name: file.name,
            type: file.type || "application/octet-stream",
            destinationFolder,
            source: { kind: "upload" as const, file, destinationFolder },
        })));
        if (uploadInputRef.current) uploadInputRef.current.value = "";
    };

    const createNewFile = () => {
        if (!newFileName.trim()) return;
        const rawName = newFileName.trim();
        const fileName = /\.(txt|md)$/i.test(rawName) ? rawName : `${rawName}.txt`;
        const type = fileName.toLowerCase().endsWith(".md") ? "text/markdown" : "text/plain";
        const file = new File([newFileContent], fileName, { type });
        const destinationFolder = selectedFolder;
        enqueue([{ kind: "new-file", name: fileName, type, destinationFolder, source: { kind: "new-file", file, destinationFolder } }]);
        setNewFileOpen(false);
        setNewFileName("");
        setNewFileContent("");
    };

    const createFolderInQueue = (rawName: string) => {
        const name = rawName.trim();
        if (!name) return;
        enqueue([{ kind: "folder", name, type: "folder", destinationFolder: null, source: { kind: "folder", name } }]);
        setCreateFolderOpen(false);
        setNewFolderName("");
    };

    const createAndAssignFolder = () => {
        const resource = manageDialog?.action === "folder" ? manageDialog.resource : null;
        const name = newFolderName.trim();
        if (!resource || !name) return;
        enqueue([{ kind: "folder", name, detail: `File: ${resource.name}`, type: "folder", destinationFolder: null, source: { kind: "assign-folder", name, resourceUrl: resource.url, resourceName: resource.name } }]);
        setNewFolderName("");
        setManageDialog(null);
    };

    const retryQueueItem = (id: string) => {
        setUploadItems((current) => current.map((item) => item.id === id && item.status === "failed"
            ? { ...item, status: "queued", progress: 0, attempt: item.attempt + 1, error: undefined }
            : item));
    };

    useEffect(() => {
        const concurrency = 3;
        const available = concurrency - runningQueueIdsRef.current.size;
        if (available <= 0) return;
        const queuedItems = uploadItems.filter((item) => item.status === "queued" && !runningQueueIdsRef.current.has(item.id)).slice(0, available);
        for (const item of queuedItems) {
            const source = queueSourcesRef.current.get(item.id);
            if (!source) continue;
            runningQueueIdsRef.current.add(item.id);
            setUploadItems((current) => current.map((candidate) => candidate.id === item.id ? { ...candidate, status: "running", error: undefined } : candidate));
            void (async () => {
                const execute = async () => {
                    if (source.kind === "folder" || source.kind === "assign-folder") {
                        if (!source.created) {
                            await createResourceFolder(source.name);
                            source.created = true;
                        }
                        if (source.kind === "assign-folder" && !source.assigned) {
                            await updateResource({ url: source.resourceUrl, action: "folder", folder: source.name });
                            source.assigned = true;
                        }
                        queryClient.setQueryData<string[]>(foldersKey, (current) => Array.from(new Set([...(current ?? []), source.name])).sort((a, b) => a.localeCompare(b)));
                        if (source.kind === "assign-folder") {
                            queryClient.setQueryData<Resource[]>(resourcesKey, (current) => current?.map((resource) => resource.url === source.resourceUrl ? { ...resource, folder: source.name } : resource));
                        }
                        void queryClient.invalidateQueries({ queryKey: resourcesKey });
                        void queryClient.invalidateQueries({ queryKey: foldersKey });
                    } else {
                        if (!source.uploadedUrl) {
                            const uploaded = await uploadFileWithProgress(source.file, (progress) => {
                                setUploadItems((current) => current.map((candidate) => candidate.id === item.id && candidate.status === "running" ? { ...candidate, progress } : candidate));
                            });
                            source.uploadedUrl = uploaded.url;
                        }
                        if (source.destinationFolder) await updateResource({ url: source.uploadedUrl, action: "folder", folder: source.destinationFolder });
                        void queryClient.invalidateQueries({ queryKey: resourcesKey });
                        void queryClient.invalidateQueries({ queryKey: foldersKey });
                    }
                };
                let finalError: unknown;
                try {
                    const maxAttempts = 3;
                    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
                        setUploadItems((current) => current.map((candidate) => candidate.id === item.id ? { ...candidate, attempt, error: attempt > 1 ? `Retrying automatically (${attempt}/${maxAttempts})…` : undefined, progress: attempt > 1 ? 0 : candidate.progress } : candidate));
                        try {
                            await execute();
                            finalError = undefined;
                            break;
                        } catch (error) {
                            finalError = error;
                            if (attempt < maxAttempts) await new Promise((resolve) => window.setTimeout(resolve, 500 * (2 ** (attempt - 1))));
                        }
                    }
                    if (finalError) throw finalError;
                    setUploadItems((current) => current.map((candidate) => candidate.id === item.id ? { ...candidate, progress: 100, status: "completed", error: undefined } : candidate));
                } catch (error) {
                    setUploadItems((current) => current.map((candidate) => candidate.id === item.id ? { ...candidate, status: "failed", error: error instanceof Error ? error.message : "Task failed" } : candidate));
                } finally {
                    runningQueueIdsRef.current.delete(item.id);
                }
            })();
        }
    }, [uploadItems, queryClient, foldersKey, resourcesKey]);

    return (
        <section className="flex min-h-0 flex-1 flex-col overflow-hidden">
            <input ref={uploadInputRef} type="file" multiple className="hidden" onChange={(event) => void uploadIntoFolder(event.target.files)} />
            <ResourceToolbar
                isDark={isDark}
                activeTab={activeTab}
                layout={layout}
                search={search}
                canCreateFolder={status === "authenticated"}
                onTabChange={(tab) => navigateToResourceState(tab)}
                onLayoutChange={setLayout}
                onSearchChange={setSearch}
                onCreateFolder={() => setCreateFolderOpen(true)}
                onCreateFile={() => { setNewFileName(""); setNewFileContent(""); setNewFileOpen(true); }}
                onUploadFiles={() => uploadInputRef.current?.click()}
            />
            <ResourceView
                isDark={isDark}
                loading={loading}
                error={error}
                activeTab={activeTab}
                selectedFolder={selectedFolder}
                layout={layout}
                resources={resources}
                filtered={filtered}
                folderNames={folderNames}
                folderCounts={folderCounts}
                uploading={uploading}
                isDragOver={isDragOver}
                onBackToFolders={() => navigateToResourceState("Folders")}
                onOpenFolder={(folder) => navigateToResourceState("Folders", folder)}
                onFolderRename={(folder) => { setFolderValue(folder); setFolderDialog({ action: "rename", folder }); }}
                onFolderDelete={(folder) => setFolderDialog({ action: "delete", folder })}
                onShareFolder={(folder) => {
                    const url = new URL(window.location.href);
                    url.searchParams.set("tab", "folders");
                    url.searchParams.set("folder", folder);
                    void navigator.clipboard.writeText(url.toString()).then(() => setFeedback("Folder link copied"), () => setFeedback("Could not copy link"));
                }}
                onUpload={(files) => void uploadIntoFolder(files)}
                onChooseUpload={() => uploadInputRef.current?.click()}
                onDragOver={setIsDragOver}
                onPreview={onPreview}
                renderResourceMenu={(resource) => (
                    <ResourceMenu
                        resource={resource}
                        isDark={isDark}
                        onChat={onChatAbout}
                        onFavorite={(item) => void toggleFavorite(item)}
                        onDownload={(item) => void downloadResource(item)}
                        onShare={(item) => void navigator.clipboard.writeText(item.url).then(() => setFeedback("Link copied"), () => setFeedback("Could not copy link"))}
                        onAddToFolder={(item) => { setManageValue(item.folder ?? ""); setNewFolderName(""); setManageDialog({ action: "folder", resource: item }); }}
                        onDelete={(item) => setManageDialog({ action: "delete", resource: item })}
                    />
                )}
                search={search}
            />
            <NewFileDialog
                open={newFileOpen}
                isDark={isDark}
                fileName={newFileName}
                content={newFileContent}
                onOpenChange={setNewFileOpen}
                onFileNameChange={setNewFileName}
                onContentChange={setNewFileContent}
                onCreate={createNewFile}
            />
            <UploadQueue items={uploadItems} isDark={isDark} onRetry={retryQueueItem} onDismiss={() => {
                uploadItems.forEach((item) => queueSourcesRef.current.delete(item.id));
                setUploadItems([]);
            }} />
            <ResourceDialogs
                isDark={isDark}
                manageDialog={manageDialog}
                setManageDialog={setManageDialog}
                manageValue={manageValue}
                setManageValue={setManageValue}
                folderDialog={folderDialog}
                setFolderDialog={setFolderDialog}
                folderValue={folderValue}
                setFolderValue={setFolderValue}
                folderNames={folderNames}
                folderCounts={folderCounts}
                newFolderName={newFolderName}
                setNewFolderName={setNewFolderName}
                createFolderOpen={createFolderOpen}
                setCreateFolderOpen={setCreateFolderOpen}
                resourceMutationPending={resourceMutation.isPending}
                folderMutationPending={folderMutation.isPending}
                onSubmitResource={() => void submitManageDialog()}
                onSubmitFolder={(dialog) => folderMutation.mutate({ action: dialog.action, name: dialog.folder, newName: folderValue.trim() })}
                onCreateFolder={() => createFolderInQueue(newFolderName)}
                onCreateAndAssignFolder={createAndAssignFolder}
            />
            {feedback && <div role="status" className={`fixed bottom-5 right-5 z-50 rounded-lg px-4 py-2 text-sm shadow-lg ${isDark ? "bg-white text-black" : "bg-black text-white"}`}>{feedback}</div>}
        </section>
    );
}
