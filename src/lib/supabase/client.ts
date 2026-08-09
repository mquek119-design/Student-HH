'use client';

import { createBrowserClient } from '@supabase/ssr';
import type { Database } from './database.types';
import { SUPABASE_ANON_KEY, SUPABASE_URL, assertSupabaseConfigured } from './config';

/**
 * Browser-side Supabase client. Only ever sees the anon key — the Tesco session
 * and any service-role key stay on the server.
 */
export function createClient() {
  assertSupabaseConfigured();
  return createBrowserClient<Database>(SUPABASE_URL, SUPABASE_ANON_KEY);
}
