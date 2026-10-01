"use client";

import { FolderOpen, LoaderCircle } from "lucide-react";
import { Resource } from "@/types/resource";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

export type ResourceDialogState = { action: "rename" | "folder" | "delete"; resource: Resource } | null;
export type FolderDialogState = { action: "rename" | "delete"; folder: string } | null;

interface ResourceDialogsProps {
    isDark: boolean;
    manageDialog: ResourceDialogState;
    setManageDialog: (dialog: ResourceDialogState) => void;
    manageValue: string;
    setManageValue: (value: string) => void;
    folderDialog: FolderDialogState;
    setFolderDialog: (dialog: FolderDialogState) => void;
    folderValue: string;
    setFolderValue: (value: string) => void;
    folderNames: string[];
    folderCounts: Record<string, number>;
    newFolderName: string;
    setNewFolderName: (value: string) => void;
    createFolderOpen: boolean;
    setCreateFolderOpen: (open: boolean) => void;
    resourceMutationPending: boolean;
    folderMutationPending: boolean;
    onSubmitResource: () => void;
    onSubmitFolder: (dialog: Exclude<FolderDialogState, null>) => void;
    onCreateFolder: () => void;
    onCreateAndAssignFolder: () => void;
}

export function ResourceDialogs(props: ResourceDialogsProps) {
    const {
        isDark, manageDialog, setManageDialog, manageValue, setManageValue,
        folderDialog, setFolderDialog, folderValue, setFolderValue, folderNames,
        folderCounts, newFolderName, setNewFolderName, createFolderOpen,
        setCreateFolderOpen, resourceMutationPending,
        folderMutationPending, onSubmitResource, onSubmitFolder, onCreateFolder,
        onCreateAndAssignFolder,
    } = props;
    const surface = isDark ? "border-white/10 bg-[#202020] text-white" : "border-black/10 bg-white text-black";
    const input = `h-10 w-full rounded-lg border px-3 text-sm outline-none focus:ring-2 ${isDark ? "border-white/10 bg-white/5 focus:ring-white/15" : "border-black/10 bg-black/[0.03] focus:ring-black/10"}`;
    const quietButton = `cursor-pointer rounded-lg px-4 py-2 text-sm ${isDark ? "text-white/65 hover:bg-white/8 hover:text-white" : "text-black/65 hover:bg-black/5 hover:text-black"}`;
    const primaryButton = `cursor-pointer rounded-lg px-4 py-2 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-50`;

    return (
        <>
            <Dialog open={manageDialog !== null} onOpenChange={(open) => { if (open || !resourceMutationPending) setManageDialog(open ? manageDialog : null); }}>
                <DialogContent showCloseButton={false} className={`${manageDialog?.action === "folder" ? "sm:max-w-2xl" : "sm:max-w-md"} ${surface}`}>
                    <DialogHeader>
                        <DialogTitle>{manageDialog?.action === "delete" ? "Delete resource?" : manageDialog?.action === "rename" ? "Rename resource" : "Add to folder"}</DialogTitle>
                        <DialogDescription className={isDark ? "text-white/55" : "text-black/55"}>
                            {manageDialog?.action === "delete"
                                ? <>This will remove <strong>{manageDialog.resource.name}</strong> from your Resources library.</>
                                : manageDialog?.action === "folder"
                                    ? "Choose an existing folder, or create a folder and move this resource into it."
                                    : "Choose a clear name for this resource."}
                        </DialogDescription>
                    </DialogHeader>
                    {manageDialog?.action === "folder" ? (
                        <div className="space-y-5">
                            <div>
                                <p className={`mb-2 text-sm font-medium ${isDark ? "text-white/80" : "text-black/80"}`}>Existing folders</p>
                                {folderNames.length ? (
                                    <div className={`max-h-56 space-y-1 overflow-y-auto rounded-xl border p-2 ${isDark ? "border-white/10 bg-black/10" : "border-black/10 bg-black/[0.02]"}`}>
                                        {folderNames.map((folder) => (
                                            <button key={folder} type="button" onClick={() => setManageValue(folder)} aria-pressed={manageValue === folder}
                                                className={`flex w-full cursor-pointer items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm transition-colors ${manageValue === folder ? (isDark ? "bg-white/15 text-white" : "bg-black/10 text-black") : (isDark ? "text-white/75 hover:bg-white/8" : "text-black/75 hover:bg-black/5")}`}>
                                                <FolderOpen className="h-4 w-4 opacity-70" /><span className="min-w-0 flex-1 truncate">{folder}</span>
                                                <span className="text-xs opacity-50">{folderCounts[folder] ?? 0} {(folderCounts[folder] ?? 0) === 1 ? "item" : "items"}</span>
                                            </button>
                                        ))}
                                    </div>
                                ) : <p className={`rounded-xl border px-3 py-4 text-sm ${isDark ? "border-white/10 text-white/50" : "border-black/10 text-black/50"}`}>You have no folders yet.</p>}
                                <button type="button" onClick={() => setManageValue("")} className={`mt-2 cursor-pointer text-xs ${isDark ? "text-white/55 hover:text-white" : "text-black/55 hover:text-black"}`}>Remove from current folder</button>
                            </div>
                            <div className={`border-t pt-4 ${isDark ? "border-white/10" : "border-black/10"}`}>
                                <p className={`mb-2 text-sm font-medium ${isDark ? "text-white/80" : "text-black/80"}`}>Create a new folder</p>
                                <div className="flex flex-col gap-2 sm:flex-row">
                                    <input maxLength={80} value={newFolderName} onChange={(event) => setNewFolderName(event.target.value)}
                                        onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); onCreateAndAssignFolder(); } }}
                                        aria-label="New folder name" placeholder="Folder name"
                                        className={`h-10 min-w-0 flex-1 rounded-lg border px-3 text-sm outline-none focus:ring-2 ${isDark ? "border-white/10 bg-white/5 focus:ring-white/15 placeholder:text-white/35" : "border-black/10 bg-black/[0.03] focus:ring-black/10 placeholder:text-black/35"}`} />
                                    <button type="button" onClick={onCreateAndAssignFolder} disabled={!newFolderName.trim()} className={`inline-flex h-10 shrink-0 cursor-pointer items-center gap-2 rounded-lg px-4 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-50 ${isDark ? "bg-white/10 hover:bg-white/15" : "bg-black/5 hover:bg-black/10"}`}>
                                        Create and move here
                                    </button>
                                </div>
                            </div>
                        </div>
                    ) : manageDialog && manageDialog.action !== "delete" ? (
                        <input autoFocus value={manageValue} onChange={(event) => setManageValue(event.target.value)}
                            onKeyDown={(event) => { if (event.key === "Enter" && !resourceMutationPending) { event.preventDefault(); onSubmitResource(); } }}
                            aria-label="Resource name" className={input} />
                    ) : null}
                    <DialogFooter className="flex-row justify-end">
                        <button type="button" onClick={() => { setManageDialog(null); setNewFolderName(""); }} disabled={resourceMutationPending} className={quietButton}>Cancel</button>
                        <button
                            type="button"
                            onClick={onSubmitResource}
                            disabled={resourceMutationPending}
                            className={`${primaryButton} ${manageDialog?.action === "delete" ? "bg-red-500 text-white hover:bg-red-600" : isDark ? "bg-white text-black hover:bg-white/85" : "bg-black text-white hover:bg-black/85"}`}
                        >
                            {resourceMutationPending && <LoaderCircle className="mr-2 inline h-4 w-4 animate-spin" />}
                            {resourceMutationPending ? (manageDialog?.action === "delete" ? "Deleting…" : "Saving…") : manageDialog?.action === "delete" ? "Delete" : "Save"}
                        </button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <Dialog open={folderDialog !== null} onOpenChange={(open) => { if (open || !folderMutationPending) setFolderDialog(open ? folderDialog : null); }}>
                <DialogContent showCloseButton={false} className={`sm:max-w-md ${surface}`}>
                    <DialogHeader>
                        <DialogTitle>{folderDialog?.action === "delete" ? "Delete folder?" : "Rename folder"}</DialogTitle>
                        <DialogDescription className={isDark ? "text-white/55" : "text-black/55"}>
                            {folderDialog?.action === "delete" ? <>Resources in <strong>{folderDialog.folder}</strong> will stay in your library and become unfiled.</> : "Choose a new name for this folder."}
                        </DialogDescription>
                    </DialogHeader>
                    {folderDialog?.action === "rename" && (
                        <input autoFocus maxLength={80} value={folderValue} onChange={(event) => setFolderValue(event.target.value)}
                            onKeyDown={(event) => { if (event.key === "Enter" && folderValue.trim() && !folderMutationPending) { event.preventDefault(); onSubmitFolder(folderDialog); } }}
                            aria-label="New folder name" className={input} />
                    )}
                    <DialogFooter className="flex-row justify-end">
                        <button type="button" onClick={() => setFolderDialog(null)} disabled={folderMutationPending} className={quietButton}>Cancel</button>
                        <button type="button" onClick={() => folderDialog && onSubmitFolder(folderDialog)}
                            disabled={folderMutationPending || (folderDialog?.action === "rename" && !folderValue.trim())}
                            className={`${primaryButton} ${folderDialog?.action === "delete" ? "bg-red-500 text-white hover:bg-red-600" : isDark ? "bg-white text-black hover:bg-white/85" : "bg-black text-white hover:bg-black/85"}`}>
                            {folderMutationPending && <LoaderCircle className="mr-2 inline h-4 w-4 animate-spin" />}
                            {folderMutationPending ? (folderDialog?.action === "delete" ? "Deleting…" : "Saving…") : folderDialog?.action === "delete" ? "Delete folder" : "Save"}
                        </button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <Dialog open={createFolderOpen} onOpenChange={(open) => { setCreateFolderOpen(open); if (!open) setNewFolderName(""); }}>
                <DialogContent showCloseButton={false} className={`sm:max-w-md ${surface}`}>
                    <DialogHeader><DialogTitle>Create folder</DialogTitle><DialogDescription className={isDark ? "text-white/55" : "text-black/55"}>Create a folder to organize your uploaded resources. You can add resources to it from each resource’s menu.</DialogDescription></DialogHeader>
                    <input autoFocus maxLength={80} value={newFolderName} onChange={(event) => setNewFolderName(event.target.value)}
                        onKeyDown={(event) => { if (event.key === "Enter" && newFolderName.trim()) { event.preventDefault(); onCreateFolder(); } }}
                        aria-label="Folder name" placeholder="Folder name" className={`${input} ${isDark ? "placeholder:text-white/35" : "placeholder:text-black/35"}`} />
                    <DialogFooter className="flex-row justify-end">
                        <button type="button" onClick={() => setCreateFolderOpen(false)} className={quietButton}>Cancel</button>
                        <button type="button" onClick={onCreateFolder} disabled={!newFolderName.trim()} className={`${primaryButton} ${isDark ? "bg-white text-black hover:bg-white/85" : "bg-black text-white hover:bg-black/85"}`}>Create folder</button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    );
}
