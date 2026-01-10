# Trial Subscription Implementation

## Overview
Automatically creates a 180-day trial subscription for all shops when they are created.

## Changes Made

### 1. New Subscription Helper Module
**File:** `lib/subscriptions.ts`

- `calculateTrialEndDate()`: Calculates current date + 180 days
- `createTrialSubscription(shopId)`: Creates trial subscription for a shop
  - Checks if subscription already exists (idempotent)
  - Sets status to 'trial'
  - Sets trial_ends_at, current_period_start, and current_period_end
  - Handles duplicate subscription errors gracefully

### 2. Shop Setup Flow Integration
**File:** `app/setup/actions.ts`

- Modified `createShopAction()` to call `createTrialSubscription()` after shop creation
- Works for both new shops and updated shops
- Ensures subscription is created immediately when shop is created

### 3. Admin Shop Creation Integration
**File:** `app/admin/(protected)/shops/create/actions.ts`

- Modified `createAdminShopAction()` to call `createTrialSubscription()` after shop and barber creation
- Ensures admin-created shops also get trial subscriptions

### 4. Database Migration
**File:** `supabase/migrations/0007_add_trial_subscriptions.sql`

- One-time migration to create trial subscriptions for existing shops
- Finds all shops without subscriptions and creates 180-day trials
- Safe to run multiple times (no duplicates due to unique constraint)

## Trial Subscription Details

- **Duration:** 180 days from creation date
- **Status:** `trial`
- **Start Date:** Current date/time
- **End Date:** Current date/time + 180 days
- **Razorpay IDs:** NULL (only set when user upgrades to paid)

## Testing the Implementation

### For Existing Shops
1. Run the migration: `supabase migration up`
2. Verify subscriptions were created:
   ```sql
   SELECT s.name, sub.status, sub.trial_ends_at
   FROM shops s
   LEFT JOIN subscriptions sub ON sub.shop_id = s.id
   WHERE s.deleted_at IS NULL;
   ```

### For New Shops (User Signup)
1. Create a new shop via signup flow
2. Complete shop setup (Step 1: Shop Details)
3. Check that subscription is created:
   ```sql
   SELECT * FROM subscriptions WHERE shop_id = '<shop_id>';
   ```
4. Verify status shows as 'trial' in admin dashboard

### For Admin-Created Shops
1. Login to admin panel
2. Create a new shop via `/admin/shops/create`
3. Verify shop appears with 'trial' status
4. Check subscription was created in database

## Expected Behavior

### Before
- New shops showed as `setup_pending` status
- No subscription record existed
- Shops couldn't be properly managed

### After
- New shops show as `trial` status immediately
- Subscription record created automatically
- Trial expires in 180 days
- Shop lifecycle properly tracked

## Database Query to Check Status

```sql
-- Check all shops and their subscription status
SELECT 
  s.id,
  s.name,
  s.created_at as shop_created,
  sub.status as subscription_status,
  sub.trial_ends_at,
  CASE 
    WHEN sub.id IS NULL THEN 'No Subscription'
    WHEN sub.status = 'trial' AND sub.trial_ends_at > NOW() THEN 'Active Trial'
    WHEN sub.status = 'trial' AND sub.trial_ends_at <= NOW() THEN 'Trial Expired'
    ELSE sub.status
  END as computed_status
FROM shops s
LEFT JOIN subscriptions sub ON sub.shop_id = s.id AND sub.deleted_at IS NULL
WHERE s.deleted_at IS NULL
ORDER BY s.created_at DESC;
```

## Rollback Instructions

If you need to rollback:

1. Remove subscription creation calls from:
   - `app/setup/actions.ts` (lines with `createTrialSubscription`)
   - `app/admin/(protected)/shops/create/actions.ts` (lines with `createTrialSubscription`)

2. Delete the helper module:
   - `lib/subscriptions.ts`

3. Rollback the migration:
   ```bash
   # Delete trial subscriptions created by migration
   DELETE FROM subscriptions 
   WHERE razorpay_subscription_id IS NULL 
     AND status = 'trial';
   ```

## Notes

- Trial subscriptions are idempotent - safe to call multiple times
- Duplicate subscription errors are handled gracefully
- No Razorpay integration needed for trials
- Admin users don't need subscriptions (they don't own shops)
