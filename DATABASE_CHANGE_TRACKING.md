# Database Change Tracking

This file tracks all database schema and data changes made in development that need to be applied to production.

## Format
Each entry should include:
- **Date**: When the change was made
- **Change Type**: Schema, Data, Index, etc.
- **Description**: What was changed and why
- **Status**: Pending, Applied to Production, Verified
- **SQL File Reference**: Reference to the SQL script in DATABASE_CHANGES_FOR_PRODUCTION.sql

---

## Change Log

### 2025-01-XX: No-Name Teams for Import System
- **Date**: 2025-01-XX
- **Change Type**: Data (INSERT)
- **Description**:
  - Created 10 no-name teams to support the import system
  - One no-name team per organization (organizations 1-9)
  - One generic no-name team with NULL organization (team_id 189)
  - These teams are recommended during import when a player has no team specified
  - Organization-specific team is prioritized, with generic as fallback
- **Tables Affected**: `team`
- **SQL File Reference**: DATABASE_CHANGES_FOR_PRODUCTION.sql (lines 15-36)
- **Status**: ✅ Applied to Dev, ⏳ Pending Production
- **Verification Query**:
  ```sql
  SELECT team_id, name, organization, abbreviation
  FROM team
  WHERE (name IS NULL OR name = '' OR LOWER(name) = 'no name')
  ORDER BY organization DESC
  ```
- **Expected Results**: 10 teams (IDs 180-189)

### 2025-01-XX: Blog Post Comment Type Support
- **Date**: 2025-01-XX
- **Change Type**: Schema (CHECK Constraint)
- **Description**:
  - Updated CHECK constraint on `universal_comments.comment_type` column
  - Added 'blog_post' as a valid comment type alongside 'card', 'series', and 'set'
  - Required for WordPress blog integration to support user comments on blog posts
  - Constraint name: `CK__universal__comme__6CA31EA0`
- **Tables Affected**: `universal_comments`
- **SQL File Reference**: DATABASE_CHANGES_FOR_PRODUCTION.sql (lines 40-59)
- **Status**: ✅ Applied to Dev, ⏳ Pending Production
- **Verification Query**:
  ```sql
  SELECT definition
  FROM sys.check_constraints
  WHERE name = 'CK__universal__comme__6CA31EA0'
  ```
- **Expected Result**: `([comment_type]='blog_post' OR [comment_type]='set' OR [comment_type]='series' OR [comment_type]='card')`

### 2025-01-10: Player Display Card Feature
- **Date**: 2025-01-10
- **Change Type**: Schema (Column Addition + Foreign Key + Index)
- **Description**:
  - Added `display_card` column to `player` table to support GitHub Issue #11
  - Allows admins to assign a specific card as the player's display image
  - Used on player cards and player detail pages to show card images
  - Column is nullable BIGINT that references `card.card_id`
  - Includes foreign key constraint and index for performance
- **Tables Affected**: `player`
- **SQL File Reference**: DATABASE_CHANGES_FOR_PRODUCTION.sql (lines 62-101)
- **Status**: ✅ Applied to Dev, ⏳ Pending Production
- **Related Features**:
  - Admin interface for selecting display cards from player's cards
  - Filters to only cards with reference images
  - PlayerCard component updated to show card image on right 30%
- **Verification Query**:
  ```sql
  SELECT
      c.name as column_name,
      t.name as data_type,
      c.is_nullable,
      c.max_length
  FROM sys.columns c
  JOIN sys.types t ON c.user_type_id = t.user_type_id
  WHERE c.object_id = OBJECT_ID('player')
  AND c.name = 'display_card'
  ```
- **Expected Result**: One row showing `display_card` as BIGINT, nullable

### 2025-01-10: Card Reference Images Feature
- **Date**: 2025-01-10
- **Change Type**: Schema (Column Addition + Foreign Key + Index)
- **Description**:
  - Added `reference_user_card` column to `card` table
  - Points to a `user_card` record that contains canonical/official images for the card
  - Allows cards to reference existing community-uploaded photos without duplication
  - Column is nullable BIGINT that references `user_card.user_card_id`
  - Includes foreign key constraint and index for performance
- **Tables Affected**: `card`
- **SQL File Reference**: DATABASE_CHANGES_FOR_PRODUCTION.sql (lines 104-144)
- **Status**: ✅ Applied to Dev, ⏳ Pending Production
- **Related Features**:
  - Admin interface for viewing community images and selecting reference card
  - API endpoints updated to include front_image_url and back_image_url from reference card
  - Card detail pages show reference images
- **Verification Query**:
  ```sql
  SELECT
      c.name as column_name,
      t.name as data_type,
      c.is_nullable,
      c.max_length
  FROM sys.columns c
  JOIN sys.types t ON c.user_type_id = t.user_type_id
  WHERE c.object_id = OBJECT_ID('card')
  AND c.name = 'reference_user_card'
  ```
- **Expected Result**: One row showing `reference_user_card` as BIGINT, nullable

### 2025-01-12: Card Image Path Columns (Issue #33)
- **Date**: 2025-01-12
- **Change Type**: Schema (Column Addition)
- **Description**:
  - Added `front_image_path` and `back_image_path` columns to `card` table
  - Stores URLs of web-optimized card images (300px height, 85% JPEG quality)
  - Separate from user_card_photo table (user uploads remain high-res)
  - Enables fast carousel loading and deletion-safe public images
  - Both columns are NVARCHAR(MAX) NULL (nullable)
- **Tables Affected**: `card`
- **SQL File Reference**: DATABASE_CHANGES_FOR_PRODUCTION.sql (lines 208-288)
- **Status**: ✅ Applied to Dev, ⏳ Pending Production
- **Related Features**:
  - Image optimization system (Issue #33)
  - Automatic optimization when admin assigns reference_user_card
  - Carousel uses front_image_path for performance
  - Azure Storage card-optimized container
- **Verification Query**:
  ```sql
  SELECT
      c.name as column_name,
      t.name as data_type,
      c.is_nullable,
      c.max_length
  FROM sys.columns c
  JOIN sys.types t ON c.user_type_id = t.user_type_id
  WHERE c.object_id = OBJECT_ID('card')
  AND c.name IN ('front_image_path', 'back_image_path')
  ORDER BY c.name
  ```
- **Expected Result**: Two rows showing both columns as NVARCHAR, nullable, max_length -1 (MAX)

### 2025-01-11: Short Print Card Property
- **Date**: 2025-01-11
- **Change Type**: Schema (Column Addition)
- **Description**:
  - Added `is_short_print` column to `card` table to support GitHub Issue #14
  - Tracks cards that are short prints (SP) - cards with lower print runs than standard cards in a set
  - Column is BIT NOT NULL with default value 0 (false)
  - Follows same pattern as existing `is_rookie`, `is_autograph`, and `is_relic` columns
  - Will be displayed with pink "SP" tag in UI alongside other card type badges
- **Tables Affected**: `card`
- **SQL File Reference**: DATABASE_CHANGES_FOR_PRODUCTION.sql
- **Status**: ✅ Applied to Dev, ⏳ Pending Production
- **Related Features**:
  - UI components updated to show pink "SP" tag when is_short_print = 1
  - Admin edit forms include is_short_print checkbox
  - Data migration script to set is_short_print from existing notes containing "SP"
- **Verification Query**:
  ```sql
  SELECT
      c.name as column_name,
      t.name as data_type,
      c.is_nullable,
      ISNULL(dc.definition, 'No default') as default_value
  FROM sys.columns c
  JOIN sys.types t ON c.user_type_id = t.user_type_id
  LEFT JOIN sys.default_constraints dc ON c.default_object_id = dc.object_id
  WHERE c.object_id = OBJECT_ID('card')
  AND c.name = 'is_short_print'
  ```
- **Expected Result**: One row showing `is_short_print` as BIT, NOT NULL, default ((0))

---

## Application Changes (Non-Database)

### 2025-01-12: Card Image Optimization System (Issue #33)
- **Date**: 2025-01-12
- **Change Type**: Application Infrastructure + Performance
- **Description**:
  - Implemented automatic image optimization for card reference images
  - Admins assign reference user_card images → system downloads, optimizes, and stores web-friendly versions
  - Optimized images: 300px height, 85% JPEG quality, ~50-150KB per image (vs 2-5MB originals)
  - Solves carousel performance issues (20 images loading slowly)
  - Creates deletion-safe copies (user deletions don't break site)
- **Files Modified**:
  - **NEW**: `server/utils/image-optimizer.js` - Image processing utility using sharp library
    - `processCardImage(url, cardId, side)` - Download, optimize, and upload workflow
    - `optimizeImage(buffer)` - Resize to 300px height, compress to JPEG 85%
    - `uploadOptimizedImage(buffer, name)` - Upload to Azure card-optimized container
    - `deleteOptimizedImage(url)` - Cleanup when reference changes
  - **NEW**: `server/scripts/migrate-optimize-card-images.js` - Migration script for existing references
  - `server/routes/admin-cards.js` - Updated reference-image endpoint:
    - Processes images when reference assigned/changed
    - Deletes old optimized images when reference cleared/changed
    - Updates card.front_image_path and card.back_image_path
  - `server/routes/cards.js` - Updated carousel endpoint:
    - Changed from user_card_photo.photo_url to card.front_image_path
    - Now serves optimized images instead of original uploads
  - `package.json` - Added sharp dependency for image processing
- **Azure Storage Structure**:
  - New container: `card-optimized`
  - Naming pattern: `{cardId}_front.jpg`, `{cardId}_back.jpg`
  - Environment separation: dev/ prefix in development
  - Cache headers: `max-age=31536000` (1 year)
- **Database Fields Used**:
  - `card.reference_user_card` - Points to source user_card (already exists)
  - `card.front_image_path` - Optimized front image URL (already exists)
  - `card.back_image_path` - Optimized back image URL (already exists)
- **User Experience**:
  - **Public facing** (carousel, card detail): Optimized images (fast loading)
  - **User collections**: Original uploaded images (high-res)
  - **Deletion safety**: User deletions don't affect public site
- **Performance Impact**:
  - Carousel load time: ~10-30 seconds → ~1-2 seconds (estimated 10-15x faster)
  - Image size reduction: 2-5MB → 50-150KB per image (~95% smaller)
  - Network bandwidth: 40-100MB → 1-3MB for 20 carousel images
- **Status**: ✅ Applied to Dev, ⏳ Pending Production Deployment
- **Production Deployment Steps**:
  1. Deploy code changes (includes sharp npm package)
  2. Run migration script: `node server/scripts/migrate-optimize-card-images.js`
  3. Verify carousel loads optimized images
  4. Check Azure Storage card-optimized container for new images
- **Migration Notes**:
  - Migration script processes all cards with reference_user_card but missing optimized images
  - Safe to re-run (skips already-processed images)
  - Provides detailed progress and error reporting
  - Can be run in both dev and production environments

### 2025-01-12: Azure Storage Dev/Production Separation
- **Date**: 2025-01-12
- **Change Type**: Application Infrastructure
- **Description**:
  - Implemented environment-aware Azure Blob Storage paths to separate dev and production uploads
  - Development environment now uploads all files to `dev/` subfolder in Azure Storage
  - Production uploads continue using root paths (no prefix)
  - Prevents dev environment uploads from appearing on production site
  - All existing production images remain untouched
- **Files Modified**:
  - **NEW**: `server/utils/azure-storage.js` - Centralized utility module
    - `getBlobName(path)` - Adds `dev/` prefix in development environment
    - `extractBlobNameFromUrl(url, segments)` - Handles both dev/ and production paths for deletion
    - `isProduction()`, `getEnvironment()` - Environment detection helpers
  - `server/routes/user-card-photos.js` - User card photo uploads (3 upload locations, 2 deletion locations)
  - `server/routes/user-profile.js` - User profile avatar uploads (1 upload location, 2 deletion locations)
  - `server/routes/admin-sets.js` - Set thumbnails and series images (3 upload locations)
  - `server/routes/user-cards.js` - Blob deletion logic when cards are removed (1 deletion location)
- **Environment Detection**:
  - Uses `process.env.NODE_ENV` to determine environment
  - Development: `NODE_ENV !== 'production'` → adds `dev/` prefix
  - Production: `NODE_ENV === 'production'` → no prefix (root paths)
- **Azure Storage Structure**:
  - **Production**: `https://storage.blob.core.windows.net/container/filename.jpg`
  - **Development**: `https://storage.blob.core.windows.net/container/dev/filename.jpg`
- **Affected Containers**:
  - `user-card` - User card photos
  - `profile` - User profile avatars
  - `set` - Set thumbnails
  - `series` - Series front/back images
- **Deletion Logic**:
  - Updated to handle both dev-prefixed and non-prefixed blob paths
  - Properly extracts blob names from full Azure URLs
  - Handles legacy production paths and new dev paths seamlessly
- **Status**: ✅ Applied to Dev, ⏳ Pending Production Deployment
- **Production Deployment Notes**:
  - No production changes required - production already runs with `NODE_ENV=production`
  - Existing production images remain at root paths (no migration needed)
  - New production uploads after deployment will continue using root paths
  - Dev environment will immediately start using `dev/` prefix after deployment
- **Verification Commands**:
  ```bash
  # Check environment variable
  echo $NODE_ENV

  # Verify dev uploads go to dev/ subfolder
  # Upload a test image in dev and check Azure Storage portal
  ```

---

## Notes

- Always test changes in development before applying to production
- Document all changes immediately when made
- Update status after applying to production
- Include rollback procedures for complex changes
