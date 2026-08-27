/**
 * Migration 0022: Add Tesco session storage
 *
 * Stores persistent Tesco browser sessions (cookies) in the database
 * so checkout flows can work end-to-end without file-based storage.
 *
 * Each house collector can have one active session. Sessions include:
 * - cookies: array of browser cookies with auth tokens
 * - expires_at: when the session expires
 * - last_updated: when the session was last imported/saved
 */

create table if not exists tesco_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  house_id uuid not null references houses(id) on delete cascade,
  session_data jsonb not null, -- { cookies: Cookie[], expiresAt: string, lastLogin: string }
  last_updated timestamp with time zone default now(),
  expires_at timestamp with time zone not null,

  -- One session per user per house
  unique(user_id, house_id)
);

-- Indexes for efficient queries
create index if not exists idx_tesco_sessions_user_id
on tesco_sessions(user_id);

create index if not exists idx_tesco_sessions_house_id
on tesco_sessions(house_id);

create index if not exists idx_tesco_sessions_expires_at
on tesco_sessions(expires_at);

-- RLS: Only the session owner can read/write their own session
alter table tesco_sessions enable row level security;

create policy "Users can view own tesco sessions"
on tesco_sessions
for select
using (auth.uid() = user_id);

create policy "Users can insert own tesco sessions"
on tesco_sessions
for insert
with check (auth.uid() = user_id);

create policy "Users can update own tesco sessions"
on tesco_sessions
for update
using (auth.uid() = user_id);

create policy "Users can delete own tesco sessions"
on tesco_sessions
for delete
using (auth.uid() = user_id);
