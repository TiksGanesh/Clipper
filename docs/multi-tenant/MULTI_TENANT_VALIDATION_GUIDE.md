# Multi-Tenant Shop Validation Quick Reference

## How to Test Multi-Tenant Shop Setup

### 1. Test Slug Uniqueness
```bash
# In Supabase SQL Editor, verify no duplicates:
SELECT slug, COUNT(*) as count FROM shops 
WHERE deleted_at IS NULL 
GROUP BY slug 
HAVING COUNT(*) > 1;

# Result should be: (empty table - no duplicates)
```

### 2. Test Shop Access Control
```typescript
// Scenario: User A tries to access User B's shop

// This should SUCCEED (own shop):
GET /shop/user-a-shop
User: User A → OK ✅

// This should FAIL (not owner):
GET /shop/user-b-shop  
User: User A → Unauthorized 🚫

// Public can VIEW but NOT EDIT:
GET /shop/any-shop (public landing)
User: Anonymous → OK ✅ (can see branding)

POST /dashboard/edit-shop (edit page)
User: Anonymous → Redirect to /login 🚫
```

### 3. Test Slug Validation

#### Client-side (form validation):
```
- Lowercase alphanumeric + hyphens only
- 2-50 characters
- Cannot contain spaces, special chars, uppercase
```

#### Server-side (before database):
```typescript
const isValidSlug = /^[a-z0-9-]{2,50}$/.test(slug)
```

### 4. Test Brand Color Validation
```typescript
// Valid colors:
#4F46E5 ✅
#fff ✅
#ffffff ✅
#FF6B6B ✅

// Invalid:
4F46E5 (missing #) ❌
#GGGGGG (invalid hex) ❌
rgb(79, 70, 229) (wrong format) ❌
```

### 5. Test RLS Policies
```sql
-- Policy: Public can read shop branding
SELECT * FROM shops WHERE slug = 'main-shop';
-- Result: Returns shop with all columns ✅

-- Policy: Owner can update own shop
UPDATE shops SET brand_color = '#FF0000' 
WHERE id = 'abc123' AND owner_id = auth.uid();
-- Result: Success if owner, Fail if not ✅

-- Policy: Others cannot read payment data
SELECT * FROM payments WHERE booking_id = 'xyz';
-- Result: Forbidden (RLS prevents access) ✅
```

---

## Validation Checklist

### Before Launch
- [ ] Slug is unique across all shops (no duplicates in DB)
- [ ] Slug is immutable (cannot be changed in edit-shop)
- [ ] Color validation works (hex format only)
- [ ] Tagline has character limit (max 150)
- [ ] Logo URL is stored but validation is optional
- [ ] Splash screen appears for 2.5 seconds on landing page
- [ ] Each shop sees only its own branding
- [ ] Public can access landing page without login
- [ ] Public cannot access edit-shop page
- [ ] Shop owner can only edit own shop's branding

### Testing Script
```bash
# 1. Create shop via setup with slug 'test-shop'
curl -X POST /setup/shop \
  -d "name=Test Shop&phone=1234567890&slug=test-shop&brand_color=#FF6B6B"

# 2. Verify landing page loads
curl https://yourapp.com/shop/test-shop

# 3. Try duplicate slug (should fail)
curl -X POST /setup/shop \
  -d "name=Another Shop&phone=0987654321&slug=test-shop" \
  # Expected: "This Shop URL is already taken"

# 4. Verify owner isolation
# Login as User B, try to access User A's shop edit page
# Expected: 404 or redirect to own shop
```

---

## Current Implementation Status

### ✅ COMPLETED
- [x] Database migration (columns + RLS)
- [x] Slug generation & validation in setup
- [x] Brand color picker in setup
- [x] Shop landing page (/shop/[slug])
- [x] Splash screen with branding
- [x] Metadata generation (OG tags)

### ❌ STILL PENDING
- [ ] Edit Shop page - display branding fields
- [ ] Edit Shop actions - save branding updates
- [ ] Slug immutability enforcement
- [ ] Public booking flow (/shop/[slug]/book)
- [ ] Integration tests for multi-tenant scenarios
- [ ] RLS policy verification for all tables

---

## Files to Update (Phase 4 - Edit Shop)

### 1. `/app/dashboard/edit-shop/page.tsx`
**Add to shop query:**
```typescript
.select('id, name, phone, address, slug, brand_color, logo_url, tagline, splash_image_url, lunch_start, lunch_end')
```

### 2. `/components/dashboard/EditShopInformation.tsx`
**Add state:**
```typescript
const [brandColor, setBrandColor] = useState(shop.brand_color || '#4F46E5')
const [logoUrl, setLogoUrl] = useState(shop.logo_url || '')
const [tagline, setTagline] = useState(shop.tagline || '')
```

**Add UI sections:**
- Brand Color Picker (same as setup page)
- Logo URL Input with preview
- Tagline Text Input (150 char limit)
- Shop URL Display (read-only)

### 3. `/app/dashboard/edit-shop/actions.ts`
**Add new action:**
```typescript
export async function saveBrandingAction(
  brandColor: string,
  logoUrl: string,
  tagline: string,
  splashImageUrl?: string
) {
  // Validate color, URLs, length
  // Check subscription access
  // Check slug hasn't changed
  // Update database
}
```
