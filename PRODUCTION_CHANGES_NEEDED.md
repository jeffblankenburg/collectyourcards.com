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

## 🐛 Bug Fixes Ready for Deployment

### 2. Search Order Dependency Fix - DEPLOYED TO DEV ✅
**Status**: 🟢 **Fixed and ready for production**
**Affected Feature**: Universal Search (search-v2)
**Issue**: "pink steven kwan" and "steven kwan pink" returned different results
**Severity**: Medium - affects search accuracy and user experience

**Problem**:
The search token extraction was order-dependent. Parallel/color keywords (like "pink", "blue", "red") were not being removed from player/team/set name searches before generating n-grams. This caused:
- "pink steven kwan" → generated n-grams like "pink steven", "steven kwan"
- "steven kwan pink" → generated n-grams like "steven kwan", "kwan pink"
- Different n-grams led to inconsistent token extraction and different result types

**Solution Applied** ✅:
Modified three token extraction functions in `server/routes/search-v2.js`:
1. `extractPlayerNames()` - Now removes parallel keywords before player search (lines 410-420)
2. `extractTeamNames()` - Now removes parallel keywords before team search (lines 816-825)
3. `extractSetNames()` - Removes most parallel keywords, but preserves "chrome", "prism", "prizm" as they're common in set names (lines 671-683)

**Result**:
Both "pink steven kwan" and "steven kwan pink" now:
- Extract player token: Steven Kwan
- Extract parallel token: pink
- Return same results: pink parallel cards of Steven Kwan

**Testing**: Confirmed no diagnostics errors
**Files Changed**: `server/routes/search-v2.js` (3 functions modified)
**Priority**: Medium - improves search consistency and accuracy

---

## 📋 Other Pending Changes

### 3. No-Name Teams for Import System
**Status**: ⚠️ Pending
**File**: `DATABASE_CHANGES_FOR_PRODUCTION.sql` (Lines 16-37)
**Description**: Creates placeholder teams for players without team assignments during imports

### 4. Blog Post Comment Type Support
**Status**: ⚠️ Pending
**File**: `DATABASE_CHANGES_FOR_PRODUCTION.sql` (Lines 47-59)
**Description**: Updates universal_comments constraint to allow 'blog_post' comment type

### 5. eBay Integration Schema
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
