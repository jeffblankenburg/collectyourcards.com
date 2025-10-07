const request = require('supertest')
const { app } = require('../testApp')
const { PrismaClient } = require('@prisma/client')
const bcrypt = require('bcryptjs')

const prisma = new PrismaClient()

describe('Admin Users API Integration Tests', () => {
  let server
  let adminUser
  let adminToken
  let regularUser
  let regularToken

  beforeAll(async () => {
    server = app.listen(0)

    // Create admin user
    const timestamp = Date.now()
    const hashedPassword = await bcrypt.hash('AdminPass123!', 12)
    adminUser = await prisma.user.create({
      data: {
        email: `admin-test-${timestamp}@test.com`,
        username: `admintestuser${timestamp}`,
        password_hash: hashedPassword,
        first_name: 'Admin',
        last_name: 'User',
        role: 'admin',
        is_verified: true,
        is_active: true
      }
    })

    // Create regular user
    regularUser = await prisma.user.create({
      data: {
        email: `regular-test-${timestamp}@test.com`,
        username: `regulartestuser${timestamp}`,
        password_hash: hashedPassword,
        first_name: 'Regular',
        last_name: 'User',
        role: 'user',
        is_verified: true,
        is_active: true
      }
    })

    // Login as admin
    const adminLoginResponse = await request(app)
      .post('/api/auth/login')
      .send({
        email: `admin-test-${timestamp}@test.com`,
        password: 'AdminPass123!'
      })
      .expect(200)

    adminToken = adminLoginResponse.body.token

    // Login as regular user
    const regularLoginResponse = await request(app)
      .post('/api/auth/login')
      .send({
        email: `regular-test-${timestamp}@test.com`,
        password: 'AdminPass123!'
      })
      .expect(200)

    regularToken = regularLoginResponse.body.token
  })

  afterAll(async () => {
    // Cleanup
    await prisma.user.delete({ where: { user_id: adminUser.user_id } }).catch(() => {})
    await prisma.user.delete({ where: { user_id: regularUser.user_id } }).catch(() => {})

    await prisma.$disconnect()
    if (server) {
      server.close()
    }
  })

  describe('GET /api/admin/users - List users', () => {
    it('should fetch all users with admin auth', async () => {
      const response = await request(app)
        .get('/api/admin/users')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200)

      expect(response.body.users).toBeDefined()
      expect(Array.isArray(response.body.users)).toBe(true)
      expect(response.body.total).toBeGreaterThan(0)
    })

    it('should include user details', async () => {
      const response = await request(app)
        .get('/api/admin/users')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200)

      const user = response.body.users[0]
      expect(user).toHaveProperty('user_id')
      expect(user).toHaveProperty('email')
      expect(user).toHaveProperty('role')
      expect(user).toHaveProperty('is_active')
      expect(user).toHaveProperty('is_verified')
      expect(user).toHaveProperty('card_count')
    })

    it('should require authentication', async () => {
      const response = await request(app)
        .get('/api/admin/users')
        .expect(401)

      expect(response.body.error).toBe('Access denied')
    })

    it('should require admin role', async () => {
      const response = await request(app)
        .get('/api/admin/users')
        .set('Authorization', `Bearer ${regularToken}`)
        .expect(403)

      expect(response.body.error).toBe('Access denied')
      expect(response.body.message).toContain('admin')
    })

    it('should serialize BigInt values correctly', async () => {
      const response = await request(app)
        .get('/api/admin/users')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200)

      const user = response.body.users[0]
      expect(typeof user.user_id).toBe('number')
      expect(typeof user.card_count).toBe('number')

      const jsonString = JSON.stringify(response.body)
      expect(jsonString).not.toContain('BigInt')
    })
  })

  describe('POST /api/admin/users - Create user', () => {
    let createdUserId

    afterEach(async () => {
      // Cleanup created user
      if (createdUserId) {
        await prisma.user.delete({ where: { user_id: createdUserId } }).catch(() => {})
        createdUserId = null
      }
    })

    it('should create a new user with admin auth', async () => {
      const newUserData = {
        name: 'New Test User',
        email: 'newuser@test.com',
        role: 'user'
      }

      const response = await request(app)
        .post('/api/admin/users')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(newUserData)
        .expect(201)

      expect(response.body.user).toBeDefined()
      expect(response.body.user.email).toBe('newuser@test.com')
      expect(response.body.user.role).toBe('user')

      createdUserId = response.body.user.user_id
    })

    it('should require authentication', async () => {
      const response = await request(app)
        .post('/api/admin/users')
        .send({ name: 'Test', email: 'test@test.com' })
        .expect(401)

      expect(response.body.error).toBe('Access denied')
    })

    it('should require admin role', async () => {
      const response = await request(app)
        .post('/api/admin/users')
        .set('Authorization', `Bearer ${regularToken}`)
        .send({ name: 'Test', email: 'test@test.com' })
        .expect(403)

      expect(response.body.error).toBe('Access denied')
    })

    it('should require email', async () => {
      const response = await request(app)
        .post('/api/admin/users')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name: 'Test User' })
        .expect(400)

      expect(response.body.error).toBe('Validation error')
      expect(response.body.message).toContain('Email')
    })

    it('should validate email format', async () => {
      const response = await request(app)
        .post('/api/admin/users')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name: 'Test', email: 'invalid-email' })
        .expect(400)

      expect(response.body.error).toBe('Validation error')
    })

    it('should reject duplicate email', async () => {
      const response = await request(app)
        .post('/api/admin/users')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name: 'Test', email: adminUser.email })
        .expect(409)

      expect(response.body.error).toBe('Email conflict')
    })

    it('should set default role to user if not specified', async () => {
      const response = await request(app)
        .post('/api/admin/users')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name: 'Default Role', email: 'defaultrole@test.com' })
        .expect(201)

      expect(response.body.user.role).toBe('user')
      createdUserId = response.body.user.user_id
    })
  })

  describe('PUT /api/admin/users/:id - Update user', () => {
    let testUser

    beforeEach(async () => {
      const hashedPassword = await bcrypt.hash('TestPass123!', 12)
      testUser = await prisma.user.create({
        data: {
          email: 'updatetest@test.com',
          username: 'updatetestuser' + Date.now(),
          password_hash: hashedPassword,
          name: 'Update Test',
          role: 'user',
          is_verified: true,
          is_active: true
        }
      })
    })

    afterEach(async () => {
      if (testUser) {
        await prisma.user.delete({ where: { user_id: testUser.user_id } }).catch(() => {})
      }
    })

    it('should update user details', async () => {
      const response = await request(app)
        .put(`/api/admin/users/${testUser.user_id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name: 'Updated Name', role: 'data_admin' })
        .expect(200)

      expect(response.body.message).toBeDefined()

      // Verify update
      const updatedUser = await prisma.user.findUnique({
        where: { user_id: testUser.user_id }
      })
      expect(updatedUser.name).toBe('Updated Name')
      expect(updatedUser.role).toBe('data_admin')
    })

    it('should require authentication', async () => {
      const response = await request(app)
        .put(`/api/admin/users/${testUser.user_id}`)
        .send({ name: 'Updated' })
        .expect(401)

      expect(response.body.error).toBe('Access denied')
    })

    it('should require admin role', async () => {
      const response = await request(app)
        .put(`/api/admin/users/${testUser.user_id}`)
        .set('Authorization', `Bearer ${regularToken}`)
        .send({ name: 'Updated' })
        .expect(403)

      expect(response.body.error).toBe('Access denied')
    })

    it('should return 404 for non-existent user', async () => {
      const response = await request(app)
        .put('/api/admin/users/999999999')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name: 'Updated' })
        .expect(404)

      expect(response.body.error).toBeDefined()
    })

    it('should update is_active status', async () => {
      const response = await request(app)
        .put(`/api/admin/users/${testUser.user_id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ is_active: false })
        .expect(200)

      // Verify update
      const updatedUser = await prisma.user.findUnique({
        where: { user_id: testUser.user_id }
      })
      expect(updatedUser.is_active).toBe(false)
    })

    it('should update is_verified status', async () => {
      const response = await request(app)
        .put(`/api/admin/users/${testUser.user_id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ is_verified: false })
        .expect(200)

      // Verify update
      const updatedUser = await prisma.user.findUnique({
        where: { user_id: testUser.user_id }
      })
      expect(updatedUser.is_verified).toBe(false)
    })
  })

  describe('DELETE /api/admin/users/:id - Delete user', () => {
    let testUser

    beforeEach(async () => {
      const hashedPassword = await bcrypt.hash('TestPass123!', 12)
      testUser = await prisma.user.create({
        data: {
          email: 'deletetest@test.com',
          username: 'deletetestuser' + Date.now(),
          password_hash: hashedPassword,
          name: 'Delete Test',
          role: 'user',
          is_verified: true,
          is_active: true
        }
      })
    })

    it('should delete user with admin auth', async () => {
      const response = await request(app)
        .delete(`/api/admin/users/${testUser.user_id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200)

      expect(response.body.message).toBeDefined()

      // Verify deletion
      const deletedUser = await prisma.user.findUnique({
        where: { user_id: testUser.user_id }
      })
      expect(deletedUser).toBeNull()
      testUser = null // Prevent cleanup
    })

    it('should require authentication', async () => {
      const response = await request(app)
        .delete(`/api/admin/users/${testUser.user_id}`)
        .expect(401)

      expect(response.body.error).toBe('Access denied')
    })

    it('should require admin role', async () => {
      const response = await request(app)
        .delete(`/api/admin/users/${testUser.user_id}`)
        .set('Authorization', `Bearer ${regularToken}`)
        .expect(403)

      expect(response.body.error).toBe('Access denied')
    })

    it('should return 404 for non-existent user', async () => {
      const response = await request(app)
        .delete('/api/admin/users/999999999')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(404)

      expect(response.body.error).toBeDefined()
    })
  })

  describe('POST /api/admin/users/:id/reset-password - Reset user password', () => {
    let testUser

    beforeEach(async () => {
      const hashedPassword = await bcrypt.hash('TestPass123!', 12)
      testUser = await prisma.user.create({
        data: {
          email: 'resetpassword@test.com',
          username: 'resetpassworduser' + Date.now(),
          password_hash: hashedPassword,
          name: 'Reset Password Test',
          role: 'user',
          is_verified: true,
          is_active: true
        }
      })
    })

    afterEach(async () => {
      if (testUser) {
        await prisma.user.delete({ where: { user_id: testUser.user_id } }).catch(() => {})
      }
    })

    it('should reset user password with admin auth', async () => {
      const response = await request(app)
        .post(`/api/admin/users/${testUser.user_id}/reset-password`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200)

      expect(response.body.message).toBeDefined()
      expect(response.body.message).toContain('password reset')
    })

    it('should require authentication', async () => {
      const response = await request(app)
        .post(`/api/admin/users/${testUser.user_id}/reset-password`)
        .expect(401)

      expect(response.body.error).toBe('Access denied')
    })

    it('should require admin role', async () => {
      const response = await request(app)
        .post(`/api/admin/users/${testUser.user_id}/reset-password`)
        .set('Authorization', `Bearer ${regularToken}`)
        .expect(403)

      expect(response.body.error).toBe('Access denied')
    })

    it('should return 404 for non-existent user', async () => {
      const response = await request(app)
        .post('/api/admin/users/999999999/reset-password')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(404)

      expect(response.body.error).toBeDefined()
    })
  })

  describe('Admin Action Logging', () => {
    it('should log admin actions', async () => {
      const newUserData = {
        name: 'Logged User',
        email: 'loggeduser@test.com',
        role: 'user'
      }

      const response = await request(app)
        .post('/api/admin/users')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(newUserData)
        .expect(201)

      const createdUserId = response.body.user.user_id

      // Check that admin action was logged
      const actionLog = await prisma.admin_action_log.findFirst({
        where: {
          user_id: adminUser.user_id,
          action_type: 'CREATE',
          entity_type: 'user',
          entity_id: createdUserId.toString()
        }
      })

      expect(actionLog).toBeDefined()

      // Cleanup
      await prisma.user.delete({ where: { user_id: createdUserId } }).catch(() => {})
    })
  })
})
