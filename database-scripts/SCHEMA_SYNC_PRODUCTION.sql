-- ============================================================================
-- SCHEMA SYNCHRONIZATION SCRIPT FOR PRODUCTION
-- ============================================================================
-- Purpose: Synchronize production database schema with development schema
-- Safety: This script is idempotent - it checks for existence before creating
-- Usage: Run this script on production database to add missing schema elements
--
-- Generated: 2025-01-10
-- Issue: GitHub #16 - SQL Schema Creep
-- ============================================================================

PRINT '==================================================================='
PRINT 'SCHEMA SYNCHRONIZATION SCRIPT'
PRINT 'Started: ' + CONVERT(VARCHAR, GETDATE(), 120)
PRINT '==================================================================='
PRINT ''

-- ============================================================================
-- SECTION 1: ADD MISSING COLUMNS TO EXISTING TABLES
-- ============================================================================
PRINT 'SECTION 1: Checking for missing columns...'
PRINT ''

-- card.reference_user_card
IF NOT EXISTS (
    SELECT 1 FROM sys.columns
    WHERE object_id = OBJECT_ID('card')
    AND name = 'reference_user_card'
)
BEGIN
    PRINT '  [+] Adding column: card.reference_user_card'
    ALTER TABLE card ADD reference_user_card BIGINT NULL;
    PRINT '      SUCCESS: Column added'
END
ELSE
    PRINT '  [✓] Column exists: card.reference_user_card'

-- card.created_month
IF NOT EXISTS (
    SELECT 1 FROM sys.columns
    WHERE object_id = OBJECT_ID('card')
    AND name = 'created_month'
)
BEGIN
    PRINT '  [+] Adding column: card.created_month'
    ALTER TABLE card ADD created_month DATE NULL;
    PRINT '      SUCCESS: Column added'
END
ELSE
    PRINT '  [✓] Column exists: card.created_month'

-- card.card_number_indexed
IF NOT EXISTS (
    SELECT 1 FROM sys.columns
    WHERE object_id = OBJECT_ID('card')
    AND name = 'card_number_indexed'
)
BEGIN
    PRINT '  [+] Adding column: card.card_number_indexed'
    ALTER TABLE card ADD card_number_indexed NVARCHAR(100) NULL;
    PRINT '      SUCCESS: Column added'
END
ELSE
    PRINT '  [✓] Column exists: card.card_number_indexed'

-- player.display_card
IF NOT EXISTS (
    SELECT 1 FROM sys.columns
    WHERE object_id = OBJECT_ID('player')
    AND name = 'display_card'
)
BEGIN
    PRINT '  [+] Adding column: player.display_card'
    ALTER TABLE player ADD display_card BIGINT NULL;
    PRINT '      SUCCESS: Column added'
END
ELSE
    PRINT '  [✓] Column exists: player.display_card'

-- player.slug
IF NOT EXISTS (
    SELECT 1 FROM sys.columns
    WHERE object_id = OBJECT_ID('player')
    AND name = 'slug'
)
BEGIN
    PRINT '  [+] Adding column: player.slug'
    ALTER TABLE player ADD slug NVARCHAR(255) NOT NULL DEFAULT '';
    PRINT '      SUCCESS: Column added'
    PRINT '      WARNING: Slug column added with empty default. You may need to populate slugs.'
END
ELSE
    PRINT '  [✓] Column exists: player.slug'

-- series.slug
IF NOT EXISTS (
    SELECT 1 FROM sys.columns
    WHERE object_id = OBJECT_ID('series')
    AND name = 'slug'
)
BEGIN
    PRINT '  [+] Adding column: series.slug'
    ALTER TABLE series ADD slug NVARCHAR(255) NOT NULL DEFAULT '';
    PRINT '      SUCCESS: Column added'
    PRINT '      WARNING: Slug column added with empty default. You may need to populate slugs.'
END
ELSE
    PRINT '  [✓] Column exists: series.slug'

-- series.rookie_count
IF NOT EXISTS (
    SELECT 1 FROM sys.columns
    WHERE object_id = OBJECT_ID('series')
    AND name = 'rookie_count'
)
BEGIN
    PRINT '  [+] Adding column: series.rookie_count'
    ALTER TABLE series ADD rookie_count INT NULL DEFAULT 0;
    PRINT '      SUCCESS: Column added'
END
ELSE
    PRINT '  [✓] Column exists: series.rookie_count'

-- series.production_code
IF NOT EXISTS (
    SELECT 1 FROM sys.columns
    WHERE object_id = OBJECT_ID('series')
    AND name = 'production_code'
)
BEGIN
    PRINT '  [+] Adding column: series.production_code'
    ALTER TABLE series ADD production_code VARCHAR(50) NULL;
    PRINT '      SUCCESS: Column added'
END
ELSE
    PRINT '  [✓] Column exists: series.production_code'

-- set.slug
IF NOT EXISTS (
    SELECT 1 FROM sys.columns
    WHERE object_id = OBJECT_ID('[set]')
    AND name = 'slug'
)
BEGIN
    PRINT '  [+] Adding column: set.slug'
    ALTER TABLE [set] ADD slug NVARCHAR(255) NOT NULL DEFAULT '';
    PRINT '      SUCCESS: Column added'
    PRINT '      WARNING: Slug column added with empty default. You may need to populate slugs.'
END
ELSE
    PRINT '  [✓] Column exists: set.slug'

-- team.slug
IF NOT EXISTS (
    SELECT 1 FROM sys.columns
    WHERE object_id = OBJECT_ID('team')
    AND name = 'slug'
)
BEGIN
    PRINT '  [+] Adding column: team.slug'
    ALTER TABLE team ADD slug NVARCHAR(255) NOT NULL DEFAULT '';
    PRINT '      SUCCESS: Column added'
    PRINT '      WARNING: Slug column added with empty default. You may need to populate slugs.'
END
ELSE
    PRINT '  [✓] Column exists: team.slug'

-- user.username
IF NOT EXISTS (
    SELECT 1 FROM sys.columns
    WHERE object_id = OBJECT_ID('[user]')
    AND name = 'username'
)
BEGIN
    PRINT '  [+] Adding column: user.username'
    ALTER TABLE [user] ADD username NVARCHAR(50) NULL;
    PRINT '      SUCCESS: Column added'
END
ELSE
    PRINT '  [✓] Column exists: user.username'

-- user.bio
IF NOT EXISTS (
    SELECT 1 FROM sys.columns
    WHERE object_id = OBJECT_ID('[user]')
    AND name = 'bio'
)
BEGIN
    PRINT '  [+] Adding column: user.bio'
    ALTER TABLE [user] ADD bio NVARCHAR(500) NULL;
    PRINT '      SUCCESS: Column added'
END
ELSE
    PRINT '  [✓] Column exists: user.bio'

-- user.avatar_url
IF NOT EXISTS (
    SELECT 1 FROM sys.columns
    WHERE object_id = OBJECT_ID('[user]')
    AND name = 'avatar_url'
)
BEGIN
    PRINT '  [+] Adding column: user.avatar_url'
    ALTER TABLE [user] ADD avatar_url NVARCHAR(500) NULL;
    PRINT '      SUCCESS: Column added'
END
ELSE
    PRINT '  [✓] Column exists: user.avatar_url'

-- user.is_public_profile
IF NOT EXISTS (
    SELECT 1 FROM sys.columns
    WHERE object_id = OBJECT_ID('[user]')
    AND name = 'is_public_profile'
)
BEGIN
    PRINT '  [+] Adding column: user.is_public_profile'
    ALTER TABLE [user] ADD is_public_profile BIT NOT NULL DEFAULT 1;
    PRINT '      SUCCESS: Column added'
END
ELSE
    PRINT '  [✓] Column exists: user.is_public_profile'

-- user.website
IF NOT EXISTS (
    SELECT 1 FROM sys.columns
    WHERE object_id = OBJECT_ID('[user]')
    AND name = 'website'
)
BEGIN
    PRINT '  [+] Adding column: user.website'
    ALTER TABLE [user] ADD website NVARCHAR(255) NULL;
    PRINT '      SUCCESS: Column added'
END
ELSE
    PRINT '  [✓] Column exists: user.website'

-- user.user_location
IF NOT EXISTS (
    SELECT 1 FROM sys.columns
    WHERE object_id = OBJECT_ID('[user]')
    AND name = 'user_location'
)
BEGIN
    PRINT '  [+] Adding column: user.user_location'
    ALTER TABLE [user] ADD user_location NVARCHAR(100) NULL;
    PRINT '      SUCCESS: Column added'
END
ELSE
    PRINT '  [✓] Column exists: user.user_location'

-- user.profile_completed
IF NOT EXISTS (
    SELECT 1 FROM sys.columns
    WHERE object_id = OBJECT_ID('[user]')
    AND name = 'profile_completed'
)
BEGIN
    PRINT '  [+] Adding column: user.profile_completed'
    ALTER TABLE [user] ADD profile_completed BIT NOT NULL DEFAULT 0;
    PRINT '      SUCCESS: Column added'
END
ELSE
    PRINT '  [✓] Column exists: user.profile_completed'

-- user.is_muted
IF NOT EXISTS (
    SELECT 1 FROM sys.columns
    WHERE object_id = OBJECT_ID('[user]')
    AND name = 'is_muted'
)
BEGIN
    PRINT '  [+] Adding column: user.is_muted'
    ALTER TABLE [user] ADD is_muted BIT NOT NULL DEFAULT 0;
    PRINT '      SUCCESS: Column added'
END
ELSE
    PRINT '  [✓] Column exists: user.is_muted'

-- user.muted_at
IF NOT EXISTS (
    SELECT 1 FROM sys.columns
    WHERE object_id = OBJECT_ID('[user]')
    AND name = 'muted_at'
)
BEGIN
    PRINT '  [+] Adding column: user.muted_at'
    ALTER TABLE [user] ADD muted_at DATETIME NULL;
    PRINT '      SUCCESS: Column added'
END
ELSE
    PRINT '  [✓] Column exists: user.muted_at'

-- user.muted_by
IF NOT EXISTS (
    SELECT 1 FROM sys.columns
    WHERE object_id = OBJECT_ID('[user]')
    AND name = 'muted_by'
)
BEGIN
    PRINT '  [+] Adding column: user.muted_by'
    ALTER TABLE [user] ADD muted_by BIGINT NULL;
    PRINT '      SUCCESS: Column added'
END
ELSE
    PRINT '  [✓] Column exists: user.muted_by'

-- user_session.token_hash
IF NOT EXISTS (
    SELECT 1 FROM sys.columns
    WHERE object_id = OBJECT_ID('user_session')
    AND name = 'token_hash'
)
BEGIN
    PRINT '  [+] Adding column: user_session.token_hash'
    ALTER TABLE user_session ADD token_hash NVARCHAR(500) NULL;
    PRINT '      SUCCESS: Column added'
END
ELSE
    PRINT '  [✓] Column exists: user_session.token_hash'

PRINT ''
PRINT 'SECTION 1 COMPLETE: Column checks finished'
PRINT ''

-- ============================================================================
-- SECTION 2: ADD MISSING FOREIGN KEYS
-- ============================================================================
PRINT 'SECTION 2: Checking for missing foreign keys...'
PRINT ''

-- FK: card.reference_user_card -> user_card.user_card_id
IF NOT EXISTS (
    SELECT 1 FROM sys.foreign_keys
    WHERE name = 'FK_card_reference_user_card'
)
BEGIN
    -- Only add if the column exists
    IF EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('card') AND name = 'reference_user_card')
    BEGIN
        PRINT '  [+] Adding foreign key: FK_card_reference_user_card'
        ALTER TABLE card
        ADD CONSTRAINT FK_card_reference_user_card
        FOREIGN KEY (reference_user_card) REFERENCES user_card(user_card_id);
        PRINT '      SUCCESS: Foreign key added'
    END
    ELSE
        PRINT '  [!] SKIPPED: FK_card_reference_user_card (column does not exist)'
END
ELSE
    PRINT '  [✓] Foreign key exists: FK_card_reference_user_card'

-- FK: player.display_card -> card.card_id
IF NOT EXISTS (
    SELECT 1 FROM sys.foreign_keys
    WHERE name = 'FK_player_display_card'
)
BEGIN
    IF EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('player') AND name = 'display_card')
    BEGIN
        PRINT '  [+] Adding foreign key: FK_player_display_card'
        ALTER TABLE player
        ADD CONSTRAINT FK_player_display_card
        FOREIGN KEY (display_card) REFERENCES card(card_id);
        PRINT '      SUCCESS: Foreign key added'
    END
    ELSE
        PRINT '  [!] SKIPPED: FK_player_display_card (column does not exist)'
END
ELSE
    PRINT '  [✓] Foreign key exists: FK_player_display_card'

-- FK: user.muted_by -> user.user_id
IF NOT EXISTS (
    SELECT 1 FROM sys.foreign_keys
    WHERE name = 'FK_user_muted_by'
)
BEGIN
    IF EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('[user]') AND name = 'muted_by')
    BEGIN
        PRINT '  [+] Adding foreign key: FK_user_muted_by'
        ALTER TABLE [user]
        ADD CONSTRAINT FK_user_muted_by
        FOREIGN KEY (muted_by) REFERENCES [user](user_id);
        PRINT '      SUCCESS: Foreign key added'
    END
    ELSE
        PRINT '  [!] SKIPPED: FK_user_muted_by (column does not exist)'
END
ELSE
    PRINT '  [✓] Foreign key exists: FK_user_muted_by'

PRINT ''
PRINT 'SECTION 2 COMPLETE: Foreign key checks finished'
PRINT ''

-- ============================================================================
-- SECTION 3: ADD MISSING INDEXES
-- ============================================================================
PRINT 'SECTION 3: Checking for missing indexes...'
PRINT ''

-- Index: card.reference_user_card
IF NOT EXISTS (
    SELECT 1 FROM sys.indexes
    WHERE name = 'IX_card_reference_user_card'
    AND object_id = OBJECT_ID('card')
)
BEGIN
    IF EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('card') AND name = 'reference_user_card')
    BEGIN
        PRINT '  [+] Creating index: IX_card_reference_user_card'
        CREATE INDEX IX_card_reference_user_card ON card(reference_user_card);
        PRINT '      SUCCESS: Index created'
    END
    ELSE
        PRINT '  [!] SKIPPED: IX_card_reference_user_card (column does not exist)'
END
ELSE
    PRINT '  [✓] Index exists: IX_card_reference_user_card'

-- Index: card.created_month
IF NOT EXISTS (
    SELECT 1 FROM sys.indexes
    WHERE name = 'idx_card_created_month'
    AND object_id = OBJECT_ID('card')
)
BEGIN
    IF EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('card') AND name = 'created_month')
    BEGIN
        PRINT '  [+] Creating index: idx_card_created_month'
        CREATE INDEX idx_card_created_month ON card(created_month);
        PRINT '      SUCCESS: Index created'
    END
    ELSE
        PRINT '  [!] SKIPPED: idx_card_created_month (column does not exist)'
END
ELSE
    PRINT '  [✓] Index exists: idx_card_created_month'

-- Index: card.card_number_indexed
IF NOT EXISTS (
    SELECT 1 FROM sys.indexes
    WHERE name = 'IX_card_number'
    AND object_id = OBJECT_ID('card')
)
BEGIN
    IF EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('card') AND name = 'card_number_indexed')
    BEGIN
        PRINT '  [+] Creating index: IX_card_number'
        CREATE INDEX IX_card_number ON card(card_number_indexed);
        PRINT '      SUCCESS: Index created'
    END
    ELSE
        PRINT '  [!] SKIPPED: IX_card_number (column does not exist)'
END
ELSE
    PRINT '  [✓] Index exists: IX_card_number'

-- Index: player.display_card
IF NOT EXISTS (
    SELECT 1 FROM sys.indexes
    WHERE name = 'IX_player_display_card'
    AND object_id = OBJECT_ID('player')
)
BEGIN
    IF EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('player') AND name = 'display_card')
    BEGIN
        PRINT '  [+] Creating index: IX_player_display_card'
        CREATE INDEX IX_player_display_card ON player(display_card);
        PRINT '      SUCCESS: Index created'
    END
    ELSE
        PRINT '  [!] SKIPPED: IX_player_display_card (column does not exist)'
END
ELSE
    PRINT '  [✓] Index exists: IX_player_display_card'

-- Unique index: player.slug
IF NOT EXISTS (
    SELECT 1 FROM sys.indexes
    WHERE name = 'idx_player_slug'
    AND object_id = OBJECT_ID('player')
)
BEGIN
    IF EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('player') AND name = 'slug')
    BEGIN
        PRINT '  [+] Creating unique index: idx_player_slug'
        CREATE UNIQUE INDEX idx_player_slug ON player(slug);
        PRINT '      SUCCESS: Index created'
    END
    ELSE
        PRINT '  [!] SKIPPED: idx_player_slug (column does not exist)'
END
ELSE
    PRINT '  [✓] Index exists: idx_player_slug'

-- Unique index: series.slug + set
IF NOT EXISTS (
    SELECT 1 FROM sys.indexes
    WHERE name = 'idx_series_slug_set'
    AND object_id = OBJECT_ID('series')
)
BEGIN
    IF EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('series') AND name = 'slug')
    BEGIN
        PRINT '  [+] Creating unique index: idx_series_slug_set'
        CREATE UNIQUE INDEX idx_series_slug_set ON series(slug, [set]);
        PRINT '      SUCCESS: Index created'
    END
    ELSE
        PRINT '  [!] SKIPPED: idx_series_slug_set (column does not exist)'
END
ELSE
    PRINT '  [✓] Index exists: idx_series_slug_set'

-- Unique index: set.slug
IF NOT EXISTS (
    SELECT 1 FROM sys.indexes
    WHERE name = 'idx_set_slug'
    AND object_id = OBJECT_ID('[set]')
)
BEGIN
    IF EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('[set]') AND name = 'slug')
    BEGIN
        PRINT '  [+] Creating unique index: idx_set_slug'
        CREATE UNIQUE INDEX idx_set_slug ON [set](slug);
        PRINT '      SUCCESS: Index created'
    END
    ELSE
        PRINT '  [!] SKIPPED: idx_set_slug (column does not exist)'
END
ELSE
    PRINT '  [✓] Index exists: idx_set_slug'

-- Unique index: team.slug
IF NOT EXISTS (
    SELECT 1 FROM sys.indexes
    WHERE name = 'idx_team_slug'
    AND object_id = OBJECT_ID('team')
)
BEGIN
    IF EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('team') AND name = 'slug')
    BEGIN
        PRINT '  [+] Creating unique index: idx_team_slug'
        CREATE UNIQUE INDEX idx_team_slug ON team(slug);
        PRINT '      SUCCESS: Index created'
    END
    ELSE
        PRINT '  [!] SKIPPED: idx_team_slug (column does not exist)'
END
ELSE
    PRINT '  [✓] Index exists: idx_team_slug'

-- Unique index: user.username
IF NOT EXISTS (
    SELECT 1 FROM sys.indexes
    WHERE name = 'IX_user_username'
    AND object_id = OBJECT_ID('[user]')
)
BEGIN
    IF EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('[user]') AND name = 'username')
    BEGIN
        PRINT '  [+] Creating unique index: IX_user_username'
        CREATE UNIQUE INDEX IX_user_username ON [user](username) WHERE username IS NOT NULL;
        PRINT '      SUCCESS: Index created'
    END
    ELSE
        PRINT '  [!] SKIPPED: IX_user_username (column does not exist)'
END
ELSE
    PRINT '  [✓] Index exists: IX_user_username'

-- Index: user.is_muted
IF NOT EXISTS (
    SELECT 1 FROM sys.indexes
    WHERE name = 'IX_user_is_muted'
    AND object_id = OBJECT_ID('[user]')
)
BEGIN
    IF EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('[user]') AND name = 'is_muted')
    BEGIN
        PRINT '  [+] Creating index: IX_user_is_muted'
        CREATE INDEX IX_user_is_muted ON [user](is_muted);
        PRINT '      SUCCESS: Index created'
    END
    ELSE
        PRINT '  [!] SKIPPED: IX_user_is_muted (column does not exist)'
END
ELSE
    PRINT '  [✓] Index exists: IX_user_is_muted'

PRINT ''
PRINT 'SECTION 3 COMPLETE: Index checks finished'
PRINT ''

-- ============================================================================
-- SECTION 4: VERIFICATION
-- ============================================================================
PRINT 'SECTION 4: Schema verification...'
PRINT ''

-- Verify critical columns
DECLARE @missing_columns TABLE (
    table_name NVARCHAR(128),
    column_name NVARCHAR(128)
)

-- Check card table
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('card') AND name = 'reference_user_card')
    INSERT INTO @missing_columns VALUES ('card', 'reference_user_card')
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('card') AND name = 'card_number_indexed')
    INSERT INTO @missing_columns VALUES ('card', 'card_number_indexed')

-- Check player table
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('player') AND name = 'display_card')
    INSERT INTO @missing_columns VALUES ('player', 'display_card')
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('player') AND name = 'slug')
    INSERT INTO @missing_columns VALUES ('player', 'slug')

-- Check series table
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('series') AND name = 'slug')
    INSERT INTO @missing_columns VALUES ('series', 'slug')

-- Check set table
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('[set]') AND name = 'slug')
    INSERT INTO @missing_columns VALUES ('set', 'slug')

-- Check team table
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('team') AND name = 'slug')
    INSERT INTO @missing_columns VALUES ('team', 'slug')

-- Report missing columns
IF EXISTS (SELECT 1 FROM @missing_columns)
BEGIN
    PRINT '  [!] WARNING: The following columns are still missing:'
    SELECT '      - ' + table_name + '.' + column_name AS [Missing Column]
    FROM @missing_columns
    PRINT ''
    PRINT '  Please review the error log above to see why these failed.'
END
ELSE
BEGIN
    PRINT '  [✓] All critical columns are present'
END

PRINT ''
PRINT '==================================================================='
PRINT 'SCHEMA SYNCHRONIZATION COMPLETE'
PRINT 'Finished: ' + CONVERT(VARCHAR, GETDATE(), 120)
PRINT '==================================================================='
PRINT ''
PRINT 'IMPORTANT NOTES:'
PRINT '1. Slug columns were added with empty defaults - you may need to populate them'
PRINT '2. Run DBCC CHECKDB to verify database integrity'
PRINT '3. Update application statistics: UPDATE STATISTICS'
PRINT '4. Consider rebuilding indexes for optimal performance'
PRINT ''
PRINT 'Next steps:'
PRINT '- Review any SKIPPED items above'
PRINT '- Test application functionality'
PRINT '- Monitor for any errors in application logs'
PRINT ''
