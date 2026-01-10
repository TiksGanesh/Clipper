# Soft Lock Architecture Diagram

## System Components

```
┌─────────────────────────────────────────────────────────────┐
│                      BookingForm.tsx                         │
│                     (Frontend Component)                     │
│                                                              │
│  1. User selects barber, service, date, time               │
│  2. Click "Continue to Payment"                            │
│  3. Call /api/bookings/hold                                │
│  4. On success: Show Razorpay modal                        │
│  5. On payment success: Call /api/bookings with booking_id │
│  6. Redirect to confirmation                               │
└─────────────┬────────────────────────────────────────────────┘
              │
              │ HTTP
              ▼
┌─────────────────────────────────────────────────────────────┐
│                      API Layer                              │
│                                                              │
│  ┌──────────────────────────────────────────────────────┐  │
│  │ POST /api/bookings/hold                              │  │
│  │ - Validate services & barber                         │  │
│  │ - Check slot availability                           │  │
│  │ - Create pending_payment booking (10 min expiry)    │  │
│  │ - Return bookingId                                  │  │
│  └──────────────────────────────────────────────────────┘  │
│                                                              │
│  ┌──────────────────────────────────────────────────────┐  │
│  │ POST /api/payments                                   │  │
│  │ - Create Razorpay order                             │  │
│  │ - Return order details                              │  │
│  └──────────────────────────────────────────────────────┘  │
│                                                              │
│  ┌──────────────────────────────────────────────────────┐  │
│  │ POST /api/bookings (with booking_id)                │  │
│  │ - Validate booking_id exists & pending_payment      │  │
│  │ - Check hold not expired                            │  │
│  │ - Update status to confirmed                        │  │
│  │ - Add customer details                              │  │
│  │ - Create payment record                             │  │
│  └──────────────────────────────────────────────────────┘  │
│                                                              │
│  ┌──────────────────────────────────────────────────────┐  │
│  │ POST /api/bookings/cleanup                           │  │
│  │ - Find expired pending_payment bookings              │  │
│  │ - Soft delete (set deleted_at)                      │  │
│  │ - Return count cleaned                              │  │
│  └──────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
              │
              │ SQL
              ▼
┌─────────────────────────────────────────────────────────────┐
│                    PostgreSQL Database                      │
│                    (Supabase)                               │
│                                                              │
│  Table: bookings                                           │
│  ┌────────────────────────────────────────────────────┐   │
│  │ id (UUID)                                          │   │
│  │ shop_id (UUID) ──┐                                │   │
│  │ barber_id (UUID) ├─> Foreign Keys                │   │
│  │ service_id (UUID)├─> Validations                 │   │
│  │ customer_name (VARCHAR)                           │   │
│  │ customer_phone (VARCHAR)                          │   │
│  │ start_time (TIMESTAMPTZ)                          │   │
│  │ end_time (TIMESTAMPTZ)                            │   │
│  │ status (booking_status enum)                      │   │
│  │ expires_at (TIMESTAMPTZ) ◄─ NEW FOR HOLDS       │   │
│  │ deleted_at (TIMESTAMPTZ)                          │   │
│  │ created_at, updated_at                            │   │
│  │                                                    │   │
│  │ Enum: booking_status                              │   │
│  │  - pending_payment ◄─ NEW                         │   │
│  │  - confirmed                                      │   │
│  │  - completed                                      │   │
│  │  - canceled                                       │   │
│  │  - no_show                                        │   │
│  │                                                    │   │
│  │ Trigger: check_booking_overlap()                  │   │
│  │  - Prevents overlaps with confirmed/completed    │   │
│  │  - Prevents overlaps with non-expired holds      │   │
│  │  - Auto-enforces at DB level                     │   │
│  └────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

## Booking State Transitions

```
┌──────────────────┐
│   No Booking     │
└────────┬─────────┘
         │
         │ Call /api/bookings/hold
         │ (slot available)
         ▼
┌──────────────────┐
│ pending_payment  │  ◄──────────────────┐
│ expires_at: T+10 │                     │
└────────┬─────────┘                     │
         │                               │
         ├─ Payment Success ────────────┐│
         │                              ││
         │ Call /api/bookings with      ││
         │ booking_id                   ││
         │                              ││
         ▼                              ││
┌──────────────────┐                    ││
│   confirmed      │                    ││
│ customer_details │                    ││
│ payment_record   │                    ││
└──────────────────┘                    ││
         │                              ││
         │ Barber marks complete       ││
         ▼                              ││
┌──────────────────┐                    ││
│   completed      │                    ││
└──────────────────┘                    ││
                                        ││
    Payment Failed / Cancelled ─────────┘│
    Hold expires (10 min) ──────────────┘
                         │
                         │ Auto cleanup via
                         │ /api/bookings/cleanup
                         ▼
                  ┌──────────────────┐
                  │  deleted_at set  │
                  │  (soft delete)   │
                  └──────────────────┘
```

## Conflict Detection Flow

```
┌─────────────────────────────────────────┐
│ User A requests /api/bookings/hold      │
│ Slot: 2025-01-09 10:00-11:00, Barber X │
└────────────┬────────────────────────────┘
             │
             ▼
┌────────────────────────────────────────────┐
│ Check existing bookings for Barber X       │
│ Time range: 10:00-11:00                    │
│                                            │
│ Query results:                             │
│ ├─ Booking 1: confirmed (9:00-10:00) OK   │
│ ├─ Booking 2: confirmed (11:00-12:00) OK  │
│ └─ Booking 3: NONE FOUND in range         │
└────────────┬─────────────────────────────┘
             │
             ▼
       ┌──────────┐
       │ Available│ ──┐
       └──────────┘  │
                     │ Create pending_payment
                     │ with expires_at
                     │
       ┌──────────────────────────────────┐
       │ Meanwhile, User B on another     │
       │ browser requests same slot       │
       │ /api/bookings/hold              │
       └────────────┬─────────────────────┘
                    │
                    ▼
       ┌────────────────────────────────────┐
       │ Check existing bookings again      │
       │ (User A's pending_payment now      │
       │  exists with expires_at > NOW())   │
       │                                    │
       │ Found: User A's hold (not expired) │
       └────────────┬─────────────────────┘
                    │
                    ▼
               ┌─────────────┐
               │ Return 409  │
               │ Conflict    │
               └─────────────┘
                    │
                    ▼
       ┌──────────────────────────────────┐
       │ User B sees error:               │
       │ "This slot is no longer          │
       │  available. Please select        │
       │  another time."                  │
       └──────────────────────────────────┘
```

## Time-Based Hold Lifecycle

```
Time ──────────────────────────────────────────────────────────►

T0: User clicks "Continue to Payment"
│
├─ /api/bookings/hold called
│  └─ Creates pending_payment booking
│  └─ Sets expires_at = T0 + 10 minutes
│
T0+0s: Hold created, Razorpay modal shown
│      [Other users see slot as taken]
│
T0+2m: User in payment modal (common case)
│      [Slot still held]
│
T0+5m: User completes payment (happy path)
│      [/api/bookings called with booking_id]
│      [Status changed: pending_payment → confirmed]
│      [Other users can't book]
│
T0+8m: User abandons payment without completing
│      [Hold still valid for 2 more minutes]
│      [Slot still reserved]
│
T0+10m: expires_at timestamp reached
│       [Cleanup job runs]
│       [pending_payment booking marked deleted]
│       [Slot becomes available again for other users]
│
T0+11m+: New user can book same slot
│        [No conflict with expired hold]
```

## Database Constraints & Safety

```
INSERT new booking
        │
        ▼
┌──────────────────────────────────────┐
│ Database Trigger: check_booking_      │
│ overlap()                             │
│                                       │
│ 1. Check for overlaps with:          │
│    ├─ confirmed bookings             │
│    ├─ completed bookings             │
│    └─ pending_payment bookings       │
│       (ONLY if expires_at > NOW())   │
│                                       │
│ 2. If overlap found:                 │
│    └─ RAISE EXCEPTION                │
│       "Booking overlaps"              │
└────────────┬──────────────────────────┘
             │
        ┌────┴────┐
        │          │
        ▼          ▼
    ┌──────┐   ┌───────────┐
    │ PASS │   │ FAIL (409)│
    │ Save │   │ Rollback  │
    └──────┘   └───────────┘
```

## Deployment Checklist

```
1. Code Deployment
   ├─ Deploy API routes (hold.ts, cleanup.ts)
   ├─ Deploy updated BookingForm.tsx
   └─ Deploy updated /api/bookings/route.ts

2. Database Migration
   ├─ Run migration 0010_add_pending_payment_status.sql
   ├─ Verify enum type updated
   ├─ Verify expires_at column added
   └─ Verify trigger updated

3. Configuration
   ├─ Set CLEANUP_SECRET env var
   └─ Verify NEXT_PUBLIC_RAZORPAY_KEY_ID still set

4. Cleanup Scheduling
   ├─ Option A: Vercel Crons (vercel.json)
   ├─ Option B: External service (EasyCron)
   ├─ Option C: GitHub Actions
   └─ Test: Call /api/bookings/cleanup manually

5. Monitoring
   ├─ Watch hold creation logs
   ├─ Monitor cleanup job runs
   ├─ Track payment completion rates
   └─ Alert on cleanup failures

6. Rollback Plan (if needed)
   ├─ Revert BookingForm.tsx
   ├─ Use legacy createBooking directly
   ├─ Stop cleanup scheduler
   └─ Database changes are safe (no rollback needed)
```
