import { cookies } from 'next/headers';
import { createServerClient, type CookieMethodsServer } from '@supabase/ssr';
import type { Database } from './database.types';
import { SUPABASE_ANON_KEY, SUPABASE_URL, assertSupabaseConfigured } from './config';

/**
 * Server-side Supabase client for server components, route handlers and
 * server actions.
 */
export function createClient() {
  assertSupabaseConfigured();

  const cookieStore = cookies();

  // Annotated explicitly: `createServerClient` accepts a union of the current
  // and deprecated cookie shapes, so inference alone leaves these params `any`.
  const cookieMethods: CookieMethodsServer = {
    getAll() {
      return cookieStore.getAll();
    },
    setAll(cookiesToSet) {
      try {
        cookiesToSet.forEach(({ name, value, options }) =>
          cookieStore.set(name, value, options)
        );
      } catch {
        // Called from a server component, where cookies are read-only.
        // Middleware refreshes the session instead, so this is safe to ignore.
      }
    },
  };

  return createServerClient<Database>(SUPABASE_URL, SUPABASE_ANON_KEY, {
    cookies: cookieMethods,
  });
}
