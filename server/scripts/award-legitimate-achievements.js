/**
 * Award only legitimate collection-based achievements
 * Based on actual collection data, not generic crowdsourcing achievements
 */

const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient({ log: ['error'] })

async function awardLegitimateAchievements() {
  console.log('🏆 Awarding legitimate collection-based achievements...\n')

  try {
    const userId = 1 // jeffblankenburg user

    // Get actual collection stats
    const userStats = await prisma.$queryRaw`
      SELECT 
        COUNT(*) as total_cards,
        COUNT(DISTINCT c.card_id) as unique_cards,
        SUM(CASE WHEN c.is_rookie = 1 THEN 1 ELSE 0 END) as rookie_cards,
        SUM(CASE WHEN c.is_autograph = 1 THEN 1 ELSE 0 END) as autograph_cards,
        SUM(CASE WHEN c.is_relic = 1 THEN 1 ELSE 0 END) as relic_cards,
        COUNT(DISTINCT s.series_id) as unique_series,
        COUNT(DISTINCT p.player_id) as unique_players,
        COUNT(DISTINCT t.team_Id) as unique_teams,
        COALESCE(SUM(CAST(uc.estimated_value as DECIMAL(10,2))), 0) as total_value
      FROM user_card uc
      INNER JOIN card c ON uc.card = c.card_id
      LEFT JOIN series s ON c.series = s.series_id
      LEFT JOIN card_player_team cpt ON c.card_id = cpt.card
      LEFT JOIN player_team pt ON cpt.player_team = pt.player_team_id  
      LEFT JOIN player p ON pt.player = p.player_id
      LEFT JOIN team t ON pt.team = t.team_Id
      WHERE uc.[user] = ${userId}
    `

    const stats = userStats[0]
    console.log('📊 Collection Stats:')
    console.log(`   Total Cards: ${Number(stats.total_cards).toLocaleString()}`)
    console.log(`   Unique Cards: ${Number(stats.unique_cards).toLocaleString()}`)  
    console.log(`   Rookies: ${Number(stats.rookie_cards).toLocaleString()}`)
    console.log(`   Autographs: ${Number(stats.autograph_cards).toLocaleString()}`)
    console.log(`   Relics: ${Number(stats.relic_cards).toLocaleString()}`)
    console.log(`   Series: ${Number(stats.unique_series).toLocaleString()}`)
    console.log(`   Players: ${Number(stats.unique_players).toLocaleString()}`)
    console.log(`   Teams: ${Number(stats.unique_teams).toLocaleString()}`)
    console.log(`   Total Value: $${Number(stats.total_value).toFixed(2)}\n`)

    // Define legitimate achievements based on real collection data
    const achievements = []
    const totalCards = Number(stats.total_cards)
    const rookieCards = Number(stats.rookie_cards)
    const autographCards = Number(stats.autograph_cards)
    const relicCards = Number(stats.relic_cards)
    const uniquePlayers = Number(stats.unique_players)
    const uniqueTeams = Number(stats.unique_teams)
    const uniqueSeries = Number(stats.unique_series)

    // Collection size achievements
    if (totalCards >= 1) achievements.push(['First Card', 'Add your first card to your collection', 10, 'Common'])
    if (totalCards >= 10) achievements.push(['Getting Started', 'Collect 10 cards', 15, 'Common'])
    if (totalCards >= 100) achievements.push(['Century Club', 'Collect 100 cards', 25, 'Uncommon'])
    if (totalCards >= 500) achievements.push(['Serious Collector', 'Collect 500 cards', 50, 'Rare'])
    if (totalCards >= 1000) achievements.push(['1K Club', 'Collect 1,000 cards', 75, 'Epic'])
    if (totalCards >= 5000) achievements.push(['5K Collector', 'Collect 5,000 cards', 150, 'Legendary'])

    // Rookie achievements
    if (rookieCards >= 1) achievements.push(['First Rookie', 'Collect your first rookie card', 15, 'Common'])
    if (rookieCards >= 50) achievements.push(['Rookie Hunter', 'Collect 50 rookie cards', 30, 'Uncommon'])
    if (rookieCards >= 250) achievements.push(['Rookie Vault', 'Collect 250 rookie cards', 100, 'Epic'])
    if (rookieCards >= 1000) achievements.push(['Rookie Kingdom', 'Collect 1,000 rookie cards', 250, 'Legendary'])

    // Autograph achievements  
    if (autographCards >= 1) achievements.push(['First Signature', 'Collect your first autograph card', 25, 'Uncommon'])
    if (autographCards >= 50) achievements.push(['Autograph Album', 'Collect 50 autograph cards', 100, 'Epic'])
    if (autographCards >= 100) achievements.push(['Signing Session', 'Collect 100 autograph cards', 150, 'Epic'])
    if (autographCards >= 250) achievements.push(['Signature Specialist', 'Collect 250 autograph cards', 300, 'Legendary'])

    // Relic achievements
    if (relicCards >= 1) achievements.push(['First Relic', 'Collect your first relic card', 25, 'Uncommon'])
    if (relicCards >= 25) achievements.push(['Relic Hunter', 'Collect 25 relic cards', 75, 'Epic'])
    if (relicCards >= 50) achievements.push(['Relic Repository', 'Collect 50 relic cards', 150, 'Epic'])

    // Player diversity achievements
    if (uniquePlayers >= 100) achievements.push(['Player Collector', 'Collect cards from 100 different players', 50, 'Rare'])
    if (uniquePlayers >= 500) achievements.push(['Player Expert', 'Collect cards from 500 different players', 100, 'Epic'])
    if (uniquePlayers >= 1000) achievements.push(['Player Authority', 'Collect cards from 1,000 different players', 200, 'Legendary'])

    // Team coverage achievements
    if (uniqueTeams >= 10) achievements.push(['Team Collector', 'Collect cards from 10 different teams', 25, 'Uncommon'])
    if (uniqueTeams >= 30) achievements.push(['League Coverage', 'Collect cards from 30 different teams', 50, 'Rare'])

    // Series diversity achievements
    if (uniqueSeries >= 100) achievements.push(['Series Hunter', 'Collect from 100 different series', 50, 'Rare'])
    if (uniqueSeries >= 500) achievements.push(['Series Expert', 'Collect from 500 different series', 100, 'Epic'])
    if (uniqueSeries >= 1000) achievements.push(['Series Master', 'Collect from 1,000 different series', 200, 'Legendary'])

    console.log(`🎯 Awarding ${achievements.length} legitimate achievements:\n`)

    let totalPoints = 0
    let tierCounts = { Common: 0, Uncommon: 0, Rare: 0, Epic: 0, Legendary: 0, Mythic: 0 }

    // Find and award each achievement
    for (const [name, description, points, tier] of achievements) {
      try {
        // Find the achievement in the database
        const dbAchievement = await prisma.$queryRaw`
          SELECT achievement_id, name, points, tier FROM achievements 
          WHERE name = ${name} OR description LIKE '%' + ${name} + '%'
          ORDER BY 
            CASE WHEN name = ${name} THEN 1 ELSE 2 END,
            achievement_id
        `

        if (dbAchievement.length > 0) {
          const achievement = dbAchievement[0]
          const achievementId = Number(achievement.achievement_id)

          // Award the achievement
          await prisma.$queryRaw`
            INSERT INTO user_achievements (
              user_id, achievement_id, progress, progress_percentage,
              is_completed, completed_at, points_awarded, times_completed,
              last_progress_update
            ) VALUES (
              ${userId}, ${achievementId}, 1, 100, 1, GETDATE(),
              ${achievement.points}, 1, GETDATE()
            )
          `

          // Log to achievement history
          await prisma.$queryRaw`
            INSERT INTO achievement_history (
              user_id, achievement_id, action, previous_progress,
              new_progress, points_change, trigger_event, created_at
            ) VALUES (
              ${userId}, ${achievementId}, 'completed', 0, 1,
              ${achievement.points}, 'legitimate_retroactive', GETDATE()
            )
          `

          console.log(`✅ ${achievement.name} (${achievement.points} pts, ${achievement.tier})`)
          totalPoints += Number(achievement.points)
          tierCounts[achievement.tier] = (tierCounts[achievement.tier] || 0) + 1
        } else {
          console.log(`⚠️  Achievement not found: ${name}`)
        }
      } catch (error) {
        console.log(`❌ Error awarding ${name}: ${error.message}`)
      }
    }

    // Update user achievement stats
    await prisma.$queryRaw`
      INSERT INTO user_achievement_stats (
        user_id, total_points, total_achievements,
        common_achievements, uncommon_achievements, rare_achievements,
        epic_achievements, legendary_achievements, mythic_achievements,
        completion_percentage, longest_streak, current_streak,
        last_achievement_date, achievement_rate
      ) VALUES (
        ${userId}, ${totalPoints}, ${achievements.length},
        ${tierCounts.Common}, ${tierCounts.Uncommon}, ${tierCounts.Rare},
        ${tierCounts.Epic}, ${tierCounts.Legendary}, ${tierCounts.Mythic},
        0, 0, 0, GETDATE(), 0
      )
    `

    console.log(`\n🎉 Complete! Awarded ${achievements.length} achievements worth ${totalPoints} points`)
    console.log('📊 Tier breakdown:', tierCounts)

  } catch (error) {
    console.error('❌ Error:', error)
  } finally {
    await prisma.$disconnect()
  }
}

// Run the script
awardLegitimateAchievements()