# Multi-Tenant Branding - Visual Architecture

## System Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         MULTI-TENANT SHOP BRANDING SYSTEM                   │
└─────────────────────────────────────────────────────────────────────────────┘

                              PUBLIC USERS (Unauthenticated)
                                        ▼
                            /shop/[slug]/        ← Landing page
                                        │
                    ┌───────────────────┼───────────────────┐
                    │                   │                   │
                    ▼                   ▼                   ▼
          Splash Screen          Landing Page         Book Appointment
            (2.5 sec)             (Branding)          /shop/[slug]/book
         [brand_color]           ✓ Logo                  (TBD)
         logo_url               ✓ Tagline
         tagline                ✓ Buttons


                              AUTHENTICATED USERS (Shop Owners)
                                        ▼
                           /dashboard/edit-shop   ← Edit page
                                        │
                   ┌────────────────────┴────────────────────┐
                   │                                         │
                   ▼                                         ▼
        Basic Shop Info                              BRANDING FIELDS (NEW)
        ✓ Name                                       ✓ Slug (read-only)
        ✓ Phone                                      ✓ Brand Color (picker)
        ✓ Address                                    ✓ Logo URL (input)
        ✓ Working Hours                              ✓ Tagline (150 char)
        ✓ Barbers                                    ✓ Splash Image (URL)


                                  DATABASE (Supabase)
                                        ▼
                    ┌──────────────────────────────────────┐
                    │         shops table                  │
                    ├──────────────────────────────────────┤
                    │ id              UUID     ✅          │
                    │ owner_id        UUID     ✅          │
                    │ name            VARCHAR  ✅          │
                    │ phone           VARCHAR  ✅          │
                    │ address         TEXT     ✅          │
                    │ slug            TEXT     ✅ UNIQUE   │
                    │ brand_color     TEXT     ✅ DEFAULT  │
                    │ logo_url        TEXT     ✅ NULL     │
                    │ tagline         TEXT     ✅ NULL     │
                    │ splash_image_url TEXT    ✅ NULL     │
                    │ deleted_at      TIMESTAMP✅          │
                    └──────────────────────────────────────┘
                              RLS POLICIES
                    ┌──────────────────────────────────────┐
                    │ PUBLIC: Read shop branding (SELECT)  │
                    │ OWNER: Update own branding (UPDATE)  │
                    │ SERVICE: Create/Update (backend)     │
                    └──────────────────────────────────────┘
```

---

## Data Flow Diagram

### Shop Creation Flow
```
┌─────────────┐
│  User Setup │
│ /setup/shop │
└──────┬──────┘
       │
       ▼ User enters:
       ├─ name: "Alice's Barbershop"
       ├─ phone: "9876543210"
       ├─ slug: "alices-barbershop" (auto-gen)
       ├─ brand_color: "#FF6B6B" (picker)
       └─ tagline: "Fresh cuts daily"
       │
       ▼ Client validation
       ├─ Slug format: /^[a-z0-9-]{2,50}$/
       ├─ Color format: /^#(?:[0-9a-f]{3}){1,2}$/i
       └─ Tagline length: max 150 chars
       │
       ▼ Server validation (createShopAction)
       ├─ Slug uniqueness check
       │  └─ SELECT FROM shops WHERE slug='alices-barbershop'
       │     └─ If exists: "Already taken" error
       ├─ Color format validation
       ├─ Tagline validation
       └─ Owner uniqueness check
       │
       ▼ INSERT into database
       └─ shops table receives all data
       │
       ▼ Redirect to /setup/barbers
       └─ Shop now created with branding ✅
```

### Shop Landing Page Flow
```
┌───────────────┐
│ User visits   │
│ /shop/[slug]  │
└────────┬──────┘
         │
         ▼ Server component fetches
         ├─ SELECT * FROM shops
         ├─ WHERE slug = 'alices-barbershop'
         └─ WHERE deleted_at IS NULL
         │
         ▼ RLS allows public SELECT
         └─ Returns: All columns including
            └─ name, brand_color, logo_url, tagline
         │
         ▼ generateMetadata()
         └─ Set page title, OG image, description
         │
         ▼ Render <ShopExperience shop={shop} />
         │
         ├─ Splash Screen (0-2.5s)
         │  ├─ Background: shop.brand_color (#FF6B6B)
         │  ├─ Logo: <Image src={shop.logo_url} />
         │  ├─ Text: shop.tagline
         │  └─ Fade-in animation
         │
         └─ Landing Page (after 2.5s)
            ├─ Header: logo + name
            ├─ Hero: "Welcome to..." + tagline
            └─ Buttons:
               ├─ "Book Appointment" → /shop/[slug]/book
               │  Style: solid background = shop.brand_color
               └─ "Barber Login" → /login?shop_id=[id]
                  Style: border outline = shop.brand_color
```

### Shop Edit Flow (Currently Missing)
```
┌──────────────────────┐
│ Shop Owner visits    │
│ /dashboard/edit-shop │
└──────────┬───────────┘
           │
           ❌ ISSUE: Missing branding columns
           │
           ▼ Server query (SHOULD include)
           ├─ SELECT ... slug, brand_color,
           │          logo_url, tagline,
           │          splash_image_url
           └─ WHERE owner_id = auth.uid()
           │
           ▼ Component state (SHOULD add)
           ├─ brandColor: string
           ├─ logoUrl: string | null
           ├─ tagline: string | null
           └─ splashImageUrl: string | null
           │
           ▼ UI sections (SHOULD render)
           ├─ Shop URL (read-only): /shop/alices-barbershop
           ├─ Brand Color (picker): 5 presets + custom
           ├─ Logo URL (input): with preview
           ├─ Tagline (input): 150 char counter
           └─ Splash Image URL (input): optional
           │
           ▼ Server action (SHOULD exist)
           └─ saveBrandingAction()
              ├─ Validate color hex
              ├─ Validate URLs
              ├─ Validate tagline length
              ├─ Check owner
              ├─ Check subscription
              └─ UPDATE shops SET branding
```

---

## Database Query Patterns

### Create Shop (Onboarding)
```typescript
// 1. Check slug uniqueness
const existing = await supabase
  .from('shops')
  .select('id')
  .eq('slug', 'alices-barbershop')
  .is('deleted_at', null)
  .maybeSingle()

if (existing?.data) {
  throw new Error('Slug already taken')
}

// 2. Insert new shop
const shop = await supabase
  .from('shops')
  .insert({
    owner_id: user.id,
    name: 'Alice Barbershop',
    phone: '9876543210',
    slug: 'alices-barbershop',
    brand_color: '#FF6B6B',
    logo_url: 'https://...',
    tagline: 'Fresh cuts daily',
    splash_image_url: null,
  })
  .select()
  .single()
```

### Fetch Shop for Public Landing
```typescript
// Public can view any active shop
const shop = await supabase
  .from('shops')
  .select('*')
  .eq('slug', 'alices-barbershop')
  .is('deleted_at', null)
  .single()

// RLS allows this for anonymous users
// Returns: name, brand_color, logo_url, tagline, etc.
```

### Fetch Shop for Owner Edit
```typescript
// Owner can only see own shop
const shop = await supabase
  .from('shops')
  .select('*')
  .eq('owner_id', user.id)
  .is('deleted_at', null)
  .single()

// RLS allows authenticated users to see
// but only if owner matches
```

### Update Branding
```typescript
// Owner updates branding
const updated = await supabase
  .from('shops')
  .update({
    brand_color: '#1E40AF',  // New color
    logo_url: 'https://new-logo.jpg',
    tagline: 'New tagline',
  })
  .eq('id', shop.id)
  .eq('owner_id', user.id)  // Double-check ownership
  .select()

// RLS policy "shop_owner_update_branding" enforces:
// - owner_id = auth.uid()
// - deleted_at IS NULL
```

---

## Validation Chains

### Slug Validation
```
User Input
   ↓
Client Regex: /^[a-z0-9-]{2,50}$/
   ├─ Auto-lowercase ✓
   ├─ Remove spaces → hyphens ✓
   ├─ Remove special chars ✓
   ↓
User can edit or accept auto-gen
   ↓
Form Submit → Server
   ↓
Server Regex: /^[a-z0-9-]{2,50}$/
   ├─ Verify format ✓
   ├─ Check length ✓
   ↓
Database Query
   └─ SELECT * FROM shops WHERE slug = input AND deleted_at IS NULL
      ├─ If found: ✗ Error "Already taken"
      └─ If not found: ✓ Proceed with insert
```

### Color Validation
```
User Selection
   ├─ Preset (5 colors): Direct use ✓
   └─ Custom Picker: HTML5 <input type="color" />
       └─ Always returns valid hex: #RRGGBB
   ↓
Client Regex: /^#(?:[0-9a-f]{3}){1,2}$/i
   ├─ Match 3-digit: #ABC ✓
   ├─ Match 6-digit: #AABBCC ✓
   └─ Match invalid: #GGG ✗
   ↓
Server Regex: Same validation ✓
   ↓
Database: TEXT field
   └─ No further validation needed
```

### Tagline Validation
```
User Types (max 150 chars)
   ↓
Client: maxLength={150}
   └─ input.slice(0, 150) on change
   ↓
Display character counter: "45/150"
   ↓
Server Function:
   if (tagline.length > 150)
     return error "Max 150 characters"
   ↓
Database: TEXT field (no constraint)
   └─ Server-side validation sufficient
```

---

## Security Layers

```
┌──────────────────────────────────────────────────────────────┐
│ LAYER 1: Authentication (Supabase Auth)                      │
│ ├─ Anonymous users: Can view shops                           │
│ └─ Authenticated users: Can create/edit own shops            │
└──────────────────────────────────────────────────────────────┘
              ↓
┌──────────────────────────────────────────────────────────────┐
│ LAYER 2: Row Level Security (Database)                       │
│ ├─ Public policy: SELECT only, no auth required             │
│ ├─ Owner policy: UPDATE only if owner_id = auth.uid()        │
│ └─ No INSERT/DELETE without backend service role            │
└──────────────────────────────────────────────────────────────┘
              ↓
┌──────────────────────────────────────────────────────────────┐
│ LAYER 3: Application-Level Checks (TypeScript)               │
│ ├─ Server action: Check user auth                           │
│ ├─ Verify: Shop owner matches auth.uid()                     │
│ ├─ Validate: All inputs (format, length, uniqueness)         │
│ └─ Check: Subscription status before allowing updates        │
└──────────────────────────────────────────────────────────────┘
              ↓
┌──────────────────────────────────────────────────────────────┐
│ LAYER 4: Data Validation                                     │
│ ├─ Slug: format, length, uniqueness                         │
│ ├─ Color: hex format validation                             │
│ ├─ URLs: basic format validation                             │
│ └─ Tagline: length limits                                    │
└──────────────────────────────────────────────────────────────┘
```

---

## Multi-Tenant Isolation Examples

### ✅ Correct: User A edits own shop
```
User A logs in
  ↓
Visits: /dashboard/edit-shop
  ↓
Server: SELECT * FROM shops WHERE owner_id = 'user-a-id'
  ↓
RLS: ✅ Allows (user owns this shop)
  ↓
Returns: Alice's Barbershop data
  ↓
User updates brand_color: '#FF6B6B'
  ↓
Server: UPDATE shops SET brand_color = '#FF6B6B'
         WHERE id = shop.id AND owner_id = 'user-a-id'
  ↓
RLS: ✅ Allows (owner_id matches auth.uid())
  ↓
Result: ✅ Update succeeds
```

### ❌ Wrong: User B tries to access User A's shop
```
User B logs in
  ↓
Somehow visits: /dashboard/edit-shop?shop_id=alice-shop-id
  ↓
Server: SELECT * FROM shops WHERE owner_id = 'user-b-id'
  ↓
Database: Returns NULL (user-b doesn't own any shop)
  ↓
Result: ❌ Redirects to /setup/shop
         (User B hasn't created shop yet)
```

### ❌ Wrong: Unauthenticated user tries to edit
```
Anonymous user
  ↓
Visits: /dashboard/edit-shop
  ↓
middleware.ts: Requires authentication
  ↓
Redirects: → /login
  ↓
Result: ❌ Cannot access edit page
```

### ✅ Correct: Public views landing page
```
Anonymous user
  ↓
Visits: /shop/alices-barbershop
  ↓
Server: SELECT * FROM shops WHERE slug = 'alices-barbershop'
  ↓
RLS: ✅ Allows (public_read_shop_branding policy)
  ↓
Returns: Shop data (name, brand_color, logo_url, tagline)
  ↓
Result: ✅ Landing page renders with branding
```

---

## Implementation Status Map

```
╔════════════════════════════════════════════════════════════════╗
║              MULTI-TENANT BRANDING - COMPLETION MAP             ║
╠════════════════════════════════════════════════════════════════╣
║                                                                ║
║ Database & Migrations                      100% ✅             ║
║ ├─ Add columns                              ✅                 ║
║ ├─ Create indexes                           ✅                 ║
║ ├─ RLS policies                             ✅                 ║
║ └─ Type definitions                         ✅                 ║
║                                                                ║
║ Shop Creation (Onboarding)                  100% ✅             ║
║ ├─ Setup page UI                            ✅                 ║
║ ├─ Slug auto-generation                     ✅                 ║
║ ├─ Color picker                             ✅                 ║
║ ├─ Validation (client + server)             ✅                 ║
║ └─ Server action                            ✅                 ║
║                                                                ║
║ Public Landing Page                         100% ✅             ║
║ ├─ Route /shop/[slug]                       ✅                 ║
║ ├─ Fetch by slug                            ✅                 ║
║ ├─ Splash screen                            ✅                 ║
║ ├─ Branding display                         ✅                 ║
║ ├─ Metadata generation                      ✅                 ║
║ └─ Navigation buttons                       ✅                 ║
║                                                                ║
║ Shop Edit Page (BRANDING)                    25% ⏳             ║
║ ├─ Update page query                        ❌ TODO            ║
║ ├─ Component UI                             ❌ TODO            ║
║ ├─ Form handlers                            ❌ TODO            ║
║ ├─ Server action                            ❌ TODO            ║
║ └─ Validation helpers                       ❌ TODO            ║
║                                                                ║
║ Public Booking Flow                          0% ❌             ║
║ ├─ Route /shop/[slug]/book                  ❌ TODO            ║
║ ├─ Fetch shop context                       ❌ TODO            ║
║ ├─ Booking component                        ❌ TODO            ║
║ └─ Payment integration                      ❌ TODO            ║
║                                                                ║
║ Testing & Validation                         0% ❌             ║
║ ├─ Multi-tenant isolation                   ❌ TODO            ║
║ ├─ Slug uniqueness                          ❌ TODO            ║
║ ├─ RLS enforcement                          ❌ TODO            ║
║ └─ End-to-end tests                         ❌ TODO            ║
║                                                                ║
║ OVERALL COMPLETION:  ████████████░░░░░░  60%                 ║
║                                                                ║
╚════════════════════════════════════════════════════════════════╝
```
