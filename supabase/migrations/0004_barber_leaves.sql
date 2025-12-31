-- ========================================
-- Migration: Add Barber Leave Support
-- ========================================
-- This migration adds support for marking barbers unavailable for specific dates
-- (e.g., emergency, sickness)

-- ========================================
-- BARBER LEAVES TABLE
-- ========================================
CREATE TABLE IF NOT EXISTS barber_leaves (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    barber_id UUID NOT NULL REFERENCES barbers(id) ON DELETE CASCADE,
    leave_date DATE NOT NULL,
    reason TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT unique_barber_leave_per_date UNIQUE (barber_id, leave_date)
);

-- Index for efficient leave status queries
CREATE INDEX IF NOT EXISTS idx_barber_leaves_date ON barber_leaves(barber_id, leave_date);

-- ========================================
-- UPDATED_AT TRIGGER FOR BARBER_LEAVES
-- ========================================
DROP TRIGGER IF EXISTS update_barber_leaves_timestamp ON barber_leaves;
CREATE TRIGGER update_barber_leaves_timestamp
BEFORE UPDATE ON barber_leaves
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- ========================================
-- MIGRATION LOG
-- ========================================
-- Timestamp: [Migration applied date]
-- Purpose: Add barber emergency leave feature
-- Tables affected: barber_leaves (new)
-- Backward compatible: Yes
