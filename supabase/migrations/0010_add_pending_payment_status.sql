-- Add 'pending_payment' status to booking_status enum and expires_at column
-- This enables soft lock mechanism to prevent double-bookings during payment

-- Step 1: Add the new status to the enum type
ALTER TYPE booking_status ADD VALUE 'pending_payment' BEFORE 'confirmed';

-- Step 2: Add expires_at column to bookings table for soft lock expiry
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ;

-- Step 3: Add index for cleanup queries
CREATE INDEX IF NOT EXISTS idx_bookings_pending_expires ON bookings(shop_id, expires_at) 
WHERE status = 'pending_payment' AND deleted_at IS NULL;

-- Step 4: Update the overlap prevention trigger to consider pending_payment bookings with valid expiry
CREATE OR REPLACE FUNCTION check_booking_overlap()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.deleted_at IS NOT NULL THEN
        RETURN NEW;
    END IF;

    -- Check for overlaps with confirmed/completed bookings
    IF EXISTS (
        SELECT 1 FROM bookings
        WHERE barber_id = NEW.barber_id
          AND status IN ('confirmed', 'completed')
          AND deleted_at IS NULL
          AND id != COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::UUID)
          AND (
            (NEW.start_time >= start_time AND NEW.start_time < end_time)
            OR (NEW.end_time > start_time AND NEW.end_time <= end_time)
            OR (NEW.start_time <= start_time AND NEW.end_time >= end_time)
          )
    ) THEN
        RAISE EXCEPTION 'Booking time overlaps with existing booking for this barber';
    END IF;

    -- Check for overlaps with non-expired pending_payment bookings
    IF EXISTS (
        SELECT 1 FROM bookings
        WHERE barber_id = NEW.barber_id
          AND status = 'pending_payment'
          AND deleted_at IS NULL
          AND id != COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::UUID)
          AND expires_at > NOW()
          AND (
            (NEW.start_time >= start_time AND NEW.start_time < end_time)
            OR (NEW.end_time > start_time AND NEW.end_time <= end_time)
            OR (NEW.start_time <= start_time AND NEW.end_time >= end_time)
          )
    ) THEN
        RAISE EXCEPTION 'Booking time is held by another user';
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;
