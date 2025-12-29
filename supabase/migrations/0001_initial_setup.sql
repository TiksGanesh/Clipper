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
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE policyname = 'shop_owners_read_own_shop' AND tablename = 'shops' AND schemaname = 'public'
    ) THEN
        EXECUTE $policy$
            CREATE POLICY shop_owners_read_own_shop ON public.shops
            FOR SELECT TO authenticated USING (owner_id = auth.uid());
        $policy$;
    END IF;
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE policyname = 'shop_owners_update_own_shop' AND tablename = 'shops' AND schemaname = 'public'
    ) THEN
        EXECUTE $policy$
            CREATE POLICY shop_owners_update_own_shop ON public.shops
            FOR UPDATE TO authenticated USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid());
        $policy$;
    END IF;
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE policyname = 'shop_owners_insert_own_shop' AND tablename = 'shops' AND schemaname = 'public'
    ) THEN
        EXECUTE $policy$
            CREATE POLICY shop_owners_insert_own_shop ON public.shops
            FOR INSERT TO authenticated WITH CHECK (owner_id = auth.uid());
        $policy$;
    END IF;
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE policyname = 'admins_read_all_shops' AND tablename = 'shops' AND schemaname = 'public'
    ) THEN
        EXECUTE $policy$
            CREATE POLICY admins_read_all_shops ON public.shops
            FOR SELECT TO authenticated USING (
                EXISTS (
                    SELECT 1 FROM auth.users
                    WHERE id = auth.uid()
                        AND raw_user_meta_data->>'role' = 'admin'
                )
            );
        $policy$;
    END IF;
END $$;

-- BARBERS policies
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE policyname = 'shop_owners_read_own_barbers' AND tablename = 'barbers' AND schemaname = 'public'
    ) THEN
        EXECUTE $policy$
            CREATE POLICY shop_owners_read_own_barbers ON public.barbers
            FOR SELECT TO authenticated USING (
                EXISTS (
                    SELECT 1 FROM shops
                    WHERE shops.id = barbers.shop_id
                        AND shops.owner_id = auth.uid()
                        AND shops.deleted_at IS NULL
                )
            );
        $policy$;
    END IF;
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE policyname = 'shop_owners_insert_own_barbers' AND tablename = 'barbers' AND schemaname = 'public'
    ) THEN
        EXECUTE $policy$
            CREATE POLICY shop_owners_insert_own_barbers ON public.barbers
            FOR INSERT TO authenticated WITH CHECK (
                EXISTS (
                    SELECT 1 FROM shops
                    WHERE shops.id = barbers.shop_id
                        AND shops.owner_id = auth.uid()
                        AND shops.deleted_at IS NULL
                )
            );
        $policy$;
    END IF;
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE policyname = 'shop_owners_update_own_barbers' AND tablename = 'barbers' AND schemaname = 'public'
    ) THEN
        EXECUTE $policy$
            CREATE POLICY shop_owners_update_own_barbers ON public.barbers
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
        $policy$;
    END IF;
END $$;

-- SERVICES policies
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE policyname = 'shop_owners_read_own_services' AND tablename = 'services' AND schemaname = 'public'
    ) THEN
        EXECUTE $policy$
            CREATE POLICY shop_owners_read_own_services ON public.services
            FOR SELECT TO authenticated USING (
                EXISTS (
                    SELECT 1 FROM shops
                    WHERE shops.id = services.shop_id
                        AND shops.owner_id = auth.uid()
                        AND shops.deleted_at IS NULL
                )
            );
        $policy$;
    END IF;
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE policyname = 'shop_owners_insert_own_services' AND tablename = 'services' AND schemaname = 'public'
    ) THEN
        EXECUTE $policy$
            CREATE POLICY shop_owners_insert_own_services ON public.services
            FOR INSERT TO authenticated WITH CHECK (
                EXISTS (
                    SELECT 1 FROM shops
                    WHERE shops.id = services.shop_id
                        AND shops.owner_id = auth.uid()
                        AND shops.deleted_at IS NULL
                )
            );
        $policy$;
    END IF;
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE policyname = 'shop_owners_update_own_services' AND tablename = 'services' AND schemaname = 'public'
    ) THEN
        EXECUTE $policy$
            CREATE POLICY shop_owners_update_own_services ON public.services
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
        $policy$;
    END IF;
END $$;

-- BOOKINGS policies
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE policyname = 'shop_owners_read_own_bookings' AND tablename = 'bookings' AND schemaname = 'public'
    ) THEN
        EXECUTE $policy$
            CREATE POLICY shop_owners_read_own_bookings ON public.bookings
            FOR SELECT TO authenticated USING (
                EXISTS (
                    SELECT 1 FROM shops
                    WHERE shops.id = bookings.shop_id
                        AND shops.owner_id = auth.uid()
                        AND shops.deleted_at IS NULL
                )
            );
        $policy$;
    END IF;
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE policyname = 'shop_owners_insert_own_bookings' AND tablename = 'bookings' AND schemaname = 'public'
    ) THEN
        EXECUTE $policy$
            CREATE POLICY shop_owners_insert_own_bookings ON public.bookings
            FOR INSERT TO authenticated WITH CHECK (
                EXISTS (
                    SELECT 1 FROM shops
                    WHERE shops.id = bookings.shop_id
                        AND shops.owner_id = auth.uid()
                        AND shops.deleted_at IS NULL
                )
            );
        $policy$;
    END IF;
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE policyname = 'shop_owners_update_own_bookings' AND tablename = 'bookings' AND schemaname = 'public'
    ) THEN
        EXECUTE $policy$
            CREATE POLICY shop_owners_update_own_bookings ON public.bookings
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
        $policy$;
    END IF;
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE policyname = 'customers_insert_bookings' AND tablename = 'bookings' AND schemaname = 'public'
    ) THEN
        EXECUTE $policy$
            CREATE POLICY customers_insert_bookings ON public.bookings
            FOR INSERT TO anon WITH CHECK (true);
        $policy$;
    END IF;
END $$;

-- SUBSCRIPTIONS policies
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE policyname = 'shop_owners_read_own_subscription' AND tablename = 'subscriptions' AND schemaname = 'public'
    ) THEN
        EXECUTE $policy$
            CREATE POLICY shop_owners_read_own_subscription ON public.subscriptions
            FOR SELECT TO authenticated USING (
                EXISTS (
                    SELECT 1 FROM shops
                    WHERE shops.id = subscriptions.shop_id
                        AND shops.owner_id = auth.uid()
                        AND shops.deleted_at IS NULL
                )
            );
        $policy$;
    END IF;
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE policyname = 'service_role_manage_subscriptions' AND tablename = 'subscriptions' AND schemaname = 'public'
    ) THEN
        EXECUTE $policy$
            CREATE POLICY service_role_manage_subscriptions ON public.subscriptions
            FOR ALL TO service_role USING (true) WITH CHECK (true);
        $policy$;
    END IF;
END $$;

-- WORKING HOURS policies
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE policyname = 'shop_owners_read_own_hours' AND tablename = 'working_hours' AND schemaname = 'public'
    ) THEN
        EXECUTE $policy$
            CREATE POLICY shop_owners_read_own_hours ON public.working_hours
            FOR SELECT TO authenticated USING (
                EXISTS (
                    SELECT 1 FROM shops
                    WHERE shops.id = working_hours.shop_id
                        AND shops.owner_id = auth.uid()
                        AND shops.deleted_at IS NULL
                )
            );
        $policy$;
    END IF;
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE policyname = 'shop_owners_insert_own_hours' AND tablename = 'working_hours' AND schemaname = 'public'
    ) THEN
        EXECUTE $policy$
            CREATE POLICY shop_owners_insert_own_hours ON public.working_hours
            FOR INSERT TO authenticated WITH CHECK (
                EXISTS (
                    SELECT 1 FROM shops
                    WHERE shops.id = working_hours.shop_id
                        AND shops.owner_id = auth.uid()
                        AND shops.deleted_at IS NULL
                )
            );
        $policy$;
    END IF;
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE policyname = 'shop_owners_update_own_hours' AND tablename = 'working_hours' AND schemaname = 'public'
    ) THEN
        EXECUTE $policy$
            CREATE POLICY shop_owners_update_own_hours ON public.working_hours
            FOR UPDATE TO authenticated USING (
                EXISTS (
                    SELECT 1 FROM shops
                    WHERE shops.id = working_hours.shop_id
                        AND shops.owner_id = auth.uid()
                        AND shops.deleted_at IS NULL
                )
            ) WITH CHECK (
                EXISTS (
                    SELECT 1 FROM shops
                    WHERE shops.id = working_hours.shop_id
                        AND shops.owner_id = auth.uid()
                        AND shops.deleted_at IS NULL
                )
            );
        $policy$;
    END IF;
END $$;

-- ========================================
-- MULTI-SERVICE BOOKINGS: JOIN TABLE
-- ========================================
CREATE TABLE IF NOT EXISTS booking_services (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        booking_id UUID NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
        service_id UUID NOT NULL REFERENCES services(id) ON DELETE RESTRICT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        CONSTRAINT booking_services_unique UNIQUE (booking_id, service_id)
);

CREATE INDEX IF NOT EXISTS idx_booking_services_booking ON booking_services(booking_id);
CREATE INDEX IF NOT EXISTS idx_booking_services_service ON booking_services(service_id);

ALTER TABLE booking_services ENABLE ROW LEVEL SECURITY;

-- Owners can read booking_services for their own shop via bookings->shops
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE policyname = 'owners_read_booking_services' AND tablename = 'booking_services' AND schemaname = 'public'
    ) THEN
        EXECUTE $policy$
            CREATE POLICY owners_read_booking_services ON public.booking_services
            FOR SELECT TO authenticated USING (
                EXISTS (
                    SELECT 1
                    FROM bookings b
                    JOIN shops s ON s.id = b.shop_id
                    WHERE b.id = booking_services.booking_id
                        AND s.owner_id = auth.uid()
                        AND s.deleted_at IS NULL
                )
            );
        $policy$;
    END IF;
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE policyname = 'service_role_manage_booking_services' AND tablename = 'booking_services' AND schemaname = 'public'
    ) THEN
        EXECUTE $policy$
            CREATE POLICY service_role_manage_booking_services ON public.booking_services
            FOR ALL TO service_role USING (true) WITH CHECK (true);
        $policy$;
    END IF;
END $$;

-- updated_at trigger for booking_services
DROP TRIGGER IF EXISTS update_booking_services_updated_at ON booking_services;
CREATE TRIGGER update_booking_services_updated_at
BEFORE UPDATE ON booking_services
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ========================================
-- OPTIONAL: BOOKING WINDOW ENFORCEMENT (UTC)
-- Allow only today and +1 day; and if today, start_time must be in the future
-- NOTE: Uses NOW() in CHECK; evaluated at write-time
DO $$ BEGIN
    ALTER TABLE bookings
        ADD CONSTRAINT booking_window_day_check
        CHECK (
            (date(start_time AT TIME ZONE 'UTC') >= date((now() AT TIME ZONE 'UTC')))
            AND (date(start_time AT TIME ZONE 'UTC') <= date((now() AT TIME ZONE 'UTC')) + 1)
        );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    ALTER TABLE bookings
        ADD CONSTRAINT booking_today_future_check
        CHECK (
            CASE WHEN date(start_time AT TIME ZONE 'UTC') = date((now() AT TIME ZONE 'UTC'))
                     THEN start_time > now()
                     ELSE true
            END
        );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- ========================================
-- AUTO-SYNC BOOKING END TIME
-- Trigger to keep bookings.end_time in sync with booking_services duration changes
-- ========================================
CREATE OR REPLACE FUNCTION recalculate_booking_end_time()
RETURNS TRIGGER AS $$
DECLARE
  v_booking_id UUID;
  v_total_duration INTEGER;
  v_start_time TIMESTAMPTZ;
BEGIN
  -- Determine which booking_id to update
  IF TG_OP = 'DELETE' THEN
    v_booking_id := OLD.booking_id;
  ELSE
    v_booking_id := NEW.booking_id;
  END IF;

  -- Calculate total duration from all linked services
  SELECT COALESCE(SUM(s.duration_minutes), 0)
  INTO v_total_duration
  FROM booking_services bs
  JOIN services s ON s.id = bs.service_id
  WHERE bs.booking_id = v_booking_id
    AND s.deleted_at IS NULL;

  -- Fetch the booking's start_time
  SELECT start_time INTO v_start_time
  FROM bookings
  WHERE id = v_booking_id;

  -- Update the booking's end_time based on start_time + total duration
  IF v_start_time IS NOT NULL THEN
    UPDATE bookings
    SET end_time = v_start_time + (v_total_duration || ' minutes')::INTERVAL
    WHERE id = v_booking_id;
  END IF;

  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS recalc_booking_end_time_on_services ON booking_services;
CREATE TRIGGER recalc_booking_end_time_on_services
AFTER INSERT OR UPDATE OR DELETE ON booking_services
FOR EACH ROW
EXECUTE FUNCTION recalculate_booking_end_time();

-- ========================================
-- NON-OVERLAP PROTECTION (GiST Exclusion)
-- Prevent double booking at the database level
-- ========================================
-- Enable GiST opclasses for btree types
CREATE EXTENSION IF NOT EXISTS btree_gist;

-- Generated half-open range [start_time, end_time)
ALTER TABLE bookings
        ADD COLUMN IF NOT EXISTS time_range tstzrange
        GENERATED ALWAYS AS (tstzrange(start_time, end_time, '[)')) STORED;

-- Exclusion constraint: no overlapping ranges per barber
ALTER TABLE bookings
        ADD CONSTRAINT bookings_no_overlap
        EXCLUDE USING gist (
                barber_id WITH =,
                time_range WITH &&
        )
        WHERE (deleted_at IS NULL AND status IN ('confirmed','completed'))
        DEFERRABLE INITIALLY IMMEDIATE;

-- Remove legacy trigger-based overlap check (race-prone)
DROP TRIGGER IF EXISTS prevent_booking_overlap ON bookings;
DROP FUNCTION IF EXISTS check_booking_overlap();

-- ========================================
-- TRANSACTIONAL BOOKING RPC
-- Inserts booking and linked services atomically; lets constraints enforce non-overlap
-- ========================================
CREATE OR REPLACE FUNCTION book_booking(
    p_shop_id UUID,
    p_barber_id UUID,
    p_service_ids UUID[],
    p_customer_name TEXT,
    p_customer_phone TEXT,
    p_start_time TIMESTAMPTZ,
    p_end_time TIMESTAMPTZ,
    p_is_walk_in BOOLEAN DEFAULT false
) RETURNS UUID AS $$
DECLARE
    v_booking_id UUID;
    v_barber_shop UUID;
    v_services_shop UUID;
    v_inactive_services INTEGER;
BEGIN
    -- Validate barber belongs to shop and is active
    SELECT shop_id INTO v_barber_shop
    FROM barbers
    WHERE id = p_barber_id AND deleted_at IS NULL AND is_active = true;

    IF v_barber_shop IS NULL OR v_barber_shop <> p_shop_id THEN
        RAISE EXCEPTION 'Barber not available for this shop';
    END IF;

    -- Validate services are active
    SELECT COUNT(*) INTO v_inactive_services
    FROM services
    WHERE id = ANY(p_service_ids)
        AND (deleted_at IS NOT NULL OR is_active = false);

    IF v_inactive_services > 0 THEN
        RAISE EXCEPTION 'Some services are inactive';
    END IF;

    -- Validate services belong to the same shop
    SELECT DISTINCT shop_id INTO v_services_shop
    FROM services
    WHERE id = ANY(p_service_ids)
    LIMIT 1;

    IF v_services_shop IS NULL OR v_services_shop <> p_shop_id THEN
        RAISE EXCEPTION 'Services must belong to the same shop';
    END IF;

    -- Insert booking (status confirmed); end_time provided by caller
    INSERT INTO bookings (
        shop_id, barber_id, service_id, customer_name, customer_phone,
        start_time, end_time, status, is_walk_in
    )
    VALUES (
        p_shop_id, p_barber_id, p_service_ids[1], p_customer_name, p_customer_phone,
        p_start_time, p_end_time, 'confirmed', p_is_walk_in
    )
    RETURNING id INTO v_booking_id;

    -- Link all services
    INSERT INTO booking_services (booking_id, service_id)
    SELECT v_booking_id, sid FROM UNNEST(p_service_ids) AS sid;

    RETURN v_booking_id;
END;
$$ LANGUAGE plpgsql;