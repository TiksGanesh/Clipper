# Walk-In Booking Feature

## Overview
The walk-in booking feature allows shop owners to quickly create walk-in appointments directly from the dashboard. Walk-ins use the same booking system as pre-booked appointments and block calendar slots exactly like normal bookings.

## Features

### Auto-Slot Assignment
- When a barber and service(s) are selected, the system automatically fetches available slots for today
- The next available (soonest) slot is pre-selected automatically
- Shop owners can optionally override and choose from alternative slots (next 2-3 available times)

### Optional Customer Information
- Customer name is optional, defaults to "Walk In" if not provided
- Phone number is optional
- Both fields can be left blank for quick entry

### Payment & Billing
- Walk-in bookings are treated identically to pre-booked appointments
- Same service pricing applies (no special walk-in pricing in V1)
- Bookings are marked with `is_walk_in=true` in the database for future filtering/analytics

### Database-Level Enforcement
- Walk-ins block calendar slots through the same database constraints as normal bookings
- Overlap prevention is enforced at the database level via the `check_booking_overlap()` trigger
- Max 2 barbers per shop constraint still applies

## Usage

### From Dashboard
1. Navigate to **Dashboard** (requires authentication)
2. Scroll to "New Walk-In Booking" section
3. Select a **Barber** from dropdown
4. Select one or more **Services** (hold Ctrl/Cmd to multi-select)
5. The system automatically assigns the next available slot
6. Optionally enter customer **Name** and **Phone**
7. Click **Create Walk-In**

### API Endpoint: `POST /api/walk-ins`

**Request Body:**
```json
{
  "barber_id": "uuid",
  "service_ids": ["uuid1", "uuid2"],
  "customer_name": "John Doe (optional)",
  "customer_phone": "+1-555-1234 (optional)",
  "timezone_offset": -300
}
```

**Response (Success):**
```json
{
  "booking_id": "uuid",
  "customer_name": "Walk In or provided name",
  "customer_phone": "provided phone or null",
  "slot_start": "2024-12-29T14:30:00Z",
  "slot_end": "2024-12-29T15:00:00Z",
  "barber_id": "uuid",
  "service_ids": ["uuid1", "uuid2"]
}
```

**Error Responses:**
- `400` - Missing required fields (barber_id, service_ids)
- `403` - User does not own the shop
- `404` - Barber not found or inactive
- `409` - No available slots for walk-in today

## Implementation Details

### Component: `WalkInForm` (`components/booking/WalkInForm.tsx`)
- Client-side form for walk-in creation
- Auto-fetches slots based on barber/services
- Displays auto-assigned slot prominently
- Allows optional override to pick alternative slots
- Optional customer info fields (no validation required)

### API Endpoint: `/api/walk-ins` (`app/api/walk-ins/route.ts`)
- **Authentication Required**: Only authenticated shop owners can create walk-ins
- **Authorization**: User must own the shop to create walk-ins for it
- **Auto-Slot Logic**: Fetches today's available slots, auto-selects first (soonest)
- **Default Name**: Sets customer_name to "Walk In" if blank
- **Booking Creation**: Uses same database RPC (`book_booking`) as regular bookings with `is_walk_in=true`

### Dashboard Integration: `app/dashboard/page.tsx`
- Fetches barbers and services server-side
- Passes them to `WalkInForm` component
- Displays walk-in section prominently above management tools

## Future Enhancements (Out of Scope for V1)

- Walk-in reporting/filtering (separate view for walk-ins vs pre-booked)
- Walk-in-specific pricing or discounts
- Check-in flow or customer arrival tracking
- SMS/WhatsApp notifications for walk-ins
- Walk-in peak time analytics
- No-show tracking for walk-ins

## Testing

To test the walk-in feature:

1. **Login** to the dashboard as a shop owner
2. **Ensure setup is complete** (barbers, services, working hours configured)
3. **Navigate to Dashboard**
4. **Scroll to "New Walk-In Booking"** section
5. **Select a barber** → Auto-loads available slots
6. **Select services** → Slot refreshes with new duration
7. **Leave customer info blank** → Defaults to "Walk In"
8. **Click "Create Walk-In"** → Booking created with next available slot
9. **Verify in database** → `is_walk_in=true` field should be set
10. **Verify calendar blocking** → Try to book another appointment at same time for same barber → Should fail (overlap prevented)
