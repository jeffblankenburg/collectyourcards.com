-- ============================================================================
-- DATABASE CHANGES FOR PRODUCTION
-- ============================================================================
-- This file contains all SQL scripts that need to be run on production
-- Run these scripts in order, marking each as completed after execution
-- ============================================================================

-- ============================================================================
-- 2025-01-XX: Add No-Name Teams for Import System
-- Status: PENDING
-- Description: Creates no-name teams for each organization plus one generic
--              no-name team. These are used during import when a player has
--              no team specified.
-- ============================================================================

SET IDENTITY_INSERT team ON;

-- Insert no-name teams for each organization (1-9) plus one with NULL organization
INSERT INTO team (team_Id, name, city, mascot, abbreviation, organization, created, primary_color, secondary_color, card_count, player_count) VALUES
(180, NULL, NULL, NULL, 'NONE', 1, GETDATE(), '#808080', '#A9A9A9', 0, 0),  -- MLB
(181, NULL, NULL, NULL, 'NONE', 2, GETDATE(), '#808080', '#A9A9A9', 0, 0),  -- NFL
(182, NULL, NULL, NULL, 'NONE', 3, GETDATE(), '#808080', '#A9A9A9', 0, 0),  -- NBA
(183, NULL, NULL, NULL, 'NONE', 4, GETDATE(), '#808080', '#A9A9A9', 0, 0),  -- NHL
(184, NULL, NULL, NULL, 'NONE', 5, GETDATE(), '#808080', '#A9A9A9', 0, 0),  -- NCAA
(185, NULL, NULL, NULL, 'NONE', 6, GETDATE(), '#808080', '#A9A9A9', 0, 0),  -- Minor League Baseball
(186, NULL, NULL, NULL, 'NONE', 7, GETDATE(), '#808080', '#A9A9A9', 0, 0),  -- MLS
(187, NULL, NULL, NULL, 'NONE', 8, GETDATE(), '#808080', '#A9A9A9', 0, 0),  -- World Baseball Classic
(188, NULL, NULL, NULL, 'NONE', 9, GETDATE(), '#808080', '#A9A9A9', 0, 0),  -- WNBA
(189, NULL, NULL, NULL, 'NONE', NULL, GETDATE(), '#808080', '#A9A9A9', 0, 0);  -- Generic (no organization)

SET IDENTITY_INSERT team OFF;

-- Verify the insertion
SELECT team_id, name, organization, abbreviation, primary_color, secondary_color
FROM team
WHERE team_id >= 180
ORDER BY organization DESC;

-- ============================================================================
-- 2025-01-XX: Update Comment Type Constraint for Blog Posts
-- Status: PENDING
-- Description: Updates the CHECK constraint on universal_comments.comment_type
--              to allow 'blog_post' as a valid comment type for WordPress blog
--              post comments.
-- ============================================================================

-- Drop the existing constraint
ALTER TABLE universal_comments
DROP CONSTRAINT CK__universal__comme__6CA31EA0;

-- Add updated constraint with blog_post included
ALTER TABLE universal_comments
ADD CONSTRAINT CK__universal__comme__6CA31EA0
CHECK (comment_type IN ('card', 'series', 'set', 'blog_post'));

-- Verify the constraint
SELECT definition
FROM sys.check_constraints
WHERE name = 'CK__universal__comme__6CA31EA0';

-- ============================================================================
-- End of changes
-- ============================================================================
