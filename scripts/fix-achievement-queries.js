#!/usr/bin/env node

/**
 * Achievement Requirement Query Fixer
 * Replaces generic/placeholder queries with specific, targeted SQL queries
 * Based on achievement subcategory and requirement type
 */

const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

// Specific requirement queries by subcategory
const REQUIREMENT_QUERIES = {
  // Card Count Achievements
  'Card Count': 'SELECT COUNT(*) FROM user_card WHERE [user] = @user_id',
  
  // Card Types - Rookies
  'Rookie Cards': `
    SELECT COUNT(*) 
    FROM user_card uc 
    INNER JOIN card c ON uc.card = c.card_id 
    WHERE uc.[user] = @user_id AND c.is_rookie = 1
  `,
  
  // Card Types - Autographs  
  'Autograph Cards': `
    SELECT COUNT(*) 
    FROM user_card uc 
    INNER JOIN card c ON uc.card = c.card_id 
    WHERE uc.[user] = @user_id AND c.is_autograph = 1
  `,
  
  // Card Types - Relics
  'Relic Cards': `
    SELECT COUNT(*) 
    FROM user_card uc 
    INNER JOIN card c ON uc.card = c.card_id 
    WHERE uc.[user] = @user_id AND c.is_relic = 1
  `,
  
  // Serial Numbered Cards
  'Serial Numbers': `
    SELECT COUNT(*) 
    FROM user_card 
    WHERE [user] = @user_id AND serial_number IS NOT NULL
  `,
  
  // Low Serial Numbers (under 100)
  'Low Serial Numbers': `
    SELECT COUNT(*) 
    FROM user_card 
    WHERE [user] = @user_id AND serial_number IS NOT NULL AND serial_number <= 100
  `,
  
  // Graded Cards
  'Graded Cards': `
    SELECT COUNT(*) 
    FROM user_card 
    WHERE [user] = @user_id AND grading_agency IS NOT NULL
  `,
  
  // Perfect Grade (10)
  'Perfect Grades': `
    SELECT COUNT(*) 
    FROM user_card 
    WHERE [user] = @user_id AND grade = 10
  `,
  
  // Collection Value
  'Collection Value': `
    SELECT ISNULL(SUM(CAST(ISNULL(uc.current_value, uc.estimated_value) AS DECIMAL(18,2))), 0) 
    FROM user_card uc 
    WHERE uc.[user] = @user_id
  `,
  
  // High Value Cards ($100+)
  'High Value Cards': `
    SELECT COUNT(*) 
    FROM user_card 
    WHERE [user] = @user_id 
      AND (ISNULL(current_value, estimated_value) >= 100)
  `,
  
  // Unique Players
  'Unique Players': `
    SELECT COUNT(DISTINCT pt.player) 
    FROM user_card uc 
    INNER JOIN card c ON uc.card = c.card_id 
    INNER JOIN card_player_team cpt ON c.card_id = cpt.card 
    INNER JOIN player_team pt ON cpt.player_team = pt.player_team_id 
    WHERE uc.[user] = @user_id
  `,
  
  // Unique Teams
  'Unique Teams': `
    SELECT COUNT(DISTINCT pt.team) 
    FROM user_card uc 
    INNER JOIN card c ON uc.card = c.card_id 
    INNER JOIN card_player_team cpt ON c.card_id = cpt.card 
    INNER JOIN player_team pt ON cpt.player_team = pt.player_team_id 
    WHERE uc.[user] = @user_id
  `,
  
  // Unique Sets
  'Unique Sets': `
    SELECT COUNT(DISTINCT s.set) 
    FROM user_card uc 
    INNER JOIN card c ON uc.card = c.card_id 
    INNER JOIN series s ON c.series = s.series_id 
    WHERE uc.[user] = @user_id
  `,
  
  // Unique Series
  'Unique Series': `
    SELECT COUNT(DISTINCT c.series) 
    FROM user_card uc 
    INNER JOIN card c ON uc.card = c.card_id 
    WHERE uc.[user] = @user_id
  `,
  
  // Comments
  'Comments': `
    SELECT COUNT(*) 
    FROM universal_comments 
    WHERE user_id = @user_id
  `,
  
  // Storage Locations
  'Organization': `
    SELECT COUNT(DISTINCT user_location) 
    FROM user_card 
    WHERE [user] = @user_id AND user_location IS NOT NULL
  `,
  
  // Photos
  'Photography': `
    SELECT COUNT(*) 
    FROM user_card_photo ucp 
    INNER JOIN user_card uc ON ucp.user_card = uc.user_card_id 
    WHERE uc.[user] = @user_id
  `,
  
  // Favorites
  'Favorites': `
    SELECT COUNT(*) 
    FROM user_card 
    WHERE [user] = @user_id AND is_special = 1
  `,
  
  // Vintage Cards (pre-1980)
  'Vintage Cards': `
    SELECT COUNT(*) 
    FROM user_card uc 
    INNER JOIN card c ON uc.card = c.card_id 
    INNER JOIN series s ON c.series = s.series_id 
    INNER JOIN [set] st ON s.set = st.set_id 
    WHERE uc.[user] = @user_id AND st.year < 1980
  `,
  
  // Modern Cards (2000+)
  'Modern Cards': `
    SELECT COUNT(*) 
    FROM user_card uc 
    INNER JOIN card c ON uc.card = c.card_id 
    INNER JOIN series s ON c.series = s.series_id 
    INNER JOIN [set] st ON s.set = st.set_id 
    WHERE uc.[user] = @user_id AND st.year >= 2000
  `,
  
  // Hall of Fame Players
  'Hall of Fame': `
    SELECT COUNT(*) 
    FROM user_card uc 
    INNER JOIN card c ON uc.card = c.card_id 
    INNER JOIN card_player_team cpt ON c.card_id = cpt.card 
    INNER JOIN player_team pt ON cpt.player_team = pt.player_team_id 
    INNER JOIN player p ON pt.player = p.player_id 
    WHERE uc.[user] = @user_id AND p.is_hof = 1
  `,
  
  // Sports-specific counts
  'Baseball Cards': `
    SELECT COUNT(*) 
    FROM user_card uc 
    INNER JOIN card c ON uc.card = c.card_id 
    INNER JOIN series s ON c.series = s.series_id 
    INNER JOIN [set] st ON s.set = st.set_id 
    WHERE uc.[user] = @user_id AND st.sport = 'Baseball'
  `,
  
  'Basketball Cards': `
    SELECT COUNT(*) 
    FROM user_card uc 
    INNER JOIN card c ON uc.card = c.card_id 
    INNER JOIN series s ON c.series = s.series_id 
    INNER JOIN [set] st ON s.set = st.set_id 
    WHERE uc.[user] = @user_id AND st.sport = 'Basketball'
  `,
  
  'Football Cards': `
    SELECT COUNT(*) 
    FROM user_card uc 
    INNER JOIN card c ON uc.card = c.card_id 
    INNER JOIN series s ON c.series = s.series_id 
    INNER JOIN [set] st ON s.set = st.set_id 
    WHERE uc.[user] = @user_id AND st.sport = 'Football'
  `,
  
  // Daily Login Streaks
  'Daily Visits': `
    SELECT ISNULL(MAX(longest_count), 0) 
    FROM user_streaks 
    WHERE user_id = @user_id AND streak_type = 'daily_login'
  `,
  
  // Collection Streaks (adding cards)
  'Collection Activity': `
    SELECT ISNULL(MAX(longest_count), 0) 
    FROM user_streaks 
    WHERE user_id = @user_id AND streak_type = 'collection_activity'
  `,
  
  // Social/Community
  'Community': `
    SELECT COUNT(*) 
    FROM universal_comments 
    WHERE user_id = @user_id
  `,
  
  // Early Platform Exploration (static - already earned)
  'Platform Engagement': 'SELECT 1 WHERE @user_id = 1', // Only admin user earned this
  
  // Default for unrecognized subcategories
  'DEFAULT': 'SELECT 0'
}

async function fixAchievementQueries() {
  try {
    console.log('🔧 Starting Achievement Query Fixer...\n')

    // Get all achievements with their current queries
    const achievements = await prisma.$queryRaw`
      SELECT 
        achievement_id,
        name,
        subcategory,
        requirement_type,
        requirement_value,
        requirement_query
      FROM achievements
      ORDER BY achievement_id
    `

    console.log(`📊 Found ${achievements.length} achievements to process\n`)

    let updatedCount = 0
    let errors = []

    for (const achievement of achievements) {
      try {
        const subcategory = achievement.subcategory?.trim()
        let newQuery = REQUIREMENT_QUERIES[subcategory]
        
        // Handle special cases based on achievement name patterns
        if (!newQuery) {
          if (achievement.name?.includes('Rookie')) {
            newQuery = REQUIREMENT_QUERIES['Rookie Cards']
          } else if (achievement.name?.includes('Autograph') || achievement.name?.includes('Signature')) {
            newQuery = REQUIREMENT_QUERIES['Autograph Cards']
          } else if (achievement.name?.includes('Relic') || achievement.name?.includes('Jersey')) {
            newQuery = REQUIREMENT_QUERIES['Relic Cards']
          } else if (achievement.name?.includes('Serial') || achievement.name?.includes('Number')) {
            newQuery = REQUIREMENT_QUERIES['Serial Numbers']
          } else if (achievement.name?.includes('Graded') || achievement.name?.includes('Grade')) {
            newQuery = REQUIREMENT_QUERIES['Graded Cards']
          } else if (achievement.name?.includes('Perfect') || achievement.name?.includes('Gem Mint')) {
            newQuery = REQUIREMENT_QUERIES['Perfect Grades']
          } else if (achievement.name?.includes('Value') || achievement.name?.includes('Dollar') || achievement.name?.includes('Million')) {
            newQuery = REQUIREMENT_QUERIES['Collection Value']
          } else if (achievement.name?.includes('Player')) {
            newQuery = REQUIREMENT_QUERIES['Unique Players']
          } else if (achievement.name?.includes('Team')) {
            newQuery = REQUIREMENT_QUERIES['Unique Teams']
          } else if (achievement.name?.includes('Set')) {
            newQuery = REQUIREMENT_QUERIES['Unique Sets']
          } else if (achievement.name?.includes('Series')) {
            newQuery = REQUIREMENT_QUERIES['Unique Series']
          } else if (achievement.name?.includes('Comment') || achievement.name?.includes('Discussion')) {
            newQuery = REQUIREMENT_QUERIES['Comments']
          } else if (achievement.name?.includes('Location') || achievement.name?.includes('Organized')) {
            newQuery = REQUIREMENT_QUERIES['Organization']
          } else if (achievement.name?.includes('Photo')) {
            newQuery = REQUIREMENT_QUERIES['Photography']
          } else if (achievement.name?.includes('Favorite') || achievement.name?.includes('Special')) {
            newQuery = REQUIREMENT_QUERIES['Favorites']
          } else if (achievement.name?.includes('Vintage')) {
            newQuery = REQUIREMENT_QUERIES['Vintage Cards']
          } else if (achievement.name?.includes('Modern')) {
            newQuery = REQUIREMENT_QUERIES['Modern Cards']
          } else if (achievement.name?.includes('Hall of Fame') || achievement.name?.includes('HOF')) {
            newQuery = REQUIREMENT_QUERIES['Hall of Fame']
          } else if (achievement.name?.includes('Baseball')) {
            newQuery = REQUIREMENT_QUERIES['Baseball Cards']
          } else if (achievement.name?.includes('Basketball')) {
            newQuery = REQUIREMENT_QUERIES['Basketball Cards']
          } else if (achievement.name?.includes('Football')) {
            newQuery = REQUIREMENT_QUERIES['Football Cards']
          } else if (achievement.name?.includes('Visit') || achievement.name?.includes('Daily') || achievement.name?.includes('Streak')) {
            newQuery = REQUIREMENT_QUERIES['Daily Visits']
          } else {
            // Default fallback based on requirement_type
            if (achievement.requirement_type === 'count' || achievement.requirement_type === 'total_cards') {
              newQuery = REQUIREMENT_QUERIES['Card Count']
            } else {
              newQuery = REQUIREMENT_QUERIES['DEFAULT']
            }
          }
        }

        // Only update if the query is different
        if (newQuery && newQuery.trim() !== achievement.requirement_query?.trim()) {
          await prisma.$executeRaw`
            UPDATE achievements 
            SET requirement_query = ${newQuery.trim()}
            WHERE achievement_id = ${achievement.achievement_id}
          `

          console.log(`✅ Updated #${Number(achievement.achievement_id)}: ${achievement.name}`)
          console.log(`   Subcategory: ${subcategory || 'None'}`)
          console.log(`   New Query: ${newQuery.trim().substring(0, 80)}...`)
          console.log('')
          
          updatedCount++
        }

      } catch (error) {
        errors.push({
          achievement_id: achievement.achievement_id,
          name: achievement.name,
          error: error.message
        })
        console.log(`❌ Error updating #${Number(achievement.achievement_id)}: ${achievement.name}`)
        console.log(`   Error: ${error.message}`)
      }
    }

    console.log('\n✅ Achievement Query Fix Complete!')
    console.log('=' * 50)
    console.log(`📊 Statistics:`)
    console.log(`   Total achievements: ${achievements.length}`)
    console.log(`   Successfully updated: ${updatedCount}`)
    console.log(`   Errors: ${errors.length}`)
    
    if (errors.length > 0) {
      console.log('\n❌ Errors encountered:')
      errors.forEach(err => {
        console.log(`   #${Number(err.achievement_id)}: ${err.name} - ${err.error}`)
      })
    }

    // Show sample of updated queries
    const sampleUpdated = await prisma.$queryRaw`
      SELECT TOP 5
        achievement_id,
        name,
        subcategory,
        requirement_query
      FROM achievements
      WHERE requirement_query != 'SELECT 0'
        AND requirement_query IS NOT NULL
      ORDER BY achievement_id
    `

    console.log('\n📋 Sample Updated Queries:')
    sampleUpdated.forEach(ach => {
      console.log(`   #${Number(ach.achievement_id)}: ${ach.name}`)
      console.log(`   Query: ${ach.requirement_query?.substring(0, 100)}...`)
      console.log('')
    })

  } catch (error) {
    console.error('❌ Fatal error during query fixing:', error)
  } finally {
    await prisma.$disconnect()
  }
}

// Run the fixer
async function main() {
  console.log('🏆 ACHIEVEMENT REQUIREMENT QUERY FIXER')
  console.log('=' * 50)
  console.log('This script will replace generic/placeholder queries with specific SQL')
  console.log('targeted to each achievement type and subcategory.\n')
  
  await fixAchievementQueries()
  
  console.log('\n💡 Next Steps:')
  console.log('1. Test achievement calculation with new queries')
  console.log('2. Run retroactive achievement processing for existing users')  
  console.log('3. Verify achievement progress tracking works correctly')
}

main().catch(console.error)