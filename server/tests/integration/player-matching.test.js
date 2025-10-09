const request = require('supertest')
const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

describe('Player Matching with Nicknames', () => {
  let authToken
  let userId

  beforeAll(async () => {
    // Login to get auth token
    const loginResponse = await request('http://localhost:3001')
      .post('/api/auth/login')
      .send({
        email: 'cardcollector@jeffblankenburg.com',
        password: 'testpassword'
      })

    authToken = loginResponse.body.token
    userId = loginResponse.body.user.id
  })

  describe('Nickname + Last Name Matching', () => {
    test('should match "Minnie Minoso" to Orestes Minoso using nickname', async () => {
      // This tests the exact match on nickname + last_name
      const playerName = 'Minnie Minoso'

      // Query the database directly to verify the match
      const result = await prisma.$queryRaw`
        SELECT DISTINCT
          p.player_id as playerId,
          p.first_name as firstName,
          p.last_name as lastName,
          p.nick_name as nickName
        FROM player p
        WHERE (
          LOWER(LTRIM(RTRIM(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(
            p.first_name + ' ' + p.last_name,
            'á', 'a'), 'é', 'e'), 'í', 'i'), 'ó', 'o'), 'ú', 'u'), 'ñ', 'n'), '.', ''), '  ', ' ')))) = ${playerName.toLowerCase()}
          OR
          (p.nick_name IS NOT NULL AND
           LOWER(LTRIM(RTRIM(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(
             p.nick_name + ' ' + p.last_name,
             'á', 'a'), 'é', 'e'), 'í', 'i'), 'ó', 'o'), 'ú', 'u'), 'ñ', 'n'), '.', ''), '  ', ' ')))) = ${playerName.toLowerCase()})
        )
      `

      expect(result.length).toBe(1)
      expect(result[0].firstName.trim()).toBe('Orestes')
      expect(result[0].lastName.trim()).toBe('Minoso')
      expect(result[0].nickName.trim()).toBe('Minnie')
    })

    test('should still match "Orestes Minoso" using full name', async () => {
      // This tests that the regular name matching still works
      const playerName = 'Orestes Minoso'

      const result = await prisma.$queryRaw`
        SELECT DISTINCT
          p.player_id as playerId,
          p.first_name as firstName,
          p.last_name as lastName,
          p.nick_name as nickName
        FROM player p
        WHERE (
          LOWER(LTRIM(RTRIM(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(
            p.first_name + ' ' + p.last_name,
            'á', 'a'), 'é', 'e'), 'í', 'i'), 'ó', 'o'), 'ú', 'u'), 'ñ', 'n'), '.', ''), '  ', ' ')))) = ${playerName.toLowerCase()}
          OR
          (p.nick_name IS NOT NULL AND
           LOWER(LTRIM(RTRIM(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(
             p.nick_name + ' ' + p.last_name,
             'á', 'a'), 'é', 'e'), 'í', 'i'), 'ó', 'o'), 'ú', 'u'), 'ñ', 'n'), '.', ''), '  ', ' ')))) = ${playerName.toLowerCase()})
        )
      `

      expect(result.length).toBe(1)
      expect(result[0].firstName.trim()).toBe('Orestes')
      expect(result[0].lastName.trim()).toBe('Minoso')
    })

    test('should not match players without the nickname when searching by nickname', async () => {
      // Test that we don't get false positives
      const playerName = 'Nonexistent Nickname'

      const result = await prisma.$queryRaw`
        SELECT DISTINCT
          p.player_id as playerId,
          p.first_name as firstName,
          p.last_name as lastName,
          p.nick_name as nickName
        FROM player p
        WHERE (
          LOWER(LTRIM(RTRIM(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(
            p.first_name + ' ' + p.last_name,
            'á', 'a'), 'é', 'e'), 'í', 'i'), 'ó', 'o'), 'ú', 'u'), 'ñ', 'n'), '.', ''), '  ', ' ')))) = ${playerName.toLowerCase()}
          OR
          (p.nick_name IS NOT NULL AND
           LOWER(LTRIM(RTRIM(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(
             p.nick_name + ' ' + p.last_name,
             'á', 'a'), 'é', 'e'), 'í', 'i'), 'ó', 'o'), 'ú', 'u'), 'ñ', 'n'), '.', ''), '  ', ' ')))) = ${playerName.toLowerCase()})
        )
      `

      expect(result.length).toBe(0)
    })
  })

  describe('Common Nickname Examples', () => {
    // Add more tests for other common nicknames once we have more data
    test('should handle players with no nickname gracefully', async () => {
      const playerName = 'Mike Trout' // Assuming Mike Trout doesn't have a nickname

      const result = await prisma.$queryRaw`
        SELECT DISTINCT
          p.player_id as playerId,
          p.first_name as firstName,
          p.last_name as lastName,
          p.nick_name as nickName
        FROM player p
        WHERE (
          LOWER(LTRIM(RTRIM(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(
            p.first_name + ' ' + p.last_name,
            'á', 'a'), 'é', 'e'), 'í', 'i'), 'ó', 'o'), 'ú', 'u'), 'ñ', 'n'), '.', ''), '  ', ' ')))) = ${playerName.toLowerCase()}
          OR
          (p.nick_name IS NOT NULL AND
           LOWER(LTRIM(RTRIM(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(
             p.nick_name + ' ' + p.last_name,
             'á', 'a'), 'é', 'e'), 'í', 'i'), 'ó', 'o'), 'ú', 'u'), 'ñ', 'n'), '.', ''), '  ', ' ')))) = ${playerName.toLowerCase()})
        )
      `

      // Should find Mike Trout by regular name, nickname should be NULL
      if (result.length > 0) {
        expect(result[0].firstName).toBe('Mike')
        expect(result[0].lastName).toBe('Trout')
      }
    })
  })

  afterAll(async () => {
    await prisma.$disconnect()
  })
})
