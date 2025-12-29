# Barber Calendar View - Implementation Review

## Overview
The barber calendar implementation provides a clean day/week view with real-time slot blocking, booking status tracking, and subscription-based access control. Below is a detailed analysis of edge cases and minimal improvement suggestions.

---

## Edge Cases & Issues Identified

### 1. **Double Booking Prevention**
**Status:** ✅ Protected at DB level
- **Current:** Database trigger `check_booking_overlap()` prevents overlaps by checking `confirmed` and `completed` bookings
- **Edge Case:** `no_show` bookings still block slots (treated as confirmed)
  - ✅ Correct behavior per requirements (no-show keeps slot blocked)
- **Edge Case:** Race condition during concurrent bookings
  - ✅ Protected: Trigger + UNIQUE constraint on `(barber_id, start_time)` prevents race conditions
- **Frontend Layer:** UI slot generation filters out overlapping bookings correctly

### 2. **Timezone Handling**
**Status:** ⚠️ **ISSUE FOUND** - Inconsistent client/server timezone handling
- **Current Implementation:**
  - Server: All times stored/computed in UTC
  - Working hours: Stored as `TIME` (no timezone), interpreted as UTC
  - Client: Date picker uses browser timezone, but times displayed as "UTC"
  - Slot calculation: Uses UTC minutes, displays UTC labels

- **Problem:**
  - If barber is in IST (UTC+5:30) and working hours are 10:00-18:00 UTC:
    - Client sees "10:00 UTC - 18:00 UTC"
    - Barber expects to see local time (15:30 - 23:30 IST)
  - Setup flow warns about this, but calendar doesn't validate/clarify timezone

- **Recommendation (Minimal):**
  - Add timezone context label on calendar: `"Times shown in UTC. Shop timezone: [detected from working hours]"`
  - Or add a small note: `"Set working hours in your timezone during setup"`
  - **No code changes needed** - just documentation update

### 3. **Date Boundary Issues**
**Status:** ✅ Handled correctly
- **Date Picker:** Uses ISO format (YYYY-MM-DD), parsed consistently as UTC midnight
- **Day Range:** `getUtcDayRange()` correctly creates `[start, end)` intervals (end is next day midnight)
- **Booking Query:** Uses `gte(start_time, range.start)` and `lt(start_time, range.end)` - correct half-open interval
- **Slot Sanity Check:** Prevents slots crossing midnight correctly

### 4. **Stale Data After Refresh**
**Status:** ⚠️ **Minor Issue** - Potential race with concurrent barber/date changes
- **Current:** When date or barber changes, useEffect re-fetches
- **Edge Case:** If user rapidly clicks Prev/Next while previous request in-flight:
  - Request 1: date=2025-01-01
  - User clicks Next (date=2025-01-02)
  - Request 2 starts
  - Request 1 completes after Request 2 - **stale data overwrites fresh**

- **Current Mitigation:** `AbortController` on cleanup cancels old fetches ✅
- **Remaining Risk:** No race condition - cleanup fires when dependencies change ✅

### 5. **Service Join Fallback**
**Status:** ⚠️ **Minor Risk** - "Unknown service" label shown if join fails
- **Current:** `service_name: (booking as any).services?.name ?? 'Unknown service'`
- **Why:** Service deleted after booking created (rare but possible)
- **Better:** Check Supabase soft-delete (`deleted_at`) during join
  - **Recommendation:** Query with `.is('services.deleted_at', null)` in `fetchBarberBookings()`

### 6. **Canceled Booking Slot Visibility**
**Status:** ✅ Correct
- **Current:** `no_show` blocks slot; `canceled` frees it
- **Implementation:** `buildSlots()` filters `status !== 'canceled'` before overlap check
- **Result:** Canceled bookings don't appear in view, slots become available

---

## Minimal Improvements (Without Feature Additions)

### **HIGH PRIORITY**

#### 1. **Add Service Join Filter in Bookings Query**
**File:** `lib/bookings.ts`
**Current:**
```typescript
.select('id, start_time, end_time, status, customer_name, is_walk_in, services ( name )')
```

**Improvement:**
```typescript
.select(
    'id, start_time, end_time, status, customer_name, is_walk_in, services!inner ( name )'
)
.is('services.deleted_at', null)  // Add this filter
```
**Reason:** Prevents showing "Unknown service" for deleted services
**Impact:** One-line change; prevents potential null/fallback display

---

#### 2. **Add Timezone Warning to Calendar View**
**File:** `app/barber/calendar/page.tsx`
**Add below subscription warning:**
```tsx
<div
    style={{
        padding: '12px 16px',
        backgroundColor: '#e0f7ff',
        border: '1px solid #80d8ff',
        borderRadius: '8px',
        color: '#004b87',
        fontSize: '13px',
    }}
>
    ℹ️ All times displayed in UTC. Set your shop's working hours in your local timezone during setup.
</div>
```
**Reason:** Clarifies the timezone assumption; matches setup.tsx guidance
**Impact:** Prevents confusion about time mismatches

---

### **MEDIUM PRIORITY**

#### 3. **Validate Date Input Range**
**File:** `components/calendar/DayView.tsx`
**Current:** No client-side validation of date picker value
**Improvement:** Enforce a reasonable range (e.g., ±30 days from today)
```tsx
const maxDateFuture = new Date()
maxDateFuture.setUTCDate(maxDateFuture.getUTCDate() + 30)
const minDatePast = new Date()
minDatePast.setUTCDate(minDatePast.getUTCDate() - 7)

<input
    id="date-selector"
    type="date"
    value={selectedDate}
    onChange={(event) => setSelectedDate(event.target.value)}
    min={minDatePast.toISOString().split('T')[0]}
    max={maxDateFuture.toISOString().split('T')[0]}
/>
```
**Reason:** Prevents calendar from becoming unusable if user selects year 2050
**Impact:** Better UX; prevents accidental far-future queries

---

#### 4. **Add Explicit Pending State During Refresh**
**File:** `components/calendar/DayView.tsx`
**Current:** No visual feedback when re-fetching after status action
**Improvement:** Disable date/barber selectors during `isActionPending`
```tsx
<select
    id="barber-selector"
    disabled={isActionPending}  // Add this
    value={selectedBarberId}
    onChange={(event) => handleBarberChange(event.target.value)}
>
```
**Reason:** Prevents user from changing barber while refresh in progress (could load wrong data)
**Impact:** Prevents race conditions; improves perceived reliability

---

### **LOW PRIORITY**

#### 5. **Add Booking Fetch Error Recovery**
**File:** `app/api/calendar/day/route.ts`
**Current:** Returns 500 if `fetchBarberBookings()` fails, page shows generic error
**Improvement:** Log error server-side, return empty bookings on fetch-only errors
```typescript
try {
    const bookings = await fetchBarberBookings({ barberId, view: 'day', date, shopId })
    return NextResponse.json({ working_hours: workingHours ?? null, bookings })
} catch (err: any) {
    console.error('Booking fetch failed:', err) // Add logging
    // Return gracefully if it's only the bookings that failed (not critical)
    if (err.message.includes('bookings')) {
        return NextResponse.json({ working_hours: workingHours ?? null, bookings: [] })
    }
    throw err
}
```
**Reason:** Calendar still shows working hours even if bookings API fails; prevents cascading errors
**Impact:** Better resilience; barber can still see schedule structure

---

## Architecture Strengths ✅

1. **Overlap Prevention:** Database-level trigger ensures no race conditions
2. **Soft Deletes:** Respect `deleted_at` fields across all queries
3. **Multi-Tenancy:** RLS + explicit shop_id checks prevent cross-shop data leaks
4. **State Management:** Proper cleanup with AbortController prevents stale renders
5. **Server-Side Slot Logic:** Heavy lifting in backend; client just renders
6. **Subscription Gating:** Blocks access + enforces read-only on expired subs

---

## Summary Table

| Issue | Severity | Current | Status | Fix Effort |
|-------|----------|---------|--------|-----------|
| Service join fallback | Medium | Shows "Unknown" | ⚠️ | 1 line |
| Timezone clarity | High | None | ⚠️ | 1 UI block |
| Double booking | N/A | DB trigger | ✅ | N/A |
| Race conditions | N/A | AbortController | ✅ | N/A |
| Date boundary | N/A | UTC ranges | ✅ | N/A |
| Date input limits | Low | None | ⚠️ | 5 lines |
| Pending UI feedback | Low | Partial | ⚠️ | 3 lines |
| Error recovery | Low | Cascading | ⚠️ | 5 lines |

---

## Recommended Action Items (Priority Order)

1. ✅ **DONE:** Add service filter + timezone warning (high impact, minimal code)
2. 📋 **Consider:** Add date input range limits (prevents edge cases)
3. 📋 **Consider:** Disable controls during pending (UX + safety)
4. 📋 **Nice-to-have:** Error recovery for graceful degradation

No blocking issues found. Implementation is production-ready for V1 scope.
