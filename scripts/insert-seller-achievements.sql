-- ============================================================================
-- SELLER ACHIEVEMENTS INSERT SCRIPT
-- ============================================================================
-- Run this script to add ~100 seller-related achievements to the database
-- ============================================================================

-- First, create the Seller category if it doesn't exist
IF NOT EXISTS (SELECT 1 FROM achievement_categories WHERE name = 'Seller')
BEGIN
    INSERT INTO achievement_categories (name, description, display_order, icon, is_active, created_at, updated_at)
    VALUES ('Seller', 'Achievements for selling cards and managing your card business', 8, 'dollar-sign', 1, GETDATE(), GETDATE())
END

-- ============================================================================
-- SALES MILESTONES (12 achievements)
-- ============================================================================

INSERT INTO achievements (category_id, subcategory, name, description, points, tier, requirement_type, requirement_value, requirement_query, is_active, is_secret, is_repeatable)
SELECT category_id, 'Sales Milestones', 'First Sale', 'Complete your first card sale', 10, 'Common', 'count', 1,
 'SELECT COUNT(*) FROM sale WHERE user_id = @user_id AND status = ''sold''', 1, 0, 0
FROM achievement_categories WHERE name = 'Seller'

INSERT INTO achievements (category_id, subcategory, name, description, points, tier, requirement_type, requirement_value, requirement_query, is_active, is_secret, is_repeatable)
SELECT category_id, 'Sales Milestones', 'Getting Started', 'Complete 5 card sales', 15, 'Common', 'count', 5,
 'SELECT COUNT(*) FROM sale WHERE user_id = @user_id AND status = ''sold''', 1, 0, 0
FROM achievement_categories WHERE name = 'Seller'

INSERT INTO achievements (category_id, subcategory, name, description, points, tier, requirement_type, requirement_value, requirement_query, is_active, is_secret, is_repeatable)
SELECT category_id, 'Sales Milestones', 'Double Digits Seller', 'Complete 10 card sales', 20, 'Common', 'count', 10,
 'SELECT COUNT(*) FROM sale WHERE user_id = @user_id AND status = ''sold''', 1, 0, 0
FROM achievement_categories WHERE name = 'Seller'

INSERT INTO achievements (category_id, subcategory, name, description, points, tier, requirement_type, requirement_value, requirement_query, is_active, is_secret, is_repeatable)
SELECT category_id, 'Sales Milestones', 'Quarter Century Seller', 'Complete 25 card sales', 30, 'Uncommon', 'count', 25,
 'SELECT COUNT(*) FROM sale WHERE user_id = @user_id AND status = ''sold''', 1, 0, 0
FROM achievement_categories WHERE name = 'Seller'

INSERT INTO achievements (category_id, subcategory, name, description, points, tier, requirement_type, requirement_value, requirement_query, is_active, is_secret, is_repeatable)
SELECT category_id, 'Sales Milestones', 'Half Century Seller', 'Complete 50 card sales', 40, 'Uncommon', 'count', 50,
 'SELECT COUNT(*) FROM sale WHERE user_id = @user_id AND status = ''sold''', 1, 0, 0
FROM achievement_categories WHERE name = 'Seller'

INSERT INTO achievements (category_id, subcategory, name, description, points, tier, requirement_type, requirement_value, requirement_query, is_active, is_secret, is_repeatable)
SELECT category_id, 'Sales Milestones', 'Century Seller', 'Complete 100 card sales', 75, 'Rare', 'count', 100,
 'SELECT COUNT(*) FROM sale WHERE user_id = @user_id AND status = ''sold''', 1, 0, 0
FROM achievement_categories WHERE name = 'Seller'

INSERT INTO achievements (category_id, subcategory, name, description, points, tier, requirement_type, requirement_value, requirement_query, is_active, is_secret, is_repeatable)
SELECT category_id, 'Sales Milestones', 'Sales Machine', 'Complete 250 card sales', 100, 'Rare', 'count', 250,
 'SELECT COUNT(*) FROM sale WHERE user_id = @user_id AND status = ''sold''', 1, 0, 0
FROM achievement_categories WHERE name = 'Seller'

INSERT INTO achievements (category_id, subcategory, name, description, points, tier, requirement_type, requirement_value, requirement_query, is_active, is_secret, is_repeatable)
SELECT category_id, 'Sales Milestones', 'Power Seller', 'Complete 500 card sales', 150, 'Epic', 'count', 500,
 'SELECT COUNT(*) FROM sale WHERE user_id = @user_id AND status = ''sold''', 1, 0, 0
FROM achievement_categories WHERE name = 'Seller'

INSERT INTO achievements (category_id, subcategory, name, description, points, tier, requirement_type, requirement_value, requirement_query, is_active, is_secret, is_repeatable)
SELECT category_id, 'Sales Milestones', 'Elite Seller', 'Complete 1,000 card sales', 250, 'Epic', 'count', 1000,
 'SELECT COUNT(*) FROM sale WHERE user_id = @user_id AND status = ''sold''', 1, 0, 0
FROM achievement_categories WHERE name = 'Seller'

INSERT INTO achievements (category_id, subcategory, name, description, points, tier, requirement_type, requirement_value, requirement_query, is_active, is_secret, is_repeatable)
SELECT category_id, 'Sales Milestones', 'Sales Legend', 'Complete 2,500 card sales', 400, 'Legendary', 'count', 2500,
 'SELECT COUNT(*) FROM sale WHERE user_id = @user_id AND status = ''sold''', 1, 0, 0
FROM achievement_categories WHERE name = 'Seller'

INSERT INTO achievements (category_id, subcategory, name, description, points, tier, requirement_type, requirement_value, requirement_query, is_active, is_secret, is_repeatable)
SELECT category_id, 'Sales Milestones', 'Sales Master', 'Complete 5,000 card sales', 600, 'Legendary', 'count', 5000,
 'SELECT COUNT(*) FROM sale WHERE user_id = @user_id AND status = ''sold''', 1, 0, 0
FROM achievement_categories WHERE name = 'Seller'

INSERT INTO achievements (category_id, subcategory, name, description, points, tier, requirement_type, requirement_value, requirement_query, is_active, is_secret, is_repeatable)
SELECT category_id, 'Sales Milestones', 'Sales Titan', 'Complete 10,000 card sales', 1000, 'Mythic', 'count', 10000,
 'SELECT COUNT(*) FROM sale WHERE user_id = @user_id AND status = ''sold''', 1, 0, 0
FROM achievement_categories WHERE name = 'Seller'

-- ============================================================================
-- PROFIT MILESTONES (13 achievements)
-- ============================================================================

INSERT INTO achievements (category_id, subcategory, name, description, points, tier, requirement_type, requirement_value, requirement_query, is_active, is_secret, is_repeatable)
SELECT category_id, 'Profit Milestones', 'In the Black', 'Earn your first dollar of profit', 10, 'Common', 'value', 1,
 'SELECT COALESCE(SUM(COALESCE(sale_price, 0) + COALESCE(shipping_charged, 0) - COALESCE(purchase_price, 0) - COALESCE(shipping_cost, 0) - COALESCE(platform_fees, 0) - COALESCE(other_fees, 0) - COALESCE(supply_cost, 0) + COALESCE(adjustment, 0)), 0) FROM sale WHERE user_id = @user_id AND status = ''sold''', 1, 0, 0
FROM achievement_categories WHERE name = 'Seller'

INSERT INTO achievements (category_id, subcategory, name, description, points, tier, requirement_type, requirement_value, requirement_query, is_active, is_secret, is_repeatable)
SELECT category_id, 'Profit Milestones', 'Coffee Money', 'Earn $10 in total profit', 15, 'Common', 'value', 10,
 'SELECT COALESCE(SUM(COALESCE(sale_price, 0) + COALESCE(shipping_charged, 0) - COALESCE(purchase_price, 0) - COALESCE(shipping_cost, 0) - COALESCE(platform_fees, 0) - COALESCE(other_fees, 0) - COALESCE(supply_cost, 0) + COALESCE(adjustment, 0)), 0) FROM sale WHERE user_id = @user_id AND status = ''sold''', 1, 0, 0
FROM achievement_categories WHERE name = 'Seller'

INSERT INTO achievements (category_id, subcategory, name, description, points, tier, requirement_type, requirement_value, requirement_query, is_active, is_secret, is_repeatable)
SELECT category_id, 'Profit Milestones', 'Lunch Money', 'Earn $25 in total profit', 20, 'Common', 'value', 25,
 'SELECT COALESCE(SUM(COALESCE(sale_price, 0) + COALESCE(shipping_charged, 0) - COALESCE(purchase_price, 0) - COALESCE(shipping_cost, 0) - COALESCE(platform_fees, 0) - COALESCE(other_fees, 0) - COALESCE(supply_cost, 0) + COALESCE(adjustment, 0)), 0) FROM sale WHERE user_id = @user_id AND status = ''sold''', 1, 0, 0
FROM achievement_categories WHERE name = 'Seller'

INSERT INTO achievements (category_id, subcategory, name, description, points, tier, requirement_type, requirement_value, requirement_query, is_active, is_secret, is_repeatable)
SELECT category_id, 'Profit Milestones', 'Fifty Bucks', 'Earn $50 in total profit', 30, 'Uncommon', 'value', 50,
 'SELECT COALESCE(SUM(COALESCE(sale_price, 0) + COALESCE(shipping_charged, 0) - COALESCE(purchase_price, 0) - COALESCE(shipping_cost, 0) - COALESCE(platform_fees, 0) - COALESCE(other_fees, 0) - COALESCE(supply_cost, 0) + COALESCE(adjustment, 0)), 0) FROM sale WHERE user_id = @user_id AND status = ''sold''', 1, 0, 0
FROM achievement_categories WHERE name = 'Seller'

INSERT INTO achievements (category_id, subcategory, name, description, points, tier, requirement_type, requirement_value, requirement_query, is_active, is_secret, is_repeatable)
SELECT category_id, 'Profit Milestones', 'Benjamin', 'Earn $100 in total profit', 50, 'Uncommon', 'value', 100,
 'SELECT COALESCE(SUM(COALESCE(sale_price, 0) + COALESCE(shipping_charged, 0) - COALESCE(purchase_price, 0) - COALESCE(shipping_cost, 0) - COALESCE(platform_fees, 0) - COALESCE(other_fees, 0) - COALESCE(supply_cost, 0) + COALESCE(adjustment, 0)), 0) FROM sale WHERE user_id = @user_id AND status = ''sold''', 1, 0, 0
FROM achievement_categories WHERE name = 'Seller'

INSERT INTO achievements (category_id, subcategory, name, description, points, tier, requirement_type, requirement_value, requirement_query, is_active, is_secret, is_repeatable)
SELECT category_id, 'Profit Milestones', 'Quarter Grand', 'Earn $250 in total profit', 75, 'Rare', 'value', 250,
 'SELECT COALESCE(SUM(COALESCE(sale_price, 0) + COALESCE(shipping_charged, 0) - COALESCE(purchase_price, 0) - COALESCE(shipping_cost, 0) - COALESCE(platform_fees, 0) - COALESCE(other_fees, 0) - COALESCE(supply_cost, 0) + COALESCE(adjustment, 0)), 0) FROM sale WHERE user_id = @user_id AND status = ''sold''', 1, 0, 0
FROM achievement_categories WHERE name = 'Seller'

INSERT INTO achievements (category_id, subcategory, name, description, points, tier, requirement_type, requirement_value, requirement_query, is_active, is_secret, is_repeatable)
SELECT category_id, 'Profit Milestones', 'Half Grand', 'Earn $500 in total profit', 100, 'Rare', 'value', 500,
 'SELECT COALESCE(SUM(COALESCE(sale_price, 0) + COALESCE(shipping_charged, 0) - COALESCE(purchase_price, 0) - COALESCE(shipping_cost, 0) - COALESCE(platform_fees, 0) - COALESCE(other_fees, 0) - COALESCE(supply_cost, 0) + COALESCE(adjustment, 0)), 0) FROM sale WHERE user_id = @user_id AND status = ''sold''', 1, 0, 0
FROM achievement_categories WHERE name = 'Seller'

INSERT INTO achievements (category_id, subcategory, name, description, points, tier, requirement_type, requirement_value, requirement_query, is_active, is_secret, is_repeatable)
SELECT category_id, 'Profit Milestones', 'Grand Slam', 'Earn $1,000 in total profit', 150, 'Epic', 'value', 1000,
 'SELECT COALESCE(SUM(COALESCE(sale_price, 0) + COALESCE(shipping_charged, 0) - COALESCE(purchase_price, 0) - COALESCE(shipping_cost, 0) - COALESCE(platform_fees, 0) - COALESCE(other_fees, 0) - COALESCE(supply_cost, 0) + COALESCE(adjustment, 0)), 0) FROM sale WHERE user_id = @user_id AND status = ''sold''', 1, 0, 0
FROM achievement_categories WHERE name = 'Seller'

INSERT INTO achievements (category_id, subcategory, name, description, points, tier, requirement_type, requirement_value, requirement_query, is_active, is_secret, is_repeatable)
SELECT category_id, 'Profit Milestones', 'High Roller', 'Earn $2,500 in total profit', 200, 'Epic', 'value', 2500,
 'SELECT COALESCE(SUM(COALESCE(sale_price, 0) + COALESCE(shipping_charged, 0) - COALESCE(purchase_price, 0) - COALESCE(shipping_cost, 0) - COALESCE(platform_fees, 0) - COALESCE(other_fees, 0) - COALESCE(supply_cost, 0) + COALESCE(adjustment, 0)), 0) FROM sale WHERE user_id = @user_id AND status = ''sold''', 1, 0, 0
FROM achievement_categories WHERE name = 'Seller'

INSERT INTO achievements (category_id, subcategory, name, description, points, tier, requirement_type, requirement_value, requirement_query, is_active, is_secret, is_repeatable)
SELECT category_id, 'Profit Milestones', 'Five Grand Profit', 'Earn $5,000 in total profit', 300, 'Legendary', 'value', 5000,
 'SELECT COALESCE(SUM(COALESCE(sale_price, 0) + COALESCE(shipping_charged, 0) - COALESCE(purchase_price, 0) - COALESCE(shipping_cost, 0) - COALESCE(platform_fees, 0) - COALESCE(other_fees, 0) - COALESCE(supply_cost, 0) + COALESCE(adjustment, 0)), 0) FROM sale WHERE user_id = @user_id AND status = ''sold''', 1, 0, 0
FROM achievement_categories WHERE name = 'Seller'

INSERT INTO achievements (category_id, subcategory, name, description, points, tier, requirement_type, requirement_value, requirement_query, is_active, is_secret, is_repeatable)
SELECT category_id, 'Profit Milestones', 'Ten Grand Profit', 'Earn $10,000 in total profit', 500, 'Legendary', 'value', 10000,
 'SELECT COALESCE(SUM(COALESCE(sale_price, 0) + COALESCE(shipping_charged, 0) - COALESCE(purchase_price, 0) - COALESCE(shipping_cost, 0) - COALESCE(platform_fees, 0) - COALESCE(other_fees, 0) - COALESCE(supply_cost, 0) + COALESCE(adjustment, 0)), 0) FROM sale WHERE user_id = @user_id AND status = ''sold''', 1, 0, 0
FROM achievement_categories WHERE name = 'Seller'

INSERT INTO achievements (category_id, subcategory, name, description, points, tier, requirement_type, requirement_value, requirement_query, is_active, is_secret, is_repeatable)
SELECT category_id, 'Profit Milestones', 'Profit King', 'Earn $25,000 in total profit', 750, 'Mythic', 'value', 25000,
 'SELECT COALESCE(SUM(COALESCE(sale_price, 0) + COALESCE(shipping_charged, 0) - COALESCE(purchase_price, 0) - COALESCE(shipping_cost, 0) - COALESCE(platform_fees, 0) - COALESCE(other_fees, 0) - COALESCE(supply_cost, 0) + COALESCE(adjustment, 0)), 0) FROM sale WHERE user_id = @user_id AND status = ''sold''', 1, 0, 0
FROM achievement_categories WHERE name = 'Seller'

INSERT INTO achievements (category_id, subcategory, name, description, points, tier, requirement_type, requirement_value, requirement_query, is_active, is_secret, is_repeatable)
SELECT category_id, 'Profit Milestones', 'Profit Legend', 'Earn $50,000 in total profit', 1000, 'Mythic', 'value', 50000,
 'SELECT COALESCE(SUM(COALESCE(sale_price, 0) + COALESCE(shipping_charged, 0) - COALESCE(purchase_price, 0) - COALESCE(shipping_cost, 0) - COALESCE(platform_fees, 0) - COALESCE(other_fees, 0) - COALESCE(supply_cost, 0) + COALESCE(adjustment, 0)), 0) FROM sale WHERE user_id = @user_id AND status = ''sold''', 1, 0, 0
FROM achievement_categories WHERE name = 'Seller'

-- ============================================================================
-- REVENUE MILESTONES (7 achievements)
-- ============================================================================

INSERT INTO achievements (category_id, subcategory, name, description, points, tier, requirement_type, requirement_value, requirement_query, is_active, is_secret, is_repeatable)
SELECT category_id, 'Revenue Milestones', 'First Revenue', 'Generate $10 in total revenue', 10, 'Common', 'value', 10,
 'SELECT COALESCE(SUM(COALESCE(sale_price, 0) + COALESCE(shipping_charged, 0)), 0) FROM sale WHERE user_id = @user_id AND status = ''sold''', 1, 0, 0
FROM achievement_categories WHERE name = 'Seller'

INSERT INTO achievements (category_id, subcategory, name, description, points, tier, requirement_type, requirement_value, requirement_query, is_active, is_secret, is_repeatable)
SELECT category_id, 'Revenue Milestones', 'Revenue Stream', 'Generate $100 in total revenue', 20, 'Common', 'value', 100,
 'SELECT COALESCE(SUM(COALESCE(sale_price, 0) + COALESCE(shipping_charged, 0)), 0) FROM sale WHERE user_id = @user_id AND status = ''sold''', 1, 0, 0
FROM achievement_categories WHERE name = 'Seller'

INSERT INTO achievements (category_id, subcategory, name, description, points, tier, requirement_type, requirement_value, requirement_query, is_active, is_secret, is_repeatable)
SELECT category_id, 'Revenue Milestones', 'Revenue Flow', 'Generate $500 in total revenue', 40, 'Uncommon', 'value', 500,
 'SELECT COALESCE(SUM(COALESCE(sale_price, 0) + COALESCE(shipping_charged, 0)), 0) FROM sale WHERE user_id = @user_id AND status = ''sold''', 1, 0, 0
FROM achievement_categories WHERE name = 'Seller'

INSERT INTO achievements (category_id, subcategory, name, description, points, tier, requirement_type, requirement_value, requirement_query, is_active, is_secret, is_repeatable)
SELECT category_id, 'Revenue Milestones', 'Revenue River', 'Generate $1,000 in total revenue', 75, 'Rare', 'value', 1000,
 'SELECT COALESCE(SUM(COALESCE(sale_price, 0) + COALESCE(shipping_charged, 0)), 0) FROM sale WHERE user_id = @user_id AND status = ''sold''', 1, 0, 0
FROM achievement_categories WHERE name = 'Seller'

INSERT INTO achievements (category_id, subcategory, name, description, points, tier, requirement_type, requirement_value, requirement_query, is_active, is_secret, is_repeatable)
SELECT category_id, 'Revenue Milestones', 'Revenue Flood', 'Generate $5,000 in total revenue', 150, 'Epic', 'value', 5000,
 'SELECT COALESCE(SUM(COALESCE(sale_price, 0) + COALESCE(shipping_charged, 0)), 0) FROM sale WHERE user_id = @user_id AND status = ''sold''', 1, 0, 0
FROM achievement_categories WHERE name = 'Seller'

INSERT INTO achievements (category_id, subcategory, name, description, points, tier, requirement_type, requirement_value, requirement_query, is_active, is_secret, is_repeatable)
SELECT category_id, 'Revenue Milestones', 'Revenue Tsunami', 'Generate $10,000 in total revenue', 300, 'Legendary', 'value', 10000,
 'SELECT COALESCE(SUM(COALESCE(sale_price, 0) + COALESCE(shipping_charged, 0)), 0) FROM sale WHERE user_id = @user_id AND status = ''sold''', 1, 0, 0
FROM achievement_categories WHERE name = 'Seller'

INSERT INTO achievements (category_id, subcategory, name, description, points, tier, requirement_type, requirement_value, requirement_query, is_active, is_secret, is_repeatable)
SELECT category_id, 'Revenue Milestones', 'Revenue Empire', 'Generate $50,000 in total revenue', 750, 'Mythic', 'value', 50000,
 'SELECT COALESCE(SUM(COALESCE(sale_price, 0) + COALESCE(shipping_charged, 0)), 0) FROM sale WHERE user_id = @user_id AND status = ''sold''', 1, 0, 0
FROM achievement_categories WHERE name = 'Seller'

-- ============================================================================
-- SINGLE SALE ACHIEVEMENTS (12 achievements)
-- ============================================================================

INSERT INTO achievements (category_id, subcategory, name, description, points, tier, requirement_type, requirement_value, requirement_query, is_active, is_secret, is_repeatable)
SELECT category_id, 'Single Sale', 'Nice Flip', 'Make $5+ profit on a single sale', 15, 'Common', 'count', 1,
 'SELECT COUNT(*) FROM sale WHERE user_id = @user_id AND status = ''sold'' AND (COALESCE(sale_price, 0) + COALESCE(shipping_charged, 0) - COALESCE(purchase_price, 0) - COALESCE(shipping_cost, 0) - COALESCE(platform_fees, 0) - COALESCE(other_fees, 0) - COALESCE(supply_cost, 0) + COALESCE(adjustment, 0)) >= 5', 1, 0, 0
FROM achievement_categories WHERE name = 'Seller'

INSERT INTO achievements (category_id, subcategory, name, description, points, tier, requirement_type, requirement_value, requirement_query, is_active, is_secret, is_repeatable)
SELECT category_id, 'Single Sale', 'Great Flip', 'Make $10+ profit on a single sale', 25, 'Uncommon', 'count', 1,
 'SELECT COUNT(*) FROM sale WHERE user_id = @user_id AND status = ''sold'' AND (COALESCE(sale_price, 0) + COALESCE(shipping_charged, 0) - COALESCE(purchase_price, 0) - COALESCE(shipping_cost, 0) - COALESCE(platform_fees, 0) - COALESCE(other_fees, 0) - COALESCE(supply_cost, 0) + COALESCE(adjustment, 0)) >= 10', 1, 0, 0
FROM achievement_categories WHERE name = 'Seller'

INSERT INTO achievements (category_id, subcategory, name, description, points, tier, requirement_type, requirement_value, requirement_query, is_active, is_secret, is_repeatable)
SELECT category_id, 'Single Sale', 'Amazing Flip', 'Make $25+ profit on a single sale', 40, 'Uncommon', 'count', 1,
 'SELECT COUNT(*) FROM sale WHERE user_id = @user_id AND status = ''sold'' AND (COALESCE(sale_price, 0) + COALESCE(shipping_charged, 0) - COALESCE(purchase_price, 0) - COALESCE(shipping_cost, 0) - COALESCE(platform_fees, 0) - COALESCE(other_fees, 0) - COALESCE(supply_cost, 0) + COALESCE(adjustment, 0)) >= 25', 1, 0, 0
FROM achievement_categories WHERE name = 'Seller'

INSERT INTO achievements (category_id, subcategory, name, description, points, tier, requirement_type, requirement_value, requirement_query, is_active, is_secret, is_repeatable)
SELECT category_id, 'Single Sale', 'Monster Flip', 'Make $50+ profit on a single sale', 60, 'Rare', 'count', 1,
 'SELECT COUNT(*) FROM sale WHERE user_id = @user_id AND status = ''sold'' AND (COALESCE(sale_price, 0) + COALESCE(shipping_charged, 0) - COALESCE(purchase_price, 0) - COALESCE(shipping_cost, 0) - COALESCE(platform_fees, 0) - COALESCE(other_fees, 0) - COALESCE(supply_cost, 0) + COALESCE(adjustment, 0)) >= 50', 1, 0, 0
FROM achievement_categories WHERE name = 'Seller'

INSERT INTO achievements (category_id, subcategory, name, description, points, tier, requirement_type, requirement_value, requirement_query, is_active, is_secret, is_repeatable)
SELECT category_id, 'Single Sale', 'Epic Flip', 'Make $100+ profit on a single sale', 100, 'Rare', 'count', 1,
 'SELECT COUNT(*) FROM sale WHERE user_id = @user_id AND status = ''sold'' AND (COALESCE(sale_price, 0) + COALESCE(shipping_charged, 0) - COALESCE(purchase_price, 0) - COALESCE(shipping_cost, 0) - COALESCE(platform_fees, 0) - COALESCE(other_fees, 0) - COALESCE(supply_cost, 0) + COALESCE(adjustment, 0)) >= 100', 1, 0, 0
FROM achievement_categories WHERE name = 'Seller'

INSERT INTO achievements (category_id, subcategory, name, description, points, tier, requirement_type, requirement_value, requirement_query, is_active, is_secret, is_repeatable)
SELECT category_id, 'Single Sale', 'Legendary Flip', 'Make $250+ profit on a single sale', 150, 'Epic', 'count', 1,
 'SELECT COUNT(*) FROM sale WHERE user_id = @user_id AND status = ''sold'' AND (COALESCE(sale_price, 0) + COALESCE(shipping_charged, 0) - COALESCE(purchase_price, 0) - COALESCE(shipping_cost, 0) - COALESCE(platform_fees, 0) - COALESCE(other_fees, 0) - COALESCE(supply_cost, 0) + COALESCE(adjustment, 0)) >= 250', 1, 0, 0
FROM achievement_categories WHERE name = 'Seller'

INSERT INTO achievements (category_id, subcategory, name, description, points, tier, requirement_type, requirement_value, requirement_query, is_active, is_secret, is_repeatable)
SELECT category_id, 'Single Sale', 'Whale Sale', 'Make $500+ profit on a single sale', 250, 'Legendary', 'count', 1,
 'SELECT COUNT(*) FROM sale WHERE user_id = @user_id AND status = ''sold'' AND (COALESCE(sale_price, 0) + COALESCE(shipping_charged, 0) - COALESCE(purchase_price, 0) - COALESCE(shipping_cost, 0) - COALESCE(platform_fees, 0) - COALESCE(other_fees, 0) - COALESCE(supply_cost, 0) + COALESCE(adjustment, 0)) >= 500', 1, 0, 0
FROM achievement_categories WHERE name = 'Seller'

INSERT INTO achievements (category_id, subcategory, name, description, points, tier, requirement_type, requirement_value, requirement_query, is_active, is_secret, is_repeatable)
SELECT category_id, 'Single Sale', 'Unicorn Sale', 'Make $1,000+ profit on a single sale', 500, 'Mythic', 'count', 1,
 'SELECT COUNT(*) FROM sale WHERE user_id = @user_id AND status = ''sold'' AND (COALESCE(sale_price, 0) + COALESCE(shipping_charged, 0) - COALESCE(purchase_price, 0) - COALESCE(shipping_cost, 0) - COALESCE(platform_fees, 0) - COALESCE(other_fees, 0) - COALESCE(supply_cost, 0) + COALESCE(adjustment, 0)) >= 1000', 1, 0, 0
FROM achievement_categories WHERE name = 'Seller'

INSERT INTO achievements (category_id, subcategory, name, description, points, tier, requirement_type, requirement_value, requirement_query, is_active, is_secret, is_repeatable)
SELECT category_id, 'Single Sale', 'Big Ticket', 'Sell a card for $100+', 75, 'Rare', 'count', 1,
 'SELECT COUNT(*) FROM sale WHERE user_id = @user_id AND status = ''sold'' AND sale_price >= 100', 1, 0, 0
FROM achievement_categories WHERE name = 'Seller'

INSERT INTO achievements (category_id, subcategory, name, description, points, tier, requirement_type, requirement_value, requirement_query, is_active, is_secret, is_repeatable)
SELECT category_id, 'Single Sale', 'Premium Sale', 'Sell a card for $250+', 125, 'Epic', 'count', 1,
 'SELECT COUNT(*) FROM sale WHERE user_id = @user_id AND status = ''sold'' AND sale_price >= 250', 1, 0, 0
FROM achievement_categories WHERE name = 'Seller'

INSERT INTO achievements (category_id, subcategory, name, description, points, tier, requirement_type, requirement_value, requirement_query, is_active, is_secret, is_repeatable)
SELECT category_id, 'Single Sale', 'High-End Sale', 'Sell a card for $500+', 200, 'Legendary', 'count', 1,
 'SELECT COUNT(*) FROM sale WHERE user_id = @user_id AND status = ''sold'' AND sale_price >= 500', 1, 0, 0
FROM achievement_categories WHERE name = 'Seller'

INSERT INTO achievements (category_id, subcategory, name, description, points, tier, requirement_type, requirement_value, requirement_query, is_active, is_secret, is_repeatable)
SELECT category_id, 'Single Sale', 'Grail Sale', 'Sell a card for $1,000+', 400, 'Mythic', 'count', 1,
 'SELECT COUNT(*) FROM sale WHERE user_id = @user_id AND status = ''sold'' AND sale_price >= 1000', 1, 0, 0
FROM achievement_categories WHERE name = 'Seller'

-- ============================================================================
-- ORDER MANAGEMENT (10 achievements)
-- ============================================================================

INSERT INTO achievements (category_id, subcategory, name, description, points, tier, requirement_type, requirement_value, requirement_query, is_active, is_secret, is_repeatable)
SELECT category_id, 'Order Management', 'First Shipment', 'Create your first order', 10, 'Common', 'count', 1,
 'SELECT COUNT(*) FROM sale_order WHERE user_id = @user_id', 1, 0, 0
FROM achievement_categories WHERE name = 'Seller'

INSERT INTO achievements (category_id, subcategory, name, description, points, tier, requirement_type, requirement_value, requirement_query, is_active, is_secret, is_repeatable)
SELECT category_id, 'Order Management', 'Shipping Pro', 'Create 10 orders', 25, 'Common', 'count', 10,
 'SELECT COUNT(*) FROM sale_order WHERE user_id = @user_id', 1, 0, 0
FROM achievement_categories WHERE name = 'Seller'

INSERT INTO achievements (category_id, subcategory, name, description, points, tier, requirement_type, requirement_value, requirement_query, is_active, is_secret, is_repeatable)
SELECT category_id, 'Order Management', 'Logistics Manager', 'Create 25 orders', 40, 'Uncommon', 'count', 25,
 'SELECT COUNT(*) FROM sale_order WHERE user_id = @user_id', 1, 0, 0
FROM achievement_categories WHERE name = 'Seller'

INSERT INTO achievements (category_id, subcategory, name, description, points, tier, requirement_type, requirement_value, requirement_query, is_active, is_secret, is_repeatable)
SELECT category_id, 'Order Management', 'Shipping Expert', 'Create 50 orders', 75, 'Rare', 'count', 50,
 'SELECT COUNT(*) FROM sale_order WHERE user_id = @user_id', 1, 0, 0
FROM achievement_categories WHERE name = 'Seller'

INSERT INTO achievements (category_id, subcategory, name, description, points, tier, requirement_type, requirement_value, requirement_query, is_active, is_secret, is_repeatable)
SELECT category_id, 'Order Management', 'Fulfillment Master', 'Create 100 orders', 125, 'Epic', 'count', 100,
 'SELECT COUNT(*) FROM sale_order WHERE user_id = @user_id', 1, 0, 0
FROM achievement_categories WHERE name = 'Seller'

INSERT INTO achievements (category_id, subcategory, name, description, points, tier, requirement_type, requirement_value, requirement_query, is_active, is_secret, is_repeatable)
SELECT category_id, 'Order Management', 'Shipping Mogul', 'Create 250 orders', 250, 'Legendary', 'count', 250,
 'SELECT COUNT(*) FROM sale_order WHERE user_id = @user_id', 1, 0, 0
FROM achievement_categories WHERE name = 'Seller'

INSERT INTO achievements (category_id, subcategory, name, description, points, tier, requirement_type, requirement_value, requirement_query, is_active, is_secret, is_repeatable)
SELECT category_id, 'Order Management', 'Bundle Deal', 'Create an order with 5+ sales', 30, 'Uncommon', 'count', 1,
 'SELECT COUNT(*) FROM sale_order o WHERE o.user_id = @user_id AND (SELECT COUNT(*) FROM sale s WHERE s.order_id = o.order_id) >= 5', 1, 0, 0
FROM achievement_categories WHERE name = 'Seller'

INSERT INTO achievements (category_id, subcategory, name, description, points, tier, requirement_type, requirement_value, requirement_query, is_active, is_secret, is_repeatable)
SELECT category_id, 'Order Management', 'Mega Bundle', 'Create an order with 10+ sales', 60, 'Rare', 'count', 1,
 'SELECT COUNT(*) FROM sale_order o WHERE o.user_id = @user_id AND (SELECT COUNT(*) FROM sale s WHERE s.order_id = o.order_id) >= 10', 1, 0, 0
FROM achievement_categories WHERE name = 'Seller'

INSERT INTO achievements (category_id, subcategory, name, description, points, tier, requirement_type, requirement_value, requirement_query, is_active, is_secret, is_repeatable)
SELECT category_id, 'Order Management', 'Super Bundle', 'Create an order with 25+ sales', 100, 'Epic', 'count', 1,
 'SELECT COUNT(*) FROM sale_order o WHERE o.user_id = @user_id AND (SELECT COUNT(*) FROM sale s WHERE s.order_id = o.order_id) >= 25', 1, 0, 0
FROM achievement_categories WHERE name = 'Seller'

INSERT INTO achievements (category_id, subcategory, name, description, points, tier, requirement_type, requirement_value, requirement_query, is_active, is_secret, is_repeatable)
SELECT category_id, 'Order Management', 'Ultimate Bundle', 'Create an order with 50+ sales', 175, 'Legendary', 'count', 1,
 'SELECT COUNT(*) FROM sale_order o WHERE o.user_id = @user_id AND (SELECT COUNT(*) FROM sale s WHERE s.order_id = o.order_id) >= 50', 1, 0, 0
FROM achievement_categories WHERE name = 'Seller'

-- ============================================================================
-- PLATFORM ACHIEVEMENTS (10 achievements)
-- ============================================================================

INSERT INTO achievements (category_id, subcategory, name, description, points, tier, requirement_type, requirement_value, requirement_query, is_active, is_secret, is_repeatable)
SELECT category_id, 'Platform Sales', 'Selling Debut', 'Make a sale on any platform', 10, 'Common', 'count', 1,
 'SELECT COUNT(DISTINCT platform_id) FROM sale WHERE user_id = @user_id AND status = ''sold'' AND platform_id IS NOT NULL', 1, 0, 0
FROM achievement_categories WHERE name = 'Seller'

INSERT INTO achievements (category_id, subcategory, name, description, points, tier, requirement_type, requirement_value, requirement_query, is_active, is_secret, is_repeatable)
SELECT category_id, 'Platform Sales', 'Multi-Platform', 'Make sales on 2 different platforms', 30, 'Uncommon', 'count', 2,
 'SELECT COUNT(DISTINCT platform_id) FROM sale WHERE user_id = @user_id AND status = ''sold'' AND platform_id IS NOT NULL', 1, 0, 0
FROM achievement_categories WHERE name = 'Seller'

INSERT INTO achievements (category_id, subcategory, name, description, points, tier, requirement_type, requirement_value, requirement_query, is_active, is_secret, is_repeatable)
SELECT category_id, 'Platform Sales', 'Platform Diversifier', 'Make sales on 3 different platforms', 50, 'Rare', 'count', 3,
 'SELECT COUNT(DISTINCT platform_id) FROM sale WHERE user_id = @user_id AND status = ''sold'' AND platform_id IS NOT NULL', 1, 0, 0
FROM achievement_categories WHERE name = 'Seller'

INSERT INTO achievements (category_id, subcategory, name, description, points, tier, requirement_type, requirement_value, requirement_query, is_active, is_secret, is_repeatable)
SELECT category_id, 'Platform Sales', 'Omni-Channel', 'Make sales on 5+ different platforms', 100, 'Epic', 'count', 5,
 'SELECT COUNT(DISTINCT platform_id) FROM sale WHERE user_id = @user_id AND status = ''sold'' AND platform_id IS NOT NULL', 1, 0, 0
FROM achievement_categories WHERE name = 'Seller'

INSERT INTO achievements (category_id, subcategory, name, description, points, tier, requirement_type, requirement_value, requirement_query, is_active, is_secret, is_repeatable)
SELECT category_id, 'Platform Sales', 'eBay Seller', 'Complete 10 sales on eBay', 25, 'Uncommon', 'count', 10,
 'SELECT COUNT(*) FROM sale s JOIN selling_platform p ON s.platform_id = p.platform_id WHERE s.user_id = @user_id AND s.status = ''sold'' AND LOWER(p.name) LIKE ''%ebay%''', 1, 0, 0
FROM achievement_categories WHERE name = 'Seller'

INSERT INTO achievements (category_id, subcategory, name, description, points, tier, requirement_type, requirement_value, requirement_query, is_active, is_secret, is_repeatable)
SELECT category_id, 'Platform Sales', 'eBay Pro', 'Complete 50 sales on eBay', 75, 'Rare', 'count', 50,
 'SELECT COUNT(*) FROM sale s JOIN selling_platform p ON s.platform_id = p.platform_id WHERE s.user_id = @user_id AND s.status = ''sold'' AND LOWER(p.name) LIKE ''%ebay%''', 1, 0, 0
FROM achievement_categories WHERE name = 'Seller'

INSERT INTO achievements (category_id, subcategory, name, description, points, tier, requirement_type, requirement_value, requirement_query, is_active, is_secret, is_repeatable)
SELECT category_id, 'Platform Sales', 'eBay Master', 'Complete 100 sales on eBay', 150, 'Epic', 'count', 100,
 'SELECT COUNT(*) FROM sale s JOIN selling_platform p ON s.platform_id = p.platform_id WHERE s.user_id = @user_id AND s.status = ''sold'' AND LOWER(p.name) LIKE ''%ebay%''', 1, 0, 0
FROM achievement_categories WHERE name = 'Seller'

INSERT INTO achievements (category_id, subcategory, name, description, points, tier, requirement_type, requirement_value, requirement_query, is_active, is_secret, is_repeatable)
SELECT category_id, 'Platform Sales', 'Local Hero', 'Complete 10 local/in-person sales', 30, 'Uncommon', 'count', 10,
 'SELECT COUNT(*) FROM sale s JOIN selling_platform p ON s.platform_id = p.platform_id WHERE s.user_id = @user_id AND s.status = ''sold'' AND (LOWER(p.name) LIKE ''%local%'' OR LOWER(p.name) LIKE ''%person%'' OR LOWER(p.name) LIKE ''%show%'')', 1, 0, 0
FROM achievement_categories WHERE name = 'Seller'

INSERT INTO achievements (category_id, subcategory, name, description, points, tier, requirement_type, requirement_value, requirement_query, is_active, is_secret, is_repeatable)
SELECT category_id, 'Platform Sales', 'Show Seller', 'Complete 25 local/in-person sales', 60, 'Rare', 'count', 25,
 'SELECT COUNT(*) FROM sale s JOIN selling_platform p ON s.platform_id = p.platform_id WHERE s.user_id = @user_id AND s.status = ''sold'' AND (LOWER(p.name) LIKE ''%local%'' OR LOWER(p.name) LIKE ''%person%'' OR LOWER(p.name) LIKE ''%show%'')', 1, 0, 0
FROM achievement_categories WHERE name = 'Seller'

INSERT INTO achievements (category_id, subcategory, name, description, points, tier, requirement_type, requirement_value, requirement_query, is_active, is_secret, is_repeatable)
SELECT category_id, 'Platform Sales', 'Convention King', 'Complete 50 local/in-person sales', 100, 'Epic', 'count', 50,
 'SELECT COUNT(*) FROM sale s JOIN selling_platform p ON s.platform_id = p.platform_id WHERE s.user_id = @user_id AND s.status = ''sold'' AND (LOWER(p.name) LIKE ''%local%'' OR LOWER(p.name) LIKE ''%person%'' OR LOWER(p.name) LIKE ''%show%'')', 1, 0, 0
FROM achievement_categories WHERE name = 'Seller'

-- ============================================================================
-- INVESTMENT & ROI (12 achievements)
-- ============================================================================

INSERT INTO achievements (category_id, subcategory, name, description, points, tier, requirement_type, requirement_value, requirement_query, is_active, is_secret, is_repeatable)
SELECT category_id, 'Investment', 'First Investment', 'Record your first product purchase', 10, 'Common', 'count', 1,
 'SELECT COUNT(*) FROM product_purchase WHERE user_id = @user_id', 1, 0, 0
FROM achievement_categories WHERE name = 'Seller'

INSERT INTO achievements (category_id, subcategory, name, description, points, tier, requirement_type, requirement_value, requirement_query, is_active, is_secret, is_repeatable)
SELECT category_id, 'Investment', 'Box Breaker', 'Purchase 5 hobby boxes/cases', 20, 'Common', 'count', 5,
 'SELECT COUNT(*) FROM product_purchase WHERE user_id = @user_id', 1, 0, 0
FROM achievement_categories WHERE name = 'Seller'

INSERT INTO achievements (category_id, subcategory, name, description, points, tier, requirement_type, requirement_value, requirement_query, is_active, is_secret, is_repeatable)
SELECT category_id, 'Investment', 'Serious Investor', 'Purchase 10 hobby boxes/cases', 40, 'Uncommon', 'count', 10,
 'SELECT COUNT(*) FROM product_purchase WHERE user_id = @user_id', 1, 0, 0
FROM achievement_categories WHERE name = 'Seller'

INSERT INTO achievements (category_id, subcategory, name, description, points, tier, requirement_type, requirement_value, requirement_query, is_active, is_secret, is_repeatable)
SELECT category_id, 'Investment', 'Heavy Investor', 'Purchase 25 hobby boxes/cases', 75, 'Rare', 'count', 25,
 'SELECT COUNT(*) FROM product_purchase WHERE user_id = @user_id', 1, 0, 0
FROM achievement_categories WHERE name = 'Seller'

INSERT INTO achievements (category_id, subcategory, name, description, points, tier, requirement_type, requirement_value, requirement_query, is_active, is_secret, is_repeatable)
SELECT category_id, 'Investment', 'Investment Mogul', 'Purchase 50 hobby boxes/cases', 125, 'Epic', 'count', 50,
 'SELECT COUNT(*) FROM product_purchase WHERE user_id = @user_id', 1, 0, 0
FROM achievement_categories WHERE name = 'Seller'

INSERT INTO achievements (category_id, subcategory, name, description, points, tier, requirement_type, requirement_value, requirement_query, is_active, is_secret, is_repeatable)
SELECT category_id, 'Investment', 'Break Even', 'Recover 100% of investment on a set', 100, 'Rare', 'percentage', 100,
 'SELECT COALESCE(MAX(recovery_pct), 0) FROM (SELECT pp.[set], (SUM(COALESCE(s.sale_price, 0) + COALESCE(s.shipping_charged, 0)) * 100.0 / NULLIF(SUM(pp.total_cost), 0)) as recovery_pct FROM product_purchase pp LEFT JOIN sale s ON s.[user] = pp.[user] AND s.status = ''sold'' AND s.series_id IN (SELECT series_id FROM series WHERE [set] = pp.[set]) WHERE pp.user_id = @user_id GROUP BY pp.[set]) t', 1, 0, 0
FROM achievement_categories WHERE name = 'Seller'

INSERT INTO achievements (category_id, subcategory, name, description, points, tier, requirement_type, requirement_value, requirement_query, is_active, is_secret, is_repeatable)
SELECT category_id, 'Investment', 'Profitable Set', 'Exceed 100% recovery on a set', 150, 'Epic', 'percentage', 101,
 'SELECT COALESCE(MAX(recovery_pct), 0) FROM (SELECT pp.[set], (SUM(COALESCE(s.sale_price, 0) + COALESCE(s.shipping_charged, 0)) * 100.0 / NULLIF(SUM(pp.total_cost), 0)) as recovery_pct FROM product_purchase pp LEFT JOIN sale s ON s.[user] = pp.[user] AND s.status = ''sold'' AND s.series_id IN (SELECT series_id FROM series WHERE [set] = pp.[set]) WHERE pp.user_id = @user_id GROUP BY pp.[set]) t', 1, 0, 0
FROM achievement_categories WHERE name = 'Seller'

INSERT INTO achievements (category_id, subcategory, name, description, points, tier, requirement_type, requirement_value, requirement_query, is_active, is_secret, is_repeatable)
SELECT category_id, 'Investment', 'Double Your Money', 'Achieve 200% recovery on a set', 300, 'Legendary', 'percentage', 200,
 'SELECT COALESCE(MAX(recovery_pct), 0) FROM (SELECT pp.[set], (SUM(COALESCE(s.sale_price, 0) + COALESCE(s.shipping_charged, 0)) * 100.0 / NULLIF(SUM(pp.total_cost), 0)) as recovery_pct FROM product_purchase pp LEFT JOIN sale s ON s.[user] = pp.[user] AND s.status = ''sold'' AND s.series_id IN (SELECT series_id FROM series WHERE [set] = pp.[set]) WHERE pp.user_id = @user_id GROUP BY pp.[set]) t', 1, 0, 0
FROM achievement_categories WHERE name = 'Seller'

INSERT INTO achievements (category_id, subcategory, name, description, points, tier, requirement_type, requirement_value, requirement_query, is_active, is_secret, is_repeatable)
SELECT category_id, 'Investment', 'Home Run', 'Achieve 300% recovery on a set', 500, 'Mythic', 'percentage', 300,
 'SELECT COALESCE(MAX(recovery_pct), 0) FROM (SELECT pp.[set], (SUM(COALESCE(s.sale_price, 0) + COALESCE(s.shipping_charged, 0)) * 100.0 / NULLIF(SUM(pp.total_cost), 0)) as recovery_pct FROM product_purchase pp LEFT JOIN sale s ON s.[user] = pp.[user] AND s.status = ''sold'' AND s.series_id IN (SELECT series_id FROM series WHERE [set] = pp.[set]) WHERE pp.user_id = @user_id GROUP BY pp.[set]) t', 1, 0, 0
FROM achievement_categories WHERE name = 'Seller'

INSERT INTO achievements (category_id, subcategory, name, description, points, tier, requirement_type, requirement_value, requirement_query, is_active, is_secret, is_repeatable)
SELECT category_id, 'Investment', 'Case Cracker', 'Purchase a hobby case', 35, 'Uncommon', 'count', 1,
 'SELECT COUNT(*) FROM product_purchase WHERE user_id = @user_id AND product_type = ''hobby_case''', 1, 0, 0
FROM achievement_categories WHERE name = 'Seller'

INSERT INTO achievements (category_id, subcategory, name, description, points, tier, requirement_type, requirement_value, requirement_query, is_active, is_secret, is_repeatable)
SELECT category_id, 'Investment', 'Case Collector', 'Purchase 5 hobby cases', 75, 'Rare', 'count', 5,
 'SELECT COUNT(*) FROM product_purchase WHERE user_id = @user_id AND product_type = ''hobby_case''', 1, 0, 0
FROM achievement_categories WHERE name = 'Seller'

INSERT INTO achievements (category_id, subcategory, name, description, points, tier, requirement_type, requirement_value, requirement_query, is_active, is_secret, is_repeatable)
SELECT category_id, 'Investment', 'Case King', 'Purchase 10 hobby cases', 150, 'Epic', 'count', 10,
 'SELECT COUNT(*) FROM product_purchase WHERE user_id = @user_id AND product_type = ''hobby_case''', 1, 0, 0
FROM achievement_categories WHERE name = 'Seller'

-- ============================================================================
-- SUPPLY MANAGEMENT (8 achievements)
-- ============================================================================

INSERT INTO achievements (category_id, subcategory, name, description, points, tier, requirement_type, requirement_value, requirement_query, is_active, is_secret, is_repeatable)
SELECT category_id, 'Supply Management', 'Supply Starter', 'Create your first supply type', 10, 'Common', 'count', 1,
 'SELECT COUNT(*) FROM supply_type WHERE user_id = @user_id', 1, 0, 0
FROM achievement_categories WHERE name = 'Seller'

INSERT INTO achievements (category_id, subcategory, name, description, points, tier, requirement_type, requirement_value, requirement_query, is_active, is_secret, is_repeatable)
SELECT category_id, 'Supply Management', 'Organized Seller', 'Create 5 supply types', 25, 'Uncommon', 'count', 5,
 'SELECT COUNT(*) FROM supply_type WHERE user_id = @user_id', 1, 0, 0
FROM achievement_categories WHERE name = 'Seller'

INSERT INTO achievements (category_id, subcategory, name, description, points, tier, requirement_type, requirement_value, requirement_query, is_active, is_secret, is_repeatable)
SELECT category_id, 'Supply Management', 'First Supply Purchase', 'Record your first supply batch purchase', 10, 'Common', 'count', 1,
 'SELECT COUNT(*) FROM supply_batch WHERE user_id = @user_id', 1, 0, 0
FROM achievement_categories WHERE name = 'Seller'

INSERT INTO achievements (category_id, subcategory, name, description, points, tier, requirement_type, requirement_value, requirement_query, is_active, is_secret, is_repeatable)
SELECT category_id, 'Supply Management', 'Stocked Up', 'Purchase 10 supply batches', 30, 'Uncommon', 'count', 10,
 'SELECT COUNT(*) FROM supply_batch WHERE user_id = @user_id', 1, 0, 0
FROM achievement_categories WHERE name = 'Seller'

INSERT INTO achievements (category_id, subcategory, name, description, points, tier, requirement_type, requirement_value, requirement_query, is_active, is_secret, is_repeatable)
SELECT category_id, 'Supply Management', 'Well Supplied', 'Purchase 25 supply batches', 60, 'Rare', 'count', 25,
 'SELECT COUNT(*) FROM supply_batch WHERE user_id = @user_id', 1, 0, 0
FROM achievement_categories WHERE name = 'Seller'

INSERT INTO achievements (category_id, subcategory, name, description, points, tier, requirement_type, requirement_value, requirement_query, is_active, is_secret, is_repeatable)
SELECT category_id, 'Supply Management', 'Supply Chain Pro', 'Purchase 50 supply batches', 100, 'Epic', 'count', 50,
 'SELECT COUNT(*) FROM supply_batch WHERE user_id = @user_id', 1, 0, 0
FROM achievement_categories WHERE name = 'Seller'

INSERT INTO achievements (category_id, subcategory, name, description, points, tier, requirement_type, requirement_value, requirement_query, is_active, is_secret, is_repeatable)
SELECT category_id, 'Supply Management', 'Cost Tracker', 'Track $100 in supply costs', 25, 'Uncommon', 'value', 100,
 'SELECT COALESCE(SUM(total_cost), 0) FROM supply_batch WHERE user_id = @user_id', 1, 0, 0
FROM achievement_categories WHERE name = 'Seller'

INSERT INTO achievements (category_id, subcategory, name, description, points, tier, requirement_type, requirement_value, requirement_query, is_active, is_secret, is_repeatable)
SELECT category_id, 'Supply Management', 'Supply Master', 'Track $500 in supply costs', 60, 'Rare', 'value', 500,
 'SELECT COALESCE(SUM(total_cost), 0) FROM supply_batch WHERE user_id = @user_id', 1, 0, 0
FROM achievement_categories WHERE name = 'Seller'

-- ============================================================================
-- SPECIAL CARD SALES (12 achievements)
-- ============================================================================

INSERT INTO achievements (category_id, subcategory, name, description, points, tier, requirement_type, requirement_value, requirement_query, is_active, is_secret, is_repeatable)
SELECT category_id, 'Special Card Sales', 'Rookie Seller', 'Sell your first rookie card', 15, 'Common', 'count', 1,
 'SELECT COUNT(*) FROM sale s JOIN card c ON s.card_id = c.card_id WHERE s.user_id = @user_id AND s.status = ''sold'' AND c.is_rookie = 1', 1, 0, 0
FROM achievement_categories WHERE name = 'Seller'

INSERT INTO achievements (category_id, subcategory, name, description, points, tier, requirement_type, requirement_value, requirement_query, is_active, is_secret, is_repeatable)
SELECT category_id, 'Special Card Sales', 'Rookie Dealer', 'Sell 10 rookie cards', 35, 'Uncommon', 'count', 10,
 'SELECT COUNT(*) FROM sale s JOIN card c ON s.card_id = c.card_id WHERE s.user_id = @user_id AND s.status = ''sold'' AND c.is_rookie = 1', 1, 0, 0
FROM achievement_categories WHERE name = 'Seller'

INSERT INTO achievements (category_id, subcategory, name, description, points, tier, requirement_type, requirement_value, requirement_query, is_active, is_secret, is_repeatable)
SELECT category_id, 'Special Card Sales', 'Rookie Specialist', 'Sell 50 rookie cards', 75, 'Rare', 'count', 50,
 'SELECT COUNT(*) FROM sale s JOIN card c ON s.card_id = c.card_id WHERE s.user_id = @user_id AND s.status = ''sold'' AND c.is_rookie = 1', 1, 0, 0
FROM achievement_categories WHERE name = 'Seller'

INSERT INTO achievements (category_id, subcategory, name, description, points, tier, requirement_type, requirement_value, requirement_query, is_active, is_secret, is_repeatable)
SELECT category_id, 'Special Card Sales', 'Auto Seller', 'Sell your first autograph card', 15, 'Common', 'count', 1,
 'SELECT COUNT(*) FROM sale s JOIN card c ON s.card_id = c.card_id WHERE s.user_id = @user_id AND s.status = ''sold'' AND c.is_autograph = 1', 1, 0, 0
FROM achievement_categories WHERE name = 'Seller'

INSERT INTO achievements (category_id, subcategory, name, description, points, tier, requirement_type, requirement_value, requirement_query, is_active, is_secret, is_repeatable)
SELECT category_id, 'Special Card Sales', 'Auto Dealer', 'Sell 10 autograph cards', 40, 'Uncommon', 'count', 10,
 'SELECT COUNT(*) FROM sale s JOIN card c ON s.card_id = c.card_id WHERE s.user_id = @user_id AND s.status = ''sold'' AND c.is_autograph = 1', 1, 0, 0
FROM achievement_categories WHERE name = 'Seller'

INSERT INTO achievements (category_id, subcategory, name, description, points, tier, requirement_type, requirement_value, requirement_query, is_active, is_secret, is_repeatable)
SELECT category_id, 'Special Card Sales', 'Auto Specialist', 'Sell 50 autograph cards', 100, 'Rare', 'count', 50,
 'SELECT COUNT(*) FROM sale s JOIN card c ON s.card_id = c.card_id WHERE s.user_id = @user_id AND s.status = ''sold'' AND c.is_autograph = 1', 1, 0, 0
FROM achievement_categories WHERE name = 'Seller'

INSERT INTO achievements (category_id, subcategory, name, description, points, tier, requirement_type, requirement_value, requirement_query, is_active, is_secret, is_repeatable)
SELECT category_id, 'Special Card Sales', 'Relic Seller', 'Sell your first relic/memorabilia card', 15, 'Common', 'count', 1,
 'SELECT COUNT(*) FROM sale s JOIN card c ON s.card_id = c.card_id WHERE s.user_id = @user_id AND s.status = ''sold'' AND c.is_relic = 1', 1, 0, 0
FROM achievement_categories WHERE name = 'Seller'

INSERT INTO achievements (category_id, subcategory, name, description, points, tier, requirement_type, requirement_value, requirement_query, is_active, is_secret, is_repeatable)
SELECT category_id, 'Special Card Sales', 'Relic Dealer', 'Sell 10 relic cards', 40, 'Uncommon', 'count', 10,
 'SELECT COUNT(*) FROM sale s JOIN card c ON s.card_id = c.card_id WHERE s.user_id = @user_id AND s.status = ''sold'' AND c.is_relic = 1', 1, 0, 0
FROM achievement_categories WHERE name = 'Seller'

INSERT INTO achievements (category_id, subcategory, name, description, points, tier, requirement_type, requirement_value, requirement_query, is_active, is_secret, is_repeatable)
SELECT category_id, 'Special Card Sales', 'Relic Specialist', 'Sell 50 relic cards', 100, 'Rare', 'count', 50,
 'SELECT COUNT(*) FROM sale s JOIN card c ON s.card_id = c.card_id WHERE s.user_id = @user_id AND s.status = ''sold'' AND c.is_relic = 1', 1, 0, 0
FROM achievement_categories WHERE name = 'Seller'

INSERT INTO achievements (category_id, subcategory, name, description, points, tier, requirement_type, requirement_value, requirement_query, is_active, is_secret, is_repeatable)
SELECT category_id, 'Special Card Sales', 'Numbered Seller', 'Sell a serial numbered card', 20, 'Common', 'count', 1,
 'SELECT COUNT(*) FROM sale s JOIN card c ON s.card_id = c.card_id WHERE s.user_id = @user_id AND s.status = ''sold'' AND c.print_run IS NOT NULL AND c.print_run > 0', 1, 0, 0
FROM achievement_categories WHERE name = 'Seller'

INSERT INTO achievements (category_id, subcategory, name, description, points, tier, requirement_type, requirement_value, requirement_query, is_active, is_secret, is_repeatable)
SELECT category_id, 'Special Card Sales', 'Numbered Dealer', 'Sell 25 serial numbered cards', 75, 'Rare', 'count', 25,
 'SELECT COUNT(*) FROM sale s JOIN card c ON s.card_id = c.card_id WHERE s.user_id = @user_id AND s.status = ''sold'' AND c.print_run IS NOT NULL AND c.print_run > 0', 1, 0, 0
FROM achievement_categories WHERE name = 'Seller'

INSERT INTO achievements (category_id, subcategory, name, description, points, tier, requirement_type, requirement_value, requirement_query, is_active, is_secret, is_repeatable)
SELECT category_id, 'Special Card Sales', 'Low Number Seller', 'Sell a card numbered /25 or less', 100, 'Epic', 'count', 1,
 'SELECT COUNT(*) FROM sale s JOIN card c ON s.card_id = c.card_id WHERE s.user_id = @user_id AND s.status = ''sold'' AND c.print_run IS NOT NULL AND c.print_run <= 25', 1, 0, 0
FROM achievement_categories WHERE name = 'Seller'

-- ============================================================================
-- BULK SALES (6 achievements)
-- ============================================================================

INSERT INTO achievements (category_id, subcategory, name, description, points, tier, requirement_type, requirement_value, requirement_query, is_active, is_secret, is_repeatable)
SELECT category_id, 'Bulk Sales', 'First Bulk Sale', 'Create your first bulk sale', 10, 'Common', 'count', 1,
 'SELECT COUNT(*) FROM sale WHERE user_id = @user_id AND bulk_description IS NOT NULL', 1, 0, 0
FROM achievement_categories WHERE name = 'Seller'

INSERT INTO achievements (category_id, subcategory, name, description, points, tier, requirement_type, requirement_value, requirement_query, is_active, is_secret, is_repeatable)
SELECT category_id, 'Bulk Sales', 'Bulk Seller', 'Create 10 bulk sales', 30, 'Uncommon', 'count', 10,
 'SELECT COUNT(*) FROM sale WHERE user_id = @user_id AND bulk_description IS NOT NULL', 1, 0, 0
FROM achievement_categories WHERE name = 'Seller'

INSERT INTO achievements (category_id, subcategory, name, description, points, tier, requirement_type, requirement_value, requirement_query, is_active, is_secret, is_repeatable)
SELECT category_id, 'Bulk Sales', 'Bulk Pro', 'Create 25 bulk sales', 60, 'Rare', 'count', 25,
 'SELECT COUNT(*) FROM sale WHERE user_id = @user_id AND bulk_description IS NOT NULL', 1, 0, 0
FROM achievement_categories WHERE name = 'Seller'

INSERT INTO achievements (category_id, subcategory, name, description, points, tier, requirement_type, requirement_value, requirement_query, is_active, is_secret, is_repeatable)
SELECT category_id, 'Bulk Sales', 'Bulk Master', 'Create 50 bulk sales', 100, 'Epic', 'count', 50,
 'SELECT COUNT(*) FROM sale WHERE user_id = @user_id AND bulk_description IS NOT NULL', 1, 0, 0
FROM achievement_categories WHERE name = 'Seller'

INSERT INTO achievements (category_id, subcategory, name, description, points, tier, requirement_type, requirement_value, requirement_query, is_active, is_secret, is_repeatable)
SELECT category_id, 'Bulk Sales', 'Lot Seller', 'Sell a bulk lot of 100+ cards', 75, 'Rare', 'count', 1,
 'SELECT COUNT(*) FROM sale WHERE user_id = @user_id AND status = ''sold'' AND bulk_card_count >= 100', 1, 0, 0
FROM achievement_categories WHERE name = 'Seller'

INSERT INTO achievements (category_id, subcategory, name, description, points, tier, requirement_type, requirement_value, requirement_query, is_active, is_secret, is_repeatable)
SELECT category_id, 'Bulk Sales', 'Mega Lot', 'Sell a bulk lot of 500+ cards', 150, 'Epic', 'count', 1,
 'SELECT COUNT(*) FROM sale WHERE user_id = @user_id AND status = ''sold'' AND bulk_card_count >= 500', 1, 0, 0
FROM achievement_categories WHERE name = 'Seller'

-- ============================================================================
-- SUMMARY
-- ============================================================================
PRINT '============================================'
PRINT 'Seller Achievements Insert Complete!'
PRINT '============================================'

SELECT 'Total Seller Achievements' as Category, COUNT(*) as Count
FROM achievements a
JOIN achievement_categories c ON a.category_id = c.category_id
WHERE c.name = 'Seller'
UNION ALL
SELECT subcategory as Category, COUNT(*) as Count
FROM achievements a
JOIN achievement_categories c ON a.category_id = c.category_id
WHERE c.name = 'Seller'
GROUP BY subcategory
ORDER BY Category
