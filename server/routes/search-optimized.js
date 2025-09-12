const express = require('express')
const { prisma, executeWithRetry } = require('../config/prisma-singleton')

const router = express.Router()

// Helper function to generate URL slug from name
function generateSlug(name) {
  if (!name) return 'unknown'
  return name
    .toLowerCase()
    .replace(/'/g, '') // Remove apostrophes completely
    .replace(/[^a-z0-9]+/g, '-') // Replace other special chars with hyphens
    .replace(/^-|-$/g, '') // Remove leading/trailing hyphens
}

/**
 * OPTIMIZED UNIVERSAL SEARCH
 * Single consolidated query that searches all entities at once
 * This reduces database connections from 6 to 1 per search
 */
router.get('/universal', async (req, res) => {
  try {
    const { q: query, limit = 50, category = 'all' } = req.query
    
    console.log('Optimized search request:', { query, limit, category })
    
    if (!query || query.trim().length < 2) {
      return res.json({ results: [], suggestions: [] })
    }

    const searchQuery = query.trim()
    const searchPattern = `%${searchQuery}%`
    
    // Execute with retry logic for connection pool issues
    const results = await executeWithRetry(async () => {
      return await performConsolidatedSearch(searchQuery, searchPattern, parseInt(limit), category)
    })
    
    res.json({
      query: searchQuery,
      results,
      totalResults: results.length,
      searchTime: Date.now()
    })
    
  } catch (error) {
    console.error('Optimized search error:', error)
    res.status(500).json({ 
      error: 'Search failed', 
      details: error.message 
    })
  }
})

/**
 * SINGLE CONSOLIDATED SEARCH QUERY
 * Uses UNION ALL to combine results from different entity types in a single database call
 */
async function performConsolidatedSearch(query, searchPattern, limit, category) {
  try {
    // Build the UNION query based on category
    const queries = []
    
    // Cards search
    if (category === 'all' || category === 'cards') {
      queries.push(`
        SELECT TOP ${limit}
          'card' as result_type,
          CAST(c.card_id as varchar) as entity_id,
          c.card_number as primary_text,
          CONCAT(STRING_AGG(CONCAT(p.first_name, ' ', p.last_name), ', '), ' - ', s.name) as secondary_text,
          s.name as tertiary_text,
          CASE 
            WHEN c.card_number LIKE '${searchPattern}' THEN 100
            WHEN CONCAT(p.first_name, ' ', p.last_name) LIKE '${searchPattern}' THEN 90
            WHEN s.name LIKE '${searchPattern}' THEN 80
            ELSE 70
          END as relevance_score,
          c.is_rookie,
          c.is_autograph,
          c.is_relic,
          c.print_run,
          col.hex_value as color_hex,
          col.name as color_name,
          STRING_AGG(CONVERT(varchar(max), CONCAT(t.team_id, '|', t.name, '|', ISNULL(t.primary_color, ''), '|', ISNULL(t.secondary_color, ''))), '~') as teams_data
        FROM card c
        JOIN series s ON c.series = s.series_id
        LEFT JOIN color col ON s.color = col.color_id
        LEFT JOIN card_player_team cpt ON c.card_id = cpt.card
        LEFT JOIN player_team pt ON cpt.player_team = pt.player_team_id
        LEFT JOIN player p ON pt.player = p.player_id
        LEFT JOIN team t ON pt.team = t.team_id
        WHERE 
          c.card_number LIKE '${searchPattern}'
          OR s.name LIKE '${searchPattern}'
          OR p.first_name LIKE '${searchPattern}'
          OR p.last_name LIKE '${searchPattern}'
          OR CONCAT(p.first_name, ' ', p.last_name) LIKE '${searchPattern}'
        GROUP BY c.card_id, c.card_number, c.is_rookie, c.is_autograph, c.is_relic, c.print_run,
                 s.name, s.series_id, col.name, col.hex_value
      `)
    }
    
    // Players search
    if (category === 'all' || category === 'players') {
      queries.push(`
        SELECT TOP ${limit}
          'player' as result_type,
          CAST(p.player_id as varchar) as entity_id,
          CONCAT(p.first_name, ' ', p.last_name) as primary_text,
          CASE WHEN p.nick_name IS NOT NULL THEN CONCAT('"', p.nick_name, '"') ELSE '' END as secondary_text,
          CONCAT(CAST(p.card_count as varchar), ' cards') as tertiary_text,
          CASE 
            WHEN CONCAT(p.first_name, ' ', p.last_name) LIKE '${searchPattern}' THEN 100
            WHEN p.first_name LIKE '${searchPattern}' OR p.last_name LIKE '${searchPattern}' THEN 90
            WHEN p.nick_name LIKE '${searchPattern}' THEN 85
            ELSE 70
          END as relevance_score,
          0 as is_rookie,
          0 as is_autograph,
          0 as is_relic,
          NULL as print_run,
          NULL as color_hex,
          NULL as color_name,
          STRING_AGG(DISTINCT CONVERT(varchar(max), CONCAT(t.team_id, '|', t.name, '|', ISNULL(t.primary_color, ''), '|', ISNULL(t.secondary_color, ''))), '~') as teams_data
        FROM player p
        LEFT JOIN player_team pt ON p.player_id = pt.player
        LEFT JOIN team t ON pt.team = t.team_id
        WHERE 
          p.first_name LIKE '${searchPattern}'
          OR p.last_name LIKE '${searchPattern}'
          OR p.nick_name LIKE '${searchPattern}'
          OR CONCAT(p.first_name, ' ', p.last_name) LIKE '${searchPattern}'
        GROUP BY p.player_id, p.first_name, p.last_name, p.nick_name, p.card_count
      `)
    }
    
    // Teams search
    if (category === 'all' || category === 'teams') {
      queries.push(`
        SELECT TOP ${limit}
          'team' as result_type,
          CAST(t.team_id as varchar) as entity_id,
          t.name as primary_text,
          t.city as secondary_text,
          CONCAT(o.name, ' - ', s.name) as tertiary_text,
          CASE 
            WHEN t.name LIKE '${searchPattern}' THEN 100
            WHEN t.city LIKE '${searchPattern}' THEN 90
            WHEN t.abbreviation = '${query.toUpperCase()}' THEN 95
            ELSE 70
          END as relevance_score,
          0 as is_rookie,
          0 as is_autograph,
          0 as is_relic,
          NULL as print_run,
          t.primary_color as color_hex,
          NULL as color_name,
          CONCAT(t.team_id, '|', t.name, '|', ISNULL(t.primary_color, ''), '|', ISNULL(t.secondary_color, '')) as teams_data
        FROM team t
        LEFT JOIN organization o ON t.organization = o.organization_id
        LEFT JOIN sport s ON o.sport = s.sport_id
        WHERE 
          t.name LIKE '${searchPattern}'
          OR t.city LIKE '${searchPattern}'
          OR t.abbreviation LIKE '${searchPattern}'
          OR t.mascot LIKE '${searchPattern}'
      `)
    }
    
    // Series search
    if (category === 'all' || category === 'series') {
      queries.push(`
        SELECT TOP ${limit}
          'series' as result_type,
          CAST(s.series_id as varchar) as entity_id,
          s.name as primary_text,
          st.name as secondary_text,
          CONCAT(CAST(s.card_count as varchar), ' cards') as tertiary_text,
          CASE 
            WHEN s.name LIKE '${searchPattern}' THEN 100
            WHEN st.name LIKE '${searchPattern}' THEN 85
            ELSE 70
          END as relevance_score,
          0 as is_rookie,
          0 as is_autograph,
          0 as is_relic,
          s.min_print_run as print_run,
          col.hex_value as color_hex,
          col.name as color_name,
          NULL as teams_data
        FROM series s
        JOIN [set] st ON s.[set] = st.set_id
        LEFT JOIN color col ON s.color = col.color_id
        WHERE 
          s.name LIKE '${searchPattern}'
          OR st.name LIKE '${searchPattern}'
      `)
    }
    
    // Combine all queries with UNION ALL if we have multiple
    let finalQuery = ''
    if (queries.length === 0) {
      return []
    } else if (queries.length === 1) {
      finalQuery = queries[0]
    } else {
      finalQuery = queries.join(' UNION ALL ')
    }
    
    // Wrap in outer query to sort by relevance and limit total results
    finalQuery = `
      SELECT TOP ${limit} *
      FROM (
        ${finalQuery}
      ) AS combined_results
      ORDER BY relevance_score DESC, primary_text ASC
    `
    
    console.log('Executing consolidated search query...')
    const startTime = Date.now()
    
    const results = await prisma.$queryRawUnsafe(finalQuery)
    
    const queryTime = Date.now() - startTime
    console.log(`Consolidated search completed in ${queryTime}ms, found ${results.length} results`)
    
    // Format results based on type
    return results.map(row => formatSearchResult(row))
    
  } catch (error) {
    console.error('Consolidated search error:', error)
    throw error
  }
}

/**
 * Format search results based on entity type
 */
function formatSearchResult(row) {
  const baseResult = {
    type: row.result_type,
    relevance: Number(row.relevance_score),
    data: {
      id: row.entity_id,
      primary: row.primary_text,
      secondary: row.secondary_text || '',
      tertiary: row.tertiary_text || ''
    }
  }
  
  // Add type-specific data
  switch (row.result_type) {
    case 'card':
      baseResult.data.card_number = row.primary_text
      baseResult.data.is_rookie = Boolean(row.is_rookie)
      baseResult.data.is_autograph = Boolean(row.is_autograph)
      baseResult.data.is_relic = Boolean(row.is_relic)
      baseResult.data.print_run = row.print_run
      
      if (row.color_hex) {
        baseResult.data.color = {
          name: row.color_name,
          hex: row.color_hex
        }
      }
      
      // Parse teams data
      if (row.teams_data) {
        baseResult.data.teams = row.teams_data.split('~').map(teamStr => {
          const [id, name, primary, secondary] = teamStr.split('|')
          return {
            team_id: Number(id),
            name,
            primary_color: primary || null,
            secondary_color: secondary || null
          }
        })
      }
      break
      
    case 'player':
      baseResult.data.name = row.primary_text
      baseResult.data.nickname = row.secondary_text
      baseResult.data.card_count = parseInt(row.tertiary_text) || 0
      baseResult.data.slug = generateSlug(row.primary_text)
      
      // Parse teams data
      if (row.teams_data) {
        baseResult.data.teams = row.teams_data.split('~').map(teamStr => {
          const [id, name, primary, secondary] = teamStr.split('|')
          return {
            team_id: Number(id),
            name,
            primary_color: primary || null,
            secondary_color: secondary || null
          }
        })
      }
      break
      
    case 'team':
      baseResult.data.name = row.primary_text
      baseResult.data.city = row.secondary_text
      baseResult.data.sport_org = row.tertiary_text
      baseResult.data.slug = generateSlug(row.primary_text)
      
      if (row.teams_data) {
        const [id, name, primary, secondary] = row.teams_data.split('|')
        baseResult.data.primary_color = primary || null
        baseResult.data.secondary_color = secondary || null
      }
      break
      
    case 'series':
      baseResult.data.name = row.primary_text
      baseResult.data.set_name = row.secondary_text
      baseResult.data.card_count = row.tertiary_text
      baseResult.data.slug = generateSlug(row.primary_text)
      
      if (row.color_hex) {
        baseResult.data.color = {
          name: row.color_name,
          hex: row.color_hex
        }
      }
      break
  }
  
  return baseResult
}

module.exports = router