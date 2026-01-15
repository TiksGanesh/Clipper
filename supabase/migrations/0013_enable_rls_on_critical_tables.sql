-- ========================================
-- CRITICAL SECURITY PATCH: Enable RLS on Payments, Shop Closures, and Barber Leaves
-- ========================================
-- Date: 2025-01-13
-- Purpose: Enforce Row Level Security on sensitive tables
-- Severity: CRITICAL - Do not delay deployment

-- ========================================
-- 1. ENABLE RLS ON CRITICAL TABLES
-- ========================================

-- Payments Table: Highly sensitive financial data
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;

-- Shop Closures Table: Operational data (public read, admin write)
ALTER TABLE shop_closures ENABLE ROW LEVEL SECURITY;

-- Barber Leaves Table: Operational data (public read, admin write)
ALTER TABLE barber_leaves ENABLE ROW LEVEL SECURITY;

-- ========================================
-- 2. PAYMENTS TABLE POLICIES
-- ========================================
-- Access Model:
--   - READ: Authenticated users can only see payments linked to THEIR OWN shop's bookings
--   - WRITE: Service role (backend) can create and update payments
--   - DELETE: Service role (backend) only

DO $$
BEGIN
    -- Policy: Shop owners read their own shop's payments
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE policyname = 'shop_owners_read_own_payments' 
        AND tablename = 'payments' 
        AND schemaname = 'public'
    ) THEN
        EXECUTE $policy$
            CREATE POLICY shop_owners_read_own_payments ON public.payments
            FOR SELECT TO authenticated
            USING (
                EXISTS (
                    SELECT 1
                    FROM bookings b
                    JOIN shops s ON s.id = b.shop_id
                    WHERE b.id = payments.booking_id
                    AND s.owner_id = auth.uid()
                    AND s.deleted_at IS NULL
                )
            );
        $policy$;
    END IF;

    -- Policy: Service role (backend) can manage all payments
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE policyname = 'service_role_manage_payments' 
        AND tablename = 'payments' 
        AND schemaname = 'public'
    ) THEN
        EXECUTE $policy$
            CREATE POLICY service_role_manage_payments ON public.payments
            FOR ALL TO service_role
            USING (true) WITH CHECK (true);
        $policy$;
    END IF;
END $$;

-- ========================================
-- 3. SHOP_CLOSURES TABLE POLICIES
-- ========================================
-- Access Model:
--   - READ: Public access (anyone can check if shop is closed for booking purposes)
--   - INSERT: Only service role (backend) - created via admin API
--   - UPDATE: Only service role (backend)
--   - DELETE: Only service role (backend)

DO $$
BEGIN
    -- Policy: Everyone can read shop closures (needed for public booking)
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE policyname = 'public_read_shop_closures' 
        AND tablename = 'shop_closures' 
        AND schemaname = 'public'
    ) THEN
        EXECUTE $policy$
            CREATE POLICY public_read_shop_closures ON public.shop_closures
            FOR SELECT TO public, authenticated, anon
            USING (deleted_at IS NULL);
        $policy$;
    END IF;

    -- Policy: Service role (backend) can create shop closures
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE policyname = 'service_role_insert_shop_closures' 
        AND tablename = 'shop_closures' 
        AND schemaname = 'public'
    ) THEN
        EXECUTE $policy$
            CREATE POLICY service_role_insert_shop_closures ON public.shop_closures
            FOR INSERT TO service_role
            WITH CHECK (true);
        $policy$;
    END IF;

    -- Policy: Service role (backend) can update shop closures
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE policyname = 'service_role_update_shop_closures' 
        AND tablename = 'shop_closures' 
        AND schemaname = 'public'
    ) THEN
        EXECUTE $policy$
            CREATE POLICY service_role_update_shop_closures ON public.shop_closures
            FOR UPDATE TO service_role
            USING (true) WITH CHECK (true);
        $policy$;
    END IF;

    -- Policy: Service role (backend) can delete shop closures
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE policyname = 'service_role_delete_shop_closures' 
        AND tablename = 'shop_closures' 
        AND schemaname = 'public'
    ) THEN
        EXECUTE $policy$
            CREATE POLICY service_role_delete_shop_closures ON public.shop_closures
            FOR DELETE TO service_role
            USING (true);
        $policy$;
    END IF;
END $$;

-- ========================================
-- 4. BARBER_LEAVES TABLE POLICIES
-- ========================================
-- Access Model:
--   - READ: Public access (anyone can check barber availability)
--   - INSERT: Only service role (backend) - created via admin API
--   - UPDATE: Only service role (backend)
--   - DELETE: Only service role (backend)

DO $$
BEGIN
    -- Policy: Everyone can read barber leaves (needed for public booking)
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE policyname = 'public_read_barber_leaves' 
        AND tablename = 'barber_leaves' 
        AND schemaname = 'public'
    ) THEN
        EXECUTE $policy$
            CREATE POLICY public_read_barber_leaves ON public.barber_leaves
            FOR SELECT TO public, authenticated, anon
            USING (true);
        $policy$;
    END IF;

    -- Policy: Service role (backend) can create barber leaves
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE policyname = 'service_role_insert_barber_leaves' 
        AND tablename = 'barber_leaves' 
        AND schemaname = 'public'
    ) THEN
        EXECUTE $policy$
            CREATE POLICY service_role_insert_barber_leaves ON public.barber_leaves
            FOR INSERT TO service_role
            WITH CHECK (true);
        $policy$;
    END IF;

    -- Policy: Service role (backend) can update barber leaves
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE policyname = 'service_role_update_barber_leaves' 
        AND tablename = 'barber_leaves' 
        AND schemaname = 'public'
    ) THEN
        EXECUTE $policy$
            CREATE POLICY service_role_update_barber_leaves ON public.barber_leaves
            FOR UPDATE TO service_role
            USING (true) WITH CHECK (true);
        $policy$;
    END IF;

    -- Policy: Service role (backend) can delete barber leaves
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE policyname = 'service_role_delete_barber_leaves' 
        AND tablename = 'barber_leaves' 
        AND schemaname = 'public'
    ) THEN
        EXECUTE $policy$
            CREATE POLICY service_role_delete_barber_leaves ON public.barber_leaves
            FOR DELETE TO service_role
            USING (true);
        $policy$;
    END IF;
END $$;

-- ========================================
-- 5. VIEWS SECURITY EXPLANATION & FIX
-- ========================================
-- Views (active_shops, active_barbers, active_bookings, active_services):
--
-- Current Issue:
--   Views do NOT automatically inherit RLS from underlying tables.
--   When querying a view, RLS policies on the view itself are checked,
--   not the underlying table policies.
--
-- Solution: Set security_invoker = true
--   This forces the view to execute with the permissions of the CALLER,
--   not the view definition owner. This makes views respect underlying table RLS.
--
-- Implementation:
--   We recreate views with security_invoker = true.
--   This ensures:
--   - Authenticated users see only their own shop data through views
--   - Service role bypasses RLS (as intended)
--   - Public/anonymous users see what they're allowed

-- Drop existing views (they'll be recreated with security_invoker)
DROP VIEW IF EXISTS active_bookings CASCADE;
DROP VIEW IF EXISTS active_services CASCADE;
DROP VIEW IF EXISTS active_barbers CASCADE;
DROP VIEW IF EXISTS active_shops CASCADE;

-- Recreate views WITH security_invoker = true
CREATE VIEW active_shops WITH (security_invoker = true) AS 
    SELECT * FROM shops WHERE deleted_at IS NULL;

CREATE VIEW active_barbers WITH (security_invoker = true) AS 
    SELECT * FROM barbers WHERE deleted_at IS NULL;

CREATE VIEW active_services WITH (security_invoker = true) AS 
    SELECT * FROM services WHERE deleted_at IS NULL;

CREATE VIEW active_bookings WITH (security_invoker = true) AS 
    SELECT * FROM bookings WHERE deleted_at IS NULL;

-- ========================================
-- 6. VERIFICATION QUERIES
-- ========================================
-- Run these after deployment to verify RLS is enabled

-- Check RLS is enabled on critical tables
/*
SELECT tablename, rowsecurity 
FROM pg_tables 
WHERE tablename IN ('payments', 'shop_closures', 'barber_leaves')
  AND schemaname = 'public';

Expected output:
 tablename     | rowsecurity 
---------------+-------------
 payments      | t
 shop_closures | t
 barber_leaves | t


-- Check all policies are created
SELECT tablename, policyname, qual, WITH CHECK
FROM pg_policies
WHERE tablename IN ('payments', 'shop_closures', 'barber_leaves')
  AND schemaname = 'public'
ORDER BY tablename, policyname;

-- Check views have security_invoker
SELECT schemaname, viewname, security_invoker
FROM pg_views
WHERE schemaname = 'public'
  AND viewname LIKE 'active_%';

Expected output:
 schemaname | viewname        | security_invoker
------------+-----------------+-----------------
 public     | active_barbers  | t
 public     | active_bookings | t
 public     | active_services | t
 public     | active_shops    | t
*/

-- ========================================
-- 7. DEPLOYMENT NOTES
-- ========================================
/*

CRITICAL CHANGES:
1. Payments, shop_closures, barber_leaves now have RLS enabled
2. Views now use security_invoker = true (enforces caller's permissions)

IMPACT ANALYSIS:
- Shop owners: Can only see their own payments (via shop → bookings relationship)
- Customers: Cannot read payments (no authenticated customer role exists)
- Booking flow: Still works—service role bypasses RLS for payment creation
- Public booking page: Still works—can read shop_closures and barber_leaves
- Views: Still work—security_invoker ensures RLS is respected

TESTING CHECKLIST BEFORE DEPLOYMENT:
[ ] Test shop owner login—can they see their bookings? (Yes)
[ ] Test shop owner login—can they see OTHER shops? (No—RLS blocks)
[ ] Test payment creation via Razorpay webhook—does it succeed? (Yes—service role)
[ ] Test public booking page—can customers see available slots? (Yes—anon access)
[ ] Test barber leave—does it block slots in booking flow? (Yes)
[ ] Test shop closure—does it block slots in booking flow? (Yes)

ROLLBACK PLAN (if needed):
If issues occur, disable RLS temporarily:
  ALTER TABLE payments DISABLE ROW LEVEL SECURITY;
  ALTER TABLE shop_closures DISABLE ROW LEVEL SECURITY;
  ALTER TABLE barber_leaves DISABLE ROW LEVEL SECURITY;

Then revert views:
  DROP VIEW IF EXISTS active_bookings CASCADE;
  DROP VIEW IF EXISTS active_services CASCADE;
  DROP VIEW IF EXISTS active_barbers CASCADE;
  DROP VIEW IF EXISTS active_shops CASCADE;

  CREATE VIEW active_shops AS SELECT * FROM shops WHERE deleted_at IS NULL;
  CREATE VIEW active_barbers AS SELECT * FROM barbers WHERE deleted_at IS NULL;
  CREATE VIEW active_services AS SELECT * FROM services WHERE deleted_at IS NULL;
  CREATE VIEW active_bookings AS SELECT * FROM bookings WHERE deleted_at IS NULL;

Investigate the specific error in logs and report to security team.
*/
