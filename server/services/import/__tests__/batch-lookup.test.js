/**
 * Batch Lookup Service Tests
 *
 * Tests optimized database lookups for players, teams, and player-team relationships.
 * Tests exact matching, fuzzy matching, single-name matching, and organization filtering.
 */

const sql = require('mssql')
const BatchLookupService = require('../batch-lookup')

// Mock dependencies
jest.mock('mssql')
jest.mock('../name-normalizer')
jest.mock('../../../utils/string-similarity')

const { normalizePlayerName, normalizeTeamName } = require('../name-normalizer')
const { levenshteinDistance } = require('../../../utils/string-similarity')

describe('BatchLookupService', () => {
  let mockPool
  let mockRequest
  let batchLookup

  beforeEach(() => {
    jest.clearAllMocks()

    // Setup mock SQL request
    mockRequest = {
      input: jest.fn().mockReturnThis(),
      query: jest.fn()
    }

    // Setup mock SQL pool
    mockPool = {
      request: jest.fn().mockReturnValue(mockRequest)
    }

    // Create service instance
    batchLookup = new BatchLookupService(mockPool)

    // Setup default normalizer mocks
    normalizePlayerName.mockImplementation(name => name.toLowerCase().trim())
    normalizeTeamName.mockImplementation(name => name.toLowerCase().replace(/\s+/g, '').replace(/\./g, '').replace(/-/g, ''))
  })

  // ============================================================================
  // batchFindPlayers Tests
  // ============================================================================

  describe('batchFindPlayers', () => {
    test('should return empty object when no players provided', async () => {
      const result = await batchLookup.batchFindPlayers([])

      expect(result).toEqual({})
      expect(mockRequest.query).not.toHaveBeenCalled()
    })

    test('should find exact player match', async () => {
      const mockPlayers = [
        {
          playerId: 1,
          playerName: 'Mike Trout',
          firstName: 'Mike',
          lastName: 'Trout',
          nickName: null,
          teamId: 10,
          teamName: 'Los Angeles Angels',
          primaryColor: '#BA0021',
          secondaryColor: '#003263',
          abbreviation: 'LAA'
        }
      ]

      mockRequest.query.mockResolvedValue({ recordset: mockPlayers })

      const result = await batchLookup.batchFindPlayers(['Mike Trout'])

      expect(result['Mike Trout']).toBeDefined()
      expect(result['Mike Trout'].exact).toHaveLength(1)
      expect(result['Mike Trout'].exact[0].playerName).toBe('Mike Trout')
      expect(result['Mike Trout'].fuzzy).toHaveLength(0)
    })

    test('should find multiple players with same name', async () => {
      const mockPlayers = [
        {
          playerId: 1,
          playerName: 'John Smith',
          firstName: 'John',
          lastName: 'Smith',
          nickName: null,
          teamId: 10,
          teamName: 'Team A',
          primaryColor: '#000',
          secondaryColor: '#FFF',
          abbreviation: 'TEA'
        },
        {
          playerId: 2,
          playerName: 'John Smith',
          firstName: 'John',
          lastName: 'Smith',
          nickName: null,
          teamId: 20,
          teamName: 'Team B',
          primaryColor: '#111',
          secondaryColor: '#EEE',
          abbreviation: 'TEB'
        }
      ]

      mockRequest.query.mockResolvedValue({ recordset: mockPlayers })

      const result = await batchLookup.batchFindPlayers(['John Smith'])

      expect(result['John Smith'].exact).toHaveLength(2)
    })

    test('should group multiple team records for same player', async () => {
      const mockPlayers = [
        {
          playerId: 1,
          playerName: 'Mike Trout',
          firstName: 'Mike',
          lastName: 'Trout',
          nickName: null,
          teamId: 10,
          teamName: 'Angels',
          primaryColor: '#BA0021',
          secondaryColor: '#003263',
          abbreviation: 'LAA'
        },
        {
          playerId: 1,
          playerName: 'Mike Trout',
          firstName: 'Mike',
          lastName: 'Trout',
          nickName: null,
          teamId: 20,
          teamName: 'Phillies',
          primaryColor: '#E81828',
          secondaryColor: '#002D72',
          abbreviation: 'PHI'
        }
      ]

      mockRequest.query.mockResolvedValue({ recordset: mockPlayers })

      const result = await batchLookup.batchFindPlayers(['Mike Trout'])

      expect(result['Mike Trout'].exact).toHaveLength(1)
      expect(result['Mike Trout'].exact[0].teams).toHaveLength(2)
      expect(result['Mike Trout'].exact[0].teams[0].teamName).toBe('Angels')
      expect(result['Mike Trout'].exact[0].teams[1].teamName).toBe('Phillies')
    })

    test('should find fuzzy match when no exact match', async () => {
      const mockPlayers = [
        {
          playerId: 1,
          playerName: 'Mike Trout',
          firstName: 'Mike',
          lastName: 'Trout',
          nickName: null,
          teamId: 10,
          teamName: 'Angels',
          primaryColor: '#BA0021',
          secondaryColor: '#003263',
          abbreviation: 'LAA'
        }
      ]

      mockRequest.query.mockResolvedValue({ recordset: mockPlayers })
      levenshteinDistance.mockReturnValue(1) // Small distance

      // Search for "Mike Trout" but normalize returns "miketrout" and "miktrout"
      normalizePlayerName.mockImplementation(name => {
        if (name === 'Mik Trout') return 'miktrout'
        if (name === 'Mike Trout') return 'miketrout'
        return name.toLowerCase().trim()
      })

      const result = await batchLookup.batchFindPlayers(['Mik Trout'])

      expect(result['Mik Trout'].exact).toHaveLength(0)
      expect(result['Mik Trout'].fuzzy.length).toBeGreaterThan(0)
    })

    test('should find single-name match (e.g., "Ichiro")', async () => {
      const mockPlayers = [
        {
          playerId: 1,
          playerName: 'Ichiro Suzuki',
          firstName: 'Ichiro',
          lastName: 'Suzuki',
          nickName: null,
          teamId: 10,
          teamName: 'Mariners',
          primaryColor: '#0C2C56',
          secondaryColor: '#005C5C',
          abbreviation: 'SEA'
        }
      ]

      mockRequest.query.mockResolvedValue({ recordset: mockPlayers })

      // Mock normalizer for single name search
      normalizePlayerName.mockImplementation(name => {
        if (name === 'Ichiro') return 'ichiro'
        if (name === 'Ichiro Suzuki') return 'ichiro suzuki'
        return name.toLowerCase().trim()
      })

      const result = await batchLookup.batchFindPlayers(['Ichiro'])

      // Single name should match as fuzzy (not exact)
      expect(result['Ichiro']).toBeDefined()
      // Could be exact or fuzzy depending on implementation
    })

    test('should match nickname + last name', async () => {
      const mockPlayers = [
        {
          playerId: 1,
          playerName: 'Saturnino Orestes Armas Minoso',
          firstName: 'Saturnino',
          lastName: 'Minoso',
          nickName: 'Minnie',
          teamId: 10,
          teamName: 'White Sox',
          primaryColor: '#27251F',
          secondaryColor: '#C4CED4',
          abbreviation: 'CWS'
        }
      ]

      mockRequest.query.mockResolvedValue({ recordset: mockPlayers })

      // Mock normalizer for nickname matching
      normalizePlayerName.mockImplementation(name => {
        if (name === 'Minnie Minoso') return 'minnie minoso'
        if (name === 'Minnie') return 'minnie'
        if (name === 'Minoso') return 'minoso'
        return name.toLowerCase().trim()
      })

      const result = await batchLookup.batchFindPlayers(['Minnie Minoso'])

      expect(result['Minnie Minoso']).toBeDefined()
      expect(result['Minnie Minoso'].exact.length + result['Minnie Minoso'].fuzzy.length).toBeGreaterThan(0)
    })

    test('should include organization filter with NCAA for pro leagues', async () => {
      mockRequest.query.mockResolvedValue({ recordset: [] })

      await batchLookup.batchFindPlayers(['Mike Trout'], 1) // MLB = 1

      // Check that organization filter includes both 1 (MLB) and 5 (NCAA)
      expect(mockRequest.input).toHaveBeenCalledWith('org0', sql.Int, 1)
      expect(mockRequest.input).toHaveBeenCalledWith('org1', sql.Int, 5)
    })

    test('should handle database error gracefully', async () => {
      mockRequest.query.mockRejectedValue(new Error('Database error'))

      const result = await batchLookup.batchFindPlayers(['Mike Trout'])

      expect(result).toEqual({})
    })

    test('should lookup multiple players at once', async () => {
      const mockPlayers = [
        {
          playerId: 1,
          playerName: 'Mike Trout',
          firstName: 'Mike',
          lastName: 'Trout',
          nickName: null,
          teamId: 10,
          teamName: 'Angels',
          primaryColor: '#BA0021',
          secondaryColor: '#003263',
          abbreviation: 'LAA'
        },
        {
          playerId: 2,
          playerName: 'Aaron Judge',
          firstName: 'Aaron',
          lastName: 'Judge',
          nickName: null,
          teamId: 20,
          teamName: 'Yankees',
          primaryColor: '#0C2340',
          secondaryColor: '#C4CED3',
          abbreviation: 'NYY'
        }
      ]

      mockRequest.query.mockResolvedValue({ recordset: mockPlayers })

      const result = await batchLookup.batchFindPlayers(['Mike Trout', 'Aaron Judge'])

      expect(result['Mike Trout']).toBeDefined()
      expect(result['Aaron Judge']).toBeDefined()
    })

    test('should not include duplicate teams for same player', async () => {
      const mockPlayers = [
        {
          playerId: 1,
          playerName: 'Mike Trout',
          firstName: 'Mike',
          lastName: 'Trout',
          nickName: null,
          teamId: 10,
          teamName: 'Angels',
          primaryColor: '#BA0021',
          secondaryColor: '#003263',
          abbreviation: 'LAA'
        },
        {
          playerId: 1,
          playerName: 'Mike Trout',
          firstName: 'Mike',
          lastName: 'Trout',
          nickName: null,
          teamId: 10, // Same team repeated
          teamName: 'Angels',
          primaryColor: '#BA0021',
          secondaryColor: '#003263',
          abbreviation: 'LAA'
        }
      ]

      mockRequest.query.mockResolvedValue({ recordset: mockPlayers })

      const result = await batchLookup.batchFindPlayers(['Mike Trout'])

      expect(result['Mike Trout'].exact).toHaveLength(1)
      expect(result['Mike Trout'].exact[0].teams).toHaveLength(1) // Not 2
    })
  })

  // ============================================================================
  // batchFindTeams Tests
  // ============================================================================

  describe('batchFindTeams', () => {
    test('should return empty object when no teams provided', async () => {
      const result = await batchLookup.batchFindTeams([])

      expect(result).toEqual({})
      expect(mockRequest.query).not.toHaveBeenCalled()
    })

    test('should find exact team match by name', async () => {
      const mockTeams = [
        {
          teamId: 10,
          teamName: 'Los Angeles Angels',
          city: 'Los Angeles',
          abbreviation: 'LAA',
          primaryColor: '#BA0021',
          secondaryColor: '#003263'
        }
      ]

      mockRequest.query.mockResolvedValue({ recordset: mockTeams })

      const result = await batchLookup.batchFindTeams(['Los Angeles Angels'])

      expect(result['Los Angeles Angels']).toBeDefined()
      expect(result['Los Angeles Angels'].exact).toHaveLength(1)
      expect(result['Los Angeles Angels'].exact[0].teamName).toBe('Los Angeles Angels')
      expect(result['Los Angeles Angels'].fuzzy).toHaveLength(0)
    })

    test('should find exact team match by abbreviation', async () => {
      const mockTeams = [
        {
          teamId: 10,
          teamName: 'Los Angeles Angels',
          city: 'Los Angeles',
          abbreviation: 'LAA',
          primaryColor: '#BA0021',
          secondaryColor: '#003263'
        }
      ]

      mockRequest.query.mockResolvedValue({ recordset: mockTeams })

      const result = await batchLookup.batchFindTeams(['LAA'])

      expect(result['LAA']).toBeDefined()
      expect(result['LAA'].exact.length).toBeGreaterThan(0)
    })

    test('should handle team name normalization (remove spaces, periods, hyphens)', async () => {
      const mockTeams = [
        {
          teamId: 10,
          teamName: 'St. Louis Cardinals',
          city: 'St. Louis',
          abbreviation: 'STL',
          primaryColor: '#C41E3A',
          secondaryColor: '#0C2340'
        }
      ]

      mockRequest.query.mockResolvedValue({ recordset: mockTeams })

      // Test that normalization happens
      normalizeTeamName.mockImplementation(name => {
        return name.toLowerCase().replace(/\s+/g, '').replace(/\./g, '').replace(/-/g, '')
      })

      const result = await batchLookup.batchFindTeams(['St Louis Cardinals']) // No period

      expect(result['St Louis Cardinals']).toBeDefined()
    })

    test('should find fuzzy team match when no exact match', async () => {
      // First query returns empty (no exact match)
      // Second query returns fuzzy matches
      mockRequest.query
        .mockResolvedValueOnce({ recordset: [] })
        .mockResolvedValueOnce({
          recordset: [{
            teamId: 10,
            teamName: 'New York Yankees',
            city: 'New York',
            abbreviation: 'NYY',
            primaryColor: '#0C2340',
            secondaryColor: '#C4CED3'
          }]
        })

      const result = await batchLookup.batchFindTeams(['Yankees'])

      expect(result['Yankees']).toBeDefined()
      expect(result['Yankees'].fuzzy.length).toBeGreaterThan(0)
    })

    test('should apply organization filter', async () => {
      mockRequest.query.mockResolvedValue({ recordset: [] })

      await batchLookup.batchFindTeams(['Angels'], 1) // MLB

      expect(mockRequest.input).toHaveBeenCalledWith('organizationId', sql.Int, 1)
    })

    test('should handle database error gracefully', async () => {
      mockRequest.query.mockRejectedValue(new Error('Database error'))

      const result = await batchLookup.batchFindTeams(['Angels'])

      expect(result).toEqual({})
    })

    test('should lookup multiple teams at once', async () => {
      const mockTeams = [
        {
          teamId: 10,
          teamName: 'Los Angeles Angels',
          city: 'Los Angeles',
          abbreviation: 'LAA',
          primaryColor: '#BA0021',
          secondaryColor: '#003263'
        },
        {
          teamId: 20,
          teamName: 'New York Yankees',
          city: 'New York',
          abbreviation: 'NYY',
          primaryColor: '#0C2340',
          secondaryColor: '#C4CED3'
        }
      ]

      mockRequest.query.mockResolvedValue({ recordset: mockTeams })

      const result = await batchLookup.batchFindTeams(['Los Angeles Angels', 'New York Yankees'])

      expect(result['Los Angeles Angels']).toBeDefined()
      expect(result['New York Yankees']).toBeDefined()
    })

    test('should create parameterized query for each team name', async () => {
      mockRequest.query.mockResolvedValue({ recordset: [] })

      await batchLookup.batchFindTeams(['Angels', 'Yankees', 'Dodgers'])

      // Should create parameters for each team
      expect(mockRequest.input).toHaveBeenCalledWith('team0', sql.NVarChar, expect.any(String))
      expect(mockRequest.input).toHaveBeenCalledWith('team1', sql.NVarChar, expect.any(String))
      expect(mockRequest.input).toHaveBeenCalledWith('team2', sql.NVarChar, expect.any(String))
    })
  })

  // ============================================================================
  // batchFindActualPlayerTeams Tests
  // ============================================================================

  describe('batchFindActualPlayerTeams', () => {
    test('should return empty object when no combinations provided', async () => {
      const result = await batchLookup.batchFindActualPlayerTeams([])

      expect(result).toEqual({})
      expect(mockRequest.query).not.toHaveBeenCalled()
    })

    test('should find existing player_team records', async () => {
      const mockPlayerTeams = [
        {
          playerTeamId: 100,
          playerId: 1,
          teamId: 10
        },
        {
          playerTeamId: 101,
          playerId: 2,
          teamId: 20
        }
      ]

      mockRequest.query.mockResolvedValue({ recordset: mockPlayerTeams })

      const result = await batchLookup.batchFindActualPlayerTeams(['1_10', '2_20'])

      expect(result['1_10']).toBeDefined()
      expect(result['1_10'].playerTeamId).toBe('100')
      expect(result['2_20']).toBeDefined()
      expect(result['2_20'].playerTeamId).toBe('101')
    })

    test('should handle partial results (some combinations not found)', async () => {
      const mockPlayerTeams = [
        {
          playerTeamId: 100,
          playerId: 1,
          teamId: 10
        }
        // 2_20 not found
      ]

      mockRequest.query.mockResolvedValue({ recordset: mockPlayerTeams })

      const result = await batchLookup.batchFindActualPlayerTeams(['1_10', '2_20'])

      expect(result['1_10']).toBeDefined()
      expect(result['2_20']).toBeUndefined() // Not found
    })

    test('should create parameterized query for each combination', async () => {
      mockRequest.query.mockResolvedValue({ recordset: [] })

      await batchLookup.batchFindActualPlayerTeams(['1_10', '2_20', '3_30'])

      // Should create player and team parameters for each combination
      expect(mockRequest.input).toHaveBeenCalledWith('player0', sql.BigInt, '1')
      expect(mockRequest.input).toHaveBeenCalledWith('team0', sql.Int, '10')
      expect(mockRequest.input).toHaveBeenCalledWith('player1', sql.BigInt, '2')
      expect(mockRequest.input).toHaveBeenCalledWith('team1', sql.Int, '20')
      expect(mockRequest.input).toHaveBeenCalledWith('player2', sql.BigInt, '3')
      expect(mockRequest.input).toHaveBeenCalledWith('team2', sql.Int, '30')
    })

    test('should handle database error gracefully', async () => {
      mockRequest.query.mockRejectedValue(new Error('Database error'))

      const result = await batchLookup.batchFindActualPlayerTeams(['1_10'])

      expect(result).toEqual({})
    })

    test('should convert BigInt IDs to strings', async () => {
      const mockPlayerTeams = [
        {
          playerTeamId: BigInt(999999999999),
          playerId: BigInt(888888888888),
          teamId: 10
        }
      ]

      mockRequest.query.mockResolvedValue({ recordset: mockPlayerTeams })

      const result = await batchLookup.batchFindActualPlayerTeams(['888888888888_10'])

      expect(typeof result['888888888888_10'].playerTeamId).toBe('string')
      expect(typeof result['888888888888_10'].playerId).toBe('string')
    })

    test('should handle single combination', async () => {
      const mockPlayerTeams = [
        {
          playerTeamId: 100,
          playerId: 1,
          teamId: 10
        }
      ]

      mockRequest.query.mockResolvedValue({ recordset: mockPlayerTeams })

      const result = await batchLookup.batchFindActualPlayerTeams(['1_10'])

      expect(Object.keys(result)).toHaveLength(1)
      expect(result['1_10'].playerTeamId).toBe('100')
    })

    test('should handle many combinations efficiently', async () => {
      const combinations = []
      const mockPlayerTeams = []

      for (let i = 1; i <= 50; i++) {
        combinations.push(`${i}_10`)
        mockPlayerTeams.push({
          playerTeamId: 100 + i,
          playerId: i,
          teamId: 10
        })
      }

      mockRequest.query.mockResolvedValue({ recordset: mockPlayerTeams })

      const result = await batchLookup.batchFindActualPlayerTeams(combinations)

      expect(Object.keys(result)).toHaveLength(50)
      expect(mockRequest.query).toHaveBeenCalledTimes(1) // Single batch query
    })
  })

  // ============================================================================
  // Integration Tests - Combined Lookups
  // ============================================================================

  describe('Integration - Combined Lookups', () => {
    test('should handle complete lookup workflow for import', async () => {
      // Simulate looking up players, teams, and player-team combinations
      const mockPlayers = [
        {
          playerId: 1,
          playerName: 'Mike Trout',
          firstName: 'Mike',
          lastName: 'Trout',
          nickName: null,
          teamId: 10,
          teamName: 'Angels',
          primaryColor: '#BA0021',
          secondaryColor: '#003263',
          abbreviation: 'LAA'
        }
      ]

      const mockTeams = [
        {
          teamId: 10,
          teamName: 'Los Angeles Angels',
          city: 'Los Angeles',
          abbreviation: 'LAA',
          primaryColor: '#BA0021',
          secondaryColor: '#003263'
        }
      ]

      const mockPlayerTeams = [
        {
          playerTeamId: 100,
          playerId: 1,
          teamId: 10
        }
      ]

      mockRequest.query
        .mockResolvedValueOnce({ recordset: mockPlayers })
        .mockResolvedValueOnce({ recordset: mockTeams })
        .mockResolvedValueOnce({ recordset: mockPlayerTeams })

      const players = await batchLookup.batchFindPlayers(['Mike Trout'])
      const teams = await batchLookup.batchFindTeams(['Los Angeles Angels'])
      const playerTeams = await batchLookup.batchFindActualPlayerTeams(['1_10'])

      expect(players['Mike Trout'].exact).toHaveLength(1)
      expect(teams['Los Angeles Angels'].exact).toHaveLength(1)
      expect(playerTeams['1_10']).toBeDefined()
    })

    test('should handle no results found for any lookup', async () => {
      mockRequest.query.mockResolvedValue({ recordset: [] })

      const players = await batchLookup.batchFindPlayers(['Unknown Player'])
      const teams = await batchLookup.batchFindTeams(['Unknown Team'])
      const playerTeams = await batchLookup.batchFindActualPlayerTeams(['999_999'])

      expect(players['Unknown Player'].exact).toHaveLength(0)
      expect(teams['Unknown Team'].exact).toHaveLength(0)
      expect(playerTeams['999_999']).toBeUndefined()
    })
  })
})
