export interface Resource {
    name: string;
    url: string;
    type: string;
    uploadedAt: string;
    favorite: boolean;
    folder: string | null;
    conversationId: string | null;
    storage: string | null;
    publicId: string | null;
    resourceType: string | null;
}

export interface ResourceReference {
    name: string;
    url: string;
    type: string;
    conversationId: string | null;
}
