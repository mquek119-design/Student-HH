/**
 * Whether a Supabase project is wired up.
 *
 * Two key names are accepted. Supabase's newer projects issue `sb_publishable_…`
 * keys under NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY; older ones issue an `anon`
 * JWT under NEXT_PUBLIC_SUPABASE_ANON_KEY. They are the same thing as far as
 * supabase-js is concerned — both are safe in the browser, and RLS is what
 * actually protects the data.
 *
 * Never read a `service_role` or `sb_secret_…` key here: those bypass RLS and
 * must stay server-side.
 */
export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';

export const SUPABASE_ANON_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
  '';

export const isSupabaseConfigured = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);

export function assertSupabaseConfigured(): void {
  if (!isSupabaseConfigured) {
    throw new Error(
      'Supabase is not configured. Set NEXT_PUBLIC_SUPABASE_URL and ' +
        'NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY (or NEXT_PUBLIC_SUPABASE_ANON_KEY) in .env.local.'
    );
  }
}
