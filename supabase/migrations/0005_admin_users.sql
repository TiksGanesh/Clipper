-- ========================================
-- Migration: Admin Users Table & Role Enforcement
-- ========================================

-- Dedicated admin membership table (server-managed)
CREATE TABLE IF NOT EXISTS admin_users (
    user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- RLS for admin_users
ALTER TABLE admin_users ENABLE ROW LEVEL SECURITY;

-- Admins can confirm their own membership; service role can manage
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE policyname = 'admin_self_select' AND tablename = 'admin_users' AND schemaname = 'public'
    ) THEN
        EXECUTE $policy$
            CREATE POLICY admin_self_select ON public.admin_users
            FOR SELECT TO authenticated
            USING (user_id = auth.uid());
        $policy$;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE policyname = 'service_role_manage_admin_users' AND tablename = 'admin_users' AND schemaname = 'public'
    ) THEN
        EXECUTE $policy$
            CREATE POLICY service_role_manage_admin_users ON public.admin_users
            FOR ALL TO service_role
            USING (true) WITH CHECK (true);
        $policy$;
    END IF;
END $$;

-- Prevent admins from being shop owners (no role switching)
CREATE OR REPLACE FUNCTION prevent_admin_as_shop_owner()
RETURNS TRIGGER AS $$
BEGIN
    IF EXISTS (SELECT 1 FROM admin_users WHERE user_id = NEW.owner_id) THEN
        RAISE EXCEPTION 'Admin users cannot own shops';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_prevent_admin_shop_owner ON shops;
CREATE TRIGGER trg_prevent_admin_shop_owner
BEFORE INSERT OR UPDATE ON shops
FOR EACH ROW
EXECUTE FUNCTION prevent_admin_as_shop_owner();

-- Prevent shop owners from being added as admins (one-way role)
CREATE OR REPLACE FUNCTION prevent_shop_owner_as_admin()
RETURNS TRIGGER AS $$
BEGIN
    IF EXISTS (SELECT 1 FROM shops WHERE owner_id = NEW.user_id) THEN
        RAISE EXCEPTION 'Shop owners cannot be admins';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_prevent_shop_owner_as_admin ON admin_users;
CREATE TRIGGER trg_prevent_shop_owner_as_admin
BEFORE INSERT OR UPDATE ON admin_users
FOR EACH ROW
EXECUTE FUNCTION prevent_shop_owner_as_admin();

-- Replace admin read policy on shops to rely on server-side table instead of client metadata
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM pg_policies
        WHERE policyname = 'admins_read_all_shops' AND tablename = 'shops' AND schemaname = 'public'
    ) THEN
        EXECUTE 'DROP POLICY admins_read_all_shops ON public.shops';
    END IF;

    EXECUTE $policy$
        CREATE POLICY admins_read_all_shops ON public.shops
        FOR SELECT TO authenticated
        USING (
            EXISTS (
                SELECT 1 FROM admin_users au WHERE au.user_id = auth.uid()
            )
        );
    $policy$;
END $$;
