/**
 * Retroactive Achievement Processing Script
 * 
 * This script processes all existing users and awards achievements
 * based on their current collection data.
 * 
 * Usage: node server/scripts/process-retroactive-achievements.js
 */

const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient({ log: ['error'] })

// Color codes for console output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  red: '\x1b[31m',
  cyan: '\x1b[36m'
}

async function processRetroactiveAchievements() {
  console.log(`${colors.bright}${colors.blue}🏆 Starting Retroactive Achievement Processing${colors.reset}`)
  console.log(`${colors.cyan}================================================${colors.reset}\n`)

  try {
    // Get all active users
    const users = await prisma.$queryRaw`
      SELECT user_id, email, first_name, last_name
      FROM [user]
      WHERE is_active = 1
      ORDER BY user_id
    `

    console.log(`${colors.green}✅ Found ${users.length} active users to process${colors.reset}\n`)

    // Get all active achievements
    const achievements = await prisma.$queryRaw`
      SELECT 
        achievement_id,
        name,
        requirement_type,
        requirement_value,
        requirement_query,
        points,
        tier
      FROM achievements
      WHERE is_active = 1
      ORDER BY achievement_id
    `

    console.log(`${colors.green}✅ Found ${achievements.length} active achievements to check${colors.reset}\n`)

    let totalAchievementsAwarded = 0
    let totalPointsAwarded = 0

    // Process each user
    for (const user of users) {
      const userId = Number(user.user_id)
      const userName = `${user.first_name || ''} ${user.last_name || ''}`.trim() || user.email
      
      console.log(`${colors.bright}Processing user: ${userName} (ID: ${userId})${colors.reset}`)
      
      let userAchievements = 0
      let userPoints = 0

      // Check each achievement for this user
      for (const achievement of achievements) {
        const achievementId = Number(achievement.achievement_id)
        
        try {
          // Check if user already has this achievement
          const existing = await prisma.$queryRaw`
            SELECT user_achievement_id 
            FROM user_achievements
            WHERE user_id = ${userId}
            AND achievement_id = ${achievementId}
            AND is_completed = 1
          `

          if (existing.length > 0) {
            continue // Skip if already earned
          }

          // Check if user qualifies for this achievement
          let qualifies = false
          let progress = 0

          switch (achievement.requirement_type) {
            case 'count':
              // Check total card count
              const cardCount = await prisma.$queryRaw`
                SELECT COUNT(*) as count
                FROM user_card
                WHERE [user] = ${userId}
              `
              progress = Number(cardCount[0].count)
              qualifies = progress >= achievement.requirement_value
              break

            case 'rookie':
              // Check rookie card count
              const rookieCount = await prisma.$queryRaw`
                SELECT COUNT(*) as count
                FROM user_card uc
                JOIN card c ON uc.card = c.card_id
                WHERE uc.[user] = ${userId}
                AND c.is_rookie = 1
              `
              progress = Number(rookieCount[0].count)
              qualifies = progress >= achievement.requirement_value
              break

            case 'autograph':
              // Check autograph card count
              const autoCount = await prisma.$queryRaw`
                SELECT COUNT(*) as count
                FROM user_card uc
                JOIN card c ON uc.card = c.card_id
                WHERE uc.[user] = ${userId}
                AND (c.is_autograph = 1 OR uc.aftermarket_autograph = 1)
              `
              progress = Number(autoCount[0].count)
              qualifies = progress >= achievement.requirement_value
              break

            case 'relic':
              // Check relic card count
              const relicCount = await prisma.$queryRaw`
                SELECT COUNT(*) as count
                FROM user_card uc
                JOIN card c ON uc.card = c.card_id
                WHERE uc.[user] = ${userId}
                AND c.is_relic = 1
              `
              progress = Number(relicCount[0].count)
              qualifies = progress >= achievement.requirement_value
              break

            case 'value':
              // Check collection value
              const totalValue = await prisma.$queryRaw`
                SELECT 
                  COALESCE(SUM(COALESCE(estimated_value, purchase_price, 0)), 0) as total
                FROM user_card
                WHERE [user] = ${userId}
              `
              progress = Number(totalValue[0].total)
              qualifies = progress >= achievement.requirement_value
              break

            case 'unique':
              // Check unique players/teams based on achievement name
              if (achievement.name.toLowerCase().includes('player')) {
                const uniquePlayers = await prisma.$queryRaw`
                  SELECT COUNT(DISTINCT p.player_id) as count
                  FROM user_card uc
                  JOIN card c ON uc.card = c.card_id
                  JOIN card_player_team cpt ON c.card_id = cpt.card
                  JOIN player_team pt ON cpt.player_team = pt.player_team_id
                  JOIN player p ON pt.player = p.player_id
                  WHERE uc.[user] = ${userId}
                `
                progress = Number(uniquePlayers[0].count)
                qualifies = progress >= achievement.requirement_value
              } else if (achievement.name.toLowerCase().includes('team')) {
                const uniqueTeams = await prisma.$queryRaw`
                  SELECT COUNT(DISTINCT t.team_id) as count
                  FROM user_card uc
                  JOIN card c ON uc.card = c.card_id
                  JOIN card_player_team cpt ON c.card_id = cpt.card
                  JOIN player_team pt ON cpt.player_team = pt.player_team_id
                  JOIN team t ON pt.team = t.team_id
                  WHERE uc.[user] = ${userId}
                `
                progress = Number(uniqueTeams[0].count)
                qualifies = progress >= achievement.requirement_value
              }
              break

            case 'streak':
              // Skip streak achievements for retroactive processing
              // These need to be earned going forward
              continue

            default:
              // Use custom query if provided
              if (achievement.requirement_query) {
                try {
                  const customResult = await prisma.$queryRawUnsafe(
                    achievement.requirement_query.replace(/@user_id/g, userId)
                  )
                  if (customResult && customResult[0]) {
                    progress = Number(customResult[0].value || customResult[0].count || 0)
                    qualifies = progress >= achievement.requirement_value
                  }
                } catch (queryError) {
                  console.log(`  ⚠️  Custom query failed for ${achievement.name}: ${queryError.message}`)
                }
              }
          }

          if (qualifies) {
            // Award the achievement
            await prisma.$queryRaw`
              INSERT INTO user_achievements (
                user_id,
                achievement_id,
                progress,
                progress_percentage,
                is_completed,
                completed_at,
                points_awarded,
                times_completed,
                last_progress_update
              ) VALUES (
                ${userId},
                ${achievementId},
                ${progress},
                100,
                1,
                GETDATE(),
                ${achievement.points},
                1,
                GETDATE()
              )
            `

            // Log to achievement history
            await prisma.$queryRaw`
              INSERT INTO achievement_history (
                user_id,
                achievement_id,
                action,
                previous_progress,
                new_progress,
                points_change,
                trigger_event,
                created_at
              ) VALUES (
                ${userId},
                ${achievementId},
                'completed',
                0,
                ${progress},
                ${achievement.points},
                'retroactive_processing',
                GETDATE()
              )
            `

            console.log(`  ${colors.green}✓${colors.reset} Awarded: ${achievement.name} (${achievement.points} points)`)
            userAchievements++
            userPoints += achievement.points
            totalAchievementsAwarded++
            totalPointsAwarded += achievement.points
          }
        } catch (error) {
          console.log(`  ${colors.red}✗${colors.reset} Error processing ${achievement.name}: ${error.message}`)
        }
      }

      // Update user achievement stats
      if (userAchievements > 0) {
        try {
          // Calculate tier counts
          const tierCounts = await prisma.$queryRaw`
            SELECT 
              SUM(CASE WHEN a.tier = 'Common' THEN 1 ELSE 0 END) as common_achievements,
              SUM(CASE WHEN a.tier = 'Uncommon' THEN 1 ELSE 0 END) as uncommon_achievements,
              SUM(CASE WHEN a.tier = 'Rare' THEN 1 ELSE 0 END) as rare_achievements,
              SUM(CASE WHEN a.tier = 'Epic' THEN 1 ELSE 0 END) as epic_achievements,
              SUM(CASE WHEN a.tier = 'Legendary' THEN 1 ELSE 0 END) as legendary_achievements,
              SUM(CASE WHEN a.tier = 'Mythic' THEN 1 ELSE 0 END) as mythic_achievements
            FROM user_achievements ua
            JOIN achievements a ON ua.achievement_id = a.achievement_id
            WHERE ua.user_id = ${userId}
            AND ua.is_completed = 1
          `

          const totalActiveAchievements = await prisma.$queryRaw`
            SELECT COUNT(*) as total FROM achievements WHERE is_active = 1
          `

          const completionPercentage = (userAchievements / Number(totalActiveAchievements[0].total)) * 100

          // Check if stats record exists
          const existingStats = await prisma.$queryRaw`
            SELECT user_id FROM user_achievement_stats WHERE user_id = ${userId}
          `

          if (existingStats.length > 0) {
            // Update existing stats
            await prisma.$queryRaw`
              UPDATE user_achievement_stats
              SET 
                total_points = ${userPoints},
                total_achievements = ${userAchievements},
                common_achievements = ${Number(tierCounts[0].common_achievements) || 0},
                uncommon_achievements = ${Number(tierCounts[0].uncommon_achievements) || 0},
                rare_achievements = ${Number(tierCounts[0].rare_achievements) || 0},
                epic_achievements = ${Number(tierCounts[0].epic_achievements) || 0},
                legendary_achievements = ${Number(tierCounts[0].legendary_achievements) || 0},
                mythic_achievements = ${Number(tierCounts[0].mythic_achievements) || 0},
                completion_percentage = ${completionPercentage},
                last_achievement_date = GETDATE()
              WHERE user_id = ${userId}
            `
          } else {
            // Insert new stats record
            await prisma.$queryRaw`
              INSERT INTO user_achievement_stats (
                user_id,
                total_points,
                total_achievements,
                common_achievements,
                uncommon_achievements,
                rare_achievements,
                epic_achievements,
                legendary_achievements,
                mythic_achievements,
                completion_percentage,
                longest_streak,
                current_streak,
                last_achievement_date,
                achievement_rate
              ) VALUES (
                ${userId},
                ${userPoints},
                ${userAchievements},
                ${Number(tierCounts[0].common_achievements) || 0},
                ${Number(tierCounts[0].uncommon_achievements) || 0},
                ${Number(tierCounts[0].rare_achievements) || 0},
                ${Number(tierCounts[0].epic_achievements) || 0},
                ${Number(tierCounts[0].legendary_achievements) || 0},
                ${Number(tierCounts[0].mythic_achievements) || 0},
                ${completionPercentage},
                0,
                0,
                GETDATE(),
                0
              )
            `
          }

          console.log(`  ${colors.yellow}Summary: ${userAchievements} achievements, ${userPoints} points${colors.reset}\n`)
        } catch (statsError) {
          console.log(`  ${colors.red}✗${colors.reset} Error updating stats: ${statsError.message}\n`)
        }
      } else {
        console.log(`  ${colors.yellow}No new achievements earned${colors.reset}\n`)
      }
    }

    // Final summary
    console.log(`${colors.cyan}================================================${colors.reset}`)
    console.log(`${colors.bright}${colors.green}✅ Retroactive Processing Complete!${colors.reset}`)
    console.log(`${colors.bright}Total achievements awarded: ${totalAchievementsAwarded}${colors.reset}`)
    console.log(`${colors.bright}Total points awarded: ${totalPointsAwarded}${colors.reset}`)

  } catch (error) {
    console.error(`${colors.red}❌ Error during retroactive processing:${colors.reset}`, error)
  } finally {
    await prisma.$disconnect()
  }
}

// Run the script
processRetroactiveAchievements()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Fatal error:', error)
    process.exit(1)
  })