const request = require('supertest')
const { app } = require('../testApp')
const { PrismaClient } = require('@prisma/client')
const bcrypt = require('bcryptjs')

const prisma = new PrismaClient()

describe('User Locations API Integration Tests', () => {
  let server
  let testUser
  let userToken
  let testCard

  beforeAll(async () => {
    server = app.listen(0)

    // Create test user
    const timestamp = Date.now()
    const hashedPassword = await bcrypt.hash('TestPass123!', 12)
    testUser = await prisma.user.create({
      data: {
        email: `locations-test-${timestamp}@test.com`,
        username: `locationstestuser${timestamp}`,
        password_hash: hashedPassword,
        first_name: 'Locations',
        last_name: 'Tester',
        role: 'user',
        is_verified: true,
        is_active: true
      }
    })

    // Login to get token
    const loginResponse = await request(app)
      .post('/api/auth/login')
      .send({
        email: `locations-test-${timestamp}@test.com`,
        password: 'TestPass123!'
      })
      .expect(200)

    userToken = loginResponse.body.token

    // Get a test card for location tests
    const cards = await prisma.$queryRaw`
      SELECT TOP 1 card_id FROM card ORDER BY NEWID()
    `
    if (cards.length > 0) {
      testCard = Number(cards[0].card_id)
    }
  })

  afterAll(async () => {
    // Cleanup user cards
    await prisma.$executeRaw`DELETE FROM user_card WHERE [user] = ${testUser.user_id}`

    // Cleanup locations
    await prisma.$executeRaw`DELETE FROM user_location WHERE [user] = ${testUser.user_id}`

    // Cleanup user
    await prisma.user.delete({ where: { user_id: testUser.user_id } })

    await prisma.$disconnect()
    if (server) {
      server.close()
    }
  })

  afterEach(async () => {
    // Clean up locations after each test
    await prisma.$executeRaw`DELETE FROM user_card WHERE [user] = ${testUser.user_id}`
    await prisma.$executeRaw`DELETE FROM user_location WHERE [user] = ${testUser.user_id}`
  })

  describe('GET /api/user/locations - Get user locations', () => {
    beforeEach(async () => {
      // Create test locations
      await prisma.$executeRaw`
        INSERT INTO user_location ([user], location, card_count, is_dashboard)
        VALUES
          (${testUser.user_id}, 'Collection Box 1', 0, 1),
          (${testUser.user_id}, 'Storage Unit', 0, 0),
          (${testUser.user_id}, 'Display Case', 0, 1)
      `
    })

    it('should fetch user locations', async () => {
      const response = await request(app)
        .get('/api/user/locations')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200)

      expect(response.body.locations).toBeDefined()
      expect(Array.isArray(response.body.locations)).toBe(true)
      expect(response.body.locations.length).toBeGreaterThanOrEqual(3)

      // Verify the expected locations exist
      const locationNames = response.body.locations.map(l => l.location)
      expect(locationNames).toContain('Collection Box 1')
      expect(locationNames).toContain('Storage Unit')
      expect(locationNames).toContain('Display Case')
    })

    it('should include location details', async () => {
      const response = await request(app)
        .get('/api/user/locations')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200)

      const location = response.body.locations[0]
      expect(location).toHaveProperty('user_location_id')
      expect(location).toHaveProperty('location')
      expect(location).toHaveProperty('card_count')
      expect(location).toHaveProperty('is_dashboard')
    })

    it('should show correct card counts', async () => {
      if (!testCard) {
        console.log('Skipping - no test card available')
        return
      }

      // Get a location ID
      const locations = await prisma.$queryRaw`
        SELECT user_location_id FROM user_location WHERE [user] = ${testUser.user_id}
      `
      const locationId = Number(locations[0].user_location_id)

      // Add cards to location
      await prisma.$executeRaw`
        INSERT INTO user_card ([user], card, user_location, random_code, created)
        VALUES
          (${testUser.user_id}, ${testCard}, ${locationId}, 'LOC1', GETDATE()),
          (${testUser.user_id}, ${testCard}, ${locationId}, 'LOC2', GETDATE())
      `

      const response = await request(app)
        .get('/api/user/locations')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200)

      const locationWithCards = response.body.locations.find(
        l => l.user_location_id === locationId
      )
      expect(locationWithCards.card_count).toBe(2)
    })

    it('should require authentication', async () => {
      const response = await request(app)
        .get('/api/user/locations')
        .expect(401)

      expect(response.body.error).toBe('Access denied')
    })

    it('should serialize BigInt values correctly', async () => {
      const response = await request(app)
        .get('/api/user/locations')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200)

      const location = response.body.locations[0]
      expect(typeof location.user_location_id).toBe('number')
      expect(typeof location.card_count).toBe('number')

      const jsonString = JSON.stringify(response.body)
      expect(jsonString).not.toContain('BigInt')
    })

    it('should return empty array when user has no locations', async () => {
      // Clean up all locations first
      await prisma.$executeRaw`DELETE FROM user_location WHERE [user] = ${testUser.user_id}`

      const response = await request(app)
        .get('/api/user/locations')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200)

      expect(response.body.locations).toEqual([])
    })
  })

  describe('POST /api/user/locations - Create location', () => {
    it('should create a new location', async () => {
      const response = await request(app)
        .post('/api/user/locations')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ location: 'New Collection Box', is_dashboard: true })
        .expect(201)

      expect(response.body.message).toBeDefined()
      expect(response.body.location).toBeDefined()
      expect(response.body.location.location).toBe('New Collection Box')
      expect(response.body.location.is_dashboard).toBe(true)
      expect(response.body.location.card_count).toBe(0)
    })

    it('should require authentication', async () => {
      const response = await request(app)
        .post('/api/user/locations')
        .send({ location: 'Test Location' })
        .expect(401)

      expect(response.body.error).toBe('Access denied')
    })

    it('should require location name', async () => {
      const response = await request(app)
        .post('/api/user/locations')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ location: '' })
        .expect(400)

      expect(response.body.error).toBe('Validation error')
      expect(response.body.message).toContain('Location name')
    })

    it('should trim whitespace from location name', async () => {
      const response = await request(app)
        .post('/api/user/locations')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ location: '  Trimmed Location  ' })
        .expect(201)

      expect(response.body.location.location).toBe('Trimmed Location')
    })

    it('should default is_dashboard to true if not specified', async () => {
      const response = await request(app)
        .post('/api/user/locations')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ location: 'Default Dashboard Location' })
        .expect(201)

      expect(response.body.location.is_dashboard).toBe(true)
    })

    it('should serialize BigInt values correctly', async () => {
      const response = await request(app)
        .post('/api/user/locations')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ location: 'Test Location' })
        .expect(201)

      expect(typeof response.body.location.user_location_id).toBe('number')

      const jsonString = JSON.stringify(response.body)
      expect(jsonString).not.toContain('BigInt')
    })
  })

  describe('PUT /api/user/locations/:locationId - Update location', () => {
    let locationId

    beforeEach(async () => {
      // Create location to update using OUTPUT to get the exact inserted row
      const inserted = await prisma.$queryRaw`
        INSERT INTO user_location ([user], location, card_count, is_dashboard)
        OUTPUT INSERTED.user_location_id
        VALUES (${testUser.user_id}, 'Original Location', 0, 1)
      `
      locationId = Number(inserted[0].user_location_id)
    })

    it('should update location', async () => {
      const response = await request(app)
        .put(`/api/user/locations/${locationId}`)
        .set('Authorization', `Bearer ${userToken}`)
        .send({ location: 'Updated Location', is_dashboard: false })
        .expect(200)

      expect(response.body.message).toBe('Location updated successfully')

      // Verify update
      const updated = await prisma.$queryRaw`
        SELECT location, is_dashboard
        FROM user_location
        WHERE user_location_id = ${locationId}
      `
      expect(updated[0].location).toBe('Updated Location')
      expect(updated[0].is_dashboard).toBe(false)
    })

    it('should require authentication', async () => {
      const response = await request(app)
        .put(`/api/user/locations/${locationId}`)
        .send({ location: 'Updated' })
        .expect(401)

      expect(response.body.error).toBe('Access denied')
    })

    it('should require location name', async () => {
      const response = await request(app)
        .put(`/api/user/locations/${locationId}`)
        .set('Authorization', `Bearer ${userToken}`)
        .send({ location: '' })
        .expect(400)

      expect(response.body.error).toBe('Validation error')
    })

    it('should trim whitespace from location name', async () => {
      await request(app)
        .put(`/api/user/locations/${locationId}`)
        .set('Authorization', `Bearer ${userToken}`)
        .send({ location: '  Trimmed Update  ', is_dashboard: true })
        .expect(200)

      const updated = await prisma.$queryRaw`
        SELECT location FROM user_location WHERE user_location_id = ${locationId}
      `
      expect(updated[0].location).toBe('Trimmed Update')
    })

    it('should not update other users locations', async () => {
      // Create another user
      const timestamp = Date.now()
      const hashedPassword = await bcrypt.hash('TestPass123!', 12)
      const otherUser = await prisma.user.create({
        data: {
          email: `other-location-${timestamp}@test.com`,
          username: `otherlocationuser${timestamp}`,
          password_hash: hashedPassword,
          role: 'user',
          is_verified: true,
          is_active: true
        }
      })

      // Create location for other user using OUTPUT to get exact inserted row
      const otherLocations = await prisma.$queryRaw`
        INSERT INTO user_location ([user], location, card_count, is_dashboard)
        OUTPUT INSERTED.user_location_id, INSERTED.[user], INSERTED.location
        VALUES (${otherUser.user_id}, 'Other User Location', 0, 1)
      `
      const otherLocationId = Number(otherLocations[0].user_location_id)

      // Verify it belongs to otherUser before attempting update
      expect(Number(otherLocations[0].user)).toBe(Number(otherUser.user_id))
      expect(otherLocations[0].location).toBe('Other User Location')

      // Try to update with our user's token
      await request(app)
        .put(`/api/user/locations/${otherLocationId}`)
        .set('Authorization', `Bearer ${userToken}`)
        .send({ location: 'Hacked!', is_dashboard: false })
        .expect(200) // Succeeds but doesn't actually update

      // Verify it wasn't updated
      const check = await prisma.$queryRaw`
        SELECT location, [user] FROM user_location WHERE user_location_id = ${otherLocationId}
      `
      expect(Number(check[0].user)).toBe(Number(otherUser.user_id))
      expect(check[0].location).toBe('Other User Location')

      // Cleanup
      await prisma.$executeRaw`DELETE FROM user_location WHERE [user] = ${otherUser.user_id}`
      await prisma.user.delete({ where: { user_id: otherUser.user_id } })
    })
  })

  describe('DELETE /api/user/locations/:locationId - Delete location', () => {
    let emptyLocationId
    let locationWithCardsId

    beforeEach(async () => {
      // Create empty location
      await prisma.$executeRaw`
        INSERT INTO user_location ([user], location, card_count, is_dashboard)
        VALUES (${testUser.user_id}, 'Empty Location', 0, 1)
      `

      const locations = await prisma.$queryRaw`
        SELECT user_location_id FROM user_location WHERE location = 'Empty Location'
      `
      emptyLocationId = Number(locations[0].user_location_id)

      if (testCard) {
        // Create location with cards
        await prisma.$executeRaw`
          INSERT INTO user_location ([user], location, card_count, is_dashboard)
          VALUES (${testUser.user_id}, 'Location With Cards', 0, 1)
        `

        const locWithCards = await prisma.$queryRaw`
          SELECT user_location_id FROM user_location WHERE location = 'Location With Cards'
        `
        locationWithCardsId = Number(locWithCards[0].user_location_id)

        // Add cards to location
        await prisma.$executeRaw`
          INSERT INTO user_card ([user], card, user_location, random_code, created)
          VALUES (${testUser.user_id}, ${testCard}, ${locationWithCardsId}, 'DEL1', GETDATE())
        `
      }
    })

    it('should delete empty location', async () => {
      const response = await request(app)
        .delete(`/api/user/locations/${emptyLocationId}`)
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200)

      expect(response.body.message).toBe('Location deleted successfully')

      // Verify deletion
      const deleted = await prisma.$queryRaw`
        SELECT * FROM user_location WHERE user_location_id = ${emptyLocationId}
      `
      expect(deleted.length).toBe(0)
    })

    it('should require authentication', async () => {
      const response = await request(app)
        .delete(`/api/user/locations/${emptyLocationId}`)
        .expect(401)

      expect(response.body.error).toBe('Access denied')
    })

    it('should reject deleting location with cards without reassignment', async () => {
      if (!testCard) {
        console.log('Skipping - no test card available')
        return
      }

      const response = await request(app)
        .delete(`/api/user/locations/${locationWithCardsId}`)
        .set('Authorization', `Bearer ${userToken}`)
        .expect(400)

      expect(response.body.error).toBe('Location has cards')
      expect(response.body.message).toContain('reassign_to')
    })

    it('should delete location with cards when reassignment provided', async () => {
      if (!testCard) {
        console.log('Skipping - no test card available')
        return
      }

      const response = await request(app)
        .delete(`/api/user/locations/${locationWithCardsId}`)
        .set('Authorization', `Bearer ${userToken}`)
        .send({ reassign_to: emptyLocationId })
        .expect(200)

      expect(response.body.message).toContain('reassigned')
      expect(response.body.cards_reassigned).toBe(1)

      // Verify cards were reassigned
      const reassignedCards = await prisma.$queryRaw`
        SELECT COUNT(*) as count
        FROM user_card
        WHERE user_location = ${emptyLocationId} AND [user] = ${testUser.user_id}
      `
      expect(Number(reassignedCards[0].count)).toBe(1)

      // Verify location was deleted
      const deleted = await prisma.$queryRaw`
        SELECT * FROM user_location WHERE user_location_id = ${locationWithCardsId}
      `
      expect(deleted.length).toBe(0)
    })

    it('should reject invalid reassignment target', async () => {
      if (!testCard) {
        console.log('Skipping - no test card available')
        return
      }

      const response = await request(app)
        .delete(`/api/user/locations/${locationWithCardsId}`)
        .set('Authorization', `Bearer ${userToken}`)
        .send({ reassign_to: 999999999 })
        .expect(400)

      expect(response.body.error).toBe('Invalid target location')
    })

    it('should not allow deleting other users locations', async () => {
      // Create another user
      const timestamp = Date.now()
      const hashedPassword = await bcrypt.hash('TestPass123!', 12)
      const otherUser = await prisma.user.create({
        data: {
          email: `other-delete-loc-${timestamp}@test.com`,
          username: `otherdeleteloc${timestamp}`,
          password_hash: hashedPassword,
          role: 'user',
          is_verified: true,
          is_active: true
        }
      })

      // Create location for other user
      await prisma.$executeRaw`
        INSERT INTO user_location ([user], location, card_count, is_dashboard)
        VALUES (${otherUser.user_id}, 'Other User Location', 0, 1)
      `

      const otherLocations = await prisma.$queryRaw`
        SELECT user_location_id FROM user_location WHERE [user] = ${otherUser.user_id}
      `
      const otherLocationId = Number(otherLocations[0].user_location_id)

      // Try to delete with our user's token
      await request(app)
        .delete(`/api/user/locations/${otherLocationId}`)
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200) // Returns success but doesn't actually delete

      // Verify it wasn't deleted
      const check = await prisma.$queryRaw`
        SELECT * FROM user_location WHERE user_location_id = ${otherLocationId}
      `
      expect(check.length).toBe(1)

      // Cleanup
      await prisma.$executeRaw`DELETE FROM user_location WHERE [user] = ${otherUser.user_id}`
      await prisma.user.delete({ where: { user_id: otherUser.user_id } })
    })
  })
})
