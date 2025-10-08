const express = require('express')
const { PrismaClient } = require('@prisma/client')
const { sanitizeParams } = require('../middleware/inputSanitization')
const { optionalAuthMiddleware } = require('../middleware/auth')
const router = express.Router()
const prisma = new PrismaClient()

// Helper function to create slug from list name
function createListSlug(name) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

// GET /:username/:listSlug - Public list viewing (optional auth for ownership info)
router.get('/:username/:listSlug', optionalAuthMiddleware, sanitizeParams, async (req, res) => {
  try {
    const { username, listSlug } = req.params
    const viewerId = req.user?.id // Optional - may be null if not authenticated
    console.log(`🔍 Fetching public list: username=${username}, listSlug=${listSlug}, viewer=${viewerId || 'anonymous'}`)

    // First, find the user by username
    const userResult = await prisma.$queryRaw`
      SELECT user_id
      FROM [user]
      WHERE username = ${username.toLowerCase()}
        AND is_active = 1
    `
    console.log(`✅ User query result:`, userResult.length > 0 ? `Found user_id ${userResult[0].user_id}` : 'No user found')

    if (userResult.length === 0) {
      return res.status(404).json({
        error: 'Not found',
        message: 'User not found'
      })
    }

    const userId = Number(userResult[0].user_id)

    // Get user's full name for the owner info
    const ownerInfo = await prisma.$queryRaw`
      SELECT first_name, last_name, username
      FROM [user]
      WHERE user_id = ${BigInt(userId)}
    `

    // Get all user's public lists and find the one matching the slug
    const listsResult = await prisma.$queryRaw`
      SELECT user_list_id, name, summary, card_count, created, is_public
      FROM user_list
      WHERE [user] = ${BigInt(userId)}
        AND is_public = 1
    `
    console.log(`✅ Lists query result: Found ${listsResult.length} public lists`)

    // Find the list that matches the slug
    const list = listsResult.find(row => {
      const rowSlug = createListSlug(row.name)
      console.log(`  - Comparing "${rowSlug}" with "${listSlug}"`)
      return rowSlug === listSlug
    })

    if (!list) {
      console.log(`❌ No list matched slug "${listSlug}"`)
      return res.status(404).json({
        error: 'Not found',
        message: 'List not found or is private'
      })
    }

    const listId = Number(list.user_list_id)
    console.log(`✅ Found list: ${list.name} (ID: ${listId})`)

    // Get cards in the list with full details
    console.log(`🔍 Fetching cards for list ID ${listId}...`)

    // Build the ownership subquery conditionally
    let cardsResult
    if (viewerId) {
      cardsResult = await prisma.$queryRaw`
        SELECT
          c.card_id,
          c.card_number,
          c.is_rookie,
          c.is_autograph,
          c.is_relic,
          c.print_run,
          s.series_id,
          s.name as series_name,
          set_info.name as set_name,
          set_info.year as set_year,
          LOWER(REPLACE(REPLACE(REPLACE(s.name, ' ', '-'), '''', ''), '/', '-')) as series_slug,
          LOWER(REPLACE(REPLACE(REPLACE(set_info.name, ' ', '-'), '''', ''), '/', '-')) as set_slug,
          STRING_AGG(CONCAT(p.first_name, ' ', p.last_name), ', ') WITHIN GROUP (ORDER BY p.last_name, p.first_name) as player_name,
          STRING_AGG(CAST(p.player_id AS NVARCHAR), ',') WITHIN GROUP (ORDER BY p.last_name, p.first_name) as player_ids,
          (SELECT TOP 1 t.name
           FROM card_player_team cpt2
           INNER JOIN player_team pt2 ON cpt2.player_team = pt2.player_team_id
           INNER JOIN team t ON pt2.team = t.team_Id
           WHERE cpt2.card = c.card_id) as team_name,
          (SELECT TOP 1 t.primary_color
           FROM card_player_team cpt2
           INNER JOIN player_team pt2 ON cpt2.player_team = pt2.player_team_id
           INNER JOIN team t ON pt2.team = t.team_Id
           WHERE cpt2.card = c.card_id) as team_color,
          color.name as color_name,
          (SELECT COUNT(*) FROM user_card uc WHERE uc.card = c.card_id AND uc.[user] = ${BigInt(viewerId)}) as owned_count
        FROM user_list_card ulc
        INNER JOIN card c ON ulc.card = c.card_id
        LEFT JOIN series s ON c.series = s.series_id
        LEFT JOIN [set] set_info ON s.[set] = set_info.set_id
        LEFT JOIN card_player_team cpt ON c.card_id = cpt.card
        LEFT JOIN player_team pt ON cpt.player_team = pt.player_team_id
        LEFT JOIN player p ON pt.player = p.player_id
        LEFT JOIN color ON c.color = color.color_id
        WHERE ulc.user_list = ${BigInt(listId)}
        GROUP BY
          c.card_id, c.card_number, c.is_rookie, c.is_autograph, c.is_relic, c.print_run,
          s.series_id, s.name, set_info.name, set_info.year, color.name
        ORDER BY c.card_number ASC
      `
    } else {
      cardsResult = await prisma.$queryRaw`
        SELECT
          c.card_id,
          c.card_number,
          c.is_rookie,
          c.is_autograph,
          c.is_relic,
          c.print_run,
          s.series_id,
          s.name as series_name,
          set_info.name as set_name,
          set_info.year as set_year,
          LOWER(REPLACE(REPLACE(REPLACE(s.name, ' ', '-'), '''', ''), '/', '-')) as series_slug,
          LOWER(REPLACE(REPLACE(REPLACE(set_info.name, ' ', '-'), '''', ''), '/', '-')) as set_slug,
          STRING_AGG(CONCAT(p.first_name, ' ', p.last_name), ', ') WITHIN GROUP (ORDER BY p.last_name, p.first_name) as player_name,
          STRING_AGG(CAST(p.player_id AS NVARCHAR), ',') WITHIN GROUP (ORDER BY p.last_name, p.first_name) as player_ids,
          (SELECT TOP 1 t.name
           FROM card_player_team cpt2
           INNER JOIN player_team pt2 ON cpt2.player_team = pt2.player_team_id
           INNER JOIN team t ON pt2.team = t.team_Id
           WHERE cpt2.card = c.card_id) as team_name,
          (SELECT TOP 1 t.primary_color
           FROM card_player_team cpt2
           INNER JOIN player_team pt2 ON cpt2.player_team = pt2.player_team_id
           INNER JOIN team t ON pt2.team = t.team_Id
           WHERE cpt2.card = c.card_id) as team_color,
          color.name as color_name,
          0 as owned_count
        FROM user_list_card ulc
        INNER JOIN card c ON ulc.card = c.card_id
        LEFT JOIN series s ON c.series = s.series_id
        LEFT JOIN [set] set_info ON s.[set] = set_info.set_id
        LEFT JOIN card_player_team cpt ON c.card_id = cpt.card
        LEFT JOIN player_team pt ON cpt.player_team = pt.player_team_id
        LEFT JOIN player p ON pt.player = p.player_id
        LEFT JOIN color ON c.color = color.color_id
        WHERE ulc.user_list = ${BigInt(listId)}
        GROUP BY
          c.card_id, c.card_number, c.is_rookie, c.is_autograph, c.is_relic, c.print_run,
          s.series_id, s.name, set_info.name, set_info.year, color.name
        ORDER BY c.card_number ASC
      `
    }

    console.log(`✅ Cards query result: Found ${cardsResult.length} cards`)

    // Serialize cards - format for CardTable component
    const cards = cardsResult.map(row => {
      // Parse player names and IDs
      const playerNames = (row.player_name || 'Unknown Player').split(', ')
      const playerIds = row.player_ids ? row.player_ids.split(',') : []

      // Build card_player_teams array expected by CardTable
      const card_player_teams = playerNames.map((name, index) => {
        const [firstName, ...lastNameParts] = name.split(' ')
        return {
          player: {
            player_id: playerIds[index] ? Number(playerIds[index]) : null,
            first_name: firstName || '',
            last_name: lastNameParts.join(' ') || ''
          },
          team: row.team_name ? {
            name: row.team_name,
            primary_color: row.team_color,
            secondary_color: null,
            abbreviation: null
          } : null
        }
      })

      return {
        card_id: Number(row.card_id),
        card_number: row.card_number,
        is_rookie: row.is_rookie,
        is_autograph: row.is_autograph,
        is_relic: row.is_relic,
        print_run: row.print_run ? Number(row.print_run) : null,
        series_rel: {
          series_id: row.series_id ? Number(row.series_id) : null,
          name: row.series_name,
          slug: row.series_slug,
          set_name: row.set_name,
          set_year: row.set_year,
          set_slug: row.set_slug
        },
        color: row.color_name ? { name: row.color_name } : null,
        card_player_teams,
        user_card_count: Number(row.owned_count || 0)
      }
    })

    res.json({
      list: {
        user_list_id: listId,
        slug: listSlug,
        name: list.name,
        summary: list.summary || '',
        card_count: list.card_count || 0,
        created: list.created,
        is_public: Boolean(list.is_public)
      },
      owner: ownerInfo.length > 0 ? {
        first_name: ownerInfo[0].first_name,
        last_name: ownerInfo[0].last_name,
        username: ownerInfo[0].username
      } : null,
      cards
    })
  } catch (error) {
    console.error('❌ Error fetching public list:', error.message)
    console.error('Stack trace:', error.stack)
    res.status(500).json({
      error: 'Database error',
      message: 'Failed to fetch list',
      details: error.message
    })
  }
})

module.exports = router
