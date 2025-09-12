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
          s.name as secondary_text,
          ISNULL(STRING_AGG(CONCAT(p.first_name, ' ', p.last_name), ', '), 'Unknown Player') as tertiary_text,
          80 as relevance_score,
          c.is_rookie,
          c.is_autograph,
          c.is_relic,
          c.print_run,
          col.hex_value as color_hex,
          col.name as color_name,
          '' as teams_data
        FROM card c
        JOIN series s ON c.series = s.series_id
        LEFT JOIN color col ON s.color = col.color_id
        LEFT JOIN card_player_team cpt ON c.card_id = cpt.card
        LEFT JOIN player_team pt ON cpt.player_team = pt.player_team_id
        LEFT JOIN player p ON pt.player = p.player_id
        WHERE 
          c.card_number LIKE '${searchPattern}'
          OR s.name LIKE '${searchPattern}'
          OR p.first_name LIKE '${searchPattern}'
          OR p.last_name LIKE '${searchPattern}'
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
          ISNULL(p.nick_name, '') as secondary_text,
          CONCAT(CAST(ISNULL(p.card_count, 0) as varchar), ' cards') as tertiary_text,
          75 as relevance_score,
          0 as is_rookie,
          0 as is_autograph,
          0 as is_relic,
          NULL as print_run,
          NULL as color_hex,
          NULL as color_name,
          '' as teams_data
        FROM player p
        WHERE 
          p.first_name LIKE '${searchPattern}'
          OR p.last_name LIKE '${searchPattern}'
          OR p.nick_name LIKE '${searchPattern}'
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
          ISNULL(o.name, 'Unknown Organization') as tertiary_text,
          85 as relevance_score,
          0 as is_rookie,
          0 as is_autograph,
          0 as is_relic,
          NULL as print_run,
          t.primary_color as color_hex,
          NULL as color_name,
          '' as teams_data
        FROM team t
        LEFT JOIN organization o ON t.organization = o.organization_id
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
          CONCAT(CAST(ISNULL(s.card_count, 0) as varchar), ' cards') as tertiary_text,
          90 as relevance_score,
          0 as is_rookie,
          0 as is_autograph,
          0 as is_relic,
          s.min_print_run as print_run,
          col.hex_value as color_hex,
          col.name as color_name,
          '' as teams_data
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
    id: row.entity_id,
    title: row.primary_text,
    subtitle: row.secondary_text || '',
    description: row.tertiary_text || '',
    relevanceScore: Number(row.relevance_score),
    data: {
      id: row.entity_id
    }
  }
  
  // Add type-specific data to match original search format
  switch (row.result_type) {
    case 'card':
      // Format card title like original: "#123 Player Name • Series Name"
      baseResult.title = `#${row.primary_text} ${row.tertiary_text} • ${row.secondary_text}`
      baseResult.data = {
        card_id: row.entity_id,
        card_number: row.primary_text,
        is_rookie: Boolean(row.is_rookie),
        is_autograph: Boolean(row.is_autograph),
        is_relic: Boolean(row.is_relic),
        print_run: row.print_run ? Number(row.print_run) : null,
        series_name: row.secondary_text,
        player_names: row.tertiary_text,
        color_name: row.color_name,
        color_hex: row.color_hex,
        // Add navigation slugs
        series_slug: generateSlug(row.secondary_text),
        player_slug: generateSlug(row.tertiary_text)
      }
      break
      
    case 'player':
      // Format player title like original: "First Last" or "First 'Nick' Last"  
      const playerName = row.primary_text
      const nickname = row.secondary_text
      baseResult.title = nickname ? `${playerName.split(' ')[0]} "${nickname}" ${playerName.split(' ').slice(1).join(' ')}` : playerName
      baseResult.data = {
        player_id: row.entity_id,
        first_name: playerName.split(' ')[0],
        last_name: playerName.split(' ').slice(1).join(' '),
        nick_name: nickname || null,
        card_count: Number(row.tertiary_text.replace(' cards', '')) || 0,
        teams: []
      }
      break
      
    case 'team':
      baseResult.title = row.primary_text
      baseResult.data = {
        team_id: row.entity_id,
        name: row.primary_text,
        city: row.secondary_text,
        organization_name: row.tertiary_text,
        primary_color: row.color_hex,
        card_count: 0,
        player_count: 0
      }
      break
      
    case 'series':
      baseResult.title = row.primary_text
      baseResult.data = {
        series_id: row.entity_id,
        name: row.primary_text,
        series_name: row.primary_text,
        set_name: row.secondary_text,
        card_count: Number(row.tertiary_text.replace(' cards', '')) || 0,
        color_name: row.color_name,
        color_hex_value: row.color_hex,
        color_hex: row.color_hex,
        // Add navigation slugs
        slug: generateSlug(row.primary_text),
        series_slug: generateSlug(row.primary_text),
        set_slug: generateSlug(row.secondary_text)
      }
      break
  }
  
  return baseResult
}

module.exports = router