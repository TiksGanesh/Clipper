# Dashboard UI Fix: Handling pending_payment Status

## Overview

Updated the barber dashboard to properly display and handle `pending_payment` bookings, making them highly visible so barbers can identify and resolve stuck payment issues.

---

## Changes Made

### 1. AppointmentCard.tsx

#### Status Type Updated
```typescript
// Before
type AppointmentStatus = 'confirmed' | 'seated' | 'completed' | 'canceled' | 'no_show'

// After
type AppointmentStatus = 'confirmed' | 'seated' | 'completed' | 'canceled' | 'no_show' | 'pending_payment'
```

#### Status Configuration Added
```typescript
pending_payment: {
    label: 'Payment Pending',
    bgColor: 'bg-yellow-50',
    borderColor: 'border-yellow-400 border-2',  // Bold yellow border for visibility
    badgeColor: 'bg-yellow-100 text-yellow-800',
}
```

**Design**: Bright yellow/amber colors to make pending payments stand out from other statuses.

#### New Action Handler: Re-check Payment Status
```typescript
const handleRecheckPaymentStatus = () => {
    // Calls API: POST /api/bookings/check-payment-status
    // Checks if payment has been confirmed
    // If yes, updates booking to confirmed
    // Shows clear feedback to barber
}
```

#### New Action Button Section
For `status === 'pending_payment'`:
- **🔄 Re-check**: Call API to verify payment status with Razorpay
- **❌ Clear Hold**: Cancel the booking and release the slot

```tsx
{status === 'pending_payment' && (
    <div className="flex flex-col gap-2 sm:flex-row sm:gap-2">
        <button onClick={handleRecheckPaymentStatus} className="...">
            🔄 Re-check
        </button>
        <button onClick={handleCancel} className="...">
            ❌ Clear Hold
        </button>
    </div>
)}
```

---

### 2. DayView.tsx

#### Type Updates
```typescript
// Added to BookingStatus
type BookingStatus = 'confirmed' | 'seated' | 'completed' | 'canceled' | 'no_show' | 'pending_payment'

// Added to BookingDisplayStatus
type BookingDisplayStatus = 'pending_payment' | 'upcoming' | 'seated' | 'completed' | 'no_show' | 'canceled'
```

#### Display Status Mapping
```typescript
function toDisplayStatus(status: BookingStatus): BookingDisplayStatus {
    switch (status) {
        case 'pending_payment':
            return 'pending_payment'  // Added
        case 'seated':
            return 'seated'
        // ... etc
    }
}
```

#### Visual Styling
```typescript
const map: Record<BookingDisplayStatus, ...> = {
    pending_payment: { 
        bg: '#fef3c7',      // Light yellow background
        border: '#f59e0b',  // Amber border
        text: '#92400e',    // Dark brown text
        label: 'Payment Pending' 
    },
    // ... other statuses
}
```

#### Sorting Order (CRITICAL)
```typescript
// Before
const statusOrder = { seated: 0, upcoming: 1, no_show: 2, completed: 3, canceled: 4 }

// After
const statusOrder = { 
    pending_payment: 0,  // TOP PRIORITY - shows first
    seated: 1,
    upcoming: 2,
    no_show: 3,
    completed: 4,
    canceled: 5
}
```

**Impact**: `pending_payment` bookings now appear at the top of the calendar, ensuring barbers see them immediately.

---

### 3. New API Endpoint: check-payment-status

**File**: `app/api/bookings/check-payment-status/route.ts`

#### Purpose
Allows barbers to manually verify the payment status of a pending_payment booking and auto-confirm it if payment succeeded.

#### Request
```typescript
POST /api/bookings/check-payment-status
Content-Type: application/json

{
    "booking_id": "uuid"
}
```

#### Response Examples

**Case 1: Payment Confirmed**
```json
{
    "status": "confirmed",
    "booking_status": "confirmed",
    "payment_id": "uuid",
    "message": "Payment confirmed and booking status updated."
}
```

**Case 2: Payment Still Pending**
```json
{
    "status": "pending",
    "payment_status": "created",
    "payment_id": "uuid",
    "message": "Payment is still awaiting customer confirmation..."
}
```

**Case 3: Booking Hold Expired**
```json
{
    "status": "expired",
    "error": "Booking hold has expired"
}
```

**Case 4: Booking Not Found**
```json
{
    "status": "not_found",
    "error": "Booking not found"
}
```

#### Logic Flow
```
1. Validate booking_id
2. Fetch booking from DB
3. Check booking status:
   ✓ If confirmed → return 'confirmed'
   ✓ If not pending_payment → return current status
   ✗ If hold expired → return 'expired'
4. Fetch payment record
5. Check payment status:
   ✓ If paid/success:
     → Update booking to confirmed
     → Return 'confirmed'
   ✗ If created/pending:
     → Return 'pending'
     → Message: "Still awaiting customer"
```

---

## User Experience

### For Barbers

1. **Visibility**: Opening the calendar, pending_payment bookings appear at the top in bright yellow
2. **Discovery**: No more missed or hidden pending payments
3. **Action**: Two clear options:
   - 🔄 **Re-check**: Verify if payment went through (auto-confirms if it did)
   - ❌ **Clear Hold**: Cancel the booking if payment will never come

### For Customers

- No change to booking flow
- Payment pending status is transparent to customers
- Barber can manually clear stuck holds

---

## Color Scheme

| Status | Color | Hex | Purpose |
|--------|-------|-----|---------|
| pending_payment | Amber/Yellow | #fef3c7 bg, #f59e0b border | HIGH VISIBILITY - must not miss |
| confirmed | Blue | #e0f2fe bg, #60a5fa border | Standard waiting state |
| seated | Green | #dcfce7 bg, #22c55e border | Active service in progress |
| completed | Gray | #f3f4f6 bg, #d1d5db border | Done and closed |
| no_show | Yellow | #fef9c3 bg, #facc15 border | Customer didn't show |
| canceled | Red | #fee2e2 bg, #f87171 border | Cancelled/deleted |

**Note**: pending_payment and no_show are both yellow-family, but pending_payment is darker/more amber for urgency.

---

## Sorting Priority

Bookings are now sorted in this order:
```
1. pending_payment (CRITICAL - must be visible first)
2. seated (In progress)
3. upcoming (Confirmed, not started)
4. no_show (No-show)
5. completed (Done)
6. canceled (Cancelled)
```

Within each status, sorted by start time (earliest first).

---

## Testing Checklist

- [ ] **Visibility**: pending_payment bookings appear at top of calendar
- [ ] **Color**: Bright yellow/amber, distinct from other statuses
- [ ] **Buttons**: Two buttons render (Re-check and Clear Hold)
- [ ] **Re-check**: Calls API and shows appropriate message
  - [ ] If payment confirmed: Shows success message
  - [ ] If payment pending: Shows "still awaiting" message
  - [ ] If hold expired: Shows "hold expired" message
- [ ] **Clear Hold**: Cancels booking and removes from calendar
- [ ] **Sorting**: Multiple pending_payment bookings appear first (by time)
- [ ] **Other statuses**: Still work normally (confirmed, seated, etc.)
- [ ] **Mobile**: Buttons stack vertically on small screens

---

## Known Limitations

1. **Re-check**: Checks our DB, doesn't directly query Razorpay (relies on webhooks)
   - Works when: Webhook has processed the payment
   - Doesn't work if: Webhook hasn't fired yet
   - Improvement: Could add direct Razorpay API call (future enhancement)

2. **Clear Hold**: Removes booking but doesn't refund payment
   - Refunds must be handled separately via Razorpay dashboard
   - Barber sees booking is cancelled, understands payment was taken

---

## Integration with Payment Fix

This dashboard fix works in conjunction with the payment validation fix in `app/api/bookings/route.ts`:

1. **Payment Fix** prevents multi-tab collisions and validates orders
2. **Dashboard Fix** gives barbers visibility and control over stuck bookings

Both are needed for a complete solution.

---

## Files Modified

1. `components/dashboard/AppointmentCard.tsx`
   - Added pending_payment to status type
   - Added STATUS_CONFIG for pending_payment
   - Added handleRecheckPaymentStatus handler
   - Added UI section for pending_payment buttons

2. `components/calendar/DayView.tsx`
   - Added pending_payment to BookingStatus type
   - Added pending_payment to BookingDisplayStatus type
   - Updated toDisplayStatus() mapping
   - Updated bookingStyle() styling
   - Updated sort order (pending_payment: 0)

3. `app/api/bookings/check-payment-status/route.ts` (NEW)
   - New POST endpoint for checking payment status
   - Validates booking exists
   - Checks payment records
   - Auto-confirms booking if payment succeeded

---

## Next Steps

1. **Deploy**: Dashboard changes and new API endpoint
2. **Monitor**: Track pending_payment bookings to ensure they're handled
3. **Future**: Consider adding direct Razorpay API verification

---

## Summary

Barbers can now:
1. ✅ See pending_payment bookings immediately (top, yellow)
2. ✅ Re-check if payment succeeded (with auto-confirm)
3. ✅ Clear stuck holds if payment will never come
4. ✅ Understand the status at a glance (color-coded)

This fixes the critical issue where pending_payment bookings were invisible to barbers, leading to confusion and lost customers.
