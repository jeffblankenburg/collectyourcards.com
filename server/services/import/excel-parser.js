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
   * Parse pasted tab-separated data
   *
   * @param {string} data - Tab-separated data pasted by user
   * @returns {Promise<Array>} - Array of parsed and preprocessed cards
   */
  async parsePastedData(data) {
    console.log('📋 Starting pasted data parsing...')

    if (!data || !data.trim()) {
      throw new Error('No data provided')
    }

    console.log('Data length:', data.length, 'characters')

    // Split into rows and parse as tab-separated values
    const rows = data.trim().split('\n').map(row => row.split('\t'))

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
      const hasMultiplePlayers = /[\/,]/.test(card.playerNames)
      if (hasMultiplePlayers) {
        console.log(`👥 Found multiple players on line: ${card.cardNumber} - ${card.playerNames}`)

        // Split by BOTH / and , to handle mixed delimiters like "A, B / C"
        const players = card.playerNames.split(/[\/,]/).map(p => p.trim()).filter(p => p)
        const teams = card.teamNames.split(/[\/,]/).map(t => t.trim()).filter(t => t)

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
