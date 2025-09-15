-- =====================================
-- ACHIEVEMENT SYSTEM SEED DATA
-- Initial core achievements from ACHIEVEMENTS.md
-- =====================================

-- Apply the database schema first if not already applied
-- Run DATABASE_ACHIEVEMENTS_SCHEMA.sql before this file

-- Insert initial achievements (Phase 1 - Core Collection Milestones)

-- Collection Milestones - Card Count Achievements
INSERT INTO achievements (category_id, name, description, points, tier, requirement_type, requirement_value, requirement_query, is_active) VALUES 
(1, 'First Card', 'Add your first card to your collection', 5, 'Common', 'count', 1, 'SELECT COUNT(*) FROM user_card WHERE user = @user_id', 1),
(1, 'Starting Five', 'Collect 5 cards', 10, 'Common', 'count', 5, 'SELECT COUNT(*) FROM user_card WHERE user = @user_id', 1),
(1, 'Double Digits', 'Collect 10 cards', 10, 'Common', 'count', 10, 'SELECT COUNT(*) FROM user_card WHERE user = @user_id', 1),
(1, 'Quarter Century', 'Collect 25 cards', 15, 'Uncommon', 'count', 25, 'SELECT COUNT(*) FROM user_card WHERE user = @user_id', 1),
(1, 'Half Century', 'Collect 50 cards', 20, 'Uncommon', 'count', 50, 'SELECT COUNT(*) FROM user_card WHERE user = @user_id', 1),
(1, 'Century Mark', 'Collect 100 cards', 25, 'Uncommon', 'count', 100, 'SELECT COUNT(*) FROM user_card WHERE user = @user_id', 1),
(1, 'Double Century', 'Collect 200 cards', 30, 'Rare', 'count', 200, 'SELECT COUNT(*) FROM user_card WHERE user = @user_id', 1),
(1, 'Quincentennial', 'Collect 500 cards', 50, 'Rare', 'count', 500, 'SELECT COUNT(*) FROM user_card WHERE user = @user_id', 1),
(1, 'Millennium Collector', 'Collect 1,000 cards', 75, 'Epic', 'count', 1000, 'SELECT COUNT(*) FROM user_card WHERE user = @user_id', 1),
(1, '2K Club', 'Collect 2,000 cards', 100, 'Epic', 'count', 2000, 'SELECT COUNT(*) FROM user_card WHERE user = @user_id', 1),
(1, '5K Elite', 'Collect 5,000 cards', 150, 'Legendary', 'count', 5000, 'SELECT COUNT(*) FROM user_card WHERE user = @user_id', 1),
(1, '10K Legend', 'Collect 10,000 cards', 250, 'Legendary', 'count', 10000, 'SELECT COUNT(*) FROM user_card WHERE user = @user_id', 1),
(1, '25K Master', 'Collect 25,000 cards', 500, 'Mythic', 'count', 25000, 'SELECT COUNT(*) FROM user_card WHERE user = @user_id', 1);

-- Collection Milestones - Unique Player Achievements  
INSERT INTO achievements (category_id, name, description, points, tier, requirement_type, requirement_value, requirement_query, is_active) VALUES 
(1, 'Rookie Collector', 'Collect cards from 5 different players', 5, 'Common', 'unique', 5, 'SELECT COUNT(DISTINCT p.player) FROM user_card uc INNER JOIN card c ON uc.card = c.card_id INNER JOIN card_player_team cpt ON c.card_id = cpt.card INNER JOIN player_team pt ON cpt.player_team = pt.player_team_id WHERE uc.user = @user_id', 1),
(1, 'Team Builder', 'Collect cards from 10 different players', 10, 'Common', 'unique', 10, 'SELECT COUNT(DISTINCT p.player) FROM user_card uc INNER JOIN card c ON uc.card = c.card_id INNER JOIN card_player_team cpt ON c.card_id = cpt.card INNER JOIN player_team pt ON cpt.player_team = pt.player_team_id WHERE uc.user = @user_id', 1),
(1, 'Roster Deep', 'Collect cards from 25 different players', 15, 'Uncommon', 'unique', 25, 'SELECT COUNT(DISTINCT p.player) FROM user_card uc INNER JOIN card c ON uc.card = c.card_id INNER JOIN card_player_team cpt ON c.card_id = cpt.card INNER JOIN player_team pt ON cpt.player_team = pt.player_team_id WHERE uc.user = @user_id', 1),
(1, 'League Wide', 'Collect cards from 50 different players', 25, 'Uncommon', 'unique', 50, 'SELECT COUNT(DISTINCT p.player) FROM user_card uc INNER JOIN card c ON uc.card = c.card_id INNER JOIN card_player_team cpt ON c.card_id = cpt.card INNER JOIN player_team pt ON cpt.player_team = pt.player_team_id WHERE uc.user = @user_id', 1),
(1, 'Century of Players', 'Collect cards from 100 different players', 30, 'Rare', 'unique', 100, 'SELECT COUNT(DISTINCT p.player) FROM user_card uc INNER JOIN card c ON uc.card = c.card_id INNER JOIN card_player_team cpt ON c.card_id = cpt.card INNER JOIN player_team pt ON cpt.player_team = pt.player_team_id WHERE uc.user = @user_id', 1),
(1, 'Player Encyclopedia', 'Collect cards from 250 different players', 50, 'Rare', 'unique', 250, 'SELECT COUNT(DISTINCT p.player) FROM user_card uc INNER JOIN card c ON uc.card = c.card_id INNER JOIN card_player_team cpt ON c.card_id = cpt.card INNER JOIN player_team pt ON cpt.player_team = pt.player_team_id WHERE uc.user = @user_id', 1);

-- Collection Milestones - Team Collection Achievements
INSERT INTO achievements (category_id, name, description, points, tier, requirement_type, requirement_value, requirement_query, is_active) VALUES 
(1, 'Team Spirit', 'Collect cards from 5 different teams', 10, 'Common', 'unique', 5, 'SELECT COUNT(DISTINCT pt.team) FROM user_card uc INNER JOIN card c ON uc.card = c.card_id INNER JOIN card_player_team cpt ON c.card_id = cpt.card INNER JOIN player_team pt ON cpt.player_team = pt.player_team_id WHERE uc.user = @user_id', 1),
(1, 'Division Rival', 'Collect cards from 10 different teams', 15, 'Uncommon', 'unique', 10, 'SELECT COUNT(DISTINCT pt.team) FROM user_card uc INNER JOIN card c ON uc.card = c.card_id INNER JOIN card_player_team cpt ON c.card_id = cpt.card INNER JOIN player_team pt ON cpt.player_team = pt.player_team_id WHERE uc.user = @user_id', 1),
(1, 'Conference Complete', 'Collect cards from 15 different teams', 25, 'Uncommon', 'unique', 15, 'SELECT COUNT(DISTINCT pt.team) FROM user_card uc INNER JOIN card c ON uc.card = c.card_id INNER JOIN card_player_team cpt ON c.card_id = cpt.card INNER JOIN player_team pt ON cpt.player_team = pt.player_team_id WHERE uc.user = @user_id', 1),
(1, 'League Representative', 'Collect cards from 20 different teams', 30, 'Rare', 'unique', 20, 'SELECT COUNT(DISTINCT pt.team) FROM user_card uc INNER JOIN card c ON uc.card = c.card_id INNER JOIN card_player_team cpt ON c.card_id = cpt.card INNER JOIN player_team pt ON cpt.player_team = pt.player_team_id WHERE uc.user = @user_id', 1);

-- Rookie Card Achievements
INSERT INTO achievements (category_id, name, description, points, tier, requirement_type, requirement_value, requirement_query, is_active) VALUES 
(2, 'First Rookie', 'Add your first rookie card', 10, 'Common', 'count', 1, 'SELECT COUNT(*) FROM user_card uc INNER JOIN card c ON uc.card = c.card_id WHERE uc.user = @user_id AND c.is_rookie = 1', 1),
(2, 'Rookie Five', 'Collect 5 rookie cards', 15, 'Uncommon', 'count', 5, 'SELECT COUNT(*) FROM user_card uc INNER JOIN card c ON uc.card = c.card_id WHERE uc.user = @user_id AND c.is_rookie = 1', 1),
(2, 'Rookie Squad', 'Collect 10 rookie cards', 25, 'Uncommon', 'count', 10, 'SELECT COUNT(*) FROM user_card uc INNER JOIN card c ON uc.card = c.card_id WHERE uc.user = @user_id AND c.is_rookie = 1', 1),
(2, 'Draft Class', 'Collect 25 rookie cards', 30, 'Rare', 'count', 25, 'SELECT COUNT(*) FROM user_card uc INNER JOIN card c ON uc.card = c.card_id WHERE uc.user = @user_id AND c.is_rookie = 1', 1),
(2, 'Rookie Showcase', 'Collect 50 rookie cards', 50, 'Rare', 'count', 50, 'SELECT COUNT(*) FROM user_card uc INNER JOIN card c ON uc.card = c.card_id WHERE uc.user = @user_id AND c.is_rookie = 1', 1);

-- Special Card Achievements - Autographs
INSERT INTO achievements (category_id, name, description, points, tier, requirement_type, requirement_value, requirement_query, is_active) VALUES 
(3, 'First Signature', 'Add your first autographed card', 25, 'Uncommon', 'count', 1, 'SELECT COUNT(*) FROM user_card uc INNER JOIN card c ON uc.card = c.card_id WHERE uc.user = @user_id AND c.is_autograph = 1', 1),
(3, 'Pen Pal', 'Collect 5 autographed cards', 50, 'Rare', 'count', 5, 'SELECT COUNT(*) FROM user_card uc INNER JOIN card c ON uc.card = c.card_id WHERE uc.user = @user_id AND c.is_autograph = 1', 1),
(3, 'Signature Collection', 'Collect 10 autographed cards', 75, 'Epic', 'count', 10, 'SELECT COUNT(*) FROM user_card uc INNER JOIN card c ON uc.card = c.card_id WHERE uc.user = @user_id AND c.is_autograph = 1', 1);

-- Special Card Achievements - Relics
INSERT INTO achievements (category_id, name, description, points, tier, requirement_type, requirement_value, requirement_query, is_active) VALUES 
(3, 'First Relic', 'Add your first relic card', 25, 'Uncommon', 'count', 1, 'SELECT COUNT(*) FROM user_card uc INNER JOIN card c ON uc.card = c.card_id WHERE uc.user = @user_id AND c.is_relic = 1', 1),
(3, 'Relic Hunter', 'Collect 5 relic cards', 50, 'Rare', 'count', 5, 'SELECT COUNT(*) FROM user_card uc INNER JOIN card c ON uc.card = c.card_id WHERE uc.user = @user_id AND c.is_relic = 1', 1),
(3, 'Memory Lane', 'Collect 10 relic cards', 75, 'Epic', 'count', 10, 'SELECT COUNT(*) FROM user_card uc INNER JOIN card c ON uc.card = c.card_id WHERE uc.user = @user_id AND c.is_relic = 1', 1);

-- Value & Investment Achievements
INSERT INTO achievements (category_id, name, description, points, tier, requirement_type, requirement_value, requirement_query, is_active) VALUES 
(8, 'First Dollar', 'Collection value reaches $100', 10, 'Common', 'value', 100, 'SELECT ISNULL(SUM(CAST(ISNULL(uc.current_value, uc.estimated_value) AS DECIMAL(18,2))), 0) FROM user_card uc WHERE uc.user = @user_id', 1),
(8, 'Benjamin Club', 'Collection value reaches $500', 25, 'Uncommon', 'value', 500, 'SELECT ISNULL(SUM(CAST(ISNULL(uc.current_value, uc.estimated_value) AS DECIMAL(18,2))), 0) FROM user_card uc WHERE uc.user = @user_id', 1),
(8, 'Grand Collection', 'Collection value reaches $1,000', 50, 'Rare', 'value', 1000, 'SELECT ISNULL(SUM(CAST(ISNULL(uc.current_value, uc.estimated_value) AS DECIMAL(18,2))), 0) FROM user_card uc WHERE uc.user = @user_id', 1),
(8, 'Five Grand', 'Collection value reaches $5,000', 100, 'Epic', 'value', 5000, 'SELECT ISNULL(SUM(CAST(ISNULL(uc.current_value, uc.estimated_value) AS DECIMAL(18,2))), 0) FROM user_card uc WHERE uc.user = @user_id', 1);

-- Graded Card Achievements
INSERT INTO achievements (category_id, name, description, points, tier, requirement_type, requirement_value, requirement_query, is_active) VALUES 
(8, 'First Graded', 'Add your first graded card', 25, 'Uncommon', 'count', 1, 'SELECT COUNT(*) FROM user_card WHERE user = @user_id AND grading_agency IS NOT NULL AND grade IS NOT NULL', 1),
(8, 'Graded Gallery', 'Collect 10 graded cards', 50, 'Rare', 'count', 10, 'SELECT COUNT(*) FROM user_card WHERE user = @user_id AND grading_agency IS NOT NULL AND grade IS NOT NULL', 1),
(8, 'Gem Mint 10', 'Own a PSA/BGS 10 graded card', 50, 'Rare', 'count', 1, 'SELECT COUNT(*) FROM user_card WHERE user = @user_id AND grade = 10', 1);

-- Community & Social Achievements - Comments
INSERT INTO achievements (category_id, name, description, points, tier, requirement_type, requirement_value, requirement_query, is_active) VALUES 
(9, 'First Comment', 'Leave your first comment', 5, 'Common', 'count', 1, 'SELECT COUNT(*) FROM universal_comments WHERE user_id = @user_id', 1),
(9, 'Conversationalist', 'Leave 10 comments', 15, 'Common', 'count', 10, 'SELECT COUNT(*) FROM universal_comments WHERE user_id = @user_id', 1),
(9, 'Discussion Leader', 'Leave 50 comments', 30, 'Uncommon', 'count', 50, 'SELECT COUNT(*) FROM universal_comments WHERE user_id = @user_id', 1),
(9, 'Community Voice', 'Leave 100 comments', 50, 'Rare', 'count', 100, 'SELECT COUNT(*) FROM universal_comments WHERE user_id = @user_id', 1);

-- Streaks & Activity Achievements - Login Streaks
INSERT INTO achievements (category_id, subcategory, name, description, points, tier, requirement_type, requirement_value, requirement_query, is_active) VALUES 
(10, 'Login Streaks', 'Welcome Back', 'Log in 2 days in a row', 5, 'Common', 'streak', 2, 'SELECT ISNULL(MAX(current_count), 0) FROM user_streaks WHERE user_id = @user_id AND streak_type = ''login''', 1),
(10, 'Login Streaks', 'Regular Visitor', '7-day login streak', 10, 'Common', 'streak', 7, 'SELECT ISNULL(MAX(current_count), 0) FROM user_streaks WHERE user_id = @user_id AND streak_type = ''login''', 1),
(10, 'Login Streaks', 'Dedicated Collector', '30-day login streak', 25, 'Uncommon', 'streak', 30, 'SELECT ISNULL(MAX(current_count), 0) FROM user_streaks WHERE user_id = @user_id AND streak_type = ''login''', 1),
(10, 'Login Streaks', 'Daily Devotion', '60-day login streak', 50, 'Rare', 'streak', 60, 'SELECT ISNULL(MAX(current_count), 0) FROM user_streaks WHERE user_id = @user_id AND streak_type = ''login''', 1);

-- Streaks & Activity Achievements - Collection Activity Streaks
INSERT INTO achievements (category_id, subcategory, name, description, points, tier, requirement_type, requirement_value, requirement_query, is_active) VALUES 
(10, 'Collection Activity', 'Active Week', 'Add cards 7 days in a row', 15, 'Common', 'streak', 7, 'SELECT ISNULL(MAX(current_count), 0) FROM user_streaks WHERE user_id = @user_id AND streak_type = ''card_addition''', 1),
(10, 'Collection Activity', 'Active Month', 'Add cards 30 days in a row', 50, 'Rare', 'streak', 30, 'SELECT ISNULL(MAX(current_count), 0) FROM user_streaks WHERE user_id = @user_id AND streak_type = ''card_addition''', 1);

-- Create sample achievement series
INSERT INTO achievement_series (series_name, description, category_id) VALUES
('Card Count Collector', 'Progressive achievements for growing your collection size', 1),
('Rookie Card Hunter', 'Progressive achievements for collecting rookie cards', 2),
('Social Butterfly', 'Progressive achievements for community participation', 9);

-- Link achievements to series
INSERT INTO achievement_series_members (series_id, achievement_id, series_order) 
SELECT 1, achievement_id, ROW_NUMBER() OVER (ORDER BY requirement_value)
FROM achievements 
WHERE name IN ('First Card', 'Starting Five', 'Double Digits', 'Quarter Century', 'Half Century', 'Century Mark', 'Double Century', 'Quincentennial', 'Millennium Collector', '2K Club', '5K Elite', '10K Legend', '25K Master');

INSERT INTO achievement_series_members (series_id, achievement_id, series_order)
SELECT 2, achievement_id, ROW_NUMBER() OVER (ORDER BY requirement_value)  
FROM achievements
WHERE name IN ('First Rookie', 'Rookie Five', 'Rookie Squad', 'Draft Class', 'Rookie Showcase');

INSERT INTO achievement_series_members (series_id, achievement_id, series_order)
SELECT 3, achievement_id, ROW_NUMBER() OVER (ORDER BY requirement_value)
FROM achievements 
WHERE name IN ('First Comment', 'Conversationalist', 'Discussion Leader', 'Community Voice');

PRINT 'Successfully seeded achievement system with initial core achievements!'
PRINT 'Total achievements created: 50+'
PRINT 'Achievement categories: 6'
PRINT 'Achievement series: 3'
PRINT ''
PRINT 'Next steps:'
PRINT '1. Test the admin achievements page at /admin/achievements'
PRINT '2. Test the user achievements page at /achievements'  
PRINT '3. Run achievement calculation tests'
PRINT '4. Add more achievements from ACHIEVEMENTS.md as needed'