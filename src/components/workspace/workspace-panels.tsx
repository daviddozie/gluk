import { useEffect, useMemo, useState } from "react";
import { ArrowRight, Bot, Download, FolderKanban, FolderOpen, LoaderCircle, MessageSquareText, MoreHorizontal, Plus, Search, Share2, Trash2, X } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { FileIcon, getFileCategory } from "@public/svg/icon";
import WorkspaceResourceUploader from "@/components/workspace/workspace-resource-uploader";

export type WorkspaceProject = { id: string; name: string; description: string; createdAt: string; createdBy?: string };
export type WorkspaceResource = { id: string; projectId: string | null; name: string; type: string; url: string; sourceUrl?: string; createdAt: string };
export type WorkspacePersonalResource = { name: string; type: string; url: string; uploadedAt?: string };

function formatResourceDate(dateString?: string): string {
  if (!dateString) return "";
  const date = new Date(dateString);
  if (Number.isNaN(date.getTime())) return "";
  const d = date.getDate().toString().padStart(2, "0");
  const m = (date.getMonth() + 1).toString().padStart(2, "0");
  const y = date.getFullYear();
  return `${d}/${m}/${y}`;
}

type ProjectsPanelProps = {
  workspaceId: string;
  projects: WorkspaceProject[];
  resources?: WorkspaceResource[];
  personalResources?: WorkspacePersonalResource[];
  isLoading: boolean;
  name: string;
  description: string;
  isCreating: boolean;
  onNameChange: (value: string) => void;
  onDescriptionChange: (value: string) => void;
  onCreate: () => void;
  onResourceUploaded?: () => void;
  onAskGlukAboutProject?: (project: WorkspaceProject) => void;
  onSharePersonalResource?: (url: string, projectId?: string | null) => Promise<void> | void;
  onAttachWorkspaceResource?: (resourceId: string, projectId: string | null) => Promise<void> | void;
  onDeleteWorkspaceResource?: (resourceId: string) => Promise<void> | void;
  onPreview?: (file: { name: string; url?: string; type?: string }) => void;
};

export function WorkspaceProjectsPanel({
  workspaceId,
  projects,
  resources = [],
  personalResources = [],
  isLoading,
  name,
  description,
  isCreating,
  onNameChange,
  onDescriptionChange,
  onCreate,
  onResourceUploaded,
  onAskGlukAboutProject,
  onSharePersonalResource,
  onAttachWorkspaceResource,
  onDeleteWorkspaceResource,
  onPreview,
}: ProjectsPanelProps) {
  const [selectedProject, setSelectedProject] = useState<WorkspaceProject | null>(null);
  const [attachModalOpen, setAttachModalOpen] = useState(false);
  const [detachingId, setDetachingId] = useState<string | null>(null);

  const projectResources = selectedProject
    ? resources.filter((res) => res.projectId === selectedProject.id)
    : [];

  return (
    <section className="grid content-start gap-6 py-6 xl:grid-cols-[minmax(0,1fr)_360px] xl:gap-8">
      <div className="min-w-0">
        <div className="mb-5 flex items-end justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold tracking-tight">Projects</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Organize workspace work into focused initiatives and research tracks.
            </p>
          </div>
          <Badge variant="subtle" className="px-2.5 py-1 text-xs">
            {projects.length} {projects.length === 1 ? "project" : "projects"}
          </Badge>
        </div>
        {isLoading ? (
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="h-40 animate-pulse rounded-2xl bg-muted" />
            <div className="h-40 animate-pulse rounded-2xl bg-muted" />
          </div>
        ) : projects.length ? (
          <div className="grid gap-3 sm:grid-cols-2">
            {projects.map((project) => {
              const count = resources.filter((r) => r.projectId === project.id).length;
              return (
                <article
                  key={project.id}
                  onClick={() => setSelectedProject(project)}
                  tabIndex={0}
                  role="button"
                  aria-label={`Open project ${project.name}`}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      setSelectedProject(project);
                    }
                  }}
                  className="group relative flex min-h-40 cursor-pointer flex-col justify-between rounded-2xl border border-border/80 bg-card p-5 transition-all hover:border-primary/40 hover:bg-muted/15 hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <div>
                    <div className="flex items-center justify-between">
                      <div className="grid h-9 w-9 place-items-center rounded-xl bg-muted text-muted-foreground transition-colors group-hover:bg-primary/10 group-hover:text-primary">
                        <FolderKanban className="h-5 w-5" />
                      </div>
                      <Badge variant="subtle" className="text-[11px] font-normal">
                        {count} {count === 1 ? "resource" : "resources"}
                      </Badge>
                    </div>
                    <h3 className="mt-4 truncate font-medium text-foreground transition-colors group-hover:text-primary">
                      {project.name}
                    </h3>
                    <p className="mt-1 line-clamp-2 min-h-10 text-sm leading-5 text-muted-foreground">
                      {project.description || "A focused project in this workspace."}
                    </p>
                  </div>
                  <div className="mt-3 flex items-center justify-between border-t border-border/40 pt-3 text-[11px] text-muted-foreground">
                    <span>
                      Created {new Date(project.createdAt).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                    </span>
                    <span className="flex items-center gap-1 font-medium text-foreground opacity-0 transition-opacity group-hover:opacity-100">
                      View details <ArrowRight className="h-3 w-3" />
                    </span>
                  </div>
                </article>
              );
            })}
          </div>
        ) : (
          <div className="grid min-h-56 place-items-center rounded-2xl border border-dashed border-border bg-muted/10 p-8 text-center">
            <div className="max-w-xs">
              <span className="mx-auto grid h-11 w-11 place-items-center rounded-xl bg-muted text-muted-foreground">
                <FolderKanban className="h-5 w-5" />
              </span>
              <h3 className="mt-3 text-sm font-medium">No projects yet</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                Create a project to give your workspace work a clear home.
              </p>
            </div>
          </div>
        )}
      </div>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          onCreate();
        }}
        className="h-fit rounded-2xl border border-border/80 bg-card p-5 shadow-sm xl:sticky xl:top-6"
      >
        <div className="mb-5">
          <h2 className="font-semibold">Create a project</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Give a shared initiative a name and a little context.
          </p>
        </div>
        <input
          required
          maxLength={100}
          value={name}
          onChange={(event) => onNameChange(event.target.value)}
          placeholder="Project name"
          className="w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm outline-none placeholder:text-muted-foreground focus:ring-2 focus:ring-ring"
        />
        <textarea
          value={description}
          onChange={(event) => onDescriptionChange(event.target.value)}
          placeholder="Description (optional)"
          rows={3}
          className="mt-3 w-full resize-y rounded-xl border border-border bg-background px-3 py-2.5 text-sm outline-none placeholder:text-muted-foreground focus:ring-2 focus:ring-ring"
        />
        <button
          disabled={isCreating}
          className="mt-4 flex w-full items-center justify-center gap-2 rounded-full bg-foreground px-4 py-2.5 text-background disabled:opacity-50"
        >
          {isCreating ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
          Create project
        </button>
      </form>

      {/* Project Detail Sheet */}
      <Sheet open={Boolean(selectedProject)} onOpenChange={(open) => { if (!open) setSelectedProject(null); }}>
        <SheetContent side="right" className="flex flex-col w-full sm:max-w-lg md:max-w-xl overflow-y-auto">
          {selectedProject && (
            <>
              <SheetHeader className="pb-4 border-b border-border/60">
                <div className="flex items-center gap-2">
                  <span className="grid h-8 w-8 place-items-center rounded-lg bg-primary/10 text-primary">
                    <FolderKanban className="h-4 w-4" />
                  </span>
                  <Badge variant="outline" className="text-[11px] font-normal">
                    Project
                  </Badge>
                </div>
                <SheetTitle className="text-xl font-semibold mt-1">
                  {selectedProject.name}
                </SheetTitle>
                <SheetDescription className="text-sm text-muted-foreground mt-0.5 leading-relaxed">
                  {selectedProject.description || "No description provided for this project."}
                </SheetDescription>
                <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                  <span>
                    Created {new Date(selectedProject.createdAt).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}
                  </span>
                  {selectedProject.createdBy && <span>· By {selectedProject.createdBy}</span>}
                </div>
              </SheetHeader>

              {/* Quick actions: Ask Gluk */}
              {onAskGlukAboutProject && (
                <div className="pt-1">
                  <Button
                    onClick={() => {
                      onAskGlukAboutProject(selectedProject);
                      setSelectedProject(null);
                    }}
                    className="w-full h-10 justify-center gap-2 rounded-full bg-white text-black font-medium text-xs sm:text-sm hover:bg-white/90 shadow-sm border-0 transition-all cursor-pointer"
                  >
                    <Bot className="h-4 w-4 text-black" />
                    Ask @Gluk about {selectedProject.name}
                  </Button>
                </div>
              )}

              {/* Attached Resources */}
              <div className="flex-1 space-y-4 pt-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <h4 className="text-sm font-semibold tracking-tight">Attached Resources</h4>
                    <Badge variant="subtle" className="text-xs">
                      {projectResources.length} {projectResources.length === 1 ? "file" : "files"}
                    </Badge>
                  </div>
                  {/* <Button
                    size="sm"
                    onClick={() => setAttachModalOpen(true)}
                    className="h-9 px-3.5 gap-1.5 rounded-full text-xs font-semibold bg-white text-black hover:bg-white/90 shadow-sm border-0 transition-all cursor-pointer"
                  >
                    <FolderOpen className="h-3.5 w-3.5 text-black" />
                    Select from resources
                  </Button> */}
                </div>

                {projectResources.length > 0 ? (
                  <div className="grid grid-cols-2 gap-3 max-h-[380px] overflow-y-auto pr-1">
                    {projectResources.map((res) => {
                      const category = getFileCategory(res.name, res.type);
                      const formattedDate = formatResourceDate(res.createdAt);
                      return (
                        <div
                          key={res.id}
                          role="button"
                          tabIndex={0}
                          onClick={() =>
                            onPreview?.({
                              name: res.name,
                              url: res.url,
                              type: res.type,
                            })
                          }
                          onKeyDown={(e) => {
                            if (e.key === "Enter" || e.key === " ") {
                              e.preventDefault();
                              onPreview?.({
                                name: res.name,
                                url: res.url,
                                type: res.type,
                              });
                            }
                          }}
                          className="group relative flex h-[152px] flex-col justify-between rounded-md border border-border/80 bg-card p-3.5 transition-all hover:border-border hover:bg-muted/15 cursor-pointer select-none"
                        >
                          <div className="flex items-start justify-between gap-1.5">
                            <span
                              className="line-clamp-2 text-xs font-medium text-foreground group-hover:underline"
                              title={res.name}
                            >
                              {res.name}
                            </span>
                            <div className="flex items-center gap-0.5 shrink-0" onClick={(e) => e.stopPropagation()}>
                              {onAttachWorkspaceResource && (
                                <button
                                  type="button"
                                  title="Detach from project"
                                  disabled={detachingId === res.id}
                                  onClick={async (e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    setDetachingId(res.id);
                                    try {
                                      const isFromPersonal = personalResources.some(
                                        (pr) =>
                                          (res.sourceUrl && pr.url === res.sourceUrl) ||
                                          pr.name === res.name
                                      );
                                      if (isFromPersonal && onDeleteWorkspaceResource) {
                                        await onDeleteWorkspaceResource(res.id);
                                      } else {
                                        await onAttachWorkspaceResource(res.id, null);
                                      }
                                    } finally {
                                      setDetachingId(null);
                                    }
                                  }}
                                  className="cursor-pointer rounded-md p-1 text-muted-foreground opacity-60 hover:opacity-100 hover:bg-destructive/10 hover:text-destructive disabled:opacity-30"
                                >
                                  {detachingId === res.id ? (
                                    <LoaderCircle className="h-3 w-3 animate-spin" />
                                  ) : (
                                    <X className="h-3 w-3" />
                                  )}
                                  <span className="sr-only">Detach</span>
                                </button>
                              )}
                            </div>
                          </div>

                          <ResourceCardVisual
                            name={res.name}
                            type={res.type}
                            url={res.sourceUrl || res.url}
                            category={category}
                          />

                          <div className="text-[11px] text-muted-foreground/75 truncate">
                            {formattedDate ? `Uploaded ${formattedDate} · ` : ""}
                            {category.toUpperCase()}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="rounded-xl border border-dashed border-border bg-muted/10 p-5 text-center">
                    <FolderOpen className="mx-auto h-7 w-7 text-muted-foreground/60" />
                    <p className="mt-2 text-xs font-medium">No resources linked to this project</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      Choose from existing resources or upload a new file below.
                    </p>
                    <Button
                      size="sm"
                      onClick={() => setAttachModalOpen(true)}
                      className="mt-3.5 h-10 px-4 gap-1.5 rounded-full text-xs font-semibold bg-white text-black hover:bg-white/90 shadow-sm border-0 transition-all cursor-pointer"
                    >
                      <FolderOpen className="h-4 w-4 text-black" />
                      Select from resources
                    </Button>
                  </div>
                )}

                {/* Upload or select options */}
                <div className="pt-2 space-y-2">
                  <WorkspaceResourceUploader
                    workspaceId={workspaceId}
                    projectId={selectedProject.id}
                    title={`Upload to ${selectedProject.name}`}
                    description="Uploaded files will be tagged and accessible to this project."
                    onUploaded={() => {
                      onResourceUploaded?.();
                    }}
                  />
                  <Button
                    size="sm"
                    onClick={() => setAttachModalOpen(true)}
                    className="w-full h-11 justify-center gap-2 rounded-full text-xs sm:text-sm font-medium bg-white text-black hover:bg-white/90 shadow-sm border-0 transition-all cursor-pointer"
                  >
                    <FolderOpen className="h-4 w-4 text-black" />
                    Or select from existing resources
                  </Button>
                </div>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>

      {/* Attach Resources Modal */}
      {selectedProject && (
        <AttachProjectResourceDialog
          open={attachModalOpen}
          onOpenChange={setAttachModalOpen}
          project={selectedProject}
          workspaceResources={resources}
          personalResources={personalResources}
          onAttachWorkspaceResource={onAttachWorkspaceResource}
          onSharePersonalResource={onSharePersonalResource}
          onDeleteWorkspaceResource={onDeleteWorkspaceResource}
        />
      )}
    </section>
  );
}

export type AttachResourceDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  project?: WorkspaceProject | null;
  workspaceResources: WorkspaceResource[];
  personalResources: WorkspacePersonalResource[];
  initialTab?: "workspace" | "personal";
  onAttachWorkspaceResource?: (resourceId: string, projectId: string | null) => Promise<void> | void;
  onSharePersonalResource?: (url: string, projectId?: string | null) => Promise<void> | void;
  onDeleteWorkspaceResource?: (resourceId: string) => Promise<void> | void;
  onSelectResourceUrl?: (url: string) => void;
};

export function ResourceCardVisual({
  name,
  type,
  url,
  category,
}: {
  name: string;
  type?: string;
  url: string;
  category: string;
}) {
  const [imgError, setImgError] = useState(false);

  if (category === "image" && !imgError && url) {
    return (
      <div className="my-1.5 flex h-[62px] w-full items-center justify-center overflow-hidden rounded-md bg-muted/30 border border-border/50">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={url}
          alt={name}
          loading="lazy"
          onError={() => setImgError(true)}
          className="h-full w-full object-cover transition-transform duration-200 group-hover:scale-105"
        />
      </div>
    );
  }

  return (
    <div className="flex flex-1 items-center justify-center py-1 transition-transform group-hover:scale-105">
      <FileIcon fileName={name} fileType={type} size={36} />
    </div>
  );
}

export function AttachProjectResourceDialog({
  open,
  onOpenChange,
  project,
  workspaceResources,
  personalResources,
  initialTab,
  onAttachWorkspaceResource,
  onSharePersonalResource,
  onDeleteWorkspaceResource,
  onSelectResourceUrl,
}: AttachResourceDialogProps) {
  const [activeTab, setActiveTab] = useState<"workspace" | "personal">(
    initialTab || (project ? "workspace" : "personal")
  );
  const [search, setSearch] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  const initialWorkspaceAttached = useMemo(
    () => new Set(project ? workspaceResources.filter((r) => r.projectId === project.id).map((r) => r.id) : []),
    [workspaceResources, project]
  );

  const initialPersonalAttachedUrls = useMemo(() => {
    if (project) {
      return new Set(
        personalResources
          .filter((pr) =>
            workspaceResources.some(
              (wr) =>
                wr.projectId === project.id &&
                ((wr.sourceUrl && wr.sourceUrl === pr.url) || wr.url === pr.url || wr.name === pr.name)
            )
          )
          .map((pr) => pr.url)
      );
    }
    return new Set(
      personalResources
        .filter((pr) =>
          workspaceResources.some(
            (wr) =>
              (wr.sourceUrl && wr.sourceUrl === pr.url) || wr.url === pr.url || wr.name === pr.name
          )
        )
        .map((pr) => pr.url)
    );
  }, [personalResources, workspaceResources, project]);

  // Optimistic local selection sets
  const [selectedWorkspaceIds, setSelectedWorkspaceIds] = useState<Set<string>>(
    () => new Set(initialWorkspaceAttached)
  );

  const [selectedPersonalUrls, setSelectedPersonalUrls] = useState<Set<string>>(
    () => new Set(initialPersonalAttachedUrls)
  );

  // Sync state whenever dialog opens or project changes
  useEffect(() => {
    if (open) {
      setActiveTab(initialTab || (project ? "workspace" : "personal"));
      setSelectedWorkspaceIds(new Set(initialWorkspaceAttached));
      setSelectedPersonalUrls(new Set(initialPersonalAttachedUrls));
      setSearch("");
    }
  }, [open, project, initialWorkspaceAttached, initialPersonalAttachedUrls, initialTab]);

  const query = search.trim().toLowerCase();

  const filteredWorkspace = workspaceResources.filter((r) =>
    r.name.toLowerCase().includes(query)
  );

  const filteredPersonal = personalResources.filter((r) =>
    r.name.toLowerCase().includes(query)
  );

  const toggleWorkspaceResource = (resourceId: string) => {
    if (!project) return;
    setSelectedWorkspaceIds((prev) => {
      const next = new Set(prev);
      if (next.has(resourceId)) next.delete(resourceId);
      else next.add(resourceId);
      return next;
    });
  };

  const togglePersonalResource = (url: string) => {
    setSelectedPersonalUrls((prev) => {
      const next = new Set(prev);
      if (next.has(url)) next.delete(url);
      else next.add(url);
      return next;
    });
  };

  const totalSelected = project
    ? selectedWorkspaceIds.size + selectedPersonalUrls.size
    : selectedPersonalUrls.size;

  const handleCommit = async () => {
    setIsSaving(true);
    try {
      const tasks: Promise<unknown>[] = [];

      if (project) {
        // 1. Workspace resources newly selected
        for (const id of selectedWorkspaceIds) {
          if (!initialWorkspaceAttached.has(id) && onAttachWorkspaceResource) {
            tasks.push(Promise.resolve(onAttachWorkspaceResource(id, project.id)));
          }
        }

        // 2. Workspace resources unselected
        for (const id of initialWorkspaceAttached) {
          if (!selectedWorkspaceIds.has(id)) {
            const wr = workspaceResources.find((r) => r.id === id);
            const isFromPersonal =
              wr &&
              personalResources.some(
                (pr) => (wr.sourceUrl && wr.sourceUrl === pr.url) || wr.name === pr.name
              );
            if (isFromPersonal && onDeleteWorkspaceResource) {
              tasks.push(Promise.resolve(onDeleteWorkspaceResource(id)));
            } else if (onAttachWorkspaceResource) {
              tasks.push(Promise.resolve(onAttachWorkspaceResource(id, null)));
            }
          }
        }

        // 3. Personal resources newly selected
        for (const url of selectedPersonalUrls) {
          if (!initialPersonalAttachedUrls.has(url)) {
            const pr = personalResources.find((p) => p.url === url);
            const existingWr = workspaceResources.find(
              (wr) =>
                (wr.sourceUrl && wr.sourceUrl === url) ||
                (pr && wr.name === pr.name)
            );
            if (existingWr && onAttachWorkspaceResource) {
              tasks.push(Promise.resolve(onAttachWorkspaceResource(existingWr.id, project.id)));
            } else if (onSharePersonalResource) {
              tasks.push(Promise.resolve(onSharePersonalResource(url, project.id)));
            }
          }
        }

        // 4. Personal resources unselected (previously attached)
        for (const url of initialPersonalAttachedUrls) {
          if (!selectedPersonalUrls.has(url)) {
            const pr = personalResources.find((p) => p.url === url);
            const matchingAttached = workspaceResources.find(
              (wr) =>
                wr.projectId === project.id &&
                ((wr.sourceUrl && wr.sourceUrl === url) || (pr && wr.name === pr.name))
            );
            if (matchingAttached) {
              if (onDeleteWorkspaceResource) {
                tasks.push(Promise.resolve(onDeleteWorkspaceResource(matchingAttached.id)));
              } else if (onAttachWorkspaceResource) {
                tasks.push(Promise.resolve(onAttachWorkspaceResource(matchingAttached.id, null)));
              }
            }
          }
        }
      } else {
        // Workspace level (no project):
        // 1. Personal resources newly selected
        for (const url of selectedPersonalUrls) {
          if (!initialPersonalAttachedUrls.has(url) && onSharePersonalResource) {
            tasks.push(Promise.resolve(onSharePersonalResource(url, null)));
          }
        }
        // 2. Personal resources unselected
        for (const url of initialPersonalAttachedUrls) {
          if (!selectedPersonalUrls.has(url)) {
            const matchingWr = workspaceResources.find(
              (wr) => (wr.sourceUrl && wr.sourceUrl === url) || wr.url === url
            );
            if (matchingWr && onDeleteWorkspaceResource) {
              tasks.push(Promise.resolve(onDeleteWorkspaceResource(matchingWr.id)));
            }
          }
        }
      }

      if (tasks.length > 0) {
        await Promise.all(tasks);
      }
      if (onSelectResourceUrl && selectedPersonalUrls.size > 0) {
        onSelectResourceUrl(Array.from(selectedPersonalUrls)[0]);
      }
      onOpenChange(false);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(next) => { if (!isSaving) onOpenChange(next); }}>
      <DialogContent className="z-[60] sm:max-w-2xl max-h-[85vh] p-0 gap-0 overflow-hidden flex flex-col rounded-md border border-border bg-card shadow-xl">
        <div className="p-5 pb-3 border-b border-border/60 shrink-0">
          <DialogHeader>
            <DialogTitle className="text-base font-semibold">
              Select from resources
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground mt-0.5">
              {project ? (
                <>Add resources to <span className="font-medium text-foreground">{project.name}</span></>
              ) : (
                "Choose resources from your personal library to share with this workspace."
              )}
            </DialogDescription>
          </DialogHeader>

          {/* Segmented Tab Control */}
          <div className="mt-4 flex items-center gap-1 rounded-sm bg-muted/60 p-1 text-xs">
            <button
              type="button"
              onClick={() => setActiveTab("workspace")}
              className={cn(
                "flex-1 flex items-center justify-center gap-1.5 rounded-sm py-1.5 font-medium transition-all cursor-pointer",
                activeTab === "workspace"
                  ? "bg-background text-foreground shadow-xs"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <span>Workspace Files</span>
              <span className="rounded-full bg-muted px-1.5 py-0.5 text-[10px]">
                {workspaceResources.length}
              </span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("personal")}
              className={cn(
                "flex-1 flex items-center justify-center gap-1.5 rounded-sm py-1.5 font-medium transition-all cursor-pointer",
                activeTab === "personal"
                  ? "bg-background text-foreground shadow-xs"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <span>Personal Library</span>
              <span className="rounded-full bg-muted px-1.5 py-0.5 text-[10px]">
                {personalResources.length}
              </span>
            </button>
          </div>

          {/* Search Input */}
          <div className="mt-3 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search resources..."
              className="w-full rounded-md border border-border bg-background pl-8.5 pr-3 py-2.5 text-xs outline-none focus:ring-1 focus:ring-ring placeholder:text-muted-foreground"
            />
          </div>
        </div>

        {/* Content list */}
        <div className="flex-1 overflow-y-auto p-4 min-h-48 max-h-[420px]">
          {activeTab === "workspace" ? (
            filteredWorkspace.length > 0 ? (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                {filteredWorkspace.map((res) => {
                  const isSelected = project ? selectedWorkspaceIds.has(res.id) : true;
                  const category = getFileCategory(res.name, res.type);
                  const formattedDate = formatResourceDate(res.createdAt);
                  return (
                    <div
                      key={res.id}
                      role="checkbox"
                      aria-checked={isSelected}
                      tabIndex={0}
                      onClick={() => toggleWorkspaceResource(res.id)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          toggleWorkspaceResource(res.id);
                        }
                      }}
                      className={cn(
                        "group relative flex h-[152px] flex-col justify-between rounded-md border p-3.5 transition-all select-none",
                        project ? "cursor-pointer" : "cursor-default",
                        isSelected
                          ? "border-white/50 bg-white/[0.04] ring-1 ring-white/20"
                          : "border-border/80 bg-card hover:border-border hover:bg-muted/15"
                      )}
                    >
                      <div className="flex items-start justify-between gap-1.5">
                        <span
                          className="line-clamp-2 text-xs font-medium text-foreground pr-2"
                          title={res.name}
                        >
                          {res.name}
                        </span>
                        <div className="shrink-0 pt-0.5">
                          {isSelected ? (
                            <span className="grid h-5 w-5 place-items-center rounded-full border-2 border-white bg-white shadow-xs">
                              <span className="h-2 w-2 rounded-full bg-black" />
                            </span>
                          ) : (
                            <span className="grid h-5 w-5 place-items-center rounded-full border-2 border-border/80 bg-background/50 transition-colors group-hover:border-foreground/60" />
                          )}
                        </div>
                      </div>

                      <ResourceCardVisual
                        name={res.name}
                        type={res.type}
                        url={res.sourceUrl || res.url}
                        category={category}
                      />

                      <div className="border-t border-border/40 pt-2 text-[10px] text-muted-foreground truncate">
                        {formattedDate ? `Uploaded ${formattedDate} · ` : ""}
                        {category.toUpperCase()}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="py-12 text-center text-xs text-muted-foreground">
                {search ? "No matching workspace resources found." : "No workspace files found."}
              </div>
            )
          ) : (
            filteredPersonal.length > 0 ? (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                {filteredPersonal.map((res) => {
                  const isSelected = selectedPersonalUrls.has(res.url);
                  const category = getFileCategory(res.name, res.type);
                  const formattedDate = formatResourceDate(res.uploadedAt);
                  return (
                    <div
                      key={res.url}
                      role="checkbox"
                      aria-checked={isSelected}
                      tabIndex={0}
                      onClick={() => togglePersonalResource(res.url)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          togglePersonalResource(res.url);
                        }
                      }}
                      className={cn(
                        "group relative flex h-[152px] flex-col justify-between rounded-md border p-3.5 transition-all cursor-pointer select-none",
                        isSelected
                          ? "border-white/50 bg-white/[0.04] ring-1 ring-white/20"
                          : "border-border/80 bg-card hover:border-border hover:bg-muted/15"
                      )}
                    >
                      <div className="flex items-start justify-between gap-1.5">
                        <span
                          className="line-clamp-2 text-xs font-medium text-foreground pr-2"
                          title={res.name}
                        >
                          {res.name}
                        </span>
                        <div className="shrink-0 pt-0.5">
                          {isSelected ? (
                            <span className="grid h-5 w-5 place-items-center rounded-full border-2 border-white bg-white shadow-xs">
                              <span className="h-2 w-2 rounded-full bg-black" />
                            </span>
                          ) : (
                            <span className="grid h-5 w-5 place-items-center rounded-full border-2 border-border/80 bg-background/50 transition-colors group-hover:border-foreground/60" />
                          )}
                        </div>
                      </div>

                      <ResourceCardVisual
                        name={res.name}
                        type={res.type}
                        url={res.url}
                        category={category}
                      />

                      <div className="border-t border-border/40 pt-2 text-[10px] text-muted-foreground truncate">
                        {formattedDate ? `Uploaded ${formattedDate} · ` : ""}
                        {category.toUpperCase()}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="py-12 text-center text-xs text-muted-foreground">
                {search ? "No matching personal resources found." : "No files in your personal library."}
              </div>
            )
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-border/60 bg-muted/20 px-5 py-3.5 shrink-0 rounded-b-md">
          <span className="text-xs text-muted-foreground">
            {totalSelected > 0 ? (
              <span>
                <strong className="text-foreground font-semibold">{totalSelected}</strong>{" "}
                {totalSelected === 1 ? "resource selected" : "resources selected"}
              </span>
            ) : (
              "No resources selected"
            )}
          </span>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              disabled={isSaving}
              onClick={() => onOpenChange(false)}
              className="h-9 px-3 rounded-md text-xs text-muted-foreground hover:text-foreground cursor-pointer"
            >
              Cancel
            </Button>
            <Button
              size="sm"
              disabled={isSaving}
              onClick={handleCommit}
              className="h-9 px-4 rounded-md text-xs font-semibold bg-white text-black hover:bg-white/90 shadow-xs border-0 cursor-pointer"
            >
              {isSaving ? (
                <span className="flex items-center gap-1.5">
                  <LoaderCircle className="h-3.5 w-3.5 animate-spin" />
                  Saving…
                </span>
              ) : project ? (
                totalSelected > 0 ? (
                  `Attach to ${project.name}`
                ) : (
                  "Done"
                )
              ) : totalSelected > 0 ? (
                totalSelected === 1 ? "Share to workspace" : `Share ${totalSelected} to workspace`
              ) : (
                "Done"
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

type ResourcesPanelProps = {
  workspaceId: string;
  resources: WorkspaceResource[];
  projects: WorkspaceProject[];
  personalResources?: WorkspacePersonalResource[];
  isLoading: boolean;
  isSharing?: boolean;
  selectedProject: string;
  selectedResourceUrl?: string;
  onProjectChange: (value: string) => void;
  onResourcePickerOpen: () => void;
  onShare?: () => void;
  onUploaded: () => void;
  onPreview?: (file: { name: string; url?: string; type?: string }) => void;
  onChatAbout?: (resource: WorkspaceResource) => void;
  onDeleteResource?: (resourceId: string) => void;
  onNotice?: (notice: string) => void;
};

export function WorkspaceResourcesPanel({
  workspaceId,
  resources,
  projects,
  isLoading,
  selectedProject,
  onProjectChange,
  onResourcePickerOpen,
  onUploaded,
  onPreview,
  onChatAbout,
  onDeleteResource,
  onNotice,
}: ResourcesPanelProps) {
  return (
    <section className="grid content-start gap-6 py-6 xl:grid-cols-[minmax(0,1fr)_360px] xl:gap-8">
      <div className="min-w-0">
        <div className="mb-5 flex items-end justify-between gap-4"><div><h2 className="text-lg font-semibold tracking-tight">Shared resources</h2><p className="mt-1 text-sm text-muted-foreground">Files and links available to everyone in this workspace.</p></div><span className="shrink-0 rounded-full bg-muted px-2.5 py-1 text-xs text-muted-foreground">{resources.length} items</span></div>
        {isLoading ? (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <div className="h-[152px] animate-pulse rounded-md bg-muted" />
            <div className="h-[152px] animate-pulse rounded-md bg-muted" />
            <div className="h-[152px] animate-pulse rounded-md bg-muted" />
          </div>
        ) : resources.length ? (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {resources.map((resource) => {
              const category = getFileCategory(resource.name, resource.type);
              const formattedDate = formatResourceDate(resource.createdAt);
              return (
                <div
                  key={resource.id}
                  role="button"
                  tabIndex={0}
                  onClick={() =>
                    onPreview?.({
                      name: resource.name,
                      url: resource.url,
                      type: resource.type,
                    })
                  }
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      onPreview?.({
                        name: resource.name,
                        url: resource.url,
                        type: resource.type,
                      });
                    }
                  }}
                  className="group relative flex h-[152px] flex-col justify-between rounded-md border border-border/80 bg-card p-3.5 transition-all hover:border-border hover:bg-muted/15 cursor-pointer select-none"
                >
                  <div className="flex items-start justify-between gap-1.5">
                    <span
                      className="line-clamp-2 text-xs font-medium text-foreground pr-1 group-hover:underline"
                      title={resource.name}
                    >
                      {resource.name}
                    </span>
                    <div className="shrink-0 -mr-1 -mt-0.5" onClick={(e) => e.stopPropagation()}>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <button
                            type="button"
                            aria-label={`More options for ${resource.name}`}
                            title="More options"
                            className="flex h-7 w-7 cursor-pointer items-center justify-center rounded-md text-muted-foreground opacity-60 transition-colors hover:bg-muted hover:opacity-100 hover:text-foreground"
                          >
                            <MoreHorizontal className="h-4 w-4" />
                          </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-48 p-1.5 z-50">
                          <DropdownMenuItem
                            onSelect={() => onChatAbout?.(resource)}
                            className="cursor-pointer gap-2.5 px-2.5 py-2 text-xs"
                          >
                            <MessageSquareText className="h-3.5 w-3.5 text-muted-foreground" />
                            <span>Chat about this</span>
                          </DropdownMenuItem>

                          <DropdownMenuItem
                            onSelect={() => {
                              const shareUrl = typeof window !== "undefined" ? `${window.location.origin}${resource.url}` : resource.url;
                              if (navigator.share) {
                                navigator.share({ title: resource.name, url: shareUrl }).catch(() => {});
                              } else if (navigator.clipboard) {
                                void navigator.clipboard.writeText(shareUrl).then(
                                  () => onNotice?.("Resource link copied to clipboard"),
                                  () => onNotice?.("Could not copy link")
                                );
                              }
                            }}
                            className="cursor-pointer gap-2.5 px-2.5 py-2 text-xs"
                          >
                            <Share2 className="h-3.5 w-3.5 text-muted-foreground" />
                            <span>Share</span>
                          </DropdownMenuItem>

                          <DropdownMenuItem
                            onSelect={() => {
                              const a = document.createElement("a");
                              a.href = resource.url;
                              a.download = resource.name;
                              document.body.appendChild(a);
                              a.click();
                              document.body.removeChild(a);
                            }}
                            className="cursor-pointer gap-2.5 px-2.5 py-2 text-xs"
                          >
                            <Download className="h-3.5 w-3.5 text-muted-foreground" />
                            <span>Download</span>
                          </DropdownMenuItem>

                          <DropdownMenuSeparator className="my-1" />

                          <DropdownMenuItem
                            onSelect={() => onDeleteResource?.(resource.id)}
                            className="cursor-pointer gap-2.5 px-2.5 py-2 text-xs text-red-500 focus:text-red-500 focus:bg-red-500/10"
                          >
                            <Trash2 className="h-3.5 w-3.5 text-red-500" />
                            <span>Delete</span>
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>

                  <ResourceCardVisual
                    name={resource.name}
                    type={resource.type}
                    url={resource.sourceUrl || resource.url}
                    category={category}
                  />

                  <div className="border-t border-border/40 pt-2 text-[10px] text-muted-foreground truncate">
                    {formattedDate ? `Uploaded ${formattedDate} · ` : ""}
                    {category.toUpperCase()}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="grid min-h-56 place-items-center rounded-2xl border border-dashed border-border bg-muted/10 p-8 text-center">
            <div className="max-w-xs">
              <span className="mx-auto grid h-11 w-11 place-items-center rounded-xl bg-muted text-muted-foreground">
                <FolderOpen className="h-5 w-5" />
              </span>
              <h3 className="mt-3 text-sm font-medium">Nothing shared yet</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                Upload a file or share a resource to make it available to the workspace.
              </p>
            </div>
          </div>
        )}
      </div>
      <div className="space-y-4 xl:sticky xl:top-6 xl:self-start">
        <div className="rounded-2xl border border-border/80 bg-card p-5 shadow-sm">
          <label className="block text-sm font-medium">
            Add uploads to project
            <Select value={selectedProject || "none"} onValueChange={onProjectChange}>
              <SelectTrigger className="mt-2 w-full">
                <SelectValue placeholder="No project" />
              </SelectTrigger>
              <SelectContent className="w-[var(--radix-select-trigger-width)] min-w-[var(--radix-select-trigger-width)]">
                <SelectItem value="none">No project</SelectItem>
                {projects.map((project) => (
                  <SelectItem key={project.id} value={project.id}>
                    {project.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </label>
        </div>
        <WorkspaceResourceUploader workspaceId={workspaceId} projectId={selectedProject} onUploaded={onUploaded} />
        <div className="rounded-2xl border border-border/80 bg-card p-5 shadow-sm">
          <h2 className="font-semibold">Share from your resources</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Choose files in your personal library to share their resource records with workspace members{projects.find((p) => p.id === selectedProject) ? ` and attach to ${projects.find((p) => p.id === selectedProject)?.name}` : ""}.
          </p>
          <Button
            type="button"
            onClick={onResourcePickerOpen}
            className="mt-4 w-full h-11 justify-center gap-2 rounded-full text-xs sm:text-sm font-medium bg-white text-black hover:bg-white/90 shadow-sm border-0 transition-all cursor-pointer"
          >
            <FolderOpen className="h-4 w-4 text-black" />
            Select from resources
          </Button>
        </div>
      </div>
    </section>
  );
}
