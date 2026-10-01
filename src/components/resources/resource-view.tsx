"use client";

import { AlertCircle, ChevronLeft, CloudUpload, FileText, FolderOpen, MoreHorizontal, Pencil, Share2, Trash2 } from "lucide-react";
import { FileIcon, getFileCategory } from "@public/svg/icon";
import { Resource } from "@/types/resource";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

type Tab = "Suggested" | "Favorites" | "Folders" | "Images" | "All";
type Layout = "grid" | "list";

interface ResourceViewProps {
    isDark: boolean;
    loading: boolean;
    error: string | null;
    activeTab: Tab;
    selectedFolder: string | null;
    layout: Layout;
    resources: Resource[];
    filtered: Resource[];
    folderNames: string[];
    folderCounts: Record<string, number>;
    uploading: boolean;
    isDragOver: boolean;
    onBackToFolders: () => void;
    onOpenFolder: (folder: string) => void;
    onFolderRename: (folder: string) => void;
    onFolderDelete: (folder: string) => void;
    onShareFolder: (folder: string) => void;
    onUpload: (files: FileList | null) => void;
    onChooseUpload: () => void;
    onDragOver: (active: boolean) => void;
    onPreview: (resource: Resource) => void;
    renderResourceMenu: (resource: Resource) => React.ReactNode;
    search: string;
}

const skeletonHeights = ["h-56", "h-48", "h-64", "h-52", "h-56", "h-60", "h-48", "h-64", "h-56", "h-52", "h-64", "h-48", "h-56", "h-64", "h-52"];

function ResourceThumbnail({ resource, className }: { resource: Resource; className: string }) {
    return (
        // Resource URLs are external blob/CDN URLs; native img avoids requiring a
        // deployment-specific Next image host allowlist.
        // eslint-disable-next-line @next/next/no-img-element
        <img src={resource.url} alt={resource.name} loading="lazy" className={className} />
    );
}

export function ResourceView(props: ResourceViewProps) {
    const { isDark, loading, error, activeTab, selectedFolder, layout, filtered, folderNames, folderCounts, uploading, isDragOver, onBackToFolders, onOpenFolder, onFolderRename, onFolderDelete, onShareFolder, onUpload, onChooseUpload, onDragOver, onPreview, renderResourceMenu, search } = props;
    const surface = isDark ? "border-white/8 bg-white/[0.045] hover:bg-white/[0.08]" : "border-black/8 bg-black/[0.025] hover:bg-black/[0.05]";

    return (
        <div className="flex-1 overflow-y-auto p-6 sm:p-8">
            {activeTab === "Folders" && selectedFolder && !loading && !error && (
                <button type="button" onClick={onBackToFolders} className={`mb-5 inline-flex cursor-pointer items-center gap-1.5 text-sm ${isDark ? "text-white/55 hover:text-white" : "text-black/55 hover:text-black"}`}>
                    <ChevronLeft className="h-4 w-4" /><span>Folders / {selectedFolder}</span>
                </button>
            )}
            {activeTab === "Folders" && selectedFolder && !loading && !error && !props.resources.some((resource) => resource.folder === selectedFolder) && (
                    <div
                        onDragOver={(event) => { event.preventDefault(); onDragOver(true); }}
                        onDragLeave={(event) => { if (!event.currentTarget.contains(event.relatedTarget as Node | null)) onDragOver(false); }}
                        onDrop={(event) => { event.preventDefault(); onDragOver(false); onUpload(event.dataTransfer.files); }}
                        className={`mb-6 flex min-h-[min(44vh,32rem)] flex-col items-center justify-center gap-5 rounded-[2rem] border border-dashed px-6 py-12 transition-colors ${isDragOver ? (isDark ? "border-white/50 bg-white/10" : "border-black/40 bg-black/[0.06]") : (isDark ? "border-white/20 bg-white/[0.08] hover:bg-white/[0.1]" : "border-black/20 bg-black/[0.035] hover:bg-black/[0.055]")}`}
                    >
                        <CloudUpload className={`h-10 w-10 ${isDark ? "text-white" : "text-black"}`} />
                        <button type="button" onClick={onChooseUpload} disabled={uploading} className={`cursor-pointer rounded-full border px-6 py-3 text-sm font-medium transition-colors disabled:cursor-wait disabled:opacity-60 ${isDark ? "border-white/15 hover:bg-white/8" : "border-black/15 hover:bg-black/5"}`}>
                            {uploading ? "Uploading…" : "Upload files"}
                        </button>
                    </div>
            )}

            {loading ? (
                <div className="columns-1 gap-4 sm:columns-2 lg:columns-3 xl:columns-5" role="status" aria-label="Loading resources">
                    {skeletonHeights.map((height, index) => <div key={index} aria-hidden="true" className={`mb-4 break-inside-avoid rounded-2xl ${height} animate-pulse ${isDark ? "bg-[#303030]" : "bg-black/10"}`} />)}
                </div>
            ) : error ? (
                <div className="flex h-48 flex-col items-center justify-center gap-2 text-center text-sm opacity-60"><AlertCircle className="h-5 w-5" />{error}</div>
            ) : activeTab === "Folders" && selectedFolder === null ? (
                folderNames.length === 0 ? (
                    <div className="flex h-56 flex-col items-center justify-center text-center">
                        <FolderOpen className={`mb-3 h-8 w-8 ${isDark ? "text-white/25" : "text-black/25"}`} />
                        <p className="text-sm font-medium">No folders yet</p>
                        <p className={`mt-1 max-w-sm text-xs ${isDark ? "text-white/40" : "text-black/45"}`}>Use a resource’s menu to add it to a folder.</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                        {folderNames.map((folder) => (
                            <div key={folder} className={`group relative flex min-h-72 flex-col rounded-2xl border p-4 transition-colors ${surface}`}>
                                <button type="button" onClick={() => onOpenFolder(folder)} className="flex min-h-0 flex-1 cursor-pointer flex-col text-left">
                                    <span className="line-clamp-2 min-h-10 pr-10 text-sm font-medium" title={folder}>{folder}</span>
                                    <span className={`flex flex-1 items-center justify-center ${isDark ? "text-white/70" : "text-black/65"}`}><FolderOpen className="h-12 w-12 stroke-[1.5] transition-transform group-hover:scale-105" /></span>
                                    <span className={`text-xs ${isDark ? "text-white/45" : "text-black/45"}`}>{folderCounts[folder] ?? 0} {(folderCounts[folder] ?? 0) === 1 ? "item" : "items"}</span>
                                </button>
                                <div className="absolute right-2 top-2">
                                    <DropdownMenu>
                                        <DropdownMenuTrigger asChild><button type="button" onClick={(event) => event.stopPropagation()} aria-label={`More options for ${folder}`} className={`flex h-8 w-8 cursor-pointer items-center justify-center rounded-full ${isDark ? "bg-white/8 text-white/65 hover:bg-white/15 hover:text-white" : "bg-black/6 text-black/60 hover:bg-black/10 hover:text-black"}`}><MoreHorizontal className="h-4 w-4" /></button></DropdownMenuTrigger>
                                        <DropdownMenuContent align="end" className={`w-56 p-2 ${isDark ? "border-white/10 bg-[#252525] text-white" : "border-black/10 bg-white text-black"}`}>
                                            <DropdownMenuItem onSelect={() => onOpenFolder(folder)} className={`cursor-pointer gap-3 px-3 py-2.5 ${isDark ? "focus:bg-white/10" : "focus:bg-black/5"}`}><FolderOpen className="h-4 w-4" />Open folder</DropdownMenuItem>
                                            <DropdownMenuItem onSelect={() => onShareFolder(folder)} className={`cursor-pointer gap-3 px-3 py-2.5 ${isDark ? "focus:bg-white/10" : "focus:bg-black/5"}`}><Share2 className="h-4 w-4" />Share</DropdownMenuItem>
                                            <DropdownMenuItem onSelect={() => onFolderRename(folder)} className={`cursor-pointer gap-3 px-3 py-2.5 ${isDark ? "focus:bg-white/10" : "focus:bg-black/5"}`}><Pencil className="h-4 w-4" />Rename</DropdownMenuItem>
                                            <DropdownMenuSeparator />
                                            <DropdownMenuItem onSelect={() => onFolderDelete(folder)} className="cursor-pointer gap-3 px-3 py-2.5 text-red-400 focus:bg-red-500/10 focus:text-red-400"><Trash2 className="h-4 w-4" />Delete folder</DropdownMenuItem>
                                        </DropdownMenuContent>
                                    </DropdownMenu>
                                </div>
                            </div>
                        ))}
                    </div>
                )
            ) : filtered.length === 0 && !(activeTab === "Folders" && selectedFolder) ? (
                <div className="flex h-56 flex-col items-center justify-center text-center">
                    <FileText className={`mb-3 h-8 w-8 ${isDark ? "text-white/25" : "text-black/25"}`} />
                    <p className="text-sm font-medium">{search ? "No resources match your search" : activeTab === "Favorites" ? "No favorite resources yet" : activeTab === "Images" ? "No uploaded images yet" : "No uploaded resources yet"}</p>
                    <p className={`mt-1 max-w-sm text-xs ${isDark ? "text-white/40" : "text-black/45"}`}>{search ? "Try another file name." : "Files you attach to a chat will appear here."}</p>
                </div>
            ) : layout === "grid" ? (
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                    {filtered.map((resource) => {
                        const category = getFileCategory(resource.name, resource.type);
                        const date = new Date(resource.uploadedAt);
                        return (
                            <div key={resource.url} className={`group relative flex min-h-52 cursor-pointer flex-col rounded-2xl border p-4 transition-colors ${surface}`}>
                                <button type="button" onClick={() => onPreview(resource)} className="flex min-h-0 flex-1 cursor-pointer flex-col text-left">
                                    <span className="line-clamp-2 min-h-10 pr-8 text-sm font-medium" title={resource.name}>{resource.name}</span>
                                    {category === "image" ? (
                                        <span className="my-3 flex min-h-28 flex-1 overflow-hidden rounded-lg bg-black/5 transition-transform group-hover:scale-[1.02]">
                                            <ResourceThumbnail resource={resource} className="h-full w-full object-cover" />
                                        </span>
                                    ) : (
                                        <span className="flex flex-1 items-center justify-center py-5 transition-transform group-hover:scale-105"><FileIcon fileName={resource.name} fileType={resource.type} size={42} /></span>
                                    )}
                                    <span className={`text-xs ${isDark ? "text-white/40" : "text-black/45"}`}>{Number.isNaN(date.getTime()) ? "Uploaded" : `Uploaded ${date.toLocaleDateString()}`} · {category.toUpperCase()}</span>
                                </button>
                                <div className="absolute right-2 top-2">{renderResourceMenu(resource)}</div>
                            </div>
                        );
                    })}
                </div>
            ) : (
                <div className={`overflow-hidden rounded-xl border ${isDark ? "border-white/8" : "border-black/8"}`}>
                    <div className={`grid grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-3 px-4 py-3 text-xs font-medium ${isDark ? "text-white/45" : "text-black/45"}`}><span>Name</span><span className="hidden sm:block">Uploaded</span><span className="w-8" /></div>
                    {filtered.map((resource) => {
                        const date = new Date(resource.uploadedAt);
                        const category = getFileCategory(resource.name, resource.type);
                        return (
                            <div key={resource.url} className={`grid grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-3 border-t px-4 py-3 ${isDark ? "border-white/8 hover:bg-white/[0.04]" : "border-black/8 hover:bg-black/[0.025]"}`}>
                                <button type="button" onClick={() => onPreview(resource)} className="flex min-w-0 cursor-pointer items-center gap-3 text-left">
                                    {category === "image"
                                        ? <ResourceThumbnail resource={resource} className="h-9 w-9 shrink-0 rounded-md object-cover" />
                                        : <FileIcon fileName={resource.name} fileType={resource.type} size={30} />}
                                    <span className="truncate text-sm">{resource.name}</span>
                                </button>
                                <span className={`hidden whitespace-nowrap text-xs sm:block ${isDark ? "text-white/45" : "text-black/45"}`}>{Number.isNaN(date.getTime()) ? "Uploaded" : date.toLocaleDateString()}</span>
                                {renderResourceMenu(resource)}
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
