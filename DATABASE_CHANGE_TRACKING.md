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
- **Status**: ✅ Applied to Production
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
- **Status**: ✅ Applied to Production
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
- **Status**: ✅ Applied to Production
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
- **Status**: ✅ Applied to Production
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

### 2025-01-12: Performance Index for Cards Needing Reference
- **Date**: 2025-01-12
- **Change Type**: Index Creation (Performance)
- **Description**:
  - Created filtered index on `card.reference_user_card` column
  - Dramatically improves performance of admin "cards needing reference" page
  - Index only includes cards where reference_user_card IS NULL (filtered index)
  - Includes card_id, card_number, series columns for covering index performance
  - Resolves production timeout (499 error after 240 seconds)
- **Tables Affected**: `card`
- **SQL File Reference**: `ADD_REFERENCE_INDEX_PRODUCTION.sql`
- **Status**: ✅ Applied to Production
- **Performance Impact**:
  - Before: Query timeout at 240+ seconds (4 minutes)
  - After: Expected <1-2 seconds
- **Verification Query**:
  ```sql
  SELECT i.name, i.type_desc, i.has_filter, i.filter_definition
  FROM sys.indexes i
  WHERE i.object_id = OBJECT_ID('card')
  AND i.name = 'IX_card_reference_user_card'
  ```
- **Expected Result**: One row showing filtered NONCLUSTERED index with filter `reference_user_card IS NULL`

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
- **Status**: ✅ Applied to Production
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
- **Status**: ✅ Applied to Production
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
- **Status**: ✅ Applied to Production Deployment
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
- **Status**: ✅ Applied to Production Deployment
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

### 2025-12-02: Duplicate Exclusion Table
- **Date**: 2025-12-02
- **Change Type**: Schema (CREATE TABLE)
- **Description**:
  - Created `duplicate_exclusion` table to store player pairs marked as "not duplicates"
  - Allows admin users to dismiss false positive duplicate matches
  - Dismissed pairs will not appear in future duplicate detection results
  - Supports bidirectional pair storage with constraint ensuring player1_id < player2_id
- **Tables Affected**: `duplicate_exclusion` (NEW)
- **SQL Script**:
  ```sql
  CREATE TABLE duplicate_exclusion (
      player1_id BIGINT NOT NULL,
      player2_id BIGINT NOT NULL,
      created DATETIME2 DEFAULT GETDATE(),
      created_by BIGINT NULL,
      CONSTRAINT PK_duplicate_exclusion PRIMARY KEY (player1_id, player2_id),
      CONSTRAINT FK_duplicate_exclusion_player1 FOREIGN KEY (player1_id) REFERENCES player(player_id),
      CONSTRAINT FK_duplicate_exclusion_player2 FOREIGN KEY (player2_id) REFERENCES player(player_id),
      CONSTRAINT FK_duplicate_exclusion_user FOREIGN KEY (created_by) REFERENCES [user](user_id),
      CONSTRAINT CK_duplicate_exclusion_order CHECK (player1_id < player2_id)
  );

  CREATE INDEX IX_duplicate_exclusion_lookup ON duplicate_exclusion (player1_id, player2_id);
  ```
- **Status**: ✅ Applied to Production
- **Verification Query**:
  ```sql
  SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'duplicate_exclusion';
  ```

---

### 2025-12-04: Seller Order Grouping System
- **Date**: 2025-12-04
- **Change Type**: Schema (CREATE TABLE, ALTER TABLE)
- **Description**:
  - Created `sale_order` table to group multiple sales for combined shipping
  - Created `order_supply_usage` table to track supply usage per order (replaces shipping_config for per-sale)
  - Added `order_id` column to `sale` table to link sales to orders
  - This enables proper profit calculation when multiple cards ship together
- **Tables Affected**: `sale_order` (NEW), `order_supply_usage` (NEW), `sale` (MODIFIED)
- **SQL Script**:
  ```sql
  -- Create sale_order table
  CREATE TABLE sale_order (
      order_id BIGINT IDENTITY(1,1) PRIMARY KEY,
      user_id BIGINT NOT NULL,
      platform_id INT NULL,
      order_reference NVARCHAR(100) NULL,
      buyer_username NVARCHAR(100) NULL,
      status VARCHAR(20) DEFAULT 'pending',
      ship_date DATETIME NULL,
      shipping_charged DECIMAL(10,2) NULL,
      shipping_cost DECIMAL(10,2) NULL,
      tracking_number NVARCHAR(100) NULL,
      notes NVARCHAR(MAX) NULL,
      created DATETIME DEFAULT GETDATE(),
      updated DATETIME DEFAULT GETDATE(),
      CONSTRAINT FK_sale_order_user FOREIGN KEY (user_id) REFERENCES [user](user_id) ON DELETE CASCADE,
      CONSTRAINT FK_sale_order_platform FOREIGN KEY (platform_id) REFERENCES selling_platform(platform_id)
  );

  CREATE INDEX IX_sale_order_user ON sale_order(user_id);
  CREATE INDEX IX_sale_order_user_status ON sale_order(user_id, status);
  CREATE INDEX IX_sale_order_reference ON sale_order(order_reference);

  -- Create order_supply_usage table
  CREATE TABLE order_supply_usage (
      order_supply_usage_id BIGINT IDENTITY(1,1) PRIMARY KEY,
      order_id BIGINT NOT NULL,
      supply_batch_id BIGINT NOT NULL,
      quantity_used INT NOT NULL,
      cost_per_unit DECIMAL(10,6) NOT NULL,
      total_cost DECIMAL(10,2) NOT NULL,
      created DATETIME DEFAULT GETDATE(),
      CONSTRAINT FK_order_supply_usage_order FOREIGN KEY (order_id) REFERENCES sale_order(order_id) ON DELETE CASCADE,
      CONSTRAINT FK_order_supply_usage_batch FOREIGN KEY (supply_batch_id) REFERENCES supply_batch(supply_batch_id)
  );

  CREATE INDEX IX_order_supply_usage_order ON order_supply_usage(order_id);
  CREATE INDEX IX_order_supply_usage_batch ON order_supply_usage(supply_batch_id);

  -- Add order_id to sale table
  ALTER TABLE sale ADD order_id BIGINT NULL;
  ALTER TABLE sale ADD CONSTRAINT FK_sale_order FOREIGN KEY (order_id) REFERENCES sale_order(order_id);
  CREATE INDEX IX_sale_order ON sale(order_id);
  ```
- **Status**: ✅ Applied to Production
- **Verification Query**:
  ```sql
  SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME IN ('sale_order', 'order_supply_usage');
  SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'sale' AND COLUMN_NAME = 'order_id';
  ```

---

### 2025-12-04: Re-add shipping_config_id to sale table
- **Date**: 2025-12-04
- **Change Type**: Schema (ALTER TABLE)
- **Description**:
  - Re-added `shipping_config_id` to `sale` table for individual card shipping configuration
  - This allows sellers to select a shipping config (PWE, Bubble Mailer, etc.) per sale
  - Orders use `order_supply_usage` for combined shipments, individual sales use `shipping_config`
- **Tables Affected**: `sale` (MODIFIED)
- **SQL Script**:
  ```sql
  -- Add shipping_config_id to sale table
  ALTER TABLE sale ADD shipping_config_id INT NULL;
  ALTER TABLE sale ADD CONSTRAINT FK_sale_shipping_config FOREIGN KEY (shipping_config_id) REFERENCES shipping_config(shipping_config_id);
  CREATE INDEX IX_sale_shipping_config ON sale(shipping_config_id);
  ```
- **Status**: ✅ Applied to Production
- **Verification Query**:
  ```sql
  SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'sale' AND COLUMN_NAME = 'shipping_config_id';
  ```

---

### 2025-12-04: Add adjustment column to sale table
- **Date**: 2025-12-04
- **Change Type**: Schema (ALTER TABLE)
- **Description**:
  - Added `adjustment` column for manual price overrides
  - Negative values are additional costs, positive values are profit adjustments
  - Profit calculation: Sale $ + Ship $ - Fees - Ship Cost - Supplies + Adjustment
- **Tables Affected**: `sale` (MODIFIED)
- **SQL Script**:
  ```sql
  -- Add adjustment column to sale table
  ALTER TABLE sale ADD adjustment DECIMAL(10,2) NULL;
  ```
- **Status**: ✅ Applied to Production
- **Verification Query**:
  ```sql
  SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'sale' AND COLUMN_NAME = 'adjustment';
  ```

---

### 2025-12-04: Add purchase_price column to sale table
- **Date**: 2025-12-04
- **Change Type**: Schema (ALTER TABLE)
- **Description**:
  - Added `purchase_price` column to track original cost of the card
  - Used for true profit calculation: Sale $ + Ship $ - Purchase Price - Fees - Ship Cost - Supplies + Adjustment
  - When selling from collection, purchase_price can be auto-populated from user_card.purchase_price
- **Tables Affected**: `sale` (MODIFIED)
- **SQL Script**:
  ```sql
  -- Add purchase_price column to sale table
  ALTER TABLE sale ADD purchase_price DECIMAL(10,2) NULL;
  ```
- **Status**: ✅ Applied to Production
- **Verification Query**:
  ```sql
  SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'sale' AND COLUMN_NAME = 'purchase_price';
  ```

---

### 2025-12-04: Change default sale status from 'pending' to 'listed'
- **Date**: 2025-12-04
- **Change Type**: Schema (ALTER TABLE)
- **Description**:
  - Changed default status for new sales from 'pending' to 'listed'
  - Simplified status options to just 'listed' and 'sold' for initial version
  - Statistics/analytics only count 'sold' items
- **Tables Affected**: `sale` (MODIFIED)
- **SQL Script**:
  ```sql
  -- Change default status to 'listed'
  ALTER TABLE sale DROP CONSTRAINT DF__sale__status;
  ALTER TABLE sale ADD CONSTRAINT DF__sale__status DEFAULT 'listed' FOR status;
  ```
- **Status**: ✅ Applied to Production
- **Note**: The constraint name may vary - check your database for the actual constraint name

---

### 2025-12-04: Add sold_at and sale_id columns to user_card for archiving
- **Date**: 2025-12-04
- **Change Type**: Schema (ALTER TABLE)
- **Description**:
  - Added `sold_at` column to track when a card was sold (archive timestamp)
  - Added `sale_id` column to link archived user_card to the sale record
  - When a user sells a card from their collection, instead of deleting the user_card record:
    - Set `sold_at` to current timestamp
    - Set `sale_id` to the new sale record's ID
  - Collection queries filter by `sold_at IS NULL` to exclude archived cards
  - This preserves card data (photos, notes, purchase price, etc.) for sales history
  - Allows "unselling" a card by clearing these fields and deleting the sale
- **Tables Affected**: `user_card` (MODIFIED)
- **SQL Script**:
  ```sql
  -- Add sold_at and sale_id columns to user_card for archiving
  ALTER TABLE user_card ADD sold_at DATETIME NULL;
  ALTER TABLE user_card ADD sale_id BIGINT NULL;

  -- Optional: Add index for filtering active vs sold cards
  CREATE INDEX IX_user_card_sold_at ON user_card(sold_at);
  ```
- **Status**: ✅ Applied to Production
- **Verification Query**:
  ```sql
  SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'user_card' AND COLUMN_NAME IN ('sold_at', 'sale_id');
  ```

---

### 2025-12-04: Add user_card_id column to sale table
- **Date**: 2025-12-04
- **Change Type**: Schema (ALTER TABLE)
- **Description**:
  - Added `user_card_id` column to link sale records back to the user_card
  - Enables showing original card photos/details in sales history
  - Used when selling a card from collection to maintain the relationship
- **Tables Affected**: `sale` (MODIFIED)
- **SQL Script**:
  ```sql
  -- Add user_card_id column to sale table
  ALTER TABLE sale ADD user_card_id BIGINT NULL;

  -- Optional: Add index for querying sales by user_card
  CREATE INDEX IX_sale_user_card ON sale(user_card_id);
  ```
- **Status**: ✅ Applied to Production
- **Verification Query**:
  ```sql
  SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'sale' AND COLUMN_NAME = 'user_card_id';
  ```

---

### 2025-12-04: Product Purchase Tracking Table
- **Date**: 2025-12-04
- **Change Type**: Schema (CREATE TABLE)
- **Description**:
  - Created `product_purchase` table to track hobby box, case, and retail product purchases
  - Links to `set` table to calculate set-level ROI (investment vs sales recovery)
  - Allows sellers to record purchases and see "how much they've dug out of the hole"
  - Supports multiple product types: hobby_box, hobby_case, retail_blaster, retail_hanger, retail_mega, retail_cello, other
  - Tracks purchase date, quantity, total cost, cost per unit, estimated cards, source, and notes
- **Tables Affected**: `product_purchase` (NEW)
- **SQL File Reference**: DATABASE_CHANGES_FOR_PRODUCTION.sql
- **Status**: Applied to Production (2025-12-04)
- **Verification Query**:
  ```sql
  SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'product_purchase';
  SELECT COLUMN_NAME, DATA_TYPE FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'product_purchase';
  ```
- **Expected Result**: Table exists with columns: product_purchase_id, user_id, set_id, product_type, product_name, purchase_date, quantity, total_cost, cost_per_unit, estimated_cards, source, notes, created, updated

### 2025-12-04: Product Type Table for Seller Admin
- **Date**: 2025-12-04
- **Change Type**: Schema (CREATE TABLE)
- **Description**:
  - Created `product_type` table to store user-specific product types
  - Allows users to customize dropdown options for product purchases (hobby box, retail blaster, etc.)
  - Includes slug for API compatibility, display_order for sorting, is_active for soft delete
  - Falls back to hardcoded defaults if user has no custom product types
- **Tables Affected**: `product_type` (new)
- **SQL File Reference**: DATABASE_CHANGES_FOR_PRODUCTION.sql
- **Status**: Pending
- **Verification Query**:
  ```sql
  SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'product_type';
  SELECT COLUMN_NAME, DATA_TYPE FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'product_type';
  ```
- **Expected Result**: Table exists with columns: product_type_id, user_id, name, slug, description, is_active, display_order, created

### 2025-12-07: Admin Set View Tracking Table
- **Date**: 2025-12-07
- **Change Type**: Schema (CREATE TABLE)
- **Description**:
  - Created `admin_set_view` table to track recently viewed sets in admin interface
  - Allows admin pages to show "Recently Viewed" sets instead of always showing by created date
  - Tracks user_id, set_id, last_viewed timestamp, and view_count
  - MERGE statement in admin-sets.js upserts records on each set view
  - Unique constraint on (user_id, set_id) prevents duplicates
  - Cascade deletes when user or set is deleted
- **Tables Affected**: `admin_set_view` (new)
- **SQL File Reference**: DATABASE_CHANGES_FOR_PRODUCTION.sql
- **Status**: Pending
- **Verification Query**:
  ```sql
  SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'admin_set_view';
  SELECT COLUMN_NAME, DATA_TYPE FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'admin_set_view';
  ```
- **Expected Result**: Table exists with columns: admin_set_view_id (BIGINT), user_id (BIGINT), set_id (INT), last_viewed (DATETIME2), view_count (INT)

### 2025-12-07: Player Team Card Count Column for Performance
- **Date**: 2025-12-07
- **Change Type**: Schema (ALTER TABLE + DATA UPDATE + INDEX)
- **Description**:
  - Added `card_count` column to `player_team` table
  - Pre-computes the number of cards per player_team instead of COUNT query at runtime
  - **CRITICAL PERFORMANCE FIX**: Players list API was taking 29 seconds in production
  - After fix: Query reduced from 4 table joins + COUNT to simple column read
  - Index added on card_count for faster sorting
  - **NOTE**: This value needs to be kept in sync when cards are added/removed
- **Tables Affected**: `player_team`
- **SQL File Reference**: DATABASE_CHANGES_FOR_PRODUCTION.sql (lines 53-85)
- **Status**: Pending
- **Verification Query**:
  ```sql
  SELECT COLUMN_NAME, DATA_TYPE, IS_NULLABLE
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_NAME = 'player_team' AND COLUMN_NAME = 'card_count';

  SELECT COUNT(*) as total, SUM(card_count) as total_cards
  FROM player_team;
  ```
- **Expected Result**:
  - Column exists as INT NOT NULL
  - Total card_count should match count from card_player_team table

---

## Notes

- Always test changes in development before applying to production
- Document all changes immediately when made
- Update status after applying to production
- Include rollback procedures for complex changes

### 2025-12-09: User Feedback System Tables
- **Date**: 2025-12-09
- **Change Type**: Schema (CREATE TABLE)
- **Description**:
  - Created `feedback_submission` table for user feedback storage
  - Created `feedback_response` table for admin responses
  - Tables support bug reports, feature requests, and general feedback
  - Integration with GitHub issues for tracking
  - Email notifications to users on submission and status updates
- **Tables Affected**: `feedback_submission`, `feedback_response`
- **SQL File Reference**: DATABASE_CHANGES_FOR_PRODUCTION.sql (see feedback system section)
- **Status**: Pending
- **Verification Query**:
  ```sql
  SELECT TABLE_NAME 
  FROM INFORMATION_SCHEMA.TABLES 
  WHERE TABLE_NAME IN ('feedback_submission', 'feedback_response');
  ```
- **Expected Result**: Both tables exist

### 2025-12-21: Campaign Visit Tracking Table for QR Code Marketing
- **Date**: 2025-12-21
- **Change Type**: Schema (CREATE TABLE)
- **Description**:
  - Created `campaign_visit` table to track QR code marketing campaign conversions
  - Tracks: page visits, signups, and first card additions
  - Used for /start landing page (print mailer QR code campaign)
  - Links to user table to track full conversion funnel
  - Session-based tracking to prevent duplicate visit counts
- **Tables Affected**: `campaign_visit` (new)
- **Columns**:
  - `visit_id` (BIGINT, PK) - Unique visit identifier
  - `campaign_code` (VARCHAR(50)) - Campaign identifier (e.g., 'print-mailer-2025')
  - `session_id` (VARCHAR(64)) - Client session ID for deduplication
  - `user_id` (BIGINT, nullable, FK) - Links to user if they signed up
  - `ip_address` (VARCHAR(45)) - Visitor IP
  - `user_agent` (VARCHAR(500)) - Browser info
  - `referrer` (NVARCHAR(500)) - Referring URL
  - `visited_at` (DATETIME) - Initial visit timestamp
  - `signed_up_at` (DATETIME, nullable) - When user created account
  - `first_card_at` (DATETIME, nullable) - When user added first card
- **Indexes**:
  - `IX_campaign_visit_campaign` - For filtering by campaign
  - `IX_campaign_visit_session` - For session deduplication
  - `IX_campaign_visit_user` - For user lookup
  - `IX_campaign_visit_date` - For date range queries
- **Status**: ✅ Applied via Prisma db push
- **Verification Query**:
  ```sql
  SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'campaign_visit';
  SELECT COLUMN_NAME, DATA_TYPE FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'campaign_visit';
  ```
- **Expected Result**: Table exists with all columns listed above

### 2025-12-31: Crowdsourcing Card Edit Submissions System
- **Date**: 2025-12-31
- **Change Type**: Schema (CREATE TABLE)
- **Description**:
  - Created `card_edit_submissions` table for user-submitted card edits
  - Users can propose changes to card metadata (card_number, is_rookie, is_autograph, is_relic, is_short_print, print_run, notes)
  - Submissions go through pending → approved/rejected workflow
  - Includes reviewer tracking and submission notes
  - Created `contributor_stats` table to track user contribution statistics
  - Tracks total/pending/approved/rejected submissions, approval rate, trust level, and streak data
- **Tables Created**:
  - `card_edit_submissions` - Proposed card edits awaiting review
  - `contributor_stats` - User contribution statistics and trust levels
- **Indexes Created**:
  - `IX_card_edit_submissions_user` - Filter by submitting user
  - `IX_card_edit_submissions_card` - Filter by card being edited
  - `IX_card_edit_submissions_status` - Filter by submission status
  - `IX_card_edit_submissions_created` - Sort by creation date
- **SQL File Reference**: DATABASE_CHANGES_FOR_PRODUCTION.sql (see Crowdsourcing section)
- **Status**: Pending Production
- **Verification Query**:
  ```sql
  SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES 
  WHERE TABLE_NAME IN ('card_edit_submissions', 'contributor_stats');
  ```
- **Expected Result**: Both tables exist

### 2025-12-31: Crowdsourcing Achievement Category and 119 Achievements
- **Date**: 2025-12-31
- **Change Type**: Data (INSERT)
- **Description**:
  - Created new achievement category 'Crowdsourcing' (category_id: 20002)
  - Moved 76 existing crowdsourcing-related achievements to this category
  - Added 43 new crowdsourcing achievements covering:
    - Approval progression (CS: First Success through CS: Five Hundred Approved)
    - Streak achievements (CS: Weekday Worker through CS: Half Year Hero)
    - Card type specialties (RC, Auto, Relic, SP, Print Run edits)
    - Trust level progression
    - Approval rate achievements (80%, 90%, 95%, 100% clubs)
    - Daily volume achievements
  - Total: 119 crowdsourcing achievements
- **Tables Affected**: `achievement_categories`, `achievements`
- **Status**: Pending Production
- **Verification Query**:
  ```sql
  SELECT COUNT(*) FROM achievements WHERE category_id = 20002;
  SELECT * FROM achievement_categories WHERE name = 'Crowdsourcing';
  ```
- **Expected Result**: 119 achievements, 1 category

### 2026-01-08: Unified Interface & Audit History - Issue #88
- **Date**: 2026-01-08
- **Change Type**: Schema (ALTER TABLE, CREATE TABLE)
- **Description**:
  - Phase 1 of unified interface implementation for Issue #88
  - Added `previous_*` columns to existing submission tables for change tracking
  - Added `batch_id` columns for grouping related submissions (imports)
  - Created new `player_edit_submissions` table
  - Created new `team_edit_submissions` table
  - Updated `contributor_stats` with new submission type counters
- **Tables Modified**:
  - `card_edit_submissions` - Added: previous_card_number, previous_is_rookie, previous_is_autograph, previous_is_relic, previous_is_short_print, previous_print_run, previous_notes, batch_id
  - `set_submissions` - Added: set_id (for edit tracking), previous_name, previous_year, previous_sport, previous_manufacturer, previous_description, batch_id
  - `series_submissions` - Added: existing_series_id (for edit tracking), previous_name, previous_description, previous_base_card_count, previous_is_parallel, previous_parallel_name, previous_print_run, previous_parallel_of_series, batch_id
  - `contributor_stats` - Added: player_edit_submissions, team_edit_submissions
- **Tables Created**:
  - `player_edit_submissions` - For tracking edits to player data (first_name, last_name, nick_name, birthdate, is_hof)
  - `team_edit_submissions` - For tracking edits to team data (name, city, mascot, abbreviation, primary_color, secondary_color)
- **Indexes Created**:
  - `IX_card_edit_submissions_batch_id`
  - `IX_set_submissions_batch_id`
  - `IX_series_submissions_batch_id`
  - `IX_player_edit_submissions_player`, `IX_player_edit_submissions_user`, `IX_player_edit_submissions_status`, `IX_player_edit_submissions_batch_id`, `IX_player_edit_submissions_created`
  - `IX_team_edit_submissions_team`, `IX_team_edit_submissions_user`, `IX_team_edit_submissions_status`, `IX_team_edit_submissions_batch_id`, `IX_team_edit_submissions_created`
- **Foreign Keys Added**:
  - `FK_set_submissions_set` - Links set_submissions.set_id to set.set_id
  - `FK_series_submissions_existing_series` - Links series_submissions.existing_series_id to series.series_id
  - `FK_player_edit_submissions_player`, `FK_player_edit_submissions_user`, `FK_player_edit_submissions_reviewer`
  - `FK_team_edit_submissions_team`, `FK_team_edit_submissions_user`, `FK_team_edit_submissions_reviewer`
- **SQL File Reference**: DATABASE_CHANGES_FOR_PRODUCTION.sql (Issue #88 section)
- **Status**: Pending Production
- **Purpose**:
  - Enable complete audit history for all entity changes
  - Track what values changed FROM (previous_*) and TO (proposed_*)
  - Support batch tracking for bulk imports
  - Enable unified interface where all users can edit (admin = auto-approve, user = pending review)
- **Verification Queries**:
  ```sql
  -- Check card_edit_submissions columns
  SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_NAME = 'card_edit_submissions'
  AND (COLUMN_NAME LIKE 'previous_%' OR COLUMN_NAME = 'batch_id');

  -- Check new tables exist
  SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES
  WHERE TABLE_NAME IN ('player_edit_submissions', 'team_edit_submissions');

  -- Check contributor_stats columns
  SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_NAME = 'contributor_stats'
  AND COLUMN_NAME IN ('player_edit_submissions', 'team_edit_submissions');
  ```
- **Expected Results**:
  - card_edit_submissions: 8 new columns (7 previous_* + batch_id)
  - 2 new tables: player_edit_submissions (21 cols), team_edit_submissions (23 cols)
  - contributor_stats: 2 new columns

### 2026-01-09: Player Crowdsourcing Tables
- **Date**: 2026-01-09
- **Change Type**: Schema (Tables + Columns)
- **Description**:
  - Created `player_alias_submissions` table for crowdsourcing player aliases/alternate names
  - Created `player_team_submissions` table for crowdsourcing player-team associations (add/remove)
  - Added `player_alias_submissions` and `player_team_submissions` counter columns to `contributor_stats`
  - These tables support user-suggested changes that go through admin review
- **Tables Created**:
  - `player_alias_submissions` - For suggesting aliases (misspellings, nicknames, etc.)
  - `player_team_submissions` - For suggesting add/remove team associations
- **Columns Added**:
  - `contributor_stats.player_alias_submissions` (INT, default 0)
  - `contributor_stats.player_team_submissions` (INT, default 0)
- **SQL File Reference**: DATABASE_CHANGES_FOR_PRODUCTION.sql (lines 17-117)
- **Status**: ✅ Applied to Development
- **Verification Queries**:
  ```sql
  -- Check new tables exist
  SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES
  WHERE TABLE_NAME IN ('player_alias_submissions', 'player_team_submissions');

  -- Check contributor_stats columns
  SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_NAME = 'contributor_stats'
  AND COLUMN_NAME IN ('player_alias_submissions', 'player_team_submissions');
  ```
- **Expected Results**:
  - 2 new tables: player_alias_submissions, player_team_submissions
  - contributor_stats: 2 new columns

### 2026-01-14: New Player Submissions Table
- **Date**: 2026-01-14
- **Change Type**: Schema (Table + Column)
- **Description**:
  - Created `player_submissions` table for crowdsourcing new player additions to the database
  - Added `player_submissions` counter column to `contributor_stats`
  - Supports user-suggested new players that go through admin review
  - Admins can directly create players (auto-approved)
  - Non-admins submit for review
  - Supports pre-selecting teams to associate with the new player
- **Tables Created**:
  - `player_submissions` - For suggesting new players to add to the database
    - `submission_id` BIGINT (PK)
    - `user_id` BIGINT (FK to user)
    - `proposed_first_name`, `proposed_last_name` NVARCHAR(MAX)
    - `proposed_nick_name`, `proposed_birthdate`, `proposed_is_hof`
    - `proposed_team_ids` NVARCHAR(MAX) - JSON array of team IDs
    - `submission_notes`, `status`, `batch_id`
    - `created_player_id` BIGINT (FK to player, set when approved)
    - `reviewed_by`, `reviewed_at`, `review_notes`
    - `created_at`, `updated_at`
- **Columns Added**:
  - `contributor_stats.player_submissions` (INT, default 0)
- **SQL Script**:
  ```sql
  -- Create player_submissions table
  CREATE TABLE player_submissions (
      submission_id BIGINT IDENTITY(1,1) PRIMARY KEY,
      user_id BIGINT NOT NULL,
      proposed_first_name NVARCHAR(MAX) NOT NULL,
      proposed_last_name NVARCHAR(MAX) NOT NULL,
      proposed_nick_name NVARCHAR(MAX) NULL,
      proposed_birthdate DATETIME NULL,
      proposed_is_hof BIT DEFAULT 0,
      proposed_team_ids NVARCHAR(MAX) NULL,
      submission_notes NVARCHAR(MAX) NULL,
      status NVARCHAR(20) DEFAULT 'pending',
      batch_id NVARCHAR(100) NULL,
      created_player_id BIGINT NULL,
      reviewed_by BIGINT NULL,
      reviewed_at DATETIME NULL,
      review_notes NVARCHAR(MAX) NULL,
      created_at DATETIME DEFAULT GETDATE(),
      updated_at DATETIME NULL,
      CONSTRAINT FK_player_submissions_user FOREIGN KEY (user_id) REFERENCES [user](user_id),
      CONSTRAINT FK_player_submissions_reviewer FOREIGN KEY (reviewed_by) REFERENCES [user](user_id),
      CONSTRAINT FK_player_submissions_player FOREIGN KEY (created_player_id) REFERENCES player(player_id)
  );

  CREATE INDEX IX_player_submissions_user ON player_submissions(user_id);
  CREATE INDEX IX_player_submissions_status ON player_submissions(status);
  CREATE INDEX IX_player_submissions_created ON player_submissions(created_at DESC);

  -- Add column to contributor_stats
  ALTER TABLE contributor_stats ADD player_submissions INT DEFAULT 0;
  ```
- **Status**: ⏳ Pending Production
- **Verification Queries**:
  ```sql
  -- Check new table exists
  SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES
  WHERE TABLE_NAME = 'player_submissions';

  -- Check contributor_stats column
  SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_NAME = 'contributor_stats'
  AND COLUMN_NAME = 'player_submissions';
  ```
- **Expected Results**:
  - 1 new table: player_submissions
  - contributor_stats: 1 new column (player_submissions)

---

### 2026-01-15: Provisional Card System - User-Centric Card Submission
- **Date**: 2026-01-15
- **Change Type**: Schema (New Tables + ALTER TABLE)
- **Description**:
  - Implements "Users submit cards, system resolves entities" approach
  - Users can add cards using text descriptions (player name, set name, etc.)
  - System auto-matches against existing entities with confidence scores
  - Cards appear in user's collection immediately as "provisional" until approved
  - Supports multi-player cards using "/" syntax (e.g., "Mike Trout / Aaron Judge")
  - Admin review shows diff view comparing proposed vs existing entities
- **New Tables**:
  1. `suggestion_bundle` - Groups multiple card submissions from a single session
  2. `provisional_card` - Card data with soft (text) references
  3. `provisional_card_player` - Players on provisional cards (supports multi-player)
- **Tables Modified**:
  - `user_card` - Added `is_provisional` (BIT) and `provisional_card_id` (BIGINT FK)
  - `contributor_stats` - Added `bundle_submissions`, `provisional_cards_submitted`, `provisional_cards_resolved`
- **New API Endpoints**:
  - `POST /api/crowdsource/provisional-card` - Submit cards with auto-resolution
  - `GET /api/crowdsource/my-provisional-cards` - Get user's provisional cards
  - `GET /api/crowdsource/my-bundles` - Get user's submission bundles
- **Key Features**:
  - Auto-resolution matches sets, series, players, teams, colors
  - Confidence scores (0.00-1.00) indicate match quality
  - Cards flagged as `needs_review` when auto-resolution fails
  - Multi-player parsing supports "/" and "," separators
- **SQL File Reference**: DATABASE_CHANGES_FOR_PRODUCTION.sql (Provisional Card System section)
- **Status**: ⏳ Pending Production
- **Verification Queries**:
  ```sql
  -- Check new tables exist
  SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES
  WHERE TABLE_NAME IN ('suggestion_bundle', 'provisional_card', 'provisional_card_player');

  -- Check user_card modifications
  SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_NAME = 'user_card'
  AND COLUMN_NAME IN ('is_provisional', 'provisional_card_id');

  -- Check contributor_stats columns
  SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_NAME = 'contributor_stats'
  AND COLUMN_NAME IN ('bundle_submissions', 'provisional_cards_submitted', 'provisional_cards_resolved');
  ```
- **Expected Results**:
  - 3 new tables: suggestion_bundle, provisional_card, provisional_card_player
  - user_card: 2 new columns (is_provisional, provisional_card_id)
  - contributor_stats: 3 new columns

---

### 2026-01-19: External Pricing System (SportsCardsPro Integration)
- **Date**: 2026-01-19
- **Change Type**: Schema (New Tables + Seed Data)
- **Description**:
  - Implements external pricing data integration system (GitHub Issue #94)
  - Supports multiple price sources (starting with SportsCardsPro)
  - Supports multiple price types (raw/loose, PSA 10, BGS 9.5, etc.)
  - Maps our cards to external product IDs for 1:1 matching
  - Designed for weekly batch price updates via API
- **New Tables**:
  1. `price_source` - External pricing APIs/sources (SportsCardsPro, etc.)
  2. `price_type` - Types of prices (loose, PSA 10, BGS 9.5, etc.)
  3. `card_external_id` - Maps our card_id to external product IDs
  4. `card_price` - Actual price data per card/type/source
- **Seed Data**:
  - 1 price source: SportsCardsPro
  - 18 price types: loose, graded, PSA 10/9/8/7, BGS 10/9.5/9/8.5/8, CGC 10/9.5/9/8.5, SGC 10/9.5/9
- **Key Features**:
  - Unique constraint on (card_id, price_source_id) for external IDs
  - Unique constraint on (card_id, price_type_id, price_source_id) for prices
  - Index on external_id lookup for efficient API-driven updates
  - Supports manual vs auto matching via `match_method` field
- **SQL File Reference**: DATABASE_CHANGES_FOR_PRODUCTION.sql (PRICING SYSTEM section, lines 212-338)
- **Status**: ⏳ Pending Production
- **Verification Queries**:
  ```sql
  -- Check new tables exist
  SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES
  WHERE TABLE_NAME IN ('price_source', 'price_type', 'card_external_id', 'card_price');

  -- Check seed data
  SELECT COUNT(*) as sources FROM price_source;
  SELECT COUNT(*) as types FROM price_type;
  ```
- **Expected Results**:
  - 4 new tables: price_source, price_type, card_external_id, card_price
  - 1 price source (SportsCardsPro)
  - 18 price types
