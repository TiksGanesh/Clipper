-- Migration: Add soft lock mechanism for bookings
-- Purpose: Prevent double-bookings by introducing a pending_payment status and expiration

-- Step 1: Add 'pending_payment' to booking_status enum
ALTER TYPE booking_status ADD VALUE IF NOT EXISTS 'pending_payment';

-- Step 2: Add expires_at column to bookings table
ALTER TABLE bookings 
ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ;

-- Step 3: Create index for efficient cleanup queries
CREATE INDEX IF NOT EXISTS idx_bookings_expired_pending 
ON bookings(status, expires_at) 
WHERE status = 'pending_payment' AND deleted_at IS NULL;

-- Step 4: Update the booking overlap trigger to include 'pending_payment' status
-- This prevents double-booking when a slot is held
DROP FUNCTION IF EXISTS check_booking_overlap() CASCADE;

CREATE OR REPLACE FUNCTION check_booking_overlap()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.deleted_at IS NOT NULL THEN
        RETURN NEW;
    END IF;

    -- Check for overlaps with confirmed/completed bookings and non-expired pending bookings
    IF EXISTS (
        SELECT 1 FROM bookings
        WHERE barber_id = NEW.barber_id
          AND deleted_at IS NULL
          AND id != COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::UUID)
          AND (
            -- Include confirmed and completed bookings
            status IN ('confirmed', 'completed')
            OR 
            -- Include pending_payment bookings that haven't expired yet
            (status = 'pending_payment' AND (expires_at IS NULL OR expires_at > NOW()))
          )
          AND (
            (NEW.start_time >= start_time AND NEW.start_time < end_time)
            OR (NEW.end_time > start_time AND NEW.end_time <= end_time)
            OR (NEW.start_time <= start_time AND NEW.end_time >= end_time)
          )
    ) THEN
        RAISE EXCEPTION 'Booking time overlaps with existing or held booking for this barber';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Recreate the trigger
CREATE TRIGGER prevent_booking_overlap
BEFORE INSERT OR UPDATE ON bookings
FOR EACH ROW
EXECUTE FUNCTION check_booking_overlap();

-- Step 5: Create function to clean up expired pending bookings
CREATE OR REPLACE FUNCTION cleanup_expired_pending_bookings()
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    WITH deleted AS (
        DELETE FROM bookings
        WHERE status = 'pending_payment'
          AND expires_at IS NOT NULL
          AND expires_at < NOW()
          AND deleted_at IS NULL
        RETURNING id
    )
    SELECT COUNT(*) INTO deleted_count FROM deleted;
    
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION cleanup_expired_pending_bookings() IS 'Deletes bookings with pending_payment status that have expired';
