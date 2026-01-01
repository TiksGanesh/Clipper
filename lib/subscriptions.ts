/**
 * Subscription management utilities
 * Handles trial subscription creation and management
 */

import { createServiceSupabaseClient } from './supabase'

const TRIAL_DURATION_DAYS = 180

/**
 * Calculate trial end date (current date + 180 days)
 */
export function calculateTrialEndDate(): Date {
  const endDate = new Date()
  endDate.setDate(endDate.getDate() + TRIAL_DURATION_DAYS)
  return endDate
}

/**
 * Create a trial subscription for a shop
 * @param shopId - The shop ID to create subscription for
 * @returns Object with success status and error message if failed
 */
export async function createTrialSubscription(shopId: string): Promise<{ success: boolean; error?: string }> {
  const supabase = createServiceSupabaseClient()
  
  // Check if subscription already exists
  const { data: existingSubscription } = await supabase
    .from('subscriptions')
    .select('id')
    .eq('shop_id', shopId)
    .is('deleted_at', null)
    .maybeSingle()

  if (existingSubscription) {
    // Subscription already exists, no need to create
    return { success: true }
  }

  const now = new Date()
  const trialEndDate = calculateTrialEndDate()

  const { error: subscriptionError } = await (supabase
    .from('subscriptions') as any)
    .insert({
      shop_id: shopId,
      status: 'trial',
      trial_ends_at: trialEndDate.toISOString(),
      current_period_start: now.toISOString(),
      current_period_end: trialEndDate.toISOString(),
    })

  if (subscriptionError) {
    // If error is duplicate (23505), it means subscription was created by another request
    if (subscriptionError.code === '23505') {
      return { success: true }
    }
    
    return { 
      success: false, 
      error: `Failed to create trial subscription: ${subscriptionError.message}` 
    }
  }

  return { success: true }
}
