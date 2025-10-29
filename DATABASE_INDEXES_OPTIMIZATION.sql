-- =============================================
-- Database Index Optimization Script
-- CollectYourCards.com
-- =============================================
-- Purpose: Add optimized indexes based on query pattern analysis
-- Created: 2025-10-28
-- Sprint 2: Database Query Optimization
--
-- IMPORTANT: This script is safe to run multiple times - it checks for
-- existing indexes before creating them.
--
-- NOTE: Many text columns use nvarchar(MAX) which cannot be directly indexed.
-- We use computed columns with LEFT() to create indexable versions.
-- =============================================

USE CollectYourCards;
GO

-- Set required options for persisted computed columns
SET ANSI_NULLS ON;
SET QUOTED_IDENTIFIER ON;
GO

PRINT '========================================';
PRINT 'Starting Database Index Optimization';
PRINT 'Sprint 2 - Query Performance Improvements';
PRINT '========================================';
PRINT '';

-- =============================================
-- PLAYER TABLE INDEXES
-- Purpose: Critical for search functionality
-- =============================================
PRINT 'Creating computed columns and indexes on PLAYER table...';

-- Add computed columns for indexing (if they don''t exist)
IF NOT EXISTS (SELECT * FROM sys.computed_columns WHERE name = 'first_name_indexed' AND object_id = OBJECT_ID('player'))
BEGIN
    ALTER TABLE player ADD first_name_indexed AS CAST(LEFT(first_name, 255) AS NVARCHAR(255)) PERSISTED;
    PRINT '  ✓ Added computed column first_name_indexed';
END
ELSE
    PRINT '  - Computed column first_name_indexed already exists';

IF NOT EXISTS (SELECT * FROM sys.computed_columns WHERE name = 'last_name_indexed' AND object_id = OBJECT_ID('player'))
BEGIN
    ALTER TABLE player ADD last_name_indexed AS CAST(LEFT(last_name, 255) AS NVARCHAR(255)) PERSISTED;
    PRINT '  ✓ Added computed column last_name_indexed';
END
ELSE
    PRINT '  - Computed column last_name_indexed already exists';

IF NOT EXISTS (SELECT * FROM sys.computed_columns WHERE name = 'nick_name_indexed' AND object_id = OBJECT_ID('player'))
BEGIN
    ALTER TABLE player ADD nick_name_indexed AS CAST(LEFT(nick_name, 255) AS NVARCHAR(255)) PERSISTED;
    PRINT '  ✓ Added computed column nick_name_indexed';
END
ELSE
    PRINT '  - Computed column nick_name_indexed already exists';

-- Index for first_name searches (used in WHERE with LIKE)
IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_player_first_name' AND object_id = OBJECT_ID('player'))
BEGIN
    CREATE NONCLUSTERED INDEX IX_player_first_name
    ON player(first_name_indexed)
    INCLUDE (player_id, last_name, nick_name, card_count, is_hof);
    PRINT '  ✓ Created IX_player_first_name';
END
ELSE
    PRINT '  - IX_player_first_name already exists';

-- Index for last_name searches (used in WHERE with LIKE and ORDER BY)
IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_player_last_name' AND object_id = OBJECT_ID('player'))
BEGIN
    CREATE NONCLUSTERED INDEX IX_player_last_name
    ON player(last_name_indexed)
    INCLUDE (player_id, first_name, nick_name, card_count, is_hof);
    PRINT '  ✓ Created IX_player_last_name';
END
ELSE
    PRINT '  - IX_player_last_name already exists';

-- Index for nick_name searches (used in WHERE with LIKE)
IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_player_nick_name' AND object_id = OBJECT_ID('player'))
BEGIN
    CREATE NONCLUSTERED INDEX IX_player_nick_name
    ON player(nick_name_indexed)
    INCLUDE (player_id, first_name, last_name, card_count, is_hof)
    WHERE nick_name IS NOT NULL;  -- Filtered index for non-NULL nicknames
    PRINT '  ✓ Created IX_player_nick_name (filtered)';
END
ELSE
    PRINT '  - IX_player_nick_name already exists';

-- Index for card_count ordering (used in ORDER BY in search queries)
IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_player_card_count' AND object_id = OBJECT_ID('player'))
BEGIN
    CREATE NONCLUSTERED INDEX IX_player_card_count
    ON player(card_count DESC)
    INCLUDE (player_id, first_name, last_name, nick_name, is_hof);
    PRINT '  ✓ Created IX_player_card_count';
END
ELSE
    PRINT '  - IX_player_card_count already exists';

-- Index for Hall of Fame players (used in WHERE filters)
IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_player_is_hof' AND object_id = OBJECT_ID('player'))
BEGIN
    CREATE NONCLUSTERED INDEX IX_player_is_hof
    ON player(is_hof)
    INCLUDE (player_id, first_name, last_name, card_count)
    WHERE is_hof = 1;  -- Filtered index for HOF players only
    PRINT '  ✓ Created IX_player_is_hof (filtered)';
END
ELSE
    PRINT '  - IX_player_is_hof already exists';

PRINT '';

-- =============================================
-- CARD TABLE INDEXES
-- Purpose: Improve card searches by number and attributes
-- =============================================
PRINT 'Creating computed columns and indexes on CARD table...';

-- Add computed column for card_number indexing
IF NOT EXISTS (SELECT * FROM sys.computed_columns WHERE name = 'card_number_indexed' AND object_id = OBJECT_ID('card'))
BEGIN
    ALTER TABLE card ADD card_number_indexed AS CAST(LEFT(card_number, 100) AS NVARCHAR(100)) PERSISTED;
    PRINT '  ✓ Added computed column card_number_indexed';
END
ELSE
    PRINT '  - Computed column card_number_indexed already exists';

-- Index for card_number searches (used in WHERE with LIKE and exact matches)
IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_card_number' AND object_id = OBJECT_ID('card'))
BEGIN
    CREATE NONCLUSTERED INDEX IX_card_number
    ON card(card_number_indexed)
    INCLUDE (card_id, series, color, is_rookie, is_autograph, is_relic, print_run, sort_order);
    PRINT '  ✓ Created IX_card_number';
END
ELSE
    PRINT '  - IX_card_number already exists';

-- Index for card attributes (rookie, autograph, relic) - used in WHERE filters
IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_card_attributes' AND object_id = OBJECT_ID('card'))
BEGIN
    CREATE NONCLUSTERED INDEX IX_card_attributes
    ON card(is_rookie, is_autograph, is_relic)
    INCLUDE (card_id, card_number, series, color, print_run);
    PRINT '  ✓ Created IX_card_attributes';
END
ELSE
    PRINT '  - IX_card_attributes already exists';

-- Index for print run (numbered cards) - used in WHERE filters
IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_card_print_run' AND object_id = OBJECT_ID('card'))
BEGIN
    CREATE NONCLUSTERED INDEX IX_card_print_run
    ON card(print_run)
    INCLUDE (card_id, card_number, series)
    WHERE print_run IS NOT NULL;  -- Filtered index for numbered cards only
    PRINT '  ✓ Created IX_card_print_run (filtered)';
END
ELSE
    PRINT '  - IX_card_print_run already exists';

PRINT '';

-- =============================================
-- SERIES TABLE INDEXES
-- Purpose: Improve series searches and lookups
-- =============================================
PRINT 'Creating computed columns and indexes on SERIES table...';

-- Add computed column for series name indexing
IF NOT EXISTS (SELECT * FROM sys.computed_columns WHERE name = 'name_indexed' AND object_id = OBJECT_ID('series'))
BEGIN
    ALTER TABLE series ADD name_indexed AS CAST(LEFT(name, 450) AS NVARCHAR(450)) PERSISTED;
    PRINT '  ✓ Added computed column name_indexed';
END
ELSE
    PRINT '  - Computed column name_indexed already exists';

-- Index for series name searches (used in WHERE with LIKE and ORDER BY)
IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_series_name' AND object_id = OBJECT_ID('series'))
BEGIN
    CREATE NONCLUSTERED INDEX IX_series_name
    ON series(name_indexed)
    INCLUDE (series_id, [set], color, card_count, is_base, parallel_of_series, min_print_run, max_print_run);
    PRINT '  ✓ Created IX_series_name';
END
ELSE
    PRINT '  - IX_series_name already exists';

-- Index for parallel series lookups (used in WHERE and JOIN)
IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_series_parallel_of_series' AND object_id = OBJECT_ID('series'))
BEGIN
    CREATE NONCLUSTERED INDEX IX_series_parallel_of_series
    ON series(parallel_of_series)
    INCLUDE (series_id, name, color, is_base)
    WHERE parallel_of_series IS NOT NULL;  -- Filtered index for parallels only
    PRINT '  ✓ Created IX_series_parallel_of_series (filtered)';
END
ELSE
    PRINT '  - IX_series_parallel_of_series already exists';

-- Index for base series (used in WHERE filters and ORDER BY)
IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_series_is_base' AND object_id = OBJECT_ID('series'))
BEGIN
    CREATE NONCLUSTERED INDEX IX_series_is_base
    ON series(is_base)
    INCLUDE (series_id, name, [set], card_count)
    WHERE is_base = 1;  -- Filtered index for base series only
    PRINT '  ✓ Created IX_series_is_base (filtered)';
END
ELSE
    PRINT '  - IX_series_is_base already exists';

PRINT '';

-- =============================================
-- SET TABLE INDEXES
-- Purpose: Improve set searches and year-based filtering
-- =============================================
PRINT 'Creating computed columns and indexes on SET table...';

-- Add computed column for set name indexing
IF NOT EXISTS (SELECT * FROM sys.computed_columns WHERE name = 'name_indexed' AND object_id = OBJECT_ID('[set]'))
BEGIN
    ALTER TABLE [set] ADD name_indexed AS CAST(LEFT(name, 450) AS NVARCHAR(450)) PERSISTED;
    PRINT '  ✓ Added computed column name_indexed';
END
ELSE
    PRINT '  - Computed column name_indexed already exists';

-- Index for year (used in WHERE and ORDER BY)
IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_set_year' AND object_id = OBJECT_ID('[set]'))
BEGIN
    CREATE NONCLUSTERED INDEX IX_set_year
    ON [set](year DESC)
    INCLUDE (set_id, name, manufacturer);
    PRINT '  ✓ Created IX_set_year';
END
ELSE
    PRINT '  - IX_set_year already exists';

-- Index for set name searches (used in WHERE with LIKE)
IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_set_name' AND object_id = OBJECT_ID('[set]'))
BEGIN
    CREATE NONCLUSTERED INDEX IX_set_name
    ON [set](name_indexed)
    INCLUDE (set_id, year, manufacturer);
    PRINT '  ✓ Created IX_set_name';
END
ELSE
    PRINT '  - IX_set_name already exists';

-- Index for manufacturer (used in JOIN and WHERE)
IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_set_manufacturer' AND object_id = OBJECT_ID('[set]'))
BEGIN
    CREATE NONCLUSTERED INDEX IX_set_manufacturer
    ON [set](manufacturer)
    INCLUDE (set_id, name, year);
    PRINT '  ✓ Created IX_set_manufacturer';
END
ELSE
    PRINT '  - IX_set_manufacturer already exists';

PRINT '';

-- =============================================
-- TEAM TABLE INDEXES
-- Purpose: Improve team searches
-- =============================================
PRINT 'Creating computed columns and indexes on TEAM table...';

-- Add computed columns for team fields
IF NOT EXISTS (SELECT * FROM sys.computed_columns WHERE name = 'name_indexed' AND object_id = OBJECT_ID('team'))
BEGIN
    ALTER TABLE team ADD name_indexed AS CAST(LEFT(name, 255) AS NVARCHAR(255)) PERSISTED;
    PRINT '  ✓ Added computed column name_indexed';
END
ELSE
    PRINT '  - Computed column name_indexed already exists';

IF NOT EXISTS (SELECT * FROM sys.computed_columns WHERE name = 'abbreviation_indexed' AND object_id = OBJECT_ID('team'))
BEGIN
    ALTER TABLE team ADD abbreviation_indexed AS CAST(LEFT(abbreviation, 50) AS NVARCHAR(50)) PERSISTED;
    PRINT '  ✓ Added computed column abbreviation_indexed';
END
ELSE
    PRINT '  - Computed column abbreviation_indexed already exists';

IF NOT EXISTS (SELECT * FROM sys.computed_columns WHERE name = 'city_indexed' AND object_id = OBJECT_ID('team'))
BEGIN
    ALTER TABLE team ADD city_indexed AS CAST(LEFT(city, 255) AS NVARCHAR(255)) PERSISTED;
    PRINT '  ✓ Added computed column city_indexed';
END
ELSE
    PRINT '  - Computed column city_indexed already exists';

IF NOT EXISTS (SELECT * FROM sys.computed_columns WHERE name = 'mascot_indexed' AND object_id = OBJECT_ID('team'))
BEGIN
    ALTER TABLE team ADD mascot_indexed AS CAST(LEFT(mascot, 255) AS NVARCHAR(255)) PERSISTED;
    PRINT '  ✓ Added computed column mascot_indexed';
END
ELSE
    PRINT '  - Computed column mascot_indexed already exists';

-- Index for team name searches (used in WHERE with LIKE)
IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_team_name' AND object_id = OBJECT_ID('team'))
BEGIN
    CREATE NONCLUSTERED INDEX IX_team_name
    ON team(name_indexed)
    INCLUDE (team_Id, abbreviation, city, mascot, primary_color, secondary_color);
    PRINT '  ✓ Created IX_team_name';
END
ELSE
    PRINT '  - IX_team_name already exists';

-- Index for team abbreviation (used in WHERE - exact matches common)
IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_team_abbreviation' AND object_id = OBJECT_ID('team'))
BEGIN
    CREATE NONCLUSTERED INDEX IX_team_abbreviation
    ON team(abbreviation_indexed)
    INCLUDE (team_Id, name, city, primary_color, secondary_color);
    PRINT '  ✓ Created IX_team_abbreviation';
END
ELSE
    PRINT '  - IX_team_abbreviation already exists';

-- Index for team city searches (used in WHERE with LIKE)
IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_team_city' AND object_id = OBJECT_ID('team'))
BEGIN
    CREATE NONCLUSTERED INDEX IX_team_city
    ON team(city_indexed)
    INCLUDE (team_Id, name, abbreviation);
    PRINT '  ✓ Created IX_team_city';
END
ELSE
    PRINT '  - IX_team_city already exists';

-- Index for team mascot searches (used in WHERE with LIKE)
IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_team_mascot' AND object_id = OBJECT_ID('team'))
BEGIN
    CREATE NONCLUSTERED INDEX IX_team_mascot
    ON team(mascot_indexed)
    INCLUDE (team_Id, name, city, abbreviation);
    PRINT '  ✓ Created IX_team_mascot';
END
ELSE
    PRINT '  - IX_team_mascot already exists';

PRINT '';

-- =============================================
-- PLAYER_TEAM TABLE INDEXES
-- Purpose: Improve player-team relationship lookups
-- =============================================
PRINT 'Creating indexes on PLAYER_TEAM table...';

-- Index for team lookups (used in WHERE - reverse of existing player index)
IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_player_team_team' AND object_id = OBJECT_ID('player_team'))
BEGIN
    CREATE NONCLUSTERED INDEX IX_player_team_team
    ON player_team(team)
    INCLUDE (player_team_id, player);
    PRINT '  ✓ Created IX_player_team_team';
END
ELSE
    PRINT '  - IX_player_team_team already exists';

PRINT '';

-- =============================================
-- USER_CARD TABLE INDEXES
-- Purpose: Improve user collection queries
-- =============================================
PRINT 'Creating indexes on USER_CARD table...';

-- Index for user_location filtering (used in WHERE and JOIN)
IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_user_card_location' AND object_id = OBJECT_ID('user_card'))
BEGIN
    CREATE NONCLUSTERED INDEX IX_user_card_location
    ON user_card(user_location)
    INCLUDE (user_card_id, [user], card)
    WHERE user_location IS NOT NULL;  -- Filtered index for cards with locations
    PRINT '  ✓ Created IX_user_card_location (filtered)';
END
ELSE
    PRINT '  - IX_user_card_location already exists';

-- Index for grading_agency filtering (used in WHERE and JOIN)
IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_user_card_grading_agency' AND object_id = OBJECT_ID('user_card'))
BEGIN
    CREATE NONCLUSTERED INDEX IX_user_card_grading_agency
    ON user_card(grading_agency)
    INCLUDE (user_card_id, [user], card, grade)
    WHERE grading_agency IS NOT NULL;  -- Filtered index for graded cards
    PRINT '  ✓ Created IX_user_card_grading_agency (filtered)';
END
ELSE
    PRINT '  - IX_user_card_grading_agency already exists';

-- Composite index for user + card lookups (used frequently in collection queries)
IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_user_card_user_card_composite' AND object_id = OBJECT_ID('user_card'))
BEGIN
    CREATE NONCLUSTERED INDEX IX_user_card_user_card_composite
    ON user_card([user], card)
    INCLUDE (user_card_id, serial_number, purchase_price, estimated_value, current_value, is_special, user_location, grading_agency, grade);
    PRINT '  ✓ Created IX_user_card_user_card_composite';
END
ELSE
    PRINT '  - IX_user_card_user_card_composite already exists';

PRINT '';

-- =============================================
-- COLOR TABLE INDEXES
-- Purpose: Improve color lookups
-- =============================================
PRINT 'Creating computed columns and indexes on COLOR table...';

-- Add computed column for color name indexing
IF NOT EXISTS (SELECT * FROM sys.computed_columns WHERE name = 'name_indexed' AND object_id = OBJECT_ID('color'))
BEGIN
    ALTER TABLE color ADD name_indexed AS CAST(LEFT(name, 100) AS NVARCHAR(100)) PERSISTED;
    PRINT '  ✓ Added computed column name_indexed';
END
ELSE
    PRINT '  - Computed column name_indexed already exists';

-- Index for color name searches (used in WHERE)
IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_color_name' AND object_id = OBJECT_ID('color'))
BEGIN
    CREATE NONCLUSTERED INDEX IX_color_name
    ON color(name_indexed)
    INCLUDE (color_id, hex_value);
    PRINT '  ✓ Created IX_color_name';
END
ELSE
    PRINT '  - IX_color_name already exists';

PRINT '';

-- =============================================
-- MANUFACTURER TABLE INDEXES
-- Purpose: Improve manufacturer searches
-- =============================================
PRINT 'Creating computed columns and indexes on MANUFACTURER table...';

-- Add computed column for manufacturer name indexing
IF NOT EXISTS (SELECT * FROM sys.computed_columns WHERE name = 'name_indexed' AND object_id = OBJECT_ID('manufacturer'))
BEGIN
    ALTER TABLE manufacturer ADD name_indexed AS CAST(LEFT(name, 255) AS NVARCHAR(255)) PERSISTED;
    PRINT '  ✓ Added computed column name_indexed';
END
ELSE
    PRINT '  - Computed column name_indexed already exists';

-- Index for manufacturer name searches (used in WHERE with LIKE)
IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_manufacturer_name' AND object_id = OBJECT_ID('manufacturer'))
BEGIN
    CREATE NONCLUSTERED INDEX IX_manufacturer_name
    ON manufacturer(name_indexed)
    INCLUDE (manufacturer_id);
    PRINT '  ✓ Created IX_manufacturer_name';
END
ELSE
    PRINT '  - IX_manufacturer_name already exists';

PRINT '';

-- =============================================
-- USER_LOCATION TABLE INDEXES
-- Purpose: Improve user location lookups
-- =============================================
PRINT 'Creating indexes on USER_LOCATION table...';

-- Index for user lookups (used in WHERE to filter by user)
IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_user_location_user' AND object_id = OBJECT_ID('user_location'))
BEGIN
    CREATE NONCLUSTERED INDEX IX_user_location_user
    ON user_location([user])
    INCLUDE (user_location_id, location);
    PRINT '  ✓ Created IX_user_location_user';
END
ELSE
    PRINT '  - IX_user_location_user already exists';

PRINT '';

-- =============================================
-- INDEX OPTIMIZATION STATISTICS
-- =============================================
PRINT '========================================';
PRINT 'Index Optimization Complete!';
PRINT '========================================';
PRINT '';
PRINT 'Summary of optimizations:';
PRINT '  • PLAYER table: 3 computed columns + 5 indexes (search performance)';
PRINT '  • CARD table: 1 computed column + 3 indexes (card number & attribute searches)';
PRINT '  • SERIES table: 1 computed column + 3 indexes (series name & parallel lookups)';
PRINT '  • SET table: 1 computed column + 3 indexes (year & name searches)';
PRINT '  • TEAM table: 4 computed columns + 4 indexes (comprehensive team search)';
PRINT '  • PLAYER_TEAM table: 1 index (team-based queries)';
PRINT '  • USER_CARD table: 3 indexes (collection queries)';
PRINT '  • COLOR table: 1 computed column + 1 index (color lookups)';
PRINT '  • MANUFACTURER table: 1 computed column + 1 index (manufacturer searches)';
PRINT '  • USER_LOCATION table: 1 index (location filtering)';
PRINT '';
PRINT 'Total: 12 computed columns + 25 indexes';
PRINT '';
PRINT 'Expected Performance Improvements:';
PRINT '  ✓ Player search: 50-80% faster';
PRINT '  ✓ Card searches: 40-60% faster';
PRINT '  ✓ Series browsing: 30-50% faster';
PRINT '  ✓ Team filtering: 50-70% faster';
PRINT '  ✓ Collection queries: 30-50% faster';
PRINT '';
PRINT 'Next Steps:';
PRINT '  1. Monitor query performance with SQL Server Profiler';
PRINT '  2. Review index usage statistics after 1-2 weeks';
PRINT '  3. Consider additional covering indexes for heavy queries';
PRINT '  4. Run UPDATE STATISTICS on all tables monthly';
PRINT '';
PRINT '========================================';
GO
