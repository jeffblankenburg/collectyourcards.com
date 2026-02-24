/**
 * SportsCardsPro Price Import Service
 *
 * Fetches pricing data from sportscardspro.com API and stores in our database.
 *
 * Usage:
 *   node scripts/import-scp-prices.js [set_id] [--limit=N] [--dry-run]
 *
 * Examples:
 *   node scripts/import-scp-prices.js 1821              # 2025 Topps Chrome
 *   node scripts/import-scp-prices.js 1821 --limit=100  # First 100 cards only
 *   node scripts/import-scp-prices.js 1821 --dry-run    # Test without saving
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// Configuration
const API_TOKEN = 'd6b97b8ef762cb2c5a2f781c4dbf51e3fdf28547';
const API_BASE = 'https://www.sportscardspro.com/api';
const RATE_LIMIT_MS = 0;  // No delay - let API respond at natural speed
const PRICE_SOURCE_CODE = 'sportscardspro';
const PRICE_TYPE_CODE = 'loose';
const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 2000;  // Start with 2 seconds, doubles each retry

// Stats tracking
const stats = {
  processed: 0,
  matched: 0,
  priceUpdated: 0,
  noMatch: 0,
  errors: 0,
  skipped: 0,
  retries: 0,
  startTime: Date.now()
};

const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// Check if error is retryable (server errors, rate limits)
function isRetryableError(status) {
  return [429, 500, 502, 503, 504].includes(status);
}

async function searchSCP(query, attempt = 1) {
  const url = `${API_BASE}/products?q=${encodeURIComponent(query)}&t=${API_TOKEN}`;
  const response = await fetch(url);

  if (!response.ok) {
    // Retry on transient errors
    if (isRetryableError(response.status) && attempt < MAX_RETRIES) {
      const retryDelay = RETRY_DELAY_MS * Math.pow(2, attempt - 1);  // Exponential backoff
      stats.retries++;
      await delay(retryDelay);
      return searchSCP(query, attempt + 1);
    }
    throw new Error(`API error: ${response.status} ${response.statusText}`);
  }

  return response.json();
}

// Extract parallel name from SCP product name: "Aaron Judge [Gold Refractor] #99" -> "Gold Refractor"
function extractParallel(productName) {
  const match = productName.match(/\[([^\]]+)\]/);
  return match ? match[1] : null;
}

// Normalize parallel names for comparison
function normalizeParallel(name) {
  if (!name) return '';
  return name
    .toLowerCase()
    .replace(/s$/, '')           // Refractors -> Refractor
    .replace(/\s+/g, ' ')
    .trim();
}

// Check if our series name matches SCP parallel
function parallelsMatch(ourSeriesName, scpParallel, setName) {
  let ourParallel = ourSeriesName.replace(setName + ' ', '');

  // Base set - match products without brackets
  if (ourParallel === setName || ourParallel === ourSeriesName) {
    return scpParallel === null;
  }

  // If we're looking for a specific parallel, SCP product MUST have brackets
  // Don't match base cards (scpParallel === null) when we want a parallel
  if (scpParallel === null) {
    return false;
  }

  const ourNorm = normalizeParallel(ourParallel);
  const scpNorm = normalizeParallel(scpParallel);

  // Empty strings should never match
  if (!ourNorm || !scpNorm) return false;

  if (ourNorm === scpNorm) return true;
  if (ourNorm.includes(scpNorm) || scpNorm.includes(ourNorm)) return true;

  return false;
}

// Find matching SCP product for our card
async function findMatch(card, setName) {
  const query = `${setName} ${card.player_names} #${card.card_number}`;

  try {
    const result = await searchSCP(query);
    const products = result.products || [];

    if (products.length === 0) {
      return { match: null, reason: 'no_results' };
    }

    // Find matching product
    for (const p of products) {
      const scpParallel = extractParallel(p['product-name']);
      const cardNumMatch = p['product-name'].includes(`#${card.card_number}`);

      if (cardNumMatch && parallelsMatch(card.series_name, scpParallel, setName)) {
        return { match: p, reason: 'matched' };
      }
    }

    return { match: null, reason: 'no_parallel_match', candidates: products.length };

  } catch (err) {
    return { match: null, reason: 'error', error: err.message };
  }
}

// Save external ID mapping
async function saveExternalId(cardId, priceSourceId, externalId, externalName) {
  await prisma.card_external_id.upsert({
    where: {
      card_id_price_source_id: {
        card_id: cardId,
        price_source_id: priceSourceId
      }
    },
    update: {
      external_id: externalId,
      external_name: externalName,
      updated_at: new Date()
    },
    create: {
      card_id: cardId,
      price_source_id: priceSourceId,
      external_id: externalId,
      external_name: externalName,
      match_method: 'auto'
    }
  });
}

// Save price
async function savePrice(cardId, priceTypeId, priceSourceId, priceInCents) {
  const priceDecimal = priceInCents ? priceInCents / 100 : null;

  await prisma.card_price.upsert({
    where: {
      card_id_price_type_id_price_source_id: {
        card_id: cardId,
        price_type_id: priceTypeId,
        price_source_id: priceSourceId
      }
    },
    update: {
      price: priceDecimal,
      last_updated: new Date()
    },
    create: {
      card_id: cardId,
      price_type_id: priceTypeId,
      price_source_id: priceSourceId,
      price: priceDecimal
    }
  });
}

function printProgress() {
  const elapsed = (Date.now() - stats.startTime) / 1000;
  const rate = stats.processed / elapsed;
  const matchRate = stats.processed > 0 ? (stats.matched / stats.processed * 100).toFixed(1) : 0;

  process.stdout.write(
    `\rProcessed: ${stats.processed} | Matched: ${stats.matched} (${matchRate}%) | ` +
    `No Match: ${stats.noMatch} | Errors: ${stats.errors} | ${rate.toFixed(1)}/sec`
  );
}

async function importPrices(setId, options = {}) {
  const { limit = null, dryRun = false } = options;

  console.log('='.repeat(70));
  console.log('SPORTSCARDSPRO PRICE IMPORT');
  console.log('='.repeat(70));
  console.log(`Set ID: ${setId}`);
  console.log(`Dry run: ${dryRun}`);
  console.log(`Limit: ${limit || 'none'}`);
  console.log('');

  // Get price source and type IDs
  const priceSource = await prisma.price_source.findUnique({
    where: { code: PRICE_SOURCE_CODE }
  });
  if (!priceSource) {
    throw new Error(`Price source '${PRICE_SOURCE_CODE}' not found`);
  }

  const priceType = await prisma.price_type.findUnique({
    where: { code: PRICE_TYPE_CODE }
  });
  if (!priceType) {
    throw new Error(`Price type '${PRICE_TYPE_CODE}' not found`);
  }

  // Get set info
  const setInfo = await prisma.set.findUnique({
    where: { set_id: setId },
    select: { name: true, year: true }
  });
  if (!setInfo) {
    throw new Error(`Set ${setId} not found`);
  }

  const setName = `${setInfo.year} ${setInfo.name}`;
  console.log(`Set: ${setName}`);

  // Get cards that don't already have external IDs (or all cards for update)
  const limitClause = limit ? `TOP ${limit}` : '';

  const cards = await prisma.$queryRawUnsafe(`
    SELECT ${limitClause}
      c.card_id,
      c.card_number,
      s.name as series_name,
      STRING_AGG(CONCAT(p.first_name, ' ', p.last_name), ' / ') as player_names
    FROM card c
    JOIN series s ON c.series = s.series_id
    LEFT JOIN card_player_team cpt ON c.card_id = cpt.card
    LEFT JOIN player_team pt ON cpt.player_team = pt.player_team_id
    LEFT JOIN player p ON pt.player = p.player_id
    LEFT JOIN card_external_id cei ON c.card_id = cei.card_id AND cei.price_source_id = ${priceSource.price_source_id}
    WHERE s.[set] = ${setId}
      AND c.card_number IS NOT NULL
      AND c.card_number != ''
      AND cei.card_external_id_id IS NULL
      AND s.name NOT LIKE '%Autograph%'
      AND s.name NOT LIKE '%Printing Plate%'
    GROUP BY c.card_id, c.card_number, s.name, s.series_id
    ORDER BY c.card_id
  `);

  console.log(`Cards to process: ${cards.length}`);
  console.log('');
  console.log('Starting import...');
  console.log('');

  for (const card of cards) {
    stats.processed++;

    // Skip cards without players
    if (!card.player_names) {
      stats.skipped++;
      continue;
    }

    // Find matching SCP product
    const { match, reason, error } = await findMatch(card, setName);

    if (match) {
      stats.matched++;

      if (!dryRun) {
        // Save external ID mapping
        await saveExternalId(
          card.card_id,
          priceSource.price_source_id,
          match.id.toString(),
          match['product-name']
        );

        // Save price
        if (match['loose-price']) {
          await savePrice(
            card.card_id,
            priceType.price_type_id,
            priceSource.price_source_id,
            match['loose-price']
          );
          stats.priceUpdated++;
        }
      }
    } else if (reason === 'error') {
      stats.errors++;
      console.log(`\nError on card ${card.card_id}: ${error}`);
    } else {
      stats.noMatch++;
    }

    printProgress();
    await delay(RATE_LIMIT_MS);
  }

  // Final summary
  console.log('\n\n' + '='.repeat(70));
  console.log('IMPORT COMPLETE');
  console.log('='.repeat(70));
  console.log(`Total processed:  ${stats.processed}`);
  console.log(`Matched:          ${stats.matched} (${(stats.matched/stats.processed*100).toFixed(1)}%)`);
  console.log(`Prices updated:   ${stats.priceUpdated}`);
  console.log(`No match:         ${stats.noMatch}`);
  console.log(`Skipped:          ${stats.skipped}`);
  console.log(`Retries:          ${stats.retries}`);
  console.log(`Errors:           ${stats.errors}`);
  console.log(`Duration:         ${((Date.now() - stats.startTime)/1000).toFixed(1)}s`);

  if (dryRun) {
    console.log('\n[DRY RUN - No data was saved]');
  }
}

// Parse command line args
const args = process.argv.slice(2);
const setId = parseInt(args.find(a => !a.startsWith('--')) || '1821');
const limit = args.find(a => a.startsWith('--limit='))?.split('=')[1];
const dryRun = args.includes('--dry-run');

importPrices(setId, {
  limit: limit ? parseInt(limit) : null,
  dryRun
})
  .then(() => prisma.$disconnect())
  .catch(err => {
    console.error('\nFatal error:', err);
    prisma.$disconnect();
    process.exit(1);
  });
