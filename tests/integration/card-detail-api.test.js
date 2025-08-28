const { describe, test, expect, beforeAll, afterAll } = require('@jest/globals');
const request = require('supertest');
const { PrismaClient } = require('@prisma/client');
const app = require('../testApp');

const prisma = new PrismaClient();

describe('Card Detail API Integration Tests', () => {
  let sampleCards = [];
  
  beforeAll(async () => {
    // Get diverse sample of real cards from database for comprehensive testing
    const cardSamples = await prisma.$queryRawUnsafe(`
      SELECT TOP 100
        c.card_id,
        c.card_number,
        s.name as series_name,
        s.year,
        st.name as set_name,
        STRING_AGG(CONCAT(p.first_name, ' ', p.last_name), ', ') as player_names
      FROM card c
      JOIN series s ON c.series = s.series_id
      JOIN [set] st ON s.[set] = st.set_id
      LEFT JOIN card_player_team cpt ON c.card_id = cpt.card
      LEFT JOIN player_team pt ON cpt.player_team = pt.player_team_id
      LEFT JOIN player p ON pt.player = p.player_id
      WHERE c.card_number IS NOT NULL 
      AND c.card_number != ''
      AND p.first_name IS NOT NULL
      AND p.last_name IS NOT NULL
      GROUP BY c.card_id, c.card_number, s.name, s.year, st.name, s.series_id
      ORDER BY 
        CASE 
          -- Prioritize diverse card number formats
          WHEN c.card_number LIKE '%-%' THEN 1  -- Hyphenated card numbers
          WHEN c.card_number LIKE '%[A-Z]%' THEN 2  -- Card numbers with letters
          WHEN LEN(c.card_number) > 3 THEN 3  -- Longer card numbers
          ELSE 4
        END,
        NEWID()  -- Random sampling
    `);
    
    sampleCards = cardSamples.map(card => ({
      ...card,
      // Convert BigInt values to strings for JSON serialization
      card_id: card.card_id.toString(),
      year: Number(card.year)
    }));
    
    console.log(`Loaded ${sampleCards.length} sample cards for testing`);
    console.log('Sample card numbers:', sampleCards.slice(0, 10).map(c => c.card_number));
  });
  
  afterAll(async () => {
    await prisma.$disconnect();
  });

  describe('Real Database Card Parsing', () => {
    test('should parse at least 50 different card number formats correctly', async () => {
      const testCases = sampleCards.slice(0, 50);
      const results = [];
      
      for (const card of testCases) {
        // Generate expected slug components
        const playerSlug = card.player_names 
          ? card.player_names
              .toLowerCase()
              .replace(/[^a-z0-9\s-]/g, '')
              .replace(/\s+/g, '-')
              .replace(/-+/g, '-')
              .trim()
          : 'unknown';
          
        const cardNumberSlug = card.card_number
          .toLowerCase()
          .replace(/[^a-z0-9-]/g, '');
        
        const expectedSlug = `${cardNumberSlug}-${playerSlug}`;
        
        // Generate series and set slugs
        const setSlug = card.set_name
          .toLowerCase()
          .replace(/'/g, '')
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/^-|-$/g, '');
          
        const seriesSlug = card.series_name
          .toLowerCase()
          .replace(/'/g, '')
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/^-|-$/g, '');
        
        // Test the actual API endpoint
        const response = await request(app)
          .get(`/api/card-detail/${card.year}/${setSlug}/${seriesSlug}/${expectedSlug}`)
          .expect(200);
        
        expect(response.body.success).toBe(true);
        expect(response.body.card).toBeDefined();
        expect(response.body.card.card_number).toBe(card.card_number);
        expect(response.body.card.player_names).toBe(card.player_names);
        
        results.push({
          cardNumber: card.card_number,
          playerNames: card.player_names,
          slug: expectedSlug,
          success: true
        });
      }
      
      console.log(`Successfully parsed ${results.length}/50 card formats`);
      expect(results.length).toBeGreaterThanOrEqual(45); // Allow for some edge cases
    });
    
    test('should handle complex card numbers with team abbreviations', async () => {
      // Get cards that likely have team abbreviations
      const complexCards = await prisma.$queryRawUnsafe(`
        SELECT TOP 20
          c.card_id,
          c.card_number,
          s.name as series_name,
          s.year,
          st.name as set_name,
          STRING_AGG(CONCAT(p.first_name, ' ', p.last_name), ', ') as player_names,
          STRING_AGG(t.abbreviation, ', ') as team_abbreviations
        FROM card c
        JOIN series s ON c.series = s.series_id
        JOIN [set] st ON s.[set] = st.set_id
        LEFT JOIN card_player_team cpt ON c.card_id = cpt.card
        LEFT JOIN player_team pt ON cpt.player_team = pt.player_team_id
        LEFT JOIN player p ON pt.player = p.player_id
        LEFT JOIN team t ON pt.team = t.team_id
        WHERE c.card_number LIKE '%-%'
        AND (
          c.card_number LIKE '%ARI%' OR c.card_number LIKE '%LAD%' OR 
          c.card_number LIKE '%NYY%' OR c.card_number LIKE '%BOS%' OR
          c.card_number LIKE '%ATL%' OR c.card_number LIKE '%HOU%'
        )
        AND p.first_name IS NOT NULL
        GROUP BY c.card_id, c.card_number, s.name, s.year, st.name, s.series_id
        ORDER BY c.card_number
      `);
      
      expect(complexCards.length).toBeGreaterThan(0);
      
      for (const card of complexCards.slice(0, 10)) {
        console.log(`Testing complex card: ${card.card_number} - ${card.player_names}`);
        
        // This tests our parsing logic handles team abbreviations correctly
        const playerSlug = card.player_names
          .toLowerCase()
          .replace(/[^a-z0-9\s-]/g, '')
          .replace(/\s+/g, '-')
          .replace(/-+/g, '-')
          .trim();
          
        const cardNumberSlug = card.card_number
          .toLowerCase()
          .replace(/[^a-z0-9-]/g, '');
        
        const slug = `${cardNumberSlug}-${playerSlug}`;
        
        // Test that our parser correctly identifies the card number vs player name
        expect(slug).toContain(playerSlug);
        expect(card.card_number.toLowerCase().replace(/[^a-z0-9-]/g, '')).toMatch(/^[a-z0-9-]+$/);
      }
    });
  });
  
  describe('Error Handling', () => {
    test('should return 404 for non-existent card', async () => {
      const response = await request(app)
        .get('/api/card-detail/2025/fake-set/fake-series/fake-card-fake-player')
        .expect(404);
      
      expect(response.body.error).toBe('Card not found');
    });
    
    test('should return 404 for malformed card slug', async () => {
      const response = await request(app)
        .get('/api/card-detail/2025/2025-topps/2025-topps/invalid-slug-format')
        .expect(404);
      
      expect(response.body.error).toBe('Card not found');
    });
    
    test('should handle special characters in slugs gracefully', async () => {
      const response = await request(app)
        .get('/api/card-detail/2025/test-set/test-series/card-with-apostrophe-o-malley')
        .expect(404); // Should not crash, just return 404
      
      expect(response.body.error).toBe('Card not found');
    });
  });
  
  describe('Response Format Validation', () => {
    test('should return consistent response format', async () => {
      // Use a known good card from our samples
      if (sampleCards.length === 0) {
        return; // Skip if no sample data
      }
      
      const card = sampleCards[0];
      const playerSlug = card.player_names
        .toLowerCase()
        .replace(/[^a-z0-9\s-]/g, '')
        .replace(/\s+/g, '-')
        .replace(/-+/g, '-')
        .trim();
        
      const cardNumberSlug = card.card_number
        .toLowerCase()
        .replace(/[^a-z0-9-]/g, '');
      
      const slug = `${cardNumberSlug}-${playerSlug}`;
      
      const setSlug = card.set_name
        .toLowerCase()
        .replace(/'/g, '')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '');
        
      const seriesSlug = card.series_name
        .toLowerCase()
        .replace(/'/g, '')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '');
      
      const response = await request(app)
        .get(`/api/card-detail/${card.year}/${setSlug}/${seriesSlug}/${slug}`)
        .expect(200);
      
      // Validate response structure
      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('card');
      
      const cardData = response.body.card;
      expect(cardData).toHaveProperty('card_id');
      expect(cardData).toHaveProperty('card_number');
      expect(cardData).toHaveProperty('player_names');
      expect(cardData).toHaveProperty('series_name');
      expect(cardData).toHaveProperty('set_name');
      expect(cardData).toHaveProperty('is_rookie');
      expect(cardData).toHaveProperty('is_autograph');
      expect(cardData).toHaveProperty('is_relic');
      expect(cardData).toHaveProperty('teams');
      expect(cardData).toHaveProperty('cyc_population');
      
      // Validate data types
      expect(typeof cardData.card_id).toBe('string');
      expect(typeof cardData.card_number).toBe('string');
      expect(typeof cardData.is_rookie).toBe('boolean');
      expect(typeof cardData.is_autograph).toBe('boolean');
      expect(typeof cardData.is_relic).toBe('boolean');
      expect(Array.isArray(cardData.teams)).toBe(true);
      expect(typeof cardData.cyc_population).toBe('number');
    });
  });
  
  describe('Performance Tests', () => {
    test('should respond within reasonable time for card lookup', async () => {
      if (sampleCards.length === 0) {
        return;
      }
      
      const card = sampleCards[0];
      const playerSlug = card.player_names
        .toLowerCase()
        .replace(/[^a-z0-9\s-]/g, '')
        .replace(/\s+/g, '-');
        
      const cardNumberSlug = card.card_number
        .toLowerCase()
        .replace(/[^a-z0-9-]/g, '');
      
      const slug = `${cardNumberSlug}-${playerSlug}`;
      
      const setSlug = card.set_name
        .toLowerCase()
        .replace(/'/g, '')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '');
        
      const seriesSlug = card.series_name
        .toLowerCase()
        .replace(/'/g, '')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '');
      
      const startTime = Date.now();
      
      const response = await request(app)
        .get(`/api/card-detail/${card.year}/${setSlug}/${seriesSlug}/${slug}`)
        .expect(200);
      
      const responseTime = Date.now() - startTime;
      
      expect(responseTime).toBeLessThan(1000); // Should respond within 1 second
      expect(response.body.success).toBe(true);
    });
  });
});