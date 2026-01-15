# Multi-Tenant Shop Branding - Implementation Status & Pending Tasks

## 1. VALIDATION STRATEGY FOR MULTI-TENANT SHOPS

### A. Database-Level Validation
```sql
-- Slug Uniqueness (Already in migration)
ALTER TABLE shops ADD CONSTRAINT unique_slug UNIQUE (slug);

-- Verify in Supabase:
SELECT slug, COUNT(*) FROM shops WHERE deleted_at IS NULL GROUP BY slug HAVING COUNT(*) > 1;
```

### B. Application-Level Validation Points

#### 1. Shop Access Verification (in server actions)
```typescript
// Every shop edit action should verify ownership
const { data: shop } = await supabase
  .from('shops')
  .select('id, owner_id, slug')
  .eq('owner_id', user.id)
  .eq('slug', params.slug)
  .is('deleted_at', null)
  .single()

if (!shop || shop.owner_id !== user.id) {
  throw new Error('Unauthorized: Shop does not belong to this user')
}
```

#### 2. Slug Validation in edit-shop
```typescript
// Validate slug format (alphanumeric + hyphens only)
const slugRegex = /^[a-z0-9-]+$/
if (!slugRegex.test(newSlug)) {
  return { success: false, error: 'Invalid slug format' }
}

// Prevent slug changes (avoid breaking URLs)
if (newSlug !== currentShop.slug) {
  return { success: false, error: 'Shop URL cannot be changed' }
}
```

#### 3. Brand Color Validation
```typescript
// Validate hex color format
const colorRegex = /^#(?:[0-9a-f]{3}){1,2}$/i
if (!colorRegex.test(brandColor)) {
  return { success: false, error: 'Invalid color format' }
}
```

---

## 2. PENDING CHANGES - EDIT SHOP PAGE

### Current State (❌ NOT UPDATED)
The edit-shop page currently updates:
- ✅ Shop name
- ✅ Phone
- ✅ Address
- ✅ Working hours
- ✅ Barbers
- ✅ Lunch breaks
- ✅ Shop closures
- ❌ **MISSING: slug, brand_color, logo_url, tagline, splash_image_url**

### Tasks to Complete

#### Task 1: Update `/app/dashboard/edit-shop/page.tsx`
- Add new branding fields to the shop query:
```typescript
const { data: shop } = await supabase
  .from('shops')
  .select('id, name, phone, address, slug, brand_color, logo_url, tagline, splash_image_url, lunch_start, lunch_end')
  // ... existing filters
```

#### Task 2: Update `/components/dashboard/EditShopInformation.tsx`
- Add branding fields to Props type
- Add state for: brandColor, logoUrl, tagline
- Add UI sections for:
  - **Shop URL Display** (read-only, showing /shop/{slug})
  - **Brand Color Picker** (5 presets + custom color)
  - **Tagline Input** (150 char max)
  - **Logo URL Input** (with preview)
  - **Splash Image URL Input** (optional)
- Add color validation helper

#### Task 3: Create new server action `/app/dashboard/edit-shop/actions.ts`
- Add `saveBrandingAction(brandColor, logoUrl, tagline, splashImageUrl)`
- Validations:
  - Brand color hex format validation
  - URL validation for image URLs (basic)
  - Tagline length check (max 150)
  - Slug immutability check
  - Subscription access check

---

## 3. PENDING CHANGES - SHOP LANDING PAGE

### Current State (✅ MOSTLY DONE)
- ✅ [app/shop/[slug]/page.tsx](../../app/shop/[slug]/page.tsx) - Server component with metadata
- ✅ [components/shop/ShopExperience.tsx](../../components/shop/ShopExperience.tsx) - Splash + landing page
- ❌ **MISSING: Shop booking page link handler**

### Tasks to Complete

#### Task 4: Create `/app/shop/[slug]/book/page.tsx`
- Server component that:
  - Fetches shop details by slug
  - Passes to existing BookingFlow component
  - OR create new booking experience for public users
- Must be accessible via `/shop/{slug}/book`

---

## 4. WORKFLOW CHECKLIST

### Phase 1: Database & Setup ✅ DONE
- [x] Migration: `0014_add_shop_branding.sql`
- [x] Data patch: `0014_data_patch_shop_slugs.sql`
- [x] Revert script: `0015_revert_shop_branding.sql`
- [x] Update types: `types/database.ts`
- [x] Update RLS policies

### Phase 2: Shop Creation ✅ DONE
- [x] Update `/app/setup/shop/page.tsx` with branding fields
- [x] Update `createShopAction()` with slug uniqueness check
- [x] Slug validation (format, length)
- [x] Brand color validation
- [x] Auto-slug generation from shop name

### Phase 3: Shop Landing Page ✅ DONE
- [x] Create `/app/shop/[slug]/page.tsx` (server component)
- [x] Create `/components/shop/ShopExperience.tsx` (client component)
- [x] Splash screen (2.5s with fade animation)
- [x] Landing page with branding
- [x] Book Appointment button link
- [x] Barber Login button link

### Phase 4: Shop Information/Edit Page ❌ PENDING
- [ ] Update `/app/dashboard/edit-shop/page.tsx` to fetch branding fields
- [ ] Update `/components/dashboard/EditShopInformation.tsx` with branding UI
- [ ] Create `saveBrandingAction()` in edit-shop actions
- [ ] Add color validation helper
- [ ] Add URL preview/validation for images
- [ ] Slug immutability check

### Phase 5: Public Booking Flow ❌ PENDING
- [ ] Create `/app/shop/[slug]/book/page.tsx`
- [ ] Create/adapt booking component for public users (no login required)
- [ ] Fetch shop details and pass as context
- [ ] Apply shop branding to booking form

### Phase 6: Testing & Validation ❌ PENDING
- [ ] Test slug uniqueness
- [ ] Test multi-tenant isolation (Shop A can't edit Shop B)
- [ ] Test color validation
- [ ] Test landing page routing
- [ ] Test booking flow with shop branding
- [ ] Test RLS policies for public access

---

## 5. KEY VALIDATION POINTS

### Multi-Tenant Security Checks
```typescript
// Every operation must verify:
1. User owns the shop: shop.owner_id === auth.uid()
2. Shop is active: shop.deleted_at IS NULL
3. Subscription is valid: checkSubscriptionAccess(shop.id)
4. Slug matches context: params.slug === shop.slug
```

### Data Integrity Checks
```typescript
// Before update:
1. Slug format validation: /^[a-z0-9-]+$/
2. Slug uniqueness: No other active shop has this slug
3. Color format validation: /^#(?:[0-9a-f]{3}){1,2}$/i
4. URL validation: Check if image URLs are reachable (optional)
5. Slug immutability: Cannot change existing shop slug
6. Tagline length: Max 150 characters
```

---

## 6. FILE CHANGES SUMMARY

| File | Status | Changes |
|------|--------|---------|
| `supabase/migrations/0014_add_shop_branding.sql` | ✅ Done | Add 5 columns, RLS policies, slug index |
| `types/database.ts` | ✅ Done | Add branding fields to shops Row/Insert/Update |
| `app/setup/shop/page.tsx` | ✅ Done | Add slug, color, tagline fields to setup |
| `app/setup/actions.ts` | ✅ Done | Add slug validation & uniqueness check |
| `app/shop/[slug]/page.tsx` | ✅ Done | Fetch shop by slug, metadata generation |
| `components/shop/ShopExperience.tsx` | ✅ Done | Splash + landing page with branding |
| `app/dashboard/edit-shop/page.tsx` | ❌ TODO | Query branding fields |
| `components/dashboard/EditShopInformation.tsx` | ❌ TODO | Add branding edit UI |
| `app/dashboard/edit-shop/actions.ts` | ❌ TODO | Add saveBrandingAction() |
| `app/shop/[slug]/book/page.tsx` | ❌ TODO | Create public booking entry point |

---

## 7. NEXT STEPS

**Immediate Priority (Phase 4):**
1. Update edit-shop page to display/edit branding fields
2. Implement saveBrandingAction() with validations
3. Test slug immutability

**Then (Phase 5):**
4. Create public booking page at `/shop/[slug]/book`
5. Adapt booking flow for public (unauthenticated) users

**Finally (Phase 6):**
6. Complete security & multi-tenant testing
7. Validate all RLS policies work correctly
