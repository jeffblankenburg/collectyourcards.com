# Schema Synchronization Script - Usage Guide

## Overview

`SCHEMA_SYNC_PRODUCTION.sql` is an idempotent SQL script designed to synchronize the production database schema with the development database schema. This script safely adds missing columns, foreign keys, and indexes without affecting existing data.

## Purpose

This script addresses **GitHub Issue #16: SQL Schema Creep** - the problem where development database schemas diverge from production over time, causing runtime errors in production.

## What This Script Does

### ✅ Adds Missing Columns
- `card.reference_user_card` - Links cards to canonical community-uploaded images
- `card.created_month` - For analytics and date-based queries
- `card.card_number_indexed` - Optimized column for card number searches
- `player.display_card` - Links players to their display card image
- `player.slug` - URL-friendly player identifier
- `series.slug` - URL-friendly series identifier
- `series.rookie_count` - Count of rookie cards in series
- `series.production_code` - Manufacturing/production code
- `set.slug` - URL-friendly set identifier
- `team.slug` - URL-friendly team identifier
- **User profile fields**: `username`, `bio`, `avatar_url`, `is_public_profile`, `website`, `user_location`, `profile_completed`
- **User moderation fields**: `is_muted`, `muted_at`, `muted_by`
- `user_session.token_hash` - Hashed session token for security

### ✅ Adds Missing Foreign Keys
- `FK_card_reference_user_card` - Enforces referential integrity for card → user_card
- `FK_player_display_card` - Enforces referential integrity for player → card
- `FK_user_muted_by` - Enforces referential integrity for user → user (self-reference)

### ✅ Adds Missing Indexes
- Performance indexes for all new foreign key columns
- Unique indexes for slug columns (player, series, set, team)
- Unique index for usernames
- Index for muted user lookups

### ❌ Does NOT Do
- Delete any data
- Modify existing columns
- Drop any tables or constraints
- Create new tables (only modifies existing tables)
- Add eBay-related columns (deferred until eBay integration is production-ready)

## Safety Features

### Idempotent Design
Every operation checks for existence before executing:
```sql
IF NOT EXISTS (
    SELECT 1 FROM sys.columns
    WHERE object_id = OBJECT_ID('table_name')
    AND name = 'column_name'
)
BEGIN
    -- Only runs if column doesn't exist
    ALTER TABLE table_name ADD column_name TYPE NULL;
END
```

This means:
- ✅ Safe to run multiple times
- ✅ Won't fail if columns already exist
- ✅ Won't duplicate indexes or foreign keys
- ✅ Can be re-run after partial failures

### Detailed Logging
The script outputs clear status messages:
- `[+]` - Adding a new element
- `[✓]` - Element already exists (skipped)
- `[!]` - Element skipped due to missing dependency
- `SUCCESS` - Operation completed successfully
- `WARNING` - Important note about the change

### Verification Section
After all changes, the script verifies critical columns were added successfully and reports any that are still missing.

## Prerequisites

Before running this script:

1. **Backup the database** (even though this script is safe, always backup)
2. **Maintenance window recommended** - While the script is fast, it's best run during low-traffic periods
3. **Required permissions**: User must have `ALTER TABLE`, `CREATE INDEX` permissions
4. **Database version**: SQL Server 2016 or later (uses `sys.columns`, `sys.foreign_keys`, `sys.indexes`)

## How to Run

### Option 1: Azure Data Studio / SQL Server Management Studio (Recommended)

1. Open Azure Data Studio or SSMS
2. Connect to the **production database**
3. Open `SCHEMA_SYNC_PRODUCTION.sql`
4. **Verify you're connected to the correct database** (check the connection status)
5. Click "Run" or press F5
6. Monitor the Messages tab for detailed output
7. Review the verification section at the end

### Option 2: sqlcmd Command Line

```bash
# From the database-scripts directory
sqlcmd -S <server> -d <database> -U <username> -P <password> -i SCHEMA_SYNC_PRODUCTION.sql -o sync_output.log

# Example for local SQL Server
sqlcmd -S localhost,1433 -d CollectYourCards -U sa -P Password123 -i SCHEMA_SYNC_PRODUCTION.sql -o sync_output.log
```

### Option 3: Docker (for local SQL Server container)

```bash
# Copy script into container
docker cp SCHEMA_SYNC_PRODUCTION.sql collect-cards-db:/tmp/

# Execute script
docker exec -it collect-cards-db /opt/mssql-tools/bin/sqlcmd \
  -S localhost -U sa -P Password123 -d CollectYourCards \
  -i /tmp/SCHEMA_SYNC_PRODUCTION.sql
```

## Expected Output

### Successful Run Example:

```
===================================================================
SCHEMA SYNCHRONIZATION SCRIPT
Started: 2025-01-10 14:23:45
===================================================================

SECTION 1: Checking for missing columns...

  [+] Adding column: card.reference_user_card
      SUCCESS: Column added
  [✓] Column exists: card.created_month
  [+] Adding column: player.slug
      SUCCESS: Column added
      WARNING: Slug column added with empty default. You may need to populate slugs.
  ...

SECTION 2: Checking for missing foreign keys...

  [+] Adding foreign key: FK_card_reference_user_card
      SUCCESS: Foreign key added
  [✓] Foreign key exists: FK_player_display_card
  ...

SECTION 3: Checking for missing indexes...

  [+] Creating unique index: idx_player_slug
      SUCCESS: Index created
  [✓] Index exists: IX_card_reference_user_card
  ...

SECTION 4: Schema verification...

  [✓] All critical columns are present

===================================================================
SCHEMA SYNCHRONIZATION COMPLETE
Finished: 2025-01-10 14:24:12
===================================================================

IMPORTANT NOTES:
1. Slug columns were added with empty defaults - you may need to populate them
2. Run DBCC CHECKDB to verify database integrity
3. Update application statistics: UPDATE STATISTICS
4. Consider rebuilding indexes for optimal performance

Next steps:
- Review any SKIPPED items above
- Test application functionality
- Monitor for any errors in application logs
```

## Post-Run Actions

### 1. Verify Success

Check that no critical columns are missing:
```sql
-- Should return no rows if all critical columns exist
SELECT * FROM (
    SELECT 'card' as [table], 'reference_user_card' as [column]
    WHERE NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('card') AND name = 'reference_user_card')
    UNION ALL
    SELECT 'player', 'display_card'
    WHERE NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('player') AND name = 'display_card')
    UNION ALL
    SELECT 'player', 'slug'
    WHERE NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('player') AND name = 'slug')
) missing
```

### 2. Populate Slug Columns (CRITICAL)

Slug columns are added with empty defaults and need to be populated:

**See**: `populate-slugs.sql` (companion script) for slug generation queries

**Or run these queries**:

```sql
-- Populate player slugs
UPDATE player
SET slug = LOWER(
    REPLACE(
        REPLACE(
            REPLACE(
                TRIM(CONCAT(ISNULL(first_name, ''), '-', ISNULL(last_name, ''))),
                ' ', '-'
            ),
            '--', '-'
        ),
        '''', ''
    )
)
WHERE slug = '' OR slug IS NULL;

-- Populate team slugs (example)
UPDATE team
SET slug = LOWER(
    REPLACE(
        REPLACE(name, ' ', '-'),
        '''', ''
    )
)
WHERE slug = '' OR slug IS NULL;

-- Similar for series and set slugs...
```

### 3. Update Statistics

```sql
UPDATE STATISTICS;
```

### 4. Verify Database Integrity

```sql
DBCC CHECKDB;
```

### 5. Test Application

- Restart application servers to ensure they pick up schema changes
- Test critical features:
  - Admin cards community images (uses `reference_user_card`)
  - Player card display (uses `display_card`)
  - URL routing with slugs
  - User profiles (uses new user columns)
- Monitor application logs for errors

### 6. Monitor Performance

After adding indexes, monitor query performance:
```sql
-- Check index usage
SELECT
    i.name AS IndexName,
    s.user_seeks,
    s.user_scans,
    s.user_lookups,
    s.user_updates
FROM sys.indexes i
LEFT JOIN sys.dm_db_index_usage_stats s ON i.object_id = s.object_id AND i.index_id = s.index_id
WHERE i.object_id = OBJECT_ID('card')
ORDER BY s.user_seeks DESC;
```

## Troubleshooting

### Problem: "Invalid object name 'table_name'"
**Solution**: The table doesn't exist in production. This script only adds columns to existing tables. Create the table first.

### Problem: Foreign key constraint fails
**Solution**: There may be orphaned data. Check for references to non-existent records:
```sql
-- Example: Check for invalid reference_user_card values
SELECT card_id, reference_user_card
FROM card
WHERE reference_user_card IS NOT NULL
AND reference_user_card NOT IN (SELECT user_card_id FROM user_card);
```

### Problem: Unique index creation fails (duplicate slugs)
**Solution**: Clean up duplicate slugs before running the script:
```sql
-- Find duplicate slugs
SELECT slug, COUNT(*)
FROM player
WHERE slug != ''
GROUP BY slug
HAVING COUNT(*) > 1;

-- Fix by appending player_id to duplicates
UPDATE player
SET slug = slug + '-' + CAST(player_id AS VARCHAR)
WHERE slug IN (
    SELECT slug FROM player WHERE slug != '' GROUP BY slug HAVING COUNT(*) > 1
);
```

### Problem: Script hangs or takes too long
**Solution**: The script should complete in under 1 minute. If it hangs:
- Check for blocking queries: `sp_who2`
- Verify no other schema changes are in progress
- Consider running during maintenance window

## Related Files

- `DATABASE_CHANGES_FOR_PRODUCTION.sql` - Original manual change scripts
- `PRODUCTION_CHANGES_NEEDED.md` - Tracking document for production changes
- `DATABASE_CHANGE_TRACKING.md` - Complete change log
- `populate-slugs.sql` - Companion script to populate slug columns (create as needed)

## Rollback

If you need to rollback changes (not recommended, but possible):

⚠️ **WARNING**: Rollback may cause application errors if code depends on new columns

```sql
-- Example: Remove a column (DANGEROUS - can lose data)
ALTER TABLE card DROP COLUMN reference_user_card;

-- Example: Remove an index (safer)
DROP INDEX IX_card_reference_user_card ON card;

-- Example: Remove a foreign key (safer)
ALTER TABLE card DROP CONSTRAINT FK_card_reference_user_card;
```

**Better approach**: Instead of rollback, fix forward by:
1. Identifying the specific issue
2. Modifying the script to skip that operation
3. Re-running the script (it's idempotent)

## Maintenance

### When to Re-run This Script

- After pulling new code that adds database migrations
- When production errors indicate missing columns
- As part of regular production deployment checklist
- After database restore from development backup

### Updating This Script

When new columns are added to development:

1. Add the column check to SECTION 1
2. Add any foreign keys to SECTION 2
3. Add any indexes to SECTION 3
4. Add verification to SECTION 4
5. Update this README with the new columns

## Script Statistics

- **Total Lines**: 663
- **Columns Added**: 22
- **Foreign Keys Added**: 3
- **Indexes Added**: 10
- **Estimated Runtime**: 15-45 seconds (depending on database size)
- **Estimated Disk Impact**: Minimal (<100MB for indexes on large databases)

## Change History

| Date       | Changes Made                                      | Issue |
|------------|---------------------------------------------------|-------|
| 2025-01-10 | Initial script creation with all missing columns  | #16   |

## Questions?

If you encounter issues:
1. Check the Messages output from the script
2. Review the Troubleshooting section above
3. Check application logs for specific errors
4. Verify prerequisites are met

---

**Last Updated**: 2025-01-10
**Script Version**: 1.0
**Tested On**: SQL Server 2022
**Database**: CollectYourCards Production
