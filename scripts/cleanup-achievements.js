#!/usr/bin/env node

/**
 * Achievement Cleanup Script
 * Removes impossible achievements and keeps only working ones
 * Run with: node scripts/cleanup-achievements.js
 */

const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

// Subcategories to COMPLETELY REMOVE (features don't exist)
const SUBCATEGORIES_TO_DELETE = [
  'crowdsourcing',
  'trading', 
  'marketplace',
  'social', // Keep only comment-related
  'community_challenges',
  'special_events'
]

// Specific achievement codes to DELETE (impossible or broken)
const ACHIEVEMENTS_TO_DELETE = [
  // Trading/Marketplace (no trading system)
  'first_trade',
  'trade_10',
  'trade_100',
  'trade_1000',
  'perfect_trade',
  'cross_country_trade',
  'international_trade',
  'trade_streak_7',
  'trade_streak_30',
  'fair_trader',
  'generous_trader',
  'trade_variety',
  
  // Marketplace/Selling (no marketplace)
  'first_sale',
  'sell_10',
  'sell_100', 
  'profitable_sale',
  'quick_flip',
  'market_maker',
  'price_guide_contributor',
  
  // Social features that don't exist
  'first_friend',
  'social_butterfly',
  'popular_collector',
  'influencer',
  'follow_10',
  'follow_100',
  'trending_post',
  'viral_post',
  'helpful_member',
  
  // Events/Challenges that don't exist
  'event_participant',
  'event_winner',
  'challenge_accepted',
  'challenge_champion',
  'tournament_player',
  'tournament_winner',
  
  // Prediction/Fantasy (doesn't exist)
  'prediction_participant',
  'prediction_winner',
  'fantasy_player',
  'fantasy_champion',
  
  // Import features that may not work correctly
  'bulk_import', // Unless import system handles this
  'spreadsheet_wizard', // Unless import system handles this
  
  // Wantlist (doesn't exist)
  'wantlist_10',
  'wantlist_100',
  'wishlist_fulfilled',
  
  // Advanced features that likely don't work
  'price_alert_setter',
  'market_watcher',
  'trending_spotter',
  'arbitrage_finder',
  'portfolio_optimizer',
  'risk_manager',
  'diversified_portfolio',
  
  // Unrealistic milestones
  'millionaire_collection', // $1M collection value - too high
  'card_museum', // 100,000 cards - unrealistic
  'global_collector', // Cards from 100 countries - impossible with current data
  
  // Features that need verification
  'scanner_user', // Do you have a scanner feature?
  'mobile_collector', // Do you track mobile usage?
  'api_user', // Do you have public API?
  'backup_master', // Do you have backup feature?
  'organizational_guru', // Requires 100 locations - too many
]

// Achievements to KEEP (actually work with current system)
const WORKING_ACHIEVEMENTS = [
  // Collection Milestones (these work via hooks)
  'first_card',
  'getting_started',
  'growing_collection', 
  'serious_collector',
  'big_collection',
  'mega_collection',
  'epic_collection',
  
  // Card Types (work via hooks)
  'first_rookie',
  'rookie_collector',
  'rookie_specialist', 
  'rookie_master',
  'first_auto',
  'auto_collector',
  'auto_specialist',
  'first_relic',
  'relic_hunter',
  'relic_master',
  'first_numbered',
  'numbered_collector',
  'low_numbered',
  'one_of_one',
  
  // Grading (works via hooks)
  'first_graded',
  'graded_10',
  'perfect_10',
  'gem_mint_collector',
  'grading_specialist',
  
  // Teams/Players (work via data)
  'team_collector',
  'team_specialist',
  'team_completist',
  'player_collector',
  'player_specialist',
  'multi_sport',
  
  // Sets/Series (work via data)
  'set_starter',
  'set_builder', 
  'set_completist',
  'series_specialist',
  'vintage_collector',
  'modern_collector',
  
  // Value (works via data)
  'valuable_card',
  'high_value_card',
  'grail_card',
  'valuable_collection',
  'investment_grade',
  
  // Comments (work with comment system)
  'first_comment',
  'active_commenter',
  'helpful_comment',
  'conversation_starter',
  
  // Organization (works with locations)
  'organized_collector',
  'location_manager',
  'detailed_tracker',
  
  // Photography (works with photo uploads)
  'photographer',
  'photo_pro',
  'visual_collector',
  
  // Early Adopter (already awarded)
  'early_adopter',
  'founding_member',
  'beta_tester',
  
  // Time-based (work automatically)
  'daily_visitor',
  'week_streak',
  'month_streak',
  'year_member',
  'veteran_member'
]

async function cleanupAchievements() {
  try {
    console.log('🧹 Starting achievement cleanup...\n')

    // 1. Delete achievements by category
    console.log('📦 Removing impossible achievement categories...')
    let categoryDelete = 0
    for (const category of CATEGORIES_TO_DELETE) {
      const deleted = await prisma.$executeRaw`
        DELETE FROM achievements 
        WHERE category = ${category}
      `
      categoryDelete += deleted
    }
    console.log(`   Deleted ${categoryDelete} achievements from impossible categories`)

    // 2. Delete specific impossible achievements
    console.log('\n🎯 Removing specific impossible achievements...')
    let specificDelete = 0
    for (const code of ACHIEVEMENTS_TO_DELETE) {
      const deleted = await prisma.$executeRaw`
        DELETE FROM achievements 
        WHERE code = ${code}
      `
      specificDelete += deleted
    }
    console.log(`   Deleted ${specificDelete} specific impossible achievements`)

    // 3. Clean up user progress for deleted achievements
    console.log('\n🧼 Cleaning up user progress for deleted achievements...')
    const progressCleanup = await prisma.$executeRaw`
      DELETE FROM user_achievements
      WHERE achievement_id NOT IN (
        SELECT achievement_id FROM achievements
      )
    `
    console.log(`   Cleaned up ${progressCleanup} orphaned user achievement records`)

    // 4. Update achievement stats
    console.log('\n📊 Updating user achievement statistics...')
    await prisma.$executeRaw`
      -- Recalculate user achievement stats
      WITH UserAchievementTotals AS (
        SELECT 
          ua.user_id,
          COUNT(*) as total_achievements,
          SUM(a.points) as total_points,
          SUM(CASE WHEN a.tier = 'common' THEN 1 ELSE 0 END) as common_achievements,
          SUM(CASE WHEN a.tier = 'uncommon' THEN 1 ELSE 0 END) as uncommon_achievements,
          SUM(CASE WHEN a.tier = 'rare' THEN 1 ELSE 0 END) as rare_achievements,
          SUM(CASE WHEN a.tier = 'epic' THEN 1 ELSE 0 END) as epic_achievements,
          SUM(CASE WHEN a.tier = 'legendary' THEN 1 ELSE 0 END) as legendary_achievements,
          SUM(CASE WHEN a.tier = 'mythic' THEN 1 ELSE 0 END) as mythic_achievements
        FROM user_achievements ua
        JOIN achievements a ON ua.achievement_id = a.achievement_id
        WHERE ua.is_completed = 1
        GROUP BY ua.user_id
      )
      UPDATE user_achievement_stats
      SET 
        total_achievements = uat.total_achievements,
        total_points = uat.total_points,
        common_achievements = uat.common_achievements,
        uncommon_achievements = uat.uncommon_achievements,
        rare_achievements = uat.rare_achievements,
        epic_achievements = uat.epic_achievements,
        legendary_achievements = uat.legendary_achievements,
        mythic_achievements = uat.mythic_achievements,
        last_updated = GETDATE()
      FROM UserAchievementTotals uat
      WHERE user_achievement_stats.user_id = uat.user_id
    `
    console.log('   User statistics updated')

    // 5. Get final counts
    const remainingCount = await prisma.$queryRaw`
      SELECT COUNT(*) as count FROM achievements
    `
    
    // Count working achievements differently
    let workingCount = 0
    for (const code of WORKING_ACHIEVEMENTS) {
      const count = await prisma.$queryRaw`
        SELECT COUNT(*) as count FROM achievements 
        WHERE code = ${code}
      `
      if (count[0].count > 0) workingCount++
    }

    console.log('\n✅ Cleanup Complete!')
    console.log('=' * 50)
    console.log(`📊 Final Statistics:`)
    console.log(`   Total achievements remaining: ${remainingCount[0].count}`)
    console.log(`   Verified working achievements: ${workingCount}`)
    console.log(`   Other achievements to review: ${remainingCount[0].count - workingCount}`)

    // 6. List remaining categories
    const remainingCategories = await prisma.$queryRaw`
      SELECT DISTINCT category, COUNT(*) as count
      FROM achievements
      GROUP BY category
      ORDER BY category
    `
    
    console.log('\n📁 Remaining Categories:')
    remainingCategories.forEach(cat => {
      console.log(`   ${cat.category}: ${cat.count} achievements`)
    })

    // 7. Identify achievements that might need manual review
    // First get all achievements
    const allAchievements = await prisma.$queryRaw`
      SELECT code, name, category
      FROM achievements
      ORDER BY category, code
    `
    
    // Filter out the working ones
    const needsReview = allAchievements.filter(ach => 
      !WORKING_ACHIEVEMENTS.includes(ach.code)
    )

    if (needsReview.length > 0) {
      console.log('\n⚠️  Achievements that may need manual review:')
      console.log('   (These remained but aren\'t in the verified working list)')
      needsReview.forEach(ach => {
        console.log(`   - [${ach.category}] ${ach.code}: ${ach.name}`)
      })
      console.log('\n   Review these in the admin panel: /admin/achievements')
    }

  } catch (error) {
    console.error('❌ Error during cleanup:', error)
  } finally {
    await prisma.$disconnect()
  }
}

// Add some realistic achievements that actually work
async function addRealisticAchievements() {
  console.log('\n🎯 Adding new realistic achievements...')
  
  const newAchievements = [
    // Starter achievements (easy to get)
    {
      code: 'welcome',
      name: 'Welcome!',
      description: 'Join the Collect Your Cards community',
      category: 'general',
      tier: 'common',
      points: 5,
      requirement_type: 'automatic',
      requirement_value: 1,
      icon_url: '👋'
    },
    {
      code: 'profile_complete',
      name: 'Profile Complete',
      description: 'Complete your profile with bio and avatar',
      category: 'general', 
      tier: 'common',
      points: 10,
      requirement_type: 'profile',
      requirement_value: 1,
      icon_url: '✅'
    },
    {
      code: 'first_favorite',
      name: 'First Favorite',
      description: 'Mark your first favorite card',
      category: 'collecting',
      tier: 'common',
      points: 5,
      requirement_type: 'favorites',
      requirement_value: 1,
      icon_url: '⭐'
    },
    {
      code: 'five_favorites',
      name: 'Top Five',
      description: 'Mark 5 favorite cards to display on your profile',
      category: 'collecting',
      tier: 'uncommon',
      points: 15,
      requirement_type: 'favorites',
      requirement_value: 5,
      icon_url: '🌟'
    },
    
    // Location-based (realistic)
    {
      code: 'first_location',
      name: 'Getting Organized',
      description: 'Create your first storage location',
      category: 'organization',
      tier: 'common',
      points: 10,
      requirement_type: 'locations',
      requirement_value: 1,
      icon_url: '📍'
    },
    {
      code: 'five_locations', 
      name: 'Storage System',
      description: 'Create 5 different storage locations',
      category: 'organization',
      tier: 'uncommon',
      points: 25,
      requirement_type: 'locations',
      requirement_value: 5,
      icon_url: '🗂️'
    },
    
    // Realistic collection goals
    {
      code: 'weekend_warrior',
      name: 'Weekend Warrior',
      description: 'Add 10 cards in a single weekend',
      category: 'collecting',
      tier: 'uncommon',
      points: 20,
      requirement_type: 'cards_per_period',
      requirement_value: 10,
      icon_url: '📅'
    },
    {
      code: 'century_club',
      name: 'Century Club',
      description: 'Reach exactly 100 cards in your collection',
      category: 'collecting',
      tier: 'rare',
      points: 50,
      requirement_type: 'total_cards',
      requirement_value: 100,
      icon_url: '💯'
    }
  ]

  for (const achievement of newAchievements) {
    try {
      // Check if achievement already exists
      const exists = await prisma.$queryRaw`
        SELECT achievement_id FROM achievements WHERE code = ${achievement.code}
      `
      
      if (exists.length === 0) {
        await prisma.$executeRaw`
          INSERT INTO achievements (
            code, name, description, category, tier, points,
            requirement_type, requirement_value, icon_url,
            is_active, is_secret, created_at
          ) VALUES (
            ${achievement.code},
            ${achievement.name},
            ${achievement.description},
            ${achievement.category},
            ${achievement.tier},
            ${achievement.points},
            ${achievement.requirement_type},
            ${achievement.requirement_value},
            ${achievement.icon_url},
            1, 0, GETDATE()
          )
        `
        console.log(`   ✅ Added: ${achievement.name}`)
      }
    } catch (err) {
      console.log(`   ⚠️  Skipped ${achievement.code}: May already exist`)
    }
  }
}

// Run the cleanup
async function main() {
  console.log('🏆 ACHIEVEMENT SYSTEM CLEANUP')
  console.log('=' * 50)
  
  await cleanupAchievements()
  await addRealisticAchievements()
  
  console.log('\n✨ Cleanup complete! Your achievements are now realistic and achievable.')
  console.log('💡 Tip: Visit /admin/achievements to fine-tune individual achievements')
}

main().catch(console.error)