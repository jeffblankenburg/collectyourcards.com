-- =============================================
-- Add Sport Column to Organization Table
-- Purpose: Enable sport-based slug disambiguation (e.g., 2025-donruss-mlb vs 2025-donruss-nfl)
-- Date: 2025-01-04
-- =============================================

-- Add sport column to organization table
ALTER TABLE organization ADD sport NVARCHAR(50) NULL;

GO

-- Populate sport column based on known organizations
-- You'll need to update these based on your actual organization names

UPDATE organization SET sport = 'mlb' WHERE abbreviation IN ('MLB', 'AL', 'NL');
UPDATE organization SET sport = 'nfl' WHERE abbreviation IN ('NFL', 'AFC', 'NFC');
UPDATE organization SET sport = 'nba' WHERE abbreviation IN ('NBA');
UPDATE organization SET sport = 'nhl' WHERE abbreviation IN ('NHL');
UPDATE organization SET sport = 'ncaa' WHERE name LIKE '%NCAA%' OR name LIKE '%College%';
UPDATE organization SET sport = 'mls' WHERE abbreviation IN ('MLS');

-- Make column NOT NULL after populating (optional - comment out if you want to allow NULL)
-- ALTER TABLE organization ALTER COLUMN sport NVARCHAR(50) NOT NULL;

GO

-- Verification
SELECT organization_id, name, abbreviation, sport
FROM organization
ORDER BY sport, name;

GO

PRINT 'Sport column added and populated successfully.';
PRINT 'Please review the results and update any missing or incorrect sport values.';
