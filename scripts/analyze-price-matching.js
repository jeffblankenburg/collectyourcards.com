/**
 * Test matching our cards to SportsCardsPro API
 * Uses sportscardspro.com endpoint (not pricecharting.com!)
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const API_TOKEN = 'd6b97b8ef762cb2c5a2f781c4dbf51e3fdf28547';
const API_BASE = 'https://www.sportscardspro.com/api';

const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function searchSCP(query) {
  const url = `${API_BASE}/products?q=${encodeURIComponent(query)}&t=${API_TOKEN}`;
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`API error: ${response.status}`);
  }
  return response.json();
}

// Extract parallel name from SCP product name: "Aaron Judge [Gold Refractor] #99" -> "Gold Refractor"
function extractParallel(productName) {
  const match = productName.match(/\[([^\]]+)\]/);
  return match ? match[1] : null;  // null = base card
}

// Normalize parallel names for comparison
function normalizeParallel(name) {
  if (!name) return '';
  return name
    .toLowerCase()
    .replace(/s$/, '')           // Remove trailing 's' (Refractors -> Refractor)
    .replace(/\s+/g, ' ')        // Normalize whitespace
    .trim();
}

// Check if our series name matches SCP parallel
function parallelsMatch(ourSeriesName, scpParallel, setName) {
  // Extract just the parallel part from our series name
  // "2025 Topps Chrome Gold Refractors" -> "Gold Refractors"
  let ourParallel = ourSeriesName.replace(setName + ' ', '');

  // Handle base set
  if (ourParallel === setName || ourParallel === ourSeriesName) {
    // This is the base set - match products without brackets
    return scpParallel === null;
  }

  const ourNorm = normalizeParallel(ourParallel);
  const scpNorm = normalizeParallel(scpParallel);

  // Direct match
  if (ourNorm === scpNorm) return true;

  // Partial matches
  if (ourNorm.includes(scpNorm) || scpNorm.includes(ourNorm)) return true;

  return false;
}

async function analyze() {
  console.log('='.repeat(70));
  console.log('SPORTSCARDSPRO MATCHING TEST (sportscardspro.com API)');
  console.log('='.repeat(70));

  // Get sample cards from 2025 Topps Chrome base set parallels only
  const sampleCards = await prisma.$queryRaw`
    SELECT TOP 30
      c.card_id,
      c.card_number,
      s.name as series_name,
      st.name as set_name,
      st.year,
      STRING_AGG(CONCAT(p.first_name, ' ', p.last_name), ' / ') as player_names
    FROM card c
    JOIN series s ON c.series = s.series_id
    JOIN [set] st ON s.[set] = st.set_id
    LEFT JOIN card_player_team cpt ON c.card_id = cpt.card
    LEFT JOIN player_team pt ON cpt.player_team = pt.player_team_id
    LEFT JOIN player p ON pt.player = p.player_id
    WHERE st.set_id = 1821
      AND c.card_number IS NOT NULL
      AND c.card_number != ''
      AND s.name NOT LIKE '%Autograph%'
      AND s.name NOT LIKE '%''90 Topps%'
      AND s.name NOT LIKE '%All-Etch%'
      AND s.name NOT LIKE '%Future Stars%'
      AND s.name NOT LIKE '%Buyback%'
    GROUP BY c.card_id, c.card_number, s.name, s.series_id, st.name, st.year
    ORDER BY NEWID()
  `;

  console.log(`\nTesting ${sampleCards.length} random base set parallel cards\n`);

  const results = { exact: [], partial: [], noMatch: [], error: [] };

  for (const card of sampleCards) {
    const setName = `${card.year} ${card.set_name}`;
    const query = `${setName} ${card.player_names} #${card.card_number}`;

    console.log('-'.repeat(70));
    console.log(`OUR: #${card.card_number} ${card.player_names}`);
    console.log(`     Series: ${card.series_name}`);
    console.log(`     Query: "${query}"`);

    try {
      const apiResult = await searchSCP(query);
      const products = apiResult.products || [];

      if (products.length === 0) {
        console.log(`     RESULT: No products found`);
        results.noMatch.push(card);
        continue;
      }

      // Find matching product
      let matched = null;
      for (const p of products) {
        const scpParallel = extractParallel(p['product-name']);
        const cardNumMatch = p['product-name'].includes(`#${card.card_number}`);

        if (cardNumMatch && parallelsMatch(card.series_name, scpParallel, setName)) {
          matched = p;
          break;
        }
      }

      if (matched) {
        const price = matched['loose-price'] ? (matched['loose-price'] / 100).toFixed(2) : 'N/A';
        console.log(`     ✓ MATCH: [${matched.id}] ${matched['product-name']} - $${price}`);
        results.exact.push({ card, product: matched });
      } else {
        console.log(`     ✗ No exact match. Top results:`);
        for (const p of products.slice(0, 3)) {
          console.log(`       - ${p['product-name']}`);
        }
        results.partial.push({ card, products: products.slice(0, 5) });
      }

    } catch (err) {
      console.log(`     ERROR: ${err.message}`);
      results.error.push({ card, error: err.message });
    }

    await delay(400);
  }

  // Summary
  console.log('\n' + '='.repeat(70));
  console.log('SUMMARY');
  console.log('='.repeat(70));
  console.log(`Total tested:    ${sampleCards.length}`);
  console.log(`Exact matches:   ${results.exact.length} (${(results.exact.length/sampleCards.length*100).toFixed(0)}%)`);
  console.log(`Partial (close): ${results.partial.length}`);
  console.log(`No results:      ${results.noMatch.length}`);
  console.log(`Errors:          ${results.error.length}`);

  if (results.exact.length > 0) {
    console.log('\n--- SAMPLE MATCHES ---');
    for (const m of results.exact.slice(0, 5)) {
      const price = m.product['loose-price'] ? (m.product['loose-price'] / 100).toFixed(2) : 'N/A';
      console.log(`Our: #${m.card.card_number} ${m.card.player_names} (${m.card.series_name})`);
      console.log(`SCP: [${m.product.id}] ${m.product['product-name']} - $${price}`);
      console.log('');
    }
  }

  await prisma.$disconnect();
}

analyze().catch(console.error);
