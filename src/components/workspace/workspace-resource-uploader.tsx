"use client";
import { ChangeEvent, useRef, useState } from "react";
import { LoaderCircle, Upload } from "lucide-react";

export default function WorkspaceResourceUploader({
  workspaceId,
  projectId,
  title,
  description,
  onUploaded,
}: {
  workspaceId: string;
  projectId: string;
  title?: string;
  description?: string;
  onUploaded: () => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  async function upload(event: ChangeEvent<HTMLInputElement>) {
    const files = event.currentTarget.files;
    if (!files?.length) return;
    setBusy(true);
    setMessage("");
    try {
      const form = new FormData();
      for (const file of Array.from(files)) form.append("files", file);
      form.append("workspaceId", workspaceId);
      if (projectId) form.append("projectId", projectId);
      const response = await fetch(
        `/api/upload?workspaceId=${encodeURIComponent(workspaceId)}`,
        { method: "POST", body: form },
      );
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Upload failed");
      setMessage(
        `${result.files.length} ${result.files.length === 1 ? "file" : "files"} uploaded`,
      );
      onUploaded();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Upload failed");
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }
  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <h2 className="font-medium">{title ?? "Upload to workspace"}</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        {description ?? "Files become available to workspace members."}
      </p>
      <input
        ref={inputRef}
        type="file"
        multiple
        className="sr-only"
        onChange={upload}
      />
      <button
        type="button"
        disabled={busy}
        onClick={() => inputRef.current?.click()}
        className="mt-4 flex w-full items-center justify-center gap-2 rounded-full border border-border px-4 py-2.5 text-sm hover:bg-muted disabled:opacity-50"
      >
        {busy ? (
          <LoaderCircle className="h-4 w-4 animate-spin" />
        ) : (
          <Upload className="h-4 w-4" />
        )}
        {busy ? "Uploading…" : "Choose files"}
      </button>
      {message && (
        <p role="status" className="mt-3 text-xs text-muted-foreground">
          {message}
        </p>
      )}
    </div>
  );
}
