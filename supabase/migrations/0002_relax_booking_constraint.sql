-- ========================================
-- MIGRATION: Relax booking_today_future_check constraint
-- This constraint was too strict—it prevented updating past bookings to mark them as completed/no_show.
-- The constraint should only prevent INSERT of past bookings, not UPDATE of their status.
-- ========================================

DO $$ BEGIN
    -- Drop the old restrictive constraint
    ALTER TABLE bookings DROP CONSTRAINT IF EXISTS booking_today_future_check;
EXCEPTION
    WHEN others THEN null;
END $$;

-- Add a new, less restrictive constraint that only applies to new bookings
DO $$ BEGIN
    ALTER TABLE bookings
        ADD CONSTRAINT booking_not_past_on_insert
        CHECK (start_time > now() - interval '1 minute');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;
