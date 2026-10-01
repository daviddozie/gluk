export const queryKeys = {
    conversations: {
        all: ["conversations"] as const,
        list: (userEmail: string) => ["conversations", "list", userEmail] as const,
        detail: (userEmail: string, id: string) => ["conversations", "detail", userEmail, id] as const,
    },
    resources: {
        all: ["resources"] as const,
        list: (userEmail: string) => ["resources", "list", userEmail] as const,
        folders: (userEmail: string) => ["resources", "folders", userEmail] as const,
    },
    workspaces: {
        all: ["workspaces"] as const,
        detail: (id: string) => ["workspace", id] as const,
        messages: (id: string) => ["workspace-messages", id] as const,
        projects: (id: string) => ["workspace-projects", id] as const,
        resources: (id: string) => ["workspace-resources", id] as const,
    },
};
