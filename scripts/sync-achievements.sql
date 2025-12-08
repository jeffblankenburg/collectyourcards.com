-- ============================================================================
-- ACHIEVEMENTS SYNC SCRIPT
-- ============================================================================
-- This script idempotently syncs all achievements:
-- 1. Creates categories if they don't exist
-- 2. Inserts new achievements if they don't exist
-- 3. Updates existing achievements with correct queries
-- 4. Deactivates achievements that are untrackable
-- ============================================================================
-- Run with: docker exec -i collect-cards-db /opt/mssql-tools18/bin/sqlcmd -S localhost -U sa -P Password123 -d CollectYourCards -C < scripts/sync-achievements.sql
-- ============================================================================

SET NOCOUNT ON;
PRINT '============================================';
PRINT 'Starting Achievement Sync...';
PRINT '============================================';

-- ============================================================================
-- STEP 1: Ensure all categories exist
-- ============================================================================
PRINT 'Step 1: Syncing categories...';

IF NOT EXISTS (SELECT 1 FROM achievement_categories WHERE name = 'Collection Milestones')
    INSERT INTO achievement_categories (name, description, display_order, icon, is_active, created_at, updated_at)
    VALUES ('Collection Milestones', 'Achievements for building your card collection', 1, 'layers', 1, GETDATE(), GETDATE());

IF NOT EXISTS (SELECT 1 FROM achievement_categories WHERE name = 'Rookie Cards')
    INSERT INTO achievement_categories (name, description, display_order, icon, is_active, created_at, updated_at)
    VALUES ('Rookie Cards', 'Achievements for collecting rookie cards', 2, 'star', 1, GETDATE(), GETDATE());

IF NOT EXISTS (SELECT 1 FROM achievement_categories WHERE name = 'Special Cards')
    INSERT INTO achievement_categories (name, description, display_order, icon, is_active, created_at, updated_at)
    VALUES ('Special Cards', 'Achievements for autographs, relics, and numbered cards', 3, 'award', 1, GETDATE(), GETDATE());

IF NOT EXISTS (SELECT 1 FROM achievement_categories WHERE name = 'Value & Investment')
    INSERT INTO achievement_categories (name, description, display_order, icon, is_active, created_at, updated_at)
    VALUES ('Value & Investment', 'Achievements for collection value milestones', 4, 'trending-up', 1, GETDATE(), GETDATE());

IF NOT EXISTS (SELECT 1 FROM achievement_categories WHERE name = 'Community & Social')
    INSERT INTO achievement_categories (name, description, display_order, icon, is_active, created_at, updated_at)
    VALUES ('Community & Social', 'Achievements for community engagement', 5, 'users', 1, GETDATE(), GETDATE());

IF NOT EXISTS (SELECT 1 FROM achievement_categories WHERE name = 'Streaks & Activity')
    INSERT INTO achievement_categories (name, description, display_order, icon, is_active, created_at, updated_at)
    VALUES ('Streaks & Activity', 'Achievements for consistent activity', 6, 'zap', 1, GETDATE(), GETDATE());

IF NOT EXISTS (SELECT 1 FROM achievement_categories WHERE name = 'Early Adopter')
    INSERT INTO achievement_categories (name, description, display_order, icon, is_active, created_at, updated_at)
    VALUES ('Early Adopter', 'Special achievements for early platform users', 7, 'flag', 1, GETDATE(), GETDATE());

IF NOT EXISTS (SELECT 1 FROM achievement_categories WHERE name = 'Seller')
    INSERT INTO achievement_categories (name, description, display_order, icon, is_active, created_at, updated_at)
    VALUES ('Seller', 'Achievements for selling cards and managing your card business', 8, 'dollar-sign', 1, GETDATE(), GETDATE());

PRINT 'Categories synced.';

-- ============================================================================
-- STEP 2: Deactivate untrackable achievements
-- ============================================================================
PRINT 'Step 2: Deactivating untrackable achievements...';

-- Player stats we don't track
UPDATE achievements SET is_active = 0, updated_at = GETDATE() WHERE name IN (
    '2000 Yard Rushers', '5000 Yard Passers', '3000 Hit Club', '500 Home Run Club',
    '50 Goal Scorers', '50-40-90 Club', 'Cy Young Winners', 'Hart Trophy Winners',
    'Heisman Winners', 'Vezina Winners', 'Triple Crown', 'All-Star Collection',
    'All-Star Weekend', 'Championship DNA', 'Pro Bowl Collection', 'Super Bowl Heroes',
    'Stanley Cup Champs', 'Slam Dunk Champs', 'Three-Point Shootout', 'Perfect Game'
);

-- Social/follow features we don't have
UPDATE achievements SET is_active = 0, updated_at = GETDATE() WHERE name IN (
    'First Follow', 'First Follower', 'Network Builder', 'Network Effect',
    'Influencer', 'Popular Collector', 'Collection Celebrity'
);

-- Trade features we don't have
UPDATE achievements SET is_active = 0, updated_at = GETDATE() WHERE name IN (
    'Fair Trader', 'Trade Partner', 'Trade Expert', 'Trade Master'
);

-- Forum/community features we don't have
UPDATE achievements SET is_active = 0, updated_at = GETDATE() WHERE name IN (
    'Forum Expert', 'Forum Helper', 'Community Welcome', 'Community Leader',
    'Community Builder', 'Helpful Collector', 'Knowledge Sharer', 'Teaching Assistant',
    'Mentor'
);

-- Challenge features we don't have
UPDATE achievements SET is_active = 0, updated_at = GETDATE() WHERE name IN (
    'Challenge Champion', 'Challenge Creator', 'Five Time Winner', 'Popular Challenge',
    'Undefeated'
);

-- Crowdsourcing/contribution features we don't have
UPDATE achievements SET is_active = 0, updated_at = GETDATE() WHERE name IN (
    'First Contribution', 'Crowdsource Champion', 'Data Pioneer', 'Data Dynamo',
    'Submission Superstar', 'Knowledge Bank', 'Data Warehouse', 'Information Empire',
    'Data Legend', 'Information Station', 'Card Creator', 'Card Curator',
    'Card Architect', 'Card Master Builder', 'Card Database King', 'Bug Bounty Hunter',
    'Bug Crusher', 'Quality Control', 'Data Debugger', 'Information Fixer',
    'Quality Assurance Hero', 'Quality Assurance Queen', 'Verification Veteran',
    'Review Rockstar', 'Verification Overlord', 'Accuracy Angel', 'Trust Builder',
    'Expert Badge', 'Master Craftsman', 'Legend Status', 'Practice Makes Perfect',
    'Wiki Editor', 'Speed Demon', 'Efficiency Expert', 'Rapid Reviewer',
    'Lightning Logger', 'Daily Contributor', 'Monthly Marvel', 'Consistency Champion',
    'Never Stop Contributing', 'Credit Collector', 'Credit Accumulator', 'Free Rider',
    'Subscription Slayer', 'Data Difference Maker', 'Expert Endorser', 'Community Choice',
    'Platform Pioneer', 'Source Sleuth', 'Citation Station', 'Research Rockstar',
    'Academic Contributor', 'Scholarly Impact', 'Project Leader', 'System Architect Input',
    'Feature Requestor', 'Quality Guardian', 'Hockey Hero'
);

-- Card types we can't identify
UPDATE achievements SET is_active = 0, updated_at = GETDATE() WHERE name IN (
    'Acetate Fan', 'Canvas Collection', 'Die-Cut Collector', 'Foil Fanatic',
    'Hologram Hunter', 'Metal Universe', 'Clear Vision', 'Sketch Card Collector',
    'Allen & Ginter Fan', 'Archives Archivist', 'Gypsy Queen Collector',
    'Heritage Historian', 'Stadium Club Fan', 'Bowman Buff', 'Donruss Detective',
    'Fleer Fanatic', 'Case Hit Hero', 'Pre-Release Pioneer', 'Prototype Collector',
    'Press Proof Professional', 'Redemption Master', 'Error Card Expert',
    'Variation Virtuoso', 'Super Short Print Master', 'The Unicorn'
);

-- Date-based achievements
UPDATE achievements SET is_active = 0, updated_at = GETDATE() WHERE name IN (
    'Birth Year Collector', 'Birthday Cards', 'Bicentennial Cards', 'Decade Starter',
    'Last Year''s Cards', 'Holiday Haul', 'New Year New Cards', 'Leap Day Luck',
    'National Card Day', 'Black Friday Shopper', 'Cyber Monday Collector',
    'Anniversary Collector'
);

-- Value/condition with placeholder queries
UPDATE achievements SET is_active = 0, updated_at = GETDATE() WHERE name IN (
    'Average Collector', 'Premium Average', 'High Roller Average', 'Condition Conscious',
    'Mint Condition', 'Even Distribution', 'Perfectly Balanced', '10x Return',
    'Double Up', 'Smart Investor', 'Market Watcher'
);

-- Showcase/display features
UPDATE achievements SET is_active = 0, updated_at = GETDATE() WHERE name IN (
    'Show and Tell', 'Showcase Star', 'Social Collector'
);

-- Collection pace/completion with placeholder queries
UPDATE achievements SET is_active = 0, updated_at = GETDATE() WHERE name IN (
    'Quick Start', 'Speed Collector', 'Rapid Growth', 'Lightning Collector',
    'Always Growing', 'Half Year Hero', 'Year-Round Collector', 'Non-Stop Collector',
    'Complete Roster', 'Complete League', 'Everyone''s Here', 'National Coverage',
    'Universal Fan', 'Every Team Counts', 'Diamond Collector', 'Court Collector',
    'Field Collector', 'Full Court', 'Full League', 'Hoops Fan', 'Gridiron Fan',
    'Puck Collector', 'Rink Master', 'Shutterbug', 'Image Maestro',
    'Launch Day Hero', 'Year One Veteran', 'Memory Lane', 'Museum Curator', 'Pen Pal'
);

-- Jersey match achievements (need specific tracking)
UPDATE achievements SET is_active = 0, updated_at = GETDATE() WHERE name IN (
    'Jersey Match', 'Jersey Specialist', 'Double Jersey Match', 'Triple Jersey Match'
);

PRINT 'Untrackable achievements deactivated.';

-- ============================================================================
-- STEP 3: Insert/Update Collection Milestone achievements
-- ============================================================================
PRINT 'Step 3: Syncing Collection Milestones...';

-- Helper: Get category ID
DECLARE @CollectionMilestonesId BIGINT = (SELECT category_id FROM achievement_categories WHERE name = 'Collection Milestones');
DECLARE @RookieCardsId BIGINT = (SELECT category_id FROM achievement_categories WHERE name = 'Rookie Cards');
DECLARE @SpecialCardsId BIGINT = (SELECT category_id FROM achievement_categories WHERE name = 'Special Cards');
DECLARE @ValueInvestmentId BIGINT = (SELECT category_id FROM achievement_categories WHERE name = 'Value & Investment');
DECLARE @CommunitySocialId BIGINT = (SELECT category_id FROM achievement_categories WHERE name = 'Community & Social');
DECLARE @StreaksActivityId BIGINT = (SELECT category_id FROM achievement_categories WHERE name = 'Streaks & Activity');
DECLARE @EarlyAdopterId BIGINT = (SELECT category_id FROM achievement_categories WHERE name = 'Early Adopter');
DECLARE @SellerId BIGINT = (SELECT category_id FROM achievement_categories WHERE name = 'Seller');

-- Collection Size Milestones
MERGE INTO achievements AS target
USING (VALUES
    ('First Card', 'Add your first card to your collection', @CollectionMilestonesId, NULL, 5, 'Common', 'count', 1,
     'SELECT COUNT(*) FROM user_card WHERE [user] = @user_id', 1, 0, 0, 0),
    ('Starting Five', 'Collect 5 cards', @CollectionMilestonesId, NULL, 10, 'Common', 'count', 5,
     'SELECT COUNT(*) FROM user_card WHERE [user] = @user_id', 1, 0, 0, 0),
    ('Double Digits', 'Collect 10 cards', @CollectionMilestonesId, NULL, 15, 'Common', 'count', 10,
     'SELECT COUNT(*) FROM user_card WHERE [user] = @user_id', 1, 0, 0, 0),
    ('Quarter Century', 'Collect 25 cards', @CollectionMilestonesId, NULL, 20, 'Common', 'count', 25,
     'SELECT COUNT(*) FROM user_card WHERE [user] = @user_id', 1, 0, 0, 0),
    ('Half Century', 'Collect 50 cards', @CollectionMilestonesId, NULL, 30, 'Uncommon', 'count', 50,
     'SELECT COUNT(*) FROM user_card WHERE [user] = @user_id', 1, 0, 0, 0),
    ('Century Mark', 'Collect 100 cards', @CollectionMilestonesId, NULL, 50, 'Uncommon', 'count', 100,
     'SELECT COUNT(*) FROM user_card WHERE [user] = @user_id', 1, 0, 0, 0),
    ('Double Century', 'Collect 200 cards', @CollectionMilestonesId, NULL, 75, 'Rare', 'count', 200,
     'SELECT COUNT(*) FROM user_card WHERE [user] = @user_id', 1, 0, 0, 0),
    ('Quincentennial', 'Collect 500 cards', @CollectionMilestonesId, NULL, 100, 'Rare', 'count', 500,
     'SELECT COUNT(*) FROM user_card WHERE [user] = @user_id', 1, 0, 0, 0),
    ('2K Club', 'Collect 2,000 cards', @CollectionMilestonesId, NULL, 200, 'Epic', 'count', 2000,
     'SELECT COUNT(*) FROM user_card WHERE [user] = @user_id', 1, 0, 0, 0),
    ('5K Elite', 'Collect 5,000 cards', @CollectionMilestonesId, NULL, 300, 'Epic', 'count', 5000,
     'SELECT COUNT(*) FROM user_card WHERE [user] = @user_id', 1, 0, 0, 0),
    ('10K Legend', 'Collect 10,000 cards', @CollectionMilestonesId, NULL, 500, 'Legendary', 'count', 10000,
     'SELECT COUNT(*) FROM user_card WHERE [user] = @user_id', 1, 0, 0, 0),
    ('25K Master', 'Collect 25,000 cards', @CollectionMilestonesId, NULL, 750, 'Legendary', 'count', 25000,
     'SELECT COUNT(*) FROM user_card WHERE [user] = @user_id', 1, 0, 0, 0),
    ('50K Titan', 'Collect 50,000 cards', @CollectionMilestonesId, NULL, 1000, 'Mythic', 'count', 50000,
     'SELECT COUNT(*) FROM user_card WHERE [user] = @user_id', 1, 0, 0, 0),
    ('100K God-Tier', 'Collect 100,000 cards', @CollectionMilestonesId, NULL, 2000, 'Mythic', 'count', 100000,
     'SELECT COUNT(*) FROM user_card WHERE [user] = @user_id', 1, 0, 0, 0)
) AS source (name, description, category_id, subcategory, points, tier, requirement_type, requirement_value, requirement_query, is_active, is_secret, is_repeatable, cooldown_days)
ON target.name = source.name
WHEN MATCHED THEN
    UPDATE SET
        requirement_query = source.requirement_query,
        is_active = source.is_active,
        updated_at = GETDATE()
WHEN NOT MATCHED THEN
    INSERT (category_id, subcategory, name, description, points, tier, requirement_type, requirement_value, requirement_query, is_active, is_secret, is_repeatable, cooldown_days, created_at, updated_at)
    VALUES (source.category_id, source.subcategory, source.name, source.description, source.points, source.tier, source.requirement_type, source.requirement_value, source.requirement_query, source.is_active, source.is_secret, source.is_repeatable, source.cooldown_days, GETDATE(), GETDATE());

-- Player Diversity
MERGE INTO achievements AS target
USING (VALUES
    ('League Wide', 'Collect cards from 25 different players', @CollectionMilestonesId, 'Player Diversity', 25, 'Common', 'unique', 25,
     'SELECT COUNT(DISTINCT pt.player) FROM user_card uc INNER JOIN card c ON uc.card = c.card_id INNER JOIN card_player_team cpt ON c.card_id = cpt.card INNER JOIN player_team pt ON cpt.player_team = pt.player_team_id WHERE uc.[user] = @user_id', 1, 0, 0, 0),
    ('Century of Players', 'Collect cards from 100 different players', @CollectionMilestonesId, 'Player Diversity', 50, 'Uncommon', 'unique', 100,
     'SELECT COUNT(DISTINCT pt.player) FROM user_card uc INNER JOIN card c ON uc.card = c.card_id INNER JOIN card_player_team cpt ON c.card_id = cpt.card INNER JOIN player_team pt ON cpt.player_team = pt.player_team_id WHERE uc.[user] = @user_id', 1, 0, 0, 0),
    ('Player Encyclopedia', 'Collect cards from 250 different players', @CollectionMilestonesId, 'Player Diversity', 100, 'Rare', 'unique', 250,
     'SELECT COUNT(DISTINCT pt.player) FROM user_card uc INNER JOIN card c ON uc.card = c.card_id INNER JOIN card_player_team cpt ON c.card_id = cpt.card INNER JOIN player_team pt ON cpt.player_team = pt.player_team_id WHERE uc.[user] = @user_id', 1, 0, 0, 0),
    ('Hall of Names', 'Collect cards from 500 different players', @CollectionMilestonesId, 'Player Diversity', 200, 'Epic', 'unique', 500,
     'SELECT COUNT(DISTINCT pt.player) FROM user_card uc INNER JOIN card c ON uc.card = c.card_id INNER JOIN card_player_team cpt ON c.card_id = cpt.card INNER JOIN player_team pt ON cpt.player_team = pt.player_team_id WHERE uc.[user] = @user_id', 1, 0, 0, 0),
    ('Legend Collector', 'Collect cards from 1,000 different players', @CollectionMilestonesId, 'Player Diversity', 400, 'Legendary', 'unique', 1000,
     'SELECT COUNT(DISTINCT pt.player) FROM user_card uc INNER JOIN card c ON uc.card = c.card_id INNER JOIN card_player_team cpt ON c.card_id = cpt.card INNER JOIN player_team pt ON cpt.player_team = pt.player_team_id WHERE uc.[user] = @user_id', 1, 0, 0, 0),
    ('Who''s Who', 'Collect cards from 500 different players', @CollectionMilestonesId, 'Player Diversity', 300, 'Epic', 'unique', 500,
     'SELECT COUNT(DISTINCT pt.player) FROM user_card uc INNER JOIN card c ON uc.card = c.card_id INNER JOIN card_player_team cpt ON c.card_id = cpt.card INNER JOIN player_team pt ON cpt.player_team = pt.player_team_id WHERE uc.[user] = @user_id', 1, 0, 0, 0)
) AS source (name, description, category_id, subcategory, points, tier, requirement_type, requirement_value, requirement_query, is_active, is_secret, is_repeatable, cooldown_days)
ON target.name = source.name
WHEN MATCHED THEN
    UPDATE SET
        requirement_query = source.requirement_query,
        is_active = source.is_active,
        updated_at = GETDATE()
WHEN NOT MATCHED THEN
    INSERT (category_id, subcategory, name, description, points, tier, requirement_type, requirement_value, requirement_query, is_active, is_secret, is_repeatable, cooldown_days, created_at, updated_at)
    VALUES (source.category_id, source.subcategory, source.name, source.description, source.points, source.tier, source.requirement_type, source.requirement_value, source.requirement_query, source.is_active, source.is_secret, source.is_repeatable, source.cooldown_days, GETDATE(), GETDATE());

-- Team Diversity
MERGE INTO achievements AS target
USING (VALUES
    ('Division Rival', 'Collect cards from 5 different teams', @CollectionMilestonesId, 'Team Diversity', 15, 'Common', 'unique', 5,
     'SELECT COUNT(DISTINCT pt.team) FROM user_card uc INNER JOIN card c ON uc.card = c.card_id INNER JOIN card_player_team cpt ON c.card_id = cpt.card INNER JOIN player_team pt ON cpt.player_team = pt.player_team_id WHERE uc.[user] = @user_id', 1, 0, 0, 0),
    ('Conference Complete', 'Collect cards from 15 different teams', @CollectionMilestonesId, 'Team Diversity', 30, 'Uncommon', 'unique', 15,
     'SELECT COUNT(DISTINCT pt.team) FROM user_card uc INNER JOIN card c ON uc.card = c.card_id INNER JOIN card_player_team cpt ON c.card_id = cpt.card INNER JOIN player_team pt ON cpt.player_team = pt.player_team_id WHERE uc.[user] = @user_id', 1, 0, 0, 0),
    ('League Representative', 'Collect cards from 30 different teams', @CollectionMilestonesId, 'Team Diversity', 75, 'Rare', 'unique', 30,
     'SELECT COUNT(DISTINCT pt.team) FROM user_card uc INNER JOIN card c ON uc.card = c.card_id INNER JOIN card_player_team cpt ON c.card_id = cpt.card INNER JOIN player_team pt ON cpt.player_team = pt.player_team_id WHERE uc.[user] = @user_id', 1, 0, 0, 0),
    ('Multi-Sport Master', 'Collect cards from 50 different teams', @CollectionMilestonesId, 'Team Diversity', 150, 'Epic', 'unique', 50,
     'SELECT COUNT(DISTINCT pt.team) FROM user_card uc INNER JOIN card c ON uc.card = c.card_id INNER JOIN card_player_team cpt ON c.card_id = cpt.card INNER JOIN player_team pt ON cpt.player_team = pt.player_team_id WHERE uc.[user] = @user_id', 1, 0, 0, 0)
) AS source (name, description, category_id, subcategory, points, tier, requirement_type, requirement_value, requirement_query, is_active, is_secret, is_repeatable, cooldown_days)
ON target.name = source.name
WHEN MATCHED THEN
    UPDATE SET
        requirement_query = source.requirement_query,
        is_active = source.is_active,
        updated_at = GETDATE()
WHEN NOT MATCHED THEN
    INSERT (category_id, subcategory, name, description, points, tier, requirement_type, requirement_value, requirement_query, is_active, is_secret, is_repeatable, cooldown_days, created_at, updated_at)
    VALUES (source.category_id, source.subcategory, source.name, source.description, source.points, source.tier, source.requirement_type, source.requirement_value, source.requirement_query, source.is_active, source.is_secret, source.is_repeatable, source.cooldown_days, GETDATE(), GETDATE());

-- Sport-specific achievements
MERGE INTO achievements AS target
USING (VALUES
    ('Baseball Fan', 'Collect 100 baseball cards', @CollectionMilestonesId, 'Sports', 25, 'Common', 'count', 100,
     'SELECT COUNT(*) FROM user_card uc INNER JOIN card c ON uc.card = c.card_id INNER JOIN series s ON c.series = s.series_id INNER JOIN [set] st ON s.[set] = st.set_id WHERE uc.[user] = @user_id AND st.sport = ''Baseball''', 1, 0, 0, 0),
    ('Baseball Authority', 'Collect 500 baseball cards', @CollectionMilestonesId, 'Sports', 75, 'Rare', 'count', 500,
     'SELECT COUNT(*) FROM user_card uc INNER JOIN card c ON uc.card = c.card_id INNER JOIN series s ON c.series = s.series_id INNER JOIN [set] st ON s.[set] = st.set_id WHERE uc.[user] = @user_id AND st.sport = ''Baseball''', 1, 0, 0, 0),
    ('Baseball Brain', 'Collect 1,000 baseball cards', @CollectionMilestonesId, 'Sports', 150, 'Epic', 'count', 1000,
     'SELECT COUNT(*) FROM user_card uc INNER JOIN card c ON uc.card = c.card_id INNER JOIN series s ON c.series = s.series_id INNER JOIN [set] st ON s.[set] = st.set_id WHERE uc.[user] = @user_id AND st.sport = ''Baseball''', 1, 0, 0, 0),
    ('Basketball Buff', 'Collect 100 basketball cards', @CollectionMilestonesId, 'Sports', 25, 'Common', 'count', 100,
     'SELECT COUNT(*) FROM user_card uc INNER JOIN card c ON uc.card = c.card_id INNER JOIN series s ON c.series = s.series_id INNER JOIN [set] st ON s.[set] = st.set_id WHERE uc.[user] = @user_id AND st.sport = ''Basketball''', 1, 0, 0, 0),
    ('Basketball Authority', 'Collect 500 basketball cards', @CollectionMilestonesId, 'Sports', 75, 'Rare', 'count', 500,
     'SELECT COUNT(*) FROM user_card uc INNER JOIN card c ON uc.card = c.card_id INNER JOIN series s ON c.series = s.series_id INNER JOIN [set] st ON s.[set] = st.set_id WHERE uc.[user] = @user_id AND st.sport = ''Basketball''', 1, 0, 0, 0),
    ('Football Fanatic', 'Collect 100 football cards', @CollectionMilestonesId, 'Sports', 25, 'Common', 'count', 100,
     'SELECT COUNT(*) FROM user_card uc INNER JOIN card c ON uc.card = c.card_id INNER JOIN series s ON c.series = s.series_id INNER JOIN [set] st ON s.[set] = st.set_id WHERE uc.[user] = @user_id AND st.sport = ''Football''', 1, 0, 0, 0),
    ('Football Authority', 'Collect 500 football cards', @CollectionMilestonesId, 'Sports', 75, 'Rare', 'count', 500,
     'SELECT COUNT(*) FROM user_card uc INNER JOIN card c ON uc.card = c.card_id INNER JOIN series s ON c.series = s.series_id INNER JOIN [set] st ON s.[set] = st.set_id WHERE uc.[user] = @user_id AND st.sport = ''Football''', 1, 0, 0, 0),
    ('Hockey Authority', 'Collect 500 hockey cards', @CollectionMilestonesId, 'Sports', 75, 'Rare', 'count', 500,
     'SELECT COUNT(*) FROM user_card uc INNER JOIN card c ON uc.card = c.card_id INNER JOIN series s ON c.series = s.series_id INNER JOIN [set] st ON s.[set] = st.set_id WHERE uc.[user] = @user_id AND st.sport = ''Hockey''', 1, 0, 0, 0)
) AS source (name, description, category_id, subcategory, points, tier, requirement_type, requirement_value, requirement_query, is_active, is_secret, is_repeatable, cooldown_days)
ON target.name = source.name
WHEN MATCHED THEN
    UPDATE SET
        requirement_query = source.requirement_query,
        is_active = source.is_active,
        updated_at = GETDATE()
WHEN NOT MATCHED THEN
    INSERT (category_id, subcategory, name, description, points, tier, requirement_type, requirement_value, requirement_query, is_active, is_secret, is_repeatable, cooldown_days, created_at, updated_at)
    VALUES (source.category_id, source.subcategory, source.name, source.description, source.points, source.tier, source.requirement_type, source.requirement_value, source.requirement_query, source.is_active, source.is_secret, source.is_repeatable, source.cooldown_days, GETDATE(), GETDATE());

-- Manufacturer achievements
MERGE INTO achievements AS target
USING (VALUES
    ('Topps Collector', 'Collect 100 Topps cards', @CollectionMilestonesId, 'Manufacturers', 25, 'Common', 'count', 100,
     'SELECT COUNT(*) FROM user_card uc INNER JOIN card c ON uc.card = c.card_id INNER JOIN series s ON c.series = s.series_id INNER JOIN [set] st ON s.[set] = st.set_id WHERE uc.[user] = @user_id AND st.manufacturer LIKE ''%Topps%''', 1, 0, 0, 0),
    ('Topps Loyalist', 'Collect 500 Topps cards', @CollectionMilestonesId, 'Manufacturers', 75, 'Rare', 'count', 500,
     'SELECT COUNT(*) FROM user_card uc INNER JOIN card c ON uc.card = c.card_id INNER JOIN series s ON c.series = s.series_id INNER JOIN [set] st ON s.[set] = st.set_id WHERE uc.[user] = @user_id AND st.manufacturer LIKE ''%Topps%''', 1, 0, 0, 0),
    ('Topps Master', 'Collect 1,000 Topps cards', @CollectionMilestonesId, 'Manufacturers', 150, 'Epic', 'count', 1000,
     'SELECT COUNT(*) FROM user_card uc INNER JOIN card c ON uc.card = c.card_id INNER JOIN series s ON c.series = s.series_id INNER JOIN [set] st ON s.[set] = st.set_id WHERE uc.[user] = @user_id AND st.manufacturer LIKE ''%Topps%''', 1, 0, 0, 0),
    ('Panini Collector', 'Collect 100 Panini cards', @CollectionMilestonesId, 'Manufacturers', 25, 'Common', 'count', 100,
     'SELECT COUNT(*) FROM user_card uc INNER JOIN card c ON uc.card = c.card_id INNER JOIN series s ON c.series = s.series_id INNER JOIN [set] st ON s.[set] = st.set_id WHERE uc.[user] = @user_id AND st.manufacturer LIKE ''%Panini%''', 1, 0, 0, 0),
    ('Panini Loyalist', 'Collect 500 Panini cards', @CollectionMilestonesId, 'Manufacturers', 75, 'Rare', 'count', 500,
     'SELECT COUNT(*) FROM user_card uc INNER JOIN card c ON uc.card = c.card_id INNER JOIN series s ON c.series = s.series_id INNER JOIN [set] st ON s.[set] = st.set_id WHERE uc.[user] = @user_id AND st.manufacturer LIKE ''%Panini%''', 1, 0, 0, 0),
    ('Panini Master', 'Collect 1,000 Panini cards', @CollectionMilestonesId, 'Manufacturers', 150, 'Epic', 'count', 1000,
     'SELECT COUNT(*) FROM user_card uc INNER JOIN card c ON uc.card = c.card_id INNER JOIN series s ON c.series = s.series_id INNER JOIN [set] st ON s.[set] = st.set_id WHERE uc.[user] = @user_id AND st.manufacturer LIKE ''%Panini%''', 1, 0, 0, 0),
    ('Upper Deck Fan', 'Collect 100 Upper Deck cards', @CollectionMilestonesId, 'Manufacturers', 25, 'Common', 'count', 100,
     'SELECT COUNT(*) FROM user_card uc INNER JOIN card c ON uc.card = c.card_id INNER JOIN series s ON c.series = s.series_id INNER JOIN [set] st ON s.[set] = st.set_id WHERE uc.[user] = @user_id AND st.manufacturer LIKE ''%Upper Deck%''', 1, 0, 0, 0),
    ('Upper Deck Master', 'Collect 500 Upper Deck cards', @CollectionMilestonesId, 'Manufacturers', 75, 'Rare', 'count', 500,
     'SELECT COUNT(*) FROM user_card uc INNER JOIN card c ON uc.card = c.card_id INNER JOIN series s ON c.series = s.series_id INNER JOIN [set] st ON s.[set] = st.set_id WHERE uc.[user] = @user_id AND st.manufacturer LIKE ''%Upper Deck%''', 1, 0, 0, 0),
    ('Donruss Collector', 'Collect 100 Donruss cards', @CollectionMilestonesId, 'Manufacturers', 25, 'Common', 'count', 100,
     'SELECT COUNT(*) FROM user_card uc INNER JOIN card c ON uc.card = c.card_id INNER JOIN series s ON c.series = s.series_id INNER JOIN [set] st ON s.[set] = st.set_id WHERE uc.[user] = @user_id AND (st.name LIKE ''%Donruss%'' OR st.manufacturer LIKE ''%Donruss%'')', 1, 0, 0, 0),
    ('Fleer Collector', 'Collect 100 Fleer cards', @CollectionMilestonesId, 'Manufacturers', 25, 'Common', 'count', 100,
     'SELECT COUNT(*) FROM user_card uc INNER JOIN card c ON uc.card = c.card_id INNER JOIN series s ON c.series = s.series_id INNER JOIN [set] st ON s.[set] = st.set_id WHERE uc.[user] = @user_id AND (st.name LIKE ''%Fleer%'' OR st.manufacturer LIKE ''%Fleer%'')', 1, 0, 0, 0)
) AS source (name, description, category_id, subcategory, points, tier, requirement_type, requirement_value, requirement_query, is_active, is_secret, is_repeatable, cooldown_days)
ON target.name = source.name
WHEN MATCHED THEN
    UPDATE SET
        requirement_query = source.requirement_query,
        is_active = source.is_active,
        updated_at = GETDATE()
WHEN NOT MATCHED THEN
    INSERT (category_id, subcategory, name, description, points, tier, requirement_type, requirement_value, requirement_query, is_active, is_secret, is_repeatable, cooldown_days, created_at, updated_at)
    VALUES (source.category_id, source.subcategory, source.name, source.description, source.points, source.tier, source.requirement_type, source.requirement_value, source.requirement_query, source.is_active, source.is_secret, source.is_repeatable, source.cooldown_days, GETDATE(), GETDATE());

-- Brand line achievements
MERGE INTO achievements AS target
USING (VALUES
    ('Mosaic Collector', 'Collect 50 Mosaic cards', @CollectionMilestonesId, 'Product Lines', 30, 'Uncommon', 'count', 50,
     'SELECT COUNT(*) FROM user_card uc INNER JOIN card c ON uc.card = c.card_id INNER JOIN series s ON c.series = s.series_id INNER JOIN [set] st ON s.[set] = st.set_id WHERE uc.[user] = @user_id AND st.name LIKE ''%Mosaic%''', 1, 0, 0, 0),
    ('Optic Collector', 'Collect 50 Optic cards', @CollectionMilestonesId, 'Product Lines', 30, 'Uncommon', 'count', 50,
     'SELECT COUNT(*) FROM user_card uc INNER JOIN card c ON uc.card = c.card_id INNER JOIN series s ON c.series = s.series_id INNER JOIN [set] st ON s.[set] = st.set_id WHERE uc.[user] = @user_id AND st.name LIKE ''%Optic%''', 1, 0, 0, 0),
    ('Optic Master', 'Collect 100 Optic cards', @CollectionMilestonesId, 'Product Lines', 60, 'Rare', 'count', 100,
     'SELECT COUNT(*) FROM user_card uc INNER JOIN card c ON uc.card = c.card_id INNER JOIN series s ON c.series = s.series_id INNER JOIN [set] st ON s.[set] = st.set_id WHERE uc.[user] = @user_id AND st.name LIKE ''%Optic%''', 1, 0, 0, 0),
    ('Select Collector', 'Collect 50 Select cards', @CollectionMilestonesId, 'Product Lines', 30, 'Uncommon', 'count', 50,
     'SELECT COUNT(*) FROM user_card uc INNER JOIN card c ON uc.card = c.card_id INNER JOIN series s ON c.series = s.series_id INNER JOIN [set] st ON s.[set] = st.set_id WHERE uc.[user] = @user_id AND st.name LIKE ''%Select%''', 1, 0, 0, 0),
    ('Select Master', 'Collect 100 Select cards', @CollectionMilestonesId, 'Product Lines', 60, 'Rare', 'count', 100,
     'SELECT COUNT(*) FROM user_card uc INNER JOIN card c ON uc.card = c.card_id INNER JOIN series s ON c.series = s.series_id INNER JOIN [set] st ON s.[set] = st.set_id WHERE uc.[user] = @user_id AND st.name LIKE ''%Select%''', 1, 0, 0, 0),
    ('Prizm Collector', 'Collect 50 Prizm cards', @CollectionMilestonesId, 'Product Lines', 30, 'Uncommon', 'count', 50,
     'SELECT COUNT(*) FROM user_card uc INNER JOIN card c ON uc.card = c.card_id INNER JOIN series s ON c.series = s.series_id INNER JOIN [set] st ON s.[set] = st.set_id WHERE uc.[user] = @user_id AND st.name LIKE ''%Prizm%''', 1, 0, 0, 0),
    ('Prizm Master', 'Collect 100 Prizm cards', @CollectionMilestonesId, 'Product Lines', 60, 'Rare', 'count', 100,
     'SELECT COUNT(*) FROM user_card uc INNER JOIN card c ON uc.card = c.card_id INNER JOIN series s ON c.series = s.series_id INNER JOIN [set] st ON s.[set] = st.set_id WHERE uc.[user] = @user_id AND st.name LIKE ''%Prizm%''', 1, 0, 0, 0),
    ('Chrome Collector', 'Collect 50 Chrome cards', @CollectionMilestonesId, 'Product Lines', 30, 'Uncommon', 'count', 50,
     'SELECT COUNT(*) FROM user_card uc INNER JOIN card c ON uc.card = c.card_id INNER JOIN series s ON c.series = s.series_id INNER JOIN [set] st ON s.[set] = st.set_id WHERE uc.[user] = @user_id AND st.name LIKE ''%Chrome%''', 1, 0, 0, 0),
    ('Chrome Master', 'Collect 100 Chrome cards', @CollectionMilestonesId, 'Product Lines', 60, 'Rare', 'count', 100,
     'SELECT COUNT(*) FROM user_card uc INNER JOIN card c ON uc.card = c.card_id INNER JOIN series s ON c.series = s.series_id INNER JOIN [set] st ON s.[set] = st.set_id WHERE uc.[user] = @user_id AND st.name LIKE ''%Chrome%''', 1, 0, 0, 0)
) AS source (name, description, category_id, subcategory, points, tier, requirement_type, requirement_value, requirement_query, is_active, is_secret, is_repeatable, cooldown_days)
ON target.name = source.name
WHEN MATCHED THEN
    UPDATE SET
        requirement_query = source.requirement_query,
        is_active = source.is_active,
        updated_at = GETDATE()
WHEN NOT MATCHED THEN
    INSERT (category_id, subcategory, name, description, points, tier, requirement_type, requirement_value, requirement_query, is_active, is_secret, is_repeatable, cooldown_days, created_at, updated_at)
    VALUES (source.category_id, source.subcategory, source.name, source.description, source.points, source.tier, source.requirement_type, source.requirement_value, source.requirement_query, source.is_active, source.is_secret, source.is_repeatable, source.cooldown_days, GETDATE(), GETDATE());

-- Era achievements
MERGE INTO achievements AS target
USING (VALUES
    ('Modern Marvel', 'Collect 100 cards from 2020 or later', @CollectionMilestonesId, 'Eras', 25, 'Common', 'count', 100,
     'SELECT COUNT(*) FROM user_card uc INNER JOIN card c ON uc.card = c.card_id INNER JOIN series s ON c.series = s.series_id INNER JOIN [set] st ON s.[set] = st.set_id WHERE uc.[user] = @user_id AND st.year >= 2020', 1, 0, 0, 0),
    ('2010s Collector', 'Collect 100 cards from the 2010s', @CollectionMilestonesId, 'Eras', 25, 'Common', 'count', 100,
     'SELECT COUNT(*) FROM user_card uc INNER JOIN card c ON uc.card = c.card_id INNER JOIN series s ON c.series = s.series_id INNER JOIN [set] st ON s.[set] = st.set_id WHERE uc.[user] = @user_id AND st.year >= 2010 AND st.year < 2020', 1, 0, 0, 0),
    ('2000s Collector', 'Collect 100 cards from the 2000s', @CollectionMilestonesId, 'Eras', 30, 'Uncommon', 'count', 100,
     'SELECT COUNT(*) FROM user_card uc INNER JOIN card c ON uc.card = c.card_id INNER JOIN series s ON c.series = s.series_id INNER JOIN [set] st ON s.[set] = st.set_id WHERE uc.[user] = @user_id AND st.year >= 2000 AND st.year < 2010', 1, 0, 0, 0),
    ('90s Kid', 'Collect 50 cards from the 1990s', @CollectionMilestonesId, 'Eras', 40, 'Uncommon', 'count', 50,
     'SELECT COUNT(*) FROM user_card uc INNER JOIN card c ON uc.card = c.card_id INNER JOIN series s ON c.series = s.series_id INNER JOIN [set] st ON s.[set] = st.set_id WHERE uc.[user] = @user_id AND st.year >= 1990 AND st.year < 2000', 1, 0, 0, 0),
    ('80s Collection', 'Collect 25 cards from the 1980s', @CollectionMilestonesId, 'Eras', 50, 'Rare', 'count', 25,
     'SELECT COUNT(*) FROM user_card uc INNER JOIN card c ON uc.card = c.card_id INNER JOIN series s ON c.series = s.series_id INNER JOIN [set] st ON s.[set] = st.set_id WHERE uc.[user] = @user_id AND st.year >= 1980 AND st.year < 1990', 1, 0, 0, 0),
    ('Vintage Collector', 'Collect 10 cards from before 1980', @CollectionMilestonesId, 'Eras', 75, 'Rare', 'count', 10,
     'SELECT COUNT(*) FROM user_card uc INNER JOIN card c ON uc.card = c.card_id INNER JOIN series s ON c.series = s.series_id INNER JOIN [set] st ON s.[set] = st.set_id WHERE uc.[user] = @user_id AND st.year < 1980', 1, 0, 0, 0),
    ('Pre-War Hero', 'Collect a card from before 1945', @CollectionMilestonesId, 'Eras', 200, 'Legendary', 'count', 1,
     'SELECT COUNT(*) FROM user_card uc INNER JOIN card c ON uc.card = c.card_id INNER JOIN series s ON c.series = s.series_id INNER JOIN [set] st ON s.[set] = st.set_id WHERE uc.[user] = @user_id AND st.year < 1945', 1, 0, 0, 0)
) AS source (name, description, category_id, subcategory, points, tier, requirement_type, requirement_value, requirement_query, is_active, is_secret, is_repeatable, cooldown_days)
ON target.name = source.name
WHEN MATCHED THEN
    UPDATE SET
        requirement_query = source.requirement_query,
        is_active = source.is_active,
        updated_at = GETDATE()
WHEN NOT MATCHED THEN
    INSERT (category_id, subcategory, name, description, points, tier, requirement_type, requirement_value, requirement_query, is_active, is_secret, is_repeatable, cooldown_days, created_at, updated_at)
    VALUES (source.category_id, source.subcategory, source.name, source.description, source.points, source.tier, source.requirement_type, source.requirement_value, source.requirement_query, source.is_active, source.is_secret, source.is_repeatable, source.cooldown_days, GETDATE(), GETDATE());

-- HOF achievements
MERGE INTO achievements AS target
USING (VALUES
    ('HOF Starter', 'Collect a card of a Hall of Famer', @CollectionMilestonesId, 'Hall of Fame', 20, 'Common', 'count', 1,
     'SELECT COUNT(*) FROM user_card uc INNER JOIN card c ON uc.card = c.card_id INNER JOIN card_player_team cpt ON c.card_id = cpt.card INNER JOIN player_team pt ON cpt.player_team = pt.player_team_id INNER JOIN player p ON pt.player = p.player_id WHERE uc.[user] = @user_id AND p.is_hof = 1', 1, 0, 0, 0),
    ('HOF Collector', 'Collect 10 cards of Hall of Famers', @CollectionMilestonesId, 'Hall of Fame', 40, 'Uncommon', 'count', 10,
     'SELECT COUNT(*) FROM user_card uc INNER JOIN card c ON uc.card = c.card_id INNER JOIN card_player_team cpt ON c.card_id = cpt.card INNER JOIN player_team pt ON cpt.player_team = pt.player_team_id INNER JOIN player p ON pt.player = p.player_id WHERE uc.[user] = @user_id AND p.is_hof = 1', 1, 0, 0, 0),
    ('HOF Enthusiast', 'Collect 25 cards of Hall of Famers', @CollectionMilestonesId, 'Hall of Fame', 75, 'Rare', 'count', 25,
     'SELECT COUNT(*) FROM user_card uc INNER JOIN card c ON uc.card = c.card_id INNER JOIN card_player_team cpt ON c.card_id = cpt.card INNER JOIN player_team pt ON cpt.player_team = pt.player_team_id INNER JOIN player p ON pt.player = p.player_id WHERE uc.[user] = @user_id AND p.is_hof = 1', 1, 0, 0, 0),
    ('HOF Expert', 'Collect 50 cards of Hall of Famers', @CollectionMilestonesId, 'Hall of Fame', 125, 'Epic', 'count', 50,
     'SELECT COUNT(*) FROM user_card uc INNER JOIN card c ON uc.card = c.card_id INNER JOIN card_player_team cpt ON c.card_id = cpt.card INNER JOIN player_team pt ON cpt.player_team = pt.player_team_id INNER JOIN player p ON pt.player = p.player_id WHERE uc.[user] = @user_id AND p.is_hof = 1', 1, 0, 0, 0),
    ('HOF Historian', 'Collect 100 cards of Hall of Famers', @CollectionMilestonesId, 'Hall of Fame', 250, 'Legendary', 'count', 100,
     'SELECT COUNT(*) FROM user_card uc INNER JOIN card c ON uc.card = c.card_id INNER JOIN card_player_team cpt ON c.card_id = cpt.card INNER JOIN player_team pt ON cpt.player_team = pt.player_team_id INNER JOIN player p ON pt.player = p.player_id WHERE uc.[user] = @user_id AND p.is_hof = 1', 1, 0, 0, 0)
) AS source (name, description, category_id, subcategory, points, tier, requirement_type, requirement_value, requirement_query, is_active, is_secret, is_repeatable, cooldown_days)
ON target.name = source.name
WHEN MATCHED THEN
    UPDATE SET
        requirement_query = source.requirement_query,
        is_active = source.is_active,
        updated_at = GETDATE()
WHEN NOT MATCHED THEN
    INSERT (category_id, subcategory, name, description, points, tier, requirement_type, requirement_value, requirement_query, is_active, is_secret, is_repeatable, cooldown_days, created_at, updated_at)
    VALUES (source.category_id, source.subcategory, source.name, source.description, source.points, source.tier, source.requirement_type, source.requirement_value, source.requirement_query, source.is_active, source.is_secret, source.is_repeatable, source.cooldown_days, GETDATE(), GETDATE());

PRINT 'Collection Milestones synced.';

-- ============================================================================
-- STEP 4: Sync Rookie Cards achievements
-- ============================================================================
PRINT 'Step 4: Syncing Rookie Cards...';

MERGE INTO achievements AS target
USING (VALUES
    ('Rookie Finder', 'Collect your first rookie card', @RookieCardsId, NULL, 10, 'Common', 'count', 1,
     'SELECT COUNT(*) FROM user_card uc INNER JOIN card c ON uc.card = c.card_id WHERE uc.[user] = @user_id AND c.is_rookie = 1', 1, 0, 0, 0),
    ('Rookie Collector', 'Collect 10 rookie cards', @RookieCardsId, NULL, 25, 'Common', 'count', 10,
     'SELECT COUNT(*) FROM user_card uc INNER JOIN card c ON uc.card = c.card_id WHERE uc.[user] = @user_id AND c.is_rookie = 1', 1, 0, 0, 0),
    ('Rookie Hunter', 'Collect 25 rookie cards', @RookieCardsId, NULL, 50, 'Uncommon', 'count', 25,
     'SELECT COUNT(*) FROM user_card uc INNER JOIN card c ON uc.card = c.card_id WHERE uc.[user] = @user_id AND c.is_rookie = 1', 1, 0, 0, 0),
    ('Rookie Specialist', 'Collect 50 rookie cards', @RookieCardsId, NULL, 75, 'Rare', 'count', 50,
     'SELECT COUNT(*) FROM user_card uc INNER JOIN card c ON uc.card = c.card_id WHERE uc.[user] = @user_id AND c.is_rookie = 1', 1, 0, 0, 0),
    ('Rookie Expert', 'Collect 100 rookie cards', @RookieCardsId, NULL, 125, 'Epic', 'count', 100,
     'SELECT COUNT(*) FROM user_card uc INNER JOIN card c ON uc.card = c.card_id WHERE uc.[user] = @user_id AND c.is_rookie = 1', 1, 0, 0, 0),
    ('Rookie Master', 'Collect 250 rookie cards', @RookieCardsId, NULL, 250, 'Legendary', 'count', 250,
     'SELECT COUNT(*) FROM user_card uc INNER JOIN card c ON uc.card = c.card_id WHERE uc.[user] = @user_id AND c.is_rookie = 1', 1, 0, 0, 0),
    ('Rookie Legend', 'Collect 500 rookie cards', @RookieCardsId, NULL, 500, 'Mythic', 'count', 500,
     'SELECT COUNT(*) FROM user_card uc INNER JOIN card c ON uc.card = c.card_id WHERE uc.[user] = @user_id AND c.is_rookie = 1', 1, 0, 0, 0)
) AS source (name, description, category_id, subcategory, points, tier, requirement_type, requirement_value, requirement_query, is_active, is_secret, is_repeatable, cooldown_days)
ON target.name = source.name
WHEN MATCHED THEN
    UPDATE SET
        requirement_query = source.requirement_query,
        is_active = source.is_active,
        updated_at = GETDATE()
WHEN NOT MATCHED THEN
    INSERT (category_id, subcategory, name, description, points, tier, requirement_type, requirement_value, requirement_query, is_active, is_secret, is_repeatable, cooldown_days, created_at, updated_at)
    VALUES (source.category_id, source.subcategory, source.name, source.description, source.points, source.tier, source.requirement_type, source.requirement_value, source.requirement_query, source.is_active, source.is_secret, source.is_repeatable, source.cooldown_days, GETDATE(), GETDATE());

PRINT 'Rookie Cards synced.';

-- ============================================================================
-- STEP 5: Sync Special Cards achievements (Autographs, Relics, Numbered, Graded)
-- ============================================================================
PRINT 'Step 5: Syncing Special Cards...';

-- Autographs
MERGE INTO achievements AS target
USING (VALUES
    ('First Autograph', 'Collect your first autograph card', @SpecialCardsId, 'Autographs', 15, 'Common', 'count', 1,
     'SELECT COUNT(*) FROM user_card uc INNER JOIN card c ON uc.card = c.card_id WHERE uc.[user] = @user_id AND c.is_autograph = 1', 1, 0, 0, 0),
    ('Autograph Album', 'Collect 10 autograph cards', @SpecialCardsId, 'Autographs', 40, 'Uncommon', 'count', 10,
     'SELECT COUNT(*) FROM user_card uc INNER JOIN card c ON uc.card = c.card_id WHERE uc.[user] = @user_id AND c.is_autograph = 1', 1, 0, 0, 0),
    ('Autograph Authority', 'Collect 25 autograph cards', @SpecialCardsId, 'Autographs', 75, 'Rare', 'count', 25,
     'SELECT COUNT(*) FROM user_card uc INNER JOIN card c ON uc.card = c.card_id WHERE uc.[user] = @user_id AND c.is_autograph = 1', 1, 0, 0, 0),
    ('Signature Collector', 'Collect 50 autograph cards', @SpecialCardsId, 'Autographs', 125, 'Epic', 'count', 50,
     'SELECT COUNT(*) FROM user_card uc INNER JOIN card c ON uc.card = c.card_id WHERE uc.[user] = @user_id AND c.is_autograph = 1', 1, 0, 0, 0),
    ('Signature Legend', 'Collect 100 autograph cards', @SpecialCardsId, 'Autographs', 250, 'Legendary', 'count', 100,
     'SELECT COUNT(*) FROM user_card uc INNER JOIN card c ON uc.card = c.card_id WHERE uc.[user] = @user_id AND c.is_autograph = 1', 1, 0, 0, 0)
) AS source (name, description, category_id, subcategory, points, tier, requirement_type, requirement_value, requirement_query, is_active, is_secret, is_repeatable, cooldown_days)
ON target.name = source.name
WHEN MATCHED THEN
    UPDATE SET
        requirement_query = source.requirement_query,
        is_active = source.is_active,
        updated_at = GETDATE()
WHEN NOT MATCHED THEN
    INSERT (category_id, subcategory, name, description, points, tier, requirement_type, requirement_value, requirement_query, is_active, is_secret, is_repeatable, cooldown_days, created_at, updated_at)
    VALUES (source.category_id, source.subcategory, source.name, source.description, source.points, source.tier, source.requirement_type, source.requirement_value, source.requirement_query, source.is_active, source.is_secret, source.is_repeatable, source.cooldown_days, GETDATE(), GETDATE());

-- Relics
MERGE INTO achievements AS target
USING (VALUES
    ('Fabric Collector', 'Collect your first relic card', @SpecialCardsId, 'Relics', 15, 'Common', 'count', 1,
     'SELECT COUNT(*) FROM user_card uc INNER JOIN card c ON uc.card = c.card_id WHERE uc.[user] = @user_id AND c.is_relic = 1', 1, 0, 0, 0),
    ('Material World', 'Collect 10 relic cards', @SpecialCardsId, 'Relics', 40, 'Uncommon', 'count', 10,
     'SELECT COUNT(*) FROM user_card uc INNER JOIN card c ON uc.card = c.card_id WHERE uc.[user] = @user_id AND c.is_relic = 1', 1, 0, 0, 0),
    ('Memorabilia Master', 'Collect 25 relic cards', @SpecialCardsId, 'Relics', 75, 'Rare', 'count', 25,
     'SELECT COUNT(*) FROM user_card uc INNER JOIN card c ON uc.card = c.card_id WHERE uc.[user] = @user_id AND c.is_relic = 1', 1, 0, 0, 0),
    ('Relic Expert', 'Collect 50 relic cards', @SpecialCardsId, 'Relics', 125, 'Epic', 'count', 50,
     'SELECT COUNT(*) FROM user_card uc INNER JOIN card c ON uc.card = c.card_id WHERE uc.[user] = @user_id AND c.is_relic = 1', 1, 0, 0, 0)
) AS source (name, description, category_id, subcategory, points, tier, requirement_type, requirement_value, requirement_query, is_active, is_secret, is_repeatable, cooldown_days)
ON target.name = source.name
WHEN MATCHED THEN
    UPDATE SET
        requirement_query = source.requirement_query,
        is_active = source.is_active,
        updated_at = GETDATE()
WHEN NOT MATCHED THEN
    INSERT (category_id, subcategory, name, description, points, tier, requirement_type, requirement_value, requirement_query, is_active, is_secret, is_repeatable, cooldown_days, created_at, updated_at)
    VALUES (source.category_id, source.subcategory, source.name, source.description, source.points, source.tier, source.requirement_type, source.requirement_value, source.requirement_query, source.is_active, source.is_secret, source.is_repeatable, source.cooldown_days, GETDATE(), GETDATE());

-- Numbered cards
MERGE INTO achievements AS target
USING (VALUES
    ('Numbered Edition', 'Collect your first serial numbered card', @SpecialCardsId, 'Numbered', 15, 'Common', 'count', 1,
     'SELECT COUNT(*) FROM user_card WHERE [user] = @user_id AND serial_number IS NOT NULL', 1, 0, 0, 0),
    ('Limited Run', 'Collect 10 serial numbered cards', @SpecialCardsId, 'Numbered', 35, 'Uncommon', 'count', 10,
     'SELECT COUNT(*) FROM user_card WHERE [user] = @user_id AND serial_number IS NOT NULL', 1, 0, 0, 0),
    ('Scarce Supply', 'Collect 25 serial numbered cards', @SpecialCardsId, 'Numbered', 60, 'Rare', 'count', 25,
     'SELECT COUNT(*) FROM user_card WHERE [user] = @user_id AND serial_number IS NOT NULL', 1, 0, 0, 0),
    ('Number Cruncher', 'Collect 50 serial numbered cards', @SpecialCardsId, 'Numbered', 100, 'Epic', 'count', 50,
     'SELECT COUNT(*) FROM user_card WHERE [user] = @user_id AND serial_number IS NOT NULL', 1, 0, 0, 0),
    ('Print Run Pro', 'Collect 100 serial numbered cards', @SpecialCardsId, 'Numbered', 175, 'Legendary', 'count', 100,
     'SELECT COUNT(*) FROM user_card WHERE [user] = @user_id AND serial_number IS NOT NULL', 1, 0, 0, 0),
    ('One of One', 'Collect a 1/1 card', @SpecialCardsId, 'Numbered', 500, 'Mythic', 'count', 1,
     'SELECT COUNT(*) FROM user_card uc INNER JOIN card c ON uc.card = c.card_id WHERE uc.[user] = @user_id AND c.print_run = 1', 1, 0, 0, 0)
) AS source (name, description, category_id, subcategory, points, tier, requirement_type, requirement_value, requirement_query, is_active, is_secret, is_repeatable, cooldown_days)
ON target.name = source.name
WHEN MATCHED THEN
    UPDATE SET
        requirement_query = source.requirement_query,
        is_active = source.is_active,
        updated_at = GETDATE()
WHEN NOT MATCHED THEN
    INSERT (category_id, subcategory, name, description, points, tier, requirement_type, requirement_value, requirement_query, is_active, is_secret, is_repeatable, cooldown_days, created_at, updated_at)
    VALUES (source.category_id, source.subcategory, source.name, source.description, source.points, source.tier, source.requirement_type, source.requirement_value, source.requirement_query, source.is_active, source.is_secret, source.is_repeatable, source.cooldown_days, GETDATE(), GETDATE());

-- Graded cards
MERGE INTO achievements AS target
USING (VALUES
    ('First Graded', 'Add your first graded card', @SpecialCardsId, 'Graded', 15, 'Common', 'count', 1,
     'SELECT COUNT(*) FROM user_card WHERE [user] = @user_id AND grading_agency IS NOT NULL', 1, 0, 0, 0),
    ('Graded Five', 'Collect 5 graded cards', @SpecialCardsId, 'Graded', 30, 'Uncommon', 'count', 5,
     'SELECT COUNT(*) FROM user_card WHERE [user] = @user_id AND grading_agency IS NOT NULL', 1, 0, 0, 0),
    ('Graded Gallery', 'Collect 10 graded cards', @SpecialCardsId, 'Graded', 50, 'Rare', 'count', 10,
     'SELECT COUNT(*) FROM user_card WHERE [user] = @user_id AND grading_agency IS NOT NULL', 1, 0, 0, 0),
    ('Grade School', 'Collect 25 graded cards', @SpecialCardsId, 'Graded', 100, 'Epic', 'count', 25,
     'SELECT COUNT(*) FROM user_card WHERE [user] = @user_id AND grading_agency IS NOT NULL', 1, 0, 0, 0),
    ('Grade Master', 'Collect 50 graded cards', @SpecialCardsId, 'Graded', 175, 'Legendary', 'count', 50,
     'SELECT COUNT(*) FROM user_card WHERE [user] = @user_id AND grading_agency IS NOT NULL', 1, 0, 0, 0),
    ('Gem Mint 10', 'Collect a PSA/BGS 10 graded card', @SpecialCardsId, 'Graded', 100, 'Epic', 'count', 1,
     'SELECT COUNT(*) FROM user_card WHERE [user] = @user_id AND grade = 10', 1, 0, 0, 0),
    ('Perfect Collection', 'Collect 10 gem mint 10 graded cards', @SpecialCardsId, 'Graded', 300, 'Legendary', 'count', 10,
     'SELECT COUNT(*) FROM user_card WHERE [user] = @user_id AND grade = 10', 1, 0, 0, 0)
) AS source (name, description, category_id, subcategory, points, tier, requirement_type, requirement_value, requirement_query, is_active, is_secret, is_repeatable, cooldown_days)
ON target.name = source.name
WHEN MATCHED THEN
    UPDATE SET
        requirement_query = source.requirement_query,
        is_active = source.is_active,
        updated_at = GETDATE()
WHEN NOT MATCHED THEN
    INSERT (category_id, subcategory, name, description, points, tier, requirement_type, requirement_value, requirement_query, is_active, is_secret, is_repeatable, cooldown_days, created_at, updated_at)
    VALUES (source.category_id, source.subcategory, source.name, source.description, source.points, source.tier, source.requirement_type, source.requirement_value, source.requirement_query, source.is_active, source.is_secret, source.is_repeatable, source.cooldown_days, GETDATE(), GETDATE());

-- Insert cards
MERGE INTO achievements AS target
USING (VALUES
    ('Insert Hunter', 'Collect your first insert card', @SpecialCardsId, 'Inserts', 10, 'Common', 'count', 1,
     'SELECT COUNT(*) FROM user_card WHERE [user] = @user_id AND is_special = 1', 1, 0, 0, 0),
    ('Insert Specialist', 'Collect 10 insert cards', @SpecialCardsId, 'Inserts', 25, 'Uncommon', 'count', 10,
     'SELECT COUNT(*) FROM user_card WHERE [user] = @user_id AND is_special = 1', 1, 0, 0, 0),
    ('Insert Expert', 'Collect 25 insert cards', @SpecialCardsId, 'Inserts', 50, 'Rare', 'count', 25,
     'SELECT COUNT(*) FROM user_card WHERE [user] = @user_id AND is_special = 1', 1, 0, 0, 0),
    ('Insert Master', 'Collect 50 insert cards', @SpecialCardsId, 'Inserts', 100, 'Epic', 'count', 50,
     'SELECT COUNT(*) FROM user_card WHERE [user] = @user_id AND is_special = 1', 1, 0, 0, 0),
    ('Insert Legend', 'Collect 100 insert cards', @SpecialCardsId, 'Inserts', 200, 'Legendary', 'count', 100,
     'SELECT COUNT(*) FROM user_card WHERE [user] = @user_id AND is_special = 1', 1, 0, 0, 0)
) AS source (name, description, category_id, subcategory, points, tier, requirement_type, requirement_value, requirement_query, is_active, is_secret, is_repeatable, cooldown_days)
ON target.name = source.name
WHEN MATCHED THEN
    UPDATE SET
        requirement_query = source.requirement_query,
        is_active = source.is_active,
        updated_at = GETDATE()
WHEN NOT MATCHED THEN
    INSERT (category_id, subcategory, name, description, points, tier, requirement_type, requirement_value, requirement_query, is_active, is_secret, is_repeatable, cooldown_days, created_at, updated_at)
    VALUES (source.category_id, source.subcategory, source.name, source.description, source.points, source.tier, source.requirement_type, source.requirement_value, source.requirement_query, source.is_active, source.is_secret, source.is_repeatable, source.cooldown_days, GETDATE(), GETDATE());

-- Short prints
MERGE INTO achievements AS target
USING (VALUES
    ('Short Print Finder', 'Collect your first short print', @SpecialCardsId, 'Short Prints', 20, 'Uncommon', 'count', 1,
     'SELECT COUNT(*) FROM user_card uc INNER JOIN card c ON uc.card = c.card_id WHERE uc.[user] = @user_id AND c.is_short_print = 1', 1, 0, 0, 0),
    ('SP Collector', 'Collect 10 short prints', @SpecialCardsId, 'Short Prints', 50, 'Rare', 'count', 10,
     'SELECT COUNT(*) FROM user_card uc INNER JOIN card c ON uc.card = c.card_id WHERE uc.[user] = @user_id AND c.is_short_print = 1', 1, 0, 0, 0),
    ('SP Expert', 'Collect 25 short prints', @SpecialCardsId, 'Short Prints', 100, 'Epic', 'count', 25,
     'SELECT COUNT(*) FROM user_card uc INNER JOIN card c ON uc.card = c.card_id WHERE uc.[user] = @user_id AND c.is_short_print = 1', 1, 0, 0, 0)
) AS source (name, description, category_id, subcategory, points, tier, requirement_type, requirement_value, requirement_query, is_active, is_secret, is_repeatable, cooldown_days)
ON target.name = source.name
WHEN MATCHED THEN
    UPDATE SET
        requirement_query = source.requirement_query,
        is_active = source.is_active,
        updated_at = GETDATE()
WHEN NOT MATCHED THEN
    INSERT (category_id, subcategory, name, description, points, tier, requirement_type, requirement_value, requirement_query, is_active, is_secret, is_repeatable, cooldown_days, created_at, updated_at)
    VALUES (source.category_id, source.subcategory, source.name, source.description, source.points, source.tier, source.requirement_type, source.requirement_value, source.requirement_query, source.is_active, source.is_secret, source.is_repeatable, source.cooldown_days, GETDATE(), GETDATE());

PRINT 'Special Cards synced.';

-- ============================================================================
-- STEP 6: Sync Value & Investment achievements
-- ============================================================================
PRINT 'Step 6: Syncing Value & Investment...';

MERGE INTO achievements AS target
USING (VALUES
    ('First Thousand', 'Collection value reaches $1,000', @ValueInvestmentId, NULL, 25, 'Common', 'value', 1000,
     'SELECT ISNULL(SUM(CAST(ISNULL(uc.current_value, uc.estimated_value) AS DECIMAL(18,2))), 0) FROM user_card uc WHERE uc.[user] = @user_id', 1, 0, 0, 0),
    ('Five Thousand', 'Collection value reaches $5,000', @ValueInvestmentId, NULL, 50, 'Uncommon', 'value', 5000,
     'SELECT ISNULL(SUM(CAST(ISNULL(uc.current_value, uc.estimated_value) AS DECIMAL(18,2))), 0) FROM user_card uc WHERE uc.[user] = @user_id', 1, 0, 0, 0),
    ('Ten Thousand', 'Collection value reaches $10,000', @ValueInvestmentId, NULL, 100, 'Rare', 'value', 10000,
     'SELECT ISNULL(SUM(CAST(ISNULL(uc.current_value, uc.estimated_value) AS DECIMAL(18,2))), 0) FROM user_card uc WHERE uc.[user] = @user_id', 1, 0, 0, 0),
    ('Twenty Five Grand', 'Collection value reaches $25,000', @ValueInvestmentId, NULL, 175, 'Epic', 'value', 25000,
     'SELECT ISNULL(SUM(CAST(ISNULL(uc.current_value, uc.estimated_value) AS DECIMAL(18,2))), 0) FROM user_card uc WHERE uc.[user] = @user_id', 1, 0, 0, 0),
    ('Fifty Grand', 'Collection value reaches $50,000', @ValueInvestmentId, NULL, 300, 'Legendary', 'value', 50000,
     'SELECT ISNULL(SUM(CAST(ISNULL(uc.current_value, uc.estimated_value) AS DECIMAL(18,2))), 0) FROM user_card uc WHERE uc.[user] = @user_id', 1, 0, 0, 0),
    ('Six Figures', 'Collection value reaches $100,000', @ValueInvestmentId, NULL, 500, 'Mythic', 'value', 100000,
     'SELECT ISNULL(SUM(CAST(ISNULL(uc.current_value, uc.estimated_value) AS DECIMAL(18,2))), 0) FROM user_card uc WHERE uc.[user] = @user_id', 1, 0, 0, 0),
    ('Credit Millionaire', 'Collection value reaches $1,000,000', @ValueInvestmentId, NULL, 2000, 'Mythic', 'value', 1000000,
     'SELECT ISNULL(SUM(CAST(ISNULL(uc.current_value, uc.estimated_value) AS DECIMAL(18,2))), 0) FROM user_card uc WHERE uc.[user] = @user_id', 1, 0, 0, 0)
) AS source (name, description, category_id, subcategory, points, tier, requirement_type, requirement_value, requirement_query, is_active, is_secret, is_repeatable, cooldown_days)
ON target.name = source.name
WHEN MATCHED THEN
    UPDATE SET
        requirement_query = source.requirement_query,
        requirement_value = source.requirement_value,
        is_active = source.is_active,
        updated_at = GETDATE()
WHEN NOT MATCHED THEN
    INSERT (category_id, subcategory, name, description, points, tier, requirement_type, requirement_value, requirement_query, is_active, is_secret, is_repeatable, cooldown_days, created_at, updated_at)
    VALUES (source.category_id, source.subcategory, source.name, source.description, source.points, source.tier, source.requirement_type, source.requirement_value, source.requirement_query, source.is_active, source.is_secret, source.is_repeatable, source.cooldown_days, GETDATE(), GETDATE());

PRINT 'Value & Investment synced.';

-- ============================================================================
-- STEP 7: Sync Community & Social achievements (Comments)
-- ============================================================================
PRINT 'Step 7: Syncing Community & Social...';

MERGE INTO achievements AS target
USING (VALUES
    ('First Comment', 'Leave your first comment', @CommunitySocialId, NULL, 5, 'Common', 'count', 1,
     'SELECT COUNT(*) FROM universal_comments WHERE user_id = @user_id', 1, 0, 0, 0),
    ('Conversationalist', 'Leave 10 comments', @CommunitySocialId, NULL, 15, 'Common', 'count', 10,
     'SELECT COUNT(*) FROM universal_comments WHERE user_id = @user_id', 1, 0, 0, 0),
    ('Discussion Leader', 'Leave 50 comments', @CommunitySocialId, NULL, 40, 'Uncommon', 'count', 50,
     'SELECT COUNT(*) FROM universal_comments WHERE user_id = @user_id', 1, 0, 0, 0),
    ('Community Voice', 'Leave 100 comments', @CommunitySocialId, NULL, 75, 'Rare', 'count', 100,
     'SELECT COUNT(*) FROM universal_comments WHERE user_id = @user_id', 1, 0, 0, 0),
    ('Discussion Master', 'Leave 250 comments', @CommunitySocialId, NULL, 150, 'Epic', 'count', 250,
     'SELECT COUNT(*) FROM universal_comments WHERE user_id = @user_id', 1, 0, 0, 0),
    ('Forum Legend', 'Leave 500 comments', @CommunitySocialId, NULL, 300, 'Legendary', 'count', 500,
     'SELECT COUNT(*) FROM universal_comments WHERE user_id = @user_id', 1, 0, 0, 0),
    ('Community Pillar', 'Leave 1,000 comments', @CommunitySocialId, NULL, 500, 'Mythic', 'count', 1000,
     'SELECT COUNT(*) FROM universal_comments WHERE user_id = @user_id', 1, 0, 0, 0)
) AS source (name, description, category_id, subcategory, points, tier, requirement_type, requirement_value, requirement_query, is_active, is_secret, is_repeatable, cooldown_days)
ON target.name = source.name
WHEN MATCHED THEN
    UPDATE SET
        requirement_query = source.requirement_query,
        is_active = source.is_active,
        updated_at = GETDATE()
WHEN NOT MATCHED THEN
    INSERT (category_id, subcategory, name, description, points, tier, requirement_type, requirement_value, requirement_query, is_active, is_secret, is_repeatable, cooldown_days, created_at, updated_at)
    VALUES (source.category_id, source.subcategory, source.name, source.description, source.points, source.tier, source.requirement_type, source.requirement_value, source.requirement_query, source.is_active, source.is_secret, source.is_repeatable, source.cooldown_days, GETDATE(), GETDATE());

PRINT 'Community & Social synced.';

-- ============================================================================
-- STEP 8: Sync Streaks & Activity achievements
-- ============================================================================
PRINT 'Step 8: Syncing Streaks & Activity...';

MERGE INTO achievements AS target
USING (VALUES
    ('Getting Started', 'Log in for 3 consecutive days', @StreaksActivityId, 'Login Streaks', 10, 'Common', 'streak', 3,
     'SELECT ISNULL(MAX(current_count), 0) FROM user_streaks WHERE user_id = @user_id AND streak_type = ''daily_login''', 1, 0, 0, 0),
    ('Week Warrior', 'Log in for 7 consecutive days', @StreaksActivityId, 'Login Streaks', 25, 'Common', 'streak', 7,
     'SELECT ISNULL(MAX(current_count), 0) FROM user_streaks WHERE user_id = @user_id AND streak_type = ''daily_login''', 1, 0, 0, 0),
    ('Two Week Streak', 'Log in for 14 consecutive days', @StreaksActivityId, 'Login Streaks', 50, 'Uncommon', 'streak', 14,
     'SELECT ISNULL(MAX(current_count), 0) FROM user_streaks WHERE user_id = @user_id AND streak_type = ''daily_login''', 1, 0, 0, 0),
    ('Monthly Dedication', 'Log in for 30 consecutive days', @StreaksActivityId, 'Login Streaks', 100, 'Rare', 'streak', 30,
     'SELECT ISNULL(MAX(current_count), 0) FROM user_streaks WHERE user_id = @user_id AND streak_type = ''daily_login''', 1, 0, 0, 0),
    ('Quarterly Commitment', 'Log in for 90 consecutive days', @StreaksActivityId, 'Login Streaks', 250, 'Epic', 'streak', 90,
     'SELECT ISNULL(MAX(current_count), 0) FROM user_streaks WHERE user_id = @user_id AND streak_type = ''daily_login''', 1, 0, 0, 0),
    ('Half Year Hero', 'Log in for 180 consecutive days', @StreaksActivityId, 'Login Streaks', 500, 'Legendary', 'streak', 180,
     'SELECT ISNULL(MAX(current_count), 0) FROM user_streaks WHERE user_id = @user_id AND streak_type = ''daily_login''', 1, 0, 0, 0),
    ('Year-Round Dedication', 'Log in for 365 consecutive days', @StreaksActivityId, 'Login Streaks', 1000, 'Mythic', 'streak', 365,
     'SELECT ISNULL(MAX(current_count), 0) FROM user_streaks WHERE user_id = @user_id AND streak_type = ''daily_login''', 1, 0, 0, 0)
) AS source (name, description, category_id, subcategory, points, tier, requirement_type, requirement_value, requirement_query, is_active, is_secret, is_repeatable, cooldown_days)
ON target.name = source.name
WHEN MATCHED THEN
    UPDATE SET
        requirement_query = source.requirement_query,
        is_active = source.is_active,
        updated_at = GETDATE()
WHEN NOT MATCHED THEN
    INSERT (category_id, subcategory, name, description, points, tier, requirement_type, requirement_value, requirement_query, is_active, is_secret, is_repeatable, cooldown_days, created_at, updated_at)
    VALUES (source.category_id, source.subcategory, source.name, source.description, source.points, source.tier, source.requirement_type, source.requirement_value, source.requirement_query, source.is_active, source.is_secret, source.is_repeatable, source.cooldown_days, GETDATE(), GETDATE());

-- Photo achievements
MERGE INTO achievements AS target
USING (VALUES
    ('First Photo', 'Upload your first card photo', @StreaksActivityId, 'Photos', 10, 'Common', 'count', 1,
     'SELECT COUNT(*) FROM user_card_photo ucp INNER JOIN user_card uc ON ucp.user_card = uc.user_card_id WHERE uc.[user] = @user_id', 1, 0, 0, 0),
    ('Photo Fanatic', 'Upload 25 card photos', @StreaksActivityId, 'Photos', 30, 'Uncommon', 'count', 25,
     'SELECT COUNT(*) FROM user_card_photo ucp INNER JOIN user_card uc ON ucp.user_card = uc.user_card_id WHERE uc.[user] = @user_id', 1, 0, 0, 0),
    ('Photography Pro', 'Upload 100 card photos', @StreaksActivityId, 'Photos', 75, 'Rare', 'count', 100,
     'SELECT COUNT(*) FROM user_card_photo ucp INNER JOIN user_card uc ON ucp.user_card = uc.user_card_id WHERE uc.[user] = @user_id', 1, 0, 0, 0)
) AS source (name, description, category_id, subcategory, points, tier, requirement_type, requirement_value, requirement_query, is_active, is_secret, is_repeatable, cooldown_days)
ON target.name = source.name
WHEN MATCHED THEN
    UPDATE SET
        requirement_query = source.requirement_query,
        is_active = source.is_active,
        updated_at = GETDATE()
WHEN NOT MATCHED THEN
    INSERT (category_id, subcategory, name, description, points, tier, requirement_type, requirement_value, requirement_query, is_active, is_secret, is_repeatable, cooldown_days, created_at, updated_at)
    VALUES (source.category_id, source.subcategory, source.name, source.description, source.points, source.tier, source.requirement_type, source.requirement_value, source.requirement_query, source.is_active, source.is_secret, source.is_repeatable, source.cooldown_days, GETDATE(), GETDATE());

PRINT 'Streaks & Activity synced.';

-- ============================================================================
-- STEP 9: Sync Early Adopter achievements
-- ============================================================================
PRINT 'Step 9: Syncing Early Adopter...';

MERGE INTO achievements AS target
USING (VALUES
    ('Beta Pioneer', 'Join during beta testing', @EarlyAdopterId, NULL, 100, 'Legendary', 'boolean', 1,
     'SELECT CASE WHEN @user_id = 1 THEN 1 ELSE 0 END', 1, 0, 0, 0),
    ('Original Six', 'Be one of the first 6 users', @EarlyAdopterId, NULL, 150, 'Legendary', 'boolean', 1,
     'SELECT CASE WHEN @user_id <= 6 THEN 1 ELSE 0 END', 1, 0, 0, 0),
    ('First Hundred', 'Be one of the first 100 users', @EarlyAdopterId, NULL, 75, 'Epic', 'boolean', 1,
     'SELECT CASE WHEN @user_id <= 100 THEN 1 ELSE 0 END', 1, 0, 0, 0),
    ('First Thousand Users', 'Be one of the first 1,000 users', @EarlyAdopterId, NULL, 50, 'Rare', 'boolean', 1,
     'SELECT CASE WHEN @user_id <= 1000 THEN 1 ELSE 0 END', 1, 0, 0, 0)
) AS source (name, description, category_id, subcategory, points, tier, requirement_type, requirement_value, requirement_query, is_active, is_secret, is_repeatable, cooldown_days)
ON target.name = source.name
WHEN MATCHED THEN
    UPDATE SET
        requirement_query = source.requirement_query,
        is_active = source.is_active,
        updated_at = GETDATE()
WHEN NOT MATCHED THEN
    INSERT (category_id, subcategory, name, description, points, tier, requirement_type, requirement_value, requirement_query, is_active, is_secret, is_repeatable, cooldown_days, created_at, updated_at)
    VALUES (source.category_id, source.subcategory, source.name, source.description, source.points, source.tier, source.requirement_type, source.requirement_value, source.requirement_query, source.is_active, source.is_secret, source.is_repeatable, source.cooldown_days, GETDATE(), GETDATE());

PRINT 'Early Adopter synced.';

-- ============================================================================
-- STEP 10: Final summary
-- ============================================================================
PRINT '============================================';
PRINT 'Achievement Sync Complete!';
PRINT '============================================';

SELECT
    c.name as Category,
    SUM(CASE WHEN a.is_active = 1 THEN 1 ELSE 0 END) as Active,
    SUM(CASE WHEN a.is_active = 0 THEN 1 ELSE 0 END) as Inactive
FROM achievements a
JOIN achievement_categories c ON a.category_id = c.category_id
GROUP BY c.name
ORDER BY c.name;

SELECT
    'TOTAL' as Category,
    SUM(CASE WHEN is_active = 1 THEN 1 ELSE 0 END) as Active,
    SUM(CASE WHEN is_active = 0 THEN 1 ELSE 0 END) as Inactive
FROM achievements;

PRINT '============================================';
