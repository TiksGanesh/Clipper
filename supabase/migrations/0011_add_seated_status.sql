-- ========================================
-- ADD 'SEATED' STATUS TO BOOKING_STATUS ENUM
-- ========================================

-- Alter the booking_status enum to add 'seated' status
-- Note: Must add BEFORE 'completed' to maintain logical order
ALTER TYPE booking_status ADD VALUE 'seated' BEFORE 'completed';

-- Update the check_booking_overlap trigger to include 'seated' status in overlap checks
-- Seated bookings should also prevent double booking
CREATE OR REPLACE FUNCTION check_booking_overlap()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.deleted_at IS NOT NULL THEN
        RETURN NEW;
    END IF;

    IF EXISTS (
        SELECT 1 FROM bookings
        WHERE barber_id = NEW.barber_id
          AND status IN ('confirmed', 'seated', 'completed')
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
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;
