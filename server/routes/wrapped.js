/**
 * User Wrapped (Year in Review) Routes
 * Provides annual collection statistics for users
 */

const express = require('express')
const { prisma } = require('../config/prisma-singleton')
const { authMiddleware } = require('../middleware/auth')
const crypto = require('crypto')

const router = express.Router()

/**
 * Calculate wrapped stats for a user and year
 */
async function calculateWrappedStats(userId, year) {
  const startDate = new Date(`${year}-01-01T00:00:00.000Z`)
  const endDate = new Date(`${year}-12-31T23:59:59.999Z`)

  // Get all user_cards added this year
  const userCardsThisYear = await prisma.user_card.findMany({
    where: {
      user: userId,
      created: {
        gte: startDate,
        lte: endDate
      }
    },
    include: {
      card_user_card_cardTocard: {
        include: {
          color_card_colorTocolor: true,
          card_player_team_card_player_team_cardTocard: {
            include: {
              player_team_card_player_team_player_teamToplayer_team: {
                include: {
                  player_player_team_playerToplayer: true,
                  team_player_team_teamToteam: true
                }
              }
            }
          }
        }
      }
    }
  })

  // Get previous year count for comparison
  const prevYearStart = new Date(`${year - 1}-01-01T00:00:00.000Z`)
  const prevYearEnd = new Date(`${year - 1}-12-31T23:59:59.999Z`)
  const prevYearCount = await prisma.user_card.count({
    where: {
      user: userId,
      created: {
        gte: prevYearStart,
        lte: prevYearEnd
      }
    }
  })

  // Total collection size
  const totalCollectionSize = await prisma.user_card.count({
    where: { user: userId }
  })

  // Basic stats
  const cardsAddedThisYear = userCardsThisYear.length
  const growthPercentage = prevYearCount > 0
    ? ((cardsAddedThisYear - prevYearCount) / prevYearCount * 100).toFixed(1)
    : null

  // Separate bulk additions from singles
  // Cards added within 2 seconds of each other are considered bulk
  const sortedCards = [...userCardsThisYear].sort((a, b) =>
    new Date(a.created).getTime() - new Date(b.created).getTime()
  )

  const singleCards = new Set()
  const bulkCards = new Set()

  for (let i = 0; i < sortedCards.length; i++) {
    const card = sortedCards[i]
    const cardTime = new Date(card.created).getTime()
    const cardId = Number(card.user_card_id)

    // Check if this card was added within 2 seconds of another card
    const hasNearbyBefore = i > 0 &&
      (cardTime - new Date(sortedCards[i - 1].created).getTime()) < 2000
    const hasNearbyAfter = i < sortedCards.length - 1 &&
      (new Date(sortedCards[i + 1].created).getTime() - cardTime) < 2000

    if (hasNearbyBefore || hasNearbyAfter) {
      bulkCards.add(cardId)
    } else {
      singleCards.add(cardId)
    }
  }

  // Extract player, team, and set data
  const playerCounts = {}      // All cards
  const playerCountsSingles = {} // Singles only (for rankings)
  const teamCounts = {}        // All cards
  const teamCountsSingles = {} // Singles only (for rankings)
  const setCounts = {}         // All cards
  const setCountsSingles = {}  // Singles only (for rankings)
  const sportCounts = {}
  const colorCounts = {}
  const cardsByDate = {}
  const cardsByMonth = Array(12).fill(0)
  const cardsByDayOfWeek = Array(7).fill(0)
  const cardsByHour = Array(24).fill(0)

  let rookieCount = 0
  let autoCount = 0
  let relicCount = 0
  let shortPrintCount = 0
  let numberedCards = []
  let mostValuableCard = null
  let rarestCard = null
  let firstCardOfYear = null
  let lastCardOfYear = null

  for (const uc of userCardsThisYear) {
    const card = uc.card_user_card_cardTocard
    if (!card) continue

    const createdDate = new Date(uc.created)
    const dateKey = createdDate.toISOString().split('T')[0]
    const month = createdDate.getMonth()
    const dayOfWeek = createdDate.getDay()
    const hour = createdDate.getHours()

    // Track by date
    cardsByDate[dateKey] = (cardsByDate[dateKey] || 0) + 1
    cardsByMonth[month]++
    cardsByDayOfWeek[dayOfWeek]++
    cardsByHour[hour]++

    // Track first and last card
    if (!firstCardOfYear || createdDate < new Date(firstCardOfYear.created)) {
      firstCardOfYear = uc
    }
    if (!lastCardOfYear || createdDate > new Date(lastCardOfYear.created)) {
      lastCardOfYear = uc
    }

    // Track card attributes
    if (card.is_rookie) rookieCount++
    if (card.is_autograph) autoCount++
    if (card.is_relic) relicCount++
    if (card.is_short_print) shortPrintCount++

    // Track numbered cards
    if (card.print_run) {
      numberedCards.push({
        user_card_id: Number(uc.user_card_id),
        card_id: Number(card.card_id),
        print_run: card.print_run,
        card_number: card.card_number,
        estimated_value: parseFloat(uc.estimated_value) || 0
      })
    }

    // Track most valuable
    const estValue = parseFloat(uc.estimated_value) || 0
    if (estValue > 0 && (!mostValuableCard || estValue > mostValuableCard.estimated_value)) {
      mostValuableCard = {
        user_card_id: Number(uc.user_card_id),
        card_id: Number(card.card_id),
        estimated_value: estValue,
        card_number: card.card_number
      }
    }

    // Track rarest (lowest print run)
    if (card.print_run && (!rarestCard || card.print_run < rarestCard.print_run)) {
      rarestCard = {
        user_card_id: Number(uc.user_card_id),
        card_id: Number(card.card_id),
        print_run: card.print_run,
        card_number: card.card_number
      }
    }

    // Track colors
    const colorName = card.color_card_colorTocolor?.name || 'Base'
    colorCounts[colorName] = (colorCounts[colorName] || 0) + 1

    // Track players and teams
    // Use Sets to track unique players/teams per card (avoid double counting multi-player cards)
    const seenPlayersThisCard = new Set()
    const seenTeamsThisCard = new Set()

    const playerTeams = card.card_player_team_card_player_team_cardTocard || []
    for (const cpt of playerTeams) {
      const pt = cpt.player_team_card_player_team_player_teamToplayer_team
      const player = pt?.player_player_team_playerToplayer
      const team = pt?.team_player_team_teamToteam

      if (player) {
        const playerId = Number(player.player_id)
        // Only count each player once per card
        if (!seenPlayersThisCard.has(playerId)) {
          seenPlayersThisCard.add(playerId)
          const playerName = `${player.first_name || ''} ${player.last_name || ''}`.trim()

          // Track all cards
          if (!playerCounts[playerId]) {
            playerCounts[playerId] = {
              player_id: playerId,
              name: playerName,
              count: 0,
              photo_url: player.photo_url || null
            }
          }
          playerCounts[playerId].count++

          // Track singles only (for rankings)
          const userCardId = Number(uc.user_card_id)
          if (singleCards.has(userCardId)) {
            if (!playerCountsSingles[playerId]) {
              playerCountsSingles[playerId] = {
                player_id: playerId,
                name: playerName,
                count: 0,
                photo_url: player.photo_url || null
              }
            }
            playerCountsSingles[playerId].count++
          }
        }
      }

      if (team) {
        // Note: The column is team_Id (capital I) in the database
        const teamId = team.team_Id != null ? Number(team.team_Id) : null
        // Only count each team once per card (a card with 3 Dodgers players = 1 Dodgers card)
        if (teamId != null && !seenTeamsThisCard.has(teamId)) {
          seenTeamsThisCard.add(teamId)

          // Track all cards
          if (!teamCounts[teamId]) {
            teamCounts[teamId] = {
              team_id: teamId,
              name: team.name,
              abbreviation: team.abbreviation || null,
              count: 0,
              primary_color: team.primary_color || null,
              secondary_color: team.secondary_color || null,
              logo_url: team.logo_url || null
            }
          }
          teamCounts[teamId].count++

          // Track singles only (for rankings)
          const userCardId = Number(uc.user_card_id)
          if (singleCards.has(userCardId)) {
            if (!teamCountsSingles[teamId]) {
              teamCountsSingles[teamId] = {
                team_id: teamId,
                name: team.name,
                abbreviation: team.abbreviation || null,
                count: 0,
                primary_color: team.primary_color || null,
                secondary_color: team.secondary_color || null,
                logo_url: team.logo_url || null
              }
            }
            teamCountsSingles[teamId].count++
          }
        }
      }
    }
  }

  // Get set information for cards added this year
  const seriesIds = [...new Set(userCardsThisYear
    .map(uc => uc.card_user_card_cardTocard?.series)
    .filter(Boolean)
    .map(s => Number(s))
  )]

  if (seriesIds.length > 0) {
    const seriesData = await prisma.series.findMany({
      where: { series_id: { in: seriesIds.map(id => BigInt(id)) } },
      include: {
        set_series_setToset: {
          include: {
            organization_set_organizationToorganization: true
          }
        }
      }
    })

    const seriesSetMap = new Map(seriesData.map(s => [Number(s.series_id), s.set_series_setToset]))

    for (const uc of userCardsThisYear) {
      const card = uc.card_user_card_cardTocard
      if (!card?.series) continue

      const set = seriesSetMap.get(Number(card.series))
      if (set) {
        const setId = Number(set.set_id)
        const userCardId = Number(uc.user_card_id)

        // Track all cards
        if (!setCounts[setId]) {
          setCounts[setId] = {
            set_id: setId,
            name: set.name,
            year: set.year,
            count: 0
          }
        }
        setCounts[setId].count++

        // Track singles only (for rankings)
        if (singleCards.has(userCardId)) {
          if (!setCountsSingles[setId]) {
            setCountsSingles[setId] = {
              set_id: setId,
              name: set.name,
              year: set.year,
              count: 0
            }
          }
          setCountsSingles[setId].count++
        }

        // Track sport from organization (skip multi-sport sets without organization)
        const org = set.organization_set_organizationToorganization
        const sport = org?.sport
        if (sport) {
          sportCounts[sport] = (sportCounts[sport] || 0) + 1
        }
      }
    }
  }

  // Sort and get top 10s for players and teams
  // Use singles counts for rankings (excludes bulk/set additions)
  const topPlayers = Object.values(playerCountsSingles)
    .sort((a, b) => b.count - a.count)
    .slice(0, 10)

  const topTeams = Object.values(teamCountsSingles)
    .sort((a, b) => b.count - a.count)
    .slice(0, 10)

  const topSets = Object.values(setCountsSingles)
    .sort((a, b) => b.count - a.count)
    .slice(0, 10)

  // Find biggest collection day
  const biggestDay = Object.entries(cardsByDate)
    .sort((a, b) => b[1] - a[1])[0] || null

  // Calculate collection value
  const totalValueAdded = userCardsThisYear.reduce((sum, uc) => {
    return sum + (parseFloat(uc.estimated_value) || 0)
  }, 0)

  // Determine collector personality
  const personality = determinePersonality({
    rookieCount,
    autoCount,
    relicCount,
    numberedCards: numberedCards.length,
    topTeams,
    topPlayers,
    colorCounts,
    cardsAddedThisYear
  })

  // Day of week names
  const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
  const favoriteDayIndex = cardsByDayOfWeek.indexOf(Math.max(...cardsByDayOfWeek))
  const favoriteDay = dayNames[favoriteDayIndex]

  // Determine if night owl or early bird
  const morningCards = cardsByHour.slice(6, 12).reduce((a, b) => a + b, 0)
  const eveningCards = cardsByHour.slice(18, 24).reduce((a, b) => a + b, 0)
  const timePreference = morningCards > eveningCards ? 'Early Bird' : 'Night Owl'

  // Get sales stats only if user has an active seller role
  let sellerStats = null
  const userRecord = await prisma.user.findUnique({
    where: { user_id: userId },
    select: { seller_role: true, seller_expires: true, username: true, is_public_profile: true }
  })

  // Check if user has seller module active (has seller_role and not expired)
  const hasSellerModule = userRecord?.seller_role &&
    (!userRecord.seller_expires || new Date(userRecord.seller_expires) > new Date())

  if (hasSellerModule) {
    const sales = await prisma.sale.findMany({
      where: {
        user_id: userId,
        status: 'sold',
        sale_date: {
          gte: startDate,
          lte: endDate
        }
      },
      include: {
        card: {
          include: {
            card_player_team_card_player_team_cardTocard: {
              include: {
                player_team_card_player_team_player_teamToplayer_team: {
                  include: {
                    player_player_team_playerToplayer: true
                  }
                }
              }
            }
          }
        }
      }
    })

    if (sales.length > 0) {
      const totalRevenue = sales.reduce((sum, s) => sum + (parseFloat(s.sale_price) || 0), 0)
      const totalProfit = sales.reduce((sum, s) => sum + (parseFloat(s.net_profit) || 0), 0)
      const bestSale = sales.reduce((best, s) => {
        const price = parseFloat(s.sale_price) || 0
        return price > (best?.sale_price || 0) ? { ...s, sale_price: price } : best
      }, null)

      // Track profit by player
      const playerProfits = {}
      for (const sale of sales) {
        const playerTeams = sale.card?.card_player_team_card_player_team_cardTocard || []
        const profit = parseFloat(sale.net_profit) || 0
        for (const cpt of playerTeams) {
          const player = cpt.player_team_card_player_team_player_teamToplayer_team?.player_player_team_playerToplayer
          if (player) {
            const playerId = Number(player.player_id)
            const playerName = `${player.first_name || ''} ${player.last_name || ''}`.trim()
            if (!playerProfits[playerId]) {
              playerProfits[playerId] = { player_id: playerId, name: playerName, profit: 0 }
            }
            playerProfits[playerId].profit += profit
          }
        }
      }

      const mostProfitablePlayer = Object.values(playerProfits)
        .sort((a, b) => b.profit - a.profit)[0] || null

      sellerStats = {
        total_revenue: totalRevenue,
        total_profit: totalProfit,
        cards_sold: sales.length,
        average_sale_price: totalRevenue / sales.length,
        best_sale: bestSale ? {
          sale_id: Number(bestSale.sale_id),
          sale_price: bestSale.sale_price
        } : null,
        most_profitable_player: mostProfitablePlayer
      }
    }
  }

  // Lists created this year
  const listsCreated = await prisma.user_list.count({
    where: {
      user: userId,
      created: {
        gte: startDate,
        lte: endDate
      }
    }
  })

  // === ENGAGEMENT STATS ===
  // Comments made
  const commentsCount = await prisma.universal_comments.count({
    where: {
      user_id: userId,
      created_at: {
        gte: startDate,
        lte: endDate
      }
    }
  })

  // Sessions/logins
  const sessionsCount = await prisma.user_session.count({
    where: {
      user_id: userId,
      created: {
        gte: startDate,
        lte: endDate
      }
    }
  })

  // Achievements earned
  const achievementsEarned = await prisma.user_achievements.count({
    where: {
      user_id: userId,
      is_completed: true,
      completed_at: {
        gte: startDate,
        lte: endDate
      }
    }
  })

  // Following (users they started following this year)
  const followingCount = await prisma.user_follow.count({
    where: {
      follower_user_id: userId,
      created: {
        gte: startDate,
        lte: endDate
      }
    }
  })

  // Followers gained this year
  const followersGainedCount = await prisma.user_follow.count({
    where: {
      following_user_id: userId,
      created: {
        gte: startDate,
        lte: endDate
      }
    }
  })

  // Feedback submitted
  const feedbackCount = await prisma.feedback_submission.count({
    where: {
      user_id: userId,
      created_at: {
        gte: startDate,
        lte: endDate
      }
    }
  })

  return {
    year,
    generated_at: new Date().toISOString(),

    // Collection growth
    collection: {
      cards_added: cardsAddedThisYear,
      singles_added: singleCards.size,
      bulk_added: bulkCards.size,
      previous_year_cards: prevYearCount,
      growth_percentage: growthPercentage,
      total_collection_size: totalCollectionSize,
      total_value_added: totalValueAdded,
      unique_players: Object.keys(playerCounts).length,
      unique_teams: Object.keys(teamCounts).length,
      unique_sets: Object.keys(setCounts).length
    },

    // Top lists
    top_players: topPlayers,
    top_teams: topTeams,
    top_sets: topSets,

    // Special cards
    most_valuable_card: mostValuableCard,
    rarest_card: rarestCard,
    first_card_of_year: firstCardOfYear ? {
      user_card_id: Number(firstCardOfYear.user_card_id),
      card_id: firstCardOfYear.card_user_card_cardTocard ? Number(firstCardOfYear.card_user_card_cardTocard.card_id) : null,
      created: firstCardOfYear.created
    } : null,
    last_card_of_year: lastCardOfYear ? {
      user_card_id: Number(lastCardOfYear.user_card_id),
      card_id: lastCardOfYear.card_user_card_cardTocard ? Number(lastCardOfYear.card_user_card_cardTocard.card_id) : null,
      created: lastCardOfYear.created
    } : null,

    // Card attributes
    attributes: {
      rookies: rookieCount,
      autographs: autoCount,
      relics: relicCount,
      short_prints: shortPrintCount,
      numbered_cards: numberedCards.length,
      lowest_numbered: numberedCards.sort((a, b) => a.print_run - b.print_run)[0] || null
    },

    // Color breakdown
    colors: Object.entries(colorCounts)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count),

    // Activity patterns
    activity: {
      biggest_day: biggestDay ? { date: biggestDay[0], count: biggestDay[1] } : null,
      cards_by_month: cardsByMonth,
      cards_by_day_of_week: cardsByDayOfWeek,
      cards_by_hour: cardsByHour,
      favorite_day: favoriteDay,
      time_preference: timePreference,
      morning_cards: morningCards,
      evening_cards: eveningCards,
      lists_created: listsCreated
    },

    // Sport breakdown
    sports: Object.entries(sportCounts)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count),

    // Engagement stats
    engagement: {
      comments: commentsCount,
      sessions: sessionsCount,
      achievements_earned: achievementsEarned,
      following: followingCount,
      followers_gained: followersGainedCount,
      feedback_submitted: feedbackCount
    },

    // Personality
    personality,

    // Seller stats (if applicable)
    seller_stats: sellerStats,

    // Public profile URL (if enabled)
    public_profile_url: userRecord?.is_public_profile && userRecord?.username
      ? `https://collectyourcards.com/${userRecord.username}`
      : null
  }
}

/**
 * Determine collector personality based on collection patterns
 */
function determinePersonality({ rookieCount, autoCount, relicCount, numberedCards, topTeams, topPlayers, colorCounts, cardsAddedThisYear }) {
  if (cardsAddedThisYear === 0) {
    return { type: 'The Hibernator', description: 'Taking a break from collecting this year', emoji: '😴' }
  }

  const rookiePercentage = (rookieCount / cardsAddedThisYear) * 100
  const autoPercentage = (autoCount / cardsAddedThisYear) * 100
  const relicPercentage = (relicCount / cardsAddedThisYear) * 100
  const numberedPercentage = (numberedCards / cardsAddedThisYear) * 100

  // Check for team loyalist (>50% of cards from one team)
  if (topTeams.length > 0) {
    const topTeamPercentage = (topTeams[0].count / cardsAddedThisYear) * 100
    if (topTeamPercentage > 50) {
      return {
        type: 'Team Loyalist',
        description: `A true ${topTeams[0].name} fan through and through`,
        emoji: '🏆',
        team: topTeams[0]
      }
    }
  }

  // Check for player collector (>30% of cards feature one player)
  if (topPlayers.length > 0) {
    const topPlayerPercentage = (topPlayers[0].count / cardsAddedThisYear) * 100
    if (topPlayerPercentage > 30) {
      return {
        type: 'Super Fan',
        description: `Building the ultimate ${topPlayers[0].name} collection`,
        emoji: '⭐',
        player: topPlayers[0]
      }
    }
  }

  // Check for rookie hunter
  if (rookiePercentage > 40) {
    return { type: 'Rookie Hunter', description: 'Always chasing the next big prospect', emoji: '🎯' }
  }

  // Check for autograph collector
  if (autoPercentage > 25) {
    return { type: 'Ink Chaser', description: 'Nothing beats a player\'s signature', emoji: '✍️' }
  }

  // Check for relic collector
  if (relicPercentage > 20) {
    return { type: 'Piece of History', description: 'Collecting game-used memorabilia', emoji: '🧩' }
  }

  // Check for parallel chaser
  const nonBaseColors = Object.entries(colorCounts)
    .filter(([name]) => name.toLowerCase() !== 'base')
    .reduce((sum, [, count]) => sum + count, 0)
  const parallelPercentage = (nonBaseColors / cardsAddedThisYear) * 100
  if (parallelPercentage > 50) {
    return { type: 'Rainbow Chaser', description: 'Gotta catch \'em all... in every color', emoji: '🌈' }
  }

  // Check for numbered card collector
  if (numberedPercentage > 30) {
    return { type: 'Number Cruncher', description: 'The lower the number, the better', emoji: '🔢' }
  }

  // Default: well-rounded collector
  return { type: 'Well-Rounded Collector', description: 'A little bit of everything makes a great collection', emoji: '📚' }
}

/**
 * GET /api/user/wrapped/:year
 * Get wrapped stats for a specific year
 */
router.get('/:year', authMiddleware, async (req, res) => {
  try {
    const userId = BigInt(req.user.userId)
    const year = parseInt(req.params.year)

    if (isNaN(year) || year < 2000 || year > new Date().getFullYear()) {
      return res.status(400).json({ error: 'Invalid year' })
    }

    // Check for cached stats
    const cached = await prisma.user_wrapped.findUnique({
      where: {
        user_id_year: { user_id: userId, year }
      }
    })

    // Use cache if generated within last 24 hours
    const cacheExpiry = 24 * 60 * 60 * 1000 // 24 hours
    if (cached && cached.stats_json && (Date.now() - new Date(cached.generated_at).getTime()) < cacheExpiry) {
      return res.json({
        ...JSON.parse(cached.stats_json),
        cached: true,
        share_token: cached.share_token
      })
    }

    // Calculate fresh stats
    const stats = await calculateWrappedStats(userId, year)

    // Generate share token if not exists
    const shareToken = cached?.share_token || crypto.randomBytes(16).toString('hex')

    // Cache the results
    await prisma.user_wrapped.upsert({
      where: {
        user_id_year: { user_id: userId, year }
      },
      create: {
        user_id: userId,
        year,
        stats_json: JSON.stringify(stats),
        share_token: shareToken,
        generated_at: new Date()
      },
      update: {
        stats_json: JSON.stringify(stats),
        generated_at: new Date()
      }
    })

    res.json({
      ...stats,
      cached: false,
      share_token: shareToken
    })
  } catch (error) {
    console.error('Error generating wrapped stats:', error.message)
    console.error('Stack:', error.stack)
    res.status(500).json({ error: 'Failed to generate wrapped stats', details: error.message })
  }
})

/**
 * GET /api/user/wrapped/:year/refresh
 * Force refresh wrapped stats (bypass cache)
 */
router.get('/:year/refresh', authMiddleware, async (req, res) => {
  try {
    const userId = BigInt(req.user.userId)
    const year = parseInt(req.params.year)

    if (isNaN(year) || year < 2000 || year > new Date().getFullYear()) {
      return res.status(400).json({ error: 'Invalid year' })
    }

    // Calculate fresh stats
    const stats = await calculateWrappedStats(userId, year)

    // Get existing share token or generate new one
    const existing = await prisma.user_wrapped.findUnique({
      where: { user_id_year: { user_id: userId, year } }
    })
    const shareToken = existing?.share_token || crypto.randomBytes(16).toString('hex')

    // Update cache
    await prisma.user_wrapped.upsert({
      where: {
        user_id_year: { user_id: userId, year }
      },
      create: {
        user_id: userId,
        year,
        stats_json: JSON.stringify(stats),
        share_token: shareToken,
        generated_at: new Date()
      },
      update: {
        stats_json: JSON.stringify(stats),
        generated_at: new Date()
      }
    })

    res.json({
      ...stats,
      cached: false,
      share_token: shareToken
    })
  } catch (error) {
    console.error('Error refreshing wrapped stats:', error)
    res.status(500).json({ error: 'Failed to refresh wrapped stats' })
  }
})

/**
 * GET /api/user/wrapped/share/:shareToken
 * Public endpoint to view shared wrapped stats
 */
router.get('/share/:shareToken', async (req, res) => {
  try {
    const { shareToken } = req.params

    const wrapped = await prisma.user_wrapped.findFirst({
      where: { share_token: shareToken },
      include: {
        user: {
          select: {
            username: true,
            name: true,
            avatar_url: true
          }
        }
      }
    })

    if (!wrapped) {
      return res.status(404).json({ error: 'Wrapped not found' })
    }

    const user = wrapped.user

    res.json({
      ...JSON.parse(wrapped.stats_json),
      user: {
        username: user?.username || 'Collector',
        name: user?.name || null,
        avatar_url: user?.avatar_url || null
      },
      share_token: shareToken
    })
  } catch (error) {
    console.error('Error fetching shared wrapped:', error)
    res.status(500).json({ error: 'Failed to fetch wrapped stats' })
  }
})

module.exports = router
