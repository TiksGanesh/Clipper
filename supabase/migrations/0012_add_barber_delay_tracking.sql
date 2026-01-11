-- ========================================
-- ADD DELAY TRACKING TO BARBERS TABLE
-- ========================================

-- Add current_delay_minutes column to barbers table
-- This tracks real-time delays for live booking tracking
ALTER TABLE barbers 
ADD COLUMN current_delay_minutes INTEGER NOT NULL DEFAULT 0 CHECK (current_delay_minutes >= 0);

-- Add index for efficient delay lookups
CREATE INDEX IF NOT EXISTS idx_barbers_active_delay ON barbers(id, current_delay_minutes) WHERE deleted_at IS NULL AND is_active = true;

-- Comment for documentation
COMMENT ON COLUMN barbers.current_delay_minutes IS 'Current delay in minutes for live booking tracking. Updated by barber dashboard.';
