#!/bin/bash

# Script to reorganize docs/ directory into logical subdirectories
# Run this from the project root: bash reorganize-docs.sh

set -e  # Exit on error

echo "🗂️  Starting docs reorganization..."

# Create new subdirectories
echo "📁 Creating subdirectories..."
mkdir -p docs/setup
mkdir -p docs/architecture
mkdir -p docs/features
mkdir -p docs/api

echo "✅ Subdirectories created"

# ================================
# SETUP - Installation, deployment, authentication
# ================================
echo "📦 Moving setup-related files..."
mv docs/authentication.md docs/setup/ 2>/dev/null || echo "  ⚠️  authentication.md not found (may already be moved)"
mv docs/DASHBOARD_SETUP_NAVIGATION.md docs/setup/ 2>/dev/null || echo "  ⚠️  DASHBOARD_SETUP_NAVIGATION.md not found"

# Note: DEPLOYMENT_GUIDE.md is at root level, not in docs/
# The README will reference it from root: DEPLOYMENT_GUIDE.md

echo "✅ Setup files moved"

# ================================
# ARCHITECTURE - Database, system design, soft lock
# ================================
echo "🏗️  Moving architecture-related files..."
mv docs/SOFT_LOCK_ARCHITECTURE.md docs/architecture/ 2>/dev/null || echo "  ⚠️  SOFT_LOCK_ARCHITECTURE.md not found"
mv docs/SOFT_LOCK_IMPLEMENTATION.md docs/architecture/ 2>/dev/null || echo "  ⚠️  SOFT_LOCK_IMPLEMENTATION.md not found"
mv docs/SOFT_LOCK_QUICK_REFERENCE.md docs/architecture/ 2>/dev/null || echo "  ⚠️  SOFT_LOCK_QUICK_REFERENCE.md not found"
mv docs/SOFT_LOCK_CHANGE_SUMMARY.md docs/architecture/ 2>/dev/null || echo "  ⚠️  SOFT_LOCK_CHANGE_SUMMARY.md not found"
mv docs/SOFT_LOCK_TESTING.sh docs/architecture/ 2>/dev/null || echo "  ⚠️  SOFT_LOCK_TESTING.sh not found"
mv docs/TRIAL_SUBSCRIPTION_IMPLEMENTATION.md docs/architecture/ 2>/dev/null || echo "  ⚠️  TRIAL_SUBSCRIPTION_IMPLEMENTATION.md not found"
mv docs/design-system.md docs/architecture/ 2>/dev/null || echo "  ⚠️  design-system.md not found"
mv docs/layout-guidelines.md docs/architecture/ 2>/dev/null || echo "  ⚠️  layout-guidelines.md not found"

echo "✅ Architecture files moved"

# ================================
# FEATURES - Booking, walk-in, barber leave, calendar, etc.
# ================================
echo "✨ Moving feature-related files..."
mv docs/booking-page.md docs/features/ 2>/dev/null || echo "  ⚠️  booking-page.md not found"
mv docs/WALKIN_FEATURE.md docs/features/ 2>/dev/null || echo "  ⚠️  WALKIN_FEATURE.md not found"
mv docs/BARBER_LEAVE_IMPLEMENTATION.md docs/features/ 2>/dev/null || echo "  ⚠️  BARBER_LEAVE_IMPLEMENTATION.md not found"
mv docs/CALENDAR_REVIEW.md docs/features/ 2>/dev/null || echo "  ⚠️  CALENDAR_REVIEW.md not found"
mv docs/ADD_SECOND_BARBER_FEATURE.md docs/features/ 2>/dev/null || echo "  ⚠️  ADD_SECOND_BARBER_FEATURE.md not found"
mv docs/EDIT_SHOP_FIX_SUMMARY.md docs/features/ 2>/dev/null || echo "  ⚠️  EDIT_SHOP_FIX_SUMMARY.md not found"
mv docs/SERVICES_FIX_SUMMARY.md docs/features/ 2>/dev/null || echo "  ⚠️  SERVICES_FIX_SUMMARY.md not found"

echo "✅ Feature files moved"

# ================================
# API - API endpoints, slots, admin dashboard
# ================================
echo "🔌 Moving API-related files..."
mv docs/SLOTS_API_UPDATE.md docs/api/ 2>/dev/null || echo "  ⚠️  SLOTS_API_UPDATE.md not found"
mv docs/admin-dashboard.md docs/api/ 2>/dev/null || echo "  ⚠️  admin-dashboard.md not found"
mv docs/admin-dashboard-cleanup-instructions.md docs/api/ 2>/dev/null || echo "  ⚠️  admin-dashboard-cleanup-instructions.md not found"
mv docs/ADMIN_SHOP_DETAIL_ENHANCEMENT.md docs/api/ 2>/dev/null || echo "  ⚠️  ADMIN_SHOP_DETAIL_ENHANCEMENT.md not found"

echo "✅ API files moved"

# ================================
# Summary
# ================================
echo ""
echo "🎉 Documentation reorganization complete!"
echo ""
echo "📊 New structure:"
echo "  docs/setup/          - Setup, authentication, and deployment guides"
echo "  docs/architecture/   - System design, soft lock, subscriptions, design system"
echo "  docs/features/       - Feature-specific documentation"
echo "  docs/api/            - API endpoint documentation"
echo ""
echo "⚠️  IMPORTANT: Update any internal cross-references in these files!"
echo "   Example: If a file references '../OTHER_FILE.md', update to '../<category>/OTHER_FILE.md'"
echo ""
echo "✅ Next steps:"
echo "  1. Review the moved files: ls -R docs/"
echo "  2. Check README.md links (they should already be updated)"
echo "  3. Search for internal doc links that may need updating:"
echo "     grep -r '\.\./' docs/ --include='*.md'"
