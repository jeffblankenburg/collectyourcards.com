/**
 * Excel Parser Service
 *
 * Handles parsing of XLSX files and pasted tab-separated data for card imports.
 * Includes preprocessing for multi-player cards and consecutive duplicate detection.
 *
 * @module services/import/excel-parser
 */

const XLSX = require('xlsx')

class ExcelParserService {
  /**
   * Parse XLSX file buffer
   *
   * @param {Buffer} fileBuffer - XLSX file buffer from multer
   * @returns {Promise<Array>} - Array of parsed and preprocessed cards
   */
  async parseXlsxFile(fileBuffer) {
    console.log('📊 Starting XLSX parsing...')

    const workbook = XLSX.read(fileBuffer, { type: 'buffer' })
    console.log('Workbook sheet names:', workbook.SheetNames)

    const sheetName = workbook.SheetNames[0]
    const worksheet = workbook.Sheets[sheetName]
    console.log('Using sheet:', sheetName)

    // Convert to JSON - header: 1 returns array of arrays
    const rawData = XLSX.utils.sheet_to_json(worksheet, { header: 1 })

    console.log('Raw XLSX data (first 3 rows):', rawData.slice(0, 3))
    console.log('Total rows found:', rawData.length)

    if (rawData.length === 0) {
      throw new Error('No data found in spreadsheet')
    }

    // Process rows into card objects
    const cards = this._parseRows(rawData)
    console.log(`Parsed ${cards.length} cards from XLSX file`)

    // Apply preprocessing (multi-player detection, consecutive duplicates)
    const processedCards = this._preprocessCards(cards)
    console.log(`✅ Preprocessing complete: ${cards.length} rows → ${processedCards.length} unique cards`)

    // Convert semicolon-separated strings to arrays for frontend
    return this._convertToArrayFormat(processedCards)
  }

  /**
   * Parse pasted data
   *
   * Supports two formats, auto-detected:
   * 1. Tab-separated columns (Excel/Google Sheets paste):
   *    "CardNumber<TAB>Player(s)<TAB>Team(s)<TAB>RC<TAB>Notes"
   * 2. Simple line format:
   *    "CardNumber Player - Team" (e.g. "BG-1 Roman Anthony - Boston Red Sox")
   *
   * @param {string} data - Pasted data in either supported format
   * @returns {Promise<Array>} - Array of parsed and preprocessed cards
   */
  async parsePastedData(data) {
    console.log('📋 Starting pasted data parsing...')

    if (!data || !data.trim()) {
      throw new Error('No data provided')
    }

    console.log('Data length:', data.length, 'characters')

    // Auto-detect format. Tab/CSV spreadsheet paste uses column delimiters;
    // the line format uses " - " to separate player from team.
    let rows
    if (this._isLineFormat(data)) {
      console.log('Detected format: LINE ("CardNumber Player - Team")')
      rows = this._parseLineFormat(data)
    } else {
      console.log('Detected format: TAB-separated columns')
      rows = data.trim().split('\n').map(row => row.split('\t'))
    }

    console.log('Total rows found:', rows.length)
    console.log('First 3 rows:', rows.slice(0, 3))

    if (rows.length === 0) {
      throw new Error('No data rows found')
    }

    // Process all pasted rows - user manually selected what to import
    const cards = this._parseRows(rows)
    console.log(`Parsed ${cards.length} cards from pasted data`)

    // Apply preprocessing (multi-player detection, consecutive duplicates)
    const processedCards = this._preprocessCards(cards)
    console.log(`✅ Preprocessing complete: ${cards.length} rows → ${processedCards.length} unique cards`)

    // Convert semicolon-separated strings to arrays for frontend
    return this._convertToArrayFormat(processedCards)
  }

  // ============================================================================
  // PRIVATE HELPER METHODS
  // ============================================================================

  /**
   * Regex for the simple line format: "CardNumber PlayerName - TeamName"
   *
   * - Group 1: card number (leading token with no spaces, e.g. "BG-1")
   * - Group 2: player name(s) (non-greedy so it stops at the first " - ")
   * - Group 3: team name(s)
   *
   * The " - " (space-hyphen-space) separator is what distinguishes this format
   * from tab/CSV spreadsheet pastes. A card number's internal hyphen ("BG-1")
   * has no surrounding spaces, so it is never mistaken for the separator.
   *
   * @private
   * @returns {RegExp}
   */
  _lineFormatPattern() {
    return /^(\S+)\s+(.+?)\s+-\s+(.+)$/
  }

  /**
   * Detect whether pasted data uses the simple "CardNumber Player - Team" format.
   *
   * @private
   * @param {string} data - Raw pasted data
   * @returns {boolean} - True if the data should be parsed as the line format
   */
  _isLineFormat(data) {
    // Tabs always indicate a spreadsheet paste, never the line format
    if (data.includes('\t')) {
      return false
    }

    const lines = data.trim().split('\n').map(line => line.trim()).filter(line => line)
    if (lines.length === 0) {
      return false
    }

    const pattern = this._lineFormatPattern()
    const matchCount = lines.filter(line => pattern.test(line)).length

    // Require a majority of lines to match so a stray row doesn't misroute the paste
    return matchCount >= Math.ceil(lines.length / 2)
  }

  /**
   * Parse the simple line format into row arrays compatible with _parseRows.
   *
   * Each line becomes [cardNumber, playerNames, teamNames] (columns 0-2),
   * leaving RC/notes blank just as an unfilled spreadsheet column would.
   *
   * @private
   * @param {string} data - Raw pasted data in line format
   * @returns {Array<Array<string>>} - Row arrays
   */
  _parseLineFormat(data) {
    const pattern = this._lineFormatPattern()

    return data.trim().split('\n').map(line => {
      const trimmed = line.trim()
      if (!trimmed) {
        return []
      }

      const match = trimmed.match(pattern)
      if (match) {
        return [match[1].trim(), match[2].trim(), match[3].trim()]
      }

      // No " - " team separator: treat the first token as the card number
      // and the remainder as the player name, leaving the team blank.
      const spaceIndex = trimmed.indexOf(' ')
      if (spaceIndex === -1) {
        return [trimmed]
      }
      return [trimmed.slice(0, spaceIndex).trim(), trimmed.slice(spaceIndex + 1).trim(), '']
    })
  }

  /**
   * Parse rows into card objects
   *
   * Standard format: [Card Number, Player Name(s), Team Name(s), RC Indicator, Notes]
   *
   * @private
   * @param {Array<Array>} rows - Array of row arrays
   * @returns {Array} - Array of card objects
   */
  _parseRows(rows) {
    return rows.map((row, index) => {
      // Skip empty rows
      if (!row || row.length === 0 || !row[0] || (row[0] && !String(row[0]).trim())) {
        return null
      }

      const cardNumber = row[0] ? String(row[0]).trim() : ''
      const playerNames = row[1] ? String(row[1]).trim() : ''
      const teamNames = row[2] ? String(row[2]).trim() : ''
      const rcIndicator = row[3] ? String(row[3]).trim() : '' // RC is in column 4 (index 3)
      const rawNotes = row[4] ? String(row[4]).trim() : '' // Notes are in column 5 (index 4)

      // Remove parentheses from notes
      const notes = rawNotes.replace(/[()]/g, '')

      // Debug first few rows
      if (index < 5) {
        console.log(`Row ${index + 1} mapping:`)
        console.log('  cardNumber:', cardNumber)
        console.log('  playerNames:', playerNames)
        console.log('  teamNames:', teamNames)
        console.log('  rcIndicator (col 4):', rcIndicator)
        console.log('  notes (col 5):', notes)
        console.log('  raw row:', row)
      }

      // Determine if this is a rookie card
      const isRookieCard = this._detectRookieCard(rcIndicator)

      return {
        sortOrder: index + 1, // Sequential sort order starting at 1
        cardNumber,
        playerNames,
        teamNames,
        isRC: isRookieCard,
        rcIndicator: rcIndicator, // Keep original value for display
        isAutograph: false, // Default to false - can be toggled in UI
        isRelic: false, // Default to false - can be toggled in UI
        isShortPrint: false, // Default to false - can be toggled in UI
        notes: notes || '' // Ensure notes is always a string
      }
    }).filter(card => card && card.cardNumber) // Only include valid rows with card numbers
  }

  /**
   * Detect if a card is a rookie card based on RC indicator
   *
   * @private
   * @param {string} rcIndicator - RC column value
   * @returns {boolean} - True if rookie card
   */
  _detectRookieCard(rcIndicator) {
    if (!rcIndicator) return false

    const indicator = rcIndicator.toLowerCase()
    return indicator.includes('rc') ||
           indicator.includes('rookie') ||
           indicator === 'yes' ||
           indicator === 'true' ||
           indicator === '1'
  }

  /**
   * Preprocess cards for multi-player detection and consecutive duplicates
   *
   * Handles two patterns:
   * 1. Multiple players on same line (/, comma separated)
   * 2. Consecutive duplicate card numbers (merge into single multi-player card)
   *
   * @private
   * @param {Array} cards - Array of card objects
   * @returns {Array} - Preprocessed cards
   */
  _preprocessCards(cards) {
    console.log('📊 Starting card preprocessing for multi-player detection...')
    const processedCards = []
    let previousCard = null // Track only the immediately previous card

    for (const card of cards) {
      // Pattern 2: Check if this card number matches the PREVIOUS card (consecutive duplicates ONLY)
      if (previousCard && previousCard.cardNumber === card.cardNumber) {
        console.log(`🔗 Found CONSECUTIVE duplicate card number: ${card.cardNumber}`)

        // Merge players - always add
        previousCard.playerNames += '; ' + card.playerNames

        // Merge teams - but deduplicate if they're the same
        const existingTeams = previousCard.teamNames.split(/[;]/).map(t => t.trim()).filter(t => t)
        const newTeams = card.teamNames.split(/[;]/).map(t => t.trim()).filter(t => t)

        // Only add teams that aren't already in the list
        newTeams.forEach(newTeam => {
          if (!existingTeams.some(existingTeam => existingTeam.toLowerCase() === newTeam.toLowerCase())) {
            existingTeams.push(newTeam)
          }
        })

        previousCard.teamNames = existingTeams.join('; ')

        // Merge RC status (if any row has RC, mark as RC)
        previousCard.isRC = previousCard.isRC || card.isRC

        // Merge short print status (if any row has SP, mark as SP)
        previousCard.isShortPrint = previousCard.isShortPrint || card.isShortPrint

        // Merge notes - but deduplicate if they're the same
        if (card.notes && card.notes !== previousCard.notes) {
          previousCard.notes += (previousCard.notes ? '; ' : '') + card.notes
        }

        console.log(`  Merged: ${card.playerNames} (${card.teamNames})`)
        console.log(`  Result: ${previousCard.playerNames} (${previousCard.teamNames})`)
        // Keep previousCard the same so we can merge into it again if needed
        continue // Skip adding as separate card
      }

      // Pattern 1: Multiple players on same line (/, comma, etc.)
      // IMPORTANT: Only split on commas if there's team data provided.
      // If teamNames is empty, commas in playerNames are likely part of a location/name
      // (e.g., "Biloxi Lighthouse, Mississippi" is ONE subject, not two)
      // Slashes are ALWAYS treated as multi-player delimiters
      const hasSlash = card.playerNames.includes('/')
      const hasTeamData = card.teamNames && card.teamNames.trim() !== ''
      const hasCommaWithTeamData = card.playerNames.includes(',') && hasTeamData

      if (hasSlash || hasCommaWithTeamData) {
        console.log(`👥 Found multiple players on line: ${card.cardNumber} - ${card.playerNames}`)

        let players, teams

        if (hasSlash) {
          // Always split on slash first
          players = card.playerNames.split('/').map(p => p.trim()).filter(p => p)
          teams = card.teamNames.split('/').map(t => t.trim()).filter(t => t)

          // If we have team data and commas in the remaining parts, split those too
          if (hasTeamData) {
            players = players.flatMap(p => p.split(',').map(s => s.trim()).filter(s => s))
            teams = teams.flatMap(t => t.split(',').map(s => s.trim()).filter(s => s))
          }
        } else {
          // Only comma (and we know hasTeamData is true here)
          players = card.playerNames.split(',').map(p => p.trim()).filter(p => p)
          teams = card.teamNames.split(',').map(t => t.trim()).filter(t => t)
        }

        console.log(`  Players (${players.length}): ${players.join(' | ')}`)
        console.log(`  Teams (${teams.length}): ${teams.join(' | ')}`)

        // Rebuild playerNames and teamNames with semicolons for consistent parsing later
        card.playerNames = players.join('; ')
        card.teamNames = teams.join('; ')

        console.log(`  After rebuild - Players: "${card.playerNames}"`)
        console.log(`  After rebuild - Teams: "${card.teamNames}"`)
      }

      // Add to result and set as previous card for next iteration
      processedCards.push(card)
      previousCard = card
    }

    // Reassign sort orders after merging duplicates
    processedCards.forEach((card, index) => {
      card.sortOrder = index + 1
    })

    return processedCards
  }

  /**
   * Convert semicolon-separated strings to arrays for frontend compatibility
   *
   * The frontend expects playerNames and teamNames as arrays, not strings.
   * This method splits the semicolon-separated strings into arrays.
   *
   * @private
   * @param {Array} cards - Preprocessed cards with semicolon-separated strings
   * @returns {Array} - Cards with arrays instead of strings
   */
  _convertToArrayFormat(cards) {
    return cards.map(card => ({
      ...card,
      playerNames: card.playerNames ? card.playerNames.split(/[;]/).map(name => name.trim()).filter(name => name) : [],
      teamNames: card.teamNames ? card.teamNames.split(/[;]/).map(name => name.trim()).filter(name => name) : []
    }))
  }
}

module.exports = new ExcelParserService()
