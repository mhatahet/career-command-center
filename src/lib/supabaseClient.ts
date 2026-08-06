/* ============================================================================
   Supabase client
   ----------------------------------------------------------------------------
   Optional. If `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` are not set (the
   default for local dev), `isSupabaseConfigured()` returns false and the rest
   of the app behaves exactly as before — dev bridge, then File System Access,
   then localStorage. No env vars, no behavior change.

   When they are set, this becomes a fourth persistence adapter (see
   `persistence.ts`) and the app requires a signed-in session (see `auth.tsx`)
   before it will read or write, because the `data_files` table's Row-Level
   Security policies only grant access to authenticated requests.
   ========================================================================= */

import { createClient, type SupabaseClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

export function isSupabaseConfigured(): boolean {
  return Boolean(url && anonKey)
}

// Created unconditionally but only ever used behind `isSupabaseConfigured()`
// guards, so a missing config never throws — it just leaves this client idle.
export const supabase: SupabaseClient = createClient(
  url || 'https://placeholder.supabase.co',
  anonKey || 'placeholder-anon-key',
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
    },
  },
)
