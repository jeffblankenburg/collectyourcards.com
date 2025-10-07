const request = require('supertest')
const { app } = require('../testApp')
const { PrismaClient } = require('@prisma/client')
const bcrypt = require('bcryptjs')

const prisma = new PrismaClient()

describe('Notifications API Integration Tests', () => {
  let server
  let testUser
  let userToken
  let testNotificationIds = []

  beforeAll(async () => {
    server = app.listen(0)

    // Create test user
    const hashedPassword = await bcrypt.hash('TestPass123!', 12)
    testUser = await prisma.user.create({
      data: {
        email: 'notifications-test@test.com',
        username: 'notificationstestuser' + Date.now(),
        password_hash: hashedPassword,
        name: 'Notifications Test User',
        role: 'user',
        is_verified: true,
        is_active: true
      }
    })

    // Login to get token
    const loginResponse = await request(app)
      .post('/api/auth/login')
      .send({
        email: 'notifications-test@test.com',
        password: 'TestPass123!'
      })
      .expect(200)

    userToken = loginResponse.body.token
  })

  afterAll(async () => {
    // Cleanup notifications
    await prisma.$executeRaw`DELETE FROM user_notifications WHERE user_id = ${testUser.user_id}`

    // Cleanup user
    await prisma.user.delete({ where: { user_id: testUser.user_id } })

    await prisma.$disconnect()
    if (server) {
      server.close()
    }
  })

  beforeEach(async () => {
    // Clean up any existing notifications
    await prisma.$executeRaw`DELETE FROM user_notifications WHERE user_id = ${testUser.user_id}`
    testNotificationIds = []
  })

  afterEach(async () => {
    // Clean up test notifications
    await prisma.$executeRaw`DELETE FROM user_notifications WHERE user_id = ${testUser.user_id}`
  })

  describe('GET /api/notifications', () => {
    beforeEach(async () => {
      // Create test notifications
      await prisma.$executeRaw`
        INSERT INTO user_notifications (user_id, notification_type, title, message, is_read, created_at)
        VALUES
          (${testUser.user_id}, 'comment', 'New Comment', 'Someone commented on your card', 0, GETDATE()),
          (${testUser.user_id}, 'reply', 'New Reply', 'Someone replied to your comment', 0, DATEADD(MINUTE, -5, GETDATE())),
          (${testUser.user_id}, 'info', 'System Message', 'Welcome to the platform', 1, DATEADD(HOUR, -1, GETDATE()))
      `

      // Get notification IDs
      const notifications = await prisma.$queryRaw`
        SELECT notification_id FROM user_notifications WHERE user_id = ${testUser.user_id}
      `
      testNotificationIds = notifications.map(n => Number(n.notification_id))
    })

    it('should fetch notifications for authenticated user', async () => {
      const response = await request(app)
        .get('/api/notifications')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200)

      expect(response.body.notifications).toBeDefined()
      expect(Array.isArray(response.body.notifications)).toBe(true)
      expect(response.body.notifications.length).toBe(3)
      expect(response.body.total).toBe(3)
    })

    it('should require authentication', async () => {
      const response = await request(app)
        .get('/api/notifications')
        .expect(401)

      expect(response.body.error).toBe('Access denied')
    })

    it('should order notifications by newest first', async () => {
      const response = await request(app)
        .get('/api/notifications')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200)

      const notifications = response.body.notifications
      expect(notifications[0].title).toBe('New Comment')
      expect(notifications[1].title).toBe('New Reply')
      expect(notifications[2].title).toBe('System Message')
    })

    it('should paginate notifications', async () => {
      const response = await request(app)
        .get('/api/notifications?limit=2&offset=0')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200)

      expect(response.body.notifications.length).toBe(2)
      expect(response.body.limit).toBe(2)
      expect(response.body.offset).toBe(0)
      expect(response.body.total).toBe(3)
    })

    it('should handle pagination offset', async () => {
      const response = await request(app)
        .get('/api/notifications?limit=2&offset=2')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200)

      expect(response.body.notifications.length).toBe(1)
      expect(response.body.offset).toBe(2)
    })

    it('should serialize BigInt values correctly', async () => {
      const response = await request(app)
        .get('/api/notifications')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200)

      const notification = response.body.notifications[0]
      expect(typeof notification.notification_id).toBe('number')

      // Should not contain BigInt artifacts
      const jsonString = JSON.stringify(response.body)
      expect(jsonString).not.toContain('BigInt')
    })

    it('should return empty array when no notifications exist', async () => {
      // Delete all notifications
      await prisma.$executeRaw`DELETE FROM user_notifications WHERE user_id = ${testUser.user_id}`

      const response = await request(app)
        .get('/api/notifications')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200)

      expect(response.body.notifications).toEqual([])
      expect(response.body.total).toBe(0)
    })
  })

  describe('GET /api/notifications/unread-count', () => {
    beforeEach(async () => {
      // Create mix of read and unread notifications
      await prisma.$executeRaw`
        INSERT INTO user_notifications (user_id, notification_type, title, message, is_read, created_at)
        VALUES
          (${testUser.user_id}, 'comment', 'Unread 1', 'Message 1', 0, GETDATE()),
          (${testUser.user_id}, 'comment', 'Unread 2', 'Message 2', 0, GETDATE()),
          (${testUser.user_id}, 'comment', 'Read 1', 'Message 3', 1, GETDATE()),
          (${testUser.user_id}, 'comment', 'Unread 3', 'Message 4', 0, GETDATE())
      `
    })

    it('should return correct unread count', async () => {
      const response = await request(app)
        .get('/api/notifications/unread-count')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200)

      expect(response.body.count).toBe(3)
    })

    it('should require authentication', async () => {
      const response = await request(app)
        .get('/api/notifications/unread-count')
        .expect(401)

      expect(response.body.error).toBe('Access denied')
    })

    it('should return 0 when all notifications are read', async () => {
      // Mark all as read
      await prisma.$executeRaw`
        UPDATE user_notifications
        SET is_read = 1
        WHERE user_id = ${testUser.user_id}
      `

      const response = await request(app)
        .get('/api/notifications/unread-count')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200)

      expect(response.body.count).toBe(0)
    })

    it('should return 0 when no notifications exist', async () => {
      await prisma.$executeRaw`DELETE FROM user_notifications WHERE user_id = ${testUser.user_id}`

      const response = await request(app)
        .get('/api/notifications/unread-count')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200)

      expect(response.body.count).toBe(0)
    })
  })

  describe('PUT /api/notifications/:id/read', () => {
    let notificationId

    beforeEach(async () => {
      // Create unread notification
      await prisma.$executeRaw`
        INSERT INTO user_notifications (user_id, notification_type, title, message, is_read, created_at)
        VALUES (${testUser.user_id}, 'comment', 'Test', 'Test message', 0, GETDATE())
      `

      const result = await prisma.$queryRaw`
        SELECT TOP 1 notification_id
        FROM user_notifications
        WHERE user_id = ${testUser.user_id}
        ORDER BY created_at DESC
      `
      notificationId = Number(result[0].notification_id)
    })

    it('should mark notification as read', async () => {
      const response = await request(app)
        .put(`/api/notifications/${notificationId}/read`)
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200)

      expect(response.body.success).toBe(true)
      expect(response.body.message).toBe('Notification marked as read')

      // Verify it was marked as read
      const notification = await prisma.$queryRaw`
        SELECT is_read FROM user_notifications WHERE notification_id = ${notificationId}
      `
      expect(notification[0].is_read).toBe(true)
    })

    it('should require authentication', async () => {
      const response = await request(app)
        .put(`/api/notifications/${notificationId}/read`)
        .expect(401)

      expect(response.body.error).toBe('Access denied')
    })

    it('should return 404 for non-existent notification', async () => {
      const response = await request(app)
        .put('/api/notifications/999999999/read')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(404)

      expect(response.body.success).toBe(false)
      expect(response.body.message).toBe('Notification not found')
    })

    it('should not mark other users notifications as read', async () => {
      // Create another user with unique credentials
      const hashedPassword = await bcrypt.hash('TestPass123!', 12)
      const timestamp = Date.now()
      const otherUser = await prisma.user.create({
        data: {
          email: `other-notif-${timestamp}@test.com`,
          username: `othernotifuser${timestamp}`,
          password_hash: hashedPassword,
          name: 'Other User',
          role: 'user',
          is_verified: true,
          is_active: true
        }
      })

      // Create notification for other user
      await prisma.$executeRaw`
        INSERT INTO user_notifications (user_id, notification_type, title, message, is_read, created_at)
        VALUES (${otherUser.user_id}, 'comment', 'Other', 'Other message', 0, GETDATE())
      `

      const result = await prisma.$queryRaw`
        SELECT TOP 1 notification_id
        FROM user_notifications
        WHERE user_id = ${otherUser.user_id}
        ORDER BY created_at DESC
      `
      const otherNotificationId = Number(result[0].notification_id)

      // Try to mark as read with our user's token
      const response = await request(app)
        .put(`/api/notifications/${otherNotificationId}/read`)
        .set('Authorization', `Bearer ${userToken}`)
        .expect(404)

      expect(response.body.success).toBe(false)

      // Cleanup
      await prisma.$executeRaw`DELETE FROM user_notifications WHERE user_id = ${otherUser.user_id}`
      await prisma.user.delete({ where: { user_id: otherUser.user_id } })
    })
  })

  describe('PUT /api/notifications/mark-all-read', () => {
    beforeEach(async () => {
      // Create multiple unread notifications
      await prisma.$executeRaw`
        INSERT INTO user_notifications (user_id, notification_type, title, message, is_read, created_at)
        VALUES
          (${testUser.user_id}, 'comment', 'Unread 1', 'Message 1', 0, GETDATE()),
          (${testUser.user_id}, 'comment', 'Unread 2', 'Message 2', 0, GETDATE()),
          (${testUser.user_id}, 'comment', 'Already Read', 'Message 3', 1, GETDATE())
      `
    })

    it('should mark all notifications as read', async () => {
      const response = await request(app)
        .put('/api/notifications/mark-all-read')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200)

      expect(response.body.success).toBe(true)
      expect(response.body.message).toBe('All notifications marked as read')

      // Verify all are read
      const unreadCount = await prisma.$queryRaw`
        SELECT COUNT(*) as count
        FROM user_notifications
        WHERE user_id = ${testUser.user_id} AND is_read = 0
      `
      expect(Number(unreadCount[0].count)).toBe(0)
    })

    it('should require authentication', async () => {
      const response = await request(app)
        .put('/api/notifications/mark-all-read')
        .expect(401)

      expect(response.body.error).toBe('Access denied')
    })

    it('should work when all notifications are already read', async () => {
      // Mark all as read first
      await prisma.$executeRaw`
        UPDATE user_notifications
        SET is_read = 1
        WHERE user_id = ${testUser.user_id}
      `

      const response = await request(app)
        .put('/api/notifications/mark-all-read')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200)

      expect(response.body.success).toBe(true)
    })

    it('should work when no notifications exist', async () => {
      await prisma.$executeRaw`DELETE FROM user_notifications WHERE user_id = ${testUser.user_id}`

      const response = await request(app)
        .put('/api/notifications/mark-all-read')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200)

      expect(response.body.success).toBe(true)
    })
  })

  describe('DELETE /api/notifications/:id', () => {
    let notificationId

    beforeEach(async () => {
      // Create notification to delete
      await prisma.$executeRaw`
        INSERT INTO user_notifications (user_id, notification_type, title, message, is_read, created_at)
        VALUES (${testUser.user_id}, 'comment', 'To Delete', 'Delete this', 0, GETDATE())
      `

      const result = await prisma.$queryRaw`
        SELECT TOP 1 notification_id
        FROM user_notifications
        WHERE user_id = ${testUser.user_id}
        ORDER BY created_at DESC
      `
      notificationId = Number(result[0].notification_id)
    })

    it('should delete notification', async () => {
      const response = await request(app)
        .delete(`/api/notifications/${notificationId}`)
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200)

      expect(response.body.success).toBe(true)
      expect(response.body.message).toBe('Notification deleted')

      // Verify it was deleted
      const notification = await prisma.$queryRaw`
        SELECT * FROM user_notifications WHERE notification_id = ${notificationId}
      `
      expect(notification.length).toBe(0)
    })

    it('should require authentication', async () => {
      const response = await request(app)
        .delete(`/api/notifications/${notificationId}`)
        .expect(401)

      expect(response.body.error).toBe('Access denied')
    })

    it('should not delete other users notifications', async () => {
      // Create another user with unique credentials
      const hashedPassword = await bcrypt.hash('TestPass123!', 12)
      const timestamp = Date.now()
      const otherUser = await prisma.user.create({
        data: {
          email: `other-delete-notif-${timestamp}@test.com`,
          username: `otherdeletenotifuser${timestamp}`,
          password_hash: hashedPassword,
          name: 'Other User',
          role: 'user',
          is_verified: true,
          is_active: true
        }
      })

      // Create notification for other user
      await prisma.$executeRaw`
        INSERT INTO user_notifications (user_id, notification_type, title, message, is_read, created_at)
        VALUES (${otherUser.user_id}, 'comment', 'Other', 'Other message', 0, GETDATE())
      `

      const result = await prisma.$queryRaw`
        SELECT TOP 1 notification_id
        FROM user_notifications
        WHERE user_id = ${otherUser.user_id}
        ORDER BY created_at DESC
      `
      const otherNotificationId = Number(result[0].notification_id)

      // Try to delete with our user's token
      await request(app)
        .delete(`/api/notifications/${otherNotificationId}`)
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200) // API doesn't verify ownership, just returns success

      // Verify other user's notification was NOT deleted (due to WHERE clause)
      const notification = await prisma.$queryRaw`
        SELECT * FROM user_notifications WHERE notification_id = ${otherNotificationId}
      `
      expect(notification.length).toBe(1) // Should still exist

      // Cleanup
      await prisma.$executeRaw`DELETE FROM user_notifications WHERE user_id = ${otherUser.user_id}`
      await prisma.user.delete({ where: { user_id: otherUser.user_id } })
    })
  })

  describe('DELETE /api/notifications/clear-read', () => {
    beforeEach(async () => {
      // Create mix of read and unread notifications
      await prisma.$executeRaw`
        INSERT INTO user_notifications (user_id, notification_type, title, message, is_read, created_at)
        VALUES
          (${testUser.user_id}, 'comment', 'Unread', 'Keep this', 0, GETDATE()),
          (${testUser.user_id}, 'comment', 'Read 1', 'Delete this', 1, GETDATE()),
          (${testUser.user_id}, 'comment', 'Read 2', 'Delete this too', 1, GETDATE())
      `
    })

    it('should delete only read notifications', async () => {
      const response = await request(app)
        .delete('/api/notifications/clear-read')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200)

      expect(response.body.success).toBe(true)
      expect(response.body.message).toBe('Read notifications cleared')

      // Verify only unread remain
      const remaining = await prisma.$queryRaw`
        SELECT * FROM user_notifications WHERE user_id = ${testUser.user_id}
      `
      expect(remaining.length).toBe(1)
      expect(remaining[0].title).toBe('Unread')
    })

    it('should require authentication', async () => {
      const response = await request(app)
        .delete('/api/notifications/clear-read')
        .expect(401)

      expect(response.body.error).toBe('Access denied')
    })

    it('should work when no read notifications exist', async () => {
      // Mark all as unread
      await prisma.$executeRaw`
        UPDATE user_notifications
        SET is_read = 0
        WHERE user_id = ${testUser.user_id}
      `

      const response = await request(app)
        .delete('/api/notifications/clear-read')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200)

      expect(response.body.success).toBe(true)

      // All should still exist
      const remaining = await prisma.$queryRaw`
        SELECT COUNT(*) as count FROM user_notifications WHERE user_id = ${testUser.user_id}
      `
      expect(Number(remaining[0].count)).toBe(3)
    })

    it('should work when no notifications exist', async () => {
      await prisma.$executeRaw`DELETE FROM user_notifications WHERE user_id = ${testUser.user_id}`

      const response = await request(app)
        .delete('/api/notifications/clear-read')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200)

      expect(response.body.success).toBe(true)
    })
  })
})
