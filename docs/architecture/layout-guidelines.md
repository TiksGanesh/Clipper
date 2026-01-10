Global Layout Guidelines

This document defines the responsive layout structure for all pages in the application.
All authenticated pages MUST follow the App Shell pattern defined here.

### 1. Breakpoints

Use Tailwind default breakpoints only:
sm → Mobile
md → Tablet
lg → Desktop

- Do not introduce custom breakpoints.

### 2. Layout Strategy

Mobile (sm)
Top app bar
Bottom navigation for primary actions
Single-column content
Full-width buttons
Vertical stacking
Tablet and Desktop (md+)
Persistent left sidebar
Top app bar
Main content area
No bottom navigation

### 3. App Shell (Authenticated Pages)

All authenticated pages must follow this structure:
AppShell
  • Sidebar (visible on md and above)
  • TopBar
  • MainContent

Rules:
- Do NOT create page-specific layouts unless unavoidable
- Sidebar visibility must be controlled via responsive utilities
- AppShell must wrap all dashboard and barber pages

### 4. Sidebar (md+)
Rules
Fixed width
Visible on md and larger screens
Optional collapse on tablet
Contents
Logo (top)
Primary navigation links only:
Dashboard
Calendar
Services
Walk-ins
Restrictions:
No nested menus
No secondary navigation
No icons without labels

### 5. Top App Bar

Contents
Page title on the left
Context selector (barber switch or profile menu) on the right
Behavior
Compact height
May use sticky positioning
Visible on all screen sizes

### 6. Main Content Area

Layout Rules
Content should be centered
Max width: 7xl on large screens
Responsive padding:
Mobile: padding 4
Desktop: padding 6
Grid Rules
Mobile: single column only
Tablet: two-column grids allowed
Desktop: multi-column grids allowed
Avoid overly wide text blocks.

# 7. Navigation Rules

Only one primary navigation system
No breadcrumbs in V1
No mega menus
No nested sidebars
Navigation must be obvious without explanation.

# 8. Page-Specific Notes

Dashboard Pages
Summary cards at the top
Lists below
Avoid deep vertical scrolling
Calendar Pages
Day view is default
Week view is secondary
Actions must be minimal and obvious
Setup Pages
Centered cards
Step-based flow
Clear primary action

### 9. Responsive Behavior Rules

Stack all elements vertically on mobile
Use grid and flex utilities only
Do not hide critical actions on mobile
Use sticky bottom CTA where appropriate

### 10. What NOT to Do

Do not mix layout patterns across pages
Do not create multiple navigation systems
Do not optimize for desktop only
Do not overload screens with information
Consistency is more important than creativity for this product.