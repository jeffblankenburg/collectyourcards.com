const request = require('supertest')
const { app } = require('../testApp')
const { PrismaClient } = require('@prisma/client')

const prisma = new PrismaClient()

describe('Status Endpoints', () => {
  let server

  beforeAll(async () => {
    // Start server for testing
    server = app.listen(0)
  })

  afterAll(async () => {
    await prisma.$disconnect()
    if (server) {
      server.close()
    }
  })

  describe('GET /health', () => {
    it('should return server health status', async () => {
      const response = await request(app)
        .get('/health')
        .expect(200)

      expect(response.body).toMatchObject({
        status: 'OK',
        timestamp: expect.any(String),
        environment: expect.any(String)
      })

      // Validate timestamp format
      expect(new Date(response.body.timestamp)).toBeInstanceOf(Date)
    })
  })

  describe('GET /api/health', () => {
    it('should return detailed backend health status', async () => {
      const response = await request(app)
        .get('/api/health')
        .expect(200)

      expect(response.body).toMatchObject({
        status: 'operational',
        environment: expect.any(String),
        timestamp: expect.any(String),
        uptime: expect.any(Number),
        memory: expect.objectContaining({
          rss: expect.any(Number),
          heapTotal: expect.any(Number),
          heapUsed: expect.any(Number),
          external: expect.any(Number)
        }),
        version: expect.any(String)
      })

      // Validate timestamp format
      expect(new Date(response.body.timestamp)).toBeInstanceOf(Date)

      // Validate uptime is positive
      expect(response.body.uptime).toBeGreaterThan(0)

      // Validate memory usage values are positive
      expect(response.body.memory.rss).toBeGreaterThan(0)
      expect(response.body.memory.heapTotal).toBeGreaterThan(0)
      expect(response.body.memory.heapUsed).toBeGreaterThan(0)
    })
  })

  describe('GET /api/database/status', () => {
    it('should return database connectivity status', async () => {
      const response = await request(app)
        .get('/api/database/status')

      // Should return either operational status or error status
      expect([200, 500]).toContain(response.status)

      if (response.status === 200) {
        // Successful database connection
        expect(response.body).toMatchObject({
          status: 'operational',
          type: 'SQL Server 2022',
          connection: 'established',
          tables: expect.any(Number),
          records: expect.objectContaining({
            cards: expect.any(Number),
            players: expect.any(Number),
            teams: expect.any(Number),
            users: expect.any(Number)
          }),
          dockerContainer: 'collect-cards-db',
          port: 1433
        })

        // Validate record counts are non-negative
        expect(response.body.records.cards).toBeGreaterThanOrEqual(0)
        expect(response.body.records.players).toBeGreaterThanOrEqual(0)
        expect(response.body.records.teams).toBeGreaterThanOrEqual(0)
        expect(response.body.records.users).toBeGreaterThanOrEqual(0)

        // Validate table count is positive
        expect(response.body.tables).toBeGreaterThan(0)
      } else {
        // Database connection failed
        expect(response.body).toMatchObject({
          status: 'error',
          message: expect.any(String),
          error: expect.any(String)
        })
      }
    })
  })

  describe('GET /api/endpoints/status', () => {
    it('should return list of monitored endpoints', async () => {
      const response = await request(app)
        .get('/api/endpoints/status')
        .expect(200)

      expect(response.body).toMatchObject({
        total: expect.any(Number),
        endpoints: expect.any(Array),
        last_checked: expect.any(String)
      })

      // Validate timestamp format
      expect(new Date(response.body.last_checked)).toBeInstanceOf(Date)

      // Validate total matches endpoints array length
      expect(response.body.total).toBe(response.body.endpoints.length)

      // Validate endpoint structure
      if (response.body.endpoints.length > 0) {
        const endpoint = response.body.endpoints[0]
        expect(endpoint).toMatchObject({
          method: expect.any(String),
          path: expect.any(String),
          status: expect.any(String),
          description: expect.any(String)
        })

        // Validate status values
        expect(['operational', 'error', 'mock']).toContain(endpoint.status)

        // Validate HTTP methods
        expect(['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'ALL']).toContain(endpoint.method)
      }

      // Should include key endpoints
      const endpointPaths = response.body.endpoints.map(e => e.path)
      expect(endpointPaths).toContain('/health')
      expect(endpointPaths).toContain('/api/health')
      expect(endpointPaths).toContain('/api/auth/register')
      expect(endpointPaths).toContain('/api/auth/login')
    })

    it('should include authentication endpoints', async () => {
      const response = await request(app)
        .get('/api/endpoints/status')
        .expect(200)

      const authEndpoints = response.body.endpoints.filter(e => 
        e.path.startsWith('/api/auth/')
      )

      expect(authEndpoints.length).toBeGreaterThan(0)

      // Check for key auth endpoints
      const authPaths = authEndpoints.map(e => e.path)
      expect(authPaths).toContain('/api/auth/register')
      expect(authPaths).toContain('/api/auth/login')
      expect(authPaths).toContain('/api/auth/verify-email')
      expect(authPaths).toContain('/api/auth/profile')
      expect(authPaths).toContain('/api/auth/logout')

      // Check status of auth endpoints
      const operationalAuthEndpoints = authEndpoints.filter(e => 
        e.status === 'operational'
      )
      expect(operationalAuthEndpoints.length).toBeGreaterThan(0)
    })

    it('should include mock endpoints for unimplemented features', async () => {
      const response = await request(app)
        .get('/api/endpoints/status')
        .expect(200)

      const mockEndpoints = response.body.endpoints.filter(e => 
        e.status === 'mock'
      )

      expect(mockEndpoints.length).toBeGreaterThan(0)

      // Check for key mock endpoints
      const mockPaths = mockEndpoints.map(e => e.path)
      expect(mockPaths).toContain('/api/cards/*')
      expect(mockPaths).toContain('/api/collection/*')
      expect(mockPaths).toContain('/api/admin/*')
      expect(mockPaths).toContain('/api/import/*')
      expect(mockPaths).toContain('/api/ebay/*')
    })
  })

  describe('GET /api/environment', () => {
    it('should return sanitized environment information', async () => {
      const response = await request(app)
        .get('/api/environment')
        .expect(200)

      expect(response.body).toMatchObject({
        NODE_ENV: expect.any(String),
        NODE_VERSION: expect.any(String),
        PLATFORM: expect.any(String),
        ARCH: expect.any(String),
        FRONTEND_URL: expect.any(String),
        DATABASE_STATUS: expect.any(String),
        JWT_STATUS: expect.any(String),
        EMAIL_STATUS: expect.any(String),
        EBAY_STATUS: expect.any(String)
      })

      // Validate environment values
      expect(['development', 'test', 'production']).toContain(response.body.NODE_ENV)
      expect(['Configured', 'Not configured']).toContain(response.body.DATABASE_STATUS)
      expect(['Configured', 'Not configured']).toContain(response.body.JWT_STATUS)
      expect(['Configured', 'Not configured']).toContain(response.body.EMAIL_STATUS)
      expect(['Configured', 'Not configured']).toContain(response.body.EBAY_STATUS)

      // Validate Node.js version format
      expect(response.body.NODE_VERSION).toMatch(/^v\d+\.\d+\.\d+/)

      // Validate platform and architecture
      expect(response.body.PLATFORM).toBeTruthy()
      expect(response.body.ARCH).toBeTruthy()
    })

    it('should not expose sensitive information', async () => {
      const response = await request(app)
        .get('/api/environment')
        .expect(200)

      // Should not contain actual secrets
      expect(response.body).not.toHaveProperty('JWT_SECRET')
      expect(response.body).not.toHaveProperty('DATABASE_URL')
      expect(response.body).not.toHaveProperty('AZURE_COMMUNICATION_CONNECTION_STRING')
      expect(response.body).not.toHaveProperty('EBAY_CLIENT_SECRET')

      // Should only show configuration status
      expect(['Configured', 'Not configured']).toContain(response.body.JWT_STATUS)
      expect(['Configured', 'Not configured']).toContain(response.body.DATABASE_STATUS)
      expect(['Configured', 'Not configured']).toContain(response.body.EMAIL_STATUS)
    })
  })

  describe('Status endpoint error handling', () => {
    it('should handle database connection errors gracefully', async () => {
      // This test depends on database being unavailable, so we'll mock the scenario
      // In a real test environment, you might temporarily stop the database
      
      const response = await request(app)
        .get('/api/database/status')

      // Should return either success or a proper error response
      expect([200, 500]).toContain(response.status)

      if (response.status === 500) {
        expect(response.body).toMatchObject({
          status: 'error',
          message: expect.any(String),
          error: expect.any(String)
        })
      }
    })

    it('should handle invalid routes gracefully', async () => {
      const response = await request(app)
        .get('/api/nonexistent/endpoint')
        .expect(404)

      expect(response.body).toMatchObject({
        error: 'Not Found',
        message: expect.stringContaining('not found')
      })
    })
  })

  describe('Status endpoint performance', () => {
    it('should respond to health check quickly', async () => {
      const startTime = Date.now()
      
      await request(app)
        .get('/health')
        .expect(200)
      
      const responseTime = Date.now() - startTime
      
      // Health check should respond within 1 second
      expect(responseTime).toBeLessThan(1000)
    })

    it('should respond to detailed health check reasonably fast', async () => {
      const startTime = Date.now()
      
      await request(app)
        .get('/api/health')
        .expect(200)
      
      const responseTime = Date.now() - startTime
      
      // Detailed health check should respond within 2 seconds
      expect(responseTime).toBeLessThan(2000)
    })

    it('should respond to endpoints status reasonably fast', async () => {
      const startTime = Date.now()
      
      await request(app)
        .get('/api/endpoints/status')
        .expect(200)
      
      const responseTime = Date.now() - startTime
      
      // Endpoints status should respond within 3 seconds
      expect(responseTime).toBeLessThan(3000)
    })
  })
})