"use client";

import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

interface NewFileDialogProps {
    open: boolean;
    isDark: boolean;
    fileName: string;
    content: string;
    onOpenChange: (open: boolean) => void;
    onFileNameChange: (name: string) => void;
    onContentChange: (content: string) => void;
    onCreate: () => void;
}

export function NewFileDialog({ open, isDark, fileName, content, onOpenChange, onFileNameChange, onContentChange, onCreate }: NewFileDialogProps) {
    const theme = isDark ? "border-white/10 bg-[#202020] text-white" : "border-black/10 bg-white text-black";
    const field = `w-full rounded-lg border px-3 py-2.5 text-sm outline-none focus:ring-2 ${isDark ? "border-white/10 bg-white/5 focus:ring-white/15 placeholder:text-white/35" : "border-black/10 bg-black/[0.03] focus:ring-black/10 placeholder:text-black/35"}`;
    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent showCloseButton={false} className={`sm:max-w-xl ${theme}`}>
                <DialogHeader>
                    <DialogTitle>New file</DialogTitle>
                    <DialogDescription className={isDark ? "text-white/55" : "text-black/55"}>Create a text or Markdown file in your Resources library.</DialogDescription>
                </DialogHeader>
                <div className="space-y-3">
                    <input autoFocus maxLength={120} value={fileName} onChange={(event) => onFileNameChange(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter" && fileName.trim()) { event.preventDefault(); onCreate(); } }} placeholder="File name (for example, Notes.md)" aria-label="File name" className={field} />
                    <textarea value={content} onChange={(event) => onContentChange(event.target.value)} placeholder="Start writing…" aria-label="File contents" rows={8} className={`${field} resize-y`} />
                </div>
                <DialogFooter className="flex-row justify-end">
                    <button type="button" onClick={() => onOpenChange(false)} className={`cursor-pointer rounded-lg px-4 py-2 text-sm ${isDark ? "text-white/65 hover:bg-white/8" : "text-black/65 hover:bg-black/5"}`}>Cancel</button>
                    <button
                        type="button"
                        onClick={onCreate}
                        disabled={!fileName.trim()}
                        className={`cursor-pointer rounded-lg px-4 py-2 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-50 ${isDark ? "bg-white text-black hover:bg-white/85" : "bg-black text-white hover:bg-black/85"}`}
                    >Create file</button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
