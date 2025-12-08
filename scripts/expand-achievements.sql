-- ============================================================================
-- ACHIEVEMENT EXPANSION SCRIPT
-- ============================================================================
-- Expands achievements to reasonable numbers based on trackable data
-- Run with: docker exec -i collect-cards-db /opt/mssql-tools18/bin/sqlcmd -S localhost -U sa -P Password123 -d CollectYourCards -C < scripts/expand-achievements.sql
-- ============================================================================

SET NOCOUNT ON;
PRINT '============================================';
PRINT 'Expanding Achievements...';
PRINT '============================================';

-- Get category IDs
DECLARE @CollectionMilestones INT = (SELECT category_id FROM achievement_categories WHERE name = 'Collection Milestones');
DECLARE @RookieCards INT = (SELECT category_id FROM achievement_categories WHERE name = 'Rookie Cards');
DECLARE @SpecialCards INT = (SELECT category_id FROM achievement_categories WHERE name = 'Special Cards');
DECLARE @ValueInvestment INT = (SELECT category_id FROM achievement_categories WHERE name = 'Value & Investment');
DECLARE @CommunitySocial INT = (SELECT category_id FROM achievement_categories WHERE name = 'Community & Social');
DECLARE @StreaksActivity INT = (SELECT category_id FROM achievement_categories WHERE name = 'Streaks & Activity');
DECLARE @EarlyAdopter INT = (SELECT category_id FROM achievement_categories WHERE name = 'Early Adopter');

-- ============================================================================
-- ROOKIE CARDS EXPANSION (Target: ~100)
-- Current: 29, Need: ~71 more
-- ============================================================================
PRINT 'Expanding Rookie Cards...';

-- Rookie Cards by Sport (5 sports x 10 milestones = 50)
-- Baseball Rookies
MERGE INTO achievements AS target
USING (VALUES
    ('Baseball Rookie Starter', 'Collect 5 baseball rookie cards', 10, 'Common', 5, 'SELECT COUNT(*) FROM user_card uc JOIN card c ON uc.card = c.card_id JOIN [set] s ON c.card_id IN (SELECT card_id FROM card) WHERE uc.user_id = @user_id AND uc.sold_at IS NULL AND c.is_rookie = 1 AND s.organization = 1'),
    ('Baseball Rookie Collector', 'Collect 25 baseball rookie cards', 25, 'Common', 25, 'SELECT COUNT(*) FROM user_card uc JOIN card c ON uc.card = c.card_id JOIN [set] s ON c.card_id IN (SELECT card_id FROM card) WHERE uc.user_id = @user_id AND uc.sold_at IS NULL AND c.is_rookie = 1 AND s.organization = 1'),
    ('Baseball Rookie Hunter', 'Collect 50 baseball rookie cards', 50, 'Uncommon', 50, 'SELECT COUNT(*) FROM user_card uc JOIN card c ON uc.card = c.card_id JOIN [set] s ON c.card_id IN (SELECT card_id FROM card) WHERE uc.user_id = @user_id AND uc.sold_at IS NULL AND c.is_rookie = 1 AND s.organization = 1'),
    ('Baseball Rookie Enthusiast', 'Collect 100 baseball rookie cards', 100, 'Rare', 100, 'SELECT COUNT(*) FROM user_card uc JOIN card c ON uc.card = c.card_id JOIN [set] s ON c.card_id IN (SELECT card_id FROM card) WHERE uc.user_id = @user_id AND uc.sold_at IS NULL AND c.is_rookie = 1 AND s.organization = 1'),
    ('Baseball Rookie Expert', 'Collect 250 baseball rookie cards', 150, 'Epic', 250, 'SELECT COUNT(*) FROM user_card uc JOIN card c ON uc.card = c.card_id JOIN [set] s ON c.card_id IN (SELECT card_id FROM card) WHERE uc.user_id = @user_id AND uc.sold_at IS NULL AND c.is_rookie = 1 AND s.organization = 1'),
    ('Baseball Rookie Master', 'Collect 500 baseball rookie cards', 200, 'Legendary', 500, 'SELECT COUNT(*) FROM user_card uc JOIN card c ON uc.card = c.card_id JOIN [set] s ON c.card_id IN (SELECT card_id FROM card) WHERE uc.user_id = @user_id AND uc.sold_at IS NULL AND c.is_rookie = 1 AND s.organization = 1')
) AS source (name, description, points, tier, req_value, req_query)
ON target.name = source.name
WHEN NOT MATCHED THEN
    INSERT (category_id, name, description, points, tier, requirement_type, requirement_value, requirement_query, is_active, is_secret, created_at, updated_at)
    VALUES (@RookieCards, source.name, source.description, source.points, source.tier, 'count', source.req_value, source.req_query, 1, 0, GETDATE(), GETDATE());

-- Football Rookies
MERGE INTO achievements AS target
USING (VALUES
    ('Football Rookie Starter', 'Collect 5 football rookie cards', 10, 'Common', 5, 'SELECT COUNT(*) FROM user_card uc JOIN card c ON uc.card = c.card_id JOIN [set] s ON c.card_id IN (SELECT card_id FROM card) WHERE uc.user_id = @user_id AND uc.sold_at IS NULL AND c.is_rookie = 1 AND s.organization = 2'),
    ('Football Rookie Collector', 'Collect 25 football rookie cards', 25, 'Common', 25, 'SELECT COUNT(*) FROM user_card uc JOIN card c ON uc.card = c.card_id JOIN [set] s ON c.card_id IN (SELECT card_id FROM card) WHERE uc.user_id = @user_id AND uc.sold_at IS NULL AND c.is_rookie = 1 AND s.organization = 2'),
    ('Football Rookie Hunter', 'Collect 50 football rookie cards', 50, 'Uncommon', 50, 'SELECT COUNT(*) FROM user_card uc JOIN card c ON uc.card = c.card_id JOIN [set] s ON c.card_id IN (SELECT card_id FROM card) WHERE uc.user_id = @user_id AND uc.sold_at IS NULL AND c.is_rookie = 1 AND s.organization = 2'),
    ('Football Rookie Enthusiast', 'Collect 100 football rookie cards', 100, 'Rare', 100, 'SELECT COUNT(*) FROM user_card uc JOIN card c ON uc.card = c.card_id JOIN [set] s ON c.card_id IN (SELECT card_id FROM card) WHERE uc.user_id = @user_id AND uc.sold_at IS NULL AND c.is_rookie = 1 AND s.organization = 2'),
    ('Football Rookie Expert', 'Collect 250 football rookie cards', 150, 'Epic', 250, 'SELECT COUNT(*) FROM user_card uc JOIN card c ON uc.card = c.card_id JOIN [set] s ON c.card_id IN (SELECT card_id FROM card) WHERE uc.user_id = @user_id AND uc.sold_at IS NULL AND c.is_rookie = 1 AND s.organization = 2'),
    ('Football Rookie Master', 'Collect 500 football rookie cards', 200, 'Legendary', 500, 'SELECT COUNT(*) FROM user_card uc JOIN card c ON uc.card = c.card_id JOIN [set] s ON c.card_id IN (SELECT card_id FROM card) WHERE uc.user_id = @user_id AND uc.sold_at IS NULL AND c.is_rookie = 1 AND s.organization = 2')
) AS source (name, description, points, tier, req_value, req_query)
ON target.name = source.name
WHEN NOT MATCHED THEN
    INSERT (category_id, name, description, points, tier, requirement_type, requirement_value, requirement_query, is_active, is_secret, created_at, updated_at)
    VALUES (@RookieCards, source.name, source.description, source.points, source.tier, 'count', source.req_value, source.req_query, 1, 0, GETDATE(), GETDATE());

-- Basketball Rookies
MERGE INTO achievements AS target
USING (VALUES
    ('Basketball Rookie Starter', 'Collect 5 basketball rookie cards', 10, 'Common', 5, 'SELECT COUNT(*) FROM user_card uc JOIN card c ON uc.card = c.card_id JOIN [set] s ON c.card_id IN (SELECT card_id FROM card) WHERE uc.user_id = @user_id AND uc.sold_at IS NULL AND c.is_rookie = 1 AND s.organization = 3'),
    ('Basketball Rookie Collector', 'Collect 25 basketball rookie cards', 25, 'Common', 25, 'SELECT COUNT(*) FROM user_card uc JOIN card c ON uc.card = c.card_id JOIN [set] s ON c.card_id IN (SELECT card_id FROM card) WHERE uc.user_id = @user_id AND uc.sold_at IS NULL AND c.is_rookie = 1 AND s.organization = 3'),
    ('Basketball Rookie Hunter', 'Collect 50 basketball rookie cards', 50, 'Uncommon', 50, 'SELECT COUNT(*) FROM user_card uc JOIN card c ON uc.card = c.card_id JOIN [set] s ON c.card_id IN (SELECT card_id FROM card) WHERE uc.user_id = @user_id AND uc.sold_at IS NULL AND c.is_rookie = 1 AND s.organization = 3'),
    ('Basketball Rookie Enthusiast', 'Collect 100 basketball rookie cards', 100, 'Rare', 100, 'SELECT COUNT(*) FROM user_card uc JOIN card c ON uc.card = c.card_id JOIN [set] s ON c.card_id IN (SELECT card_id FROM card) WHERE uc.user_id = @user_id AND uc.sold_at IS NULL AND c.is_rookie = 1 AND s.organization = 3'),
    ('Basketball Rookie Expert', 'Collect 250 basketball rookie cards', 150, 'Epic', 250, 'SELECT COUNT(*) FROM user_card uc JOIN card c ON uc.card = c.card_id JOIN [set] s ON c.card_id IN (SELECT card_id FROM card) WHERE uc.user_id = @user_id AND uc.sold_at IS NULL AND c.is_rookie = 1 AND s.organization = 3'),
    ('Basketball Rookie Master', 'Collect 500 basketball rookie cards', 200, 'Legendary', 500, 'SELECT COUNT(*) FROM user_card uc JOIN card c ON uc.card = c.card_id JOIN [set] s ON c.card_id IN (SELECT card_id FROM card) WHERE uc.user_id = @user_id AND uc.sold_at IS NULL AND c.is_rookie = 1 AND s.organization = 3')
) AS source (name, description, points, tier, req_value, req_query)
ON target.name = source.name
WHEN NOT MATCHED THEN
    INSERT (category_id, name, description, points, tier, requirement_type, requirement_value, requirement_query, is_active, is_secret, created_at, updated_at)
    VALUES (@RookieCards, source.name, source.description, source.points, source.tier, 'count', source.req_value, source.req_query, 1, 0, GETDATE(), GETDATE());

-- Hockey Rookies
MERGE INTO achievements AS target
USING (VALUES
    ('Hockey Rookie Starter', 'Collect 5 hockey rookie cards', 10, 'Common', 5, 'SELECT COUNT(*) FROM user_card uc JOIN card c ON uc.card = c.card_id JOIN [set] s ON c.card_id IN (SELECT card_id FROM card) WHERE uc.user_id = @user_id AND uc.sold_at IS NULL AND c.is_rookie = 1 AND s.organization = 4'),
    ('Hockey Rookie Collector', 'Collect 25 hockey rookie cards', 25, 'Common', 25, 'SELECT COUNT(*) FROM user_card uc JOIN card c ON uc.card = c.card_id JOIN [set] s ON c.card_id IN (SELECT card_id FROM card) WHERE uc.user_id = @user_id AND uc.sold_at IS NULL AND c.is_rookie = 1 AND s.organization = 4'),
    ('Hockey Rookie Hunter', 'Collect 50 hockey rookie cards', 50, 'Uncommon', 50, 'SELECT COUNT(*) FROM user_card uc JOIN card c ON uc.card = c.card_id JOIN [set] s ON c.card_id IN (SELECT card_id FROM card) WHERE uc.user_id = @user_id AND uc.sold_at IS NULL AND c.is_rookie = 1 AND s.organization = 4'),
    ('Hockey Rookie Enthusiast', 'Collect 100 hockey rookie cards', 100, 'Rare', 100, 'SELECT COUNT(*) FROM user_card uc JOIN card c ON uc.card = c.card_id JOIN [set] s ON c.card_id IN (SELECT card_id FROM card) WHERE uc.user_id = @user_id AND uc.sold_at IS NULL AND c.is_rookie = 1 AND s.organization = 4'),
    ('Hockey Rookie Expert', 'Collect 250 hockey rookie cards', 150, 'Epic', 250, 'SELECT COUNT(*) FROM user_card uc JOIN card c ON uc.card = c.card_id JOIN [set] s ON c.card_id IN (SELECT card_id FROM card) WHERE uc.user_id = @user_id AND uc.sold_at IS NULL AND c.is_rookie = 1 AND s.organization = 4'),
    ('Hockey Rookie Master', 'Collect 500 hockey rookie cards', 200, 'Legendary', 500, 'SELECT COUNT(*) FROM user_card uc JOIN card c ON uc.card = c.card_id JOIN [set] s ON c.card_id IN (SELECT card_id FROM card) WHERE uc.user_id = @user_id AND uc.sold_at IS NULL AND c.is_rookie = 1 AND s.organization = 4')
) AS source (name, description, points, tier, req_value, req_query)
ON target.name = source.name
WHEN NOT MATCHED THEN
    INSERT (category_id, name, description, points, tier, requirement_type, requirement_value, requirement_query, is_active, is_secret, created_at, updated_at)
    VALUES (@RookieCards, source.name, source.description, source.points, source.tier, 'count', source.req_value, source.req_query, 1, 0, GETDATE(), GETDATE());

-- Soccer Rookies
MERGE INTO achievements AS target
USING (VALUES
    ('Soccer Rookie Starter', 'Collect 5 soccer rookie cards', 10, 'Common', 5, 'SELECT COUNT(*) FROM user_card uc JOIN card c ON uc.card = c.card_id JOIN [set] s ON c.card_id IN (SELECT card_id FROM card) WHERE uc.user_id = @user_id AND uc.sold_at IS NULL AND c.is_rookie = 1 AND s.organization = 7'),
    ('Soccer Rookie Collector', 'Collect 25 soccer rookie cards', 25, 'Common', 25, 'SELECT COUNT(*) FROM user_card uc JOIN card c ON uc.card = c.card_id JOIN [set] s ON c.card_id IN (SELECT card_id FROM card) WHERE uc.user_id = @user_id AND uc.sold_at IS NULL AND c.is_rookie = 1 AND s.organization = 7'),
    ('Soccer Rookie Hunter', 'Collect 50 soccer rookie cards', 50, 'Uncommon', 50, 'SELECT COUNT(*) FROM user_card uc JOIN card c ON uc.card = c.card_id JOIN [set] s ON c.card_id IN (SELECT card_id FROM card) WHERE uc.user_id = @user_id AND uc.sold_at IS NULL AND c.is_rookie = 1 AND s.organization = 7'),
    ('Soccer Rookie Enthusiast', 'Collect 100 soccer rookie cards', 100, 'Rare', 100, 'SELECT COUNT(*) FROM user_card uc JOIN card c ON uc.card = c.card_id JOIN [set] s ON c.card_id IN (SELECT card_id FROM card) WHERE uc.user_id = @user_id AND uc.sold_at IS NULL AND c.is_rookie = 1 AND s.organization = 7')
) AS source (name, description, points, tier, req_value, req_query)
ON target.name = source.name
WHEN NOT MATCHED THEN
    INSERT (category_id, name, description, points, tier, requirement_type, requirement_value, requirement_query, is_active, is_secret, created_at, updated_at)
    VALUES (@RookieCards, source.name, source.description, source.points, source.tier, 'count', source.req_value, source.req_query, 1, 0, GETDATE(), GETDATE());

-- Numbered Rookies (rookies with print runs)
MERGE INTO achievements AS target
USING (VALUES
    ('Numbered Rookie Finder', 'Collect 1 numbered rookie card', 15, 'Common', 1, 'SELECT COUNT(*) FROM user_card uc JOIN card c ON uc.card = c.card_id WHERE uc.user_id = @user_id AND uc.sold_at IS NULL AND c.is_rookie = 1 AND c.print_run IS NOT NULL'),
    ('Numbered Rookie Collector', 'Collect 5 numbered rookie cards', 30, 'Uncommon', 5, 'SELECT COUNT(*) FROM user_card uc JOIN card c ON uc.card = c.card_id WHERE uc.user_id = @user_id AND uc.sold_at IS NULL AND c.is_rookie = 1 AND c.print_run IS NOT NULL'),
    ('Numbered Rookie Hunter', 'Collect 10 numbered rookie cards', 50, 'Rare', 10, 'SELECT COUNT(*) FROM user_card uc JOIN card c ON uc.card = c.card_id WHERE uc.user_id = @user_id AND uc.sold_at IS NULL AND c.is_rookie = 1 AND c.print_run IS NOT NULL'),
    ('Numbered Rookie Enthusiast', 'Collect 25 numbered rookie cards', 75, 'Epic', 25, 'SELECT COUNT(*) FROM user_card uc JOIN card c ON uc.card = c.card_id WHERE uc.user_id = @user_id AND uc.sold_at IS NULL AND c.is_rookie = 1 AND c.print_run IS NOT NULL'),
    ('Numbered Rookie Expert', 'Collect 50 numbered rookie cards', 100, 'Legendary', 50, 'SELECT COUNT(*) FROM user_card uc JOIN card c ON uc.card = c.card_id WHERE uc.user_id = @user_id AND uc.sold_at IS NULL AND c.is_rookie = 1 AND c.print_run IS NOT NULL'),
    ('Numbered Rookie Master', 'Collect 100 numbered rookie cards', 150, 'Mythic', 100, 'SELECT COUNT(*) FROM user_card uc JOIN card c ON uc.card = c.card_id WHERE uc.user_id = @user_id AND uc.sold_at IS NULL AND c.is_rookie = 1 AND c.print_run IS NOT NULL')
) AS source (name, description, points, tier, req_value, req_query)
ON target.name = source.name
WHEN NOT MATCHED THEN
    INSERT (category_id, name, description, points, tier, requirement_type, requirement_value, requirement_query, is_active, is_secret, created_at, updated_at)
    VALUES (@RookieCards, source.name, source.description, source.points, source.tier, 'count', source.req_value, source.req_query, 1, 0, GETDATE(), GETDATE());

-- Low Numbered Rookies (/25 or less)
MERGE INTO achievements AS target
USING (VALUES
    ('Elite Rookie Find', 'Collect 1 rookie card numbered to 25 or less', 50, 'Rare', 1, 'SELECT COUNT(*) FROM user_card uc JOIN card c ON uc.card = c.card_id WHERE uc.user_id = @user_id AND uc.sold_at IS NULL AND c.is_rookie = 1 AND c.print_run IS NOT NULL AND c.print_run <= 25'),
    ('Elite Rookie Collector', 'Collect 5 rookie cards numbered to 25 or less', 100, 'Epic', 5, 'SELECT COUNT(*) FROM user_card uc JOIN card c ON uc.card = c.card_id WHERE uc.user_id = @user_id AND uc.sold_at IS NULL AND c.is_rookie = 1 AND c.print_run IS NOT NULL AND c.print_run <= 25'),
    ('Elite Rookie Hunter', 'Collect 10 rookie cards numbered to 25 or less', 150, 'Legendary', 10, 'SELECT COUNT(*) FROM user_card uc JOIN card c ON uc.card = c.card_id WHERE uc.user_id = @user_id AND uc.sold_at IS NULL AND c.is_rookie = 1 AND c.print_run IS NOT NULL AND c.print_run <= 25'),
    ('Elite Rookie Master', 'Collect 25 rookie cards numbered to 25 or less', 250, 'Mythic', 25, 'SELECT COUNT(*) FROM user_card uc JOIN card c ON uc.card = c.card_id WHERE uc.user_id = @user_id AND uc.sold_at IS NULL AND c.is_rookie = 1 AND c.print_run IS NOT NULL AND c.print_run <= 25')
) AS source (name, description, points, tier, req_value, req_query)
ON target.name = source.name
WHEN NOT MATCHED THEN
    INSERT (category_id, name, description, points, tier, requirement_type, requirement_value, requirement_query, is_active, is_secret, created_at, updated_at)
    VALUES (@RookieCards, source.name, source.description, source.points, source.tier, 'count', source.req_value, source.req_query, 1, 0, GETDATE(), GETDATE());

-- 1/1 Rookies
MERGE INTO achievements AS target
USING (VALUES
    ('One of One Rookie', 'Collect a 1/1 rookie card', 200, 'Mythic', 1, 'SELECT COUNT(*) FROM user_card uc JOIN card c ON uc.card = c.card_id WHERE uc.user_id = @user_id AND uc.sold_at IS NULL AND c.is_rookie = 1 AND c.print_run = 1'),
    ('One of One Rookie Collector', 'Collect 3 different 1/1 rookie cards', 500, 'Mythic', 3, 'SELECT COUNT(*) FROM user_card uc JOIN card c ON uc.card = c.card_id WHERE uc.user_id = @user_id AND uc.sold_at IS NULL AND c.is_rookie = 1 AND c.print_run = 1')
) AS source (name, description, points, tier, req_value, req_query)
ON target.name = source.name
WHEN NOT MATCHED THEN
    INSERT (category_id, name, description, points, tier, requirement_type, requirement_value, requirement_query, is_active, is_secret, created_at, updated_at)
    VALUES (@RookieCards, source.name, source.description, source.points, source.tier, 'count', source.req_value, source.req_query, 1, 0, GETDATE(), GETDATE());

-- Autographed Rookies
MERGE INTO achievements AS target
USING (VALUES
    ('Signed Rookie', 'Collect 1 autographed rookie card', 20, 'Uncommon', 1, 'SELECT COUNT(*) FROM user_card uc JOIN card c ON uc.card = c.card_id WHERE uc.user_id = @user_id AND uc.sold_at IS NULL AND c.is_rookie = 1 AND c.is_autograph = 1'),
    ('Signed Rookie Collector', 'Collect 5 autographed rookie cards', 40, 'Rare', 5, 'SELECT COUNT(*) FROM user_card uc JOIN card c ON uc.card = c.card_id WHERE uc.user_id = @user_id AND uc.sold_at IS NULL AND c.is_rookie = 1 AND c.is_autograph = 1'),
    ('Signed Rookie Hunter', 'Collect 10 autographed rookie cards', 75, 'Epic', 10, 'SELECT COUNT(*) FROM user_card uc JOIN card c ON uc.card = c.card_id WHERE uc.user_id = @user_id AND uc.sold_at IS NULL AND c.is_rookie = 1 AND c.is_autograph = 1'),
    ('Signed Rookie Enthusiast', 'Collect 25 autographed rookie cards', 100, 'Legendary', 25, 'SELECT COUNT(*) FROM user_card uc JOIN card c ON uc.card = c.card_id WHERE uc.user_id = @user_id AND uc.sold_at IS NULL AND c.is_rookie = 1 AND c.is_autograph = 1'),
    ('Signed Rookie Master', 'Collect 50 autographed rookie cards', 150, 'Mythic', 50, 'SELECT COUNT(*) FROM user_card uc JOIN card c ON uc.card = c.card_id WHERE uc.user_id = @user_id AND uc.sold_at IS NULL AND c.is_rookie = 1 AND c.is_autograph = 1')
) AS source (name, description, points, tier, req_value, req_query)
ON target.name = source.name
WHEN NOT MATCHED THEN
    INSERT (category_id, name, description, points, tier, requirement_type, requirement_value, requirement_query, is_active, is_secret, created_at, updated_at)
    VALUES (@RookieCards, source.name, source.description, source.points, source.tier, 'count', source.req_value, source.req_query, 1, 0, GETDATE(), GETDATE());

-- Rookie Relics
MERGE INTO achievements AS target
USING (VALUES
    ('Rookie Relic Find', 'Collect 1 rookie relic card', 20, 'Uncommon', 1, 'SELECT COUNT(*) FROM user_card uc JOIN card c ON uc.card = c.card_id WHERE uc.user_id = @user_id AND uc.sold_at IS NULL AND c.is_rookie = 1 AND c.is_relic = 1'),
    ('Rookie Relic Collector', 'Collect 5 rookie relic cards', 40, 'Rare', 5, 'SELECT COUNT(*) FROM user_card uc JOIN card c ON uc.card = c.card_id WHERE uc.user_id = @user_id AND uc.sold_at IS NULL AND c.is_rookie = 1 AND c.is_relic = 1'),
    ('Rookie Relic Hunter', 'Collect 10 rookie relic cards', 75, 'Epic', 10, 'SELECT COUNT(*) FROM user_card uc JOIN card c ON uc.card = c.card_id WHERE uc.user_id = @user_id AND uc.sold_at IS NULL AND c.is_rookie = 1 AND c.is_relic = 1'),
    ('Rookie Relic Enthusiast', 'Collect 25 rookie relic cards', 100, 'Legendary', 25, 'SELECT COUNT(*) FROM user_card uc JOIN card c ON uc.card = c.card_id WHERE uc.user_id = @user_id AND uc.sold_at IS NULL AND c.is_rookie = 1 AND c.is_relic = 1'),
    ('Rookie Relic Master', 'Collect 50 rookie relic cards', 150, 'Mythic', 50, 'SELECT COUNT(*) FROM user_card uc JOIN card c ON uc.card = c.card_id WHERE uc.user_id = @user_id AND uc.sold_at IS NULL AND c.is_rookie = 1 AND c.is_relic = 1')
) AS source (name, description, points, tier, req_value, req_query)
ON target.name = source.name
WHEN NOT MATCHED THEN
    INSERT (category_id, name, description, points, tier, requirement_type, requirement_value, requirement_query, is_active, is_secret, created_at, updated_at)
    VALUES (@RookieCards, source.name, source.description, source.points, source.tier, 'count', source.req_value, source.req_query, 1, 0, GETDATE(), GETDATE());

-- Graded Rookies
MERGE INTO achievements AS target
USING (VALUES
    ('Graded Rookie', 'Own 1 graded rookie card', 25, 'Uncommon', 1, 'SELECT COUNT(*) FROM user_card uc JOIN card c ON uc.card = c.card_id WHERE uc.user_id = @user_id AND uc.sold_at IS NULL AND c.is_rookie = 1 AND uc.grading_agency IS NOT NULL'),
    ('Graded Rookie Collector', 'Own 5 graded rookie cards', 50, 'Rare', 5, 'SELECT COUNT(*) FROM user_card uc JOIN card c ON uc.card = c.card_id WHERE uc.user_id = @user_id AND uc.sold_at IS NULL AND c.is_rookie = 1 AND uc.grading_agency IS NOT NULL'),
    ('Graded Rookie Hunter', 'Own 10 graded rookie cards', 100, 'Epic', 10, 'SELECT COUNT(*) FROM user_card uc JOIN card c ON uc.card = c.card_id WHERE uc.user_id = @user_id AND uc.sold_at IS NULL AND c.is_rookie = 1 AND uc.grading_agency IS NOT NULL'),
    ('Graded Rookie Expert', 'Own 25 graded rookie cards', 150, 'Legendary', 25, 'SELECT COUNT(*) FROM user_card uc JOIN card c ON uc.card = c.card_id WHERE uc.user_id = @user_id AND uc.sold_at IS NULL AND c.is_rookie = 1 AND uc.grading_agency IS NOT NULL'),
    ('Graded Rookie Master', 'Own 50 graded rookie cards', 200, 'Mythic', 50, 'SELECT COUNT(*) FROM user_card uc JOIN card c ON uc.card = c.card_id WHERE uc.user_id = @user_id AND uc.sold_at IS NULL AND c.is_rookie = 1 AND uc.grading_agency IS NOT NULL')
) AS source (name, description, points, tier, req_value, req_query)
ON target.name = source.name
WHEN NOT MATCHED THEN
    INSERT (category_id, name, description, points, tier, requirement_type, requirement_value, requirement_query, is_active, is_secret, created_at, updated_at)
    VALUES (@RookieCards, source.name, source.description, source.points, source.tier, 'count', source.req_value, source.req_query, 1, 0, GETDATE(), GETDATE());

-- Rookie by Manufacturer
MERGE INTO achievements AS target
USING (VALUES
    ('Topps Rookie Collector', 'Collect 25 Topps rookie cards', 30, 'Uncommon', 25, 'SELECT COUNT(*) FROM user_card uc JOIN card c ON uc.card = c.card_id JOIN [set] s ON c.card_id IN (SELECT card_id FROM card) WHERE uc.user_id = @user_id AND uc.sold_at IS NULL AND c.is_rookie = 1 AND s.manufacturer = 1'),
    ('Topps Rookie Expert', 'Collect 100 Topps rookie cards', 75, 'Epic', 100, 'SELECT COUNT(*) FROM user_card uc JOIN card c ON uc.card = c.card_id JOIN [set] s ON c.card_id IN (SELECT card_id FROM card) WHERE uc.user_id = @user_id AND uc.sold_at IS NULL AND c.is_rookie = 1 AND s.manufacturer = 1'),
    ('Panini Rookie Collector', 'Collect 25 Panini rookie cards', 30, 'Uncommon', 25, 'SELECT COUNT(*) FROM user_card uc JOIN card c ON uc.card = c.card_id JOIN [set] s ON c.card_id IN (SELECT card_id FROM card) WHERE uc.user_id = @user_id AND uc.sold_at IS NULL AND c.is_rookie = 1 AND s.manufacturer = 2'),
    ('Panini Rookie Expert', 'Collect 100 Panini rookie cards', 75, 'Epic', 100, 'SELECT COUNT(*) FROM user_card uc JOIN card c ON uc.card = c.card_id JOIN [set] s ON c.card_id IN (SELECT card_id FROM card) WHERE uc.user_id = @user_id AND uc.sold_at IS NULL AND c.is_rookie = 1 AND s.manufacturer = 2'),
    ('Upper Deck Rookie Collector', 'Collect 25 Upper Deck rookie cards', 30, 'Uncommon', 25, 'SELECT COUNT(*) FROM user_card uc JOIN card c ON uc.card = c.card_id JOIN [set] s ON c.card_id IN (SELECT card_id FROM card) WHERE uc.user_id = @user_id AND uc.sold_at IS NULL AND c.is_rookie = 1 AND s.manufacturer = 3'),
    ('Upper Deck Rookie Expert', 'Collect 100 Upper Deck rookie cards', 75, 'Epic', 100, 'SELECT COUNT(*) FROM user_card uc JOIN card c ON uc.card = c.card_id JOIN [set] s ON c.card_id IN (SELECT card_id FROM card) WHERE uc.user_id = @user_id AND uc.sold_at IS NULL AND c.is_rookie = 1 AND s.manufacturer = 3'),
    ('Bowman Rookie Collector', 'Collect 25 Bowman rookie cards', 30, 'Uncommon', 25, 'SELECT COUNT(*) FROM user_card uc JOIN card c ON uc.card = c.card_id JOIN [set] s ON c.card_id IN (SELECT card_id FROM card) WHERE uc.user_id = @user_id AND uc.sold_at IS NULL AND c.is_rookie = 1 AND s.manufacturer = 4'),
    ('Bowman Rookie Expert', 'Collect 100 Bowman rookie cards', 75, 'Epic', 100, 'SELECT COUNT(*) FROM user_card uc JOIN card c ON uc.card = c.card_id JOIN [set] s ON c.card_id IN (SELECT card_id FROM card) WHERE uc.user_id = @user_id AND uc.sold_at IS NULL AND c.is_rookie = 1 AND s.manufacturer = 4')
) AS source (name, description, points, tier, req_value, req_query)
ON target.name = source.name
WHEN NOT MATCHED THEN
    INSERT (category_id, name, description, points, tier, requirement_type, requirement_value, requirement_query, is_active, is_secret, created_at, updated_at)
    VALUES (@RookieCards, source.name, source.description, source.points, source.tier, 'count', source.req_value, source.req_query, 1, 0, GETDATE(), GETDATE());

-- Rookie Decade Achievements
MERGE INTO achievements AS target
USING (VALUES
    ('1990s Rookie Collector', 'Collect 10 rookie cards from the 1990s', 40, 'Uncommon', 10, 'SELECT COUNT(*) FROM user_card uc JOIN card c ON uc.card = c.card_id JOIN [set] s ON c.card_id IN (SELECT card_id FROM card) WHERE uc.user_id = @user_id AND uc.sold_at IS NULL AND c.is_rookie = 1 AND s.year >= 1990 AND s.year <= 1999'),
    ('2000s Rookie Collector', 'Collect 10 rookie cards from the 2000s', 35, 'Uncommon', 10, 'SELECT COUNT(*) FROM user_card uc JOIN card c ON uc.card = c.card_id JOIN [set] s ON c.card_id IN (SELECT card_id FROM card) WHERE uc.user_id = @user_id AND uc.sold_at IS NULL AND c.is_rookie = 1 AND s.year >= 2000 AND s.year <= 2009'),
    ('2010s Rookie Collector', 'Collect 10 rookie cards from the 2010s', 30, 'Uncommon', 10, 'SELECT COUNT(*) FROM user_card uc JOIN card c ON uc.card = c.card_id JOIN [set] s ON c.card_id IN (SELECT card_id FROM card) WHERE uc.user_id = @user_id AND uc.sold_at IS NULL AND c.is_rookie = 1 AND s.year >= 2010 AND s.year <= 2019'),
    ('2020s Rookie Collector', 'Collect 10 rookie cards from the 2020s', 25, 'Common', 10, 'SELECT COUNT(*) FROM user_card uc JOIN card c ON uc.card = c.card_id JOIN [set] s ON c.card_id IN (SELECT card_id FROM card) WHERE uc.user_id = @user_id AND uc.sold_at IS NULL AND c.is_rookie = 1 AND s.year >= 2020 AND s.year <= 2029'),
    ('Vintage Rookie Hunter', 'Collect 5 rookie cards from before 1980', 75, 'Rare', 5, 'SELECT COUNT(*) FROM user_card uc JOIN card c ON uc.card = c.card_id JOIN [set] s ON c.card_id IN (SELECT card_id FROM card) WHERE uc.user_id = @user_id AND uc.sold_at IS NULL AND c.is_rookie = 1 AND s.year < 1980'),
    ('Vintage Rookie Master', 'Collect 25 rookie cards from before 1980', 150, 'Legendary', 25, 'SELECT COUNT(*) FROM user_card uc JOIN card c ON uc.card = c.card_id JOIN [set] s ON c.card_id IN (SELECT card_id FROM card) WHERE uc.user_id = @user_id AND uc.sold_at IS NULL AND c.is_rookie = 1 AND s.year < 1980')
) AS source (name, description, points, tier, req_value, req_query)
ON target.name = source.name
WHEN NOT MATCHED THEN
    INSERT (category_id, name, description, points, tier, requirement_type, requirement_value, requirement_query, is_active, is_secret, created_at, updated_at)
    VALUES (@RookieCards, source.name, source.description, source.points, source.tier, 'count', source.req_value, source.req_query, 1, 0, GETDATE(), GETDATE());

-- Short Print Rookies
MERGE INTO achievements AS target
USING (VALUES
    ('Short Print Rookie Find', 'Collect 1 short print rookie card', 25, 'Uncommon', 1, 'SELECT COUNT(*) FROM user_card uc JOIN card c ON uc.card = c.card_id WHERE uc.user_id = @user_id AND uc.sold_at IS NULL AND c.is_rookie = 1 AND c.is_short_print = 1'),
    ('Short Print Rookie Collector', 'Collect 5 short print rookie cards', 50, 'Rare', 5, 'SELECT COUNT(*) FROM user_card uc JOIN card c ON uc.card = c.card_id WHERE uc.user_id = @user_id AND uc.sold_at IS NULL AND c.is_rookie = 1 AND c.is_short_print = 1'),
    ('Short Print Rookie Hunter', 'Collect 10 short print rookie cards', 100, 'Epic', 10, 'SELECT COUNT(*) FROM user_card uc JOIN card c ON uc.card = c.card_id WHERE uc.user_id = @user_id AND uc.sold_at IS NULL AND c.is_rookie = 1 AND c.is_short_print = 1'),
    ('Short Print Rookie Master', 'Collect 25 short print rookie cards', 150, 'Legendary', 25, 'SELECT COUNT(*) FROM user_card uc JOIN card c ON uc.card = c.card_id WHERE uc.user_id = @user_id AND uc.sold_at IS NULL AND c.is_rookie = 1 AND c.is_short_print = 1')
) AS source (name, description, points, tier, req_value, req_query)
ON target.name = source.name
WHEN NOT MATCHED THEN
    INSERT (category_id, name, description, points, tier, requirement_type, requirement_value, requirement_query, is_active, is_secret, created_at, updated_at)
    VALUES (@RookieCards, source.name, source.description, source.points, source.tier, 'count', source.req_value, source.req_query, 1, 0, GETDATE(), GETDATE());

PRINT 'Rookie Cards expanded.';

-- ============================================================================
-- SPECIAL CARDS EXPANSION (Target: ~100)
-- Current: 24, Need: ~76 more
-- ============================================================================
PRINT 'Expanding Special Cards...';

-- Color/Parallel Achievements by specific colors (34 colors available)
MERGE INTO achievements AS target
USING (VALUES
    -- Gold Parallels (color_id = 4)
    ('Gold Collector', 'Collect 5 gold parallel cards', 20, 'Common', 5, 'SELECT COUNT(*) FROM user_card uc JOIN card c ON uc.card = c.card_id WHERE uc.user_id = @user_id AND uc.sold_at IS NULL AND c.color = 4'),
    ('Gold Hunter', 'Collect 25 gold parallel cards', 50, 'Uncommon', 25, 'SELECT COUNT(*) FROM user_card uc JOIN card c ON uc.card = c.card_id WHERE uc.user_id = @user_id AND uc.sold_at IS NULL AND c.color = 4'),
    ('Gold Enthusiast', 'Collect 50 gold parallel cards', 100, 'Rare', 50, 'SELECT COUNT(*) FROM user_card uc JOIN card c ON uc.card = c.card_id WHERE uc.user_id = @user_id AND uc.sold_at IS NULL AND c.color = 4'),
    ('Gold Master', 'Collect 100 gold parallel cards', 150, 'Epic', 100, 'SELECT COUNT(*) FROM user_card uc JOIN card c ON uc.card = c.card_id WHERE uc.user_id = @user_id AND uc.sold_at IS NULL AND c.color = 4'),
    -- Red Parallels (color_id = 15)
    ('Red Collector', 'Collect 5 red parallel cards', 20, 'Common', 5, 'SELECT COUNT(*) FROM user_card uc JOIN card c ON uc.card = c.card_id WHERE uc.user_id = @user_id AND uc.sold_at IS NULL AND c.color = 15'),
    ('Red Hunter', 'Collect 25 red parallel cards', 50, 'Uncommon', 25, 'SELECT COUNT(*) FROM user_card uc JOIN card c ON uc.card = c.card_id WHERE uc.user_id = @user_id AND uc.sold_at IS NULL AND c.color = 15'),
    ('Red Enthusiast', 'Collect 50 red parallel cards', 100, 'Rare', 50, 'SELECT COUNT(*) FROM user_card uc JOIN card c ON uc.card = c.card_id WHERE uc.user_id = @user_id AND uc.sold_at IS NULL AND c.color = 15'),
    ('Red Master', 'Collect 100 red parallel cards', 150, 'Epic', 100, 'SELECT COUNT(*) FROM user_card uc JOIN card c ON uc.card = c.card_id WHERE uc.user_id = @user_id AND uc.sold_at IS NULL AND c.color = 15'),
    -- Black Parallels (color_id = 2)
    ('Black Collector', 'Collect 5 black parallel cards', 20, 'Common', 5, 'SELECT COUNT(*) FROM user_card uc JOIN card c ON uc.card = c.card_id WHERE uc.user_id = @user_id AND uc.sold_at IS NULL AND c.color = 2'),
    ('Black Hunter', 'Collect 25 black parallel cards', 50, 'Uncommon', 25, 'SELECT COUNT(*) FROM user_card uc JOIN card c ON uc.card = c.card_id WHERE uc.user_id = @user_id AND uc.sold_at IS NULL AND c.color = 2'),
    ('Black Enthusiast', 'Collect 50 black parallel cards', 100, 'Rare', 50, 'SELECT COUNT(*) FROM user_card uc JOIN card c ON uc.card = c.card_id WHERE uc.user_id = @user_id AND uc.sold_at IS NULL AND c.color = 2'),
    ('Black Master', 'Collect 100 black parallel cards', 150, 'Epic', 100, 'SELECT COUNT(*) FROM user_card uc JOIN card c ON uc.card = c.card_id WHERE uc.user_id = @user_id AND uc.sold_at IS NULL AND c.color = 2'),
    -- Blue Parallels (color_id = 3)
    ('Blue Collector', 'Collect 5 blue parallel cards', 20, 'Common', 5, 'SELECT COUNT(*) FROM user_card uc JOIN card c ON uc.card = c.card_id WHERE uc.user_id = @user_id AND uc.sold_at IS NULL AND c.color = 3'),
    ('Blue Hunter', 'Collect 25 blue parallel cards', 50, 'Uncommon', 25, 'SELECT COUNT(*) FROM user_card uc JOIN card c ON uc.card = c.card_id WHERE uc.user_id = @user_id AND uc.sold_at IS NULL AND c.color = 3'),
    ('Blue Enthusiast', 'Collect 50 blue parallel cards', 100, 'Rare', 50, 'SELECT COUNT(*) FROM user_card uc JOIN card c ON uc.card = c.card_id WHERE uc.user_id = @user_id AND uc.sold_at IS NULL AND c.color = 3'),
    ('Blue Master', 'Collect 100 blue parallel cards', 150, 'Epic', 100, 'SELECT COUNT(*) FROM user_card uc JOIN card c ON uc.card = c.card_id WHERE uc.user_id = @user_id AND uc.sold_at IS NULL AND c.color = 3'),
    -- Green Parallels (color_id = 6)
    ('Green Collector', 'Collect 5 green parallel cards', 20, 'Common', 5, 'SELECT COUNT(*) FROM user_card uc JOIN card c ON uc.card = c.card_id WHERE uc.user_id = @user_id AND uc.sold_at IS NULL AND c.color = 6'),
    ('Green Hunter', 'Collect 25 green parallel cards', 50, 'Uncommon', 25, 'SELECT COUNT(*) FROM user_card uc JOIN card c ON uc.card = c.card_id WHERE uc.user_id = @user_id AND uc.sold_at IS NULL AND c.color = 6'),
    ('Green Enthusiast', 'Collect 50 green parallel cards', 100, 'Rare', 50, 'SELECT COUNT(*) FROM user_card uc JOIN card c ON uc.card = c.card_id WHERE uc.user_id = @user_id AND uc.sold_at IS NULL AND c.color = 6'),
    ('Green Master', 'Collect 100 green parallel cards', 150, 'Epic', 100, 'SELECT COUNT(*) FROM user_card uc JOIN card c ON uc.card = c.card_id WHERE uc.user_id = @user_id AND uc.sold_at IS NULL AND c.color = 6'),
    -- Orange Parallels (color_id = 9)
    ('Orange Collector', 'Collect 5 orange parallel cards', 20, 'Common', 5, 'SELECT COUNT(*) FROM user_card uc JOIN card c ON uc.card = c.card_id WHERE uc.user_id = @user_id AND uc.sold_at IS NULL AND c.color = 9'),
    ('Orange Hunter', 'Collect 25 orange parallel cards', 50, 'Uncommon', 25, 'SELECT COUNT(*) FROM user_card uc JOIN card c ON uc.card = c.card_id WHERE uc.user_id = @user_id AND uc.sold_at IS NULL AND c.color = 9'),
    ('Orange Enthusiast', 'Collect 50 orange parallel cards', 100, 'Rare', 50, 'SELECT COUNT(*) FROM user_card uc JOIN card c ON uc.card = c.card_id WHERE uc.user_id = @user_id AND uc.sold_at IS NULL AND c.color = 9'),
    -- Purple Parallels (color_id = 14)
    ('Purple Collector', 'Collect 5 purple parallel cards', 20, 'Common', 5, 'SELECT COUNT(*) FROM user_card uc JOIN card c ON uc.card = c.card_id WHERE uc.user_id = @user_id AND uc.sold_at IS NULL AND c.color = 14'),
    ('Purple Hunter', 'Collect 25 purple parallel cards', 50, 'Uncommon', 25, 'SELECT COUNT(*) FROM user_card uc JOIN card c ON uc.card = c.card_id WHERE uc.user_id = @user_id AND uc.sold_at IS NULL AND c.color = 14'),
    ('Purple Enthusiast', 'Collect 50 purple parallel cards', 100, 'Rare', 50, 'SELECT COUNT(*) FROM user_card uc JOIN card c ON uc.card = c.card_id WHERE uc.user_id = @user_id AND uc.sold_at IS NULL AND c.color = 14'),
    -- Silver Parallels (color_id = 17)
    ('Silver Collector', 'Collect 5 silver parallel cards', 20, 'Common', 5, 'SELECT COUNT(*) FROM user_card uc JOIN card c ON uc.card = c.card_id WHERE uc.user_id = @user_id AND uc.sold_at IS NULL AND c.color = 17'),
    ('Silver Hunter', 'Collect 25 silver parallel cards', 50, 'Uncommon', 25, 'SELECT COUNT(*) FROM user_card uc JOIN card c ON uc.card = c.card_id WHERE uc.user_id = @user_id AND uc.sold_at IS NULL AND c.color = 17'),
    -- Pink Parallels (color_id = 26)
    ('Pink Collector', 'Collect 5 pink parallel cards', 20, 'Common', 5, 'SELECT COUNT(*) FROM user_card uc JOIN card c ON uc.card = c.card_id WHERE uc.user_id = @user_id AND uc.sold_at IS NULL AND c.color = 26'),
    ('Pink Hunter', 'Collect 25 pink parallel cards', 50, 'Uncommon', 25, 'SELECT COUNT(*) FROM user_card uc JOIN card c ON uc.card = c.card_id WHERE uc.user_id = @user_id AND uc.sold_at IS NULL AND c.color = 26'),
    -- Rainbow Parallels (color_id = 18)
    ('Rainbow Collector', 'Collect 5 rainbow parallel cards', 25, 'Uncommon', 5, 'SELECT COUNT(*) FROM user_card uc JOIN card c ON uc.card = c.card_id WHERE uc.user_id = @user_id AND uc.sold_at IS NULL AND c.color = 18'),
    ('Rainbow Hunter', 'Collect 15 rainbow parallel cards', 75, 'Rare', 15, 'SELECT COUNT(*) FROM user_card uc JOIN card c ON uc.card = c.card_id WHERE uc.user_id = @user_id AND uc.sold_at IS NULL AND c.color = 18'),
    -- Platinum Parallels (color_id = 10)
    ('Platinum Collector', 'Collect 5 platinum parallel cards', 30, 'Uncommon', 5, 'SELECT COUNT(*) FROM user_card uc JOIN card c ON uc.card = c.card_id WHERE uc.user_id = @user_id AND uc.sold_at IS NULL AND c.color = 10'),
    ('Platinum Hunter', 'Collect 15 platinum parallel cards', 75, 'Rare', 15, 'SELECT COUNT(*) FROM user_card uc JOIN card c ON uc.card = c.card_id WHERE uc.user_id = @user_id AND uc.sold_at IS NULL AND c.color = 10'),
    -- Rose Gold (color_id = 22)
    ('Rose Gold Collector', 'Collect 3 rose gold parallel cards', 40, 'Rare', 3, 'SELECT COUNT(*) FROM user_card uc JOIN card c ON uc.card = c.card_id WHERE uc.user_id = @user_id AND uc.sold_at IS NULL AND c.color = 22'),
    ('Rose Gold Hunter', 'Collect 10 rose gold parallel cards', 100, 'Epic', 10, 'SELECT COUNT(*) FROM user_card uc JOIN card c ON uc.card = c.card_id WHERE uc.user_id = @user_id AND uc.sold_at IS NULL AND c.color = 22')
) AS source (name, description, points, tier, req_value, req_query)
ON target.name = source.name
WHEN NOT MATCHED THEN
    INSERT (category_id, name, description, points, tier, requirement_type, requirement_value, requirement_query, is_active, is_secret, created_at, updated_at)
    VALUES (@SpecialCards, source.name, source.description, source.points, source.tier, 'count', source.req_value, source.req_query, 1, 0, GETDATE(), GETDATE());

-- Grading Agency Specific
MERGE INTO achievements AS target
USING (VALUES
    -- PSA (grading_agency = 1)
    ('PSA Collector', 'Own 5 PSA graded cards', 30, 'Uncommon', 5, 'SELECT COUNT(*) FROM user_card WHERE user_id = @user_id AND sold_at IS NULL AND grading_agency = 1'),
    ('PSA Enthusiast', 'Own 25 PSA graded cards', 75, 'Rare', 25, 'SELECT COUNT(*) FROM user_card WHERE user_id = @user_id AND sold_at IS NULL AND grading_agency = 1'),
    ('PSA Expert', 'Own 50 PSA graded cards', 125, 'Epic', 50, 'SELECT COUNT(*) FROM user_card WHERE user_id = @user_id AND sold_at IS NULL AND grading_agency = 1'),
    ('PSA Master', 'Own 100 PSA graded cards', 200, 'Legendary', 100, 'SELECT COUNT(*) FROM user_card WHERE user_id = @user_id AND sold_at IS NULL AND grading_agency = 1'),
    -- BGS (grading_agency = 2)
    ('BGS Collector', 'Own 5 BGS graded cards', 30, 'Uncommon', 5, 'SELECT COUNT(*) FROM user_card WHERE user_id = @user_id AND sold_at IS NULL AND grading_agency = 2'),
    ('BGS Enthusiast', 'Own 25 BGS graded cards', 75, 'Rare', 25, 'SELECT COUNT(*) FROM user_card WHERE user_id = @user_id AND sold_at IS NULL AND grading_agency = 2'),
    ('BGS Expert', 'Own 50 BGS graded cards', 125, 'Epic', 50, 'SELECT COUNT(*) FROM user_card WHERE user_id = @user_id AND sold_at IS NULL AND grading_agency = 2'),
    -- SGC (grading_agency = 7)
    ('SGC Collector', 'Own 5 SGC graded cards', 30, 'Uncommon', 5, 'SELECT COUNT(*) FROM user_card WHERE user_id = @user_id AND sold_at IS NULL AND grading_agency = 7'),
    ('SGC Enthusiast', 'Own 25 SGC graded cards', 75, 'Rare', 25, 'SELECT COUNT(*) FROM user_card WHERE user_id = @user_id AND sold_at IS NULL AND grading_agency = 7'),
    -- CGC (grading_agency = 3)
    ('CGC Collector', 'Own 5 CGC graded cards', 30, 'Uncommon', 5, 'SELECT COUNT(*) FROM user_card WHERE user_id = @user_id AND sold_at IS NULL AND grading_agency = 3'),
    -- CSG (grading_agency = 4)
    ('CSG Collector', 'Own 5 CSG graded cards', 30, 'Uncommon', 5, 'SELECT COUNT(*) FROM user_card WHERE user_id = @user_id AND sold_at IS NULL AND grading_agency = 4'),
    -- HGA (grading_agency = 5)
    ('HGA Collector', 'Own 5 HGA graded cards', 30, 'Uncommon', 5, 'SELECT COUNT(*) FROM user_card WHERE user_id = @user_id AND sold_at IS NULL AND grading_agency = 5')
) AS source (name, description, points, tier, req_value, req_query)
ON target.name = source.name
WHEN NOT MATCHED THEN
    INSERT (category_id, name, description, points, tier, requirement_type, requirement_value, requirement_query, is_active, is_secret, created_at, updated_at)
    VALUES (@SpecialCards, source.name, source.description, source.points, source.tier, 'count', source.req_value, source.req_query, 1, 0, GETDATE(), GETDATE());

-- Print Run Specific Achievements
MERGE INTO achievements AS target
USING (VALUES
    -- /99 or less
    ('Under 100 Collector', 'Collect 5 cards numbered to 99 or less', 30, 'Uncommon', 5, 'SELECT COUNT(*) FROM user_card uc JOIN card c ON uc.card = c.card_id WHERE uc.user_id = @user_id AND uc.sold_at IS NULL AND c.print_run IS NOT NULL AND c.print_run <= 99'),
    ('Under 100 Hunter', 'Collect 25 cards numbered to 99 or less', 75, 'Rare', 25, 'SELECT COUNT(*) FROM user_card uc JOIN card c ON uc.card = c.card_id WHERE uc.user_id = @user_id AND uc.sold_at IS NULL AND c.print_run IS NOT NULL AND c.print_run <= 99'),
    ('Under 100 Expert', 'Collect 50 cards numbered to 99 or less', 125, 'Epic', 50, 'SELECT COUNT(*) FROM user_card uc JOIN card c ON uc.card = c.card_id WHERE uc.user_id = @user_id AND uc.sold_at IS NULL AND c.print_run IS NOT NULL AND c.print_run <= 99'),
    ('Under 100 Master', 'Collect 100 cards numbered to 99 or less', 200, 'Legendary', 100, 'SELECT COUNT(*) FROM user_card uc JOIN card c ON uc.card = c.card_id WHERE uc.user_id = @user_id AND uc.sold_at IS NULL AND c.print_run IS NOT NULL AND c.print_run <= 99'),
    -- /50 or less
    ('Under 50 Collector', 'Collect 5 cards numbered to 50 or less', 40, 'Uncommon', 5, 'SELECT COUNT(*) FROM user_card uc JOIN card c ON uc.card = c.card_id WHERE uc.user_id = @user_id AND uc.sold_at IS NULL AND c.print_run IS NOT NULL AND c.print_run <= 50'),
    ('Under 50 Hunter', 'Collect 15 cards numbered to 50 or less', 100, 'Rare', 15, 'SELECT COUNT(*) FROM user_card uc JOIN card c ON uc.card = c.card_id WHERE uc.user_id = @user_id AND uc.sold_at IS NULL AND c.print_run IS NOT NULL AND c.print_run <= 50'),
    ('Under 50 Expert', 'Collect 30 cards numbered to 50 or less', 150, 'Epic', 30, 'SELECT COUNT(*) FROM user_card uc JOIN card c ON uc.card = c.card_id WHERE uc.user_id = @user_id AND uc.sold_at IS NULL AND c.print_run IS NOT NULL AND c.print_run <= 50'),
    -- /10 or less
    ('Single Digit Find', 'Collect 1 card numbered to 10 or less', 50, 'Rare', 1, 'SELECT COUNT(*) FROM user_card uc JOIN card c ON uc.card = c.card_id WHERE uc.user_id = @user_id AND uc.sold_at IS NULL AND c.print_run IS NOT NULL AND c.print_run <= 10'),
    ('Single Digit Collector', 'Collect 5 cards numbered to 10 or less', 100, 'Epic', 5, 'SELECT COUNT(*) FROM user_card uc JOIN card c ON uc.card = c.card_id WHERE uc.user_id = @user_id AND uc.sold_at IS NULL AND c.print_run IS NOT NULL AND c.print_run <= 10'),
    ('Single Digit Hunter', 'Collect 10 cards numbered to 10 or less', 175, 'Legendary', 10, 'SELECT COUNT(*) FROM user_card uc JOIN card c ON uc.card = c.card_id WHERE uc.user_id = @user_id AND uc.sold_at IS NULL AND c.print_run IS NOT NULL AND c.print_run <= 10'),
    ('Single Digit Master', 'Collect 25 cards numbered to 10 or less', 300, 'Mythic', 25, 'SELECT COUNT(*) FROM user_card uc JOIN card c ON uc.card = c.card_id WHERE uc.user_id = @user_id AND uc.sold_at IS NULL AND c.print_run IS NOT NULL AND c.print_run <= 10'),
    -- /5 or less
    ('Ultra Rare Find', 'Collect 1 card numbered to 5 or less', 75, 'Epic', 1, 'SELECT COUNT(*) FROM user_card uc JOIN card c ON uc.card = c.card_id WHERE uc.user_id = @user_id AND uc.sold_at IS NULL AND c.print_run IS NOT NULL AND c.print_run <= 5'),
    ('Ultra Rare Collector', 'Collect 3 cards numbered to 5 or less', 150, 'Legendary', 3, 'SELECT COUNT(*) FROM user_card uc JOIN card c ON uc.card = c.card_id WHERE uc.user_id = @user_id AND uc.sold_at IS NULL AND c.print_run IS NOT NULL AND c.print_run <= 5'),
    ('Ultra Rare Hunter', 'Collect 5 cards numbered to 5 or less', 250, 'Mythic', 5, 'SELECT COUNT(*) FROM user_card uc JOIN card c ON uc.card = c.card_id WHERE uc.user_id = @user_id AND uc.sold_at IS NULL AND c.print_run IS NOT NULL AND c.print_run <= 5')
) AS source (name, description, points, tier, req_value, req_query)
ON target.name = source.name
WHEN NOT MATCHED THEN
    INSERT (category_id, name, description, points, tier, requirement_type, requirement_value, requirement_query, is_active, is_secret, created_at, updated_at)
    VALUES (@SpecialCards, source.name, source.description, source.points, source.tier, 'count', source.req_value, source.req_query, 1, 0, GETDATE(), GETDATE());

-- Autograph + Relic combinations
MERGE INTO achievements AS target
USING (VALUES
    ('Patch Auto Find', 'Collect 1 card that is both an autograph and a relic', 50, 'Rare', 1, 'SELECT COUNT(*) FROM user_card uc JOIN card c ON uc.card = c.card_id WHERE uc.user_id = @user_id AND uc.sold_at IS NULL AND c.is_autograph = 1 AND c.is_relic = 1'),
    ('Patch Auto Collector', 'Collect 5 cards that are both autographs and relics', 100, 'Epic', 5, 'SELECT COUNT(*) FROM user_card uc JOIN card c ON uc.card = c.card_id WHERE uc.user_id = @user_id AND uc.sold_at IS NULL AND c.is_autograph = 1 AND c.is_relic = 1'),
    ('Patch Auto Hunter', 'Collect 10 cards that are both autographs and relics', 150, 'Legendary', 10, 'SELECT COUNT(*) FROM user_card uc JOIN card c ON uc.card = c.card_id WHERE uc.user_id = @user_id AND uc.sold_at IS NULL AND c.is_autograph = 1 AND c.is_relic = 1'),
    ('Patch Auto Master', 'Collect 25 cards that are both autographs and relics', 250, 'Mythic', 25, 'SELECT COUNT(*) FROM user_card uc JOIN card c ON uc.card = c.card_id WHERE uc.user_id = @user_id AND uc.sold_at IS NULL AND c.is_autograph = 1 AND c.is_relic = 1')
) AS source (name, description, points, tier, req_value, req_query)
ON target.name = source.name
WHEN NOT MATCHED THEN
    INSERT (category_id, name, description, points, tier, requirement_type, requirement_value, requirement_query, is_active, is_secret, created_at, updated_at)
    VALUES (@SpecialCards, source.name, source.description, source.points, source.tier, 'count', source.req_value, source.req_query, 1, 0, GETDATE(), GETDATE());

-- 1/1 Collection achievements
MERGE INTO achievements AS target
USING (VALUES
    ('One of One Find', 'Collect your first 1/1 card', 100, 'Legendary', 1, 'SELECT COUNT(*) FROM user_card uc JOIN card c ON uc.card = c.card_id WHERE uc.user_id = @user_id AND uc.sold_at IS NULL AND c.print_run = 1'),
    ('One of One Collector', 'Collect 3 different 1/1 cards', 200, 'Mythic', 3, 'SELECT COUNT(*) FROM user_card uc JOIN card c ON uc.card = c.card_id WHERE uc.user_id = @user_id AND uc.sold_at IS NULL AND c.print_run = 1'),
    ('One of One Hunter', 'Collect 5 different 1/1 cards', 350, 'Mythic', 5, 'SELECT COUNT(*) FROM user_card uc JOIN card c ON uc.card = c.card_id WHERE uc.user_id = @user_id AND uc.sold_at IS NULL AND c.print_run = 1'),
    ('One of One Expert', 'Collect 10 different 1/1 cards', 500, 'Mythic', 10, 'SELECT COUNT(*) FROM user_card uc JOIN card c ON uc.card = c.card_id WHERE uc.user_id = @user_id AND uc.sold_at IS NULL AND c.print_run = 1')
) AS source (name, description, points, tier, req_value, req_query)
ON target.name = source.name
WHEN NOT MATCHED THEN
    INSERT (category_id, name, description, points, tier, requirement_type, requirement_value, requirement_query, is_active, is_secret, created_at, updated_at)
    VALUES (@SpecialCards, source.name, source.description, source.points, source.tier, 'count', source.req_value, source.req_query, 1, 0, GETDATE(), GETDATE());

PRINT 'Special Cards expanded.';

-- ============================================================================
-- VALUE & INVESTMENT EXPANSION (Target: ~50-60)
-- Current: 13, Need: ~40 more
-- ============================================================================
PRINT 'Expanding Value & Investment...';

MERGE INTO achievements AS target
USING (VALUES
    -- Purchase price milestones (we track purchase_price)
    ('Budget Buyer', 'Own 10 cards purchased for under $5 each', 15, 'Common', 10, 'SELECT COUNT(*) FROM user_card WHERE user_id = @user_id AND sold_at IS NULL AND purchase_price IS NOT NULL AND purchase_price < 5'),
    ('Bargain Hunter', 'Own 25 cards purchased for under $5 each', 30, 'Uncommon', 25, 'SELECT COUNT(*) FROM user_card WHERE user_id = @user_id AND sold_at IS NULL AND purchase_price IS NOT NULL AND purchase_price < 5'),
    ('Value Seeker', 'Own 50 cards purchased for under $5 each', 50, 'Rare', 50, 'SELECT COUNT(*) FROM user_card WHERE user_id = @user_id AND sold_at IS NULL AND purchase_price IS NOT NULL AND purchase_price < 5'),
    ('Thrifty Collector', 'Own 100 cards purchased for under $5 each', 75, 'Epic', 100, 'SELECT COUNT(*) FROM user_card WHERE user_id = @user_id AND sold_at IS NULL AND purchase_price IS NOT NULL AND purchase_price < 5'),

    -- Mid-range purchases
    ('Growing Investment', 'Own 5 cards purchased for $10-$50 each', 25, 'Common', 5, 'SELECT COUNT(*) FROM user_card WHERE user_id = @user_id AND sold_at IS NULL AND purchase_price IS NOT NULL AND purchase_price >= 10 AND purchase_price <= 50'),
    ('Steady Investor', 'Own 25 cards purchased for $10-$50 each', 50, 'Uncommon', 25, 'SELECT COUNT(*) FROM user_card WHERE user_id = @user_id AND sold_at IS NULL AND purchase_price IS NOT NULL AND purchase_price >= 10 AND purchase_price <= 50'),
    ('Dedicated Investor', 'Own 50 cards purchased for $10-$50 each', 100, 'Rare', 50, 'SELECT COUNT(*) FROM user_card WHERE user_id = @user_id AND sold_at IS NULL AND purchase_price IS NOT NULL AND purchase_price >= 10 AND purchase_price <= 50'),

    -- Premium purchases
    ('Premium Buyer', 'Own 1 card purchased for over $100', 30, 'Uncommon', 1, 'SELECT COUNT(*) FROM user_card WHERE user_id = @user_id AND sold_at IS NULL AND purchase_price IS NOT NULL AND purchase_price > 100'),
    ('Premium Collector', 'Own 5 cards purchased for over $100', 75, 'Rare', 5, 'SELECT COUNT(*) FROM user_card WHERE user_id = @user_id AND sold_at IS NULL AND purchase_price IS NOT NULL AND purchase_price > 100'),
    ('Premium Investor', 'Own 10 cards purchased for over $100', 125, 'Epic', 10, 'SELECT COUNT(*) FROM user_card WHERE user_id = @user_id AND sold_at IS NULL AND purchase_price IS NOT NULL AND purchase_price > 100'),
    ('Premium Expert', 'Own 25 cards purchased for over $100', 200, 'Legendary', 25, 'SELECT COUNT(*) FROM user_card WHERE user_id = @user_id AND sold_at IS NULL AND purchase_price IS NOT NULL AND purchase_price > 100'),

    -- High-value purchases
    ('High Roller', 'Own 1 card purchased for over $500', 75, 'Rare', 1, 'SELECT COUNT(*) FROM user_card WHERE user_id = @user_id AND sold_at IS NULL AND purchase_price IS NOT NULL AND purchase_price > 500'),
    ('High Roller Collector', 'Own 3 cards purchased for over $500', 150, 'Epic', 3, 'SELECT COUNT(*) FROM user_card WHERE user_id = @user_id AND sold_at IS NULL AND purchase_price IS NOT NULL AND purchase_price > 500'),
    ('High Roller Expert', 'Own 5 cards purchased for over $500', 250, 'Legendary', 5, 'SELECT COUNT(*) FROM user_card WHERE user_id = @user_id AND sold_at IS NULL AND purchase_price IS NOT NULL AND purchase_price > 500'),

    -- Ultra high-value
    ('Thousand Dollar Card', 'Own 1 card purchased for over $1,000', 100, 'Epic', 1, 'SELECT COUNT(*) FROM user_card WHERE user_id = @user_id AND sold_at IS NULL AND purchase_price IS NOT NULL AND purchase_price > 1000'),
    ('Thousand Dollar Collector', 'Own 3 cards purchased for over $1,000', 200, 'Legendary', 3, 'SELECT COUNT(*) FROM user_card WHERE user_id = @user_id AND sold_at IS NULL AND purchase_price IS NOT NULL AND purchase_price > 1000'),
    ('Five Thousand Dollar Card', 'Own 1 card purchased for over $5,000', 250, 'Mythic', 1, 'SELECT COUNT(*) FROM user_card WHERE user_id = @user_id AND sold_at IS NULL AND purchase_price IS NOT NULL AND purchase_price > 5000'),

    -- Total portfolio value (current_value)
    ('Portfolio Starter', 'Have a collection with total current value over $100', 20, 'Common', 1, 'SELECT CASE WHEN SUM(ISNULL(current_value, 0)) > 100 THEN 1 ELSE 0 END FROM user_card WHERE user_id = @user_id AND sold_at IS NULL'),
    ('Portfolio Builder', 'Have a collection with total current value over $500', 40, 'Uncommon', 1, 'SELECT CASE WHEN SUM(ISNULL(current_value, 0)) > 500 THEN 1 ELSE 0 END FROM user_card WHERE user_id = @user_id AND sold_at IS NULL'),
    ('Portfolio Grower', 'Have a collection with total current value over $1,000', 75, 'Rare', 1, 'SELECT CASE WHEN SUM(ISNULL(current_value, 0)) > 1000 THEN 1 ELSE 0 END FROM user_card WHERE user_id = @user_id AND sold_at IS NULL'),
    ('Portfolio Expert', 'Have a collection with total current value over $5,000', 125, 'Epic', 1, 'SELECT CASE WHEN SUM(ISNULL(current_value, 0)) > 5000 THEN 1 ELSE 0 END FROM user_card WHERE user_id = @user_id AND sold_at IS NULL'),
    ('Portfolio Master', 'Have a collection with total current value over $10,000', 200, 'Legendary', 1, 'SELECT CASE WHEN SUM(ISNULL(current_value, 0)) > 10000 THEN 1 ELSE 0 END FROM user_card WHERE user_id = @user_id AND sold_at IS NULL'),
    ('Portfolio Legend', 'Have a collection with total current value over $25,000', 300, 'Mythic', 1, 'SELECT CASE WHEN SUM(ISNULL(current_value, 0)) > 25000 THEN 1 ELSE 0 END FROM user_card WHERE user_id = @user_id AND sold_at IS NULL'),
    ('Portfolio Mogul', 'Have a collection with total current value over $50,000', 400, 'Mythic', 1, 'SELECT CASE WHEN SUM(ISNULL(current_value, 0)) > 50000 THEN 1 ELSE 0 END FROM user_card WHERE user_id = @user_id AND sold_at IS NULL'),
    ('Portfolio Tycoon', 'Have a collection with total current value over $100,000', 500, 'Mythic', 1, 'SELECT CASE WHEN SUM(ISNULL(current_value, 0)) > 100000 THEN 1 ELSE 0 END FROM user_card WHERE user_id = @user_id AND sold_at IS NULL'),

    -- Total investment (purchase_price)
    ('Invested Starter', 'Have invested over $100 in your collection', 15, 'Common', 1, 'SELECT CASE WHEN SUM(ISNULL(purchase_price, 0)) > 100 THEN 1 ELSE 0 END FROM user_card WHERE user_id = @user_id AND sold_at IS NULL'),
    ('Invested Builder', 'Have invested over $500 in your collection', 30, 'Uncommon', 1, 'SELECT CASE WHEN SUM(ISNULL(purchase_price, 0)) > 500 THEN 1 ELSE 0 END FROM user_card WHERE user_id = @user_id AND sold_at IS NULL'),
    ('Invested Grower', 'Have invested over $1,000 in your collection', 50, 'Rare', 1, 'SELECT CASE WHEN SUM(ISNULL(purchase_price, 0)) > 1000 THEN 1 ELSE 0 END FROM user_card WHERE user_id = @user_id AND sold_at IS NULL'),
    ('Invested Expert', 'Have invested over $5,000 in your collection', 100, 'Epic', 1, 'SELECT CASE WHEN SUM(ISNULL(purchase_price, 0)) > 5000 THEN 1 ELSE 0 END FROM user_card WHERE user_id = @user_id AND sold_at IS NULL'),
    ('Invested Master', 'Have invested over $10,000 in your collection', 175, 'Legendary', 1, 'SELECT CASE WHEN SUM(ISNULL(purchase_price, 0)) > 10000 THEN 1 ELSE 0 END FROM user_card WHERE user_id = @user_id AND sold_at IS NULL'),
    ('Invested Legend', 'Have invested over $25,000 in your collection', 275, 'Mythic', 1, 'SELECT CASE WHEN SUM(ISNULL(purchase_price, 0)) > 25000 THEN 1 ELSE 0 END FROM user_card WHERE user_id = @user_id AND sold_at IS NULL'),

    -- Cards with estimated value entered
    ('Value Tracker', 'Have estimated values entered for 10 cards', 15, 'Common', 10, 'SELECT COUNT(*) FROM user_card WHERE user_id = @user_id AND sold_at IS NULL AND estimated_value IS NOT NULL AND estimated_value > 0'),
    ('Value Analyst', 'Have estimated values entered for 50 cards', 35, 'Uncommon', 50, 'SELECT COUNT(*) FROM user_card WHERE user_id = @user_id AND sold_at IS NULL AND estimated_value IS NOT NULL AND estimated_value > 0'),
    ('Value Expert', 'Have estimated values entered for 100 cards', 75, 'Rare', 100, 'SELECT COUNT(*) FROM user_card WHERE user_id = @user_id AND sold_at IS NULL AND estimated_value IS NOT NULL AND estimated_value > 0'),
    ('Value Master', 'Have estimated values entered for 250 cards', 125, 'Epic', 250, 'SELECT COUNT(*) FROM user_card WHERE user_id = @user_id AND sold_at IS NULL AND estimated_value IS NOT NULL AND estimated_value > 0'),

    -- Cards with purchase price tracked
    ('Purchase Tracker', 'Have purchase prices entered for 10 cards', 15, 'Common', 10, 'SELECT COUNT(*) FROM user_card WHERE user_id = @user_id AND sold_at IS NULL AND purchase_price IS NOT NULL AND purchase_price > 0'),
    ('Purchase Analyst', 'Have purchase prices entered for 50 cards', 35, 'Uncommon', 50, 'SELECT COUNT(*) FROM user_card WHERE user_id = @user_id AND sold_at IS NULL AND purchase_price IS NOT NULL AND purchase_price > 0'),
    ('Purchase Expert', 'Have purchase prices entered for 100 cards', 75, 'Rare', 100, 'SELECT COUNT(*) FROM user_card WHERE user_id = @user_id AND sold_at IS NULL AND purchase_price IS NOT NULL AND purchase_price > 0'),
    ('Purchase Master', 'Have purchase prices entered for 250 cards', 125, 'Epic', 250, 'SELECT COUNT(*) FROM user_card WHERE user_id = @user_id AND sold_at IS NULL AND purchase_price IS NOT NULL AND purchase_price > 0')
) AS source (name, description, points, tier, req_value, req_query)
ON target.name = source.name
WHEN NOT MATCHED THEN
    INSERT (category_id, name, description, points, tier, requirement_type, requirement_value, requirement_query, is_active, is_secret, created_at, updated_at)
    VALUES (@ValueInvestment, source.name, source.description, source.points, source.tier, 'count', source.req_value, source.req_query, 1, 0, GETDATE(), GETDATE());

PRINT 'Value & Investment expanded.';

-- ============================================================================
-- STREAKS & ACTIVITY EXPANSION (Target: ~40-50)
-- Current: 21, Need: ~25 more
-- ============================================================================
PRINT 'Expanding Streaks & Activity...';

MERGE INTO achievements AS target
USING (VALUES
    -- Photo upload achievements (we have photo column in user_card)
    ('First Photo', 'Upload your first card photo', 10, 'Common', 1, 'SELECT COUNT(*) FROM user_card WHERE user_id = @user_id AND photo IS NOT NULL'),
    ('Photo Enthusiast', 'Upload photos for 10 cards', 25, 'Common', 10, 'SELECT COUNT(*) FROM user_card WHERE user_id = @user_id AND photo IS NOT NULL'),
    ('Photo Collector', 'Upload photos for 25 cards', 50, 'Uncommon', 25, 'SELECT COUNT(*) FROM user_card WHERE user_id = @user_id AND photo IS NOT NULL'),
    ('Photo Hunter', 'Upload photos for 50 cards', 75, 'Rare', 50, 'SELECT COUNT(*) FROM user_card WHERE user_id = @user_id AND photo IS NOT NULL'),
    ('Photo Expert', 'Upload photos for 100 cards', 125, 'Epic', 100, 'SELECT COUNT(*) FROM user_card WHERE user_id = @user_id AND photo IS NOT NULL'),
    ('Photo Master', 'Upload photos for 250 cards', 175, 'Legendary', 250, 'SELECT COUNT(*) FROM user_card WHERE user_id = @user_id AND photo IS NOT NULL'),
    ('Photo Legend', 'Upload photos for 500 cards', 250, 'Mythic', 500, 'SELECT COUNT(*) FROM user_card WHERE user_id = @user_id AND photo IS NOT NULL'),

    -- Cards added milestones (based on user_card created dates)
    ('First Card Added', 'Add your first card to your collection', 5, 'Common', 1, 'SELECT COUNT(*) FROM user_card WHERE user_id = @user_id'),
    ('Getting Started', 'Add 10 cards to your collection', 10, 'Common', 10, 'SELECT COUNT(*) FROM user_card WHERE user_id = @user_id'),
    ('Building Momentum', 'Add 50 cards to your collection', 25, 'Common', 50, 'SELECT COUNT(*) FROM user_card WHERE user_id = @user_id'),
    ('Collection Growing', 'Add 100 cards to your collection', 50, 'Uncommon', 100, 'SELECT COUNT(*) FROM user_card WHERE user_id = @user_id'),
    ('Serious Collector', 'Add 250 cards to your collection', 75, 'Rare', 250, 'SELECT COUNT(*) FROM user_card WHERE user_id = @user_id'),
    ('Dedicated Collector', 'Add 500 cards to your collection', 125, 'Epic', 500, 'SELECT COUNT(*) FROM user_card WHERE user_id = @user_id'),
    ('Expert Collector', 'Add 1,000 cards to your collection', 175, 'Legendary', 1000, 'SELECT COUNT(*) FROM user_card WHERE user_id = @user_id'),
    ('Master Collector', 'Add 2,500 cards to your collection', 250, 'Mythic', 2500, 'SELECT COUNT(*) FROM user_card WHERE user_id = @user_id'),
    ('Legendary Collector', 'Add 5,000 cards to your collection', 400, 'Mythic', 5000, 'SELECT COUNT(*) FROM user_card WHERE user_id = @user_id'),

    -- Notes/documentation achievements
    ('Note Taker', 'Add notes to 5 cards', 15, 'Common', 5, 'SELECT COUNT(*) FROM user_card WHERE user_id = @user_id AND notes IS NOT NULL AND notes != '''''),
    ('Documenter', 'Add notes to 25 cards', 30, 'Uncommon', 25, 'SELECT COUNT(*) FROM user_card WHERE user_id = @user_id AND notes IS NOT NULL AND notes != '''''),
    ('Detailed Collector', 'Add notes to 50 cards', 50, 'Rare', 50, 'SELECT COUNT(*) FROM user_card WHERE user_id = @user_id AND notes IS NOT NULL AND notes != '''''),
    ('Meticulous Collector', 'Add notes to 100 cards', 100, 'Epic', 100, 'SELECT COUNT(*) FROM user_card WHERE user_id = @user_id AND notes IS NOT NULL AND notes != '''''),

    -- Serial number tracking
    ('Serial Tracker', 'Enter serial numbers for 5 numbered cards', 20, 'Common', 5, 'SELECT COUNT(*) FROM user_card WHERE user_id = @user_id AND serial_number IS NOT NULL'),
    ('Serial Collector', 'Enter serial numbers for 25 numbered cards', 40, 'Uncommon', 25, 'SELECT COUNT(*) FROM user_card WHERE user_id = @user_id AND serial_number IS NOT NULL'),
    ('Serial Expert', 'Enter serial numbers for 50 numbered cards', 75, 'Rare', 50, 'SELECT COUNT(*) FROM user_card WHERE user_id = @user_id AND serial_number IS NOT NULL'),
    ('Serial Master', 'Enter serial numbers for 100 numbered cards', 125, 'Epic', 100, 'SELECT COUNT(*) FROM user_card WHERE user_id = @user_id AND serial_number IS NOT NULL'),

    -- Location tracking
    ('Location Tracker', 'Set storage locations for 10 cards', 15, 'Common', 10, 'SELECT COUNT(*) FROM user_card WHERE user_id = @user_id AND user_location IS NOT NULL'),
    ('Organized Collector', 'Set storage locations for 50 cards', 35, 'Uncommon', 50, 'SELECT COUNT(*) FROM user_card WHERE user_id = @user_id AND user_location IS NOT NULL'),
    ('Storage Expert', 'Set storage locations for 100 cards', 75, 'Rare', 100, 'SELECT COUNT(*) FROM user_card WHERE user_id = @user_id AND user_location IS NOT NULL'),
    ('Storage Master', 'Set storage locations for 250 cards', 125, 'Epic', 250, 'SELECT COUNT(*) FROM user_card WHERE user_id = @user_id AND user_location IS NOT NULL')
) AS source (name, description, points, tier, req_value, req_query)
ON target.name = source.name
WHEN NOT MATCHED THEN
    INSERT (category_id, name, description, points, tier, requirement_type, requirement_value, requirement_query, is_active, is_secret, created_at, updated_at)
    VALUES (@StreaksActivity, source.name, source.description, source.points, source.tier, 'count', source.req_value, source.req_query, 1, 0, GETDATE(), GETDATE());

PRINT 'Streaks & Activity expanded.';

-- ============================================================================
-- COMMUNITY & SOCIAL EXPANSION (Target: ~15-20)
-- Current: 8, limited by available features
-- ============================================================================
PRINT 'Expanding Community & Social...';

-- We only have comments available, so we'll create deeper comment achievements
MERGE INTO achievements AS target
USING (VALUES
    ('First Comment', 'Leave your first comment on a card', 10, 'Common', 1, 'SELECT COUNT(*) FROM card_comment WHERE user_id = @user_id'),
    ('Commentator', 'Leave 5 comments on cards', 20, 'Common', 5, 'SELECT COUNT(*) FROM card_comment WHERE user_id = @user_id'),
    ('Active Commenter', 'Leave 15 comments on cards', 35, 'Uncommon', 15, 'SELECT COUNT(*) FROM card_comment WHERE user_id = @user_id'),
    ('Comment Enthusiast', 'Leave 30 comments on cards', 50, 'Rare', 30, 'SELECT COUNT(*) FROM card_comment WHERE user_id = @user_id'),
    ('Comment Expert', 'Leave 50 comments on cards', 75, 'Epic', 50, 'SELECT COUNT(*) FROM card_comment WHERE user_id = @user_id'),
    ('Comment Master', 'Leave 100 comments on cards', 125, 'Legendary', 100, 'SELECT COUNT(*) FROM card_comment WHERE user_id = @user_id'),
    ('Comment Legend', 'Leave 250 comments on cards', 200, 'Mythic', 250, 'SELECT COUNT(*) FROM card_comment WHERE user_id = @user_id'),

    -- Comments on different cards
    ('Card Reviewer', 'Comment on 10 different cards', 25, 'Common', 10, 'SELECT COUNT(DISTINCT card_id) FROM card_comment WHERE user_id = @user_id'),
    ('Card Critic', 'Comment on 25 different cards', 50, 'Uncommon', 25, 'SELECT COUNT(DISTINCT card_id) FROM card_comment WHERE user_id = @user_id'),
    ('Card Analyst', 'Comment on 50 different cards', 100, 'Rare', 50, 'SELECT COUNT(DISTINCT card_id) FROM card_comment WHERE user_id = @user_id'),
    ('Card Expert Reviewer', 'Comment on 100 different cards', 150, 'Epic', 100, 'SELECT COUNT(DISTINCT card_id) FROM card_comment WHERE user_id = @user_id')
) AS source (name, description, points, tier, req_value, req_query)
ON target.name = source.name
WHEN NOT MATCHED THEN
    INSERT (category_id, name, description, points, tier, requirement_type, requirement_value, requirement_query, is_active, is_secret, created_at, updated_at)
    VALUES (@CommunitySocial, source.name, source.description, source.points, source.tier, 'count', source.req_value, source.req_query, 1, 0, GETDATE(), GETDATE());

PRINT 'Community & Social expanded.';

-- ============================================================================
-- EARLY ADOPTER EXPANSION (Target: ~20-25)
-- Current: 15, these are special one-time badges
-- ============================================================================
PRINT 'Expanding Early Adopter...';

-- Early Adopter achievements are mostly time-based and already covered
-- Adding a few more meaningful ones based on early usage patterns
MERGE INTO achievements AS target
USING (VALUES
    ('Early Data Contributor', 'Have cards added within the first year of the platform', 50, 'Rare', 1, 'SELECT CASE WHEN EXISTS (SELECT 1 FROM user_card WHERE user_id = @user_id AND created < ''2025-01-01'') THEN 1 ELSE 0 END'),
    ('2024 Pioneer', 'Had cards in collection during 2024', 75, 'Epic', 1, 'SELECT CASE WHEN EXISTS (SELECT 1 FROM user_card WHERE user_id = @user_id AND YEAR(created) = 2024) THEN 1 ELSE 0 END'),
    ('2025 Collector', 'Had cards in collection during 2025', 25, 'Uncommon', 1, 'SELECT CASE WHEN EXISTS (SELECT 1 FROM user_card WHERE user_id = @user_id AND YEAR(created) = 2025) THEN 1 ELSE 0 END'),
    ('Foundation Builder', 'One of the first 100 users to add 100+ cards', 100, 'Legendary', 1, 'SELECT CASE WHEN (SELECT COUNT(*) FROM (SELECT user_id FROM user_card GROUP BY user_id HAVING COUNT(*) >= 100) sub WHERE user_id <= @user_id) <= 100 THEN 1 ELSE 0 END'),
    ('Launch Week Participant', 'Active during the platform launch week', 100, 'Legendary', 1, 'SELECT CASE WHEN EXISTS (SELECT 1 FROM user_card WHERE user_id = @user_id AND created BETWEEN ''2024-01-01'' AND ''2024-01-07'') THEN 1 ELSE 0 END')
) AS source (name, description, points, tier, req_value, req_query)
ON target.name = source.name
WHEN NOT MATCHED THEN
    INSERT (category_id, name, description, points, tier, requirement_type, requirement_value, requirement_query, is_active, is_secret, created_at, updated_at)
    VALUES (@EarlyAdopter, source.name, source.description, source.points, source.tier, 'count', source.req_value, source.req_query, 1, 0, GETDATE(), GETDATE());

PRINT 'Early Adopter expanded.';

-- ============================================================================
-- SUMMARY
-- ============================================================================
PRINT '============================================';
PRINT 'Achievement Expansion Complete!';
PRINT '============================================';

SELECT
    c.name as Category,
    COUNT(CASE WHEN a.is_active = 1 THEN 1 END) as Active,
    COUNT(CASE WHEN a.is_active = 0 THEN 1 END) as Inactive
FROM achievement_categories c
LEFT JOIN achievements a ON c.category_id = a.category_id
GROUP BY c.name, c.display_order
ORDER BY c.display_order;

SELECT 'TOTAL' as Category,
    COUNT(CASE WHEN is_active = 1 THEN 1 END) as Active,
    COUNT(CASE WHEN is_active = 0 THEN 1 END) as Inactive
FROM achievements;

PRINT '============================================';
