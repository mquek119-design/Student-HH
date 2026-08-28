/**
 * Migration 0021: Add push notification subscriptions table
 *
 * Stores Web Push API subscriptions for sending notifications to users.
 * Each subscription contains:
 * - endpoint: URL where to send push notifications
 * - auth & p256dh: Encryption keys for the subscription
 * - active: Whether the subscription is still valid
 * - registered_at: When the subscription was created
 *
 * Note: This table is optional. Push notifications will not work unless:
 * 1. This table exists
 * 2. NEXT_PUBLIC_VAPID_PUBLIC_KEY environment variable is set
 * 3. A server-side web-push library is configured with VAPID_PRIVATE_KEY
 */

create table if not exists push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  endpoint text not null,
  -- Encryption keys (base64 encoded)
  auth text,
  p256dh text,
  active boolean default true,
  registered_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now(),

  -- Ensure one subscription per endpoint per user
  unique(user_id, endpoint)
);

-- Index for efficient queries
create index if not exists idx_push_subscriptions_user_id
on push_subscriptions(user_id);

create index if not exists idx_push_subscriptions_active
on push_subscriptions(active);

-- Row-level security (optional - comment out if not using RLS)
-- alter table push_subscriptions enable row level security;

-- Users can only see/manage their own subscriptions
-- create policy "Users can manage own subscriptions"
-- on push_subscriptions
-- for all using (auth.uid() = user_id);
