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

## Notes

- Always test changes in development before applying to production
- Document all changes immediately when made
- Update status after applying to production
- Include rollback procedures for complex changes
