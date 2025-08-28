const { describe, test, expect, beforeAll, afterAll } = require('@jest/globals');
const request = require('supertest');
const { PrismaClient } = require('@prisma/client');
const app = require('../testApp');

const prisma = new PrismaClient();

describe('User Cards API Integration Tests', () => {
  let authToken;
  let testUser;
  let testCards = [];
  let userCards = [];
  
  beforeAll(async () => {
    // Create test user and authenticate
    const userData = {
      email: 'test-user-cards@example.com',
      password: 'TestPassword123!',
      name: 'Test User Cards'
    };
    
    // Register user
    const registerResponse = await request(app)
      .post('/api/auth/register')
      .send(userData)
      .expect(201);
    
    testUser = registerResponse.body.user;
    authToken = registerResponse.body.token;
    
    // Get sample cards for testing
    const sampleCardsData = await prisma.$queryRawUnsafe(`
      SELECT TOP 20
        c.card_id,
        c.card_number,
        s.series_id,
        s.name as series_name,
        st.name as set_name
      FROM card c
      JOIN series s ON c.series = s.series_id
      JOIN [set] st ON s.[set] = st.set_id
      WHERE c.card_number IS NOT NULL
      ORDER BY NEWID()
    `);
    
    testCards = sampleCardsData.map(c => ({
      ...c,
      card_id: Number(c.card_id),
      series_id: Number(c.series_id)
    }));
    
    // Add some test cards to user's collection
    for (let i = 0; i < 5; i++) {
      const card = testCards[i];
      if (!card) continue;
      
      await prisma.$queryRawUnsafe(`
        INSERT INTO user_card ([user], card, random_code, created)
        VALUES (${testUser.user_id}, ${card.card_id}, 'TC${i + 1}', GETDATE())
      `);
      
      userCards.push({
        card_id: card.card_id,
        card_number: card.card_number,
        random_code: `TC${i + 1}`
      });
    }
    
    console.log(`Created test user and added ${userCards.length} cards to collection`);
  });
  
  afterAll(async () => {
    // Cleanup: Remove test user and their cards
    if (testUser) {
      await prisma.$queryRawUnsafe(`DELETE FROM user_card WHERE [user] = ${testUser.user_id}`);
      await prisma.$queryRawUnsafe(`DELETE FROM [user] WHERE user_id = ${testUser.user_id}`);
    }
    await prisma.$disconnect();
  });

  describe('GET /api/user/cards/:cardId - Get user copies of specific card', () => {
    test('should return user cards for a card they own', async () => {
      const testCard = userCards[0];
      
      const response = await request(app)
        .get(`/api/user/cards/${testCard.card_id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);
      
      expect(response.body.cards).toBeDefined();
      expect(response.body.total).toBeGreaterThan(0);
      expect(response.body.cards.length).toBe(1);
      
      const userCard = response.body.cards[0];
      expect(userCard.card_id).toBe(testCard.card_id);
      expect(userCard.card_number).toBe(testCard.card_number);
      expect(userCard.random_code).toBe(testCard.random_code);
      
      // Validate data structure matches UniversalCardTable expectations
      expect(userCard).toHaveProperty('user_card_id');
      expect(userCard).toHaveProperty('date_added');
      expect(userCard).toHaveProperty('series_rel');
      expect(userCard).toHaveProperty('card_player_teams');
      
      // Validate series relationship
      expect(userCard.series_rel).toHaveProperty('series_id');
      expect(userCard.series_rel).toHaveProperty('name');
      
      // Validate card_player_teams structure
      expect(Array.isArray(userCard.card_player_teams)).toBe(true);
      
      console.log(`✅ User card data structure validated for card ${testCard.card_number}`);
    });
    
    test('should return empty array for card user does not own', async () => {
      // Use a card that's not in the user's collection
      const nonOwnedCard = testCards.find(c => 
        !userCards.some(uc => uc.card_id === c.card_id)
      );
      
      if (!nonOwnedCard) {
        console.log('Skipping non-owned card test - insufficient test data');
        return;
      }
      
      const response = await request(app)
        .get(`/api/user/cards/${nonOwnedCard.card_id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);
      
      expect(response.body.cards).toBeDefined();
      expect(response.body.total).toBe(0);
      expect(response.body.cards.length).toBe(0);
    });
    
    test('should require authentication', async () => {
      const testCard = userCards[0];
      
      const response = await request(app)
        .get(`/api/user/cards/${testCard.card_id}`)
        .expect(401);
      
      expect(response.body.error).toBe('Authentication error');
    });
    
    test('should handle invalid card ID gracefully', async () => {
      const response = await request(app)
        .get('/api/user/cards/999999999')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);
      
      expect(response.body.cards).toBeDefined();
      expect(response.body.total).toBe(0);
      expect(response.body.cards.length).toBe(0);
    });
    
    test('should handle BigInt serialization correctly', async () => {
      const testCard = userCards[0];
      
      const response = await request(app)
        .get(`/api/user/cards/${testCard.card_id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);
      
      const userCard = response.body.cards[0];
      
      // All numeric fields should be properly serialized (not BigInt objects)
      expect(typeof userCard.user_card_id).toBe('number');
      expect(typeof userCard.card_id).toBe('number');
      expect(typeof userCard.series_rel.series_id).toBe('number');
      
      // Should not contain BigInt artifacts in JSON
      const jsonString = JSON.stringify(response.body);
      expect(jsonString).not.toContain('BigInt');
      expect(jsonString).not.toContain('[object Object]');
    });
    
    test('should return consistent data format with collection API', async () => {
      const testCard = userCards[0];
      
      // Get data from user cards endpoint
      const userCardResponse = await request(app)
        .get(`/api/user/cards/${testCard.card_id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);
      
      // Get data from collection endpoint  
      const collectionResponse = await request(app)
        .get('/api/user/collection/cards')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);
      
      const userCardData = userCardResponse.body.cards[0];
      const collectionCardData = collectionResponse.body.cards.find(c => 
        c.card_id === testCard.card_id
      );
      
      if (collectionCardData) {
        // Key fields should match
        expect(userCardData.card_id).toBe(collectionCardData.card_id);
        expect(userCardData.card_number).toBe(collectionCardData.card_number);
        expect(userCardData.random_code).toBe(collectionCardData.random_code);
        expect(userCardData.user_card_id).toBe(collectionCardData.user_card_id);
        
        console.log('✅ Data consistency verified between user cards and collection APIs');
      }
    });
  });
  
  describe('Data Structure Validation for UniversalCardTable', () => {
    test('should provide all required fields for UniversalCardTable rendering', async () => {
      const testCard = userCards[0];
      
      const response = await request(app)
        .get(`/api/user/cards/${testCard.card_id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);
      
      const userCard = response.body.cards[0];
      
      // Required fields for UniversalCardTable display
      const requiredFields = [
        'user_card_id',
        'card_id', 
        'card_number',
        'random_code',
        'date_added',
        'is_rookie',
        'is_autograph', 
        'is_relic',
        'series_rel',
        'card_player_teams'
      ];
      
      requiredFields.forEach(field => {
        expect(userCard).toHaveProperty(field);
        console.log(`✓ Field '${field}' present: ${typeof userCard[field]}`);
      });
      
      // Validate nested structures
      if (userCard.series_rel) {
        expect(userCard.series_rel).toHaveProperty('name');
        expect(userCard.series_rel).toHaveProperty('series_id');
      }
      
      if (userCard.card_player_teams && userCard.card_player_teams.length > 0) {
        const playerTeam = userCard.card_player_teams[0];
        expect(playerTeam).toHaveProperty('player');
        expect(playerTeam).toHaveProperty('team');
        
        if (playerTeam.player) {
          expect(playerTeam.player).toHaveProperty('name');
          expect(playerTeam.player).toHaveProperty('first_name');
          expect(playerTeam.player).toHaveProperty('last_name');
        }
        
        if (playerTeam.team) {
          expect(playerTeam.team).toHaveProperty('name');
          expect(playerTeam.team).toHaveProperty('abbreviation');
        }
      }
    });
    
    test('should handle cards with multiple player-team associations', async () => {
      // Find a card with multiple players (multi-player cards)
      const multiPlayerCardData = await prisma.$queryRawUnsafe(`
        SELECT TOP 1
          c.card_id,
          COUNT(DISTINCT pt.player) as player_count
        FROM card c
        JOIN card_player_team cpt ON c.card_id = cpt.card
        JOIN player_team pt ON cpt.player_team = pt.player_team_id
        WHERE c.card_id IN (${userCards.map(uc => uc.card_id).join(',')})
        GROUP BY c.card_id
        HAVING COUNT(DISTINCT pt.player) > 1
        ORDER BY COUNT(DISTINCT pt.player) DESC
      `);
      
      if (multiPlayerCardData.length === 0) {
        console.log('No multi-player cards in test collection - skipping test');
        return;
      }
      
      const multiPlayerCard = multiPlayerCardData[0];
      
      const response = await request(app)
        .get(`/api/user/cards/${multiPlayerCard.card_id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);
      
      const userCard = response.body.cards[0];
      
      expect(userCard.card_player_teams).toBeDefined();
      expect(userCard.card_player_teams.length).toBeGreaterThan(1);
      
      console.log(`✅ Multi-player card handling verified: ${userCard.card_player_teams.length} players`);
    });
  });
  
  describe('Performance and Error Handling', () => {
    test('should respond quickly for user card lookup', async () => {
      const testCard = userCards[0];
      const startTime = Date.now();
      
      const response = await request(app)
        .get(`/api/user/cards/${testCard.card_id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);
      
      const responseTime = Date.now() - startTime;
      
      expect(responseTime).toBeLessThan(500); // Should respond within 500ms
      expect(response.body.cards).toBeDefined();
      
      console.log(`Response time: ${responseTime}ms`);
    });
    
    test('should handle malformed card ID gracefully', async () => {
      const response = await request(app)
        .get('/api/user/cards/not-a-number')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200); // Should not crash
      
      expect(response.body.cards).toBeDefined();
      expect(response.body.total).toBe(0);
    });
    
    test('should handle concurrent requests correctly', async () => {
      const testCard = userCards[0];
      
      // Make multiple concurrent requests
      const promises = Array(5).fill().map(() => 
        request(app)
          .get(`/api/user/cards/${testCard.card_id}`)
          .set('Authorization', `Bearer ${authToken}`)
      );
      
      const responses = await Promise.all(promises);
      
      // All responses should be identical
      responses.forEach(response => {
        expect(response.status).toBe(200);
        expect(response.body.total).toBe(1);
        expect(response.body.cards[0].card_id).toBe(testCard.card_id);
      });
      
      console.log('✅ Concurrent request handling verified');
    });
  });
});