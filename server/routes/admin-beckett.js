/**
 * Admin Beckett Checklist Routes
 *
 * Provides endpoints for browsing and reviewing downloaded Beckett checklist files.
 * This is a human-in-the-loop review tool - NO automated imports or normalization.
 */

const express = require('express')
const router = express.Router()
const path = require('path')
const fs = require('fs')
const XLSX = require('xlsx')
const { PrismaClient } = require('@prisma/client')

const prisma = new PrismaClient()
const BECKETT_DIR = path.join(__dirname, '..', '..', 'data', 'beckett-checklists')

/**
 * GET /api/admin/beckett/files
 *
 * Lists all Beckett XLSX files in the data directory
 */
router.get('/files', async (req, res) => {
  try {
    // Ensure directory exists
    if (!fs.existsSync(BECKETT_DIR)) {
      return res.json({ files: [], total: 0, message: 'Beckett directory not found' })
    }

    const allFiles = fs.readdirSync(BECKETT_DIR)
      .filter(f => f.endsWith('.xlsx'))
      .map(filename => {
        const filepath = path.join(BECKETT_DIR, filename)
        const stats = fs.statSync(filepath)

        // Parse filename for metadata
        // Format: "2024-Topps-Chrome-Baseball-Checklist.xlsx"
        const nameWithoutExt = filename.replace('.xlsx', '').replace('-Checklist', '')
        const parts = nameWithoutExt.split('-')

        // Try to extract year from first part
        const yearMatch = parts[0]?.match(/^\d{4}/)
        const year = yearMatch ? parseInt(yearMatch[0]) : null

        // Rest is the set name
        const setNameParts = yearMatch ? parts.slice(1) : parts
        const setName = setNameParts.join(' ').replace(/Baseball$/, '').trim()

        return {
          filename,
          filepath,
          size: stats.size,
          sizeFormatted: formatFileSize(stats.size),
          modified: stats.mtime,
          year,
          setName,
          // Quick sheet count (without parsing full file)
          sheetCount: null // Will be populated when file is opened
        }
      })
      .sort((a, b) => {
        // Sort by year descending, then name
        if (a.year && b.year && a.year !== b.year) {
          return b.year - a.year
        }
        return a.filename.localeCompare(b.filename)
      })

    res.json({
      files: allFiles,
      total: allFiles.length,
      directory: BECKETT_DIR
    })

  } catch (error) {
    console.error('Error listing Beckett files:', error)
    res.status(500).json({ error: 'Failed to list Beckett files' })
  }
})

/**
 * GET /api/admin/beckett/file/:filename
 *
 * Returns detailed info about a specific Beckett file including all sheets
 */
router.get('/file/:filename', async (req, res) => {
  try {
    const { filename } = req.params
    const filepath = path.join(BECKETT_DIR, filename)

    if (!fs.existsSync(filepath)) {
      return res.status(404).json({ error: 'File not found' })
    }

    // Parse the XLSX file
    const workbook = XLSX.readFile(filepath)

    const sheets = workbook.SheetNames.map((sheetName, index) => {
      const sheet = workbook.Sheets[sheetName]
      const data = XLSX.utils.sheet_to_json(sheet, { header: 1 })

      // Get row count (excluding empty rows)
      const nonEmptyRows = data.filter(row =>
        row.some(cell => cell !== undefined && cell !== null && cell !== '')
      )

      // Get sample of first few rows for preview
      const sampleRows = nonEmptyRows.slice(0, 10).map(row => ({
        cardNumber: row[0],
        playerName: row[1],
        teamName: row[2],
        notes: row[3]
      }))

      return {
        index,
        name: sheetName,
        rowCount: nonEmptyRows.length,
        isBase: sheetName.toLowerCase() === 'base',
        sampleRows
      }
    })

    // Parse filename for metadata
    const nameWithoutExt = filename.replace('.xlsx', '').replace('-Checklist', '')
    const parts = nameWithoutExt.split('-')
    const yearMatch = parts[0]?.match(/^\d{4}/)
    const year = yearMatch ? parseInt(yearMatch[0]) : null
    const setNameParts = yearMatch ? parts.slice(1) : parts
    const setName = setNameParts.join(' ').replace(/Baseball$/, '').trim()

    const stats = fs.statSync(filepath)

    res.json({
      filename,
      filepath,
      size: stats.size,
      sizeFormatted: formatFileSize(stats.size),
      modified: stats.mtime,
      year,
      setName,
      sheetCount: sheets.length,
      sheets,
      totalRows: sheets.reduce((sum, s) => sum + s.rowCount, 0)
    })

  } catch (error) {
    console.error('Error reading Beckett file:', error)
    res.status(500).json({ error: 'Failed to read Beckett file' })
  }
})

/**
 * GET /api/admin/beckett/file/:filename/sheet/:sheetIndex
 *
 * Returns all data from a specific sheet with database comparison info
 */
router.get('/file/:filename/sheet/:sheetIndex', async (req, res) => {
  try {
    const { filename, sheetIndex } = req.params
    const filepath = path.join(BECKETT_DIR, filename)

    if (!fs.existsSync(filepath)) {
      return res.status(404).json({ error: 'File not found' })
    }

    const workbook = XLSX.readFile(filepath)
    const sheetName = workbook.SheetNames[parseInt(sheetIndex)]

    if (!sheetName) {
      return res.status(404).json({ error: 'Sheet not found' })
    }

    const sheet = workbook.Sheets[sheetName]
    const rawData = XLSX.utils.sheet_to_json(sheet, { header: 1 })

    // Parse rows (skip header if present)
    const hasHeader = typeof rawData[0]?.[0] === 'string' &&
                      rawData[0][0].toLowerCase().includes('card')
    const dataRows = hasHeader ? rawData.slice(1) : rawData

    // Extract unique values from this sheet
    const uniquePlayers = new Set()
    const uniqueTeams = new Set()

    const rows = dataRows
      .filter(row => row.some(cell => cell !== undefined && cell !== null && cell !== ''))
      .map((row, idx) => {
        const playerName = String(row[1] || '').trim()
        const teamName = String(row[2] || '').trim()

        if (playerName && playerName.length > 2) {
          // Handle multi-player cards
          if (playerName.includes('/')) {
            playerName.split('/').forEach(p => uniquePlayers.add(p.trim()))
          } else {
            uniquePlayers.add(playerName)
          }
        }

        if (teamName && teamName.length > 0) {
          // Handle multi-team cards
          if (teamName.includes('/')) {
            teamName.split('/').forEach(t => uniqueTeams.add(t.trim()))
          } else {
            uniqueTeams.add(teamName)
          }
        }

        return {
          rowIndex: idx,
          cardNumber: row[0],
          playerName,
          teamName,
          notes: row[3] || null
        }
      })

    // Now look up these unique values in our database
    const playerNames = [...uniquePlayers]
    const teamNames = [...uniqueTeams]

    // Find matching players in database
    const playerMatches = await findPlayerMatches(playerNames)

    // Find matching teams in database
    const teamMatches = await findTeamMatches(teamNames)

    res.json({
      filename,
      sheetName,
      sheetIndex: parseInt(sheetIndex),
      rowCount: rows.length,
      rows,
      // Summary of unique values
      uniquePlayers: playerNames.length,
      uniqueTeams: teamNames.length,
      // Database lookup results
      playerMatches,
      teamMatches
    })

  } catch (error) {
    console.error('Error reading Beckett sheet:', error)
    res.status(500).json({ error: 'Failed to read Beckett sheet' })
  }
})

/**
 * Find matching players in database
 * Returns exact matches and potential fuzzy matches
 * Note: SQL Server doesn't support Prisma's mode: 'insensitive', so we use raw SQL
 */
async function findPlayerMatches(playerNames) {
  const results = {}

  for (const name of playerNames) {
    // Skip very short names or obvious non-names
    if (!name || name.length < 3) continue

    // Clean up the name - remove trailing commas, periods, extra spaces
    const cleanName = name.replace(/[,.]$/, '').trim()

    // Parse name parts
    const parts = cleanName.split(' ').filter(p => p.length > 0)
    const firstName = parts[0] || ''
    const lastName = parts.slice(1).join(' ') || ''

    // Use raw SQL for case-insensitive search on SQL Server
    const exactMatches = await prisma.$queryRaw`
      SELECT TOP 5
        p.player_id,
        p.first_name,
        p.last_name,
        p.slug
      FROM player p
      WHERE
        (LOWER(p.first_name) = LOWER(${firstName}) AND LOWER(p.last_name) = LOWER(${lastName}))
        OR (LOWER(p.last_name) = LOWER(${lastName}) AND LOWER(p.first_name) LIKE LOWER(${firstName.charAt(0) + '%'}))
    `

    // Get teams for matched players
    const matchesWithTeams = await Promise.all(
      exactMatches.map(async (p) => {
        const playerTeams = await prisma.player_team.findMany({
          where: { player: Number(p.player_id) },
          select: {
            team_player_team_teamToteam: {
              select: {
                team_Id: true,
                name: true,
                abbreviation: true
              }
            }
          }
        })

        return {
          playerId: Number(p.player_id),
          firstName: p.first_name,
          lastName: p.last_name,
          fullName: `${p.first_name} ${p.last_name}`.trim(),
          slug: p.slug,
          teams: playerTeams.map(pt => ({
            teamId: pt.team_player_team_teamToteam?.team_Id,
            teamName: pt.team_player_team_teamToteam?.name,
            abbreviation: pt.team_player_team_teamToteam?.abbreviation
          }))
        }
      })
    )

    results[name] = {
      beckettName: name,
      exactMatches: matchesWithTeams,
      fuzzyMatches: []
    }
  }

  return results
}

/**
 * Find matching teams in database
 * Note: SQL Server doesn't support Prisma's mode: 'insensitive', so we use raw SQL
 */
async function findTeamMatches(teamNames) {
  const results = {}

  for (const name of teamNames) {
    if (!name || name.length < 2) continue

    // Clean up the name
    const cleanName = name.trim()

    // Use raw SQL for case-insensitive search on SQL Server
    const exactMatches = await prisma.$queryRaw`
      SELECT TOP 5
        t.team_Id,
        t.name,
        t.city,
        t.mascot,
        t.abbreviation,
        t.primary_color,
        t.secondary_color
      FROM team t
      WHERE
        LOWER(t.name) = LOWER(${cleanName})
        OR LOWER(t.name) LIKE LOWER(${'%' + cleanName + '%'})
        OR LOWER(t.mascot) = LOWER(${cleanName})
        OR LOWER(t.abbreviation) = LOWER(${cleanName})
    `

    results[name] = {
      beckettName: name,
      exactMatches: exactMatches.map(t => ({
        teamId: t.team_Id,
        name: t.name,
        city: t.city,
        mascot: t.mascot,
        abbreviation: t.abbreviation,
        primaryColor: t.primary_color,
        secondaryColor: t.secondary_color
      })),
      fuzzyMatches: []
    }
  }

  return results
}

/**
 * Format file size for display
 */
function formatFileSize(bytes) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

module.exports = router
