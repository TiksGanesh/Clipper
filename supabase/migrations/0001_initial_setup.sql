-- ========================================
-- COMPLETE SCHEMA SETUP FOR CLIPPER APP
-- ========================================

-- Use uuid-ossp extension for UUID generation
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Grant permissions for foreign key validation
GRANT USAGE ON SCHEMA auth TO authenticated, anon;
GRANT SELECT ON auth.users TO authenticated, anon;

-- ========================================
-- ENUMS
-- ========================================
DO $$ BEGIN
  CREATE TYPE subscription_status AS ENUM ('trial', 'active', 'past_due', 'canceled', 'expired');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE booking_status AS ENUM ('confirmed', 'completed', 'canceled', 'no_show');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- ========================================
-- SHOPS TABLE
-- ========================================
CREATE TABLE IF NOT EXISTS shops (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
    name VARCHAR(255) NOT NULL,
    phone VARCHAR(20) NOT NULL,
    address TEXT,
    deleted_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT unique_owner UNIQUE (owner_id)
);

-- Active index for shops
CREATE INDEX IF NOT EXISTS idx_shops_active ON shops(owner_id) WHERE deleted_at IS NULL;

-- ========================================
-- BARBERS TABLE
-- ========================================
CREATE TABLE IF NOT EXISTS barbers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    shop_id UUID NOT NULL REFERENCES shops(id) ON DELETE RESTRICT,
    name VARCHAR(255) NOT NULL,
    phone VARCHAR(20),
    is_active BOOLEAN NOT NULL DEFAULT true,
    deleted_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_barbers_shop_active ON barbers(shop_id) WHERE deleted_at IS NULL;

-- Enforce max 2 ACTIVE barbers per shop
CREATE OR REPLACE FUNCTION enforce_max_barbers()
RETURNS TRIGGER AS $$
BEGIN
    IF (SELECT COUNT(*)
        FROM barbers
        WHERE shop_id = NEW.shop_id
          AND is_active = true
          AND deleted_at IS NULL) >= 2 THEN
        RAISE EXCEPTION 'Maximum 2 active barbers allowed per shop';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS check_max_barbers ON barbers;
CREATE TRIGGER check_max_barbers
BEFORE INSERT OR UPDATE ON barbers
FOR EACH ROW
WHEN (NEW.deleted_at IS NULL)
EXECUTE FUNCTION enforce_max_barbers();

-- ========================================
-- SERVICES TABLE
-- ========================================
CREATE TABLE IF NOT EXISTS services (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    shop_id UUID NOT NULL REFERENCES shops(id) ON DELETE RESTRICT,
    name VARCHAR(255) NOT NULL,
    duration_minutes INTEGER NOT NULL CHECK (duration_minutes > 0 AND duration_minutes <= 480),
    price NUMERIC(10,2) NOT NULL CHECK (price >= 0),
    is_active BOOLEAN NOT NULL DEFAULT true,
    deleted_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_services_shop_active ON services(shop_id) WHERE deleted_at IS NULL;

-- ========================================
-- WORKING HOURS TABLE
-- ========================================
CREATE TABLE IF NOT EXISTS working_hours (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    shop_id UUID NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
    day_of_week SMALLINT NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
    open_time TIME,
    close_time TIME,
    is_closed BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS working_hours_shop_day_idx
    ON working_hours (shop_id, day_of_week);

-- ========================================
-- BOOKINGS TABLE
-- ========================================
CREATE TABLE IF NOT EXISTS bookings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    shop_id UUID NOT NULL REFERENCES shops(id) ON DELETE RESTRICT,
    barber_id UUID NOT NULL REFERENCES barbers(id) ON DELETE RESTRICT,
    service_id UUID NOT NULL REFERENCES services(id) ON DELETE RESTRICT,
    customer_name VARCHAR(255) NOT NULL,
    customer_phone VARCHAR(20) NOT NULL,
    start_time TIMESTAMPTZ NOT NULL,
    end_time TIMESTAMPTZ NOT NULL,
    status booking_status NOT NULL DEFAULT 'confirmed',
    is_walk_in BOOLEAN NOT NULL DEFAULT false,
    notes TEXT,
    deleted_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT valid_time_range CHECK (end_time > start_time)
);

-- Overlap prevention via trigger
CREATE OR REPLACE FUNCTION check_booking_overlap()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.deleted_at IS NOT NULL THEN
        RETURN NEW;
    END IF;

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
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS prevent_booking_overlap ON bookings;
CREATE TRIGGER prevent_booking_overlap
BEFORE INSERT OR UPDATE ON bookings
FOR EACH ROW
EXECUTE FUNCTION check_booking_overlap();

CREATE INDEX IF NOT EXISTS idx_bookings_shop_active ON bookings(shop_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_bookings_barber_active ON bookings(barber_id, start_time) WHERE deleted_at IS NULL;

-- ========================================
-- SUBSCRIPTIONS TABLE (for Razorpay)
-- ========================================
CREATE TABLE IF NOT EXISTS subscriptions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    shop_id UUID NOT NULL REFERENCES shops(id) ON DELETE RESTRICT UNIQUE,
    razorpay_subscription_id VARCHAR(255) UNIQUE,
    razorpay_plan_id VARCHAR(255),
    status subscription_status NOT NULL DEFAULT 'trial',
    trial_ends_at TIMESTAMPTZ,
    current_period_start TIMESTAMPTZ,
    current_period_end TIMESTAMPTZ,
    canceled_at TIMESTAMPTZ,
    deleted_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT unique_shop_subscription UNIQUE (shop_id)
);

CREATE INDEX IF NOT EXISTS idx_subscriptions_shop_active ON subscriptions(shop_id) WHERE deleted_at IS NULL;

-- ========================================
-- UPDATED_AT TRIGGERS
-- ========================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_shops_updated_at ON shops;
CREATE TRIGGER update_shops_updated_at BEFORE UPDATE ON shops FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
DROP TRIGGER IF EXISTS update_barbers_updated_at ON barbers;
CREATE TRIGGER update_barbers_updated_at BEFORE UPDATE ON barbers FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
DROP TRIGGER IF EXISTS update_services_updated_at ON services;
CREATE TRIGGER update_services_updated_at BEFORE UPDATE ON services FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
DROP TRIGGER IF EXISTS update_bookings_updated_at ON bookings;
CREATE TRIGGER update_bookings_updated_at BEFORE UPDATE ON bookings FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
DROP TRIGGER IF EXISTS update_subscriptions_updated_at ON subscriptions;
CREATE TRIGGER update_subscriptions_updated_at BEFORE UPDATE ON subscriptions FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ========================================
-- VIEWS FOR ACTIVE RECORDS
-- ========================================
CREATE OR REPLACE VIEW active_shops AS SELECT * FROM shops WHERE deleted_at IS NULL;
CREATE OR REPLACE VIEW active_barbers AS SELECT * FROM barbers WHERE deleted_at IS NULL;
CREATE OR REPLACE VIEW active_services AS SELECT * FROM services WHERE deleted_at IS NULL;
CREATE OR REPLACE VIEW active_bookings AS SELECT * FROM bookings WHERE deleted_at IS NULL;

-- ========================================
-- ROW LEVEL SECURITY (RLS)
-- ========================================

ALTER TABLE shops ENABLE ROW LEVEL SECURITY;
ALTER TABLE barbers ENABLE ROW LEVEL SECURITY;
ALTER TABLE services ENABLE ROW LEVEL SECURITY;
ALTER TABLE working_hours ENABLE ROW LEVEL SECURITY;
ALTER TABLE bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;

-- SHOPS policies
CREATE POLICY "shop_owners_read_own_shop" ON shops
    FOR SELECT TO authenticated USING (owner_id = auth.uid());
CREATE POLICY "shop_owners_update_own_shop" ON shops
    FOR UPDATE TO authenticated USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid());
CREATE POLICY "shop_owners_insert_own_shop" ON shops
    FOR INSERT TO authenticated WITH CHECK (owner_id = auth.uid());
CREATE POLICY "admins_read_all_shops" ON shops
    FOR SELECT TO authenticated USING (
        EXISTS (
            SELECT 1 FROM auth.users
            WHERE id = auth.uid()
              AND raw_user_meta_data->>'role' = 'admin'
        )
    );

-- BARBERS policies
CREATE POLICY "shop_owners_read_own_barbers" ON barbers
    FOR SELECT TO authenticated USING (
        EXISTS (
            SELECT 1 FROM shops
            WHERE shops.id = barbers.shop_id
              AND shops.owner_id = auth.uid()
              AND shops.deleted_at IS NULL
        )
    );
CREATE POLICY "shop_owners_insert_own_barbers" ON barbers
    FOR INSERT TO authenticated WITH CHECK (
        EXISTS (
            SELECT 1 FROM shops
            WHERE shops.id = barbers.shop_id
              AND shops.owner_id = auth.uid()
              AND shops.deleted_at IS NULL
        )
    );
CREATE POLICY "shop_owners_update_own_barbers" ON barbers
    FOR UPDATE TO authenticated USING (
        EXISTS (
            SELECT 1 FROM shops
            WHERE shops.id = barbers.shop_id
              AND shops.owner_id = auth.uid()
              AND shops.deleted_at IS NULL
        )
    ) WITH CHECK (
        EXISTS (
            SELECT 1 FROM shops
            WHERE shops.id = barbers.shop_id
              AND shops.owner_id = auth.uid()
              AND shops.deleted_at IS NULL
        )
    );

-- SERVICES policies
CREATE POLICY "shop_owners_read_own_services" ON services
    FOR SELECT TO authenticated USING (
        EXISTS (
            SELECT 1 FROM shops
            WHERE shops.id = services.shop_id
              AND shops.owner_id = auth.uid()
              AND shops.deleted_at IS NULL
        )
    );
CREATE POLICY "shop_owners_insert_own_services" ON services
    FOR INSERT TO authenticated WITH CHECK (
        EXISTS (
            SELECT 1 FROM shops
            WHERE shops.id = services.shop_id
              AND shops.owner_id = auth.uid()
              AND shops.deleted_at IS NULL
        )
    );
CREATE POLICY "shop_owners_update_own_services" ON services
    FOR UPDATE TO authenticated USING (
        EXISTS (
            SELECT 1 FROM shops
            WHERE shops.id = services.shop_id
              AND shops.owner_id = auth.uid()
              AND shops.deleted_at IS NULL
        )
    ) WITH CHECK (
        EXISTS (
            SELECT 1 FROM shops
            WHERE shops.id = services.shop_id
              AND shops.owner_id = auth.uid()
              AND shops.deleted_at IS NULL
        )
    );

-- BOOKINGS policies
CREATE POLICY "shop_owners_read_own_bookings" ON bookings
    FOR SELECT TO authenticated USING (
        EXISTS (
            SELECT 1 FROM shops
            WHERE shops.id = bookings.shop_id
              AND shops.owner_id = auth.uid()
              AND shops.deleted_at IS NULL
        )
    );
CREATE POLICY "shop_owners_insert_own_bookings" ON bookings
    FOR INSERT TO authenticated WITH CHECK (
        EXISTS (
            SELECT 1 FROM shops
            WHERE shops.id = bookings.shop_id
              AND shops.owner_id = auth.uid()
              AND shops.deleted_at IS NULL
        )
    );
CREATE POLICY "shop_owners_update_own_bookings" ON bookings
    FOR UPDATE TO authenticated USING (
        EXISTS (
            SELECT 1 FROM shops
            WHERE shops.id = bookings.shop_id
              AND shops.owner_id = auth.uid()
              AND shops.deleted_at IS NULL
        )
    ) WITH CHECK (
        EXISTS (
            SELECT 1 FROM shops
            WHERE shops.id = bookings.shop_id
              AND shops.owner_id = auth.uid()
              AND shops.deleted_at IS NULL
        )
    );
CREATE POLICY "customers_insert_bookings" ON bookings
    FOR INSERT TO anon WITH CHECK (true);

-- SUBSCRIPTIONS policies
CREATE POLICY "shop_owners_read_own_subscription" ON subscriptions
    FOR SELECT TO authenticated USING (
        EXISTS (
            SELECT 1 FROM shops
            WHERE shops.id = subscriptions.shop_id
              AND shops.owner_id = auth.uid()
              AND shops.deleted_at IS NULL
        )
    );
CREATE POLICY "service_role_manage_subscriptions" ON subscriptions
    FOR ALL TO service_role USING (true) WITH CHECK (true);
