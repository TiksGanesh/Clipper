Follow docs/admin-dashboard-cleanup-instructions.md strictly.

Create a minimal Admin layout wrapper.

Requirements:
- Shared across all /admin routes
- Header with:
  - App name
  - Logged-in admin indicator
  - Logout link
- Content area below header

Rules:
- No sidebar yet
- No icons required
- No styling system
- Simple semantic HTML

Do NOT redesign individual pages yet.

Standardize admin navigation links.

Required links:
- Dashboard → /admin/dashboard
- Shops → /admin/shops
- Create Shop → /admin/shops/create

Rules:
- Same order on all pages
- Highlight current page (basic text or underline)
- No dropdowns
- No breadcrumbs yet

Standardize page headers across admin pages.

Each admin page must have:
- Page title (H1)
- Optional short description (1 line max)

Rules:
- Titles must be explicit:
  - "Admin Dashboard"
  - "Shops"
  - "Shop Details"
  - "Create Shop"
- No marketing copy
- Basic icons if required

Normalize admin action buttons.

Rules:
- Primary action:
  - One per page max
  - Used for create / save
- Secondary actions:
  - Links or secondary buttons
- Destructive actions:
  - Explicit text (Suspend, Disable)
  - Require confirmation

No icons required.
Use basic color system if required.


Clean up admin forms UX.

Requirements:
- Label above input
- Required fields marked clearly
- Inline validation messages
- Submit button at bottom
- Cancel link where applicable

Rules:
- No multi-step forms
- No auto-save
- No magic defaults

Improve readability of admin tables/lists.

Rules:
- Clear column headers
- Consistent column order
- Dates formatted human-readable
- Empty state messages present

Do NOT add sorting or bulk actions.


Standardize status and messaging across admin UI.

Rules:
- Use exact shop states as text
- No derived or renamed statuses
- Success messages short and factual
- Error messages human-readable

Avoid emojis or marketing language.

Add confirmation steps for destructive admin actions.

Actions requiring confirmation:
- Suspend shop
- Disable booking
- Reset emergency leave

Rules:
- Simple confirm / cancel
- Explain impact in one sentence
- No modal stacking

Audit all admin pages for empty and error states.

Ensure:
- Every list has an empty message
- Every form shows validation errors clearly
- API failures show readable messages
- No blank screens

Document any missing states.


Review Admin UX holistically.

Confirm:
- No analytics or charts
- No revenue data
- No barber workflow leakage
- UI remains simple and functional
- No new features added

List any remaining UX risks.