"use client";

import { Bookmark, Download, FolderPlus, MessageSquareText, MoreHorizontal, Share2, Trash2 } from "lucide-react";
import { Resource } from "@/types/resource";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

interface ResourceMenuProps {
    resource: Resource;
    isDark: boolean;
    onChat: (resource: Resource) => void;
    onFavorite: (resource: Resource) => void;
    onDownload: (resource: Resource) => void;
    onShare: (resource: Resource) => void;
    onAddToFolder: (resource: Resource) => void;
    onDelete: (resource: Resource) => void;
}

export function ResourceMenu({ resource, isDark, onChat, onFavorite, onDownload, onShare, onAddToFolder, onDelete }: ResourceMenuProps) {
    const itemClass = `cursor-pointer gap-3 px-3 py-2.5 ${isDark ? "focus:bg-white/10" : "focus:bg-black/5"}`;
    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <button type="button" onClick={(event) => event.stopPropagation()} aria-label={`More options for ${resource.name}`} title="More options" className={`flex h-8 w-8 cursor-pointer items-center justify-center rounded-full transition-colors ${isDark ? "bg-white/8 text-white/65 hover:bg-white/15 hover:text-white" : "bg-black/6 text-black/60 hover:bg-black/10 hover:text-black"}`}>
                    <MoreHorizontal className="h-4 w-4" />
                </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className={`w-56 p-2 ${isDark ? "border-white/10 bg-[#252525] text-white" : "border-black/10 bg-white text-black"}`}>
                <DropdownMenuItem onSelect={() => onChat(resource)} className={itemClass}><MessageSquareText className="h-4 w-4" />Chat about this</DropdownMenuItem>
                <DropdownMenuItem onSelect={() => onFavorite(resource)} className={itemClass}><Bookmark className="h-4 w-4" />{resource.favorite ? "Remove from Favorites" : "Add to Favorites"}</DropdownMenuItem>
                <DropdownMenuItem onSelect={() => onDownload(resource)} className={itemClass}><Download className="h-4 w-4" />Download</DropdownMenuItem>
                <DropdownMenuItem onSelect={() => onShare(resource)} className={itemClass}><Share2 className="h-4 w-4" />Share</DropdownMenuItem>
                <DropdownMenuItem onSelect={() => onAddToFolder(resource)} className={itemClass}><FolderPlus className="h-4 w-4" />Add to folder</DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onSelect={() => onDelete(resource)} className="cursor-pointer gap-3 px-3 py-2.5 text-red-400 focus:bg-red-500/10 focus:text-red-400"><Trash2 className="h-4 w-4" />Delete</DropdownMenuItem>
            </DropdownMenuContent>
        </DropdownMenu>
    );
}
