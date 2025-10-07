const request = require('supertest')
const { app } = require('../testApp')
const { PrismaClient } = require('@prisma/client')
const bcrypt = require('bcryptjs')

const prisma = new PrismaClient()

describe('User Profile API Integration Tests', () => {
  let server
  let testUser
  let userToken
  let publicUser
  let privateUser

  beforeAll(async () => {
    server = app.listen(0)

    // Create test user (main user)
    const timestamp = Date.now()
    const hashedPassword = await bcrypt.hash('TestPass123!', 12)
    testUser = await prisma.user.create({
      data: {
        email: `profile-test-${timestamp}@test.com`,
        username: `profiletestuser${timestamp}`,
        password_hash: hashedPassword,
        first_name: 'Profile',
        last_name: 'Tester',
        bio: 'Test bio',
        is_public_profile: true,
        role: 'user',
        is_verified: true,
        is_active: true
      }
    })

    // Login to get token
    const loginResponse = await request(app)
      .post('/api/auth/login')
      .send({
        email: `profile-test-${timestamp}@test.com`,
        password: 'TestPass123!'
      })
      .expect(200)

    userToken = loginResponse.body.token

    // Create public profile user
    publicUser = await prisma.user.create({
      data: {
        email: `public-user-${timestamp}@test.com`,
        username: `publicuser${timestamp}`,
        password_hash: hashedPassword,
        first_name: 'Public',
        last_name: 'User',
        bio: 'Public profile user',
        is_public_profile: true,
        role: 'user',
        is_verified: true,
        is_active: true
      }
    })

    // Create private profile user
    privateUser = await prisma.user.create({
      data: {
        email: `private-user-${timestamp}@test.com`,
        username: `privateuser${timestamp}`,
        password_hash: hashedPassword,
        first_name: 'Private',
        last_name: 'User',
        bio: 'Private profile user',
        is_public_profile: false,
        role: 'user',
        is_verified: true,
        is_active: true
      }
    })
  })

  afterAll(async () => {
    // Cleanup
    await prisma.user.delete({ where: { user_id: testUser.user_id } })
    await prisma.user.delete({ where: { user_id: publicUser.user_id } })
    await prisma.user.delete({ where: { user_id: privateUser.user_id } })

    await prisma.$disconnect()
    if (server) {
      server.close()
    }
  })

  describe('GET /api/profile - Get own profile', () => {
    it('should fetch authenticated users own profile', async () => {
      const response = await request(app)
        .get('/api/profile')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200)

      expect(response.body.profile).toBeDefined()
      expect(response.body.profile.username).toBe(testUser.username)
      expect(response.body.profile.email).toBe(testUser.email)
      expect(response.body.profile.first_name).toBe('Profile')
      expect(response.body.profile.last_name).toBe('Tester')
      expect(response.body.profile.bio).toBe('Test bio')
    })

    it('should require authentication', async () => {
      const response = await request(app)
        .get('/api/profile')
        .expect(401)

      expect(response.body.error).toBe('Access denied')
    })

    it('should serialize BigInt values correctly', async () => {
      const response = await request(app)
        .get('/api/profile')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200)

      expect(typeof response.body.profile.user_id).toBe('number')

      // Should not contain BigInt artifacts
      const jsonString = JSON.stringify(response.body)
      expect(jsonString).not.toContain('BigInt')
    })
  })

  describe('GET /api/profile/user/:username - Get public profile by username', () => {
    it('should fetch public profile by username', async () => {
      const response = await request(app)
        .get(`/api/profile/user/${publicUser.username}`)
        .expect(200)

      expect(response.body.profile).toBeDefined()
      expect(response.body.profile.username).toBe(publicUser.username)
      expect(response.body.profile.bio).toBe('Public profile user')
      expect(response.body.profile.is_public_profile).toBe(true)
    })

    it('should include collection stats for public profile', async () => {
      const response = await request(app)
        .get(`/api/profile/user/${publicUser.username}`)
        .expect(200)

      expect(response.body.stats).toBeDefined()
      expect(response.body.stats).toHaveProperty('total_cards')
      expect(response.body.stats).toHaveProperty('unique_cards')
      expect(response.body.stats).toHaveProperty('rookie_cards')
      expect(response.body.stats).toHaveProperty('autograph_cards')
      expect(response.body.stats).toHaveProperty('estimated_value')
    })

    it('should include favorite cards for public profile', async () => {
      const response = await request(app)
        .get(`/api/profile/user/${publicUser.username}`)
        .expect(200)

      expect(response.body.favoriteCards).toBeDefined()
      expect(Array.isArray(response.body.favoriteCards)).toBe(true)
    })

    it('should include recent activity for public profile', async () => {
      const response = await request(app)
        .get(`/api/profile/user/${publicUser.username}`)
        .expect(200)

      expect(response.body.recentActivity).toBeDefined()
      expect(Array.isArray(response.body.recentActivity)).toBe(true)
    })

    it('should deny access to private profile without authentication', async () => {
      const response = await request(app)
        .get(`/api/profile/user/${privateUser.username}`)
        .expect(403)

      expect(response.body.error).toBe('This profile is private')
    })

    it('should allow authenticated user to view own private profile', async () => {
      // Login as private user
      const loginResponse = await request(app)
        .post('/api/auth/login')
        .send({
          email: privateUser.email,
          password: 'TestPass123!'
        })
        .expect(200)

      const privateUserToken = loginResponse.body.token

      const response = await request(app)
        .get(`/api/profile/user/${privateUser.username}`)
        .set('Authorization', `Bearer ${privateUserToken}`)
        .expect(200)

      expect(response.body.profile.username).toBe(privateUser.username)
      expect(response.body.profile.is_own_profile).toBe(true)
    })

    it('should return 404 for non-existent username', async () => {
      const response = await request(app)
        .get('/api/profile/user/nonexistentuser99999')
        .expect(404)

      expect(response.body.error).toBe('User not found')
    })

    it('should mark is_own_profile correctly', async () => {
      const response = await request(app)
        .get(`/api/profile/user/${testUser.username}`)
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200)

      expect(response.body.profile.is_own_profile).toBe(true)
    })

    it('should work without authentication for public profiles', async () => {
      const response = await request(app)
        .get(`/api/profile/user/${publicUser.username}`)
        .expect(200)

      expect(response.body.profile.username).toBe(publicUser.username)
    })

    it('should serialize BigInt values in profile data', async () => {
      const response = await request(app)
        .get(`/api/profile/user/${publicUser.username}`)
        .expect(200)

      expect(typeof response.body.profile.user_id).toBe('number')

      const jsonString = JSON.stringify(response.body)
      expect(jsonString).not.toContain('BigInt')
    })
  })

  describe('PUT /api/profile - Update profile', () => {
    it('should update user bio', async () => {
      const response = await request(app)
        .put('/api/profile')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ bio: 'Updated bio text' })
        .expect(200)

      expect(response.body.message).toBeDefined()

      // Verify update
      const profile = await prisma.user.findUnique({
        where: { user_id: testUser.user_id }
      })
      expect(profile.bio).toBe('Updated bio text')
    })

    it('should update profile privacy setting', async () => {
      const response = await request(app)
        .put('/api/profile')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ is_public_profile: false })
        .expect(200)

      // Verify update
      const profile = await prisma.user.findUnique({
        where: { user_id: testUser.user_id }
      })
      expect(profile.is_public_profile).toBe(false)

      // Reset back to public
      await request(app)
        .put('/api/profile')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ is_public_profile: true })
        .expect(200)
    })

    it('should update website URL', async () => {
      const response = await request(app)
        .put('/api/profile')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ website: 'https://example.com' })
        .expect(200)

      // Verify update
      const profile = await prisma.user.findUnique({
        where: { user_id: testUser.user_id }
      })
      expect(profile.website).toBe('https://example.com')
    })

    it('should update location', async () => {
      const response = await request(app)
        .put('/api/profile')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ location: 'New York, NY' })
        .expect(200)

      // Verify update
      const profile = await prisma.user.findUnique({
        where: { user_id: testUser.user_id }
      })
      expect(profile.user_location).toBe('New York, NY')
    })

    it('should require authentication', async () => {
      const response = await request(app)
        .put('/api/profile')
        .send({ bio: 'Should fail' })
        .expect(401)

      expect(response.body.error).toBe('Access denied')
    })

    it('should sanitize bio input', async () => {
      const response = await request(app)
        .put('/api/profile')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ bio: '<script>alert("xss")</script>Safe bio' })
        .expect(200)

      // Verify XSS was sanitized
      const profile = await prisma.user.findUnique({
        where: { user_id: testUser.user_id }
      })
      expect(profile.bio).not.toContain('<script>')
    })

    it('should reject bio over 500 characters', async () => {
      const longBio = 'a'.repeat(501)
      const response = await request(app)
        .put('/api/profile')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ bio: longBio })
        .expect(400)

      expect(response.body.error).toBeDefined()
    })
  })

  describe('PUT /api/profile/username - Update username', () => {
    let tempUser
    let tempToken

    beforeEach(async () => {
      // Create temporary user for username tests
      const timestamp = Date.now()
      const hashedPassword = await bcrypt.hash('TestPass123!', 12)
      tempUser = await prisma.user.create({
        data: {
          email: `username-test-${timestamp}@test.com`,
          username: `tempuser${timestamp}`,
          password_hash: hashedPassword,
          role: 'user',
          is_verified: true,
          is_active: true
        }
      })

      const loginResponse = await request(app)
        .post('/api/auth/login')
        .send({
          email: `username-test-${timestamp}@test.com`,
          password: 'TestPass123!'
        })
        .expect(200)

      tempToken = loginResponse.body.token
    })

    afterEach(async () => {
      if (tempUser) {
        await prisma.user.delete({ where: { user_id: tempUser.user_id } })
      }
    })

    it('should update username successfully', async () => {
      const newUsername = 'newusername' + Date.now()
      const response = await request(app)
        .put('/api/profile/username')
        .set('Authorization', `Bearer ${tempToken}`)
        .send({ username: newUsername })
        .expect(200)

      expect(response.body.message).toBeDefined()
      expect(response.body.username).toBe(newUsername)

      // Verify update
      const user = await prisma.user.findUnique({
        where: { user_id: tempUser.user_id }
      })
      expect(user.username).toBe(newUsername)
    })

    it('should require authentication', async () => {
      const response = await request(app)
        .put('/api/profile/username')
        .send({ username: 'newusername' })
        .expect(401)

      expect(response.body.error).toBe('Access denied')
    })

    it('should reject username under 3 characters', async () => {
      const response = await request(app)
        .put('/api/profile/username')
        .set('Authorization', `Bearer ${tempToken}`)
        .send({ username: 'ab' })
        .expect(400)

      expect(response.body.error).toBeDefined()
    })

    it('should reject username over 30 characters', async () => {
      const longUsername = 'a'.repeat(31)
      const response = await request(app)
        .put('/api/profile/username')
        .set('Authorization', `Bearer ${tempToken}`)
        .send({ username: longUsername })
        .expect(400)

      expect(response.body.error).toBeDefined()
    })

    it('should reject username with invalid characters', async () => {
      const response = await request(app)
        .put('/api/profile/username')
        .set('Authorization', `Bearer ${tempToken}`)
        .send({ username: 'invalid username!' })
        .expect(400)

      expect(response.body.error).toBeDefined()
    })

    it('should reject duplicate username', async () => {
      const response = await request(app)
        .put('/api/profile/username')
        .set('Authorization', `Bearer ${tempToken}`)
        .send({ username: testUser.username })
        .expect(409)

      expect(response.body.error).toBeDefined()
    })

    it('should reject reserved usernames', async () => {
      const response = await request(app)
        .put('/api/profile/username')
        .set('Authorization', `Bearer ${tempToken}`)
        .send({ username: 'admin' })
        .expect(409)

      expect(response.body.error).toBeDefined()
    })
  })

  describe('POST /api/profile/favorite-cards - Set favorite cards', () => {
    let testCard

    beforeAll(async () => {
      // Get a test card
      const cards = await prisma.$queryRaw`
        SELECT TOP 1 card_id FROM card ORDER BY NEWID()
      `
      if (cards.length > 0) {
        testCard = Number(cards[0].card_id)

        // Add card to user's collection
        await prisma.$executeRaw`
          INSERT INTO user_card ([user], card, random_code, created)
          VALUES (${testUser.user_id}, ${testCard}, 'FAV1', GETDATE())
        `
      }
    })

    afterAll(async () => {
      // Cleanup
      if (testCard) {
        await prisma.$executeRaw`
          DELETE FROM user_card WHERE [user] = ${testUser.user_id} AND card = ${testCard}
        `
      }
    })

    it('should set favorite cards', async () => {
      if (!testCard) {
        console.log('Skipping - no test card available')
        return
      }

      // Get user_card_id
      const userCards = await prisma.$queryRaw`
        SELECT user_card_id FROM user_card
        WHERE [user] = ${testUser.user_id} AND card = ${testCard}
      `
      const userCardId = Number(userCards[0].user_card_id)

      const response = await request(app)
        .post('/api/profile/favorite-cards')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ favorite_card_ids: [userCardId] })
        .expect(200)

      expect(response.body.message).toBeDefined()

      // Verify favorite was set
      const favoriteCard = await prisma.$queryRaw`
        SELECT is_special FROM user_card WHERE user_card_id = ${userCardId}
      `
      expect(favoriteCard[0].is_special).toBe(true)
    })

    it('should require authentication', async () => {
      const response = await request(app)
        .post('/api/profile/favorite-cards')
        .send({ favorite_card_ids: [1, 2, 3] })
        .expect(401)

      expect(response.body.error).toBe('Access denied')
    })

    it('should reject more than 5 favorite cards', async () => {
      const response = await request(app)
        .post('/api/profile/favorite-cards')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ favorite_card_ids: [1, 2, 3, 4, 5, 6] })
        .expect(400)

      expect(response.body.error).toBeDefined()
    })
  })

  describe('Username Availability Check', () => {
    it('should check username availability', async () => {
      const response = await request(app)
        .get('/api/profile/check-username/availableusername123')
        .expect(200)

      expect(response.body.available).toBe(true)
    })

    it('should detect taken username', async () => {
      const response = await request(app)
        .get(`/api/profile/check-username/${testUser.username}`)
        .expect(200)

      expect(response.body.available).toBe(false)
    })

    it('should detect reserved usernames', async () => {
      const response = await request(app)
        .get('/api/profile/check-username/admin')
        .expect(200)

      expect(response.body.available).toBe(false)
      expect(response.body.reserved).toBe(true)
    })

    it('should suggest alternatives for taken usernames', async () => {
      const response = await request(app)
        .get(`/api/profile/check-username/${testUser.username}`)
        .expect(200)

      expect(response.body.available).toBe(false)
      expect(response.body.suggestions).toBeDefined()
      expect(Array.isArray(response.body.suggestions)).toBe(true)
    })

    it('should validate username format', async () => {
      const response = await request(app)
        .get('/api/profile/check-username/invalid username!')
        .expect(400)

      expect(response.body.error).toBeDefined()
    })
  })
})
