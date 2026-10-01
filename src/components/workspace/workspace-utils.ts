import type { Message } from "@/components/workspace/workspace-types";

export const api = async <T,>(url: string, init?: RequestInit): Promise<T> => {
  const isFormData = typeof FormData !== "undefined" && init?.body instanceof FormData;
  const response = await fetch(url, {
    ...init,
    headers: { ...(isFormData ? {} : { "Content-Type": "application/json" }), ...init?.headers },
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "Request failed");
  return data;
};

export function mergeMessages(current: Message[], incoming: Message[]) {
  const keyFor = (item: Message) => item.clientMessageId ? `client:${item.clientMessageId}` : `id:${item.id}`;
  const merged = new Map(current.map((item) => [keyFor(item), item]));
  for (const item of incoming) {
    const key = keyFor(item);
    const previous = merged.get(key);
    merged.set(key, {
      ...previous,
      ...item,
      deliveryStatus: item.deliveryStatus ?? previous?.deliveryStatus,
      isStreaming: item.role === "assistant" ? item.isStreaming ?? false : item.isStreaming ?? previous?.isStreaming,
    });
  }
  return [...merged.values()].sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id));
}
