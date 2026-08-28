/**
 * Tesco Session Database Operations
 *
 * Persists Tesco browser sessions to Supabase so checkout flows
 * can load the collector's authenticated cookies without file-based storage.
 *
 * Note: After running migration 0022_tesco_sessions.sql, regenerate database types:
 * npx supabase gen types typescript --project-id <ref> > src/lib/supabase/database.types.ts
 */

import { createClient } from './server';
import { getCurrentUser } from '@/lib/queries';
import type { TescoSession } from '../../../lib/tesco/providers/tesco/auth';

/**
 * Save a Tesco session to the database.
 * Overwrites any existing session for this user+house.
 */
export async function saveTescoSessionToDb(session: TescoSession): Promise<void> {
  const user = await getCurrentUser();
  if (!user.id || !user.houseId) {
    throw new Error('User must be authenticated and in a house to save Tesco session');
  }

  const supabase = await createClient();

  const { error } = await supabase
    .from('tesco_sessions')
    .upsert(
      {
        user_id: user.id,
        house_id: user.houseId,
        session_data: {
          cookies: session.cookies,
          expiresAt: session.expiresAt,
          lastLogin: session.lastLogin,
        },
        expires_at: session.expiresAt,
        last_updated: new Date().toISOString(),
      },
      {
        onConflict: 'user_id,house_id',
      }
    );

  if (error) {
    throw new Error(`Failed to save Tesco session: ${error.message}`);
  }
}

/**
 * Load a Tesco session from the database.
 * Returns null if no session exists or if the session has expired.
 */
export async function loadTescoSessionFromDb(): Promise<TescoSession | null> {
  const user = await getCurrentUser();
  if (!user.id || !user.houseId) {
    return null;
  }

  const supabase = await createClient();

  const { data, error } = await supabase
    .from('tesco_sessions')
    .select('session_data, expires_at')
    .eq('user_id', user.id)
    .eq('house_id', user.houseId)
    .single();

  if (error || !data) {
    return null;
  }

  // Check if session has expired
  const expiresAt = data.expires_at as string;
  if (new Date(expiresAt) < new Date()) {
    return null;
  }

  // Extract session from session_data JSONB
  const sessionData = data.session_data;
  if (
    !sessionData ||
    typeof sessionData !== 'object' ||
    !('cookies' in sessionData) ||
    !Array.isArray(sessionData.cookies)
  ) {
    return null;
  }

  return {
    cookies: sessionData.cookies,
    expiresAt: sessionData.expiresAt as string,
    lastLogin: sessionData.lastLogin as string,
  };
}

/**
 * Clear the Tesco session from the database.
 */
export async function expireTescoSessionFromDb(): Promise<void> {
  const user = await getCurrentUser();
  if (!user.id || !user.houseId) {
    throw new Error('User must be authenticated and in a house to expire Tesco session');
  }

  const supabase = await createClient();

  const { error } = await supabase
    .from('tesco_sessions')
    .delete()
    .eq('user_id', user.id)
    .eq('house_id', user.houseId);

  if (error) {
    throw new Error(`Failed to expire Tesco session: ${error.message}`);
  }
}

/**
 * Check if a valid Tesco session exists in the database.
 */
export async function hasValidTescoSessionInDb(): Promise<boolean> {
  const session = await loadTescoSessionFromDb();
  return session !== null && session.cookies && session.cookies.length > 0;
}
