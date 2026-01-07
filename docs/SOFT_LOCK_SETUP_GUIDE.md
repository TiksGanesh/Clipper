# Soft Lock Setup Guide

## Quick Start

This guide helps you set up the soft lock mechanism to prevent double-bookings.

## Prerequisites

- Supabase project with existing database
- Vercel account (for cron jobs)
- Access to run database migrations

## Step 1: Run Database Migration

Apply the soft lock migration to your database:

```bash
# If using Supabase CLI
supabase migration up

# Or apply directly via Supabase dashboard
# Copy contents of supabase/migrations/0009_add_booking_soft_lock.sql
# and run in SQL Editor
```

**What this does**:
- Adds `pending_payment` status to `booking_status` enum
- Adds `expires_at` column to `bookings` table
- Updates overlap trigger to consider pending bookings
- Creates cleanup function for expired bookings

## Step 2: Set Environment Variable

Add the cron secret to your environment:

```bash
# Generate a secure random secret
openssl rand -hex 32

# Add to .env.local (development)
CRON_SECRET=<generated-secret>

# Add to Vercel (production)
vercel env add CRON_SECRET
```

## Step 3: Deploy to Vercel

The `vercel.json` configuration will automatically set up the cron job:

```bash
vercel --prod
```

Vercel will:
- Detect the cron configuration
- Set up a cron job to run every 5 minutes
- Automatically add the `CRON_SECRET` to the authorization header

## Step 4: Verify Setup

### Test the Hold API

```bash
curl -X POST https://your-domain.vercel.app/api/bookings/hold \
  -H "Content-Type: application/json" \
  -d '{
    "barber_id": "your-barber-uuid",
    "service_ids": ["service-uuid"],
    "slot_start": "2026-01-07T10:00:00Z",
    "date": "2026-01-07",
    "timezone_offset": -330
  }'
```

Expected response:
```json
{
  "booking_id": "uuid",
  "expires_at": "2026-01-07T10:10:00Z",
  "message": "Slot held for 10 minutes"
}
```

### Test the Confirm API

```bash
curl -X POST https://your-domain.vercel.app/api/bookings/confirm \
  -H "Content-Type: application/json" \
  -d '{
    "booking_id": "uuid-from-hold-response",
    "customer_name": "Test User",
    "customer_phone": "9876543210"
  }'
```

### Test the Cleanup Job

```bash
curl -X POST https://your-domain.vercel.app/api/bookings/cleanup \
  -H "Authorization: Bearer your-cron-secret"
```

Expected response:
```json
{
  "success": true,
  "deleted_count": 0,
  "message": "Cleaned up 0 expired booking(s)",
  "timestamp": "2026-01-07T10:15:00Z"
}
```

## Step 5: Monitor in Production

### Check Vercel Cron Logs

1. Go to Vercel Dashboard
2. Select your project
3. Navigate to "Cron Jobs" tab
4. View execution logs

### Check Supabase Database

```sql
-- View all pending bookings
SELECT id, customer_name, status, expires_at, created_at
FROM bookings
WHERE status = 'pending_payment'
ORDER BY created_at DESC;

-- View expired pending bookings (should be cleaned by cron)
SELECT id, customer_name, status, expires_at, created_at
FROM bookings
WHERE status = 'pending_payment'
  AND expires_at < NOW();
```

## Troubleshooting

### Issue: Cron job not running

**Solution**:
1. Check Vercel dashboard for cron job status
2. Ensure `vercel.json` is in the root directory
3. Redeploy: `vercel --prod --force`

### Issue: Cleanup returns 401 Unauthorized

**Solution**:
- Ensure `CRON_SECRET` is set in Vercel environment variables
- Vercel automatically adds this to cron requests
- If calling manually, add `Authorization: Bearer {CRON_SECRET}` header

### Issue: Hold API returns 409 for available slots

**Solution**:
1. Check if there are expired pending bookings:
   ```sql
   SELECT * FROM bookings 
   WHERE status = 'pending_payment' 
     AND expires_at < NOW();
   ```
2. Manually trigger cleanup:
   ```bash
   curl -X POST https://your-domain.vercel.app/api/bookings/cleanup \
     -H "Authorization: Bearer your-cron-secret"
   ```

### Issue: Booking confirmed but customer sees "Slot taken"

**Solution**:
- This is a race condition between two users
- One user's hold succeeded, the other got 409
- Working as intended - slot is protected

## Development Testing

### Local Testing (Without Vercel Cron)

Create a test script to manually trigger cleanup:

```typescript
// scripts/test-cleanup.ts
async function testCleanup() {
  const response = await fetch('http://localhost:3000/api/bookings/cleanup', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.CRON_SECRET}`
    }
  })
  
  const data = await response.json()
  console.log('Cleanup result:', data)
}

testCleanup()
```

Run with:
```bash
tsx scripts/test-cleanup.ts
```

### Testing Expired Holds

Temporarily change expiration time for testing:

```typescript
// In /api/bookings/hold/route.ts
// Change from 10 minutes to 1 minute for testing
const expiresAt = new Date(now.getTime() + 1 * 60 * 1000) // 1 minute
```

Then:
1. Create a hold
2. Wait 2 minutes
3. Try to confirm (should get 410 error)
4. Check that cleanup deletes it

## Production Checklist

- [ ] Migration applied to production database
- [ ] `CRON_SECRET` set in Vercel environment variables
- [ ] Application deployed with new endpoints
- [ ] Cron job visible in Vercel dashboard
- [ ] Test hold/confirm flow end-to-end
- [ ] Monitor cron logs for first 24 hours
- [ ] Check database for any stuck pending bookings
- [ ] Update customer support docs with new flow

## Rollback Plan

If issues arise, you can temporarily disable the soft lock:

1. **Keep old booking endpoint active**: The existing `/api/bookings` POST endpoint still works
2. **Frontend rollback**: Revert `BookingForm.tsx` to call `/api/bookings` directly
3. **Deploy frontend only**: `vercel --prod`
4. **Database state**: Pending bookings will be cleaned up automatically

To fully rollback:

```sql
-- Remove pending bookings
DELETE FROM bookings WHERE status = 'pending_payment';

-- Remove the status (requires migration)
-- (This is complex, better to leave it and just stop using it)
```

## Support

For issues or questions:
1. Check the [SOFT_LOCK_IMPLEMENTATION.md](./SOFT_LOCK_IMPLEMENTATION.md) documentation
2. Review Vercel cron logs
3. Check Supabase database logs
4. Contact development team
