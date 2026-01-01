# Add Second Barber Feature

## Overview
Enhanced the edit-shop experience to allow shop owners to add a second barber post-creation, with proper server-side validation ensuring the 2-barber maximum limit.

## Changes Made

### 1. Server Actions (`app/dashboard/edit-shop/actions.ts`)

Added `addBarberAction()`:
- **Validates barber name** (required)
- **Validates phone number** (optional, 7-15 digits)
- **Server-side check**: Ensures shop has less than 2 active barbers before insertion
- **Database insertion**: Creates new barber with `is_active = true`
- **Error handling**: Catches constraint violations and returns user-friendly messages
- **Revalidation**: Refreshes the edit-shop page after successful addition

Key validation logic:
```typescript
// Count existing active barbers
const { data: existingBarbers } = await supabase
    .from('barbers')
    .select('id')
    .eq('shop_id', shop.id)
    .eq('is_active', true)
    .is('deleted_at', null)

if (existingBarbers && existingBarbers.length >= 2) {
    return { success: false, error: 'Maximum 2 active barbers per shop' }
}
```

### 2. UI Component (`components/dashboard/EditShopInformation.tsx`)

Enhanced barbers section:
- **Add barber form**: Shows when `barberData.length < 2`
- **State management**: 
  - `newBarberName` - stores new barber name input
  - `newBarberPhone` - stores new barber phone input
  - `isAddingBarber` - loading state during creation
  - `addBarberError` - displays validation/server errors
- **Visual feedback**:
  - Counter showing "X of 2 barbers"
  - Disabled button during submission
  - Error messages in red alert box
  - Success message and auto-reload on completion

UI layout:
```
Existing Barbers Section
├── Barber 1 (edit fields)
├── [Barber 2 (edit fields)] - if exists
└── Add Second Barber Section - if barberData.length < 2
    ├── Name field (required)
    ├── Phone field (optional)
    └── "+ Add Barber" button
```

### 3. Page Data Fetching (`app/dashboard/edit-shop/page.tsx`)

Updated barber query to filter by active status:
```typescript
const { data: barbers } = await supabase
    .from('barbers')
    .select('id, name, phone')
    .eq('shop_id', shop.id)
    .eq('is_active', true)  // ← Added filter
    .is('deleted_at', null)
    .order('created_at', { ascending: true })
```

This ensures only active barbers are shown in the edit interface.

## Database Constraints

The feature relies on existing database-level enforcement:

```sql
-- From 0001_initial_setup.sql
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
```

This provides a safety net even if client-side or application-level checks are bypassed.

## User Flow

### When shop has 1 barber:
1. Owner navigates to "Shop Information" (edit-shop)
2. Sees existing barber with edit fields
3. Sees "Add Second Barber" section below
4. Enters new barber name (required) and phone (optional)
5. Clicks "+ Add Barber"
6. System validates and creates barber
7. Page reloads showing both barbers
8. "Add Barber" section disappears (max reached)

### When shop has 2 barbers:
- Only edit fields for existing barbers are shown
- No "Add Barber" section displayed
- Counter shows "2 of 2 barbers"

## Error Handling

### Client-side validation:
- Empty name → "Barber name is required"

### Server-side validation:
- Invalid phone format → "Enter a valid barber phone (7-15 digits)"
- Maximum limit reached → "You can only have a maximum of 2 active barbers per shop"
- Database constraint violation → Same error message

### Edge cases handled:
- ✅ Concurrent requests (database trigger prevents race conditions)
- ✅ Shop not found (returns error)
- ✅ Phone normalization (trims whitespace, validates format)
- ✅ Soft deletion awareness (only counts non-deleted barbers)

## Technical Details

### Phone Validation
Uses existing `validatePhone()` helper function:
- Required: 7-15 digits minimum
- Optional for barbers (required for shop)
- Normalizes by trimming whitespace
- Preserves formatting characters (e.g., "+91 98765 43210")

### State Management
- Form uses React `useState` hooks
- No form library needed (simple two-field form)
- Page reload after successful addition ensures consistency
- Alternative: Could use router.refresh() instead of window.location.reload()

### Security
- Server-side authentication via `requireAuth()`
- Ownership validation (shop belongs to authenticated user)
- Database-level constraints as final safeguard
- No client-side bypasses possible

## Future Enhancements (Out of Scope for V1)

- [ ] Remove/deactivate barber functionality
- [ ] Drag-and-drop reordering of barbers
- [ ] Barber-specific working hours
- [ ] Barber profile pictures
- [ ] More than 2 barbers per shop (requires pricing plan changes)

## Testing Recommendations

1. **Basic flow**: Add second barber when shop has 1
2. **Validation**: Try adding barber without name
3. **Phone validation**: Test with invalid phone formats
4. **Limit enforcement**: Verify "Add Barber" section disappears with 2 barbers
5. **Concurrent creation**: Simulate multiple rapid clicks on "+ Add Barber"
6. **Permissions**: Ensure only shop owner can add barbers to their shop
