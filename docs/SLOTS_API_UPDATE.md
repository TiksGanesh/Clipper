# Slot Retrieval API Update - Exclude Held Slots

## Problem
The slot retrieval API (`/api/slots`) was only excluding confirmed and completed bookings, but not showing slots as unavailable when they were on hold (pending_payment status with non-expired expires_at).

This meant customers could see slots that were already reserved by other users during payment processing, leading to a poor UX and potential double-booking scenarios.

## Solution
Updated the slot retrieval API to filter out slots that are:
1. Booked by confirmed or completed bookings (existing behavior)
2. **NEW**: On hold by other users (pending_payment status with expires_at > NOW())

## Changes Made

### File: `/app/api/slots/route.ts`

**Before:**
```typescript
const { data: bookings, error: bookingsError } = await supabase
    .from('bookings')
    .select('start_time, end_time')
    .eq('barber_id', barberId)
    .is('deleted_at', null)
    .in('status', ['confirmed', 'completed'])  // ← Only these statuses
    .gte('start_time', dayStart.toISOString())
    .lte('start_time', dayEnd.toISOString())
```

**After:**
```typescript
// Fetch all bookings including pending_payment
const { data: bookings, error: bookingsError } = await supabase
    .from('bookings')
    .select('start_time, end_time, status, expires_at')  // ← Include status and expires_at
    .eq('barber_id', barberId)
    .is('deleted_at', null)
    .gte('start_time', dayStart.toISOString())
    .lte('start_time', dayEnd.toISOString())

// Filter to include only confirmed/completed and non-expired pending_payment bookings
const validBookings = (bookings ?? []).filter((booking: any) => {
    const status = booking.status
    // Include confirmed and completed bookings
    if (status === 'confirmed' || status === 'completed') {
        return true
    }
    // Include pending_payment bookings only if not expired
    if (status === 'pending_payment' && booking.expires_at) {
        const expiresAt = new Date(booking.expires_at)
        return expiresAt > new Date()
    }
    return false
})
```

**Conflict Check:**
- Changed from `bookings?.some(...)` to `validBookings?.some(...)`
- This ensures expired holds don't block slots from being available

## How It Works

Now when a customer views available slots:

1. **Confirmed/Completed Bookings**: Excluded (as before)
2. **Active Holds (pending_payment)**: Excluded if `expires_at > NOW()`
3. **Expired Holds**: Included in available slots (hold expired, slot is free)

### Timeline Example
```
T0: User A reserves slot (pending_payment, expires_at = T0+10min)
    → Slot hidden from other users

T0+5min: User B requests slots
         → Slot NOT shown (User A's hold is still valid)

T0+11min: User B requests slots
          → Slot IS shown (User A's hold expired)
```

## Benefits

✅ **Better UX**: Customers don't see slots that are being paid for by other users
✅ **Reduced Confusion**: No more "slot unavailable" errors after selecting from list
✅ **Seamless Integration**: Works perfectly with the 10-minute soft lock expiry
✅ **Database Efficient**: Filters in application (single query, memory filtering)

## Technical Notes

- The filtering is done in application code (not SQL) for clarity and simplicity
- Only non-expired holds are considered "occupied" - expired holds are ignored
- Memory overhead is minimal (only today's bookings + expires_at comparison)
- Fully compatible with existing soft lock mechanism

## Testing

**Manual Test:**
1. User A selects a time slot and clicks "Continue to Payment"
2. Hold is created (pending_payment, expires_at = now + 10 min)
3. User B on different browser requests slots at same time
4. User B should NOT see User A's slot in the list
5. If User A's hold expires or they abandon payment
6. User B should see the slot again (after cleanup or 10-minute wait)

## Build Status
✅ TypeScript compilation: SUCCESSFUL
✅ No errors or type issues
✅ Ready for deployment
