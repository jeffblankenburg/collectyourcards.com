/**
 * Card Creator Service Tests
 *
 * Tests bulk card creation with player-team relationships, transactions,
 * and handling of existing vs new players/teams.
 */

const sql = require('mssql')
const CardCreatorService = require('../card-creator')

// Mock SQL module
jest.mock('mssql')

describe('CardCreatorService', () => {
  let cardCreator
  let mockTransaction
  let mockRequest

  beforeEach(() => {
    jest.clearAllMocks()

    // Setup mock request
    mockRequest = {
      input: jest.fn().mockReturnThis(),
      query: jest.fn()
    }

    // Setup mock transaction
    mockTransaction = {
      request: jest.fn().mockReturnValue(mockRequest)
    }

    cardCreator = new CardCreatorService()
  })

  // ============================================================================
  // createCards Tests
  // ============================================================================

  describe('createCards', () => {
    test('should create single card with existing player and player_team', async () => {
      const matchedCards = [
        {
          cardNumber: '1',
          isRC: true,
          isAutograph: false,
          isRelic: false,
          notes: 'Rookie Card',
          sortOrder: 1,
          players: [
            {
              name: 'Mike Trout',
              selectedPlayer: { playerId: 1, playerName: 'Mike Trout' },
              selectedPlayerTeams: [
                {
                  playerTeamId: 100,
                  playerId: 1,
                  teamId: 10,
                  playerName: 'Mike Trout',
                  teamName: 'Angels'
                }
              ]
            }
          ]
        }
      ]

      // Mock card creation
      mockRequest.query.mockResolvedValueOnce({
        recordset: [{ card_id: 1000 }]
      })

      // Mock card_player_team creation
      mockRequest.query.mockResolvedValueOnce({})

      const result = await cardCreator.createCards(matchedCards, 50, mockTransaction)

      expect(result.success).toBe(true)
      expect(result.created).toBe(1)
      expect(mockTransaction.request).toHaveBeenCalled()
    })

    test('should create multiple cards', async () => {
      const matchedCards = [
        {
          cardNumber: '1',
          players: [],
          sortOrder: 1
        },
        {
          cardNumber: '2',
          players: [],
          sortOrder: 2
        },
        {
          cardNumber: '3',
          players: [],
          sortOrder: 3
        }
      ]

      // Mock card creations
      mockRequest.query
        .mockResolvedValueOnce({ recordset: [{ card_id: 1000 }] })
        .mockResolvedValueOnce({ recordset: [{ card_id: 1001 }] })
        .mockResolvedValueOnce({ recordset: [{ card_id: 1002 }] })

      const result = await cardCreator.createCards(matchedCards, 50, mockTransaction)

      expect(result.success).toBe(true)
      expect(result.created).toBe(3)
    })

    test('should handle card with no players', async () => {
      const matchedCards = [
        {
          cardNumber: '1',
          players: [],
          sortOrder: 1
        }
      ]

      mockRequest.query.mockResolvedValueOnce({
        recordset: [{ card_id: 1000 }]
      })

      const result = await cardCreator.createCards(matchedCards, 50, mockTransaction)

      expect(result.success).toBe(true)
      expect(result.created).toBe(1)
    })

    test('should handle card with multiple players', async () => {
      const matchedCards = [
        {
          cardNumber: '100',
          players: [
            {
              name: 'Player A',
              selectedPlayer: { playerId: 1, playerName: 'Player A' },
              selectedPlayerTeams: [{ playerTeamId: 100, playerId: 1, teamId: 10 }]
            },
            {
              name: 'Player B',
              selectedPlayer: { playerId: 2, playerName: 'Player B' },
              selectedPlayerTeams: [{ playerTeamId: 101, playerId: 2, teamId: 20 }]
            }
          ],
          sortOrder: 1
        }
      ]

      mockRequest.query
        .mockResolvedValueOnce({ recordset: [{ card_id: 1000 }] }) // Card creation
        .mockResolvedValueOnce({}) // First card_player_team
        .mockResolvedValueOnce({}) // Second card_player_team

      const result = await cardCreator.createCards(matchedCards, 50, mockTransaction)

      expect(result.success).toBe(true)
      expect(result.created).toBe(1)
    })
  })

  // ============================================================================
  // _createCardRecord Tests
  // ============================================================================

  describe('_createCardRecord', () => {
    test('should create card with all properties', async () => {
      const card = {
        cardNumber: '1',
        isRC: true,
        isAutograph: true,
        isRelic: false,
        printRun: 99,
        colorId: 5,
        notes: 'Red Refractor',
        sortOrder: 1
      }

      mockRequest.query.mockResolvedValue({
        recordset: [{ card_id: 1000 }]
      })

      const cardId = await cardCreator._createCardRecord(card, 50, mockTransaction)

      expect(cardId).toBe(1000)
      expect(mockRequest.input).toHaveBeenCalledWith('cardNumber', sql.NVarChar, '1')
      expect(mockRequest.input).toHaveBeenCalledWith('seriesId', sql.BigInt, 50)
      expect(mockRequest.input).toHaveBeenCalledWith('isRookie', sql.Bit, true)
      expect(mockRequest.input).toHaveBeenCalledWith('isAutograph', sql.Bit, true)
      expect(mockRequest.input).toHaveBeenCalledWith('isRelic', sql.Bit, false)
      expect(mockRequest.input).toHaveBeenCalledWith('printRun', sql.Int, 99)
      expect(mockRequest.input).toHaveBeenCalledWith('colorId', sql.Int, 5)
      expect(mockRequest.input).toHaveBeenCalledWith('notes', sql.NVarChar, 'Red Refractor')
      expect(mockRequest.input).toHaveBeenCalledWith('sortOrder', sql.Int, 1)
    })

    test('should handle card with null optional values', async () => {
      const card = {
        cardNumber: '1',
        isRC: false,
        isAutograph: false,
        isRelic: false,
        sortOrder: 1
      }

      mockRequest.query.mockResolvedValue({
        recordset: [{ card_id: 1001 }]
      })

      const cardId = await cardCreator._createCardRecord(card, 50, mockTransaction)

      expect(cardId).toBe(1001)
      expect(mockRequest.input).toHaveBeenCalledWith('printRun', sql.Int, null)
      expect(mockRequest.input).toHaveBeenCalledWith('colorId', sql.Int, null)
      expect(mockRequest.input).toHaveBeenCalledWith('notes', sql.NVarChar, null)
    })
  })

  // ============================================================================
  // _handleExistingPlayerWithTeams Tests
  // ============================================================================

  describe('_handleExistingPlayerWithTeams', () => {
    test('should create card_player_team for existing player_team', async () => {
      const player = {
        selectedPlayer: { playerId: 1, playerName: 'Mike Trout' },
        selectedPlayerTeams: [
          {
            playerTeamId: 100,
            playerId: 1,
            teamId: 10,
            playerName: 'Mike Trout',
            teamName: 'Angels'
          }
        ]
      }

      mockRequest.query.mockResolvedValue({}) // card_player_team creation

      await cardCreator._handleExistingPlayerWithTeams(player, 1000, mockTransaction)

      expect(mockRequest.input).toHaveBeenCalledWith('cardId', sql.BigInt, 1000)
      expect(mockRequest.input).toHaveBeenCalledWith('playerTeamId', sql.BigInt, 100)
    })

    test('should resolve placeholder IDs (existing_playerId_teamId)', async () => {
      const player = {
        selectedPlayer: { playerId: 1, playerName: 'Mike Trout' },
        selectedPlayerTeams: [
          {
            playerTeamId: 'existing_1_10', // Placeholder ID
            playerId: 1,
            teamId: 10,
            playerName: 'Mike Trout',
            teamName: 'Angels'
          }
        ]
      }

      // Mock placeholder resolution
      mockRequest.query
        .mockResolvedValueOnce({
          recordset: [{ player_team_id: 100 }]
        })
        .mockResolvedValueOnce({}) // card_player_team creation

      await cardCreator._handleExistingPlayerWithTeams(player, 1000, mockTransaction)

      expect(mockRequest.query).toHaveBeenCalledTimes(2)
    })

    test('should handle multiple player_team records for one player', async () => {
      const player = {
        selectedPlayer: { playerId: 1, playerName: 'Mike Trout' },
        selectedPlayerTeams: [
          {
            playerTeamId: 100,
            playerId: 1,
            teamId: 10,
            playerName: 'Mike Trout',
            teamName: 'Angels'
          },
          {
            playerTeamId: 101,
            playerId: 1,
            teamId: 20,
            playerName: 'Mike Trout',
            teamName: 'Phillies'
          }
        ]
      }

      mockRequest.query
        .mockResolvedValueOnce({}) // First card_player_team
        .mockResolvedValueOnce({}) // Second card_player_team

      await cardCreator._handleExistingPlayerWithTeams(player, 1000, mockTransaction)

      expect(mockRequest.query).toHaveBeenCalledTimes(2)
    })

    test('should skip when player_team cannot be resolved', async () => {
      const player = {
        selectedPlayer: { playerId: 1, playerName: 'Mike Trout' },
        selectedPlayerTeams: [
          {
            playerTeamId: 'existing_1_10',
            playerId: 1,
            teamId: 10,
            playerName: 'Mike Trout',
            teamName: 'Angels'
          }
        ]
      }

      // Mock placeholder resolution - returns no results
      mockRequest.query.mockResolvedValueOnce({
        recordset: []
      })

      await cardCreator._handleExistingPlayerWithTeams(player, 1000, mockTransaction)

      // Should only call once (the resolution query), not create card_player_team
      expect(mockRequest.query).toHaveBeenCalledTimes(1)
    })
  })

  // ============================================================================
  // _handleExistingPlayerCreateTeams Tests
  // ============================================================================

  describe('_handleExistingPlayerCreateTeams', () => {
    test('should use existing player_team when it exists', async () => {
      const player = {
        selectedPlayer: { playerId: 1, playerName: 'Mike Trout' },
        selectedTeams: [
          { teamId: 10, teamName: 'Angels' }
        ]
      }

      // Mock existing player_team query
      mockRequest.query
        .mockResolvedValueOnce({
          recordset: [{ player_team_id: 100 }]
        })
        .mockResolvedValueOnce({}) // card_player_team creation

      await cardCreator._handleExistingPlayerCreateTeams(player, 1000, mockTransaction)

      expect(mockRequest.query).toHaveBeenCalledTimes(2)
    })

    test('should create new player_team when it does not exist', async () => {
      const player = {
        selectedPlayer: { playerId: 1, playerName: 'Mike Trout' },
        selectedTeams: [
          { teamId: 10, teamName: 'Angels' }
        ]
      }

      // Mock player_team check (not found) and creation
      mockRequest.query
        .mockResolvedValueOnce({ recordset: [] }) // Not found
        .mockResolvedValueOnce({ recordset: [{ player_team_id: 100 }] }) // Created
        .mockResolvedValueOnce({}) // card_player_team creation

      await cardCreator._handleExistingPlayerCreateTeams(player, 1000, mockTransaction)

      expect(mockRequest.query).toHaveBeenCalledTimes(3)
    })

    test('should handle multiple teams for one player', async () => {
      const player = {
        selectedPlayer: { playerId: 1, playerName: 'Mike Trout' },
        selectedTeams: [
          { teamId: 10, teamName: 'Angels' },
          { teamId: 20, teamName: 'Phillies' }
        ]
      }

      // Mock for each team
      mockRequest.query
        .mockResolvedValueOnce({ recordset: [{ player_team_id: 100 }] }) // Team 1 exists
        .mockResolvedValueOnce({}) // card_player_team 1
        .mockResolvedValueOnce({ recordset: [] }) // Team 2 not found
        .mockResolvedValueOnce({ recordset: [{ player_team_id: 101 }] }) // Team 2 created
        .mockResolvedValueOnce({}) // card_player_team 2

      await cardCreator._handleExistingPlayerCreateTeams(player, 1000, mockTransaction)

      expect(mockRequest.query).toHaveBeenCalledTimes(5)
    })
  })

  // ============================================================================
  // _handleNewPlayer Tests
  // ============================================================================

  describe('_handleNewPlayer', () => {
    test('should create new player with teams', async () => {
      const player = {
        name: 'Mike Trout',
        selectedTeams: [
          { teamId: 10, teamName: 'Angels' }
        ]
      }

      // Mock player creation
      mockRequest.query
        .mockResolvedValueOnce({ recordset: [{ player_id: 1 }] }) // Player created
        .mockResolvedValueOnce({ recordset: [{ player_team_id: 100 }] }) // player_team created
        .mockResolvedValueOnce({}) // card_player_team created

      await cardCreator._handleNewPlayer(player, 1000, mockTransaction, new Map())

      expect(mockRequest.query).toHaveBeenCalledTimes(3)
      expect(mockRequest.input).toHaveBeenCalledWith('firstName', sql.NVarChar, 'Mike')
      expect(mockRequest.input).toHaveBeenCalledWith('lastName', sql.NVarChar, 'Trout')
    })

    test('should cache newly created player to avoid duplicates', async () => {
      const player1 = {
        name: 'Mike Trout',
        selectedTeams: [{ teamId: 10, teamName: 'Angels' }]
      }

      const player2 = {
        name: 'Mike Trout', // Same player
        selectedTeams: [{ teamId: 20, teamName: 'Phillies' }]
      }

      const cache = new Map()

      // First player creation
      mockRequest.query
        .mockResolvedValueOnce({ recordset: [{ player_id: 1 }] })
        .mockResolvedValueOnce({ recordset: [{ player_team_id: 100 }] })
        .mockResolvedValueOnce({})
        // Second player (uses cache, different team)
        .mockResolvedValueOnce({ recordset: [{ player_team_id: 101 }] })
        .mockResolvedValueOnce({})

      await cardCreator._handleNewPlayer(player1, 1000, mockTransaction, cache)
      await cardCreator._handleNewPlayer(player2, 1001, mockTransaction, cache)

      // Should only create player once, not twice
      // First call: 3 queries (player, player_team, card_player_team)
      // Second call: 2 queries (player_team, card_player_team) - player cached
      expect(mockRequest.query).toHaveBeenCalledTimes(5)
    })

    test('should handle single-name players', async () => {
      const player = {
        name: 'Ichiro',
        selectedTeams: [{ teamId: 10, teamName: 'Mariners' }]
      }

      mockRequest.query
        .mockResolvedValueOnce({ recordset: [{ player_id: 1 }] })
        .mockResolvedValueOnce({ recordset: [{ player_team_id: 100 }] })
        .mockResolvedValueOnce({})

      await cardCreator._handleNewPlayer(player, 1000, mockTransaction, new Map())

      expect(mockRequest.input).toHaveBeenCalledWith('firstName', sql.NVarChar, 'Ichiro')
      expect(mockRequest.input).toHaveBeenCalledWith('lastName', sql.NVarChar, '')
    })

    test('should handle multi-word last names', async () => {
      const player = {
        name: 'Fernando Tatis Jr.',
        selectedTeams: [{ teamId: 10, teamName: 'Padres' }]
      }

      mockRequest.query
        .mockResolvedValueOnce({ recordset: [{ player_id: 1 }] })
        .mockResolvedValueOnce({ recordset: [{ player_team_id: 100 }] })
        .mockResolvedValueOnce({})

      await cardCreator._handleNewPlayer(player, 1000, mockTransaction, new Map())

      expect(mockRequest.input).toHaveBeenCalledWith('firstName', sql.NVarChar, 'Fernando')
      expect(mockRequest.input).toHaveBeenCalledWith('lastName', sql.NVarChar, 'Tatis Jr.')
    })

    test('should handle new player with no teams selected', async () => {
      const player = {
        name: 'Unknown Player',
        selectedTeams: []
      }

      mockRequest.query.mockResolvedValueOnce({
        recordset: [{ player_id: 1 }]
      })

      await cardCreator._handleNewPlayer(player, 1000, mockTransaction, new Map())

      // Should only create player, not player_team or card_player_team
      expect(mockRequest.query).toHaveBeenCalledTimes(1)
    })

    test('should handle new player with multiple teams', async () => {
      const player = {
        name: 'Mike Trout',
        selectedTeams: [
          { teamId: 10, teamName: 'Angels' },
          { teamId: 20, teamName: 'Phillies' },
          { teamId: 30, teamName: 'Team USA' }
        ]
      }

      mockRequest.query
        .mockResolvedValueOnce({ recordset: [{ player_id: 1 }] }) // Player
        .mockResolvedValueOnce({ recordset: [{ player_team_id: 100 }] }) // PT 1
        .mockResolvedValueOnce({}) // CPT 1
        .mockResolvedValueOnce({ recordset: [{ player_team_id: 101 }] }) // PT 2
        .mockResolvedValueOnce({}) // CPT 2
        .mockResolvedValueOnce({ recordset: [{ player_team_id: 102 }] }) // PT 3
        .mockResolvedValueOnce({}) // CPT 3

      await cardCreator._handleNewPlayer(player, 1000, mockTransaction, new Map())

      expect(mockRequest.query).toHaveBeenCalledTimes(7)
    })
  })

  // ============================================================================
  // _parsePlayerName Tests
  // ============================================================================

  describe('_parsePlayerName', () => {
    test('should parse standard two-part name', () => {
      const result = cardCreator._parsePlayerName('Mike Trout')

      expect(result.firstName).toBe('Mike')
      expect(result.lastName).toBe('Trout')
    })

    test('should handle single name', () => {
      const result = cardCreator._parsePlayerName('Ichiro')

      expect(result.firstName).toBe('Ichiro')
      expect(result.lastName).toBe('')
    })

    test('should handle multi-word last name', () => {
      const result = cardCreator._parsePlayerName('Fernando Tatis Jr.')

      expect(result.firstName).toBe('Fernando')
      expect(result.lastName).toBe('Tatis Jr.')
    })

    test('should handle three-word name', () => {
      const result = cardCreator._parsePlayerName('Juan Carlos Rodriguez')

      expect(result.firstName).toBe('Juan')
      expect(result.lastName).toBe('Carlos Rodriguez')
    })

    test('should handle name with extra whitespace', () => {
      const result = cardCreator._parsePlayerName('  Mike   Trout  ')

      expect(result.firstName).toBe('Mike')
      expect(result.lastName).toBe('Trout')
    })

    test('should handle empty string', () => {
      const result = cardCreator._parsePlayerName('')

      expect(result.firstName).toBe('')
      expect(result.lastName).toBe('')
    })
  })

  // ============================================================================
  // Integration Tests
  // ============================================================================

  describe('Integration - Complete Card Creation Workflow', () => {
    test('should handle card with mixed player types', async () => {
      const matchedCards = [
        {
          cardNumber: '100',
          players: [
            // Existing player with existing player_team
            {
              name: 'Player A',
              selectedPlayer: { playerId: 1, playerName: 'Player A' },
              selectedPlayerTeams: [
                { playerTeamId: 100, playerId: 1, teamId: 10 }
              ]
            },
            // Existing player needs player_team created
            {
              name: 'Player B',
              selectedPlayer: { playerId: 2, playerName: 'Player B' },
              selectedTeams: [{ teamId: 20, teamName: 'Team B' }]
            },
            // New player
            {
              name: 'Player C',
              selectedTeams: [{ teamId: 30, teamName: 'Team C' }]
            }
          ],
          sortOrder: 1
        }
      ]

      // Mock all queries needed for this complex scenario
      mockRequest.query
        .mockResolvedValueOnce({ recordset: [{ card_id: 1000 }] }) // Card creation
        .mockResolvedValueOnce({}) // CPT for Player A
        .mockResolvedValueOnce({ recordset: [{ player_team_id: 101 }] }) // PT for Player B
        .mockResolvedValueOnce({}) // CPT for Player B
        .mockResolvedValueOnce({ recordset: [{ player_id: 3 }] }) // Create Player C
        .mockResolvedValueOnce({ recordset: [{ player_team_id: 102 }] }) // PT for Player C
        .mockResolvedValueOnce({}) // CPT for Player C

      const result = await cardCreator.createCards(matchedCards, 50, mockTransaction)

      expect(result.success).toBe(true)
      expect(result.created).toBe(1)
    })

    test('should handle complete import of multiple cards', async () => {
      const matchedCards = [
        {
          cardNumber: '1',
          players: [
            {
              name: 'Mike Trout',
              selectedPlayer: { playerId: 1, playerName: 'Mike Trout' },
              selectedPlayerTeams: [{ playerTeamId: 100, playerId: 1, teamId: 10 }]
            }
          ],
          sortOrder: 1
        },
        {
          cardNumber: '2',
          players: [
            {
              name: 'Aaron Judge',
              selectedPlayer: { playerId: 2, playerName: 'Aaron Judge' },
              selectedPlayerTeams: [{ playerTeamId: 101, playerId: 2, teamId: 20 }]
            }
          ],
          sortOrder: 2
        }
      ]

      // Mock card and relationship creations
      mockRequest.query
        .mockResolvedValueOnce({ recordset: [{ card_id: 1000 }] })
        .mockResolvedValueOnce({})
        .mockResolvedValueOnce({ recordset: [{ card_id: 1001 }] })
        .mockResolvedValueOnce({})

      const result = await cardCreator.createCards(matchedCards, 50, mockTransaction)

      expect(result.success).toBe(true)
      expect(result.created).toBe(2)
      expect(result.message).toBe('Successfully imported 2 cards')
    })
  })
})
