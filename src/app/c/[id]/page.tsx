import ChatApp from "@/components/chat-app";

export default async function ConversationPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <ChatApp initialConversationId={id} />;
}
