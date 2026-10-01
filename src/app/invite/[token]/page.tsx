import InvitationPage from "@/components/workspace/workspace-invitation";
export default async function InvitePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  return <InvitationPage token={token} />;
}
