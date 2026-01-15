# Security Fix: Server-Side Payment Validation

## Problem
The booking confirmation API was trusting the `booking_id` sent from the frontend, which caused failures in multi-tab scenarios where the frontend-supplied ID could be stale or invalid.

## Solution Implemented

### What Changed

**File**: [app/api/bookings/route.ts](app/api/bookings/route.ts)

The POST handler now implements a critical security fix:

#### Before (Vulnerable)
```typescript
if (booking_id) {
    // Trust what frontend sends
    const { data: existingBooking } = await supabase
        .from('bookings')
        .select('id, status, expires_at')
        .eq('id', booking_id)  // ← Uses frontend-supplied ID directly
        .maybeSingle()
    
    if (!existingBooking || existingBooking.status !== 'pending_payment') {
        return error('Booking hold not found')  // ← Multi-tab collision manifests here
    }
}
```

**Problem**: In multi-tab scenario, Tab A sends `booking_id_A`, but the payment gateway linked it to `order_id_A`. If Tab B already confirmed with its order, the slot is taken, and Tab A's `booking_id_A` is invalid.

#### After (Secure)
```typescript
if (razorpay_order_id && razorpay_payment_id) {
    // 1. LOOK UP the booking using razorpay_order_id (trusted source from gateway)
    const { data: payment } = await supabase
        .from('payments')
        .select('id, booking_id, status')
        .eq('razorpay_order_id', razorpay_order_id)  // ← Gateway's ID is source of truth
        .maybeSingle()
    
    if (!payment) {
        return error('Payment record not found')  // ← Clear error
    }
    
    // 2. IDEMPOTENCY: If already paid, return success
    if (payment.status === 'paid') {
        return success(payment.booking_id)  // ← Handles retries gracefully
    }
    
    // 3. USE the authoritative booking_id from payment record
    const trustedBookingId = payment.booking_id
    
    // 4. VALIDATE the booking exists and is still pending
    const { data: booking } = await supabase
        .from('bookings')
        .select('id, status, expires_at')
        .eq('id', trustedBookingId)  // ← Use the trusted ID
        .maybeSingle()
    
    // 5-8. Validate, update booking, update payment
    // ... (full validation chain)
}
```

### How This Solves Multi-Tab Collisions

**Timeline with Fix**:

| Time | Tab A | Tab B |
|------|-------|-------|
| T1 | Creates hold `bookingId_A` | — |
| T2 | Creates payment record with `order_id_A` → `bookingId_A` | — |
| T3 | — | Creates hold `bookingId_B` |
| T4 | — | Creates payment record with `order_id_B` → `bookingId_B` |
| T5 | — | Payment succeeds with `order_id_B` |
| T6 | — | POST /api/bookings with `order_id_B` |
| T7 | — | API looks up: `order_id_B` → finds `payment.booking_id = bookingId_B` ✅ |
| T8 | — | Updates `bookingId_B` to confirmed ✅ |
| T9 | Payment succeeds with `order_id_A` | — |
| T10 | POST /api/bookings with `order_id_A` | — |
| T11 | API looks up: `order_id_A` → finds `payment.booking_id = bookingId_A` ✅ | — |
| T12 | API validates `bookingId_A` is still `pending_payment` ✅ | — |
| T13 | Updates `bookingId_A` to confirmed ✅ | — |

**Key difference**: The API uses `razorpay_order_id` (immutable, from gateway) to find the correct booking, not the frontend-supplied `booking_id`.

---

## Features of This Fix

### 1. **Source of Truth**
- `razorpay_order_id` is the authoritative link between payment and booking
- Frontend-supplied `booking_id` is now optional/informational
- Payment record becomes the single source of truth

### 2. **Idempotency**
- If the same `order_id` is sent twice, the API returns success immediately
- Prevents duplicate confirmations if request is retried
- Handles network flakiness gracefully

### 3. **Clear Error Messages**
- "Payment record not found" — Payment doesn't exist
- "Booking is not awaiting payment confirmation" — Wrong status
- "Booking hold has expired" — Hold timed out
- "Payment order does not match booking" — Validation failure

### 4. **Multi-Tab Safe**
- Each tab's confirmation is independent
- No cross-tab state pollution
- Both tabs can succeed or fail independently

### 5. **Backward Compatible**
- Legacy path still supported: `if (booking_id && !razorpay_order_id)`
- Handles walk-ins and direct bookings (no payment)
- Non-payment bookings still work

---

## Validation Checklist

✅ **Step 1**: Payment record exists (by `razorpay_order_id`)
✅ **Step 2**: Payment is not already confirmed (idempotency)
✅ **Step 3**: Extract booking_id from payment record
✅ **Step 4**: Booking exists
✅ **Step 5**: Booking is in `pending_payment` status
✅ **Step 6**: Booking hold is not expired
✅ **Step 7**: Update booking to `confirmed`
✅ **Step 8**: Update payment record with `razorpay_payment_id`

---

## Frontend Changes

**File**: [components/booking/BookingForm.tsx](components/booking/BookingForm.tsx)

Added clarifying comment:
```tsx
// NOTE: The API will look up the actual booking_id using razorpay_order_id (trusted source from gateway)
// so the booking_id sent here is informational only. This prevents multi-tab collisions.
```

The frontend still sends the `booking_id`, but the API now **validates it against the payment record** rather than trusting it directly.

---

## Testing Recommendations

### Scenario 1: Normal Flow (Single Tab)
- User books slot
- Payment succeeds
- Confirmation succeeds
- **Expected**: Booking status = confirmed ✅

### Scenario 2: Multi-Tab (Both Tabs Complete Payment)
- Tab A: Book slot, payment succeeds
- Tab B: Book slot, payment succeeds
- **Expected**: 
  - First completion succeeds
  - Second completion succeeds (slot is consumed for one tab)
  - ✅ No "Booking hold not found" error

### Scenario 3: Idempotent Retry
- User completes payment
- Network flaky, frontend retries
- Same `order_id` sent twice
- **Expected**: Both requests return 200 ✅

### Scenario 4: Stale booking_id (Multi-Tab Collision)
- Tab A and Tab B both book simultaneously
- Tab B completes payment first (slots may overlap)
- Tab A tries to confirm with stale ID
- **Expected**: API finds correct booking via `order_id`, validates it, and either:
  - ✅ Confirms Tab A's booking (if slot is still valid)
  - ❌ Returns "booking hold has expired" (if Tab B consumed the slot)
  - ✅ Clear error message (not "booking not found")

### Scenario 5: Payment Webhook Retry
- Payment succeeds, user closes browser before confirmation
- Webhook confirms booking independently
- User retries from browser
- **Expected**: Second confirmation returns 200 (idempotent) ✅

---

## Database Dependency

This fix assumes:
- `payments` table has columns: `razorpay_order_id`, `booking_id`, `status`
- `bookings` table has columns: `id`, `status`, `expires_at`
- Payment records are created BEFORE the booking confirmation request

If your schema differs, adjust the queries accordingly.

---

## Related Issues Addressed

1. ✅ **Multi-tab booking collision** — Resolved by using `razorpay_order_id` as source of truth
2. ⚠️ **Dashboard UI (pending_payment status)** — Still needs handling in `AppointmentCard.tsx`
3. ⚠️ **Payment webhook integration** — Should also confirm booking using this same logic

---

## Next Steps

1. **Test the fix** with multi-tab scenarios
2. **Update AppointmentCard.tsx** to handle `pending_payment` status (see CONCURRENCY_BUG_ANALYSIS.md)
3. **Verify payment webhooks** use this same validation logic
4. **Update frontend** to pass `razorpay_order_id` in all payment confirmation requests (already done)
