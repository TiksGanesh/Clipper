# Appointment Status Lifecycle - Implementation Guide

## Quick Start for Barbers

### 1. What's New?

Your barber dashboard now tracks appointment status through these stages:

- **Waiting** (blue) - Customer has a confirmed appointment
- **In Chair** (green) - Customer is being served
- **Done** (gray) - Service completed
- **No-show** (orange) - Customer didn't show up
- **Cancelled** (red) - Appointment was cancelled

### 2. Using the Feature

#### Step 1: Customer Arrives
When a customer arrives for their appointment:
- Find the appointment in your calendar
- Click the **✂️ Seat** button
- The appointment card will turn green and move to the top (active work)

#### Step 2: Service In Progress
While providing the service:
- The card shows the customer is "In Chair"
- You can see all active work at the top of your list

#### Step 3: Service Complete
After the service is done:
- Click **✅ Complete** on the green card
- The appointment is marked as done and moves to the bottom
- You can now take the next customer

#### Alternative Actions
- **❌ No-show**: Click if customer doesn't arrive
- **Cancel**: Cancel an appointment (from Waiting or In Chair states)

### 3. Visual Cues

| Status | Color | Location | Meaning |
|--------|-------|----------|---------|
| Waiting | Blue | Middle | Ready to be seated |
| In Chair | Green (bright border) | Top | Currently being served |
| Done | Gray | Bottom | Completed, no action needed |
| No-show | Orange | Bottom | Customer missed appointment |
| Cancelled | Red | Bottom | Booking cancelled |

### 4. Mobile Features

All features work on mobile phones:
- Touch-friendly buttons
- Stacked layout on small screens
- Large tap targets (easy to press)
- Responsive card sizes

### 5. Tips

✅ **Best Practices:**
- Seat customer immediately when they arrive
- Complete immediately after finishing service
- Use "No-show" if customer doesn't arrive
- You can see all In-Chair appointments at the top for quick reference

⚠️ **Remember:**
- Completed appointments are read-only (cannot be changed)
- No-show appointments cannot be changed
- You can only cancel or complete "In Chair" appointments

---

## For Developers

### Database Schema

**New Enum Value**: `'seated'` added to `booking_status`

```sql
CREATE TYPE booking_status AS ENUM ('confirmed', 'seated', 'completed', 'canceled', 'no_show');
```

### API Endpoints

All status changes use the same server action pattern:

```typescript
// Seat a customer
await seatCustomerAction({ bookingId })

// Mark as completed
await markBookingCompletedAction({ bookingId })

// Mark as no-show
await markBookingNoShowAction({ bookingId })

// Cancel
await cancelBookingAction({ bookingId })
```

### Component Props

**AppointmentCard** component:
```typescript
type AppointmentStatus = 'confirmed' | 'seated' | 'completed' | 'canceled' | 'no_show'

type Props = {
    bookingId: string
    serviceName: string
    customerName: string
    appointmentTime: string
    duration: number
    status: AppointmentStatus
    isWalkIn?: boolean
    // ... other optional props
}
```

### Sorting Logic

Bookings are automatically sorted in this order:
1. **Seated** (In Chair) - always at top
2. **Confirmed** (Waiting) - by appointment time
3. **No-show** - completed failed appointments
4. **Completed** - finished appointments
5. **Canceled** - cancelled appointments

### Type Updates

Updated in `types/database.ts`:
- `booking_status` Enum
- `bookings` table Row, Insert, Update types
- `DayBooking` type in components
- `BookingDisplayStatus` type

---

## Deployment Checklist

- [ ] Apply migration `0011_add_seated_status.sql` to database
- [ ] Redeploy application (Next.js build)
- [ ] Test status transitions in staging
- [ ] Verify mobile responsiveness
- [ ] Confirm API actions work end-to-end
- [ ] Monitor for any database constraint violations

---

## Files Changed

### New Files
- `components/dashboard/AppointmentCard.tsx` - New card component
- `supabase/migrations/0011_add_seated_status.sql` - Migration
- `APPOINTMENT_STATUS_LIFECYCLE.md` - Full documentation

### Modified Files
- `app/barber/calendar/actions.ts` - New action functions
- `components/calendar/DayView.tsx` - Enhanced with sorting/status
- `components/calendar/AppointmentDetailSheet.tsx` - Status support
- `types/database.ts` - Type definitions

---

## FAQ

**Q: Can I undo a status change?**
A: Not in the current version. Completed and No-show appointments are permanent.

**Q: What happens if I mark a customer as "In Chair" but they leave?**
A: Click "Cancel" to remove the appointment, or "Complete" if the service was finished.

**Q: Why are "In Chair" appointments at the top?**
A: To help you focus on active work. You can quickly see who you're currently serving.

**Q: Is this mobile-friendly?**
A: Yes! All features work on phones with responsive buttons and layouts.

**Q: Do my customers see these status changes?**
A: No. This is internal dashboard only. Customers don't see status updates.

---

## Support

For issues or questions:
1. Check the component props and types
2. Review server action error messages
3. Verify database migration was applied
4. Check browser console for client-side errors
