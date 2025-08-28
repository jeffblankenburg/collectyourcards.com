const { describe, test, expect, beforeAll, afterAll } = require('@jest/globals');
const request = require('supertest');
const { PrismaClient } = require('@prisma/client');
const app = require('../testApp');

const prisma = new PrismaClient();

describe('Card Navigation Integration Tests', () => {
  let testSeries = [];
  let testCards = [];
  
  beforeAll(async () => {
    // Get sample series with cards for navigation testing
    const seriesData = await prisma.$queryRawUnsafe(`
      SELECT TOP 10
        s.series_id,
        s.name as series_name,
        s.year,
        st.name as set_name,
        COUNT(c.card_id) as card_count
      FROM series s
      JOIN [set] st ON s.[set] = st.set_id
      JOIN card c ON s.series_id = c.series
      GROUP BY s.series_id, s.name, s.year, st.name
      HAVING COUNT(c.card_id) >= 5  -- Ensure we have multiple cards to test navigation
      ORDER BY s.year DESC, s.series_id
    `);
    
    testSeries = seriesData.map(s => ({
      ...s,
      series_id: Number(s.series_id),
      year: Number(s.year),
      card_count: Number(s.card_count)
    }));
    
    if (testSeries.length > 0) {
      // Get cards from the first test series
      const cardsData = await prisma.$queryRawUnsafe(`
        SELECT TOP 20
          c.card_id,
          c.card_number,
          c.sort_order,
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
        WHERE s.series_id = ${testSeries[0].series_id}
        AND c.card_number IS NOT NULL
        AND p.first_name IS NOT NULL
        AND p.last_name IS NOT NULL
        GROUP BY c.card_id, c.card_number, c.sort_order, s.name, s.year, st.name
        ORDER BY c.sort_order, c.card_number
      `);
      
      testCards = cardsData.map(c => ({
        ...c,
        card_id: Number(c.card_id),
        year: Number(c.year),
        sort_order: c.sort_order ? Number(c.sort_order) : null
      }));
    }
    
    console.log(`Loaded ${testSeries.length} test series and ${testCards.length} test cards`);
  });
  
  afterAll(async () => {
    await prisma.$disconnect();
  });

  describe('Series to Card Navigation Flow', () => {
    test('should generate valid card detail URLs from series cards', () => {
      if (testCards.length === 0) {
        console.log('Skipping navigation tests - no test data available');
        return;
      }
      
      testCards.slice(0, 10).forEach(card => {
        // This mimics the slug generation logic from SeriesDetail.jsx
        const playerNames = card.player_names || 'unknown';
        
        const cardNumberSlug = card.card_number ? 
          card.card_number.toLowerCase().replace(/[^a-z0-9-]/g, '') : 'unknown';
        
        const cardSlug = `${cardNumberSlug}-${playerNames
          .toLowerCase()
          .replace(/[^a-z0-9\s-]/g, '')
          .replace(/\s+/g, '-')
          .replace(/-+/g, '-')
          .trim()}`;
        
        // Validate slug format
        expect(cardSlug).toMatch(/^[a-z0-9-]+$/);
        expect(cardSlug).not.toMatch(/^-|-$/); // Should not start or end with dash
        expect(cardSlug).not.toMatch(/--/); // Should not have double dashes
        
        console.log(`Card ${card.card_number} (${card.player_names}) -> ${cardSlug}`);
      });
    });
    
    test('should successfully navigate from series API to card detail API', async () => {
      if (testSeries.length === 0 || testCards.length === 0) {
        console.log('Skipping navigation test - no test data available');
        return;
      }
      
      const testSerie = testSeries[0];
      const testCard = testCards[0];
      
      // Step 1: Get series cards (this is what UniversalCardTable does)
      const seriesResponse = await request(app)
        .get(`/api/cards?series_id=${testSerie.series_id}&limit=100`)
        .expect(200);
      
      expect(seriesResponse.body.cards).toBeDefined();
      expect(seriesResponse.body.cards.length).toBeGreaterThan(0);
      
      // Find our test card in the series response
      const seriesCard = seriesResponse.body.cards.find(c => 
        c.card_number === testCard.card_number
      );
      
      expect(seriesCard).toBeDefined();
      expect(seriesCard).toHaveProperty('card_player_teams');
      
      // Step 2: Generate navigation URL (mimics handleCardClick)
      const playerNames = seriesCard.card_player_teams?.map(cpt => 
        `${cpt.player?.first_name || ''} ${cpt.player?.last_name || ''}`.trim()
      ).filter(name => name).join(', ') || 'unknown';
      
      const cardNumberSlug = seriesCard.card_number ? 
        seriesCard.card_number.toLowerCase().replace(/[^a-z0-9-]/g, '') : 'unknown';
      
      const cardSlug = `${cardNumberSlug}-${playerNames
        .toLowerCase()
        .replace(/[^a-z0-9\s-]/g, '')
        .replace(/\s+/g, '-')
        .replace(/-+/g, '-')
        .trim()}`;
      
      // Generate series and set slugs
      const setSlug = testSerie.set_name
        .toLowerCase()
        .replace(/'/g, '')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '');
        
      const seriesSlug = testSerie.series_name
        .toLowerCase()
        .replace(/'/g, '')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '');
      
      // Step 3: Test card detail API with generated URL
      const cardDetailResponse = await request(app)
        .get(`/api/card-detail/${testSerie.year}/${setSlug}/${seriesSlug}/${cardSlug}`)
        .expect(200);
      
      // Step 4: Validate the response matches our expectations
      expect(cardDetailResponse.body.success).toBe(true);
      expect(cardDetailResponse.body.card.card_number).toBe(testCard.card_number);
      expect(cardDetailResponse.body.card.player_names).toBe(testCard.player_names);
      expect(cardDetailResponse.body.card.series_name).toBe(testSerie.series_name);
      
      console.log(`✅ Successfully navigated: ${testCard.card_number} -> ${cardSlug}`);
    });
    
    test('should handle navigation for multiple card formats in same series', async () => {
      if (testCards.length < 5) {
        console.log('Skipping multi-card test - insufficient test data');
        return;
      }
      
      const testSerie = testSeries[0];
      const multipleCards = testCards.slice(0, 5);
      
      const results = [];
      
      for (const card of multipleCards) {
        // Generate URL components
        const playerSlug = (card.player_names || 'unknown')
          .toLowerCase()
          .replace(/[^a-z0-9\s-]/g, '')
          .replace(/\s+/g, '-')
          .replace(/-+/g, '-')
          .trim();
        
        const cardNumberSlug = card.card_number
          .toLowerCase()
          .replace(/[^a-z0-9-]/g, '');
        
        const cardSlug = `${cardNumberSlug}-${playerSlug}`;
        
        const setSlug = testSerie.set_name
          .toLowerCase()
          .replace(/'/g, '')
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/^-|-$/g, '');
          
        const seriesSlug = testSerie.series_name
          .toLowerCase()
          .replace(/'/g, '')
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/^-|-$/g, '');
        
        // Test navigation
        try {
          const response = await request(app)
            .get(`/api/card-detail/${testSerie.year}/${setSlug}/${seriesSlug}/${cardSlug}`)
            .expect(200);
          
          results.push({
            cardNumber: card.card_number,
            slug: cardSlug,
            success: true,
            responseValid: response.body.success === true
          });
        } catch (error) {
          results.push({
            cardNumber: card.card_number,
            slug: cardSlug,
            success: false,
            error: error.message
          });
        }
      }
      
      // All cards should navigate successfully
      const successfulNavigations = results.filter(r => r.success).length;
      console.log(`Navigation success rate: ${successfulNavigations}/${results.length}`);
      
      // Print any failures for debugging
      results.filter(r => !r.success).forEach(result => {
        console.error(`❌ Failed navigation: ${result.cardNumber} -> ${result.slug}: ${result.error}`);
      });
      
      expect(successfulNavigations).toBe(results.length); // All should succeed
    });
  });
  
  describe('URL Slug Generation Consistency', () => {
    test('should generate identical slugs from card data regardless of source', async () => {
      if (testCards.length === 0) {
        return;
      }
      
      const testCard = testCards[0];
      
      // Method 1: From series cards API (UniversalCardTable data)
      const seriesResponse = await request(app)
        .get(`/api/cards?series_id=${testSeries[0].series_id}&limit=100`)
        .expect(200);
      
      const seriesCard = seriesResponse.body.cards.find(c => 
        c.card_number === testCard.card_number
      );
      
      const playersFromSeries = seriesCard.card_player_teams?.map(cpt => 
        `${cpt.player?.first_name || ''} ${cpt.player?.last_name || ''}`.trim()
      ).filter(name => name).join(', ') || 'unknown';
      
      const slugFromSeries = `${testCard.card_number.toLowerCase().replace(/[^a-z0-9-]/g, '')}-${playersFromSeries
        .toLowerCase()
        .replace(/[^a-z0-9\s-]/g, '')
        .replace(/\s+/g, '-')
        .replace(/-+/g, '-')
        .trim()}`;
      
      // Method 2: From direct card data (our test data)
      const slugFromDirect = `${testCard.card_number.toLowerCase().replace(/[^a-z0-9-]/g, '')}-${testCard.player_names
        .toLowerCase()
        .replace(/[^a-z0-9\s-]/g, '')
        .replace(/\s+/g, '-')
        .replace(/-+/g, '-')
        .trim()}`;
      
      // They should be identical
      expect(slugFromSeries).toBe(slugFromDirect);
      
      console.log(`Slug consistency verified: ${slugFromSeries}`);
    });
  });
  
  describe('Edge Cases and Error Recovery', () => {
    test('should handle cards with special characters in names gracefully', async () => {
      // Find cards with apostrophes, accents, or other special characters
      const specialCards = await prisma.$queryRawUnsafe(`
        SELECT TOP 10
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
        WHERE (p.first_name LIKE '%''%' OR p.last_name LIKE '%''%' 
               OR p.first_name LIKE '%é%' OR p.last_name LIKE '%é%'
               OR p.first_name LIKE '%ñ%' OR p.last_name LIKE '%ñ%')
        AND c.card_number IS NOT NULL
        GROUP BY c.card_id, c.card_number, s.name, s.year, st.name
        ORDER BY c.card_number
      `);
      
      for (const card of specialCards) {
        // Generate slug with special character handling
        const playerSlug = card.player_names
          .toLowerCase()
          .replace(/[^a-z0-9\s-]/g, '') // This should strip special characters
          .replace(/\s+/g, '-')
          .replace(/-+/g, '-')
          .trim();
        
        const cardNumberSlug = card.card_number
          .toLowerCase()
          .replace(/[^a-z0-9-]/g, '');
        
        const cardSlug = `${cardNumberSlug}-${playerSlug}`;
        
        // Validate that slug contains only safe characters
        expect(cardSlug).toMatch(/^[a-z0-9-]+$/);
        
        console.log(`Special character handling: "${card.player_names}" -> "${playerSlug}"`);
      }
    });
  });
});