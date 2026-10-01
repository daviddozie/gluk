import { LoaderCircle, Mail } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

type WorkspaceDialogMember = { email: string; name: string; role: string };

type WorkspaceDialogsProps = {
  workspaceName: string;
  workspaceRole: string;
  members: WorkspaceDialogMember[];
  inviteOpen: boolean;
  invitePending: boolean;
  inviteEmail: string;
  error: string;
  onInviteOpenChange: (open: boolean) => void;
  onInviteEmailChange: (email: string) => void;
  onInvite: () => void;
};

export function WorkspaceDialogs({
  workspaceName,
  workspaceRole,
  members,
  inviteOpen,
  invitePending,
  inviteEmail,
  error,
  onInviteOpenChange,
  onInviteEmailChange,
  onInvite,
}: WorkspaceDialogsProps) {
  return (
    <Dialog open={inviteOpen} onOpenChange={(next) => { if (!invitePending) onInviteOpenChange(next); }}>
      <DialogContent showCloseButton={!invitePending} className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Invite members</DialogTitle>
          <DialogDescription>
            Invite people to {workspaceName}. They can join after signing in with the invited email.
          </DialogDescription>
        </DialogHeader>
        <div className="mt-2 max-h-64 divide-y divide-border overflow-y-auto rounded-xl border border-border">
          {members.map((member) => (
            <div key={member.email} className="flex items-center gap-3 px-4 py-3">
              <div className="grid h-9 w-9 place-items-center rounded-full bg-muted text-sm font-medium">
                {member.name.slice(0, 1).toUpperCase()}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{member.name}</p>
                <p className="truncate text-xs text-muted-foreground">{member.email}</p>
              </div>
              <span className="rounded-full bg-muted px-2.5 py-1 text-xs capitalize text-muted-foreground">
                {member.role}
              </span>
            </div>
          ))}
        </div>
        {workspaceRole === "owner" ? (
          <form
            onSubmit={(event) => {
              event.preventDefault();
              onInvite();
            }}
            className="mt-4"
          >
            <label className="block text-sm font-medium">
              Email address
              <input
                required
                type="email"
                value={inviteEmail}
                onChange={(event) => onInviteEmailChange(event.target.value)}
                placeholder="name@example.com"
                className="mt-2 w-full rounded-xl border border-border bg-background px-3 py-3 outline-none focus:ring-2 focus:ring-ring"
              />
            </label>
            <p className="mt-2 text-xs text-muted-foreground">
              If email delivery is unavailable, a join link will be provided here.
            </p>
            <DialogFooter className="mt-5">
              <button
                type="button"
                disabled={invitePending}
                onClick={() => onInviteOpenChange(false)}
                className="cursor-pointer rounded-full px-4 py-2.5 text-sm text-muted-foreground hover:bg-muted"
              >
                Close
              </button>
              <button
                disabled={invitePending || !inviteEmail.trim()}
                className="inline-flex items-center gap-2 rounded-full bg-foreground px-4 py-2.5 text-sm font-medium text-background disabled:opacity-50 cursor-pointer"
              >
                {invitePending ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Mail className="h-4 w-4" />}
                {invitePending ? "Sending…" : "Send invitation"}
              </button>
            </DialogFooter>
          </form>
        ) : (
          <p className="mt-4 rounded-xl bg-muted p-3 text-sm text-muted-foreground">
            Only workspace owners can send invitations.
          </p>
        )}
        {error && (
          <div className="whitespace-pre-wrap rounded-xl border border-destructive/30 p-3 text-sm text-destructive">
            {error}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
