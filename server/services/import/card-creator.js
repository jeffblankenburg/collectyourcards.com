/**
 * Card Creator Service
 *
 * Handles bulk card creation with player-team relationships.
 * Manages transactions for atomic operations and caches newly created entities.
 *
 * @module services/import/card-creator
 */

const sql = require('mssql')

/**
 * Helper function to generate URL slug
 * @param {string} name - Name to convert to slug
 * @returns {string} - URL-safe slug
 */
function generateSlug(name) {
  if (!name) return 'unknown'
  return name
    .toLowerCase()
    .replace(/&/g, 'and') // Convert ampersands to "and" to preserve semantic meaning
    .replace(/'/g, '') // Remove apostrophes completely
    .replace(/[^a-z0-9]+/g, '-') // Replace other special chars with hyphens
    .replace(/^-|-$/g, '') // Remove leading/trailing hyphens
}

class CardCreatorService {
  /**
   * Create multiple cards with their player-team relationships
   *
   * @param {Array} matchedCards - Array of matched card objects from import workflow
   * @param {string|number} seriesId - Series ID to assign cards to
   * @param {Transaction} transaction - Active SQL transaction
   * @returns {Promise<Object>} - Creation result summary
   */
  async createCards(matchedCards, seriesId, transaction) {
    console.log(`🔄 Processing ${matchedCards.length} cards for creation...`)

    // Get the highest existing sort_order for this series to maintain continuity
    const maxSortOrderResult = await transaction.request()
      .input('seriesId', sql.BigInt, seriesId)
      .query(`
        SELECT ISNULL(MAX(sort_order), 0) as max_order
        FROM card
        WHERE series = @seriesId
      `)

    const sortOrderOffset = maxSortOrderResult.recordset[0].max_order
    console.log(`📊 Existing cards in series: highest sort_order = ${sortOrderOffset}`)
    console.log(`📊 New cards will start at sort_order ${sortOrderOffset + 1}`)

    const newPlayerCache = new Map() // Cache for newly created players
    let createdCount = 0

    for (let i = 0; i < matchedCards.length; i++) {
      const card = matchedCards[i]
      console.log(`📋 Processing card ${i + 1}/${matchedCards.length}: ${card.cardNumber}`)

      // Apply sort_order offset to maintain continuity with existing cards
      const adjustedCard = {
        ...card,
        sortOrder: (card.sortOrder || 0) + sortOrderOffset
      }

      // Create the card record
      const cardId = await this._createCardRecord(adjustedCard, seriesId, transaction)
      console.log(`  ✅ Card created with ID: ${cardId}, sort_order: ${adjustedCard.sortOrder}`)

      // Process players for this card
      await this._processPlayersForCard(adjustedCard, cardId, transaction, newPlayerCache)

      createdCount++
    }

    console.log(`🎉 Successfully created ${createdCount} cards`)

    return {
      success: true,
      created: createdCount,
      message: `Successfully imported ${createdCount} cards`
    }
  }

  // ============================================================================
  // PRIVATE HELPER METHODS
  // ============================================================================

  /**
   * Create a single card record in database
   *
   * @private
   * @param {Object} card - Card object with properties
   * @param {string|number} seriesId - Series ID
   * @param {Transaction} transaction - Active transaction
   * @returns {Promise<number>} - Newly created card ID
   */
  async _createCardRecord(card, seriesId, transaction) {
    console.log(`  🃏 Creating card record for ${card.cardNumber}`)

    const result = await transaction.request()
      .input('cardNumber', sql.NVarChar, card.cardNumber)
      .input('seriesId', sql.BigInt, seriesId)
      .input('isRookie', sql.Bit, Boolean(card.isRC))
      .input('isAutograph', sql.Bit, Boolean(card.isAutograph))
      .input('isRelic', sql.Bit, Boolean(card.isRelic))
      .input('printRun', sql.Int, card.printRun || null)
      .input('colorId', sql.Int, card.colorId || null)
      .input('notes', sql.NVarChar, card.notes || null)
      .input('sortOrder', sql.Int, card.sortOrder || 0)
      .query(`
        INSERT INTO card (card_number, series, is_rookie, is_autograph, is_relic, print_run, color, notes, sort_order, created)
        VALUES (@cardNumber, @seriesId, @isRookie, @isAutograph, @isRelic, @printRun, @colorId, @notes, @sortOrder, GETDATE());
        SELECT SCOPE_IDENTITY() AS card_id;
      `)

    return result.recordset[0].card_id
  }

  /**
   * Process all players for a card and create relationships
   *
   * @private
   * @param {Object} card - Card object with players array
   * @param {number} cardId - Newly created card ID
   * @param {Transaction} transaction - Active transaction
   * @param {Map} newPlayerCache - Cache of newly created players
   * @returns {Promise<void>}
   */
  async _processPlayersForCard(card, cardId, transaction, newPlayerCache) {
    console.log(`  👥 Processing ${card.players?.length || 0} players for card ${card.cardNumber}`)

    for (let j = 0; j < (card.players?.length || 0); j++) {
      const player = card.players[j]
      console.log(`    🔍 Processing player ${j + 1}: ${player.name}`)

      // Case 1: Existing player with player_team records
      if (player.selectedPlayer && player.selectedPlayerTeams && player.selectedPlayerTeams.length > 0) {
        await this._handleExistingPlayerWithTeams(player, cardId, transaction)
      }
      // Case 2: Existing player but needs player_team records created
      else if (player.selectedPlayer && player.selectedTeams && player.selectedTeams.length > 0) {
        await this._handleExistingPlayerCreateTeams(player, cardId, transaction)
      }
      // Case 3: New player needs to be created
      else {
        await this._handleNewPlayer(player, cardId, transaction, newPlayerCache)
      }
    }
  }

  /**
   * Handle existing player with existing player_team records
   *
   * @private
   * @param {Object} player - Player object with selectedPlayer and selectedPlayerTeams
   * @param {number} cardId - Card ID
   * @param {Transaction} transaction - Active transaction
   * @returns {Promise<void>}
   */
  async _handleExistingPlayerWithTeams(player, cardId, transaction) {
    console.log(`    ✅ Using existing player with ${player.selectedPlayerTeams.length} player_team records`)
    const playerId = BigInt(player.selectedPlayer.playerId)

    for (const playerTeam of player.selectedPlayerTeams) {
      // Resolve placeholder IDs from frontend (existing_playerId_teamId)
      const actualPlayerTeamId = await this._resolvePlayerTeamId(
        playerTeam.playerTeamId,
        playerId,
        playerTeam.teamId,
        transaction
      )

      if (!actualPlayerTeamId) {
        console.error(`    ❌ Could not resolve player_team record for player ${playerId} and team ${playerTeam.teamId}`)
        continue
      }

      // Create card_player_team relationship
      console.log(`    🔗 Creating card_player_team: cardId=${cardId}, playerTeamId=${actualPlayerTeamId} (${playerTeam.playerName} - ${playerTeam.teamName})`)
      await this._createCardPlayerTeam(cardId, actualPlayerTeamId, transaction)
      console.log(`    ✅ Card-player-team relationship created`)
    }
  }

  /**
   * Handle existing player but create player_team records
   *
   * @private
   * @param {Object} player - Player object with selectedPlayer and selectedTeams
   * @param {number} cardId - Card ID
   * @param {Transaction} transaction - Active transaction
   * @returns {Promise<void>}
   */
  async _handleExistingPlayerCreateTeams(player, cardId, transaction) {
    console.log(`    🆕 Creating player_team records for existing player: ${player.selectedPlayer.playerName}`)
    const playerId = BigInt(player.selectedPlayer.playerId)

    for (const team of player.selectedTeams) {
      const teamId = parseInt(team.teamId)
      console.log(`    🔗 Creating player_team: playerId=${playerId}, teamId=${teamId} (${team.teamName})`)

      // Get or create player_team record
      const playerTeamId = await this._getOrCreatePlayerTeam(playerId, teamId, transaction)

      // Create card_player_team relationship
      console.log(`    🔗 Creating card_player_team: cardId=${cardId}, playerTeamId=${playerTeamId}`)
      await this._createCardPlayerTeam(cardId, playerTeamId, transaction)
      console.log(`    ✅ Card-player-team relationship created`)
    }
  }

  /**
   * Handle new player creation
   *
   * @private
   * @param {Object} player - Player object with name and optional selectedTeams
   * @param {number} cardId - Card ID
   * @param {Transaction} transaction - Active transaction
   * @param {Map} newPlayerCache - Cache of newly created players
   * @returns {Promise<void>}
   */
  async _handleNewPlayer(player, cardId, transaction, newPlayerCache) {
    console.log(`    🆕 Creating new player: ${player.name}`)

    // Parse name into first/last
    const { firstName, lastName } = this._parsePlayerName(player.name)
    console.log(`    📝 Name parsing: "${player.name}" → first: "${firstName}", last: "${lastName}"`)

    // Check cache to avoid creating duplicates
    const playerKey = player.name.toLowerCase()
    let playerId

    if (newPlayerCache.has(playerKey)) {
      playerId = newPlayerCache.get(playerKey)
      console.log(`    ♻️ Using cached player ID: ${playerId}`)
    } else {
      // Create new player in database
      console.log(`    ➕ Creating new player in database`)
      playerId = await this._createPlayer(firstName, lastName, transaction)
      newPlayerCache.set(playerKey, playerId)
      console.log(`    ✅ New player created with ID: ${playerId}`)
    }

    // If teams were selected for this new player, create player_team and card_player_team relationships
    if (player.selectedTeams && player.selectedTeams.length > 0) {
      console.log(`    🔗 Creating ${player.selectedTeams.length} team associations for new player`)

      for (const team of player.selectedTeams) {
        const teamId = parseInt(team.teamId)
        console.log(`    🔗 Creating player_team: playerId=${playerId}, teamId=${teamId} (${team.teamName})`)

        // Get or create player_team record
        const playerTeamId = await this._getOrCreatePlayerTeam(playerId, teamId, transaction)

        // Create card_player_team relationship
        console.log(`    🔗 Creating card_player_team: cardId=${cardId}, playerTeamId=${playerTeamId}`)
        await this._createCardPlayerTeam(cardId, playerTeamId, transaction)
        console.log(`    ✅ Card-player-team relationship created`)
      }
    } else {
      console.log(`    ⚠️ New player created but no teams selected - card will have no player_team relationships for this player`)
    }
  }

  /**
   * Resolve player_team ID (handles placeholder IDs from frontend)
   *
   * @private
   * @param {string|number} playerTeamId - Player team ID (may be placeholder)
   * @param {number} playerId - Player ID
   * @param {number} teamId - Team ID
   * @param {Transaction} transaction - Active transaction
   * @returns {Promise<number|null>} - Resolved player_team ID or null
   */
  async _resolvePlayerTeamId(playerTeamId, playerId, teamId, transaction) {
    // Check if this is a placeholder ID from frontend (existing_playerId_teamId)
    if (String(playerTeamId).startsWith('existing_')) {
      console.log(`    🔍 Detected placeholder ID: ${playerTeamId}, looking up actual player_team_id`)

      const result = await transaction.request()
        .input('playerId', sql.BigInt, playerId)
        .input('teamId', sql.Int, teamId)
        .query(`
          SELECT player_team_id
          FROM player_team
          WHERE player = @playerId AND team = @teamId
        `)

      if (result.recordset.length > 0) {
        const actualId = result.recordset[0].player_team_id
        console.log(`    ✅ Found actual player_team_id: ${actualId}`)
        return actualId
      } else {
        return null
      }
    }

    // Already an actual ID
    return playerTeamId
  }

  /**
   * Get existing or create new player_team record
   *
   * @private
   * @param {number} playerId - Player ID
   * @param {number} teamId - Team ID
   * @param {Transaction} transaction - Active transaction
   * @returns {Promise<number>} - Player team ID
   */
  async _getOrCreatePlayerTeam(playerId, teamId, transaction) {
    // Check if player_team already exists
    const existingResult = await transaction.request()
      .input('playerId', sql.BigInt, playerId)
      .input('teamId', sql.Int, teamId)
      .query(`
        SELECT player_team_id
        FROM player_team
        WHERE player = @playerId AND team = @teamId
      `)

    if (existingResult.recordset.length > 0) {
      const playerTeamId = existingResult.recordset[0].player_team_id
      console.log(`    ♻️ Using existing player_team: ${playerTeamId}`)
      return playerTeamId
    }

    // Create new player_team record
    const createResult = await transaction.request()
      .input('playerId', sql.BigInt, playerId)
      .input('teamId', sql.Int, teamId)
      .query(`
        INSERT INTO player_team (player, team)
        VALUES (@playerId, @teamId);
        SELECT SCOPE_IDENTITY() AS player_team_id;
      `)

    const playerTeamId = createResult.recordset[0].player_team_id
    console.log(`    ✅ Created player_team: ${playerTeamId}`)
    return playerTeamId
  }

  /**
   * Create card_player_team relationship
   *
   * @private
   * @param {number} cardId - Card ID
   * @param {number} playerTeamId - Player team ID
   * @param {Transaction} transaction - Active transaction
   * @returns {Promise<void>}
   */
  async _createCardPlayerTeam(cardId, playerTeamId, transaction) {
    await transaction.request()
      .input('cardId', sql.BigInt, cardId)
      .input('playerTeamId', sql.BigInt, playerTeamId)
      .query(`
        INSERT INTO card_player_team (card, player_team)
        VALUES (@cardId, @playerTeamId)
      `)
  }

  /**
   * Get existing or create new player in database
   *
   * @private
   * @param {string} firstName - Player first name
   * @param {string} lastName - Player last name
   * @param {Transaction} transaction - Active transaction
   * @returns {Promise<number>} - Player ID (existing or newly created)
   */
  async _createPlayer(firstName, lastName, transaction) {
    // Generate slug for player
    const trimmedFirstName = firstName || ''
    const trimmedLastName = lastName || ''
    const fullName = trimmedLastName ? `${trimmedFirstName} ${trimmedLastName}`.trim() : trimmedFirstName
    const playerSlug = generateSlug(fullName || 'unknown')

    // First check if player with this slug already exists
    const existingCheck = await transaction.request()
      .input('slug', sql.NVarChar, playerSlug)
      .query(`
        SELECT player_id
        FROM player
        WHERE slug = @slug
      `)

    if (existingCheck.recordset.length > 0) {
      const existingPlayerId = existingCheck.recordset[0].player_id
      console.log(`    ♻️ Player with slug "${playerSlug}" already exists with ID: ${existingPlayerId}`)
      return existingPlayerId
    }

    // Player doesn't exist, create new one
    const result = await transaction.request()
      .input('firstName', sql.NVarChar, firstName || null)
      .input('lastName', sql.NVarChar, lastName || null)
      .input('slug', sql.NVarChar, playerSlug)
      .query(`
        INSERT INTO player (first_name, last_name, slug)
        VALUES (@firstName, @lastName, @slug);
        SELECT SCOPE_IDENTITY() AS player_id;
      `)

    return result.recordset[0].player_id
  }

  /**
   * Parse player name into first and last name
   *
   * @private
   * @param {string} fullName - Full player name
   * @returns {Object} - Object with firstName and lastName
   */
  _parsePlayerName(fullName) {
    const nameParts = fullName.trim().split(' ')

    if (nameParts.length === 1) {
      return { firstName: nameParts[0], lastName: '' }
    }

    return {
      firstName: nameParts[0],
      lastName: nameParts.slice(1).join(' ')
    }
  }
}

module.exports = CardCreatorService
