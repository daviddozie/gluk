"use client";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let browserClient: SupabaseClient | null = null;
let clientUrl: string | null = null;

export function getSupabaseBrowser(url: string, key: string) {
  if (!browserClient) {
    browserClient = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
    clientUrl = url;
  } else if (clientUrl !== url) {
    throw new Error("Supabase browser client was initialized for a different project");
  }
  return browserClient;
}
