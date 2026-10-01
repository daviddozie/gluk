-- Workspace Realtime channel authorization. Apply in the Supabase SQL editor.
-- JWTs are minted by the Next.js app with a short expiry and a workspace_ids claim.
create or replace function public.can_access_workspace_topic(topic text)
returns boolean
language sql
stable
as $$
  select (auth.jwt() -> 'workspace_ids') ? split_part(topic, ':', 2)
$$;

create policy "workspace members receive saved messages"
on realtime.messages for select to authenticated
using (
  realtime.topic() ~ '^workspace:[0-9a-fA-F-]{36}:messages$'
  and public.can_access_workspace_topic(realtime.topic())
);

create policy "workspace members receive ephemeral events"
on realtime.messages for select to authenticated
using (
  realtime.topic() ~ '^workspace:[0-9a-fA-F-]{36}:ephemeral$'
  and public.can_access_workspace_topic(realtime.topic())
);

create policy "workspace members publish ephemeral events"
on realtime.messages for insert to authenticated
with check (
  realtime.topic() ~ '^workspace:[0-9a-fA-F-]{36}:ephemeral$'
  and public.can_access_workspace_topic(realtime.topic())
);

create policy "users receive their read cursor updates"
on realtime.messages for select to authenticated
using (
  realtime.topic() = 'user:' || lower(auth.jwt() ->> 'email')
);
