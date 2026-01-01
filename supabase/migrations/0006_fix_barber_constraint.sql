-- Fix max barber constraint to allow updates to existing barbers
-- The previous trigger prevented ANY update when 2 active barbers exist
-- This new version only prevents ADDING new active barbers

DROP TRIGGER IF EXISTS check_max_barbers ON barbers;

CREATE OR REPLACE FUNCTION enforce_max_barbers()
RETURNS TRIGGER AS $$
DECLARE
    active_count INTEGER;
BEGIN
    -- If soft-deleted, allow it
    IF NEW.deleted_at IS NOT NULL THEN
        RETURN NEW;
    END IF;

    -- If setting is_active to true, check the count
    IF NEW.is_active = true THEN
        -- Count active barbers (excluding this one if it's an update)
        SELECT COUNT(*) INTO active_count
        FROM barbers
        WHERE shop_id = NEW.shop_id
          AND is_active = true
          AND deleted_at IS NULL
          AND id != NEW.id;  -- Exclude current barber

        -- Only allow if count is less than 2
        IF active_count >= 2 THEN
            RAISE EXCEPTION 'Maximum 2 active barbers allowed per shop';
        END IF;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER check_max_barbers
BEFORE INSERT OR UPDATE ON barbers
FOR EACH ROW
EXECUTE FUNCTION enforce_max_barbers();
