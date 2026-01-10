# Design System

This document defines the visual and interaction design system for the Barber Appointment SaaS.
All UI should follow this system to remain consistent, minimal, and professional.

This is a **Material Design–inspired system**, implemented using **Tailwind CSS**, without using Material UI.

---

## 1. Design Principles

- Minimal, calm, professional
- Optimized for daily operational use
- Touch-friendly (barbers use phones a lot)
- Clear hierarchy, no visual noise
- Predictable components

Avoid:
- Decorative visuals
- Heavy animations
- Gradients
- Over-styled components

---

## 2. Color Palette

Use Tailwind default colors only.

### Primary
- Primary: `indigo-600`
- Primary hover: `indigo-700`

### Accent / Status
- Success: `emerald-500`
- Warning: `amber-500`
- Error: `red-500`

### Neutrals
- Background: `gray-50`
- Surface (cards): `white`
- Border: `gray-200`
- Text primary: `gray-900`
- Text secondary: `gray-600`

Do NOT introduce custom hex colors.

---

## 3. Typography

### Font
- `Inter` or `Roboto`

### Headings
- `text-xl` → page titles
- `text-lg` → section titles
- `font-medium` or `font-semibold`

### Body Text
- `text-sm` or `text-base`
- `text-gray-600`

Avoid decorative fonts or excessive font weights.

---

## 4. Spacing & Rhythm

- Use Tailwind spacing scale only
- Follow 8px rhythm:
  - `p-2`, `p-4`, `p-6`
  - `gap-4`, `gap-6`

### Padding Guidelines
- Mobile: compact (`p-4`)
- Desktop: relaxed (`p-6`)

Do NOT use arbitrary spacing values.

---

## 5. Cards (Primary Surface)

All cards MUST use:

- `bg-white`
- `border border-gray-200`
- `rounded-xl`
- `shadow-sm`
- Optional hover: `hover:shadow-md`

Cards should contain:
- Title
- Optional subtitle
- Content
- Optional actions

Avoid nested cards unless necessary.

---

## 6. Buttons

### Button Types

#### Primary
- `bg-indigo-600 text-white`
- `hover:bg-indigo-700`

#### Secondary
- `border border-gray-300 text-gray-700`

#### Danger
- `text-red-600`

### Button Rules
- `rounded-lg`
- `px-4 py-2`
- Minimum height ~40px
- Text + icon preferred over icon-only

---

## 7. Form Inputs (Material-inspired)

- Label above input (required)
- Rounded corners: `rounded-lg`
- Border: `border-gray-300`
- Focus:
  - `focus:ring-2`
  - `focus:ring-indigo-500`

Use `@tailwindcss/forms`.

Avoid floating labels in V1.

---

## 8. Chips & Status Indicators

Use small rounded chips.

### Status Colors
- Upcoming: `bg-blue-100 text-blue-700`
- Completed: `bg-green-100 text-green-700`
- No-show: `bg-red-100 text-red-700`
- Cancelled: `bg-gray-100 text-gray-600`

Chips must be readable and consistent.

---

## 9. Icons

- Use outline-style icons only
- Keep icons subtle
- Icons should support text, not replace it

---

## 10. What NOT to Do

- No UI libraries (MUI, Chakra, AntD)
- No animations beyond hover/focus
- No inconsistent colors or fonts
- No visual experiments in V1

This design system is intentionally boring.
Boring is good for operations-heavy apps.
