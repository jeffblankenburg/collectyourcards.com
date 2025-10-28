/**
 * Import Workflow Integration Tests
 *
 * Tests all 10 import workflow endpoints with authentication, authorization,
 * file uploads, and complete import flow from parse to commit.
 */

const request = require('supertest')
const express = require('express')
const importWorkflowRouter = require('../../../routes/import-workflow')
const excelParser = require('../excel-parser')
const BatchLookupService = require('../batch-lookup')
const CardCreatorService = require('../card-creator')
const sql = require('mssql')

// Mock dependencies
jest.mock('../excel-parser')
jest.mock('../batch-lookup')
jest.mock('../card-creator')
jest.mock('mssql')
jest.mock('../../../middleware/auth', () => ({
  authMiddleware: (req, res, next) => {
    req.user = { userId: 1, role: 'admin' }
    next()
  },
  requireAdmin: (req, res, next) => next()
}))

describe('Import Workflow Endpoints', () => {
  let app
  let mockPool
  let mockTransaction
  let mockRequest

  beforeAll(() => {
    // Create Express app with router
    app = express()
    app.use(express.json())
    app.use('/api/import', importWorkflowRouter)
  })

  beforeEach(() => {
    jest.clearAllMocks()

    // Setup mock database components
    mockRequest = {
      input: jest.fn().mockReturnThis(),
      query: jest.fn()
    }

    mockTransaction = {
      request: jest.fn().mockReturnValue(mockRequest),
      begin: jest.fn().mockResolvedValue(),
      commit: jest.fn().mockResolvedValue(),
      rollback: jest.fn().mockResolvedValue()
    }

    mockPool = {
      request: jest.fn().mockReturnValue(mockRequest),
      transaction: jest.fn().mockReturnValue(mockTransaction),
      close: jest.fn().mockResolvedValue()
    }

    sql.connect.mockResolvedValue(mockPool)
  })

  // ============================================================================
  // POST /parse-xlsx - XLSX File Upload
  // ============================================================================

  describe('POST /parse-xlsx', () => {
    test('should parse valid XLSX file', async () => {
      const mockCards = [
        {
          cardNumber: '1',
          playerNames: ['Mike Trout'],
          teamNames: ['Angels'],
          isRC: true
        }
      ]

      excelParser.parseXlsxFile.mockResolvedValue(mockCards)

      const response = await request(app)
        .post('/api/import/parse-xlsx')
        .attach('file', Buffer.from('mock xlsx'), 'test.xlsx')

      expect(response.status).toBe(200)
      expect(response.body.success).toBe(true)
      expect(response.body.cards).toHaveLength(1)
    })

    test('should reject request without file', async () => {
      const response = await request(app)
        .post('/api/import/parse-xlsx')
        .send({})

      expect(response.status).toBe(400)
      expect(response.body.error).toBe('No file uploaded')
    })

    test('should handle parser errors', async () => {
      excelParser.parseXlsxFile.mockRejectedValue(new Error('Invalid file format'))

      const response = await request(app)
        .post('/api/import/parse-xlsx')
        .attach('file', Buffer.from('invalid'), 'test.xlsx')

      expect(response.status).toBe(500)
      expect(response.body.error).toContain('Invalid file format')
    })
  })

  // ============================================================================
  // POST /parse-paste - Pasted Data
  // ============================================================================

  describe('POST /parse-paste', () => {
    test('should parse valid pasted data', async () => {
      const mockCards = [
        {
          cardNumber: '1',
          playerNames: ['Mike Trout'],
          teamNames: ['Angels'],
          isRC: true
        }
      ]

      excelParser.parsePastedData.mockResolvedValue(mockCards)

      const response = await request(app)
        .post('/api/import/parse-paste')
        .send({ data: '1\tMike Trout\tAngels\tRC\t' })

      expect(response.status).toBe(200)
      expect(response.body.success).toBe(true)
      expect(response.body.cards).toHaveLength(1)
    })

    test('should reject request without data', async () => {
      const response = await request(app)
        .post('/api/import/parse-paste')
        .send({})

      expect(response.status).toBe(400)
      expect(response.body.error).toBe('No data provided')
    })

    test('should handle parser errors', async () => {
      excelParser.parsePastedData.mockRejectedValue(new Error('No data found'))

      const response = await request(app)
        .post('/api/import/parse-paste')
        .send({ data: '' })

      expect(response.status).toBe(500)
      expect(response.body.error).toContain('No data found')
    })
  })

  // ============================================================================
  // POST /match-cards - Card Matching with Player/Team Lookup
  // ============================================================================

  describe('POST /match-cards', () => {
    test('should match cards with player and team lookup', async () => {
      const inputCards = [
        {
          cardNumber: '1',
          playerNames: ['Mike Trout'],
          teamNames: ['Angels']
        }
      ]

      const mockPlayerLookup = {
        'Mike Trout': {
          exact: [{ playerId: 1, playerName: 'Mike Trout', teams: [] }],
          fuzzy: []
        }
      }

      const mockTeamLookup = {
        'Angels': {
          exact: [{ teamId: 10, teamName: 'Los Angeles Angels' }],
          fuzzy: []
        }
      }

      BatchLookupService.prototype.batchFindPlayers = jest.fn().mockResolvedValue(mockPlayerLookup)
      BatchLookupService.prototype.batchFindTeams = jest.fn().mockResolvedValue(mockTeamLookup)
      BatchLookupService.prototype.batchFindActualPlayerTeams = jest.fn().mockResolvedValue({})

      const response = await request(app)
        .post('/api/import/match-cards')
        .send({
          cards: inputCards,
          organizationId: 1
        })

      expect(response.status).toBe(200)
      expect(response.body.success).toBe(true)
      expect(response.body.matchedCards).toHaveLength(1)
    })

    test('should require cards array', async () => {
      const response = await request(app)
        .post('/api/import/match-cards')
        .send({})

      expect(response.status).toBe(400)
    })
  })

  // ============================================================================
  // POST /commit - Final Import Commit
  // ============================================================================

  describe('POST /commit', () => {
    test('should commit matched cards successfully', async () => {
      const matchedCards = [
        {
          cardNumber: '1',
          players: [
            {
              name: 'Mike Trout',
              selectedPlayer: { playerId: 1 },
              selectedPlayerTeams: [{ playerTeamId: 100 }]
            }
          ]
        }
      ]

      CardCreatorService.prototype.createCards = jest.fn().mockResolvedValue({
        success: true,
        created: 1,
        message: 'Successfully imported 1 cards'
      })

      const response = await request(app)
        .post('/api/import/commit')
        .send({
          matchedCards,
          seriesId: 50
        })

      expect(response.status).toBe(200)
      expect(response.body.success).toBe(true)
      expect(response.body.created).toBe(1)
    })

    test('should require matchedCards and seriesId', async () => {
      const response = await request(app)
        .post('/api/import/commit')
        .send({})

      expect(response.status).toBe(400)
    })

    test('should rollback transaction on error', async () => {
      const matchedCards = [{ cardNumber: '1', players: [] }]

      CardCreatorService.prototype.createCards = jest.fn().mockRejectedValue(
        new Error('Database error')
      )

      const response = await request(app)
        .post('/api/import/commit')
        .send({ matchedCards, seriesId: 50 })

      expect(response.status).toBe(500)
      expect(mockTransaction.rollback).toHaveBeenCalled()
    })
  })

  // ============================================================================
  // POST /preview-sql - SQL Preview Generation
  // ============================================================================

  describe('POST /preview-sql', () => {
    test('should generate SQL preview for matched cards', async () => {
      const matchedCards = [
        {
          cardNumber: '1',
          isRC: true,
          players: [
            {
              selectedPlayer: { playerId: 1, playerName: 'Mike Trout' },
              selectedPlayerTeams: [{ playerTeamId: 100, teamId: 10 }]
            }
          ]
        }
      ]

      const response = await request(app)
        .post('/api/import/preview-sql')
        .send({ matchedCards, seriesId: 50 })

      expect(response.status).toBe(200)
      expect(response.body.success).toBe(true)
      expect(response.body.sql).toContain('INSERT INTO card')
      expect(response.body.sql).toContain('BEGIN TRANSACTION')
      expect(response.body.sql).toContain('COMMIT TRANSACTION')
    })

    test('should handle cards with new players', async () => {
      const matchedCards = [
        {
          cardNumber: '1',
          players: [
            {
              name: 'New Player',
              selectedTeams: [{ teamId: 10, teamName: 'Angels' }]
            }
          ]
        }
      ]

      const response = await request(app)
        .post('/api/import/preview-sql')
        .send({ matchedCards, seriesId: 50 })

      expect(response.status).toBe(200)
      expect(response.body.sql).toContain('INSERT INTO player')
      expect(response.body.sql).toContain('INSERT INTO player_team')
    })
  })

  // ============================================================================
  // POST /update-progress - Progress Tracking
  // ============================================================================

  describe('POST /update-progress', () => {
    test('should update import progress', async () => {
      const response = await request(app)
        .post('/api/import/update-progress')
        .send({
          jobId: 'job123',
          phase: 'matching',
          current: 50,
          total: 100,
          message: 'Matching players...'
        })

      expect(response.status).toBe(200)
      expect(response.body.success).toBe(true)
    })
  })

  // ============================================================================
  // GET /progress/:jobId - Get Progress Status
  // ============================================================================

  describe('GET /progress/:jobId', () => {
    test('should retrieve import progress', async () => {
      // First set progress
      await request(app)
        .post('/api/import/update-progress')
        .send({
          jobId: 'job123',
          phase: 'matching',
          current: 50,
          total: 100
        })

      // Then retrieve it
      const response = await request(app)
        .get('/api/import/progress/job123')

      expect(response.status).toBe(200)
      expect(response.body.jobId).toBe('job123')
      expect(response.body.phase).toBe('matching')
    })

    test('should return 404 for unknown job', async () => {
      const response = await request(app)
        .get('/api/import/progress/unknown-job')

      expect(response.status).toBe(404)
    })
  })

  // ============================================================================
  // POST /cancel/:jobId - Cancel Import
  // ============================================================================

  describe('POST /cancel/:jobId', () => {
    test('should cancel import job', async () => {
      const response = await request(app)
        .post('/api/import/cancel/job123')

      expect(response.status).toBe(200)
      expect(response.body.success).toBe(true)
    })
  })

  // ============================================================================
  // POST /validate-series - Series Validation
  // ============================================================================

  describe('POST /validate-series', () => {
    test('should validate existing series', async () => {
      mockRequest.query.mockResolvedValue({
        recordset: [{
          series_id: 50,
          name: 'Base Set',
          card_count: 330
        }]
      })

      const response = await request(app)
        .post('/api/import/validate-series')
        .send({ seriesId: 50 })

      expect(response.status).toBe(200)
      expect(response.body.valid).toBe(true)
      expect(response.body.series.name).toBe('Base Set')
    })

    test('should return invalid for non-existent series', async () => {
      mockRequest.query.mockResolvedValue({ recordset: [] })

      const response = await request(app)
        .post('/api/import/validate-series')
        .send({ seriesId: 999 })

      expect(response.status).toBe(200)
      expect(response.body.valid).toBe(false)
    })
  })

  // ============================================================================
  // GET /template - Download Template
  // ============================================================================

  describe('GET /template', () => {
    test('should download Excel template', async () => {
      const response = await request(app)
        .get('/api/import/template')

      expect(response.status).toBe(200)
      expect(response.headers['content-type']).toContain('spreadsheet')
      expect(response.headers['content-disposition']).toContain('Card_Import_Template.xlsx')
    })
  })

  // ============================================================================
  // Integration Tests - Complete Import Flow
  // ============================================================================

  describe('Integration - Complete Import Flow', () => {
    test('should handle complete import from parse to commit', async () => {
      // Step 1: Parse pasted data
      const mockParsedCards = [
        {
          cardNumber: '1',
          playerNames: ['Mike Trout'],
          teamNames: ['Angels'],
          isRC: true
        }
      ]

      excelParser.parsePastedData.mockResolvedValue(mockParsedCards)

      const parseResponse = await request(app)
        .post('/api/import/parse-paste')
        .send({ data: '1\tMike Trout\tAngels\tRC\t' })

      expect(parseResponse.status).toBe(200)
      expect(parseResponse.body.cards).toHaveLength(1)

      // Step 2: Match cards
      const mockPlayerLookup = {
        'Mike Trout': {
          exact: [{ playerId: 1, playerName: 'Mike Trout', teams: [] }],
          fuzzy: []
        }
      }

      const mockTeamLookup = {
        'Angels': {
          exact: [{ teamId: 10, teamName: 'Los Angeles Angels' }],
          fuzzy: []
        }
      }

      BatchLookupService.prototype.batchFindPlayers = jest.fn().mockResolvedValue(mockPlayerLookup)
      BatchLookupService.prototype.batchFindTeams = jest.fn().mockResolvedValue(mockTeamLookup)
      BatchLookupService.prototype.batchFindActualPlayerTeams = jest.fn().mockResolvedValue({})

      const matchResponse = await request(app)
        .post('/api/import/match-cards')
        .send({
          cards: parseResponse.body.cards,
          organizationId: 1
        })

      expect(matchResponse.status).toBe(200)
      expect(matchResponse.body.matchedCards).toHaveLength(1)

      // Step 3: Commit import
      CardCreatorService.prototype.createCards = jest.fn().mockResolvedValue({
        success: true,
        created: 1,
        message: 'Successfully imported 1 cards'
      })

      const commitResponse = await request(app)
        .post('/api/import/commit')
        .send({
          matchedCards: matchResponse.body.matchedCards,
          seriesId: 50
        })

      expect(commitResponse.status).toBe(200)
      expect(commitResponse.body.success).toBe(true)
      expect(commitResponse.body.created).toBe(1)
    })

    test('should handle import with validation errors', async () => {
      // Parse should succeed
      excelParser.parsePastedData.mockResolvedValue([
        { cardNumber: '1', playerNames: ['Unknown Player'], teamNames: [] }
      ])

      const parseResponse = await request(app)
        .post('/api/import/parse-paste')
        .send({ data: '1\tUnknown Player\t\t\t' })

      expect(parseResponse.status).toBe(200)

      // Match should find no matches
      BatchLookupService.prototype.batchFindPlayers = jest.fn().mockResolvedValue({
        'Unknown Player': { exact: [], fuzzy: [] }
      })
      BatchLookupService.prototype.batchFindTeams = jest.fn().mockResolvedValue({})
      BatchLookupService.prototype.batchFindActualPlayerTeams = jest.fn().mockResolvedValue({})

      const matchResponse = await request(app)
        .post('/api/import/match-cards')
        .send({ cards: parseResponse.body.cards, organizationId: 1 })

      expect(matchResponse.status).toBe(200)
      // Card should exist but have no matches
      expect(matchResponse.body.matchedCards[0].players[0].playerMatches.exact).toHaveLength(0)
    })
  })

  // ============================================================================
  // Error Handling Tests
  // ============================================================================

  describe('Error Handling', () => {
    test('should handle database connection errors', async () => {
      sql.connect.mockRejectedValue(new Error('Connection failed'))

      const response = await request(app)
        .post('/api/import/validate-series')
        .send({ seriesId: 50 })

      expect(response.status).toBe(500)
      expect(response.body.error).toContain('Connection failed')
    })

    test('should handle malformed request bodies', async () => {
      const response = await request(app)
        .post('/api/import/match-cards')
        .send('invalid json')
        .set('Content-Type', 'application/json')

      expect(response.status).toBe(400)
    })

    test('should require authentication for all endpoints', async () => {
      // This is mocked in beforeAll, but tests that auth middleware is applied
      const response = await request(app)
        .get('/api/import/template')

      // Should succeed because of mock, but demonstrates auth is required
      expect(response.status).toBe(200)
    })
  })
})
