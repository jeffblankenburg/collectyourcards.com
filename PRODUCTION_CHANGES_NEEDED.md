# Production Changes Needed

This document tracks changes that need to be applied to the production database and deployment.

## 🚨 CRITICAL - Blocking Production Errors

### 1. Missing Database Columns - READY FOR DEPLOYMENT ✅

**Status**: 🟢 **Comprehensive schema sync script ready to run**
**Affected Features**: Admin Cards Community Images, Player Card Display Images, Home Page Carousel, URL Routing
**Issue**: GitHub #16 - SQL Schema Creep

**Code Fixes Applied** ✅:
- Fixed admin-cards.js to use explicit field selection (avoids ebay_purchase_id dependency)
- Admin cards endpoints work without schema changes (but can't save until schema updated)

**Deployment Solution** ✅:
**Comprehensive idempotent schema synchronization script created and ready!**

**Files to run** (in order):
1. `database-scripts/SCHEMA_SYNC_PRODUCTION.sql` - Main schema sync (663 lines)
   - Adds all 22 missing columns
   - Creates 3 foreign keys
   - Creates 10 indexes
   - Fully idempotent and safe to run multiple times

2. `database-scripts/populate-slugs.sql` - Slug population (397 lines)
   - Populates slug columns with URL-friendly values
   - Handles duplicates automatically
   - Idempotent

**Documentation**: `database-scripts/SCHEMA_SYNC_README.md` - Complete usage guide
**Summary**: `database-scripts/ISSUE-16-SUMMARY.md` - Quick deployment reference

**What gets fixed**:
- ✅ card.reference_user_card - Canonical image references
- ✅ player.display_card - Player display images
- ✅ player.slug, series.slug, set.slug, team.slug - URL routing
- ✅ user.username, bio, avatar_url, etc. - User profiles
- ✅ user.is_muted, muted_at, muted_by - Moderation
- ✅ user_session.token_hash - Session security
- ✅ All indexes and foreign keys for performance

**Error Symptoms (Now Fixed)**:
```
Invalid column name 'ebay_purchase_id'  ✅ FIXED by code changes
Invalid column name 'reference_user_card'  ✅ READY - will be fixed by schema sync
GET /api/admin/cards/:id/community-images - 500  ✅ FIXED by code changes
```

**Priority**: Ready for immediate deployment - scripts are validated and production-safe

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
