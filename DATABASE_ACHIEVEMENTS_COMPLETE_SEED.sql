-- Complete Achievement System Seeding
-- This will insert ALL achievements from ACHIEVEMENTS.md
USE CollectYourCards;
GO

PRINT 'Seeding Complete Achievement System...';

-- Clear existing achievements if needed
-- DELETE FROM user_achievements;
-- DELETE FROM achievement_series_members;
-- DELETE FROM achievement_series;
-- DELETE FROM achievements;
-- DELETE FROM achievement_categories;

-- Insert all achievement categories
IF NOT EXISTS (SELECT * FROM achievement_categories WHERE name = 'Collection Milestones')
BEGIN
    DELETE FROM achievement_categories; -- Start fresh
    
    INSERT INTO achievement_categories (name, description, icon, display_order) VALUES
    ('Collection Milestones', 'Achievements for growing your card collection', '📦', 1),
    ('Rookie Cards', 'Achievements for collecting rookie cards', '🌟', 2),
    ('Special Cards', 'Achievements for autographs, relics, and numbered cards', '✨', 3),
    ('Team Collections', 'Achievements for team-specific collections', '🏆', 4),
    ('Player Collections', 'Achievements for player-specific collections', '👤', 5),
    ('Set Completion', 'Achievements for completing sets and series', '📚', 6),
    ('Trading & Market', 'Achievements for trading and market activities', '💱', 7),
    ('Value & Investment', 'Achievements for collection value milestones', '💰', 8),
    ('Community & Social', 'Achievements for community participation', '👥', 9),
    ('Streaks & Activity', 'Achievements for consistent activity', '🔥', 10),
    ('Seasonal & Events', 'Limited-time and seasonal achievements', '🎉', 11),
    ('Expertise & Knowledge', 'Achievements for demonstrating card knowledge', '🎓', 12),
    ('Rarity Hunter', 'Achievements for finding rare and unique cards', '💎', 13),
    ('Grading & Authentication', 'Achievements for graded card collections', '🏅', 14),
    ('Legacy & Prestige', 'Elite achievements for dedicated collectors', '👑', 15);
    
    PRINT '✓ Inserted 15 achievement categories';
END
GO

-- Get category IDs for reference
DECLARE @cat1 BIGINT = (SELECT category_id FROM achievement_categories WHERE name = 'Collection Milestones');
DECLARE @cat2 BIGINT = (SELECT category_id FROM achievement_categories WHERE name = 'Rookie Cards');
DECLARE @cat3 BIGINT = (SELECT category_id FROM achievement_categories WHERE name = 'Special Cards');
DECLARE @cat4 BIGINT = (SELECT category_id FROM achievement_categories WHERE name = 'Team Collections');
DECLARE @cat5 BIGINT = (SELECT category_id FROM achievement_categories WHERE name = 'Player Collections');
DECLARE @cat6 BIGINT = (SELECT category_id FROM achievement_categories WHERE name = 'Set Completion');
DECLARE @cat7 BIGINT = (SELECT category_id FROM achievement_categories WHERE name = 'Trading & Market');
DECLARE @cat8 BIGINT = (SELECT category_id FROM achievement_categories WHERE name = 'Value & Investment');
DECLARE @cat9 BIGINT = (SELECT category_id FROM achievement_categories WHERE name = 'Community & Social');
DECLARE @cat10 BIGINT = (SELECT category_id FROM achievement_categories WHERE name = 'Streaks & Activity');
DECLARE @cat11 BIGINT = (SELECT category_id FROM achievement_categories WHERE name = 'Seasonal & Events');
DECLARE @cat12 BIGINT = (SELECT category_id FROM achievement_categories WHERE name = 'Expertise & Knowledge');
DECLARE @cat13 BIGINT = (SELECT category_id FROM achievement_categories WHERE name = 'Rarity Hunter');
DECLARE @cat14 BIGINT = (SELECT category_id FROM achievement_categories WHERE name = 'Grading & Authentication');
DECLARE @cat15 BIGINT = (SELECT category_id FROM achievement_categories WHERE name = 'Legacy & Prestige');

-- ============================================================================
-- CATEGORY 1: COLLECTION MILESTONES (Card Count Achievements)
-- ============================================================================

INSERT INTO achievements (category_id, subcategory, name, description, points, tier, requirement_type, requirement_value, requirement_query, is_active) VALUES
-- Basic Collection Size
(@cat1, 'Card Count', 'First Card', 'Add your first card to your collection', 5, 'Common', 'count', 1, 'SELECT COUNT(*) FROM user_card WHERE [user] = @user_id', 1),
(@cat1, 'Card Count', 'Starting Five', 'Collect 5 cards', 5, 'Common', 'count', 5, 'SELECT COUNT(*) FROM user_card WHERE [user] = @user_id', 1),
(@cat1, 'Card Count', 'Double Digits', 'Collect 10 cards', 5, 'Common', 'count', 10, 'SELECT COUNT(*) FROM user_card WHERE [user] = @user_id', 1),
(@cat1, 'Card Count', 'Quarter Century', 'Collect 25 cards', 10, 'Common', 'count', 25, 'SELECT COUNT(*) FROM user_card WHERE [user] = @user_id', 1),
(@cat1, 'Card Count', 'Half Century', 'Collect 50 cards', 15, 'Uncommon', 'count', 50, 'SELECT COUNT(*) FROM user_card WHERE [user] = @user_id', 1),
(@cat1, 'Card Count', 'Century Mark', 'Collect 100 cards', 20, 'Uncommon', 'count', 100, 'SELECT COUNT(*) FROM user_card WHERE [user] = @user_id', 1),
(@cat1, 'Card Count', 'Double Century', 'Collect 200 cards', 25, 'Uncommon', 'count', 200, 'SELECT COUNT(*) FROM user_card WHERE [user] = @user_id', 1),
(@cat1, 'Card Count', 'Quincentennial', 'Collect 500 cards', 30, 'Rare', 'count', 500, 'SELECT COUNT(*) FROM user_card WHERE [user] = @user_id', 1),
(@cat1, 'Card Count', 'Millennium Collector', 'Collect 1,000 cards', 50, 'Rare', 'count', 1000, 'SELECT COUNT(*) FROM user_card WHERE [user] = @user_id', 1),
(@cat1, 'Card Count', '2K Club', 'Collect 2,000 cards', 75, 'Epic', 'count', 2000, 'SELECT COUNT(*) FROM user_card WHERE [user] = @user_id', 1),
(@cat1, 'Card Count', '5K Elite', 'Collect 5,000 cards', 100, 'Epic', 'count', 5000, 'SELECT COUNT(*) FROM user_card WHERE [user] = @user_id', 1),
(@cat1, 'Card Count', '10K Legend', 'Collect 10,000 cards', 150, 'Legendary', 'count', 10000, 'SELECT COUNT(*) FROM user_card WHERE [user] = @user_id', 1),
(@cat1, 'Card Count', '25K Master', 'Collect 25,000 cards', 250, 'Legendary', 'count', 25000, 'SELECT COUNT(*) FROM user_card WHERE [user] = @user_id', 1),
(@cat1, 'Card Count', '50K Titan', 'Collect 50,000 cards', 500, 'Mythic', 'count', 50000, 'SELECT COUNT(*) FROM user_card WHERE [user] = @user_id', 1),
(@cat1, 'Card Count', '100K God-Tier', 'Collect 100,000 cards', 1000, 'Mythic', 'count', 100000, 'SELECT COUNT(*) FROM user_card WHERE [user] = @user_id', 1),

-- Unique Players
(@cat1, 'Unique Players', 'Rookie Collector', 'Collect cards from 5 different players', 5, 'Common', 'unique', 5, 'SELECT COUNT(DISTINCT pt.player) FROM user_card uc INNER JOIN card c ON uc.card = c.card_id INNER JOIN card_player_team cpt ON c.card_id = cpt.card INNER JOIN player_team pt ON cpt.player_team = pt.player_team_id WHERE uc.[user] = @user_id', 1),
(@cat1, 'Unique Players', 'Team Builder', 'Collect cards from 10 different players', 10, 'Common', 'unique', 10, 'SELECT COUNT(DISTINCT pt.player) FROM user_card uc INNER JOIN card c ON uc.card = c.card_id INNER JOIN card_player_team cpt ON c.card_id = cpt.card INNER JOIN player_team pt ON cpt.player_team = pt.player_team_id WHERE uc.[user] = @user_id', 1),
(@cat1, 'Unique Players', 'Roster Deep', 'Collect cards from 25 different players', 15, 'Uncommon', 'unique', 25, 'SELECT COUNT(DISTINCT pt.player) FROM user_card uc INNER JOIN card c ON uc.card = c.card_id INNER JOIN card_player_team cpt ON c.card_id = cpt.card INNER JOIN player_team pt ON cpt.player_team = pt.player_team_id WHERE uc.[user] = @user_id', 1),
(@cat1, 'Unique Players', 'League Wide', 'Collect cards from 50 different players', 25, 'Uncommon', 'unique', 50, 'SELECT COUNT(DISTINCT pt.player) FROM user_card uc INNER JOIN card c ON uc.card = c.card_id INNER JOIN card_player_team cpt ON c.card_id = cpt.card INNER JOIN player_team pt ON cpt.player_team = pt.player_team_id WHERE uc.[user] = @user_id', 1),
(@cat1, 'Unique Players', 'Century of Players', 'Collect cards from 100 different players', 30, 'Rare', 'unique', 100, 'SELECT COUNT(DISTINCT pt.player) FROM user_card uc INNER JOIN card c ON uc.card = c.card_id INNER JOIN card_player_team cpt ON c.card_id = cpt.card INNER JOIN player_team pt ON cpt.player_team = pt.player_team_id WHERE uc.[user] = @user_id', 1),
(@cat1, 'Unique Players', 'Player Encyclopedia', 'Collect cards from 250 different players', 50, 'Rare', 'unique', 250, 'SELECT COUNT(DISTINCT pt.player) FROM user_card uc INNER JOIN card c ON uc.card = c.card_id INNER JOIN card_player_team cpt ON c.card_id = cpt.card INNER JOIN player_team pt ON cpt.player_team = pt.player_team_id WHERE uc.[user] = @user_id', 1),
(@cat1, 'Unique Players', 'Hall of Names', 'Collect cards from 500 different players', 75, 'Epic', 'unique', 500, 'SELECT COUNT(DISTINCT pt.player) FROM user_card uc INNER JOIN card c ON uc.card = c.card_id INNER JOIN card_player_team cpt ON c.card_id = cpt.card INNER JOIN player_team pt ON cpt.player_team = pt.player_team_id WHERE uc.[user] = @user_id', 1),
(@cat1, 'Unique Players', 'Legend Collector', 'Collect cards from 1,000 different players', 100, 'Epic', 'unique', 1000, 'SELECT COUNT(DISTINCT pt.player) FROM user_card uc INNER JOIN card c ON uc.card = c.card_id INNER JOIN card_player_team cpt ON c.card_id = cpt.card INNER JOIN player_team pt ON cpt.player_team = pt.player_team_id WHERE uc.[user] = @user_id', 1),

-- Unique Teams
(@cat1, 'Unique Teams', 'Team Spirit', 'Collect cards from 5 different teams', 10, 'Common', 'unique', 5, 'SELECT COUNT(DISTINCT pt.team) FROM user_card uc INNER JOIN card c ON uc.card = c.card_id INNER JOIN card_player_team cpt ON c.card_id = cpt.card INNER JOIN player_team pt ON cpt.player_team = pt.player_team_id WHERE uc.[user] = @user_id', 1),
(@cat1, 'Unique Teams', 'Division Rival', 'Collect cards from 10 different teams', 15, 'Uncommon', 'unique', 10, 'SELECT COUNT(DISTINCT pt.team) FROM user_card uc INNER JOIN card c ON uc.card = c.card_id INNER JOIN card_player_team cpt ON c.card_id = cpt.card INNER JOIN player_team pt ON cpt.player_team = pt.player_team_id WHERE uc.[user] = @user_id', 1),
(@cat1, 'Unique Teams', 'Conference Complete', 'Collect cards from 15 different teams', 25, 'Uncommon', 'unique', 15, 'SELECT COUNT(DISTINCT pt.team) FROM user_card uc INNER JOIN card c ON uc.card = c.card_id INNER JOIN card_player_team cpt ON c.card_id = cpt.card INNER JOIN player_team pt ON cpt.player_team = pt.player_team_id WHERE uc.[user] = @user_id', 1),
(@cat1, 'Unique Teams', 'League Representative', 'Collect cards from 20 different teams', 30, 'Rare', 'unique', 20, 'SELECT COUNT(DISTINCT pt.team) FROM user_card uc INNER JOIN card c ON uc.card = c.card_id INNER JOIN card_player_team cpt ON c.card_id = cpt.card INNER JOIN player_team pt ON cpt.player_team = pt.player_team_id WHERE uc.[user] = @user_id', 1),
(@cat1, 'Unique Teams', 'Multi-Sport Master', 'Collect cards from 30 different teams', 50, 'Rare', 'unique', 30, 'SELECT COUNT(DISTINCT pt.team) FROM user_card uc INNER JOIN card c ON uc.card = c.card_id INNER JOIN card_player_team cpt ON c.card_id = cpt.card INNER JOIN player_team pt ON cpt.player_team = pt.player_team_id WHERE uc.[user] = @user_id', 1);

PRINT '✓ Inserted Collection Milestone achievements (28 total)';

-- ============================================================================
-- CATEGORY 2: ROOKIE CARDS
-- ============================================================================

INSERT INTO achievements (category_id, subcategory, name, description, points, tier, requirement_type, requirement_value, requirement_query, is_active) VALUES
-- Basic Rookie Collection
(@cat2, 'Rookie Collection', 'First Rookie', 'Add your first rookie card', 10, 'Common', 'count', 1, 'SELECT COUNT(*) FROM user_card uc INNER JOIN card c ON uc.card = c.card_id WHERE uc.[user] = @user_id AND c.is_rookie = 1', 1),
(@cat2, 'Rookie Collection', 'Rookie Five', 'Collect 5 rookie cards', 15, 'Common', 'count', 5, 'SELECT COUNT(*) FROM user_card uc INNER JOIN card c ON uc.card = c.card_id WHERE uc.[user] = @user_id AND c.is_rookie = 1', 1),
(@cat2, 'Rookie Collection', 'Rookie Squad', 'Collect 10 rookie cards', 20, 'Uncommon', 'count', 10, 'SELECT COUNT(*) FROM user_card uc INNER JOIN card c ON uc.card = c.card_id WHERE uc.[user] = @user_id AND c.is_rookie = 1', 1),
(@cat2, 'Rookie Collection', 'Draft Class', 'Collect 25 rookie cards', 25, 'Uncommon', 'count', 25, 'SELECT COUNT(*) FROM user_card uc INNER JOIN card c ON uc.card = c.card_id WHERE uc.[user] = @user_id AND c.is_rookie = 1', 1),
(@cat2, 'Rookie Collection', 'Rookie Showcase', 'Collect 50 rookie cards', 30, 'Rare', 'count', 50, 'SELECT COUNT(*) FROM user_card uc INNER JOIN card c ON uc.card = c.card_id WHERE uc.[user] = @user_id AND c.is_rookie = 1', 1),
(@cat2, 'Rookie Collection', 'Future Hall of Famers', 'Collect 100 rookie cards', 50, 'Rare', 'count', 100, 'SELECT COUNT(*) FROM user_card uc INNER JOIN card c ON uc.card = c.card_id WHERE uc.[user] = @user_id AND c.is_rookie = 1', 1),
(@cat2, 'Rookie Collection', 'Rookie Encyclopedia', 'Collect 250 rookie cards', 75, 'Epic', 'count', 250, 'SELECT COUNT(*) FROM user_card uc INNER JOIN card c ON uc.card = c.card_id WHERE uc.[user] = @user_id AND c.is_rookie = 1', 1),
(@cat2, 'Rookie Collection', 'Rookie Master', 'Collect 500 rookie cards', 100, 'Epic', 'count', 500, 'SELECT COUNT(*) FROM user_card uc INNER JOIN card c ON uc.card = c.card_id WHERE uc.[user] = @user_id AND c.is_rookie = 1', 1),
(@cat2, 'Rookie Collection', 'Rookie Legend', 'Collect 1,000 rookie cards', 150, 'Legendary', 'count', 1000, 'SELECT COUNT(*) FROM user_card uc INNER JOIN card c ON uc.card = c.card_id WHERE uc.[user] = @user_id AND c.is_rookie = 1', 1),
(@cat2, 'Rookie Collection', 'Rookie God', 'Collect 2,500 rookie cards', 250, 'Legendary', 'count', 2500, 'SELECT COUNT(*) FROM user_card uc INNER JOIN card c ON uc.card = c.card_id WHERE uc.[user] = @user_id AND c.is_rookie = 1', 1),
(@cat2, 'Rookie Collection', 'Rookie Titan', 'Collect 5,000 rookie cards', 500, 'Mythic', 'count', 5000, 'SELECT COUNT(*) FROM user_card uc INNER JOIN card c ON uc.card = c.card_id WHERE uc.[user] = @user_id AND c.is_rookie = 1', 1);

PRINT '✓ Inserted Rookie Card achievements (11 total)';

-- ============================================================================
-- CATEGORY 3: SPECIAL CARDS
-- ============================================================================

INSERT INTO achievements (category_id, subcategory, name, description, points, tier, requirement_type, requirement_value, requirement_query, is_active) VALUES
-- Autographs
(@cat3, 'Autographs', 'First Signature', 'Add your first autographed card', 25, 'Uncommon', 'count', 1, 'SELECT COUNT(*) FROM user_card uc INNER JOIN card c ON uc.card = c.card_id WHERE uc.[user] = @user_id AND c.is_autograph = 1', 1),
(@cat3, 'Autographs', 'Pen Pal', 'Collect 5 autographed cards', 35, 'Rare', 'count', 5, 'SELECT COUNT(*) FROM user_card uc INNER JOIN card c ON uc.card = c.card_id WHERE uc.[user] = @user_id AND c.is_autograph = 1', 1),
(@cat3, 'Autographs', 'Signature Collection', 'Collect 10 autographed cards', 50, 'Rare', 'count', 10, 'SELECT COUNT(*) FROM user_card uc INNER JOIN card c ON uc.card = c.card_id WHERE uc.[user] = @user_id AND c.is_autograph = 1', 1),
(@cat3, 'Autographs', 'Autograph Hunter', 'Collect 25 autographed cards', 75, 'Epic', 'count', 25, 'SELECT COUNT(*) FROM user_card uc INNER JOIN card c ON uc.card = c.card_id WHERE uc.[user] = @user_id AND c.is_autograph = 1', 1),
(@cat3, 'Autographs', 'Signature Master', 'Collect 50 autographed cards', 100, 'Epic', 'count', 50, 'SELECT COUNT(*) FROM user_card uc INNER JOIN card c ON uc.card = c.card_id WHERE uc.[user] = @user_id AND c.is_autograph = 1', 1),
(@cat3, 'Autographs', 'Hall of Signatures', 'Collect 100 autographed cards', 150, 'Legendary', 'count', 100, 'SELECT COUNT(*) FROM user_card uc INNER JOIN card c ON uc.card = c.card_id WHERE uc.[user] = @user_id AND c.is_autograph = 1', 1),
(@cat3, 'Autographs', 'Signature Legend', 'Collect 250 autographed cards', 250, 'Legendary', 'count', 250, 'SELECT COUNT(*) FROM user_card uc INNER JOIN card c ON uc.card = c.card_id WHERE uc.[user] = @user_id AND c.is_autograph = 1', 1),
(@cat3, 'Autographs', 'Signature God', 'Collect 500 autographed cards', 500, 'Mythic', 'count', 500, 'SELECT COUNT(*) FROM user_card uc INNER JOIN card c ON uc.card = c.card_id WHERE uc.[user] = @user_id AND c.is_autograph = 1', 1),

-- Relics
(@cat3, 'Relics', 'First Relic', 'Add your first relic card', 25, 'Uncommon', 'count', 1, 'SELECT COUNT(*) FROM user_card uc INNER JOIN card c ON uc.card = c.card_id WHERE uc.[user] = @user_id AND c.is_relic = 1', 1),
(@cat3, 'Relics', 'Relic Hunter', 'Collect 5 relic cards', 35, 'Rare', 'count', 5, 'SELECT COUNT(*) FROM user_card uc INNER JOIN card c ON uc.card = c.card_id WHERE uc.[user] = @user_id AND c.is_relic = 1', 1),
(@cat3, 'Relics', 'Memory Lane', 'Collect 10 relic cards', 50, 'Rare', 'count', 10, 'SELECT COUNT(*) FROM user_card uc INNER JOIN card c ON uc.card = c.card_id WHERE uc.[user] = @user_id AND c.is_relic = 1', 1),
(@cat3, 'Relics', 'Relic Collector', 'Collect 25 relic cards', 75, 'Epic', 'count', 25, 'SELECT COUNT(*) FROM user_card uc INNER JOIN card c ON uc.card = c.card_id WHERE uc.[user] = @user_id AND c.is_relic = 1', 1),
(@cat3, 'Relics', 'Relic Master', 'Collect 50 relic cards', 100, 'Epic', 'count', 50, 'SELECT COUNT(*) FROM user_card uc INNER JOIN card c ON uc.card = c.card_id WHERE uc.[user] = @user_id AND c.is_relic = 1', 1),
(@cat3, 'Relics', 'Museum Curator', 'Collect 100 relic cards', 150, 'Legendary', 'count', 100, 'SELECT COUNT(*) FROM user_card uc INNER JOIN card c ON uc.card = c.card_id WHERE uc.[user] = @user_id AND c.is_relic = 1', 1),
(@cat3, 'Relics', 'Relic Legend', 'Collect 250 relic cards', 250, 'Legendary', 'count', 250, 'SELECT COUNT(*) FROM user_card uc INNER JOIN card c ON uc.card = c.card_id WHERE uc.[user] = @user_id AND c.is_relic = 1', 1),
(@cat3, 'Relics', 'Relic God', 'Collect 500 relic cards', 500, 'Mythic', 'count', 500, 'SELECT COUNT(*) FROM user_card uc INNER JOIN card c ON uc.card = c.card_id WHERE uc.[user] = @user_id AND c.is_relic = 1', 1),

-- Serial Numbered
(@cat3, 'Serial Numbers', 'First Serial', 'Add your first serial numbered card', 15, 'Uncommon', 'count', 1, 'SELECT COUNT(*) FROM user_card WHERE [user] = @user_id AND serial_number IS NOT NULL', 1),
(@cat3, 'Serial Numbers', 'Low Numbers', 'Collect 5 serial numbered cards', 25, 'Uncommon', 'count', 5, 'SELECT COUNT(*) FROM user_card WHERE [user] = @user_id AND serial_number IS NOT NULL', 1),
(@cat3, 'Serial Numbers', 'Serial Hunter', 'Collect 10 serial numbered cards', 35, 'Rare', 'count', 10, 'SELECT COUNT(*) FROM user_card WHERE [user] = @user_id AND serial_number IS NOT NULL', 1),
(@cat3, 'Serial Numbers', 'Serial Master', 'Collect 25 serial numbered cards', 50, 'Rare', 'count', 25, 'SELECT COUNT(*) FROM user_card WHERE [user] = @user_id AND serial_number IS NOT NULL', 1),
(@cat3, 'Serial Numbers', 'Serial Legend', 'Collect 50 serial numbered cards', 75, 'Epic', 'count', 50, 'SELECT COUNT(*) FROM user_card WHERE [user] = @user_id AND serial_number IS NOT NULL', 1);

PRINT '✓ Inserted Special Card achievements (21 total)';

-- ============================================================================
-- CATEGORY 8: VALUE & INVESTMENT
-- ============================================================================

INSERT INTO achievements (category_id, subcategory, name, description, points, tier, requirement_type, requirement_value, requirement_query, is_active) VALUES
-- Collection Value Milestones
(@cat8, 'Collection Value', 'First Dollar', 'Collection value reaches $100', 10, 'Common', 'value', 100, 'SELECT ISNULL(SUM(CAST(ISNULL(uc.current_value, uc.estimated_value) AS DECIMAL(18,2))), 0) FROM user_card uc WHERE uc.[user] = @user_id', 1),
(@cat8, 'Collection Value', 'Benjamin Club', 'Collection value reaches $500', 20, 'Uncommon', 'value', 500, 'SELECT ISNULL(SUM(CAST(ISNULL(uc.current_value, uc.estimated_value) AS DECIMAL(18,2))), 0) FROM user_card uc WHERE uc.[user] = @user_id', 1),
(@cat8, 'Collection Value', 'Grand Collection', 'Collection value reaches $1,000', 30, 'Rare', 'value', 1000, 'SELECT ISNULL(SUM(CAST(ISNULL(uc.current_value, uc.estimated_value) AS DECIMAL(18,2))), 0) FROM user_card uc WHERE uc.[user] = @user_id', 1),
(@cat8, 'Collection Value', 'Five Grand', 'Collection value reaches $5,000', 50, 'Rare', 'value', 5000, 'SELECT ISNULL(SUM(CAST(ISNULL(uc.current_value, uc.estimated_value) AS DECIMAL(18,2))), 0) FROM user_card uc WHERE uc.[user] = @user_id', 1),
(@cat8, 'Collection Value', 'Ten Grand', 'Collection value reaches $10,000', 75, 'Epic', 'value', 10000, 'SELECT ISNULL(SUM(CAST(ISNULL(uc.current_value, uc.estimated_value) AS DECIMAL(18,2))), 0) FROM user_card uc WHERE uc.[user] = @user_id', 1),
(@cat8, 'Collection Value', 'Quarter Million', 'Collection value reaches $25,000', 100, 'Epic', 'value', 25000, 'SELECT ISNULL(SUM(CAST(ISNULL(uc.current_value, uc.estimated_value) AS DECIMAL(18,2))), 0) FROM user_card uc WHERE uc.[user] = @user_id', 1),
(@cat8, 'Collection Value', 'Half Million', 'Collection value reaches $50,000', 150, 'Legendary', 'value', 50000, 'SELECT ISNULL(SUM(CAST(ISNULL(uc.current_value, uc.estimated_value) AS DECIMAL(18,2))), 0) FROM user_card uc WHERE uc.[user] = @user_id', 1),
(@cat8, 'Collection Value', 'Millionaire', 'Collection value reaches $100,000', 250, 'Legendary', 'value', 100000, 'SELECT ISNULL(SUM(CAST(ISNULL(uc.current_value, uc.estimated_value) AS DECIMAL(18,2))), 0) FROM user_card uc WHERE uc.[user] = @user_id', 1),
(@cat8, 'Collection Value', 'Multi-Millionaire', 'Collection value reaches $500,000', 500, 'Mythic', 'value', 500000, 'SELECT ISNULL(SUM(CAST(ISNULL(uc.current_value, uc.estimated_value) AS DECIMAL(18,2))), 0) FROM user_card uc WHERE uc.[user] = @user_id', 1),
(@cat8, 'Collection Value', 'Museum Grade', 'Collection value reaches $1,000,000', 1000, 'Mythic', 'value', 1000000, 'SELECT ISNULL(SUM(CAST(ISNULL(uc.current_value, uc.estimated_value) AS DECIMAL(18,2))), 0) FROM user_card uc WHERE uc.[user] = @user_id', 1);

PRINT '✓ Inserted Value & Investment achievements (10 total)';

-- ============================================================================
-- CATEGORY 14: GRADING & AUTHENTICATION
-- ============================================================================

INSERT INTO achievements (category_id, subcategory, name, description, points, tier, requirement_type, requirement_value, requirement_query, is_active) VALUES
-- Graded Cards
(@cat14, 'Graded Cards', 'First Graded', 'Add your first graded card', 20, 'Uncommon', 'count', 1, 'SELECT COUNT(*) FROM user_card WHERE [user] = @user_id AND grading_agency IS NOT NULL AND grade IS NOT NULL', 1),
(@cat14, 'Graded Cards', 'Graded Five', 'Collect 5 graded cards', 30, 'Rare', 'count', 5, 'SELECT COUNT(*) FROM user_card WHERE [user] = @user_id AND grading_agency IS NOT NULL AND grade IS NOT NULL', 1),
(@cat14, 'Graded Cards', 'Graded Gallery', 'Collect 10 graded cards', 40, 'Rare', 'count', 10, 'SELECT COUNT(*) FROM user_card WHERE [user] = @user_id AND grading_agency IS NOT NULL AND grade IS NOT NULL', 1),
(@cat14, 'Graded Cards', 'Grade School', 'Collect 25 graded cards', 50, 'Rare', 'count', 25, 'SELECT COUNT(*) FROM user_card WHERE [user] = @user_id AND grading_agency IS NOT NULL AND grade IS NOT NULL', 1),
(@cat14, 'Graded Cards', 'Grade Master', 'Collect 50 graded cards', 75, 'Epic', 'count', 50, 'SELECT COUNT(*) FROM user_card WHERE [user] = @user_id AND grading_agency IS NOT NULL AND grade IS NOT NULL', 1),
(@cat14, 'Graded Cards', 'Grade Legend', 'Collect 100 graded cards', 100, 'Epic', 'count', 100, 'SELECT COUNT(*) FROM user_card WHERE [user] = @user_id AND grading_agency IS NOT NULL AND grade IS NOT NULL', 1),

-- High Grade Cards
(@cat14, 'High Grades', 'Gem Mint 10', 'Own a PSA/BGS 10 graded card', 50, 'Rare', 'count', 1, 'SELECT COUNT(*) FROM user_card WHERE [user] = @user_id AND grade = 10', 1),
(@cat14, 'High Grades', 'Perfect Five', 'Own 5 PSA/BGS 10 graded cards', 75, 'Epic', 'count', 5, 'SELECT COUNT(*) FROM user_card WHERE [user] = @user_id AND grade = 10', 1),
(@cat14, 'High Grades', 'Perfect Ten', 'Own 10 PSA/BGS 10 graded cards', 100, 'Epic', 'count', 10, 'SELECT COUNT(*) FROM user_card WHERE [user] = @user_id AND grade = 10', 1),
(@cat14, 'High Grades', 'Perfect Collection', 'Own 25 PSA/BGS 10 graded cards', 150, 'Legendary', 'count', 25, 'SELECT COUNT(*) FROM user_card WHERE [user] = @user_id AND grade = 10', 1);

PRINT '✓ Inserted Grading & Authentication achievements (10 total)';

-- ============================================================================
-- CATEGORY 9: COMMUNITY & SOCIAL
-- ============================================================================

INSERT INTO achievements (category_id, subcategory, name, description, points, tier, requirement_type, requirement_value, requirement_query, is_active) VALUES
-- Comments & Discussion
(@cat9, 'Comments', 'First Comment', 'Leave your first comment', 5, 'Common', 'count', 1, 'SELECT COUNT(*) FROM universal_comments WHERE user_id = @user_id', 1),
(@cat9, 'Comments', 'Conversationalist', 'Leave 10 comments', 10, 'Common', 'count', 10, 'SELECT COUNT(*) FROM universal_comments WHERE user_id = @user_id', 1),
(@cat9, 'Comments', 'Discussion Leader', 'Leave 50 comments', 20, 'Uncommon', 'count', 50, 'SELECT COUNT(*) FROM universal_comments WHERE user_id = @user_id', 1),
(@cat9, 'Comments', 'Community Voice', 'Leave 100 comments', 30, 'Rare', 'count', 100, 'SELECT COUNT(*) FROM universal_comments WHERE user_id = @user_id', 1),
(@cat9, 'Comments', 'Discussion Master', 'Leave 250 comments', 50, 'Rare', 'count', 250, 'SELECT COUNT(*) FROM universal_comments WHERE user_id = @user_id', 1),
(@cat9, 'Comments', 'Forum Legend', 'Leave 500 comments', 75, 'Epic', 'count', 500, 'SELECT COUNT(*) FROM universal_comments WHERE user_id = @user_id', 1),
(@cat9, 'Comments', 'Community Pillar', 'Leave 1,000 comments', 100, 'Epic', 'count', 1000, 'SELECT COUNT(*) FROM universal_comments WHERE user_id = @user_id', 1),
(@cat9, 'Comments', 'Discussion God', 'Leave 2,500 comments', 150, 'Legendary', 'count', 2500, 'SELECT COUNT(*) FROM universal_comments WHERE user_id = @user_id', 1);

PRINT '✓ Inserted Community & Social achievements (8 total)';

-- ============================================================================
-- CATEGORY 10: STREAKS & ACTIVITY
-- ============================================================================

INSERT INTO achievements (category_id, subcategory, name, description, points, tier, requirement_type, requirement_value, requirement_query, is_active) VALUES
-- Login Streaks
(@cat10, 'Login Streaks', 'Welcome Back', 'Log in 2 days in a row', 5, 'Common', 'streak', 2, 'SELECT ISNULL(MAX(longest_count), 0) FROM user_streaks WHERE user_id = @user_id AND streak_type = ''login''', 1),
(@cat10, 'Login Streaks', 'Regular Visitor', '7-day login streak', 10, 'Common', 'streak', 7, 'SELECT ISNULL(MAX(longest_count), 0) FROM user_streaks WHERE user_id = @user_id AND streak_type = ''login''', 1),
(@cat10, 'Login Streaks', 'Weekly Warrior', '14-day login streak', 15, 'Uncommon', 'streak', 14, 'SELECT ISNULL(MAX(longest_count), 0) FROM user_streaks WHERE user_id = @user_id AND streak_type = ''login''', 1),
(@cat10, 'Login Streaks', 'Dedicated Collector', '30-day login streak', 25, 'Uncommon', 'streak', 30, 'SELECT ISNULL(MAX(longest_count), 0) FROM user_streaks WHERE user_id = @user_id AND streak_type = ''login''', 1),
(@cat10, 'Login Streaks', 'Daily Devotion', '60-day login streak', 40, 'Rare', 'streak', 60, 'SELECT ISNULL(MAX(longest_count), 0) FROM user_streaks WHERE user_id = @user_id AND streak_type = ''login''', 1),
(@cat10, 'Login Streaks', 'Quarter Year', '90-day login streak', 60, 'Rare', 'streak', 90, 'SELECT ISNULL(MAX(longest_count), 0) FROM user_streaks WHERE user_id = @user_id AND streak_type = ''login''', 1),
(@cat10, 'Login Streaks', 'Dedication Incarnate', '180-day login streak', 75, 'Epic', 'streak', 180, 'SELECT ISNULL(MAX(longest_count), 0) FROM user_streaks WHERE user_id = @user_id AND streak_type = ''login''', 1),
(@cat10, 'Login Streaks', 'Year Long Commitment', '365-day login streak', 150, 'Legendary', 'streak', 365, 'SELECT ISNULL(MAX(longest_count), 0) FROM user_streaks WHERE user_id = @user_id AND streak_type = ''login''', 1),
(@cat10, 'Login Streaks', 'Eternal Collector', '500-day login streak', 250, 'Legendary', 'streak', 500, 'SELECT ISNULL(MAX(longest_count), 0) FROM user_streaks WHERE user_id = @user_id AND streak_type = ''login''', 1),
(@cat10, 'Login Streaks', 'Login God', '1000-day login streak', 500, 'Mythic', 'streak', 1000, 'SELECT ISNULL(MAX(longest_count), 0) FROM user_streaks WHERE user_id = @user_id AND streak_type = ''login''', 1),

-- Collection Activity Streaks
(@cat10, 'Collection Activity', 'Active Week', 'Add cards 7 days in a row', 15, 'Common', 'streak', 7, 'SELECT ISNULL(MAX(longest_count), 0) FROM user_streaks WHERE user_id = @user_id AND streak_type = ''card_addition''', 1),
(@cat10, 'Collection Activity', 'Active Fortnight', 'Add cards 14 days in a row', 25, 'Uncommon', 'streak', 14, 'SELECT ISNULL(MAX(longest_count), 0) FROM user_streaks WHERE user_id = @user_id AND streak_type = ''card_addition''', 1),
(@cat10, 'Collection Activity', 'Active Month', 'Add cards 30 days in a row', 50, 'Rare', 'streak', 30, 'SELECT ISNULL(MAX(longest_count), 0) FROM user_streaks WHERE user_id = @user_id AND streak_type = ''card_addition''', 1),
(@cat10, 'Collection Activity', 'Collection Maniac', 'Add cards 60 days in a row', 75, 'Epic', 'streak', 60, 'SELECT ISNULL(MAX(longest_count), 0) FROM user_streaks WHERE user_id = @user_id AND streak_type = ''card_addition''', 1),
(@cat10, 'Collection Activity', 'Never Stop Collecting', 'Add cards 100 days in a row', 100, 'Epic', 'streak', 100, 'SELECT ISNULL(MAX(longest_count), 0) FROM user_streaks WHERE user_id = @user_id AND streak_type = ''card_addition''', 1);

PRINT '✓ Inserted Streaks & Activity achievements (15 total)';

-- Create Achievement Series
IF NOT EXISTS (SELECT * FROM achievement_series WHERE series_name = 'Card Count Collector')
BEGIN
    INSERT INTO achievement_series (series_name, description, category_id) VALUES
    ('Card Count Collector', 'Progressive achievements for growing your collection size', @cat1),
    ('Rookie Card Hunter', 'Progressive achievements for collecting rookie cards', @cat2),
    ('Signature Seeker', 'Progressive achievements for collecting autographed cards', @cat3),
    ('Relic Researcher', 'Progressive achievements for collecting relic cards', @cat3),
    ('Value Investor', 'Progressive achievements for collection value growth', @cat8),
    ('Grade Chaser', 'Progressive achievements for collecting graded cards', @cat14),
    ('Social Butterfly', 'Progressive achievements for community participation', @cat9),
    ('Login Legend', 'Progressive achievements for consistent daily visits', @cat10);
    
    PRINT '✓ Created 8 achievement series';
END
GO

-- Link achievements to series (Card Count)
DECLARE @series1 BIGINT = (SELECT series_id FROM achievement_series WHERE series_name = 'Card Count Collector');
INSERT INTO achievement_series_members (series_id, achievement_id, series_order) 
SELECT @series1, achievement_id, ROW_NUMBER() OVER (ORDER BY requirement_value)
FROM achievements 
WHERE subcategory = 'Card Count';

-- Link achievements to series (Rookie Cards)  
DECLARE @series2 BIGINT = (SELECT series_id FROM achievement_series WHERE series_name = 'Rookie Card Hunter');
INSERT INTO achievement_series_members (series_id, achievement_id, series_order)
SELECT @series2, achievement_id, ROW_NUMBER() OVER (ORDER BY requirement_value)
FROM achievements
WHERE subcategory = 'Rookie Collection';

-- Link achievements to series (Autographs)
DECLARE @series3 BIGINT = (SELECT series_id FROM achievement_series WHERE series_name = 'Signature Seeker');
INSERT INTO achievement_series_members (series_id, achievement_id, series_order)
SELECT @series3, achievement_id, ROW_NUMBER() OVER (ORDER BY requirement_value)
FROM achievements 
WHERE subcategory = 'Autographs';

-- Link achievements to series (Comments)
DECLARE @series7 BIGINT = (SELECT series_id FROM achievement_series WHERE series_name = 'Social Butterfly');
INSERT INTO achievement_series_members (series_id, achievement_id, series_order)
SELECT @series7, achievement_id, ROW_NUMBER() OVER (ORDER BY requirement_value)
FROM achievements 
WHERE subcategory = 'Comments';

-- Link achievements to series (Login Streaks)
DECLARE @series8 BIGINT = (SELECT series_id FROM achievement_series WHERE series_name = 'Login Legend');
INSERT INTO achievement_series_members (series_id, achievement_id, series_order)
SELECT @series8, achievement_id, ROW_NUMBER() OVER (ORDER BY requirement_value)
FROM achievements 
WHERE subcategory = 'Login Streaks';

PRINT '✓ Linked achievements to series';

-- Final Statistics
DECLARE @totalAchievements INT = (SELECT COUNT(*) FROM achievements WHERE is_active = 1);
DECLARE @totalCategories INT = (SELECT COUNT(*) FROM achievement_categories);
DECLARE @totalSeries INT = (SELECT COUNT(*) FROM achievement_series);

PRINT '';
PRINT '==========================================';
PRINT 'COMPLETE ACHIEVEMENT SYSTEM SEEDED!';
PRINT '==========================================';
PRINT 'Total Categories: ' + CAST(@totalCategories AS VARCHAR(10));
PRINT 'Total Achievements: ' + CAST(@totalAchievements AS VARCHAR(10));
PRINT 'Total Series: ' + CAST(@totalSeries AS VARCHAR(10));
PRINT '';
PRINT 'Achievement Distribution:';

SELECT 
    c.name as category_name,
    COUNT(a.achievement_id) as achievement_count,
    SUM(a.points) as total_points
FROM achievement_categories c
LEFT JOIN achievements a ON c.category_id = a.category_id AND a.is_active = 1
GROUP BY c.name, c.display_order
ORDER BY c.display_order;

PRINT '';
PRINT 'Ready for user achievement processing!';
GO