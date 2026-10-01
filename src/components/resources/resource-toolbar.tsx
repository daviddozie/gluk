"use client";

import { ChevronDown, FilePlus2, FolderPlus, LayoutGrid, List, Search, Upload } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

type Tab = "Suggested" | "Favorites" | "Folders" | "Images" | "All";
type Layout = "grid" | "list";

interface ResourceToolbarProps {
    isDark: boolean;
    activeTab: Tab;
    layout: Layout;
    search: string;
    canCreateFolder: boolean;
    onTabChange: (tab: Tab) => void;
    onLayoutChange: (layout: Layout) => void;
    onSearchChange: (search: string) => void;
    onCreateFolder: () => void;
    onCreateFile: () => void;
    onUploadFiles: () => void;
}

const tabs: Tab[] = ["Suggested", "Favorites", "Folders", "Images", "All"];

export function ResourceToolbar({ isDark, activeTab, layout, search, canCreateFolder, onTabChange, onLayoutChange, onSearchChange, onCreateFolder, onCreateFile, onUploadFiles }: ResourceToolbarProps) {
    return (
        <header className={`shrink-0 border-b px-6 py-5 sm:px-8 ${isDark ? "border-white/8" : "border-black/8"}`}>
            <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                    <h1 className="text-xl font-semibold">Resources</h1>
                    <p className={`mt-1 text-sm ${isDark ? "text-white/45" : "text-black/45"}`}>Your uploaded documents and files</p>
                </div>
                <div className="flex w-full items-center gap-2 sm:w-auto">
                    <div className={`flex items-center rounded-xl border p-1 ${isDark ? "border-white/10 bg-white/5" : "border-black/10 bg-black/[0.03]"}`} aria-label="Resource layout">
                        <button type="button" onClick={() => onLayoutChange("grid")} aria-label="Grid view" title="Grid view" className={`cursor-pointer rounded-lg p-2 ${layout === "grid" ? (isDark ? "bg-white/15" : "bg-black/10") : "opacity-55"}`}><LayoutGrid className="h-4 w-4" /></button>
                        <button type="button" onClick={() => onLayoutChange("list")} aria-label="List view" title="List view" className={`cursor-pointer rounded-lg p-2 ${layout === "list" ? (isDark ? "bg-white/15" : "bg-black/10") : "opacity-55"}`}><List className="h-4 w-4" /></button>
                    </div>
                    <label className={`flex min-w-0 flex-1 items-center gap-2 rounded-xl border px-3 py-2 sm:w-64 sm:flex-none ${isDark ? "border-white/10 bg-white/5" : "border-black/10 bg-black/[0.03]"}`}>
                        <Search className="h-4 w-4 shrink-0 opacity-50" />
                        <input value={search} onChange={(event) => onSearchChange(event.target.value)} placeholder="Search resources" className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:opacity-50" />
                    </label>
                </div>
            </div>
            <div className="mt-5 flex min-w-0 items-center gap-3">
                <nav className="flex min-w-0 flex-1 gap-1 overflow-x-auto" aria-label="Resource categories">
                    {tabs.map((tab) => (
                        <button key={tab} type="button" onClick={() => onTabChange(tab)} aria-current={activeTab === tab ? "page" : undefined} className={`shrink-0 cursor-pointer rounded-full px-4 py-2 text-sm transition-colors ${activeTab === tab ? (isDark ? "bg-white/15 text-white" : "bg-black/10 text-black") : (isDark ? "text-white/60 hover:bg-white/6 hover:text-white" : "text-black/60 hover:bg-black/5 hover:text-black")}`}>{tab}</button>
                    ))}
                </nav>
                {canCreateFolder && (
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <button type="button" aria-label="New" className={`inline-flex shrink-0 cursor-pointer items-center gap-2 rounded-full border px-4 py-3 text-sm font-medium transition-colors ${isDark ? "bg-white text-black hover:bg-white/85" : "bg-black text-white hover:bg-black/85"}`}>
                                <span>New</span><ChevronDown className="h-4 w-4" />
                            </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className={`w-52 p-2 ${isDark ? "border-white/10 bg-[#252525] text-white" : "border-black/10 bg-white text-black"}`}>
                            <DropdownMenuItem onSelect={onCreateFile} className={`cursor-pointer gap-3 px-3 py-2.5 ${isDark ? "focus:bg-white/10" : "focus:bg-black/5"}`}><FilePlus2 className="h-4 w-4" />New file</DropdownMenuItem>
                            <DropdownMenuItem onSelect={onUploadFiles} className={`cursor-pointer gap-3 px-3 py-2.5 ${isDark ? "focus:bg-white/10" : "focus:bg-black/5"}`}><Upload className="h-4 w-4" />Upload file</DropdownMenuItem>
                            <DropdownMenuItem onSelect={onCreateFolder} className={`cursor-pointer gap-3 px-3 py-2.5 ${isDark ? "focus:bg-white/10" : "focus:bg-black/5"}`}><FolderPlus className="h-4 w-4" />Create folder</DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                )}
            </div>
        </header>
    );
}
