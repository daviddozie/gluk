import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { importJWK, SignJWT } from "jose";

function required(name: string) {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not configured`);
  return value;
}

export function getSupabaseAdmin(): SupabaseClient {
  return createClient(required("NEXT_PUBLIC_SUPABASE_URL"), required("SUPABASE_SECRET_KEY"), {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export async function createWorkspaceRealtimeToken(email: string, workspaceIds: string[]) {
  const kid = required("SUPABASE_REALTIME_JWT_KID");
  const jwk = JSON.parse(required("SUPABASE_REALTIME_JWT_PRIVATE_JWK"));
  if (jwk.kid !== kid) throw new Error("SUPABASE_REALTIME_JWT_KID must match the private JWK kid");
  if (jwk.kty !== "EC" || jwk.crv !== "P-256" || typeof jwk.d !== "string") {
    throw new Error("SUPABASE_REALTIME_JWT_PRIVATE_JWK must be an ES256 private JWK");
  }
  // CLI-generated key pairs may advertise both usages, while WebCrypto only
  // permits the private EC key to be imported for signing.
  const signingJwk = { ...jwk, alg: "ES256", use: "sig", key_ops: ["sign"] };
  const key = await importJWK(signingJwk, "ES256");
  return new SignJWT({ role: "authenticated", email: email.toLowerCase(), workspace_ids: workspaceIds })
    .setProtectedHeader({ alg: "ES256", kid, typ: "JWT" })
    .setAudience("authenticated")
    .setIssuedAt()
    .setExpirationTime("5m")
    .sign(key);
}

export async function broadcastWorkspaceMessage(workspaceId: string, message: unknown) {
  await broadcastWorkspaceEvent(workspaceId, "message", message);
}

export async function broadcastWorkspaceEvent(workspaceId: string, event: string, payload: unknown) {
  const client = getSupabaseAdmin();
  const channel = client.channel(`workspace:${workspaceId}:messages`, { config: { private: true } });
  try {
    await channel.httpSend(event, payload);
  } finally {
    await client.removeChannel(channel);
  }
}

export function createWorkspaceRealtimeBroadcaster(workspaceId: string) {
  const client = getSupabaseAdmin();
  const channel = client.channel(`workspace:${workspaceId}:messages`, { config: { private: true } });
  return {
    send: (event: string, payload: unknown) => channel.httpSend(event, payload),
    close: () => client.removeChannel(channel),
  };
}

export async function broadcastReadCursor(email: string, workspaceId: string) {
  const client = getSupabaseAdmin();
  const channel = client.channel(`user:${email.toLowerCase()}`, { config: { private: true } });
  try {
    await channel.httpSend("read_cursor_changed", { workspaceId });
  } finally {
    await client.removeChannel(channel);
  }
}
