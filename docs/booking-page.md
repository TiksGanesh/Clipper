Redesign the customer booking page: /book/[shopId]
using Tailwind CSS.

THIS PAGE IS BUSINESS-CRITICAL.
Treat UX quality as the highest priority.

STRICT REQUIREMENTS:
- Follow docs/design-system.md
- Follow docs/layout-guidelines.md
- Do NOT use any UI libraries
- Do NOT add animations beyond hover/focus
- Do NOT add customer login or accounts
- Mobile-first, touch-friendly

PAGE CONTEXT:
- Public page
- Used by customers of all ages
- Many users may be non-technical
- Booking must be completed in under 60 seconds

PRIMARY GOAL:
Make booking feel effortless and obvious.
One clear path. No distractions.

---

## LAYOUT REQUIREMENTS

- Full-width layout
- Background: gray-50
- No sidebar or top navigation
- Content centered with max width (max-w-2xl)
- Mobile-first design

Use a vertical step-based layout (NOT tabs).

---

## PAGE STRUCTURE (TOP TO BOTTOM)

### 1. Shop Header (Always Visible)
- Shop name (large, clear)
- Optional short helper text:
  "Book your appointment in seconds"

Do NOT add logo uploads or images.

---

### 2. Step 1 — Select Barber

- Display barbers as selectable chips/cards
- Show max 2 barbers
- One barber must be selected to continue
- Selected state must be visually obvious

Mobile:
- Stack chips horizontally, scrollable if needed

---

### 3. Step 2 — Select Service

- List services as cards:
  - Service name
  - Duration (e.g. 30 min)
  - Price (optional display)

Rules:
- One service only
- Clicking service auto-advances to next step
- Avoid dropdowns

---

### 4. Step 3 — Select Date & Time

Date:
- Simple date picker (today + future only)

Time:
- Display available slots as rounded buttons
- Grid layout
- Disabled state for unavailable slots
- Clear selected state

Rules:
- Slots are generated dynamically
- Do NOT show unavailable times
- No manual time input

Mobile:
- Use 2–3 columns grid for slots
- Large tap targets

---

### 5. Step 4 — Customer Details

Fields:
- Name
- Phone number

Rules:
- Labels above inputs
- Minimal explanation
- Phone number required

No email required in V1.

---

### 6. Step 5 — Payment (Optional)

If service requires advance payment:
- Clearly show:
  "Advance payment required: ₹XX"
- Explain briefly:
  "This amount will be adjusted in your final bill."

Primary CTA:
- "Pay & Book Appointment"

If no advance required:
- Primary CTA:
  "Confirm Booking"

CTA must be:
- Sticky at bottom on mobile
- Full-width
- Primary button styling

---

## UX RULES (VERY IMPORTANT)

- One primary action per step
- Avoid showing everything at once
- Clear visual progression
- Do not overload screen
- Reduce scrolling where possible
- No marketing text
- No popups unless required

---

## ACCESSIBILITY

- Proper label associations
- Button elements for all actions
- Readable text sizes
- High contrast for selected states

---

## RESPONSIVE BEHAVIOR

Mobile:
- Single column
- Sticky bottom CTA
- Large buttons

Tablet:
- Slightly wider layout
- Two-column time slot grid allowed

Desktop:
- Centered content
- Comfortable spacing
- Same flow (do NOT redesign for desktop)

---

## DELIVERABLE

- JSX code only
- Tailwind utility classes only
- Semantic HTML
- UI only (no API calls, no mock logic)
- Clean component structure
- No hardcoded shop data

AFTER GENERATING CODE:
- Briefly explain how the UX minimizes drop-offs
  (max 4 lines)
