# Phase 4 Implementation Guide - Edit Shop Branding

## Overview
This guide provides exact code snippets needed to complete Phase 4 (Edit Shop page branding updates).

---

## 1. Update `/app/dashboard/edit-shop/page.tsx`

### Change Required
Update the shop query to include branding columns.

**Current (Lines 19-23):**
```typescript
const { data: shop } = await supabase
    .from('shops')
    .select('id, name, phone, address, lunch_start, lunch_end')
```

**Update To:**
```typescript
const { data: shop } = await supabase
    .from('shops')
    .select('id, name, phone, address, slug, brand_color, logo_url, tagline, splash_image_url, lunch_start, lunch_end')
```

### Update Type Definition
**Current (Lines 15-19):**
```typescript
type Shop = {
    id: string
    name: string
    phone: string | null
    address: string | null
}
```

**Update To:**
```typescript
type Shop = {
    id: string
    name: string
    phone: string | null
    address: string | null
    slug: string
    brand_color: string
    logo_url: string | null
    tagline: string | null
    splash_image_url: string | null
}
```

### Pass Branding Data to Component
**Current (Lines 76-82):**
```typescript
<EditShopInformation
    shop={shop}
    barbers={barbers ?? []}
    workingHours={workingHours}
    userEmail={user.email ?? ''}
    lunchStart={shop.lunch_start ?? ''}
    lunchEnd={shop.lunch_end ?? ''}
/>
```

**No change needed** - already passes `shop` object with all fields.

---

## 2. Update `/components/dashboard/EditShopInformation.tsx`

### Update Props Type
**Current (Lines 8-14):**
```typescript
type Shop = {
    id: string
    name: string
    phone: string | null
    address: string | null
}
```

**Update To:**
```typescript
type Shop = {
    id: string
    name: string
    phone: string | null
    address: string | null
    slug: string
    brand_color: string
    logo_url: string | null
    tagline: string | null
    splash_image_url: string | null
}
```

### Add State for Branding Fields
**After line 47 (after existing state declarations), add:**
```typescript
const [brandColor, setBrandColor] = useState(shop.brand_color || '#4F46E5')
const [useCustomColor, setUseCustomColor] = useState(false)
const [customColor, setCustomColor] = useState(shop.brand_color || '#4F46E5')
const [logoUrl, setLogoUrl] = useState(shop.logo_url || '')
const [tagline, setTagline] = useState(shop.tagline || '')
const [splashImageUrl, setSplashImageUrl] = useState(shop.splash_image_url || '')
const [logoPreview, setLogoPreview] = useState<string | null>(shop.logo_url || null)
```

### Add Brand Color Constants
**After line 37 (after DAYS_OF_WEEK), add:**
```typescript
const BRAND_COLOR_PRESETS = [
    '#4F46E5', // Indigo
    '#DC2626', // Red
    '#16A34A', // Green
    '#2563EB', // Blue
    '#7C3AED', // Purple
]
```

### Update handleSave Function
**Find the `handleSave` function and add before the redirect, inside the try block:**
```typescript
// Save branding
const brandingResult = await withProgress(
    saveBrandingAction(
        useCustomColor ? customColor : brandColor,
        logoUrl,
        tagline,
        splashImageUrl
    )
)
if (!brandingResult.success) {
    setSaveError(brandingResult.error || 'Failed to save branding')
    setIsSaving(false)
    return
}
```

### Add Branding UI Section
**Before the final closing tag of the form (before `</section>`), add:**

```tsx
{/* BRANDING SECTION */}
<section className="bg-white rounded-lg border border-gray-200 p-5">
    <h3 className="text-lg font-semibold text-gray-900 mb-4">Shop Branding</h3>

    {/* Shop URL (Read-only) */}
    <div className="mb-4">
        <label className="block text-sm font-medium text-gray-700 mb-1">Shop URL</label>
        <div className="flex items-center gap-2 bg-gray-50 px-3 py-2 rounded border border-gray-200">
            <span className="text-gray-500 text-sm">/shop/</span>
            <span className="text-gray-900 font-medium">{shop.slug}</span>
            <span className="text-xs text-gray-500 ml-auto">(Cannot be changed)</span>
        </div>
    </div>

    {/* Brand Color */}
    <div className="mb-4">
        <label className="block text-sm font-medium text-gray-700 mb-2">Brand Color</label>
        <div className="flex gap-2 mb-3">
            {BRAND_COLOR_PRESETS.map((color) => (
                <button
                    key={color}
                    type="button"
                    onClick={() => {
                        setBrandColor(color)
                        setUseCustomColor(false)
                    }}
                    className={`w-8 h-8 rounded-full border-2 transition-transform ${
                        brandColor === color && !useCustomColor
                            ? 'border-gray-800 scale-110'
                            : 'border-gray-300 hover:scale-105'
                    }`}
                    style={{ backgroundColor: color }}
                    title={color}
                />
            ))}
        </div>
        <div className="flex items-center gap-2">
            <input
                type="color"
                value={useCustomColor ? customColor : brandColor}
                onChange={(e) => {
                    setCustomColor(e.target.value)
                    setBrandColor(e.target.value)
                    setUseCustomColor(true)
                }}
                className="w-12 h-10 rounded border cursor-pointer"
            />
            <span className="text-sm text-gray-600">
                {useCustomColor ? customColor : brandColor}
            </span>
        </div>
    </div>

    {/* Logo URL */}
    <div className="mb-4">
        <label className="block text-sm font-medium text-gray-700 mb-1">Logo URL (optional)</label>
        <input
            type="url"
            value={logoUrl}
            onChange={(e) => {
                setLogoUrl(e.target.value)
                setLogoPreview(e.target.value || null)
            }}
            placeholder="https://example.com/logo.png"
            className="w-full border px-3 py-2 rounded text-sm"
        />
        {logoPreview && (
            <div className="mt-2 flex items-center gap-2">
                <span className="text-xs text-gray-500">Preview:</span>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                    src={logoPreview}
                    alt="Logo preview"
                    className="w-12 h-12 object-contain rounded border border-gray-200"
                    onError={() => setLogoPreview(null)}
                />
            </div>
        )}
    </div>

    {/* Tagline */}
    <div className="mb-4">
        <label className="block text-sm font-medium text-gray-700 mb-1">
            Tagline (optional)
            <span className="text-xs text-gray-500 ml-1">
                {tagline.length}/150
            </span>
        </label>
        <input
            type="text"
            value={tagline}
            onChange={(e) => setTagline(e.target.value.slice(0, 150))}
            placeholder="e.g., Premium haircuts since 2020"
            maxLength={150}
            className="w-full border px-3 py-2 rounded text-sm"
        />
        <p className="text-xs text-gray-500 mt-1">
            Appears on splash screen and landing page
        </p>
    </div>

    {/* Splash Image URL */}
    <div className="mb-4">
        <label className="block text-sm font-medium text-gray-700 mb-1">Splash Image URL (optional)</label>
        <input
            type="url"
            value={splashImageUrl}
            onChange={(e) => setSplashImageUrl(e.target.value)}
            placeholder="https://example.com/splash.jpg"
            className="w-full border px-3 py-2 rounded text-sm"
        />
        <p className="text-xs text-gray-500 mt-1">
            Background image for the splash screen
        </p>
    </div>
</section>
```

### Import saveBrandingAction
**At the top of the file, update the import:**

**Current (Line 6):**
```typescript
import { saveShopClosureAction, saveShopNameAction, saveWorkingHoursAction, saveBarberDetailsAction, saveShopContactAction, addBarberAction, saveLunchBreakAction } from '@/app/dashboard/edit-shop/actions'
```

**Update To:**
```typescript
import { saveShopClosureAction, saveShopNameAction, saveWorkingHoursAction, saveBarberDetailsAction, saveShopContactAction, addBarberAction, saveLunchBreakAction, saveBrandingAction } from '@/app/dashboard/edit-shop/actions'
```

---

## 3. Add to `/app/dashboard/edit-shop/actions.ts`

### Add Color Validation Helper
**At the top of the file, after imports, add:**

```typescript
// Validation helpers for branding
function validateBrandColor(color: string): { ok: boolean; message?: string } {
    const hexRegex = /^#(?:[0-9a-f]{3}){1,2}$/i
    if (!hexRegex.test(color)) {
        return { ok: false, message: 'Invalid color format. Use hex code (e.g., #FF6B6B)' }
    }
    return { ok: true }
}

function validateUrl(url: string | null): { ok: boolean; message?: string } {
    if (!url || url.length === 0) {
        return { ok: true } // Optional field
    }
    try {
        new URL(url)
        return { ok: true }
    } catch {
        return { ok: false, message: 'Invalid URL format' }
    }
}

function validateTagline(tagline: string | null): { ok: boolean; message?: string } {
    if (!tagline || tagline.length === 0) {
        return { ok: true } // Optional field
    }
    if (tagline.length > 150) {
        return { ok: false, message: 'Tagline must be 150 characters or less' }
    }
    return { ok: true }
}
```

### Add saveBrandingAction
**At the end of the file, add:**

```typescript
export async function saveBrandingAction(
    brandColor: string,
    logoUrl: string | null,
    tagline: string | null,
    splashImageUrl: string | null
) {
    const user = await requireAuth()
    const supabase = await createServerSupabaseClient()

    // Validate brand color
    const colorValidation = validateBrandColor(brandColor)
    if (!colorValidation.ok) {
        return { success: false, error: colorValidation.message }
    }

    // Validate logo URL
    const logoValidation = validateUrl(logoUrl)
    if (!logoValidation.ok) {
        return { success: false, error: logoValidation.message }
    }

    // Validate splash image URL
    const splashValidation = validateUrl(splashImageUrl)
    if (!splashValidation.ok) {
        return { success: false, error: splashValidation.message }
    }

    // Validate tagline
    const taglineValidation = validateTagline(tagline)
    if (!taglineValidation.ok) {
        return { success: false, error: taglineValidation.message }
    }

    // Get shop
    const { data: shop, error: shopError } = await supabase
        .from('shops')
        .select('id, slug')
        .eq('owner_id', user.id)
        .is('deleted_at', null)
        .maybeSingle() as ShopIdResult

    if (shopError || !shop) {
        return { success: false, error: 'Shop not found' }
    }

    // CRITICAL SECURITY: Check subscription access
    const accessCheck = await checkSubscriptionAccess(shop.id)
    if (!accessCheck.allowed) {
        return {
            success: false,
            error: 'Your subscription is not active. Please contact support.',
        }
    }

    // Update branding fields
    const { error: updateError } = await supabase
        .from('shops')
        // @ts-expect-error - Supabase type inference issue
        .update({
            brand_color: brandColor,
            logo_url: logoUrl || null,
            tagline: tagline || null,
            splash_image_url: splashImageUrl || null,
        })
        .eq('id', shop.id)

    if (updateError) {
        console.error('Error updating branding:', updateError)
        return {
            success: false,
            error: 'Failed to save branding. Please try again.',
        }
    }

    revalidatePath('/dashboard/edit-shop')
    
    return { success: true }
}
```

---

## Testing Checklist for Phase 4

- [ ] Edit shop page loads with branding fields visible
- [ ] Color picker works (5 presets + custom)
- [ ] Logo URL input accepts valid URLs
- [ ] Logo preview shows image correctly
- [ ] Tagline character counter works (max 150)
- [ ] Slug displays as read-only
- [ ] Branding data saves successfully
- [ ] Color validation rejects invalid hex codes
- [ ] URL validation rejects invalid URLs
- [ ] Tagline validation rejects >150 chars
- [ ] Changes persist after page reload
- [ ] Shop landing page reflects updated branding
- [ ] Only shop owner can edit own branding
- [ ] Error messages display properly

---

## Next Phase (Phase 5): Public Booking Page

After Phase 4 is complete, create:
- `/app/shop/[slug]/book/page.tsx` - Public booking entry point
- Fetch shop by slug
- Display shop branding
- Integrate with existing booking form (adapted for public)
- Support walk-in booking without login
