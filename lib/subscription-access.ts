import { createServerSupabaseClient } from './supabase'

export type SubscriptionCheckResult = 
  | { allowed: true }
  | { allowed: false; reason: 'canceled' | 'expired' | 'trial_ended' | 'period_ended' | 'not_found' | 'past_due' }

/**
 * Check if a shop's subscription allows access to features
 * Used to enforce access control on dashboard and booking pages
 * 
 * Allowed statuses: 'active' (not expired), 'trial' (not expired)
 * Blocked statuses: 'canceled', 'expired', expired trials, expired periods, 'past_due'
 */
export async function checkSubscriptionAccess(shopId: string): Promise<SubscriptionCheckResult> {
  const supabase = await createServerSupabaseClient()
  
  const { data: subscription } = await supabase
    .from('subscriptions')
    .select('status, trial_ends_at, current_period_end')
    .eq('shop_id', shopId)
    .is('deleted_at', null)
    .maybeSingle()
  
  if (!subscription) {
    return { allowed: false, reason: 'not_found' }
  }
  
  // Check explicitly blocked statuses
  if (subscription.status === 'canceled') {
    return { allowed: false, reason: 'canceled' }
  }
  if (subscription.status === 'expired') {
    return { allowed: false, reason: 'expired' }
  }
  if (subscription.status === 'past_due') {
    return { allowed: false, reason: 'past_due' }
  }
  
  // Check trial expiry
  if (subscription.status === 'trial') {
    const trialEnd = subscription.trial_ends_at ? new Date(subscription.trial_ends_at) : null
    if (trialEnd && trialEnd < new Date()) {
      return { allowed: false, reason: 'trial_ended' }
    }
  }
  
  // Check active subscription expiry
  if (subscription.status === 'active') {
    const periodEnd = subscription.current_period_end ? new Date(subscription.current_period_end) : null
    if (periodEnd && periodEnd < new Date()) {
      return { allowed: false, reason: 'period_ended' }
    }
  }
  
  // If we reach here, subscription is either:
  // - 'trial' within valid period
  // - 'active' within valid period
  return { allowed: true }
}
