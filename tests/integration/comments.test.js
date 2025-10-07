const request = require('supertest')
const { app } = require('../testApp')
const { PrismaClient } = require('@prisma/client')
const bcrypt = require('bcryptjs')

const prisma = new PrismaClient()

describe('Comments API Integration Tests', () => {
  let server
  let testUser
  let userToken
  let testCard
  let testSeries
  let testSet

  beforeAll(async () => {
    server = app.listen(0)

    // Create test user
    const hashedPassword = await bcrypt.hash('TestPass123!', 12)
    testUser = await prisma.user.create({
      data: {
        email: 'comments-test@test.com',
        username: 'commentstestuser' + Date.now(),
        password_hash: hashedPassword,
        name: 'Comments Test User',
        role: 'user',
        is_verified: true,
        is_active: true
      }
    })

    // Login to get token
    const loginResponse = await request(app)
      .post('/api/auth/login')
      .send({
        email: 'comments-test@test.com',
        password: 'TestPass123!'
      })
      .expect(200)

    userToken = loginResponse.body.token

    // Get test data (card, series, set)
    const cardData = await prisma.$queryRaw`
      SELECT TOP 1
        c.card_id,
        s.series_id,
        st.set_id
      FROM card c
      JOIN series s ON c.series = s.series_id
      JOIN [set] st ON s.[set] = st.set_id
      ORDER BY NEWID()
    `

    if (cardData.length > 0) {
      testCard = Number(cardData[0].card_id)
      testSeries = Number(cardData[0].series_id)
      testSet = Number(cardData[0].set_id)
    }
  })

  afterAll(async () => {
    // Cleanup comments
    await prisma.$executeRaw`DELETE FROM universal_comments WHERE user_id = ${testUser.user_id}`

    // Cleanup subscriptions
    await prisma.$executeRaw`DELETE FROM user_item_subscriptions WHERE user_id = ${testUser.user_id}`

    // Cleanup user
    await prisma.user.delete({ where: { user_id: testUser.user_id } })

    await prisma.$disconnect()
    if (server) {
      server.close()
    }
  })

  describe('GET /api/comments/:type/:itemId', () => {
    let testCommentId

    beforeEach(async () => {
      // Create a test comment
      if (testCard) {
        await prisma.$executeRaw`
          INSERT INTO universal_comments (user_id, comment_type, item_id, comment_text, comment_status)
          VALUES (${testUser.user_id}, 'card', ${testCard}, 'Test comment for GET', 'visible')
        `

        const result = await prisma.$queryRaw`
          SELECT TOP 1 comment_id
          FROM universal_comments
          WHERE user_id = ${testUser.user_id}
          ORDER BY created_at DESC
        `
        testCommentId = Number(result[0].comment_id)
      }
    })

    afterEach(async () => {
      // Cleanup test comments
      await prisma.$executeRaw`DELETE FROM universal_comments WHERE user_id = ${testUser.user_id}`
    })

    it('should fetch comments for a card', async () => {
      if (!testCard) {
        console.log('Skipping - no test card available')
        return
      }

      const response = await request(app)
        .get(`/api/comments/card/${testCard}`)
        .expect(200)

      expect(response.body.comments).toBeDefined()
      expect(Array.isArray(response.body.comments)).toBe(true)
      expect(response.body.comments.length).toBeGreaterThan(0)

      const comment = response.body.comments[0]
      expect(comment.comment_text).toBe('Test comment for GET')
      expect(comment.user.username).toBe(testUser.username)
      expect(comment.comment_id).toBe(testCommentId)
    })

    it('should fetch comments for a series', async () => {
      if (!testSeries) {
        console.log('Skipping - no test series available')
        return
      }

      // Create series comment
      await prisma.$executeRaw`
        INSERT INTO universal_comments (user_id, comment_type, item_id, comment_text, comment_status)
        VALUES (${testUser.user_id}, 'series', ${testSeries}, 'Series test comment', 'visible')
      `

      const response = await request(app)
        .get(`/api/comments/series/${testSeries}`)
        .expect(200)

      expect(response.body.comments).toBeDefined()
      expect(Array.isArray(response.body.comments)).toBe(true)

      const seriesComment = response.body.comments.find(c => c.comment_text === 'Series test comment')
      expect(seriesComment).toBeDefined()
    })

    it('should fetch comments for a set', async () => {
      if (!testSet) {
        console.log('Skipping - no test set available')
        return
      }

      // Create set comment
      await prisma.$executeRaw`
        INSERT INTO universal_comments (user_id, comment_type, item_id, comment_text, comment_status)
        VALUES (${testUser.user_id}, 'set', ${testSet}, 'Set test comment', 'visible')
      `

      const response = await request(app)
        .get(`/api/comments/set/${testSet}`)
        .expect(200)

      expect(response.body.comments).toBeDefined()
      expect(Array.isArray(response.body.comments)).toBe(true)
    })

    it('should reject invalid comment type', async () => {
      const response = await request(app)
        .get('/api/comments/invalid/123')
        .expect(400)

      expect(response.body.error).toBe('Invalid comment type')
    })

    it('should reject invalid item ID', async () => {
      const response = await request(app)
        .get('/api/comments/card/not-a-number')
        .expect(400)

      expect(response.body.error).toBe('Invalid item ID')
    })

    it('should paginate comments correctly', async () => {
      if (!testCard) {
        console.log('Skipping - no test card available')
        return
      }

      const response = await request(app)
        .get(`/api/comments/card/${testCard}?page=1&limit=10`)
        .expect(200)

      expect(response.body.pagination).toBeDefined()
      expect(response.body.pagination.page).toBe(1)
      expect(response.body.pagination.limit).toBe(10)
      expect(response.body.pagination.total).toBeGreaterThanOrEqual(0)
    })

    it('should not return deleted comments', async () => {
      if (!testCard) {
        console.log('Skipping - no test card available')
        return
      }

      // Soft delete the comment
      await prisma.$executeRaw`
        UPDATE universal_comments
        SET is_deleted = 1
        WHERE comment_id = ${testCommentId}
      `

      const response = await request(app)
        .get(`/api/comments/card/${testCard}`)
        .expect(200)

      const deletedComment = response.body.comments.find(c => c.comment_id === testCommentId)
      expect(deletedComment).toBeUndefined()
    })

    it('should serialize BigInt values correctly', async () => {
      if (!testCard) {
        console.log('Skipping - no test card available')
        return
      }

      const response = await request(app)
        .get(`/api/comments/card/${testCard}`)
        .expect(200)

      const comment = response.body.comments[0]
      expect(typeof comment.comment_id).toBe('number')
      expect(typeof comment.user.user_id).toBe('number')

      // Should not contain BigInt artifacts
      const jsonString = JSON.stringify(response.body)
      expect(jsonString).not.toContain('BigInt')
    })
  })

  describe('POST /api/comments/:type/:itemId', () => {
    afterEach(async () => {
      await prisma.$executeRaw`DELETE FROM universal_comments WHERE user_id = ${testUser.user_id}`
      await prisma.$executeRaw`DELETE FROM user_item_subscriptions WHERE user_id = ${testUser.user_id}`
    })

    it('should create a new comment with authentication', async () => {
      if (!testCard) {
        console.log('Skipping - no test card available')
        return
      }

      const response = await request(app)
        .post(`/api/comments/card/${testCard}`)
        .set('Authorization', `Bearer ${userToken}`)
        .send({ comment_text: 'This is a test comment' })
        .expect(201)

      expect(response.body.comment).toBeDefined()
      expect(response.body.comment.comment_text).toBe('This is a test comment')
      expect(response.body.comment.user.username).toBe(testUser.username)
    })

    it('should require authentication', async () => {
      if (!testCard) {
        console.log('Skipping - no test card available')
        return
      }

      const response = await request(app)
        .post(`/api/comments/card/${testCard}`)
        .send({ comment_text: 'This should fail' })
        .expect(401)

      expect(response.body.error).toBe('Access denied')
    })

    it('should reject empty comment text', async () => {
      if (!testCard) {
        console.log('Skipping - no test card available')
        return
      }

      const response = await request(app)
        .post(`/api/comments/card/${testCard}`)
        .set('Authorization', `Bearer ${userToken}`)
        .send({ comment_text: '' })
        .expect(400)

      expect(response.body.error).toBe('Comment text is required')
    })

    it('should reject comment text over 5000 characters', async () => {
      if (!testCard) {
        console.log('Skipping - no test card available')
        return
      }

      const longText = 'a'.repeat(5001)
      const response = await request(app)
        .post(`/api/comments/card/${testCard}`)
        .set('Authorization', `Bearer ${userToken}`)
        .send({ comment_text: longText })
        .expect(400)

      expect(response.body.error).toBe('Comment too long (max 5000 characters)')
    })

    it('should auto-subscribe user to item after commenting', async () => {
      if (!testCard) {
        console.log('Skipping - no test card available')
        return
      }

      await request(app)
        .post(`/api/comments/card/${testCard}`)
        .set('Authorization', `Bearer ${userToken}`)
        .send({ comment_text: 'Test subscription' })
        .expect(201)

      // Check subscription was created
      const subscription = await prisma.$queryRaw`
        SELECT * FROM user_item_subscriptions
        WHERE user_id = ${testUser.user_id}
          AND item_type = 'card'
          AND item_id = ${testCard}
      `

      expect(subscription.length).toBeGreaterThan(0)
    })

    it('should handle parent comment (reply)', async () => {
      if (!testCard) {
        console.log('Skipping - no test card available')
        return
      }

      // Create parent comment
      const parentResponse = await request(app)
        .post(`/api/comments/card/${testCard}`)
        .set('Authorization', `Bearer ${userToken}`)
        .send({ comment_text: 'Parent comment' })
        .expect(201)

      const parentCommentId = parentResponse.body.comment.comment_id

      // Create reply
      const replyResponse = await request(app)
        .post(`/api/comments/card/${testCard}`)
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          comment_text: 'Reply comment',
          parent_comment_id: parentCommentId
        })
        .expect(201)

      expect(replyResponse.body.comment.parent_comment_id).toBe(parentCommentId)
    })

    it('should reject invalid parent comment ID', async () => {
      if (!testCard) {
        console.log('Skipping - no test card available')
        return
      }

      const response = await request(app)
        .post(`/api/comments/card/${testCard}`)
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          comment_text: 'Reply to non-existent',
          parent_comment_id: 999999999
        })
        .expect(400)

      expect(response.body.error).toBe('Parent comment not found')
    })

    it('should reject invalid comment type', async () => {
      const response = await request(app)
        .post('/api/comments/invalid/123')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ comment_text: 'Test' })
        .expect(400)

      expect(response.body.error).toBe('Invalid comment type')
    })
  })

  describe('PUT /api/comments/:commentId', () => {
    let editableCommentId

    beforeEach(async () => {
      if (testCard) {
        // Create fresh comment for editing
        await prisma.$executeRaw`
          INSERT INTO universal_comments (user_id, comment_type, item_id, comment_text, comment_status)
          VALUES (${testUser.user_id}, 'card', ${testCard}, 'Original comment text', 'visible')
        `

        const result = await prisma.$queryRaw`
          SELECT TOP 1 comment_id
          FROM universal_comments
          WHERE user_id = ${testUser.user_id}
          ORDER BY created_at DESC
        `
        editableCommentId = Number(result[0].comment_id)
      }
    })

    afterEach(async () => {
      await prisma.$executeRaw`DELETE FROM universal_comments WHERE user_id = ${testUser.user_id}`
    })

    it('should edit own comment within 15 minute window', async () => {
      if (!editableCommentId) {
        console.log('Skipping - no test comment available')
        return
      }

      const response = await request(app)
        .put(`/api/comments/${editableCommentId}`)
        .set('Authorization', `Bearer ${userToken}`)
        .send({ comment_text: 'Edited comment text' })
        .expect(200)

      expect(response.body.message).toBe('Comment updated successfully')

      // Verify edit
      const updated = await prisma.$queryRaw`
        SELECT comment_text, is_edited
        FROM universal_comments
        WHERE comment_id = ${editableCommentId}
      `

      expect(updated[0].comment_text).toBe('Edited comment text')
      expect(updated[0].is_edited).toBe(true)
    })

    it('should require authentication for editing', async () => {
      if (!editableCommentId) {
        console.log('Skipping - no test comment available')
        return
      }

      const response = await request(app)
        .put(`/api/comments/${editableCommentId}`)
        .send({ comment_text: 'Should fail' })
        .expect(401)

      expect(response.body.error).toBe('Access denied')
    })

    it('should reject editing other user comments', async () => {
      if (!testCard) {
        console.log('Skipping - no test card available')
        return
      }

      // Create another user with unique email/username
      const hashedPassword = await bcrypt.hash('TestPass123!', 12)
      const timestamp = Date.now()
      const otherUser = await prisma.user.create({
        data: {
          email: `other-comments-${timestamp}@test.com`,
          username: `othercommentuser${timestamp}`,
          password_hash: hashedPassword,
          name: 'Other User',
          role: 'user',
          is_verified: true,
          is_active: true
        }
      })

      // Create comment by other user
      await prisma.$executeRaw`
        INSERT INTO universal_comments (user_id, comment_type, item_id, comment_text, comment_status)
        VALUES (${otherUser.user_id}, 'card', ${testCard}, 'Other user comment', 'visible')
      `

      const result = await prisma.$queryRaw`
        SELECT TOP 1 comment_id
        FROM universal_comments
        WHERE user_id = ${otherUser.user_id}
        ORDER BY created_at DESC
      `
      const otherCommentId = Number(result[0].comment_id)

      // Try to edit with our user's token
      const response = await request(app)
        .put(`/api/comments/${otherCommentId}`)
        .set('Authorization', `Bearer ${userToken}`)
        .send({ comment_text: 'Trying to edit' })
        .expect(403)

      expect(response.body.error).toBe('You can only edit your own comments')

      // Cleanup
      await prisma.$executeRaw`DELETE FROM universal_comments WHERE user_id = ${otherUser.user_id}`
      await prisma.user.delete({ where: { user_id: otherUser.user_id } })
    })

    it('should reject edit after 15 minute window', async () => {
      if (!testCard) {
        console.log('Skipping - no test card available')
        return
      }

      // Create old comment (16 minutes ago)
      await prisma.$executeRaw`
        INSERT INTO universal_comments (user_id, comment_type, item_id, comment_text, comment_status, created_at)
        VALUES (${testUser.user_id}, 'card', ${testCard}, 'Old comment', 'visible', DATEADD(MINUTE, -16, GETDATE()))
      `

      const result = await prisma.$queryRaw`
        SELECT TOP 1 comment_id
        FROM universal_comments
        WHERE user_id = ${testUser.user_id}
        ORDER BY created_at ASC
      `
      const oldCommentId = Number(result[0].comment_id)

      const response = await request(app)
        .put(`/api/comments/${oldCommentId}`)
        .set('Authorization', `Bearer ${userToken}`)
        .send({ comment_text: 'Should not work' })
        .expect(400)

      expect(response.body.error).toBe('Comments can only be edited within 15 minutes of posting')
    })

    it('should reject empty comment text', async () => {
      if (!editableCommentId) {
        console.log('Skipping - no test comment available')
        return
      }

      const response = await request(app)
        .put(`/api/comments/${editableCommentId}`)
        .set('Authorization', `Bearer ${userToken}`)
        .send({ comment_text: '' })
        .expect(400)

      expect(response.body.error).toBe('Comment text is required')
    })

    it('should reject comment text over 5000 characters', async () => {
      if (!editableCommentId) {
        console.log('Skipping - no test comment available')
        return
      }

      const longText = 'a'.repeat(5001)
      const response = await request(app)
        .put(`/api/comments/${editableCommentId}`)
        .set('Authorization', `Bearer ${userToken}`)
        .send({ comment_text: longText })
        .expect(400)

      expect(response.body.error).toBe('Comment too long (max 5000 characters)')
    })

    it('should return 404 for non-existent comment', async () => {
      const response = await request(app)
        .put('/api/comments/999999999')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ comment_text: 'Edit non-existent' })
        .expect(404)

      expect(response.body.error).toBe('Comment not found')
    })
  })

  describe('DELETE /api/comments/:commentId', () => {
    let deletableCommentId

    beforeEach(async () => {
      if (testCard) {
        await prisma.$executeRaw`
          INSERT INTO universal_comments (user_id, comment_type, item_id, comment_text, comment_status)
          VALUES (${testUser.user_id}, 'card', ${testCard}, 'Comment to delete', 'visible')
        `

        const result = await prisma.$queryRaw`
          SELECT TOP 1 comment_id
          FROM universal_comments
          WHERE user_id = ${testUser.user_id}
          ORDER BY created_at DESC
        `
        deletableCommentId = Number(result[0].comment_id)
      }
    })

    afterEach(async () => {
      await prisma.$executeRaw`DELETE FROM universal_comments WHERE user_id = ${testUser.user_id}`
    })

    it('should delete own comment', async () => {
      if (!deletableCommentId) {
        console.log('Skipping - no test comment available')
        return
      }

      const response = await request(app)
        .delete(`/api/comments/${deletableCommentId}`)
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200)

      expect(response.body.message).toBe('Comment deleted successfully')

      // Verify soft delete
      const deleted = await prisma.$queryRaw`
        SELECT is_deleted, deleted_at, deleted_by
        FROM universal_comments
        WHERE comment_id = ${deletableCommentId}
      `

      expect(deleted[0].is_deleted).toBe(true)
      expect(deleted[0].deleted_at).toBeDefined()
      expect(Number(deleted[0].deleted_by)).toBe(Number(testUser.user_id))
    })

    it('should require authentication', async () => {
      if (!deletableCommentId) {
        console.log('Skipping - no test comment available')
        return
      }

      const response = await request(app)
        .delete(`/api/comments/${deletableCommentId}`)
        .expect(401)

      expect(response.body.error).toBe('Access denied')
    })

    it('should reject deleting other user comments (non-admin)', async () => {
      if (!testCard) {
        console.log('Skipping - no test card available')
        return
      }

      // Create another user with unique email/username
      const hashedPassword = await bcrypt.hash('TestPass123!', 12)
      const timestamp = Date.now()
      const otherUser = await prisma.user.create({
        data: {
          email: `other-delete-${timestamp}@test.com`,
          username: `otherdeleteuser${timestamp}`,
          password_hash: hashedPassword,
          name: 'Other User',
          role: 'user',
          is_verified: true,
          is_active: true
        }
      })

      // Create comment by other user
      await prisma.$executeRaw`
        INSERT INTO universal_comments (user_id, comment_type, item_id, comment_text, comment_status)
        VALUES (${otherUser.user_id}, 'card', ${testCard}, 'Other user comment', 'visible')
      `

      const result = await prisma.$queryRaw`
        SELECT TOP 1 comment_id
        FROM universal_comments
        WHERE user_id = ${otherUser.user_id}
        ORDER BY created_at DESC
      `
      const otherCommentId = Number(result[0].comment_id)

      // Try to delete with our user's token
      const response = await request(app)
        .delete(`/api/comments/${otherCommentId}`)
        .set('Authorization', `Bearer ${userToken}`)
        .expect(403)

      expect(response.body.error).toBe('You can only delete your own comments')

      // Cleanup
      await prisma.$executeRaw`DELETE FROM universal_comments WHERE user_id = ${otherUser.user_id}`
      await prisma.user.delete({ where: { user_id: otherUser.user_id } })
    })

    it('should return 404 for non-existent comment', async () => {
      const response = await request(app)
        .delete('/api/comments/999999999')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(404)

      expect(response.body.error).toBe('Comment not found')
    })

    it('should return 404 for already deleted comment', async () => {
      if (!deletableCommentId) {
        console.log('Skipping - no test comment available')
        return
      }

      // Delete once
      await request(app)
        .delete(`/api/comments/${deletableCommentId}`)
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200)

      // Try to delete again
      const response = await request(app)
        .delete(`/api/comments/${deletableCommentId}`)
        .set('Authorization', `Bearer ${userToken}`)
        .expect(404)

      expect(response.body.error).toBe('Comment not found')
    })
  })

  describe('Activity Feeds', () => {
    beforeEach(async () => {
      // Create comments for activity feed tests
      if (testCard && testSeries) {
        await prisma.$executeRaw`
          INSERT INTO universal_comments (user_id, comment_type, item_id, comment_text, comment_status)
          VALUES
            (${testUser.user_id}, 'card', ${testCard}, 'Card comment for activity', 'visible'),
            (${testUser.user_id}, 'series', ${testSeries}, 'Series comment for activity', 'visible')
        `
      }
    })

    afterEach(async () => {
      await prisma.$executeRaw`DELETE FROM universal_comments WHERE user_id = ${testUser.user_id}`
    })

    it('should fetch series activity feed', async () => {
      if (!testSeries) {
        console.log('Skipping - no test series available')
        return
      }

      const response = await request(app)
        .get(`/api/comments/series/${testSeries}/activity`)
        .expect(200)

      expect(response.body.activities).toBeDefined()
      expect(Array.isArray(response.body.activities)).toBe(true)
      expect(response.body.pagination).toBeDefined()
    })

    it('should fetch set activity feed', async () => {
      if (!testSet) {
        console.log('Skipping - no test set available')
        return
      }

      const response = await request(app)
        .get(`/api/comments/set/${testSet}/activity`)
        .expect(200)

      expect(response.body.activities).toBeDefined()
      expect(Array.isArray(response.body.activities)).toBe(true)
      expect(response.body.pagination).toBeDefined()
    })

    it('should paginate activity feeds', async () => {
      if (!testSet) {
        console.log('Skipping - no test set available')
        return
      }

      const response = await request(app)
        .get(`/api/comments/set/${testSet}/activity?page=1&limit=5`)
        .expect(200)

      expect(response.body.pagination.page).toBe(1)
      expect(response.body.pagination.limit).toBe(5)
    })

    it('should serialize activity feed BigInt values', async () => {
      if (!testSeries) {
        console.log('Skipping - no test series available')
        return
      }

      const response = await request(app)
        .get(`/api/comments/series/${testSeries}/activity`)
        .expect(200)

      if (response.body.activities.length > 0) {
        const activity = response.body.activities[0]
        expect(typeof activity.comment_id).toBe('number')
        expect(typeof activity.target_id).toBe('number')
        expect(typeof activity.user.user_id).toBe('number')
      }
    })
  })
})
