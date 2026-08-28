/**
 * Push Notifications Service
 *
 * Server-side push notification logic for key events:
 * - Weekly cycle milestones (planning cutoff, delivery, settlement)
 * - Outstanding balances (payment reminders)
 * - Dietary preference conflicts
 *
 * Note: Subscriptions are registered by the service worker on first page load.
 * This module handles sending notifications to subscribed clients.
 */

import { SupabaseClient } from '@supabase/supabase-js';

export interface PushNotificationPayload {
  title: string;
  body: string;
  tag?: string;
  badge?: string;
  icon?: string;
  data?: Record<string, any>;
}

export interface NotificationEvent {
  userId: string;
  type:
    | 'payment_reminder'
    | 'planning_cutoff'
    | 'delivery_notification'
    | 'settlement_complete'
    | 'dietary_conflict';
  houseId: string;
  payload: PushNotificationPayload;
  timestamp: Date;
}

/**
 * Send a push notification to a subscribed user
 *
 * In production, this would:
 * 1. Look up the user's push subscription endpoints in the database
 * 2. Send the notification via Web Push API (via cloud service)
 * 3. Handle subscription expiry and cleanup
 *
 * For now, this is scaffolded to receive notifications from the client
 * and log them server-side for audit.
 */
export async function sendPushNotification(
  supabase: SupabaseClient,
  event: NotificationEvent
): Promise<{ success: boolean; message: string }> {
  try {
    // In production: fetch user push subscriptions from database
    // const { data: subscriptions } = await supabase
    //   .from('push_subscriptions')
    //   .select('*')
    //   .eq('user_id', event.userId)
    //   .eq('active', true);

    // For now: just log the event for audit
    console.log(`[Push Notification] ${event.type}: ${event.payload.title}`);

    // In production: send via web-push library
    // for (const subscription of subscriptions) {
    //   await webpush.sendNotification(subscription, JSON.stringify(event.payload));
    // }

    return {
      success: true,
      message: `Notification queued: ${event.payload.title}`,
    };
  } catch (error) {
    console.error('Push notification error:', error);
    return {
      success: false,
      message: `Failed to send notification: ${(error as Error).message}`,
    };
  }
}

/**
 * Payment reminder notification
 *
 * Sent to housemates with outstanding balances
 */
export function createPaymentReminder(
  housemate: { name: string; balance: number }
): PushNotificationPayload {
  const amountOwed = (housemate.balance / 100).toFixed(2);

  return {
    title: 'Payment Reminder',
    body: `You owe £${amountOwed}. Settle up?`,
    tag: 'payment-reminder',
    badge: '💸',
    icon: '/badge-payment.png',
    data: {
      action: 'open-split',
      screen: '/split',
    },
  };
}

/**
 * Planning cutoff notification
 *
 * Sent when the weekly plan cutoff time approaches
 */
export function createPlanningCutoffNotification(
  hoursRemaining: number
): PushNotificationPayload {
  return {
    title: 'Planning Cutoff Soon',
    body: `${hoursRemaining}h left to add meals for this week`,
    tag: 'planning-cutoff',
    badge: '⏰',
    icon: '/badge-cutoff.png',
    data: {
      action: 'open-plan',
      screen: '/plan',
    },
  };
}

/**
 * Delivery notification
 *
 * Sent when the order is delivered (requires collector to reconcile)
 */
export function createDeliveryNotification(): PushNotificationPayload {
  return {
    title: 'Order Delivered',
    body: 'Your Tesco order has arrived. Reconcile the delivery?',
    tag: 'delivery-received',
    badge: '🛒',
    icon: '/badge-delivery.png',
    data: {
      action: 'open-split',
      screen: '/split?reconcile=true',
    },
  };
}

/**
 * Settlement complete notification
 *
 * Sent when all housemates have paid and balances are settled
 */
export function createSettlementCompleteNotification(): PushNotificationPayload {
  return {
    title: 'All settled',
    body: 'Balances cleared',
    tag: 'settlement-complete',
    badge: '✓',
    icon: '/badge-settled.png',
    data: {
      action: 'open-home',
      screen: '/plan',
    },
  };
}

/**
 * Dietary conflict notification
 *
 * Sent when a meal conflicts with someone's dietary preferences
 */
export function createDietaryConflictNotification(args: {
  mealName: string;
  conflict: string;
  recipientName: string;
}): PushNotificationPayload {
  return {
    title: 'Dietary Conflict',
    body: `"${args.mealName}" contains ${args.conflict}`,
    tag: 'dietary-conflict',
    badge: '⚠️',
    icon: '/badge-dietary.png',
    data: {
      action: 'open-plan',
      screen: '/plan',
    },
  };
}

/**
 * Register a push notification subscription
 *
 * Called by the service worker after requesting user permission
 * Stores the subscription endpoint in the database for later use
 */
export async function registerPushSubscription(
  supabase: SupabaseClient,
  userId: string,
  subscription: PushSubscriptionJSON
): Promise<{ success: boolean; message: string }> {
  try {
    const { error } = await supabase.from('push_subscriptions').insert({
      user_id: userId,
      endpoint: subscription.endpoint,
      auth: subscription.keys?.auth,
      p256dh: subscription.keys?.p256dh,
      active: true,
      registered_at: new Date().toISOString(),
    });

    if (error) {
      throw error;
    }

    return {
      success: true,
      message: 'Push notifications enabled',
    };
  } catch (error) {
    console.error('Failed to register push subscription:', error);
    return {
      success: false,
      message: `Failed to register: ${(error as Error).message}`,
    };
  }
}

/**
 * Unregister a push notification subscription
 *
 * Called when user disables notifications
 */
export async function unregisterPushSubscription(
  supabase: SupabaseClient,
  userId: string,
  endpoint: string
): Promise<{ success: boolean; message: string }> {
  try {
    const { error } = await supabase
      .from('push_subscriptions')
      .update({ active: false })
      .eq('user_id', userId)
      .eq('endpoint', endpoint);

    if (error) {
      throw error;
    }

    return {
      success: true,
      message: 'Push notifications disabled',
    };
  } catch (error) {
    console.error('Failed to unregister push subscription:', error);
    return {
      success: false,
      message: `Failed to disable: ${(error as Error).message}`,
    };
  }
}
