/**
 * API Route: Subscribe to Push Notifications
 *
 * POST /api/push/subscribe
 *
 * Receives the push subscription from the client and stores it in the database.
 * Requires NEXT_PUBLIC_VAPID_PUBLIC_KEY to be set for subscriptions to work.
 *
 * Request body:
 * {
 *   "endpoint": "https://fcm.googleapis.com/...",
 *   "keys": {
 *     "auth": "...",
 *     "p256dh": "..."
 *   }
 * }
 *
 * Response: { success: boolean, message: string }
 */

import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/queries';
import { createClient } from '@/lib/supabase/server';

export async function POST(request: NextRequest) {
  try {
    // Get current user
    const user = await getCurrentUser();

    if (!user.id) {
      return NextResponse.json(
        { success: false, message: 'Not authenticated' },
        { status: 401 }
      );
    }

    // Parse subscription from request
    const subscription = (await request.json()) as PushSubscriptionJSON;

    if (!subscription?.endpoint) {
      return NextResponse.json(
        { success: false, message: 'Invalid subscription' },
        { status: 400 }
      );
    }

    // Store subscription in database
    const supabase = await createClient();

    // Note: 'push_subscriptions' is added by migration 0022
    const { error } = await supabase.from('push_subscriptions').insert({
      user_id: user.id,
      endpoint: subscription.endpoint,
      auth: subscription.keys?.auth ?? null,
      p256dh: subscription.keys?.p256dh ?? null,
      active: true,
      registered_at: new Date().toISOString(),
    });

    if (error) {
      console.error('Failed to store subscription:', error);
      return NextResponse.json(
        { success: false, message: 'Failed to store subscription' },
        { status: 500 }
      );
    }

    return NextResponse.json(
      { success: true, message: 'Push subscription registered' },
      { status: 201 }
    );
  } catch (error) {
    console.error('Push subscription error:', error);
    return NextResponse.json(
      { success: false, message: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * PushSubscriptionJSON type (matches Web Push API)
 * From @types/web-push
 */
interface PushSubscriptionJSON {
  endpoint: string;
  keys?: {
    auth?: string;
    p256dh?: string;
  };
}
