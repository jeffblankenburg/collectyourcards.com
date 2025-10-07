const request = require('supertest')
const { app } = require('../testApp')
const { PrismaClient } = require('@prisma/client')

const prisma = new PrismaClient()

describe('Search API Integration Tests', () => {
  let server
  let testPlayer
  let testTeam
  let testSeries
  let testSet

  beforeAll(async () => {
    server = app.listen(0)

    // Get test data for search
    const players = await prisma.$queryRaw`
      SELECT TOP 1 player_id, first_name, last_name
      FROM player
      WHERE first_name IS NOT NULL AND last_name IS NOT NULL
      ORDER BY NEWID()
    `

    if (players.length > 0) {
      testPlayer = {
        player_id: Number(players[0].player_id),
        first_name: players[0].first_name,
        last_name: players[0].last_name,
        full_name: `${players[0].first_name} ${players[0].last_name}`
      }
    }

    const teams = await prisma.$queryRaw`
      SELECT TOP 1 team_Id, name, abbreviation
      FROM team
      WHERE name IS NOT NULL
      ORDER BY NEWID()
    `

    if (teams.length > 0) {
      testTeam = {
        team_id: Number(teams[0].team_Id),
        name: teams[0].name,
        abbreviation: teams[0].abbreviation
      }
    }

    const series = await prisma.$queryRaw`
      SELECT TOP 1 s.series_id, s.name, set_info.name as set_name
      FROM series s
      JOIN [set] set_info ON s.[set] = set_info.set_id
      WHERE s.name IS NOT NULL
      ORDER BY NEWID()
    `

    if (series.length > 0) {
      testSeries = {
        series_id: Number(series[0].series_id),
        name: series[0].name,
        set_name: series[0].set_name
      }
    }

    const sets = await prisma.$queryRaw`
      SELECT TOP 1 set_id, name, year
      FROM [set]
      WHERE name IS NOT NULL
      ORDER BY NEWID()
    `

    if (sets.length > 0) {
      testSet = {
        set_id: Number(sets[0].set_id),
        name: sets[0].name,
        year: sets[0].year
      }
    }
  })

  afterAll(async () => {
    await prisma.$disconnect()
    if (server) {
      server.close()
    }
  })

  describe('GET /api/search/universal - Universal search', () => {
    it('should perform universal search', async () => {
      const response = await request(app)
        .get('/api/search/universal?q=baseball')
        .expect(200)

      expect(response.body.results).toBeDefined()
      expect(Array.isArray(response.body.results)).toBe(true)
      expect(response.body.query).toBe('baseball')
    })

    it('should search for players by name', async () => {
      if (!testPlayer) {
        console.log('Skipping - no test player available')
        return
      }

      const response = await request(app)
        .get(`/api/search/universal?q=${testPlayer.last_name}`)
        .expect(200)

      expect(response.body.results).toBeDefined()
      expect(response.body.results.length).toBeGreaterThan(0)

      // Should contain results related to player
      const playerResults = response.body.results.filter(r => r.type === 'player')
      expect(playerResults.length).toBeGreaterThan(0)
    })

    it('should search for teams', async () => {
      if (!testTeam) {
        console.log('Skipping - no test team available')
        return
      }

      const response = await request(app)
        .get(`/api/search/universal?q=${testTeam.name}`)
        .expect(200)

      expect(response.body.results).toBeDefined()

      // Should contain team results (if any)
      const teamResults = response.body.results.filter(r => r.type === 'team')
      if (teamResults.length > 0 && teamResults[0].name) {
        expect(teamResults[0].name).toContain(testTeam.name)
      }
    })

    it('should search for series', async () => {
      if (!testSeries) {
        console.log('Skipping - no test series available')
        return
      }

      const response = await request(app)
        .get(`/api/search/universal?q=${encodeURIComponent(testSeries.name)}`)
        .expect(200)

      expect(response.body.results).toBeDefined()
    })

    it('should filter by category - players only', async () => {
      const response = await request(app)
        .get('/api/search/universal?q=baseball&category=players')
        .expect(200)

      expect(response.body.results).toBeDefined()

      // All results should be players
      if (response.body.results.length > 0) {
        const nonPlayerResults = response.body.results.filter(r => r.type !== 'player')
        expect(nonPlayerResults.length).toBe(0)
      }
    })

    it('should filter by category - teams only', async () => {
      const response = await request(app)
        .get('/api/search/universal?q=baseball&category=teams')
        .expect(200)

      expect(response.body.results).toBeDefined()

      // All results should be teams
      if (response.body.results.length > 0) {
        const nonTeamResults = response.body.results.filter(r => r.type !== 'team')
        expect(nonTeamResults.length).toBe(0)
      }
    })

    it('should filter by category - series only', async () => {
      const response = await request(app)
        .get('/api/search/universal?q=topps&category=series')
        .expect(200)

      expect(response.body.results).toBeDefined()

      // All results should be series
      if (response.body.results.length > 0) {
        const nonSeriesResults = response.body.results.filter(r => r.type !== 'series')
        expect(nonSeriesResults.length).toBe(0)
      }
    })

    it('should filter by category - cards only', async () => {
      const response = await request(app)
        .get('/api/search/universal?q=rookie&category=cards')
        .expect(200)

      expect(response.body.results).toBeDefined()

      // All results should be cards
      if (response.body.results.length > 0) {
        const nonCardResults = response.body.results.filter(r => r.type !== 'card')
        expect(nonCardResults.length).toBe(0)
      }
    })

    it('should respect limit parameter', async () => {
      const response = await request(app)
        .get('/api/search/universal?q=baseball&limit=5')
        .expect(200)

      expect(response.body.results).toBeDefined()
      expect(response.body.results.length).toBeLessThanOrEqual(5)
    })

    it('should handle empty query gracefully', async () => {
      const response = await request(app)
        .get('/api/search/universal?q=')
        .expect(200)

      expect(response.body.results).toEqual([])
    })

    it('should handle short query (< 2 chars)', async () => {
      const response = await request(app)
        .get('/api/search/universal?q=a')
        .expect(200)

      expect(response.body.results).toEqual([])
    })

    it('should handle query with no results', async () => {
      const response = await request(app)
        .get('/api/search/universal?q=xyznonexistentquery999')
        .expect(200)

      expect(response.body.results).toBeDefined()
      expect(Array.isArray(response.body.results)).toBe(true)
    })

    it('should serialize BigInt values correctly', async () => {
      const response = await request(app)
        .get('/api/search/universal?q=baseball')
        .expect(200)

      if (response.body.results.length > 0) {
        // All numeric IDs should be numbers or strings (some APIs return string IDs)
        response.body.results.forEach(result => {
          if (result.id) {
            expect(['number', 'string']).toContain(typeof result.id)
          }
        })

        const jsonString = JSON.stringify(response.body)
        expect(jsonString).not.toContain('BigInt')
      }
    })

    it('should handle special characters in query', async () => {
      const response = await request(app)
        .get('/api/search/universal?q=o\'brien')
        .expect(200)

      expect(response.body.results).toBeDefined()
      expect(Array.isArray(response.body.results)).toBe(true)
    })

    it('should search by card number pattern', async () => {
      const response = await request(app)
        .get('/api/search/universal?q=1')
        .expect(200)

      expect(response.body.results).toBeDefined()
      expect(Array.isArray(response.body.results)).toBe(true)
    })

    it('should search for rookie cards', async () => {
      const response = await request(app)
        .get('/api/search/universal?q=rookie')
        .expect(200)

      expect(response.body.results).toBeDefined()
      expect(Array.isArray(response.body.results)).toBe(true)
    })

    it('should search for autograph cards', async () => {
      const response = await request(app)
        .get('/api/search/universal?q=autograph')
        .expect(200)

      expect(response.body.results).toBeDefined()
      expect(Array.isArray(response.body.results)).toBe(true)
    })

    it('should return totalResults count', async () => {
      const response = await request(app)
        .get('/api/search/universal?q=baseball')
        .expect(200)

      expect(response.body.totalResults).toBeDefined()
      expect(typeof response.body.totalResults).toBe('number')
      expect(response.body.totalResults).toBe(response.body.results.length)
    })

    it('should include searchTime in response', async () => {
      const response = await request(app)
        .get('/api/search/universal?q=baseball')
        .expect(200)

      expect(response.body.searchTime).toBeDefined()
      expect(typeof response.body.searchTime).toBe('number')
    })

    it('should handle concurrent search requests', async () => {
      const promises = Array(3).fill().map(() =>
        request(app).get('/api/search/universal?q=baseball')
      )

      const responses = await Promise.all(promises)

      responses.forEach(response => {
        expect(response.status).toBe(200)
        expect(response.body.results).toBeDefined()
      })
    })
  })

  describe('GET /api/search/health - Health check', () => {
    it('should return health status', async () => {
      const response = await request(app)
        .get('/api/search/health')
        .expect(200)

      expect(response.body.status).toBe('OK')
      expect(response.body.route).toBe('search')
      expect(response.body.databaseAvailable).toBeDefined()
    })
  })

  describe('Search Result Relevance', () => {
    it('should rank exact matches higher', async () => {
      if (!testPlayer) {
        console.log('Skipping - no test player available')
        return
      }

      const response = await request(app)
        .get(`/api/search/universal?q=${encodeURIComponent(testPlayer.full_name)}`)
        .expect(200)

      if (response.body.results.length > 0) {
        // First result should be most relevant
        expect(response.body.results[0].type).toBeDefined()
      }
    })

    it('should handle partial name matches', async () => {
      if (!testPlayer) {
        console.log('Skipping - no test player available')
        return
      }

      const response = await request(app)
        .get(`/api/search/universal?q=${testPlayer.last_name}`)
        .expect(200)

      expect(response.body.results).toBeDefined()
      expect(Array.isArray(response.body.results)).toBe(true)
    })
  })

  describe('Error Handling', () => {
    it('should handle malformed queries gracefully', async () => {
      const response = await request(app)
        .get('/api/search/universal?q=%')
        .expect(200)

      expect(response.body.results).toBeDefined()
      expect(Array.isArray(response.body.results)).toBe(true)
    })

    it('should handle invalid category gracefully', async () => {
      const response = await request(app)
        .get('/api/search/universal?q=test&category=invalid')
        .expect(200)

      expect(response.body.results).toBeDefined()
    })

    it('should handle invalid limit gracefully', async () => {
      const response = await request(app)
        .get('/api/search/universal?q=test&limit=abc')
        .expect(200)

      expect(response.body.results).toBeDefined()
    })

    it('should handle very large limit', async () => {
      const response = await request(app)
        .get('/api/search/universal?q=test&limit=10000')
        .expect(200)

      expect(response.body.results).toBeDefined()
      expect(response.body.results.length).toBeLessThanOrEqual(10000)
    })
  })
})
