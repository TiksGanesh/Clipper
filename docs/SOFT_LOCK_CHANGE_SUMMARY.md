# Soft Lock Implementation - Change Summary

## Overview
Implemented a robust soft lock (hold) mechanism to prevent double-bookings where two users pay for the same time slot. The system reserves slots during payment processing with automatic expiry.

## Files Created

### 1. **Migration: `/supabase/migrations/0010_add_pending_payment_status.sql`**
- Adds `pending_payment` status to `booking_status` enum
- Adds `expires_at` timestamp column to bookings table
- Updates overlap prevention trigger to respect non-expired pending_payment bookings
- Creates index for efficient cleanup of expired holds

### 2. **API Route: `/app/api/bookings/hold.ts`**
- New endpoint for creating slot holds
- Validates barber, services, and shop subscription
- Checks slot availability (no overlapping confirmed/completed bookings or non-expired holds)
- Creates `pending_payment` booking with 10-minute expiry
- Returns `bookingId` and `expiresAt` timestamp
- Returns 409 Conflict if slot is unavailable

### 3. **API Route: `/app/api/bookings/cleanup.ts`**
- New endpoint for cleaning up expired holds
- POST: Removes bookings with expired `expires_at` timestamps
- GET: Returns count of expired bookings (for monitoring)
- Optional authorization via `CLEANUP_SECRET` environment variable
- Soft deletes expired bookings (sets `deleted_at`)

### 4. **Documentation: `/docs/SOFT_LOCK_IMPLEMENTATION.md`**
- Complete implementation guide
- API endpoint specifications
- Database changes explanation
- Setup instructions for periodic cleanup (Vercel Crons, EasyCron, GitHub Actions)
- Error handling guide
- Security considerations
- Testing checklist

## Files Modified

### 1. **API Route: `/app/api/bookings/route.ts`**
**Changes:**
- Added `booking_id` to validation schema (optional UUID)
- Added logging for booking type (create vs update)
- Added update path: if `booking_id` is provided, updates existing `pending_payment` booking instead of creating new one
- Update flow:
  1. Fetches existing pending booking
  2. Validates it's still `pending_payment` status
  3. Checks hold hasn't expired
  4. Updates status to `confirmed` with customer details
  5. Creates payment record

### 2. **Component: `/components/booking/BookingForm.tsx`**
**Changes:**
- Added `holdBookingId` state to track active hold
- Refactored `handlePaymentAndBooking`:
  1. Now calls `/api/bookings/hold` first to reserve slot
  2. Only on success, proceeds with Razorpay payment
  3. Passes `bookingId` from hold to payment handler
  4. Shows appropriate error on 409 (slot unavailable)
- Created new `confirmBookingFromHold` function:
  1. Called after successful payment
  2. Updates pending booking with customer details
  3. Creates payment record
  4. Redirects to confirmation page
- Updated error messages:
  - 409 Conflict: "This slot is no longer available. Please select another time."
  - Payment cancelled: "The slot hold will expire in 10 minutes"
  - Payment failed: "The slot hold will expire in 10 minutes"
- Kept legacy `createBooking` function for backwards compatibility

## Flow Diagram

```
Customer selects slot, proceeds to payment
                ↓
    [1] Call /api/bookings/hold
        - Check slot availability
        - Create pending_payment booking (10 min expiry)
        - Return bookingId
                ↓
            Success? 
           /        \
        Yes          No (409)
         ↓           ↓
    Show payment   Show error
      modal        "Slot unavailable"
         ↓
    Payment completed?
      /         \
    Yes         No
     ↓           ↓
[2] Call /api/bookings   Hold expires
    with booking_id      in 10 mins
    - Update pending →
      confirmed
    - Create payment
    - Show success
```

## Security & Safety

1. **Database-Level Enforcement**: Trigger prevents overlapping bookings
2. **Hold Duration**: 10 minutes prevents slots from being blocked indefinitely
3. **Soft Delete**: Expired bookings are marked with `deleted_at`, not hard deleted
4. **Cleanup Secret**: Optional authorization prevents unauthorized cleanup
5. **RLS Preserved**: Existing Supabase Row Level Security policies unchanged

## Key Design Decisions

1. **Pending Booking Pattern**: Uses actual `pending_payment` booking instead of separate lock table
   - Simpler schema
   - Leverages existing overlap prevention trigger
   - Single source of truth

2. **10-Minute Window**: Balances user experience with slot availability
   - Enough time for payment processing
   - Not so long that slots become unavailable
   - Auto-cleanup prevents stale holds

3. **Soft Delete**: Expired holds remain in database (archived)
   - Audit trail for debugging
   - Can analyze payment abandonment
   - Easier rollback if needed

4. **Optional Cleanup Secret**: Cleanup endpoint is optional but recommended
   - Adds security layer
   - Prevents accidental cleanup
   - Can be disabled in development

## Next Steps

1. **Apply Migration**: Run migration in Supabase
   ```bash
   supabase db push
   ```

2. **Set Cleanup Schedule**: Choose one method:
   - Vercel Crons (add to vercel.json)
   - External service (EasyCron, etc.)
   - GitHub Actions workflow

3. **Set Environment Variable**:
   ```bash
   CLEANUP_SECRET=your-secure-secret-key
   ```

4. **Test**: Use the testing checklist in documentation

5. **Monitor**: Track failed payments and abandoned holds

## Testing Recommendations

1. **Happy Path**: User books successfully with payment
2. **Conflict**: Two users attempt same slot, one gets 409
3. **Timeout**: User abandons payment, slot becomes available after 10 min
4. **Cleanup**: Run cleanup endpoint and verify expired bookings are marked deleted
5. **Persistence**: Verify booking_id persists through payment flow

## Monitoring & Alerts

Consider tracking:
- Hold → Confirmed conversion rate (should be >95%)
- Average hold duration
- Number of concurrent holds per time slot
- Cleanup job execution time
- Failed payment rates

## Rollback Plan

If issues arise:
1. Revert BookingForm.tsx to use `createBooking` directly (skip hold)
2. Database migration is safe (only adds, doesn't remove)
3. Pending bookings can be cleaned manually or auto-cleanup will handle them
4. No data loss if rolled back
