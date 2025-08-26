#!/usr/bin/env node

/**
 * Update Team Player Counts
 * 
 * This script updates the player_count column in the team table
 * by recalculating the count of distinct players for each team.
 * 
 * Should be run daily via cron job or scheduled task.
 * 
 * Usage: node server/scripts/update-team-player-counts.js
 */

const { PrismaClient } = require('@prisma/client')

async function updateTeamPlayerCounts() {
  const prisma = new PrismaClient()
  
  try {
    console.log('🔄 Starting team player count update...')
    const startTime = Date.now()
    
    // Update all team player counts in a single query for efficiency
    const result = await prisma.$executeRaw`
      UPDATE team 
      SET player_count = (
          SELECT COUNT(DISTINCT pt.player) 
          FROM player_team pt 
          WHERE pt.team = team.team_id
      )
      WHERE team.team_id IS NOT NULL
    `
    
    const duration = Date.now() - startTime
    console.log(`✅ Updated player counts for teams in ${duration}ms`)
    
    // Get some statistics
    const stats = await prisma.$queryRaw`
      SELECT 
          COUNT(*) as total_teams,
          SUM(player_count) as total_player_relationships,
          AVG(CAST(player_count as FLOAT)) as avg_players_per_team,
          MAX(player_count) as max_players,
          MIN(player_count) as min_players
      FROM team 
      WHERE card_count > 0
    `
    
    const stat = stats[0]
    console.log('📊 Statistics:')
    console.log(`   - Teams with cards: ${stat.total_teams}`)
    console.log(`   - Total player-team relationships: ${stat.total_player_relationships}`)
    console.log(`   - Average players per team: ${Math.round(stat.avg_players_per_team)}`)
    console.log(`   - Max players on a team: ${stat.max_players}`)
    console.log(`   - Min players on a team: ${stat.min_players}`)
    
    // Show top 5 teams by player count
    const topTeams = await prisma.$queryRaw`
      SELECT TOP 5 name, player_count, card_count
      FROM team 
      WHERE player_count > 0
      ORDER BY player_count DESC
    `
    
    console.log('🏆 Top 5 teams by player count:')
    topTeams.forEach((team, index) => {
      console.log(`   ${index + 1}. ${team.name}: ${team.player_count} players (${team.card_count} cards)`)
    })
    
    console.log('✅ Team player count update completed successfully')
    
  } catch (error) {
    console.error('❌ Error updating team player counts:', error)
    process.exit(1)
  } finally {
    await prisma.$disconnect()
  }
}

// Run if called directly
if (require.main === module) {
  updateTeamPlayerCounts()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error('❌ Script failed:', error)
      process.exit(1)
    })
}

module.exports = { updateTeamPlayerCounts }