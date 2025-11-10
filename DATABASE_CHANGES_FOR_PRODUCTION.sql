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
-- 2025-01-10: Add display_card field to player table
-- Status: PENDING
-- Description: Adds a nullable display_card field to the player table to store
--              a reference to the card that should be used as the player's
--              display image on player cards and detail pages.
-- ============================================================================

-- Add the display_card column
ALTER TABLE player
ADD display_card BIGINT NULL;

-- Add foreign key constraint to card table
ALTER TABLE player
ADD CONSTRAINT FK_player_display_card
FOREIGN KEY (display_card) REFERENCES card(card_id);

-- Add index for performance
CREATE INDEX IX_player_display_card ON player(display_card);

-- Verify the column was added
SELECT
    c.name as column_name,
    t.name as data_type,
    c.is_nullable,
    c.max_length
FROM sys.columns c
JOIN sys.types t ON c.user_type_id = t.user_type_id
WHERE c.object_id = OBJECT_ID('player')
AND c.name = 'display_card';

-- Verify the foreign key was added
SELECT
    fk.name as foreign_key_name,
    OBJECT_NAME(fk.parent_object_id) as table_name,
    COL_NAME(fc.parent_object_id, fc.parent_column_id) as column_name,
    OBJECT_NAME(fk.referenced_object_id) as referenced_table_name,
    COL_NAME(fc.referenced_object_id, fc.referenced_column_id) as referenced_column_name
FROM sys.foreign_keys fk
INNER JOIN sys.foreign_key_columns fc ON fk.object_id = fc.constraint_object_id
WHERE fk.name = 'FK_player_display_card';

-- ============================================================================
-- 2025-01-10: Add reference_user_card to card table for canonical images
-- Status: COMPLETED (Local: 2025-01-10, Production: PENDING)
-- Description: Adds a nullable reference_user_card field to the card table to
--              reference a user_card record that contains the canonical/official
--              images for this card. This allows cards to reference existing
--              community-uploaded photos without duplication.
-- ============================================================================

-- Add the reference_user_card column
ALTER TABLE card
ADD reference_user_card BIGINT NULL;

-- Add foreign key constraint to user_card table
ALTER TABLE card
ADD CONSTRAINT FK_card_reference_user_card
FOREIGN KEY (reference_user_card) REFERENCES user_card(user_card_id);

-- Add index for performance
CREATE INDEX IX_card_reference_user_card ON card(reference_user_card);

-- Verify the column was added
SELECT
    c.name as column_name,
    t.name as data_type,
    c.is_nullable,
    c.max_length
FROM sys.columns c
JOIN sys.types t ON c.user_type_id = t.user_type_id
WHERE c.object_id = OBJECT_ID('card')
AND c.name = 'reference_user_card';

-- Verify the foreign key was added
SELECT
    fk.name as foreign_key_name,
    OBJECT_NAME(fk.parent_object_id) as table_name,
    COL_NAME(fc.parent_object_id, fc.parent_column_id) as column_name,
    OBJECT_NAME(fk.referenced_object_id) as referenced_table_name,
    COL_NAME(fc.referenced_object_id, fc.referenced_column_id) as referenced_column_name
FROM sys.foreign_keys fk
INNER JOIN sys.foreign_key_columns fc ON fk.object_id = fc.constraint_object_id
WHERE fk.name = 'FK_card_reference_user_card';

-- ============================================================================
-- End of changes
-- ============================================================================
