#!/usr/bin/env node

/**
 * Fix Remaining Generic Achievement Queries
 * Analyzes achievement names and assigns specific queries based on patterns
 */

const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

// More sophisticated query mapping based on achievement names
const getSpecificQuery = (achievement) => {
  const name = achievement.name.toLowerCase()
  const subcategory = achievement.subcategory || ''
  
  // Rookie-related achievements
  if (name.includes('rookie') || name.includes('draft')) {
    return `SELECT COUNT(*) 
      FROM user_card uc 
      INNER JOIN card c ON uc.card = c.card_id 
      WHERE uc.[user] = @user_id AND c.is_rookie = 1`
  }
  
  // Autograph/Signature achievements
  if (name.includes('autograph') || name.includes('signature') || name.includes('signing')) {
    return `SELECT COUNT(*) 
      FROM user_card uc 
      INNER JOIN card c ON uc.card = c.card_id 
      WHERE uc.[user] = @user_id AND c.is_autograph = 1`
  }
  
  // Relic/Jersey/Material achievements  
  if (name.includes('relic') || name.includes('jersey') || name.includes('material') || name.includes('fabric') || name.includes('memorabilia')) {
    return `SELECT COUNT(*) 
      FROM user_card uc 
      INNER JOIN card c ON uc.card = c.card_id 
      WHERE uc.[user] = @user_id AND c.is_relic = 1`
  }
  
  // Serial number achievements
  if (name.includes('serial') || name.includes('numbered') || name.includes('limited') || name.includes('print run') || 
      name.includes('one of') || name.includes('under ') || name.includes('low number')) {
    return `SELECT COUNT(*) 
      FROM user_card 
      WHERE [user] = @user_id AND serial_number IS NOT NULL`
  }
  
  // Graded card achievements
  if (name.includes('graded') || name.includes('grade') || name.includes('gem mint') || name.includes('perfect')) {
    if (name.includes('perfect') || name.includes('gem mint') || name.includes('10')) {
      return `SELECT COUNT(*) 
        FROM user_card 
        WHERE [user] = @user_id AND grade = 10`
    } else {
      return `SELECT COUNT(*) 
        FROM user_card 
        WHERE [user] = @user_id AND grading_agency IS NOT NULL`
    }
  }
  
  // Collection value achievements
  if (name.includes('dollar') || name.includes('value') || name.includes('million') || name.includes('grand') || 
      name.includes('benjamin') || name.includes('profit') || name.includes('investment')) {
    return `SELECT ISNULL(SUM(CAST(ISNULL(uc.current_value, uc.estimated_value) AS DECIMAL(18,2))), 0) 
      FROM user_card uc 
      WHERE uc.[user] = @user_id`
  }
  
  // Player-related achievements
  if (name.includes('player') && !name.includes('card')) {
    return `SELECT COUNT(DISTINCT pt.player) 
      FROM user_card uc 
      INNER JOIN card c ON uc.card = c.card_id 
      INNER JOIN card_player_team cpt ON c.card_id = cpt.card 
      INNER JOIN player_team pt ON cpt.player_team = pt.player_team_id 
      WHERE uc.[user] = @user_id`
  }
  
  // Team-related achievements
  if (name.includes('team') && !name.includes('card')) {
    return `SELECT COUNT(DISTINCT pt.team) 
      FROM user_card uc 
      INNER JOIN card c ON uc.card = c.card_id 
      INNER JOIN card_player_team cpt ON c.card_id = cpt.card 
      INNER JOIN player_team pt ON cpt.player_team = pt.player_team_id 
      WHERE uc.[user] = @user_id`
  }
  
  // Series achievements
  if (name.includes('series')) {
    return `SELECT COUNT(DISTINCT c.series) 
      FROM user_card uc 
      INNER JOIN card c ON uc.card = c.card_id 
      WHERE uc.[user] = @user_id`
  }
  
  // Set achievements
  if (name.includes('set') && !name.includes('card')) {
    return `SELECT COUNT(DISTINCT s.set) 
      FROM user_card uc 
      INNER JOIN card c ON uc.card = c.card_id 
      INNER JOIN series s ON c.series = s.series_id 
      WHERE uc.[user] = @user_id`
  }
  
  // Hall of Fame achievements
  if (name.includes('hof') || name.includes('hall of fame')) {
    return `SELECT COUNT(*) 
      FROM user_card uc 
      INNER JOIN card c ON uc.card = c.card_id 
      INNER JOIN card_player_team cpt ON c.card_id = cpt.card 
      INNER JOIN player_team pt ON cpt.player_team = pt.player_team_id 
      INNER JOIN player p ON pt.player = p.player_id 
      WHERE uc.[user] = @user_id AND p.is_hof = 1`
  }
  
  // Vintage achievements (pre-1980)
  if (name.includes('vintage') || name.includes('classic') || name.includes('pre-war') || 
      name.includes('50s') || name.includes('60s') || name.includes('70s')) {
    return `SELECT COUNT(*) 
      FROM user_card uc 
      INNER JOIN card c ON uc.card = c.card_id 
      INNER JOIN series s ON c.series = s.series_id 
      INNER JOIN [set] st ON s.set = st.set_id 
      WHERE uc.[user] = @user_id AND st.year < 1980`
  }
  
  // Modern achievements (2000+)
  if (name.includes('modern') || name.includes('2020s') || name.includes('2010s') || name.includes('2000s') || 
      name.includes('millennium') || name.includes('current year')) {
    return `SELECT COUNT(*) 
      FROM user_card uc 
      INNER JOIN card c ON uc.card = c.card_id 
      INNER JOIN series s ON c.series = s.series_id 
      INNER JOIN [set] st ON s.set = st.set_id 
      WHERE uc.[user] = @user_id AND st.year >= 2000`
  }
  
  // Decade-specific achievements
  if (name.includes('80s') || name.includes('eighties')) {
    return `SELECT COUNT(*) 
      FROM user_card uc 
      INNER JOIN card c ON uc.card = c.card_id 
      INNER JOIN series s ON c.series = s.series_id 
      INNER JOIN [set] st ON s.set = st.set_id 
      WHERE uc.[user] = @user_id AND st.year BETWEEN 1980 AND 1989`
  }
  
  if (name.includes('90s') || name.includes('nineties')) {
    return `SELECT COUNT(*) 
      FROM user_card uc 
      INNER JOIN card c ON uc.card = c.card_id 
      INNER JOIN series s ON c.series = s.series_id 
      INNER JOIN [set] st ON s.set = st.set_id 
      WHERE uc.[user] = @user_id AND st.year BETWEEN 1990 AND 1999`
  }
  
  // Manufacturer achievements
  if (name.includes('topps')) {
    return `SELECT COUNT(*) 
      FROM user_card uc 
      INNER JOIN card c ON uc.card = c.card_id 
      INNER JOIN series s ON c.series = s.series_id 
      INNER JOIN [set] st ON s.set = st.set_id 
      WHERE uc.[user] = @user_id AND st.manufacturer LIKE '%Topps%'`
  }
  
  if (name.includes('panini')) {
    return `SELECT COUNT(*) 
      FROM user_card uc 
      INNER JOIN card c ON uc.card = c.card_id 
      INNER JOIN series s ON c.series = s.series_id 
      INNER JOIN [set] st ON s.set = st.set_id 
      WHERE uc.[user] = @user_id AND st.manufacturer LIKE '%Panini%'`
  }
  
  if (name.includes('upper deck')) {
    return `SELECT COUNT(*) 
      FROM user_card uc 
      INNER JOIN card c ON uc.card = c.card_id 
      INNER JOIN series s ON c.series = s.series_id 
      INNER JOIN [set] st ON s.set = st.set_id 
      WHERE uc.[user] = @user_id AND st.manufacturer LIKE '%Upper Deck%'`
  }
  
  // Sport-specific achievements
  if (name.includes('baseball')) {
    return `SELECT COUNT(*) 
      FROM user_card uc 
      INNER JOIN card c ON uc.card = c.card_id 
      INNER JOIN series s ON c.series = s.series_id 
      INNER JOIN [set] st ON s.set = st.set_id 
      WHERE uc.[user] = @user_id AND st.sport = 'Baseball'`
  }
  
  if (name.includes('basketball')) {
    return `SELECT COUNT(*) 
      FROM user_card uc 
      INNER JOIN card c ON uc.card = c.card_id 
      INNER JOIN series s ON c.series = s.series_id 
      INNER JOIN [set] st ON s.set = st.set_id 
      WHERE uc.[user] = @user_id AND st.sport = 'Basketball'`
  }
  
  if (name.includes('football')) {
    return `SELECT COUNT(*) 
      FROM user_card uc 
      INNER JOIN card c ON uc.card = c.card_id 
      INNER JOIN series s ON c.series = s.series_id 
      INNER JOIN [set] st ON s.set = st.set_id 
      WHERE uc.[user] = @user_id AND st.sport = 'Football'`
  }
  
  // Insert/parallel achievements
  if (name.includes('insert') || name.includes('special')) {
    return `SELECT COUNT(*) 
      FROM user_card 
      WHERE [user] = @user_id AND is_special = 1`
  }
  
  // Color/parallel achievements
  if (name.includes('rainbow') || name.includes('gold') || name.includes('silver') || name.includes('black') || 
      name.includes('refractor') || name.includes('prizm') || name.includes('chrome')) {
    return `SELECT COUNT(*) 
      FROM user_card uc 
      INNER JOIN card c ON uc.card = c.card_id 
      WHERE uc.[user] = @user_id AND c.color IS NOT NULL`
  }
  
  // Photo/organization achievements
  if (name.includes('photo') || name.includes('picture') || name.includes('visual')) {
    return `SELECT COUNT(*) 
      FROM user_card_photo ucp 
      INNER JOIN user_card uc ON ucp.user_card = uc.user_card_id 
      WHERE uc.[user] = @user_id`
  }
  
  if (name.includes('organized') || name.includes('location')) {
    return `SELECT COUNT(DISTINCT user_location) 
      FROM user_card 
      WHERE [user] = @user_id AND user_location IS NOT NULL`
  }
  
  // Login/streak achievements
  if (name.includes('login') || name.includes('visit') || name.includes('daily') || 
      name.includes('streak') || name.includes('dedication') || subcategory.includes('Login')) {
    return `SELECT ISNULL(MAX(longest_count), 0) 
      FROM user_streaks 
      WHERE user_id = @user_id AND streak_type = 'daily_login'`
  }
  
  // Collection activity streaks
  if (name.includes('active') && (name.includes('week') || name.includes('month') || name.includes('collecting'))) {
    return `SELECT ISNULL(MAX(longest_count), 0) 
      FROM user_streaks 
      WHERE user_id = @user_id AND streak_type = 'collection_activity'`
  }
  
  // Social/early adopter achievements - these should return static values or user-specific checks
  if (subcategory.includes('Social Pioneer') || subcategory.includes('Contributor') || 
      subcategory.includes('Technical') || name.includes('founder') || name.includes('beta') || 
      name.includes('charter') || name.includes('original')) {
    // These are historical achievements - only admin user should have them
    return `SELECT CASE WHEN @user_id = 1 THEN 1 ELSE 0 END`
  }
  
  // Default: if it's truly a card count achievement, keep the basic query
  if (subcategory === 'Card Count' || name.includes('thousand') || name.includes('k ') || 
      name.includes('club') || name.includes('elite') || name.includes('legend') || 
      name.includes('master') || name.includes('titan') || name.includes('god')) {
    return 'SELECT COUNT(*) FROM user_card WHERE [user] = @user_id'
  }
  
  // For unclassified achievements, default to card count
  console.log(`⚠️  Unclassified achievement: ${achievement.name} - using card count`)
  return 'SELECT COUNT(*) FROM user_card WHERE [user] = @user_id'
}

async function fixRemainingGenericQueries() {
  try {
    console.log('🔧 Fixing Remaining Generic Achievement Queries')
    console.log('=' * 50)
    
    // Get all achievements still using the generic query
    const genericAchievements = await prisma.$queryRaw`
      SELECT 
        achievement_id,
        name,
        subcategory,
        requirement_type,
        requirement_value,
        requirement_query
      FROM achievements 
      WHERE requirement_query = 'SELECT COUNT(*) FROM user_card WHERE [user] = @user_id'
      ORDER BY achievement_id
    `
    
    console.log(`\n📊 Found ${genericAchievements.length} achievements to fix\n`)
    
    let updatedCount = 0
    let errors = []
    
    for (const achievement of genericAchievements) {
      try {
        const newQuery = getSpecificQuery(achievement)
        
        // Only update if the query is different
        if (newQuery.trim() !== achievement.requirement_query.trim()) {
          await prisma.$executeRaw`
            UPDATE achievements 
            SET requirement_query = ${newQuery.trim()}
            WHERE achievement_id = ${achievement.achievement_id}
          `
          
          console.log(`✅ Updated #${Number(achievement.achievement_id)}: ${achievement.name}`)
          console.log(`   New Query Type: ${getQueryType(newQuery)}`)
          updatedCount++
        } else {
          console.log(`⏭️  Kept #${Number(achievement.achievement_id)}: ${achievement.name} (card count)`)
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
    
    console.log('\n' + '=' * 50)
    console.log('📊 FINAL RESULTS')
    console.log('=' * 50)
    console.log(`Total processed: ${genericAchievements.length}`)
    console.log(`Successfully updated: ${updatedCount}`)
    console.log(`Errors: ${errors.length}`)
    console.log(`Kept as card count: ${genericAchievements.length - updatedCount - errors.length}`)
    
    if (errors.length > 0) {
      console.log('\n❌ Errors:')
      errors.forEach(err => {
        console.log(`   #${Number(err.achievement_id)}: ${err.name} - ${err.error}`)
      })
    }
    
    // Final verification
    const remainingGeneric = await prisma.$queryRaw`
      SELECT COUNT(*) as count
      FROM achievements 
      WHERE requirement_query = 'SELECT COUNT(*) FROM user_card WHERE [user] = @user_id'
    `
    
    console.log(`\n🎯 Remaining generic queries: ${Number(remainingGeneric[0].count)}`)
    
  } catch (error) {
    console.error('❌ Fatal error:', error)
  } finally {
    await prisma.$disconnect()
  }
}

function getQueryType(query) {
  if (query.includes('is_rookie = 1')) return 'Rookie Cards'
  if (query.includes('is_autograph = 1')) return 'Autograph Cards'
  if (query.includes('is_relic = 1')) return 'Relic Cards'
  if (query.includes('serial_number IS NOT NULL')) return 'Serial Numbers'
  if (query.includes('grading_agency IS NOT NULL')) return 'Graded Cards'
  if (query.includes('grade = 10')) return 'Perfect Grades'
  if (query.includes('COUNT(DISTINCT pt.player)')) return 'Unique Players'
  if (query.includes('COUNT(DISTINCT pt.team)')) return 'Unique Teams'
  if (query.includes('SUM')) return 'Collection Value'
  if (query.includes('streak')) return 'User Streaks'
  if (query.includes('st.sport')) return 'Sport-Specific'
  if (query.includes('st.year')) return 'Year-Specific'
  if (query.includes('st.manufacturer')) return 'Manufacturer-Specific'
  if (query.includes('CASE WHEN')) return 'Conditional/Historical'
  return 'Basic Card Count'
}

// Run the fix
fixRemainingGenericQueries().catch(console.error)