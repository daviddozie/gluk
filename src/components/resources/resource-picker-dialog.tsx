"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useSession } from "next-auth/react";
import { FileIcon, getFileCategory } from "@public/svg/icon";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { fetchResources } from "@/lib/queries/resources";
import { queryKeys } from "@/lib/queries/keys";
import { Resource, ResourceReference } from "@/types/resource";

interface ResourcePickerDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    theme: "light" | "dark";
    onSelect: (resource: ResourceReference) => void;
}

export function ResourcePickerDialog({ open, onOpenChange, theme, onSelect }: ResourcePickerDialogProps) {
    const { data: session, status } = useSession();
    const userEmail = session?.user?.email ?? "guest";
    const [search, setSearch] = useState("");
    const resourcesQuery = useQuery({
        queryKey: queryKeys.resources.list(userEmail),
        queryFn: ({ signal }) => fetchResources(signal),
        enabled: open && status === "authenticated" && userEmail !== "guest",
    });
    const resources = useMemo(() => {
        const normalizedSearch = search.trim().toLowerCase();
        return (resourcesQuery.data ?? []).filter((resource: Resource) =>
            !normalizedSearch || resource.name.toLowerCase().includes(normalizedSearch)
        );
    }, [resourcesQuery.data, search]);
    const isDark = theme === "dark";

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className={`w-full sm:max-w-xl ${isDark ? "border-white/10 bg-[#202020] text-white" : "border-black/10 bg-white text-black"}`}>
                <DialogHeader>
                    <DialogTitle>Add from resources</DialogTitle>
                    <DialogDescription className={isDark ? "text-white/55" : "text-black/55"}>Choose a file to attach to your next message.</DialogDescription>
                </DialogHeader>
                <input
                    type="search"
                    autoFocus
                    value={search}
                    onChange={(event: React.ChangeEvent<HTMLInputElement>) => setSearch(event.target.value)}
                    placeholder="Search your files"
                    className={`h-10 w-full rounded-lg border px-3 outline-none focus-visible:ring-2 ${isDark ? "border-white/10 bg-white/5 text-white placeholder:text-white/40 focus-visible:ring-white/20" : "border-black/10 bg-black/[0.03] focus-visible:ring-black/15"}`}
                />
                <div className="max-h-80 overflow-y-auto" aria-live="polite">
                    {status === "loading" || resourcesQuery.isPending ? (
                        <p className={`py-8 text-center text-sm ${isDark ? "text-white/50" : "text-black/50"}`}>Loading your files…</p>
                    ) : status === "unauthenticated" ? (
                        <p className={`py-8 text-center text-sm ${isDark ? "text-white/50" : "text-black/50"}`}>Sign in to browse your library.</p>
                    ) : resourcesQuery.error ? (
                        <p className="py-8 text-center text-sm text-red-400">Could not load your library. Try again.</p>
                    ) : resources.length === 0 ? (
                        <p className={`py-8 text-center text-sm ${isDark ? "text-white/50" : "text-black/50"}`}>{search ? "No files match your search." : "Your library is empty."}</p>
                    ) : (
                        <ul className="space-y-1">
                            {resources.map((resource) => {
                                const isImage = getFileCategory(resource.name, resource.type) === "image";
                                return (
                                    <li key={resource.url}>
                                        <button
                                            type="button"
                                            onClick={() => {
                                                onSelect({ name: resource.name, url: resource.url, type: resource.type, conversationId: resource.conversationId });
                                                onOpenChange(false);
                                                setSearch("");
                                            }}
                                            className={`flex w-full cursor-pointer items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-colors ${isDark ? "hover:bg-white/8 focus:bg-white/8" : "hover:bg-black/5 focus:bg-black/5"}`}
                                        >
                                            {isImage
                                                // eslint-disable-next-line @next/next/no-img-element
                                                ? <img src={resource.url} alt="" className="h-9 w-9 shrink-0 rounded-md object-cover" />
                                                : <FileIcon fileName={resource.name} fileType={resource.type} size={30} />}
                                            <span className="min-w-0 flex-1 truncate text-sm">{resource.name}</span>
                                            {resource.folder && <span className={`max-w-28 truncate text-xs ${isDark ? "text-white/40" : "text-black/45"}`}>{resource.folder}</span>}
                                        </button>
                                    </li>
                                );
                            })}
                        </ul>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    );
}
