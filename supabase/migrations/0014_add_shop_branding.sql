-- ========================================
-- ADD SHOP BRANDING COLUMNS
-- ========================================
-- Date: 2025-01-15
-- Purpose: Support multi-tenant shop branding with custom colors, logos, and splash screens

-- ========================================
-- 1. ADD NEW COLUMNS TO SHOPS TABLE
-- ========================================

ALTER TABLE shops
ADD COLUMN slug TEXT UNIQUE NOT NULL DEFAULT uuid_generate_v4()::text,
ADD COLUMN logo_url TEXT,
ADD COLUMN brand_color TEXT NOT NULL DEFAULT '#4F46E5',
ADD COLUMN tagline TEXT,
ADD COLUMN splash_image_url TEXT;

-- Create index on slug for fast lookups
CREATE INDEX IF NOT EXISTS idx_shops_slug ON shops(slug) WHERE deleted_at IS NULL;

-- ========================================
-- 2. UPDATE RLS POLICIES FOR PUBLIC ACCESS
-- ========================================

-- Enable RLS on shops (if not already enabled)
ALTER TABLE shops ENABLE ROW LEVEL SECURITY;

-- Policy: Public can read shop branding info by slug
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE policyname = 'public_read_shop_branding' 
        AND tablename = 'shops'
        AND schemaname = 'public'
    ) THEN
        CREATE POLICY public_read_shop_branding ON public.shops
        FOR SELECT TO anon, authenticated
        USING (deleted_at IS NULL);
    END IF;
END $$;

-- Policy: Shop owners can read/update their own shop details
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE policyname = 'shop_owner_read_update_own' 
        AND tablename = 'shops'
        AND schemaname = 'public'
    ) THEN
        CREATE POLICY shop_owner_read_update_own ON public.shops
        FOR SELECT TO authenticated
        USING (owner_id = auth.uid() OR deleted_at IS NULL);
    END IF;
END $$;

-- Policy: Shop owners can update their own branding
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE policyname = 'shop_owner_update_branding' 
        AND tablename = 'shops'
        AND schemaname = 'public'
    ) THEN
        CREATE POLICY shop_owner_update_branding ON public.shops
        FOR UPDATE TO authenticated
        USING (owner_id = auth.uid())
        WITH CHECK (owner_id = auth.uid());
    END IF;
END $$;
