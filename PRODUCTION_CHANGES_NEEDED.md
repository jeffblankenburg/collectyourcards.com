# Production Changes Needed

This document tracks changes that need to be applied to the production database and deployment.

## 🚨 CRITICAL - Blocking Production Errors

### 1. Missing Database Columns (URGENT - PARTIALLY FIXED)

**Status**: 🟡 **Code fixes deployed, SQL changes still needed**
**Affected Features**: Admin Cards Community Images, Player Card Display Images, Home Page Carousel

**Code Fixes Applied** ✅:
- Fixed admin-cards.js to use explicit field selection (avoids ebay_purchase_id dependency)
- Admin cards endpoints should now work without schema changes

**Required SQL Changes**:
Run the following sections from `DATABASE_CHANGES_FOR_PRODUCTION.sql`:

1. **card.reference_user_card** (Lines 112-144) - STILL NEEDED
   - Allows cards to reference canonical community-uploaded images
   - Required for: Admin card image selection, card detail pages
   - Note: Admin endpoint will work without this, but can't save reference images until column exists

2. **player.display_card** (Lines 69-101) - STILL NEEDED
   - Links players to their display card image
   - Required for: Player cards, player detail pages, carousel

**Error Symptoms (Before Code Fix)**:
```
Invalid column name 'ebay_purchase_id'  ← FIXED by explicit field selection
Invalid column name 'reference_user_card'  ← Still needs SQL migration
GET /api/admin/cards/:id/community-images - 500  ← FIXED in code
```

**Priority**: SQL migrations should be run to enable full functionality

---

## 📋 Other Pending Changes

### 2. No-Name Teams for Import System
**Status**: ⚠️ Pending
**File**: `DATABASE_CHANGES_FOR_PRODUCTION.sql` (Lines 16-37)
**Description**: Creates placeholder teams for players without team assignments during imports

### 3. Blog Post Comment Type Support
**Status**: ⚠️ Pending
**File**: `DATABASE_CHANGES_FOR_PRODUCTION.sql` (Lines 47-59)
**Description**: Updates universal_comments constraint to allow 'blog_post' comment type

### 4. eBay Integration Schema
**Status**: ⏸️ Deferred
**File**: `DATABASE_CHANGES_FOR_PRODUCTION.sql` (Lines 150-164)
**Description**: Deferred until full eBay integration is ready for production. Includes:
- `user_card.ebay_purchase_id` column
- Foreign key to `ebay_purchases` table
- Requires complete eBay infrastructure (ebay_purchases, ebay_sync_logs, user_ebay_accounts tables)
**Note**: Code has been updated to work without this column using explicit field selection

---

## ✅ Completed Changes

None yet - all changes are pending production deployment.

---

## Notes

- All SQL scripts include verification queries to confirm successful execution
- Foreign key constraints will fail if referenced tables don't exist
- Indexes are included for performance optimization
- **IMPORTANT**: Run these changes during a maintenance window if possible
- Test queries on a staging database first if available

Last Updated: 2025-01-10
