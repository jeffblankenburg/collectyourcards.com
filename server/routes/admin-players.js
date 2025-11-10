const express = require('express')
const { authMiddleware, requireAdmin, requireDataAdmin, requireSuperAdmin } = require('../middleware/auth')
const router = express.Router()
const { prisma } = require('../config/prisma-singleton')

// Apply authentication and data admin requirements to all routes
router.use(authMiddleware)
router.use(requireDataAdmin)

// Helper function to generate URL slug from player name
function generateSlug(name) {
  if (!name) return 'unknown'
  return name
    .toLowerCase()
    .replace(/&/g, 'and') // Convert ampersands to "and" to preserve semantic meaning
    .replace(/'/g, '') // Remove apostrophes completely
    .replace(/[^a-z0-9]+/g, '-') // Replace other special chars with hyphens
    .replace(/^-|-$/g, '') // Remove leading/trailing hyphens
}

// GET /api/admin/players - Get players list with stats
router.get('/', async (req, res) => {
  try {
    const { limit = 100, offset = 0, search, zeroCards, duplicates } = req.query
    const limitNum = Math.min(parseInt(limit) || 100, 500)
    const offsetNum = parseInt(offset) || 0
    const showZeroCardsOnly = zeroCards === 'true'
    const showDuplicatesOnly = duplicates === 'true'

    console.log('Admin: Getting players list', { limit: limitNum, offset: offsetNum, search, zeroCards: showZeroCardsOnly, duplicates: showDuplicatesOnly })

    let players

    if (showDuplicatesOnly) {
      // Duplicates mode: find players with similar names and show their matches
      players = await prisma.$queryRawUnsafe(`
        WITH PlayerNames AS (
          SELECT
            p.player_id,
            p.first_name,
            p.last_name,
            p.nick_name,
            p.birthdate,
            p.is_hof,
            p.card_count,
            SOUNDEX(p.last_name) as last_soundex,
            SOUNDEX(p.first_name) as first_soundex,
            SOUNDEX(p.nick_name) as nick_soundex
          FROM player p
        ),
        DuplicatePairs AS (
          SELECT
            p1.player_id as player1_id,
            p2.player_id as player2_id,
            p1.last_name as last_name,
            MIN(p1.player_id) OVER (PARTITION BY
              CASE WHEN p1.player_id < p2.player_id THEN p1.player_id ELSE p2.player_id END,
              CASE WHEN p1.player_id < p2.player_id THEN p2.player_id ELSE p1.player_id END
            ) as group_id
          FROM PlayerNames p1
          INNER JOIN PlayerNames p2 ON p1.player_id <> p2.player_id
          WHERE (
            p1.last_soundex = p2.last_soundex
            AND (
              p1.first_soundex = p2.first_soundex
              OR p1.first_name = p2.nick_name
              OR p1.nick_name = p2.first_name
              OR (
                LEN(p1.first_name) > 3
                AND LEN(p2.first_name) > 3
                AND ABS(LEN(p1.first_name) - LEN(p2.first_name)) <= 2
                AND (
                  LEFT(p1.first_name, 3) = LEFT(p2.first_name, 3)
                  OR p1.first_soundex = p2.first_soundex
                )
              )
            )
          )
        ),
        AllDuplicatePlayers AS (
          SELECT DISTINCT
            player1_id as player_id,
            last_name
          FROM DuplicatePairs
          UNION
          SELECT DISTINCT
            player2_id as player_id,
            last_name
          FROM DuplicatePairs
        )
        SELECT
          p.player_id,
          p.first_name,
          p.last_name,
          p.nick_name,
          p.birthdate,
          p.is_hof,
          p.card_count,
          NULL as last_viewed,
          STRING_AGG(CAST(pt.player_team_id as varchar(20)) + '|' + CAST(t.team_Id as varchar(10)) + '|' + ISNULL(t.abbreviation, '?') + '|' + ISNULL(t.primary_color, '#666') + '|' + ISNULL(t.secondary_color, '#999') + '|' + ISNULL(t.name, 'Unknown'), '~') as teams_data,
          (
            SELECT STRING_AGG(CAST(p2.player_id as varchar(20)) + ':' + ISNULL(p2.first_name, '') + ':' + ISNULL(p2.last_name, '') + ':' + ISNULL(p2.nick_name, ''), '|')
            FROM DuplicatePairs dp
            JOIN player p2 ON (dp.player2_id = p2.player_id AND dp.player1_id = p.player_id)
            WHERE dp.player1_id = p.player_id
          ) as duplicate_matches
        FROM AllDuplicatePlayers adp
        JOIN player p ON adp.player_id = p.player_id
        LEFT JOIN player_team pt ON p.player_id = pt.player
        LEFT JOIN team t ON pt.team = t.team_Id
        ${search && search.trim() ? `WHERE (
          p.first_name LIKE '%${search.trim()}%' COLLATE Latin1_General_CI_AI
          OR p.last_name LIKE '%${search.trim()}%' COLLATE Latin1_General_CI_AI
          OR p.nick_name LIKE '%${search.trim()}%' COLLATE Latin1_General_CI_AI
          OR CONCAT(p.first_name, ' ', p.last_name) LIKE '%${search.trim()}%' COLLATE Latin1_General_CI_AI
        )` : ''}
        GROUP BY p.player_id, p.first_name, p.last_name, p.nick_name, p.birthdate, p.is_hof, p.card_count
        ORDER BY p.last_name, p.first_name
        OFFSET ${offsetNum} ROWS
        FETCH NEXT ${limitNum} ROWS ONLY
      `)
    } else if (showZeroCardsOnly) {
      // Zero cards mode: show only players with 0 cards
      const normalizedSearch = search ? search.trim().replace(/[.''\-]/g, '') : ''
      const escapedSearch = search ? search.trim().replace(/'/g, "''") : ''
      const escapedNormalized = normalizedSearch.replace(/'/g, "''")

      players = await prisma.$queryRawUnsafe(`
        SELECT
          p.player_id,
          p.first_name,
          p.last_name,
          p.nick_name,
          p.birthdate,
          p.is_hof,
          p.card_count,
          NULL as last_viewed,
          STRING_AGG(CAST(pt.player_team_id as varchar(20)) + '|' + CAST(t.team_Id as varchar(10)) + '|' + ISNULL(t.abbreviation, '?') + '|' + ISNULL(t.primary_color, '#666') + '|' + ISNULL(t.secondary_color, '#999') + '|' + ISNULL(t.name, 'Unknown'), '~') as teams_data
        FROM player p
        LEFT JOIN player_team pt ON p.player_id = pt.player
        LEFT JOIN team t ON pt.team = t.team_Id
        WHERE (p.card_count = 0 OR p.card_count IS NULL)
        ${search && search.trim() ? `AND (
          p.first_name LIKE N'%${escapedSearch}%' COLLATE Latin1_General_CI_AI
          OR p.last_name LIKE N'%${escapedSearch}%' COLLATE Latin1_General_CI_AI
          OR p.nick_name LIKE N'%${escapedSearch}%' COLLATE Latin1_General_CI_AI
          OR CONCAT(p.first_name, ' ', p.last_name) LIKE N'%${escapedSearch}%' COLLATE Latin1_General_CI_AI
          OR CONCAT(p.nick_name, ' ', p.last_name) LIKE N'%${escapedSearch}%' COLLATE Latin1_General_CI_AI
          OR REPLACE(REPLACE(REPLACE(p.first_name, '.', ''), CHAR(39), ''), '-', '') LIKE N'%${escapedNormalized}%' COLLATE Latin1_General_CI_AI
          OR REPLACE(REPLACE(REPLACE(p.last_name, '.', ''), CHAR(39), ''), '-', '') LIKE N'%${escapedNormalized}%' COLLATE Latin1_General_CI_AI
          OR REPLACE(REPLACE(REPLACE(p.nick_name, '.', ''), CHAR(39), ''), '-', '') LIKE N'%${escapedNormalized}%' COLLATE Latin1_General_CI_AI
          OR REPLACE(REPLACE(REPLACE(CONCAT(p.first_name, ' ', p.last_name), '.', ''), CHAR(39), ''), '-', '') LIKE N'%${escapedNormalized}%' COLLATE Latin1_General_CI_AI
          OR REPLACE(REPLACE(REPLACE(CONCAT(p.nick_name, ' ', p.last_name), '.', ''), CHAR(39), ''), '-', '') LIKE N'%${escapedNormalized}%' COLLATE Latin1_General_CI_AI
        )` : ''}
        GROUP BY p.player_id, p.first_name, p.last_name, p.nick_name, p.birthdate, p.is_hof, p.card_count
        ORDER BY p.last_name, p.first_name
        OFFSET ${offsetNum} ROWS
        FETCH NEXT ${limitNum} ROWS ONLY
      `)
    } else if (search && search.trim()) {
      // Search mode: search by player name - get players with team data optimized
      const searchTerm = search.trim()
      // Normalize search term by removing punctuation
      const normalizedSearch = searchTerm.replace(/[.''\-]/g, '')

      // Escape single quotes for SQL
      const escapedSearch = searchTerm.replace(/'/g, "''")
      const escapedNormalized = normalizedSearch.replace(/'/g, "''")

      players = await prisma.$queryRawUnsafe(`
        SELECT
          p.player_id,
          p.first_name,
          p.last_name,
          p.nick_name,
          p.birthdate,
          p.is_hof,
          p.card_count,
          NULL as last_viewed,
          STRING_AGG(CAST(pt.player_team_id as varchar(20)) + '|' + CAST(t.team_Id as varchar(10)) + '|' + ISNULL(t.abbreviation, '?') + '|' + ISNULL(t.primary_color, '#666') + '|' + ISNULL(t.secondary_color, '#999') + '|' + ISNULL(t.name, 'Unknown'), '~') as teams_data
        FROM player p
        LEFT JOIN player_team pt ON p.player_id = pt.player
        LEFT JOIN team t ON pt.team = t.team_Id
        WHERE (
          p.first_name LIKE N'%${escapedSearch}%' COLLATE Latin1_General_CI_AI
          OR p.last_name LIKE N'%${escapedSearch}%' COLLATE Latin1_General_CI_AI
          OR p.nick_name LIKE N'%${escapedSearch}%' COLLATE Latin1_General_CI_AI
          OR CONCAT(p.first_name, ' ', p.last_name) LIKE N'%${escapedSearch}%' COLLATE Latin1_General_CI_AI
          OR CONCAT(p.nick_name, ' ', p.last_name) LIKE N'%${escapedSearch}%' COLLATE Latin1_General_CI_AI
          OR REPLACE(REPLACE(REPLACE(p.first_name, '.', ''), CHAR(39), ''), '-', '') LIKE N'%${escapedNormalized}%' COLLATE Latin1_General_CI_AI
          OR REPLACE(REPLACE(REPLACE(p.last_name, '.', ''), CHAR(39), ''), '-', '') LIKE N'%${escapedNormalized}%' COLLATE Latin1_General_CI_AI
          OR REPLACE(REPLACE(REPLACE(p.nick_name, '.', ''), CHAR(39), ''), '-', '') LIKE N'%${escapedNormalized}%' COLLATE Latin1_General_CI_AI
          OR REPLACE(REPLACE(REPLACE(CONCAT(p.first_name, ' ', p.last_name), '.', ''), CHAR(39), ''), '-', '') LIKE N'%${escapedNormalized}%' COLLATE Latin1_General_CI_AI
          OR REPLACE(REPLACE(REPLACE(CONCAT(p.nick_name, ' ', p.last_name), '.', ''), CHAR(39), ''), '-', '') LIKE N'%${escapedNormalized}%' COLLATE Latin1_General_CI_AI
        )
        GROUP BY p.player_id, p.first_name, p.last_name, p.nick_name, p.birthdate, p.is_hof, p.card_count
        ORDER BY p.last_name, p.first_name
        OFFSET ${offsetNum} ROWS
        FETCH NEXT ${limitNum} ROWS ONLY
      `)
    } else {
      // Default mode: most recently viewed players with team data optimized
      players = await prisma.$queryRawUnsafe(`
        SELECT 
          p.player_id,
          p.first_name,
          p.last_name,
          p.nick_name,
          p.birthdate,
          p.is_hof,
          p.card_count,
          MAX(up.created) as last_viewed,
          STRING_AGG(CAST(pt.player_team_id as varchar(20)) + '|' + CAST(t.team_Id as varchar(10)) + '|' + ISNULL(t.abbreviation, '?') + '|' + ISNULL(t.primary_color, '#666') + '|' + ISNULL(t.secondary_color, '#999') + '|' + ISNULL(t.name, 'Unknown'), '~') as teams_data
        FROM user_player up
        LEFT JOIN player p ON p.player_id = up.player
        LEFT JOIN player_team pt ON p.player_id = pt.player
        LEFT JOIN team t ON pt.team = t.team_Id
        WHERE p.player_id IS NOT NULL
        GROUP BY p.player_id, p.first_name, p.last_name, p.nick_name, p.birthdate, p.is_hof, p.card_count
        ORDER BY last_viewed DESC
        OFFSET ${offsetNum} ROWS
        FETCH NEXT ${limitNum} ROWS ONLY
      `)
    }

    // Get total count for pagination
    let totalCount = 0
    if (showDuplicatesOnly) {
      const totalCountResult = await prisma.$queryRawUnsafe(`
        WITH PlayerNames AS (
          SELECT
            p.player_id,
            p.first_name,
            p.last_name,
            p.nick_name,
            SOUNDEX(p.last_name) as last_soundex,
            SOUNDEX(p.first_name) as first_soundex,
            SOUNDEX(p.nick_name) as nick_soundex
          FROM player p
        )
        SELECT COUNT(DISTINCT p1.player_id) as total
        FROM PlayerNames p1
        INNER JOIN PlayerNames p2 ON p1.player_id < p2.player_id
        WHERE (
          p1.last_soundex = p2.last_soundex
          AND (
            p1.first_soundex = p2.first_soundex
            OR p1.first_name = p2.nick_name
            OR p1.nick_name = p2.first_name
            OR (
              LEN(p1.first_name) > 3
              AND LEN(p2.first_name) > 3
              AND ABS(LEN(p1.first_name) - LEN(p2.first_name)) <= 2
              AND (
                LEFT(p1.first_name, 3) = LEFT(p2.first_name, 3)
                OR p1.first_soundex = p2.first_soundex
              )
            )
          )
        )
        ${search && search.trim() ? `AND (
          p1.first_name LIKE '%${search.trim()}%' COLLATE Latin1_General_CI_AI
          OR p1.last_name LIKE '%${search.trim()}%' COLLATE Latin1_General_CI_AI
          OR p1.nick_name LIKE '%${search.trim()}%' COLLATE Latin1_General_CI_AI
          OR CONCAT(p1.first_name, ' ', p1.last_name) LIKE '%${search.trim()}%' COLLATE Latin1_General_CI_AI
        )` : ''}
      `)
      totalCount = Number(totalCountResult[0].total)
    } else if (showZeroCardsOnly) {
      const totalCountResult = await prisma.$queryRawUnsafe(`
        SELECT COUNT(*) as total
        FROM player p
        WHERE (p.card_count = 0 OR p.card_count IS NULL)
        ${search && search.trim() ? `AND (
          p.first_name LIKE '%${search.trim()}%' COLLATE Latin1_General_CI_AI
          OR p.last_name LIKE '%${search.trim()}%' COLLATE Latin1_General_CI_AI
          OR p.nick_name LIKE '%${search.trim()}%' COLLATE Latin1_General_CI_AI
          OR CONCAT(p.first_name, ' ', p.last_name) LIKE '%${search.trim()}%' COLLATE Latin1_General_CI_AI
        )` : ''}
      `)
      totalCount = Number(totalCountResult[0].total)
    } else if (search && search.trim()) {
      const searchTerm = search.trim()
      const totalCountResult = await prisma.$queryRawUnsafe(`
        SELECT COUNT(*) as total
        FROM player p
        WHERE (
          p.first_name LIKE '%${searchTerm}%' COLLATE Latin1_General_CI_AI
          OR p.last_name LIKE '%${searchTerm}%' COLLATE Latin1_General_CI_AI
          OR p.nick_name LIKE '%${searchTerm}%' COLLATE Latin1_General_CI_AI
          OR CONCAT(p.first_name, ' ', p.last_name) LIKE '%${searchTerm}%' COLLATE Latin1_General_CI_AI
          OR CONCAT(p.nick_name, ' ', p.last_name) LIKE '%${searchTerm}%' COLLATE Latin1_General_CI_AI
        )
      `)
      totalCount = Number(totalCountResult[0].total)
    } else {
      // For recently viewed, we limit to 100 anyway
      totalCount = Math.min(players.length, 100)
    }

    // Serialize BigInt values and parse optimized team data
    const serializedPlayers = players.map(player => {
      // Parse teams data from simplified STRING_AGG result
      let teams = []
      if (player.teams_data) {
        const teamStrings = player.teams_data.split('~')
        teams = teamStrings.map(teamStr => {
          const [player_team_id, team_id, abbreviation, primary_color, secondary_color, name] = teamStr.split('|')
          return {
            player_team_id: Number(player_team_id),
            team_id: Number(team_id),
            abbreviation: abbreviation || '?',
            primary_color: primary_color || '#666',
            secondary_color: secondary_color || '#999',
            name: name || 'Unknown Team'
          }
        }).filter(team => team.team_id) // Filter out any malformed entries
      }

      // Parse duplicate matches if present
      let duplicateMatches = []
      if (player.duplicate_matches) {
        const matchStrings = player.duplicate_matches.split('|')
        duplicateMatches = matchStrings.map(matchStr => {
          const [player_id, first_name, last_name, nick_name] = matchStr.split(':')
          return {
            player_id: Number(player_id),
            first_name: first_name || '',
            last_name: last_name || '',
            nick_name: nick_name || ''
          }
        }).filter(match => match.player_id)
      }

      return {
        player_id: Number(player.player_id),
        first_name: player.first_name,
        last_name: player.last_name,
        nick_name: player.nick_name,
        birthdate: player.birthdate,
        is_hof: Boolean(player.is_hof),
        card_count: Number(player.card_count || 0),
        teams: teams,
        team_count: teams.length,
        last_viewed: player.last_viewed,
        duplicate_matches: duplicateMatches.length > 0 ? duplicateMatches : undefined
      }
    })

    res.json({
      players: serializedPlayers,
      total: totalCount,
      limit: limitNum,
      offset: offsetNum,
      hasMore: (offsetNum + limitNum) < totalCount
    })

  } catch (error) {
    console.error('Error fetching admin players:', error)
    res.status(500).json({
      error: 'Database error',
      message: 'Failed to fetch players',
      details: error.message
    })
  }
})

// GET /api/admin/players/:id - Get specific player details
router.get('/:id', async (req, res) => {
  try {
    const playerId = parseInt(req.params.id)
    
    if (isNaN(playerId)) {
      return res.status(400).json({ error: 'Invalid player ID' })
    }

    const player = await prisma.player.findUnique({
      where: { player_id: playerId }
    })

    if (!player) {
      return res.status(404).json({ error: 'Player not found' })
    }

    res.json({
      player: {
        player_id: Number(player.player_id),
        first_name: player.first_name,
        last_name: player.last_name,
        nick_name: player.nick_name,
        birthdate: player.birthdate,
        is_hof: Boolean(player.is_hof),
        card_count: Number(player.card_count || 0)
      }
    })

  } catch (error) {
    console.error('Error fetching player:', error)
    res.status(500).json({
      error: 'Database error',
      message: 'Failed to fetch player',
      details: error.message
    })
  }
})

// GET /api/admin/players/:id/teams - Get teams for a player
router.get('/:id/teams', async (req, res) => {
  try {
    const playerId = parseInt(req.params.id)
    
    if (isNaN(playerId)) {
      return res.status(400).json({ error: 'Invalid player ID' })
    }

    const teams = await prisma.$queryRawUnsafe(`
      SELECT
        pt.player_team_id,
        t.team_Id,
        t.name,
        t.abbreviation,
        t.primary_color,
        t.secondary_color,
        COUNT(DISTINCT c.card_id) as card_count
      FROM team t
      JOIN player_team pt ON t.team_Id = pt.team
      LEFT JOIN card_player_team cpt ON pt.player_team_id = cpt.player_team
      LEFT JOIN card c ON cpt.card = c.card_id
      WHERE pt.player = ${playerId}
      GROUP BY pt.player_team_id, t.team_Id, t.name, t.abbreviation, t.primary_color, t.secondary_color
      ORDER BY t.name
    `)

    // Serialize BigInt values
    const serializedTeams = teams.map(team => ({
      player_team_id: Number(team.player_team_id),
      team_id: Number(team.team_Id),
      name: team.name,
      abbreviation: team.abbreviation,
      primary_color: team.primary_color,
      secondary_color: team.secondary_color,
      card_count: Number(team.card_count || 0)
    }))

    res.json({
      teams: serializedTeams
    })

  } catch (error) {
    console.error('Error fetching player teams:', error)
    res.status(500).json({
      error: 'Database error',
      message: 'Failed to fetch player teams',
      details: error.message
    })
  }
})

// POST /api/admin/players - Create new player
router.post('/', async (req, res) => {
  try {
    const { first_name, last_name, nick_name, birthdate, is_hof } = req.body

    if (!first_name?.trim() && !last_name?.trim() && !nick_name?.trim()) {
      return res.status(400).json({
        error: 'Validation failed',
        message: 'At least one name field (first name, last name, or nickname) is required'
      })
    }

    // Note: We allow duplicate player names since players across different sports,
    // teams, and eras can have the same name (e.g., Mike Johnson in baseball and football)
    // Any true duplicates can be cleaned up manually later

    // Generate slug from full name or nickname
    const trimmedFirstName = first_name?.trim() || ''
    const trimmedLastName = last_name?.trim() || ''
    const trimmedNickName = nick_name?.trim() || ''

    let fullName = ''
    if (trimmedFirstName && trimmedLastName) {
      fullName = `${trimmedFirstName} ${trimmedLastName}`
    } else if (trimmedNickName) {
      fullName = trimmedNickName
    } else if (trimmedFirstName) {
      fullName = trimmedFirstName
    } else if (trimmedLastName) {
      fullName = trimmedLastName
    }

    const slug = generateSlug(fullName)

    const newPlayer = await prisma.player.create({
      data: {
        first_name: trimmedFirstName || null,
        last_name: trimmedLastName || null,
        nick_name: trimmedNickName || null,
        slug: slug,
        birthdate: birthdate ? new Date(birthdate) : null,
        is_hof: Boolean(is_hof),
        card_count: 0 // Start with 0 cards
      }
    })

    console.log('Admin: Created new player:', newPlayer.first_name, newPlayer.last_name)

    res.status(201).json({
      player: {
        player_id: Number(newPlayer.player_id),
        first_name: newPlayer.first_name,
        last_name: newPlayer.last_name,
        nick_name: newPlayer.nick_name,
        birthdate: newPlayer.birthdate,
        is_hof: Boolean(newPlayer.is_hof),
        card_count: Number(newPlayer.card_count)
      },
      message: 'Player created successfully'
    })

  } catch (error) {
    console.error('Error creating player:', error)
    res.status(500).json({
      error: 'Database error',
      message: 'Failed to create player',
      details: error.message
    })
  }
})

// PUT /api/admin/players/:id - Update player
router.put('/:id', async (req, res) => {
  try {
    const playerId = parseInt(req.params.id)
    const { first_name, last_name, nick_name, birthdate, is_hof } = req.body

    if (isNaN(playerId)) {
      return res.status(400).json({ error: 'Invalid player ID' })
    }

    if (!first_name?.trim() && !last_name?.trim() && !nick_name?.trim()) {
      return res.status(400).json({
        error: 'Validation failed',
        message: 'At least one name field (first name, last name, or nickname) is required'
      })
    }

    // Check if player exists
    const existingPlayer = await prisma.player.findUnique({
      where: { player_id: playerId }
    })

    if (!existingPlayer) {
      return res.status(404).json({ error: 'Player not found' })
    }

    // Note: We allow duplicate player names since players across different sports,
    // teams, and eras can have the same name (e.g., Mike Johnson in baseball and football)
    // Any true duplicates can be cleaned up manually later

    // Regenerate slug from updated name
    const trimmedFirstName = first_name?.trim() || ''
    const trimmedLastName = last_name?.trim() || ''
    const trimmedNickName = nick_name?.trim() || ''

    let fullName = ''
    if (trimmedFirstName && trimmedLastName) {
      fullName = `${trimmedFirstName} ${trimmedLastName}`
    } else if (trimmedNickName) {
      fullName = trimmedNickName
    } else if (trimmedFirstName) {
      fullName = trimmedFirstName
    } else if (trimmedLastName) {
      fullName = trimmedLastName
    }

    const slug = generateSlug(fullName)

    const updatedPlayer = await prisma.player.update({
      where: { player_id: playerId },
      data: {
        first_name: trimmedFirstName || null,
        last_name: trimmedLastName || null,
        nick_name: trimmedNickName || null,
        slug: slug,
        birthdate: birthdate ? new Date(birthdate) : null,
        is_hof: Boolean(is_hof)
      }
    })

    console.log('Admin: Updated player:', updatedPlayer.first_name, updatedPlayer.last_name)

    res.json({
      player: {
        player_id: Number(updatedPlayer.player_id),
        first_name: updatedPlayer.first_name,
        last_name: updatedPlayer.last_name,
        nick_name: updatedPlayer.nick_name,
        birthdate: updatedPlayer.birthdate,
        is_hof: Boolean(updatedPlayer.is_hof),
        card_count: Number(updatedPlayer.card_count)
      },
      message: 'Player updated successfully'
    })

  } catch (error) {
    console.error('Error updating player:', error)
    res.status(500).json({
      error: 'Database error',
      message: 'Failed to update player',
      details: error.message
    })
  }
})

// POST /api/admin/players/:id/teams - Add team to player
router.post('/:id/teams', async (req, res) => {
  try {
    const playerId = parseInt(req.params.id)
    const { team_id } = req.body

    if (isNaN(playerId) || isNaN(team_id)) {
      return res.status(400).json({ error: 'Invalid player ID or team ID' })
    }

    // Check if relationship already exists
    const existingRelation = await prisma.player_team.findFirst({
      where: {
        player: playerId,
        team: team_id
      }
    })

    if (existingRelation) {
      return res.status(409).json({
        error: 'Relationship exists',
        message: 'Player is already assigned to this team'
      })
    }

    // Create the relationship
    const newRelation = await prisma.player_team.create({
      data: {
        player: playerId,
        team: team_id
      }
    })

    console.log('Admin: Added team', team_id, 'to player', playerId)

    res.status(201).json({
      player_team_id: Number(newRelation.player_team_id),
      message: 'Team added to player successfully'
    })

  } catch (error) {
    console.error('Error adding team to player:', error)
    res.status(500).json({
      error: 'Database error',
      message: 'Failed to add team to player',
      details: error.message
    })
  }
})

// DELETE /api/admin/players/:id/teams/:teamId - Remove team from player
router.delete('/:id/teams/:teamId', async (req, res) => {
  try {
    const playerId = parseInt(req.params.id)
    const teamId = parseInt(req.params.teamId)

    if (isNaN(playerId) || isNaN(teamId)) {
      return res.status(400).json({ error: 'Invalid player ID or team ID' })
    }

    // Check if there are cards for this player-team combination
    const cardCount = await prisma.$queryRawUnsafe(`
      SELECT COUNT(*) as count
      FROM card_player_team cpt
      JOIN player_team pt ON cpt.player_team = pt.player_team_id
      WHERE pt.player = ${playerId} AND pt.team = ${teamId}
    `)

    if (Number(cardCount[0].count) > 0) {
      return res.status(400).json({
        error: 'Cannot remove team',
        message: `This player has ${cardCount[0].count} cards assigned to this team. Please reassign the cards first.`,
        cardCount: Number(cardCount[0].count)
      })
    }

    // Remove the relationship
    const deleteResult = await prisma.player_team.deleteMany({
      where: {
        player: playerId,
        team: teamId
      }
    })

    if (deleteResult.count === 0) {
      return res.status(404).json({
        error: 'Relationship not found',
        message: 'Player is not assigned to this team'
      })
    }

    console.log('Admin: Removed team', teamId, 'from player', playerId)

    res.json({
      message: 'Team removed from player successfully',
      removedCount: deleteResult.count
    })

  } catch (error) {
    console.error('Error removing team from player:', error)
    res.status(500).json({
      error: 'Database error',
      message: 'Failed to remove team from player',
      details: error.message
    })
  }
})

// POST /api/admin/players/:id/reassign-cards - Reassign all cards from one team to another
router.post('/:id/reassign-cards', async (req, res) => {
  try {
    const playerId = parseInt(req.params.id)
    const { from_team_id, to_team_id } = req.body

    if (isNaN(playerId) || isNaN(from_team_id) || isNaN(to_team_id)) {
      return res.status(400).json({ error: 'Invalid player ID or team IDs' })
    }

    if (from_team_id === to_team_id) {
      return res.status(400).json({ 
        error: 'Invalid request',
        message: 'Source and destination teams cannot be the same'
      })
    }

    // Get the player-team IDs
    const fromPlayerTeam = await prisma.player_team.findFirst({
      where: { player: playerId, team: from_team_id }
    })

    const toPlayerTeam = await prisma.player_team.findFirst({
      where: { player: playerId, team: to_team_id }
    })

    if (!fromPlayerTeam) {
      return res.status(400).json({
        error: 'Invalid source team',
        message: 'Player is not assigned to the source team'
      })
    }

    if (!toPlayerTeam) {
      return res.status(400).json({
        error: 'Invalid destination team',
        message: 'Player is not assigned to the destination team. Please add the team first.'
      })
    }

    // Count cards to be reassigned
    const cardCountResult = await prisma.$queryRawUnsafe(`
      SELECT COUNT(*) as count
      FROM card_player_team 
      WHERE player_team = ${fromPlayerTeam.player_team_id}
    `)
    const cardsToReassign = Number(cardCountResult[0].count)

    if (cardsToReassign === 0) {
      return res.status(400).json({
        error: 'No cards to reassign',
        message: 'Player has no cards assigned to the source team'
      })
    }

    // Perform the reassignment
    const updateResult = await prisma.$executeRawUnsafe(`
      UPDATE card_player_team 
      SET player_team = ${toPlayerTeam.player_team_id}
      WHERE player_team = ${fromPlayerTeam.player_team_id}
    `)

    console.log(`Admin: Reassigned ${cardsToReassign} cards for player ${playerId} from team ${from_team_id} to team ${to_team_id}`)

    // Get team names for response
    const [fromTeam, toTeam] = await Promise.all([
      prisma.team.findUnique({ where: { team_Id: from_team_id } }),
      prisma.team.findUnique({ where: { team_Id: to_team_id } })
    ])

    res.json({
      message: 'Cards reassigned successfully',
      cardsReassigned: cardsToReassign,
      fromTeam: fromTeam?.name,
      toTeam: toTeam?.name
    })

  } catch (error) {
    console.error('Error reassigning cards:', error)
    res.status(500).json({
      error: 'Database error',
      message: 'Failed to reassign cards',
      details: error.message
    })
  }
})

// DELETE /api/admin/players/:id - Delete player (only if no cards)
router.delete('/:id', async (req, res) => {
  try {
    const playerId = parseInt(req.params.id)

    if (isNaN(playerId)) {
      return res.status(400).json({ error: 'Invalid player ID' })
    }

    // Check if player has cards
    const player = await prisma.player.findUnique({
      where: { player_id: playerId }
    })

    if (!player) {
      return res.status(404).json({ error: 'Player not found' })
    }

    if (player.card_count > 0) {
      return res.status(400).json({
        error: 'Cannot delete player',
        message: `Player has ${player.card_count} cards. Cannot delete players with cards.`,
        cardCount: Number(player.card_count)
      })
    }

    // Delete player-team relationships first
    await prisma.player_team.deleteMany({
      where: { player: playerId }
    })

    // Delete the player
    await prisma.player.delete({
      where: { player_id: playerId }
    })

    console.log('Admin: Deleted player:', player.first_name, player.last_name)

    res.json({
      message: 'Player deleted successfully'
    })

  } catch (error) {
    console.error('Error deleting player:', error)
    res.status(500).json({
      error: 'Database error',
      message: 'Failed to delete player',
      details: error.message
    })
  }
})

// POST /api/admin/players/:playerId/merge - Merge one player into another
router.post('/:playerId/merge', async (req, res) => {
  try {
    const sourcePlayerId = BigInt(req.params.playerId)
    const { targetPlayerId, targetTeamId } = req.body

    if (!targetPlayerId) {
      return res.status(400).json({
        error: 'Validation error',
        message: 'Target player ID is required'
      })
    }

    const targetPlayerIdBigInt = BigInt(targetPlayerId)
    const targetTeamIdInt = targetTeamId ? parseInt(targetTeamId) : null

    if (sourcePlayerId === targetPlayerIdBigInt) {
      return res.status(400).json({
        error: 'Validation error',
        message: 'Cannot merge a player into itself'
      })
    }

    console.log('Admin: Merging players:', {
      sourcePlayerId: sourcePlayerId.toString(),
      targetPlayerId: targetPlayerId.toString(),
      targetTeamId: targetTeamIdInt
    })

    // Verify both players exist
    const sourcePlayer = await prisma.player.findUnique({
      where: { player_id: sourcePlayerId }
    })

    const targetPlayer = await prisma.player.findUnique({
      where: { player_id: targetPlayerIdBigInt }
    })

    if (!sourcePlayer) {
      return res.status(404).json({
        error: 'Not found',
        message: 'Source player not found'
      })
    }

    if (!targetPlayer) {
      return res.status(404).json({
        error: 'Not found',
        message: 'Target player not found'
      })
    }

    // Start transaction to merge players
    await prisma.$transaction(async (tx) => {
      // Get all card_player_team records for source player with team info
      const sourceCardPlayerTeams = await tx.$queryRaw`
        SELECT
          cpt.card_player_team_id,
          cpt.card,
          cpt.player_team,
          pt.player,
          pt.team
        FROM card_player_team cpt
        INNER JOIN player_team pt ON cpt.player_team = pt.player_team_id
        WHERE pt.player = ${sourcePlayerId}
      `

      console.log(`Found ${sourceCardPlayerTeams.length} card_player_team records to reassign`)

      // Determine target player_team to use
      let targetPlayerTeamId

      if (targetTeamIdInt) {
        // User selected a specific team - find or create that player_team record
        const existingPlayerTeam = await tx.$queryRaw`
          SELECT player_team_id
          FROM player_team
          WHERE player = ${targetPlayerIdBigInt} AND team = ${targetTeamIdInt}
        `

        if (existingPlayerTeam.length > 0) {
          targetPlayerTeamId = existingPlayerTeam[0].player_team_id
        } else {
          // Create new player_team record
          const newPlayerTeam = await tx.$queryRaw`
            INSERT INTO player_team (player, team)
            OUTPUT INSERTED.player_team_id
            VALUES (${targetPlayerIdBigInt}, ${targetTeamIdInt})
          `
          targetPlayerTeamId = newPlayerTeam[0].player_team_id
          console.log(`Created new player_team ${Number(targetPlayerTeamId)} for target player with team ${targetTeamIdInt}`)
        }

        // Update ALL card_player_team records to use this single target player_team
        await tx.$executeRaw`
          UPDATE card_player_team
          SET player_team = ${targetPlayerTeamId}
          WHERE card_player_team_id IN (
            SELECT cpt.card_player_team_id
            FROM card_player_team cpt
            INNER JOIN player_team pt ON cpt.player_team = pt.player_team_id
            WHERE pt.player = ${sourcePlayerId}
          )
        `
        console.log(`Updated all cards to use player_team ${Number(targetPlayerTeamId)}`)
      } else {
        // No specific team selected - match teams (preserve team associations)
        for (const cpt of sourceCardPlayerTeams) {
          const teamId = cpt.team

          // Check if target player already has this team
          const existingPlayerTeam = await tx.$queryRaw`
            SELECT player_team_id
            FROM player_team
            WHERE player = ${targetPlayerIdBigInt} AND team = ${teamId}
          `

          let matchingPlayerTeamId
          if (existingPlayerTeam.length > 0) {
            matchingPlayerTeamId = existingPlayerTeam[0].player_team_id
          } else {
            // Create new player_team record
            const newPlayerTeam = await tx.$queryRaw`
              INSERT INTO player_team (player, team)
              OUTPUT INSERTED.player_team_id
              VALUES (${targetPlayerIdBigInt}, ${teamId})
            `
            matchingPlayerTeamId = newPlayerTeam[0].player_team_id
            console.log(`Created new player_team ${Number(matchingPlayerTeamId)} for target player with team ${teamId}`)
          }

          // Update this card_player_team to use matching player_team
          await tx.$executeRaw`
            UPDATE card_player_team
            SET player_team = ${matchingPlayerTeamId}
            WHERE card_player_team_id = ${cpt.card_player_team_id}
          `
        }
      }

      // Delete source player's player_team records
      await tx.$executeRaw`
        DELETE FROM player_team
        WHERE player = ${sourcePlayerId}
      `

      // Delete source player
      await tx.$executeRaw`
        DELETE FROM player
        WHERE player_id = ${sourcePlayerId}
      `

      console.log('Successfully merged players')
    })

    res.json({
      message: 'Players merged successfully',
      sourcePlayer: {
        player_id: sourcePlayerId.toString(),
        name: `${sourcePlayer.first_name || ''} ${sourcePlayer.last_name || ''}`.trim()
      },
      targetPlayer: {
        player_id: targetPlayerIdBigInt.toString(),
        name: `${targetPlayer.first_name || ''} ${targetPlayer.last_name || ''}`.trim()
      }
    })

  } catch (error) {
    console.error('Error merging players:', error)
    res.status(500).json({
      error: 'Database error',
      message: 'Failed to merge players',
      details: error.message
    })
  }
})

// POST /api/admin/players/:id/reassign-selected-cards - Reassign selected cards to any player_team
router.post('/:id/reassign-selected-cards', async (req, res) => {
  try {
    const playerId = parseInt(req.params.id)
    const { card_ids, target_player_team_id } = req.body

    console.log('Admin: Reassigning selected cards:', { playerId, card_ids, target_player_team_id })

    if (isNaN(playerId)) {
      return res.status(400).json({ error: 'Invalid player ID' })
    }

    if (!Array.isArray(card_ids) || card_ids.length === 0) {
      return res.status(400).json({
        error: 'Validation error',
        message: 'card_ids must be a non-empty array'
      })
    }

    if (!target_player_team_id || isNaN(parseInt(target_player_team_id))) {
      return res.status(400).json({
        error: 'Validation error',
        message: 'target_player_team_id is required and must be a valid number'
      })
    }

    const targetPlayerTeamId = BigInt(target_player_team_id)

    // Verify target player_team exists
    const targetPlayerTeam = await prisma.player_team.findUnique({
      where: { player_team_id: targetPlayerTeamId },
      include: {
        player: true,
        team: true
      }
    })

    if (!targetPlayerTeam) {
      return res.status(404).json({
        error: 'Not found',
        message: 'Target player-team combination not found'
      })
    }

    // Convert card IDs to BigInt
    const cardIdsBigInt = card_ids.map(id => BigInt(id))

    // Verify all cards belong to the specified player
    const cards = await prisma.$queryRawUnsafe(`
      SELECT DISTINCT c.card_id
      FROM card c
      INNER JOIN card_player_team cpt ON c.card_id = cpt.card
      INNER JOIN player_team pt ON cpt.player_team = pt.player_team_id
      WHERE pt.player = ${playerId}
        AND c.card_id IN (${cardIdsBigInt.map(id => id.toString()).join(',')})
    `)

    if (cards.length !== card_ids.length) {
      return res.status(400).json({
        error: 'Validation error',
        message: 'Some card IDs do not belong to this player or do not exist',
        foundCards: cards.length,
        requestedCards: card_ids.length
      })
    }

    // Perform the reassignment
    const updateResult = await prisma.$executeRawUnsafe(`
      UPDATE card_player_team
      SET player_team = ${targetPlayerTeamId}
      WHERE card IN (${cardIdsBigInt.map(id => id.toString()).join(',')})
        AND player_team IN (
          SELECT player_team_id
          FROM player_team
          WHERE player = ${playerId}
        )
    `)

    console.log(`Admin: Reassigned ${card_ids.length} cards from player ${playerId} to player_team ${target_player_team_id}`)

    res.json({
      message: 'Cards reassigned successfully',
      cardsReassigned: card_ids.length,
      targetPlayer: `${targetPlayerTeam.player.first_name || ''} ${targetPlayerTeam.player.last_name || ''}`.trim(),
      targetTeam: targetPlayerTeam.team.name
    })

  } catch (error) {
    console.error('Error reassigning selected cards:', error)
    res.status(500).json({
      error: 'Database error',
      message: 'Failed to reassign selected cards',
      details: error.message
    })
  }
})

// GET /api/admin/players/:id/cards - Get all cards for a player (grouped by team)
router.get('/:id/cards', async (req, res) => {
  try {
    const playerId = parseInt(req.params.id)

    if (isNaN(playerId)) {
      return res.status(400).json({ error: 'Invalid player ID' })
    }

    const cards = await prisma.$queryRawUnsafe(`
      SELECT
        c.card_id,
        c.card_number,
        c.is_rc,
        c.is_auto,
        c.is_relic,
        s.name as series_name,
        s.year as series_year,
        pt.player_team_id,
        pt.player as player_id,
        pt.team as team_id,
        t.name as team_name,
        t.abbreviation as team_abbreviation,
        t.primary_color,
        t.secondary_color
      FROM card c
      INNER JOIN card_player_team cpt ON c.card_id = cpt.card
      INNER JOIN player_team pt ON cpt.player_team = pt.player_team_id
      INNER JOIN team t ON pt.team = t.team_Id
      LEFT JOIN series s ON c.series = s.series_id
      WHERE pt.player = ${playerId}
      ORDER BY t.name, s.year DESC, s.name, c.card_number
    `)

    // Serialize BigInt values
    const serializedCards = cards.map(card => ({
      card_id: Number(card.card_id),
      card_number: card.card_number,
      is_rc: Boolean(card.is_rc),
      is_auto: Boolean(card.is_auto),
      is_relic: Boolean(card.is_relic),
      series_name: card.series_name,
      series_year: Number(card.series_year),
      player_team_id: Number(card.player_team_id),
      player_id: Number(card.player_id),
      team_id: Number(card.team_id),
      team_name: card.team_name,
      team_abbreviation: card.team_abbreviation,
      primary_color: card.primary_color,
      secondary_color: card.secondary_color
    }))

    res.json({
      cards: serializedCards
    })

  } catch (error) {
    console.error('Error fetching player cards:', error)
    res.status(500).json({
      error: 'Database error',
      message: 'Failed to fetch player cards',
      details: error.message
    })
  }
})

// GET /api/admin/player-teams/search - Search for player-team combinations
router.get('/player-teams/search', async (req, res) => {
  try {
    const { search, limit = 20 } = req.query
    const limitNum = Math.min(parseInt(limit) || 20, 100)

    if (!search || search.trim().length < 2) {
      return res.json({ playerTeams: [] })
    }

    const searchTerm = search.trim()
    const escapedSearch = searchTerm.replace(/'/g, "''")

    const playerTeams = await prisma.$queryRawUnsafe(`
      SELECT
        pt.player_team_id,
        p.player_id,
        p.first_name,
        p.last_name,
        p.nick_name,
        t.team_Id as team_id,
        t.name as team_name,
        t.abbreviation as team_abbreviation,
        t.primary_color,
        t.secondary_color,
        COUNT(DISTINCT cpt.card) as card_count
      FROM player_team pt
      INNER JOIN player p ON pt.player = p.player_id
      INNER JOIN team t ON pt.team = t.team_Id
      LEFT JOIN card_player_team cpt ON pt.player_team_id = cpt.player_team
      WHERE (
        p.first_name LIKE N'%${escapedSearch}%' COLLATE Latin1_General_CI_AI
        OR p.last_name LIKE N'%${escapedSearch}%' COLLATE Latin1_General_CI_AI
        OR p.nick_name LIKE N'%${escapedSearch}%' COLLATE Latin1_General_CI_AI
        OR CONCAT(p.first_name, ' ', p.last_name) LIKE N'%${escapedSearch}%' COLLATE Latin1_General_CI_AI
        OR t.name LIKE N'%${escapedSearch}%' COLLATE Latin1_General_CI_AI
      )
      GROUP BY pt.player_team_id, p.player_id, p.first_name, p.last_name, p.nick_name,
               t.team_Id, t.name, t.abbreviation, t.primary_color, t.secondary_color
      ORDER BY p.last_name, p.first_name, t.name
      OFFSET 0 ROWS
      FETCH NEXT ${limitNum} ROWS ONLY
    `)

    // Serialize BigInt values
    const serializedPlayerTeams = playerTeams.map(pt => ({
      player_team_id: Number(pt.player_team_id),
      player_id: Number(pt.player_id),
      first_name: pt.first_name,
      last_name: pt.last_name,
      nick_name: pt.nick_name,
      team_id: Number(pt.team_id),
      team_name: pt.team_name,
      team_abbreviation: pt.team_abbreviation,
      primary_color: pt.primary_color,
      secondary_color: pt.secondary_color,
      card_count: Number(pt.card_count || 0)
    }))

    res.json({
      playerTeams: serializedPlayerTeams
    })

  } catch (error) {
    console.error('Error searching player-teams:', error)
    res.status(500).json({
      error: 'Database error',
      message: 'Failed to search player-teams',
      details: error.message
    })
  }
})

module.exports = router