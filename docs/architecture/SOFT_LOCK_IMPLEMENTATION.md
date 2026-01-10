# Soft Lock Mechanism Implementation

## Overview
This document describes the soft lock (hold) mechanism implemented to prevent double-bookings where two users pay for the same time slot.

## How It Works

### 1. Hold Creation (`/api/bookings/hold`)
When a customer proceeds to payment:
- The frontend calls `/api/bookings/hold` with `barberId`, `serviceIds`, `date`, and `slotTime`
- The API checks if the slot is available (no confirmed/completed bookings or non-expired holds)
- If available, it creates a booking with status `pending_payment` and sets `expires_at` to 10 minutes from now
- Returns the `bookingId` to the frontend

### 2. Payment Processing
- Only if the hold is successful, the customer is shown the Razorpay payment modal
- This ensures the slot is reserved while payment is being processed

### 3. Booking Confirmation (`/api/bookings` with `booking_id`)
- After successful payment, the frontend calls `/api/bookings` with the `booking_id` from the hold
- This updates the pending booking to `confirmed` status with actual customer details
- Payment records are created linked to the booking

### 4. Expired Hold Cleanup (`/api/bookings/cleanup`)
- A separate API endpoint handles cleanup of expired holds
- Bookings with `status = 'pending_payment'` and `expires_at < NOW()` are soft-deleted
- This should be called periodically (every 1-5 minutes)

## Database Changes

### Migration: `0010_add_pending_payment_status.sql`
- Added `pending_payment` to the `booking_status` enum
- Added `expires_at TIMESTAMPTZ` column to bookings table
- Updated the overlap prevention trigger to consider non-expired pending_payment bookings
- Added index for efficient cleanup queries

## API Endpoints

### POST /api/bookings/hold
**Request:**
```json
{
  "barber_id": "uuid",
  "service_ids": ["uuid", "uuid"],
  "date": "2025-01-09",
  "slot_time": "2025-01-09T10:00:00Z",
  "timezone_offset": -330
}
```

**Success Response (200):**
```json
{
  "bookingId": "uuid",
  "expiresAt": "2025-01-09T10:10:00Z"
}
```

**Conflict Response (409):**
```json
{
  "error": "Slot is not available"
}
```

### POST /api/bookings (with booking_id)
**Request:**
```json
{
  "booking_id": "uuid",
  "barber_id": "uuid",
  "service_ids": ["uuid"],
  "slot_start": "2025-01-09T10:00:00Z",
  "customer_name": "John Doe",
  "customer_phone": "9876543210",
  "date": "2025-01-09",
  "razorpay_payment_id": "pay_xxx",
  "razorpay_order_id": "order_xxx",
  "amount": 50000
}
```

Updates the pending booking to `confirmed` status.

### POST /api/bookings/cleanup
**Request:**
```
Authorization: Bearer {CLEANUP_SECRET}
```

**Response:**
```json
{
  "cleaned": 5,
  "message": "Cleaned up 5 expired booking holds",
  "bookingIds": ["uuid1", "uuid2", ...]
}
```

### GET /api/bookings/cleanup
Returns count of expired bookings without performing cleanup.

## Frontend Changes

### BookingForm.tsx
1. Added `holdBookingId` state to track the active hold
2. Updated `handlePaymentAndBooking` to:
   - Call `/api/bookings/hold` first
   - Only proceed with Razorpay if hold succeeds
   - Pass `booking_id` to payment completion
3. Created new `confirmBookingFromHold` function to confirm pending bookings
4. Updated error messages to indicate slot was reserved for 10 minutes on payment failure

## Setting Up Cleanup

### Option 1: Vercel Crons (Recommended for Vercel deployments)
Create `vercel.json`:
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

This runs cleanup every 5 minutes.

### Option 2: External Cron Service
Use services like:
- **EasyCron**: https://www.easycron.com/
- **cron-job.org**: https://cron-job.org/
- **GitHub Actions**: Create a workflow that calls the endpoint

Example cURL command:
```bash
curl -X POST https://yourapp.com/api/bookings/cleanup \
  -H "Authorization: Bearer YOUR_CLEANUP_SECRET"
```

### Option 3: Manual/Testing
```bash
# Check status
curl https://yourapp.com/api/bookings/cleanup

# Trigger cleanup (requires CLEANUP_SECRET env var)
curl -X POST https://yourapp.com/api/bookings/cleanup \
  -H "Authorization: Bearer your-secret-key"
```

## Environment Variables
Add to `.env.local`:
```
CLEANUP_SECRET=your-secure-secret-key
```

## Database Constraints

The database enforces several constraints:
1. **Overlap Prevention Trigger**: Prevents any new bookings from overlapping with:
   - Confirmed/completed bookings
   - Non-expired pending_payment bookings
2. **Time Range Validation**: `end_time > start_time`
3. **Status Enum**: Only allows valid statuses

## Error Handling

### Frontend
- **409 Conflict**: Slot taken by another user → "This slot is no longer available"
- **Payment Cancelled**: Hold expires in 10 minutes → "You cancelled the payment. The slot hold will expire in 10 minutes."
- **Payment Failed**: Hold expires in 10 minutes → Same message with "Payment failed. The slot hold will expire in 10 minutes."

### Expiry Behavior
- If payment is not completed within 10 minutes, the hold automatically expires
- Other users can then book the same slot
- The pending booking will be cleaned up by the cleanup routine

## Security Considerations

1. **Hold Duration**: 10 minutes is enough for payment processing without blocking slots too long
2. **Cleanup Secret**: Optional authorization for cleanup endpoint prevents unauthorized cleanup
3. **Service-Level Auth**: Existing Supabase RLS ensures user isolation
4. **Database Triggers**: Enforce constraints at database level

## Testing Checklist

- [ ] Hold API correctly returns 409 when slot is taken
- [ ] Hold API correctly creates pending_payment booking
- [ ] BookingForm calls hold before payment
- [ ] Booking confirmation updates pending booking
- [ ] Cleanup removes expired bookings
- [ ] Expired holds don't block new bookings
- [ ] Concurrent payments to same slot results in one success, one 409
- [ ] Hold expiry message shows to user on payment failure

## Future Enhancements

1. **Automatic Retry**: If payment fails but hold is still valid, auto-retry payment
2. **Extended Hold**: Allow extending hold for users with slow internet
3. **Partial Holds**: Support holds for multi-service bookings
4. **Analytics**: Track hold → payment → confirmation conversion rates
