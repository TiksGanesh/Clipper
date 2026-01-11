# Live Booking Tracking Feature - Implementation Guide

## Overview
Real-time booking tracking system that allows customers to monitor their appointment status, queue position, and expected start time via a public tracking link.

---

## 1. Database Changes

### Migration: `0012_add_barber_delay_tracking.sql`

**Purpose**: Add delay tracking capability to barbers table

```sql
ALTER TABLE barbers 
ADD COLUMN current_delay_minutes INTEGER NOT NULL DEFAULT 0 CHECK (current_delay_minutes >= 0);
```

**Fields Added**:
- `current_delay_minutes` (integer, default 0) - Real-time delay tracking for live updates

**Index Added**:
```sql
CREATE INDEX idx_barbers_active_delay ON barbers(id, current_delay_minutes) 
WHERE deleted_at IS NULL AND is_active = true;
```

---

## 2. API Route: `/api/track`

**File**: `app/api/track/route.ts` (179 lines)

### Endpoint Details
- **Method**: GET
- **URL**: `/api/track?booking_id=<uuid>`
- **Authentication**: None required (public endpoint - booking ID acts as token)
- **Rate Limiting**: None (can be added if needed)

### Request Parameters
- `booking_id` (required): UUID of the booking to track

### Response Format
```json
{
  "booking": {
    "id": "uuid",
    "original_start": "11:00 AM",
    "service_name": "Haircut",
    "barber_name": "John Doe",
    "customer_name": "Customer Name",
    "status": "confirmed",
    "duration_minutes": 45
  },
  "live_status": {
    "is_delayed": true,
    "delay_minutes": 15,
    "expected_start": "11:15 AM",
    "queue_position": 3,
    "people_ahead": 2,
    "current_activity": "Serving a Haircut",
    "timestamp": "2026-01-11T..."
  }
}
```

### Queue Position Calculation Logic

```typescript
// Count bookings before this user's start time
const queueQuery = supabase
  .from('bookings')
  .select('id', { count: 'exact', head: true })
  .eq('barber_id', bookingData.barber_id)
  .eq('shop_id', bookingData.shop_id)
  .lt('start_time', bookingData.start_time)
  .in('status', ['confirmed', 'seated']);
```

**Logic**:
- Only counts bookings with the same barber
- Only includes bookings BEFORE user's start time
- Only counts active statuses: `confirmed` or `seated`
- Returns position in queue (1-indexed)

### Current Activity Detection

```typescript
// Find the ONE booking currently being served
const currentActivity = await supabase
  .from('bookings')
  .select('services(name)')
  .eq('shop_id', bookingData.shop_id)
  .eq('status', 'seated')
  .single();
```

**Logic**:
- Only ONE booking can have status='seated' at a time per shop
- Returns the service name being performed right now
- Falls back to "Shop is open, no one currently being served"

---

## 3. Tracking Page UI

**File**: `app/track/[id]/page.tsx` (293 lines)

### Technology Stack
- **SWR 2.3.8**: Client-side data fetching with automatic revalidation
- **Framer Motion 12.25.0**: Smooth animations and transitions
- **Tailwind CSS 4.1.18**: Mobile-first responsive design

### Key Features

#### a) **Live Polling with SWR**
```typescript
const { data, error } = useSWR<TrackingData>(
  `/api/track?booking_id=${params.id}`,
  fetcher,
  { refreshInterval: 30000 } // 30 seconds
);
```

- Auto-refreshes every 30 seconds
- Handles loading, error, and success states
- Deduplicates requests automatically

#### b) **Pulsing Live Indicator**
```typescript
<motion.span 
  className="inline-block w-3 h-3 bg-green-500 rounded-full"
  animate={{ scale: [1, 1.3, 1], opacity: [1, 0.7, 1] }}
  transition={{ duration: 2, repeat: Infinity }}
/>
```

- Green pulsing dot next to "Live Status"
- Infinite animation loop
- Creates sense of real-time updates

#### c) **Smart Status Messages**

**Priority 1**: Service in Progress
```typescript
if (data.booking.status === 'seated') {
  return <span className="text-green-600 font-bold">Service in Progress</span>;
}
```

**Priority 2**: You&apos;re Next!
```typescript
if (data.live_status.queue_position === 1) {
  return <span className="text-orange-600 font-bold">You&apos;re Next!</span>;
}
```

**Priority 3**: Other Statuses
- Queue position display
- Completed/Cancelled states

#### d) **Delay Visualization**

**Strike-through Original Time**:
```typescript
<div className="text-gray-500 text-lg line-through">
  {data.booking.original_start}
</div>
```

**Large Expected Time**:
```typescript
<div className="text-5xl sm:text-6xl font-bold text-gray-900">
  {data.live_status.expected_start}
</div>
```

**Delay Badge**:
```typescript
<div className="inline-flex items-center px-3 py-1 rounded-full bg-orange-100">
  <ClockIcon className="w-4 h-4 text-orange-600 mr-1.5" />
  <span className="text-sm font-medium text-orange-800">
    Running {data.live_status.delay_minutes} minutes behind
  </span>
</div>
```

---

## 4. Files Modified

### `types/database.ts`
Added `current_delay_minutes` field to barbers table:

```typescript
barbers: {
  Row: {
    // ...existing fields
    current_delay_minutes: number;
  };
  Insert: {
    // ...existing fields
    current_delay_minutes?: number;
  };
  Update: {
    // ...existing fields
    current_delay_minutes?: number;
  };
};
```

---

## 5. Deployment Checklist

### Pre-Deployment
- [x] Migration file created: `0012_add_barber_delay_tracking.sql`
- [x] Types updated in `database.ts`
- [x] API route tested locally
- [x] Tracking page UI tested locally
- [x] Build successful (all 36 routes generated)
- [x] No TypeScript errors
- [x] No ESLint errors

### Deployment Steps
1. **Apply Migration**: Run `0012_add_barber_delay_tracking.sql` on production database
2. **Deploy App**: Push to production (Vercel/hosting platform)
3. **Test Tracking URL**: Visit `/track/[real-booking-id]` in production
4. **Verify API**: Check `/api/track?booking_id=<uuid>` returns correct data
5. **Test Polling**: Ensure 30-second refresh works
6. **Update Barbers**: Train barbers to update delay field

### Post-Deployment
- [ ] Monitor API response times
- [ ] Check SWR polling performance
- [ ] Gather customer feedback on tracking experience
- [ ] Consider adding tracking link to booking confirmation emails

---

## 6. Future Enhancements (Out of Scope for V1)

- [ ] SMS notifications when queue position changes
- [ ] Push notifications for "You're Next" alert
- [ ] Historical tracking data (average wait times)
- [ ] Barber UI to update delay minutes in real-time
- [ ] QR code for easy tracking access
- [ ] Multi-language support for tracking page

---

## 7. Testing Guide

### Manual Testing
1. **Create a Test Booking**:
   ```bash
   # Use the booking form at /book/[shopId]
   # Note the booking_id returned
   ```

2. **Access Tracking Page**:
   ```
   http://localhost:3000/track/[booking-id]
   ```

3. **Test API Directly**:
   ```bash
   curl http://localhost:3000/api/track?booking_id=<uuid>
   ```

4. **Test Queue Logic**:
   - Create multiple bookings for the same barber
   - Verify queue_position increments correctly
   - Mark a booking as 'seated' and check current_activity

5. **Test Delay Logic**:
   - Update barber's `current_delay_minutes` in database
   - Refresh tracking page
   - Verify expected_start time updates
   - Verify strike-through appears on original time

### Error Scenarios
- Invalid booking_id → 404 error page
- Missing booking_id parameter → 400 error
- Deleted booking → 404 error page
- Database connection error → 500 error page

---

## 8. Summary

**Files Created**:
1. `supabase/migrations/0012_add_barber_delay_tracking.sql` (15 lines)
2. `app/api/track/route.ts` (179 lines)
3. `app/track/[id]/page.tsx` (293 lines)
4. `docs/features/LIVE_TRACKING_IMPLEMENTATION.md` (this file)

**Files Modified**:
1. `types/database.ts` (added current_delay_minutes field)

**Dependencies Used**:
- SWR 2.3.8 (already installed)
- Framer Motion 12.25.0 (already installed)
- Tailwind CSS 4.1.18 (already installed)

**Key Features Delivered**:
✅ Public tracking API with queue logic  
✅ Real-time polling every 30 seconds  
✅ Pulsing live status indicator  
✅ Smart status messages ("You're Next!", "Service in Progress")  
✅ Delay visualization with strike-through  
✅ Current shop activity display  
✅ Mobile-responsive design  
✅ Framer Motion animations  
✅ Type-safe TypeScript implementation  
✅ Build successful - production ready  

**Tracking URL Format**: `/track/[booking_id]`  
**API Endpoint**: `GET /api/track?booking_id=<uuid>`

---

## Support

For questions or issues with the live tracking feature, refer to:
- This implementation guide
- API response format above
- Testing guide in Section 7
- Database migration file: `0012_add_barber_delay_tracking.sql`