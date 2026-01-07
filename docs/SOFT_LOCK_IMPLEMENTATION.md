# Soft Lock Mechanism for Double-Booking Prevention

## Overview

The soft lock mechanism prevents race conditions where two users attempt to book the same slot simultaneously. It introduces a two-phase booking process:

1. **Hold Phase**: When a user selects a slot, it's immediately held with a `pending_payment` status for 10 minutes
2. **Confirm Phase**: After successful payment, the booking is confirmed and customer details are added

## Implementation Components

### 1. Database Changes (Migration 0009)

**New Booking Status**: `pending_payment`
- Added to the `booking_status` enum
- Represents a slot that is temporarily held but not yet confirmed

**New Column**: `expires_at`
- TIMESTAMPTZ column on the `bookings` table
- Set to current time + 10 minutes when a slot is held
- Cleared (set to NULL) when booking is confirmed

**Updated Overlap Trigger**:
```sql
-- Now considers pending_payment bookings that haven't expired
WHERE status IN ('confirmed', 'completed')
   OR (status = 'pending_payment' AND (expires_at IS NULL OR expires_at > NOW()))
```

**Cleanup Function**:
```sql
cleanup_expired_pending_bookings()
```
- Deletes bookings with `pending_payment` status that have expired
- Returns count of deleted bookings
- Called by the cleanup cron job

### 2. API Endpoints

#### `/api/bookings/hold` (POST)

**Purpose**: Hold a slot before payment processing

**Input**:
```json
{
  "barber_id": "uuid",
  "service_ids": ["uuid", "uuid"],
  "slot_start": "2026-01-07T10:00:00Z",
  "date": "2026-01-07",
  "timezone_offset": -330
}
```

**Success Response** (200):
```json
{
  "booking_id": "uuid",
  "expires_at": "2026-01-07T10:10:00Z",
  "message": "Slot held for 10 minutes"
}
```

**Conflict Response** (409):
```json
{
  "error": "Selected slot is not available or already held by another customer"
}
```

**Business Logic**:
1. Validates services and barber
2. Checks subscription access
3. Computes available slots (including non-expired pending bookings)
4. If slot is available, creates a booking with:
   - `status: 'pending_payment'`
   - `expires_at: NOW() + 10 minutes`
   - Placeholder customer info: name='PENDING', phone='0000000000'
5. Links services to booking
6. Returns booking_id for later confirmation

#### `/api/bookings/confirm` (POST)

**Purpose**: Confirm a held booking after successful payment

**Input**:
```json
{
  "booking_id": "uuid",
  "customer_name": "John Doe",
  "customer_phone": "9876543210",
  "razorpay_payment_id": "pay_xxx",
  "razorpay_order_id": "order_xxx",
  "amount": 50000
}
```

**Success Response** (200):
```json
{
  "booking_id": "uuid",
  "status": "confirmed",
  "message": "Booking confirmed successfully"
}
```

**Error Responses**:
- 404: Booking not found
- 400: Booking is not in pending state
- 410: Booking hold has expired

**Business Logic**:
1. Fetches the pending booking
2. Verifies it's in `pending_payment` status
3. Checks if it hasn't expired
4. Updates booking with:
   - Real customer name and phone
   - `status: 'confirmed'`
   - `expires_at: NULL`
5. Creates payment record if payment details provided

#### `/api/bookings/cleanup` (POST)

**Purpose**: Clean up expired pending bookings (called by cron job)

**Authorization**: Requires `Authorization: Bearer {CRON_SECRET}` header

**Response**:
```json
{
  "success": true,
  "deleted_count": 5,
  "message": "Cleaned up 5 expired booking(s)",
  "timestamp": "2026-01-07T10:15:00Z"
}
```

### 3. Frontend Changes (BookingForm.tsx)

**Updated Flow**:

```typescript
// Old flow (race condition vulnerable):
// selectSlot() -> initiatePayment() -> createBooking()

// New flow (race condition safe):
// selectSlot() -> holdSlot() -> initiatePayment() -> confirmBooking()
```

**Key Changes**:

1. **handlePaymentAndBooking**: 
   - First calls `/api/bookings/hold` to secure the slot
   - Only proceeds to payment if hold is successful
   - Stores `bookingId` for later confirmation

2. **confirmBooking** (replaces createBooking):
   - Called after successful payment
   - Uses `/api/bookings/confirm` to update existing pending booking
   - No longer creates a new booking

3. **Error Handling**:
   - 409 Conflict: Shows user-friendly "slot taken" message
   - Expired hold: Informs user to try again
   - Payment cancellation: Warns user that hold will expire in 10 minutes

### 4. Cron Job Configuration

**Vercel Configuration** (`vercel.json`):
```json
{
  "crons": [
    {
      "path": "/api/bookings/cleanup",
      "schedule": "*/5 * * * *"
    }
  ]
}
```

- Runs every 5 minutes
- Cleans up bookings that have been expired for at least 5 minutes
- Vercel automatically adds the CRON_SECRET header

**Environment Variable**:
```env
CRON_SECRET=your-secure-random-secret
```

## Race Condition Prevention

### Scenario: Two users select the same slot simultaneously

**Without Soft Lock**:
1. User A selects 10:00 AM
2. User B selects 10:00 AM (both see it available)
3. User A completes payment → booking created
4. User B completes payment → booking created (CONFLICT!)
5. Database trigger fails but payment is already captured

**With Soft Lock**:
1. User A selects 10:00 AM → hold API called → booking created with `pending_payment`
2. User B selects 10:00 AM → hold API called → 409 Conflict (slot already held)
3. User B sees: "This slot was just taken. Please select a different time."
4. User A completes payment → confirm API updates booking to `confirmed`
5. No double-booking, no payment issues

### Database-Level Protection

The overlap trigger function ensures atomicity:

```sql
-- Checks for overlapping bookings including non-expired pending ones
IF EXISTS (
    SELECT 1 FROM bookings
    WHERE barber_id = NEW.barber_id
      AND (
        status IN ('confirmed', 'completed')
        OR (status = 'pending_payment' AND expires_at > NOW())
      )
      AND <time overlaps>
) THEN
    RAISE EXCEPTION 'Booking time overlaps...'
END IF;
```

This prevents double-booking even if multiple hold requests reach the database simultaneously (PostgreSQL transaction isolation).

## Hold Expiration Flow

### What happens when a hold expires?

1. **User abandons payment**:
   - Hold expires after 10 minutes
   - Cron job deletes the pending booking
   - Slot becomes available again

2. **User completes payment after expiration**:
   - Confirm API returns 410 Gone
   - Payment is captured but booking fails
   - User sees error message
   - Manual refund required (handled by admin)

3. **User completes payment within 10 minutes**:
   - Confirm API succeeds
   - Booking updated to confirmed
   - No issues

### Preventing Expired Payment Captures

The 10-minute window is generous enough for typical payment flows:
- Razorpay payment initiation: ~2-3 seconds
- User completes UPI/card: ~30-60 seconds
- Payment webhook callback: ~1-2 seconds
- Total: < 2 minutes typically

If a user takes longer than 10 minutes, it's considered an edge case and handled manually.

## Testing Scenarios

### 1. Normal Flow
- User selects slot → hold succeeds → payment succeeds → confirm succeeds
- Expected: Booking created and confirmed

### 2. Concurrent Booking Attempt
- User A holds slot → User B tries to hold same slot
- Expected: User B gets 409 Conflict

### 3. Payment Cancellation
- User holds slot → cancels payment modal
- Expected: Slot remains held for 10 minutes, then freed by cron

### 4. Expired Hold
- User holds slot → waits 11 minutes → tries to confirm
- Expected: 410 Gone error, user must retry

### 5. Cron Job Execution
- Create pending booking → wait 11 minutes → trigger cron
- Expected: Pending booking deleted

## Monitoring & Observability

### Key Metrics to Track

1. **Hold Success Rate**: % of hold requests that succeed
2. **Confirmation Rate**: % of held bookings that get confirmed
3. **Expiration Rate**: % of held bookings that expire
4. **Average Time to Confirm**: Time between hold and confirm
5. **Cleanup Count**: Number of expired bookings cleaned per cron run

### Logs to Monitor

- Hold API 409 responses (indicates contention)
- Confirm API 410 responses (indicates slow users)
- Cleanup API deleted counts (indicates abandoned bookings)

## Future Enhancements

1. **Dynamic Expiration**: Adjust hold time based on payment method (UPI: 5 min, NetBanking: 15 min)
2. **Hold Extension**: Allow users to extend hold if needed
3. **Notification**: SMS/Email when hold is about to expire
4. **Analytics Dashboard**: Visualize hold/confirm/expire rates
5. **Automatic Refund**: Integrate with Razorpay refund API for expired captures

## Deployment Checklist

- [x] Run migration 0009 on production database
- [ ] Set `CRON_SECRET` environment variable in Vercel
- [ ] Deploy application with new endpoints
- [ ] Verify cron job is running (check Vercel logs)
- [ ] Monitor cleanup API for first few runs
- [ ] Test booking flow end-to-end in production
