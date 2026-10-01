import ChatApp from "@/components/chat-app";
export default async function WorkspacePage({
  params,
}: {
  params: Promise<{ workspaceId: string }>;
}) {
  const { workspaceId } = await params;
  return <ChatApp initialView="workspace" initialWorkspaceId={workspaceId} />;
}
