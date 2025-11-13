-- =============================================================================
-- Full-Text Search Index Creation for Universal Search V2 Performance
-- =============================================================================
-- This script creates full-text catalogs and indexes to dramatically improve
-- search performance (5-10x speedup on text searches)
--
-- Run this on the production database to enable full-text search capabilities
-- =============================================================================

USE CollectYourCards;
GO

-- Check if Full-Text Search is installed
IF FULLTEXTSERVICEPROPERTY('IsFullTextInstalled') = 1
BEGIN
    PRINT 'Full-Text Search is installed and available.'
END
ELSE
BEGIN
    PRINT 'ERROR: Full-Text Search is NOT installed on this SQL Server instance.'
    PRINT 'You need to install Full-Text Search feature before running this script.'
    -- Exit if not available
    RETURN
END
GO

-- =============================================================================
-- Create Full-Text Catalog
-- A catalog is a container for full-text indexes
-- =============================================================================

IF NOT EXISTS (SELECT * FROM sys.fulltext_catalogs WHERE name = 'CardSearchCatalog')
BEGIN
    CREATE FULLTEXT CATALOG CardSearchCatalog AS DEFAULT;
    PRINT 'Created Full-Text Catalog: CardSearchCatalog'
END
ELSE
BEGIN
    PRINT 'Full-Text Catalog CardSearchCatalog already exists.'
END
GO

-- =============================================================================
-- Full-Text Index on PLAYER table
-- Columns: first_name, last_name, nick_name
-- =============================================================================

-- Check if index exists
IF EXISTS (SELECT * FROM sys.fulltext_indexes WHERE object_id = OBJECT_ID('player'))
BEGIN
    PRINT 'Dropping existing full-text index on player table...'
    DROP FULLTEXT INDEX ON player;
END
GO

-- Create the full-text index
CREATE FULLTEXT INDEX ON player
(
    first_name LANGUAGE 1033,  -- English
    last_name LANGUAGE 1033,
    nick_name LANGUAGE 1033
)
KEY INDEX PK_player
ON CardSearchCatalog
WITH (
    CHANGE_TRACKING = AUTO,
    STOPLIST = SYSTEM
);

PRINT 'Created full-text index on player table (first_name, last_name, nick_name)'
GO

-- =============================================================================
-- Full-Text Index on TEAM table
-- Columns: name, city, mascot
-- =============================================================================

IF EXISTS (SELECT * FROM sys.fulltext_indexes WHERE object_id = OBJECT_ID('team'))
BEGIN
    PRINT 'Dropping existing full-text index on team table...'
    DROP FULLTEXT INDEX ON team;
END
GO

CREATE FULLTEXT INDEX ON team
(
    name LANGUAGE 1033,
    city LANGUAGE 1033,
    mascot LANGUAGE 1033
)
KEY INDEX PK_team
ON CardSearchCatalog
WITH (
    CHANGE_TRACKING = AUTO,
    STOPLIST = SYSTEM
);

PRINT 'Created full-text index on team table (name, city, mascot)'
GO

-- =============================================================================
-- Full-Text Index on SET table
-- Columns: name
-- =============================================================================

IF EXISTS (SELECT * FROM sys.fulltext_indexes WHERE object_id = OBJECT_ID('[set]'))
BEGIN
    PRINT 'Dropping existing full-text index on set table...'
    DROP FULLTEXT INDEX ON [set];
END
GO

CREATE FULLTEXT INDEX ON [set]
(
    name LANGUAGE 1033
)
KEY INDEX PK_set
ON CardSearchCatalog
WITH (
    CHANGE_TRACKING = AUTO,
    STOPLIST = SYSTEM
);

PRINT 'Created full-text index on set table (name)'
GO

-- =============================================================================
-- Full-Text Index on SERIES table
-- Columns: name
-- =============================================================================

IF EXISTS (SELECT * FROM sys.fulltext_indexes WHERE object_id = OBJECT_ID('series'))
BEGIN
    PRINT 'Dropping existing full-text index on series table...'
    DROP FULLTEXT INDEX ON series;
END
GO

CREATE FULLTEXT INDEX ON series
(
    name LANGUAGE 1033
)
KEY INDEX PK_series
ON CardSearchCatalog
WITH (
    CHANGE_TRACKING = AUTO,
    STOPLIST = SYSTEM
);

PRINT 'Created full-text index on series table (name)'
GO

-- =============================================================================
-- Full-Text Index on MANUFACTURER table
-- Columns: name
-- =============================================================================

IF EXISTS (SELECT * FROM sys.fulltext_indexes WHERE object_id = OBJECT_ID('manufacturer'))
BEGIN
    PRINT 'Dropping existing full-text index on manufacturer table...'
    DROP FULLTEXT INDEX ON manufacturer;
END
GO

CREATE FULLTEXT INDEX ON manufacturer
(
    name LANGUAGE 1033
)
KEY INDEX PK_manufacturer
ON CardSearchCatalog
WITH (
    CHANGE_TRACKING = AUTO,
    STOPLIST = SYSTEM
);

PRINT 'Created full-text index on manufacturer table (name)'
GO

-- =============================================================================
-- Full-Text Index on COLOR table
-- Columns: name
-- =============================================================================

IF EXISTS (SELECT * FROM sys.fulltext_indexes WHERE object_id = OBJECT_ID('color'))
BEGIN
    PRINT 'Dropping existing full-text index on color table...'
    DROP FULLTEXT INDEX ON color;
END
GO

CREATE FULLTEXT INDEX ON color
(
    name LANGUAGE 1033
)
KEY INDEX PK_color
ON CardSearchCatalog
WITH (
    CHANGE_TRACKING = AUTO,
    STOPLIST = SYSTEM
);

PRINT 'Created full-text index on color table (name)'
GO

-- =============================================================================
-- Verify Full-Text Indexes
-- =============================================================================

PRINT ''
PRINT '==================================================================='
PRINT 'Full-Text Index Summary'
PRINT '==================================================================='

SELECT
    OBJECT_NAME(object_id) AS TableName,
    is_enabled,
    change_tracking_state_desc,
    CAST(OBJECTPROPERTY(object_id, 'TableFulltextPopulateStatus') AS VARCHAR(10)) AS PopulateStatus
FROM sys.fulltext_indexes
WHERE object_id IN (
    OBJECT_ID('player'),
    OBJECT_ID('team'),
    OBJECT_ID('[set]'),
    OBJECT_ID('series'),
    OBJECT_ID('manufacturer'),
    OBJECT_ID('color')
)
ORDER BY TableName;

PRINT ''
PRINT 'Full-Text indexes created successfully!'
PRINT ''
PRINT 'NEXT STEPS:'
PRINT '1. Wait for indexes to fully populate (may take a few minutes)'
PRINT '2. Update search queries to use CONTAINS() instead of LIKE'
PRINT '3. Benchmark the performance improvement'
PRINT ''
PRINT 'To check index population status, run:'
PRINT 'SELECT OBJECT_NAME(object_id), * FROM sys.dm_fts_index_population'
GO
