/**
 * Collection Price Update Service
 *
 * Updates prices ONLY for cards that exist in user collections.
 * Much more efficient than updating entire sets - focuses on cards people actually own.
 *
 * Two modes:
 *   1. Refresh: Update prices for cards that already have SCP external IDs
 *   2. Match: Find SCP matches for collection cards that don't have external IDs yet
 *
 * Usage:
 *   node scripts/update-collection-prices.js [--mode=refresh|match|both] [--limit=N] [--dry-run]
 *
 * Examples:
 *   node scripts/update-collection-prices.js                    # Both modes, all cards
 *   node scripts/update-collection-prices.js --mode=refresh     # Only refresh existing matches
 *   node scripts/update-collection-prices.js --mode=match       # Only find new matches
 *   node scripts/update-collection-prices.js --limit=100        # Process 100 cards max
 *   node scripts/update-collection-prices.js --dry-run          # Test without saving
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// Configuration
const API_TOKEN = 'd6b97b8ef762cb2c5a2f781c4dbf51e3fdf28547';
const API_BASE = 'https://www.sportscardspro.com/api';
const RATE_LIMIT_MS = 100;  // Slight delay to be respectful to API
const PRICE_SOURCE_CODE = 'sportscardspro';
const PRICE_TYPE_CODE = 'loose';
const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 2000;

// Stats tracking
const stats = {
  // Refresh mode stats
  refreshProcessed: 0,
  refreshUpdated: 0,
  refreshErrors: 0,
  // Match mode stats
  matchProcessed: 0,
  matchFound: 0,
  matchPriceUpdated: 0,
  matchNoResult: 0,
  matchErrors: 0,
  // General
  retries: 0,
  startTime: Date.now()
};

const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

function isRetryableError(status) {
  return [429, 500, 502, 503, 504].includes(status);
}

// Fetch price by SCP product ID (for refresh mode)
async function fetchPriceById(scpId, attempt = 1) {
  const url = `${API_BASE}/product?id=${scpId}&t=${API_TOKEN}`;
  const response = await fetch(url);

  if (!response.ok) {
    if (isRetryableError(response.status) && attempt < MAX_RETRIES) {
      const retryDelay = RETRY_DELAY_MS * Math.pow(2, attempt - 1);
      stats.retries++;
      await delay(retryDelay);
      return fetchPriceById(scpId, attempt + 1);
    }
    throw new Error(`API error: ${response.status}`);
  }

  return response.json();
}

// Search SCP by query (for match mode)
async function searchSCP(query, attempt = 1) {
  const url = `${API_BASE}/products?q=${encodeURIComponent(query)}&t=${API_TOKEN}`;
  const response = await fetch(url);

  if (!response.ok) {
    if (isRetryableError(response.status) && attempt < MAX_RETRIES) {
      const retryDelay = RETRY_DELAY_MS * Math.pow(2, attempt - 1);
      stats.retries++;
      await delay(retryDelay);
      return searchSCP(query, attempt + 1);
    }
    throw new Error(`API error: ${response.status}`);
  }

  return response.json();
}

// Extract parallel name from SCP product name
function extractParallel(productName) {
  const match = productName.match(/\[([^\]]+)\]/);
  return match ? match[1] : null;
}

// Normalize parallel names for comparison
function normalizeParallel(name) {
  if (!name) return '';
  return name
    .toLowerCase()
    .replace(/s$/, '')
    .replace(/\s+/g, ' ')
    .trim();
}

// Check if parallels match
function parallelsMatch(ourSeriesName, scpParallel, setName) {
  let ourParallel = ourSeriesName.replace(setName + ' ', '');

  // Base set check - our parallel equals set name means we want base cards (no brackets in SCP)
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

// Find matching SCP product
async function findMatch(card) {
  const setName = `${card.set_year} ${card.set_name}`;
  const query = `${setName} ${card.player_names} #${card.card_number}`;

  try {
    const result = await searchSCP(query);
    const products = result.products || [];

    if (products.length === 0) {
      return { match: null, reason: 'no_results' };
    }

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

function printRefreshProgress() {
  const elapsed = (Date.now() - stats.startTime) / 1000;
  const rate = stats.refreshProcessed / elapsed;

  process.stdout.write(
    `\r[REFRESH] Processed: ${stats.refreshProcessed} | Updated: ${stats.refreshUpdated} | ` +
    `Errors: ${stats.refreshErrors} | ${rate.toFixed(1)}/sec`
  );
}

function printMatchProgress() {
  const elapsed = (Date.now() - stats.startTime) / 1000;
  const rate = stats.matchProcessed / elapsed;
  const matchRate = stats.matchProcessed > 0
    ? (stats.matchFound / stats.matchProcessed * 100).toFixed(1)
    : 0;

  process.stdout.write(
    `\r[MATCH] Processed: ${stats.matchProcessed} | Found: ${stats.matchFound} (${matchRate}%) | ` +
    `No Match: ${stats.matchNoResult} | Errors: ${stats.matchErrors} | ${rate.toFixed(1)}/sec`
  );
}

/**
 * REFRESH MODE: Update prices for cards that already have SCP external IDs
 */
async function refreshExistingPrices(priceSourceId, priceTypeId, options = {}) {
  const { limit = null, dryRun = false } = options;

  console.log('\n' + '-'.repeat(60));
  console.log('REFRESH MODE: Updating prices for cards with existing SCP matches');
  console.log('-'.repeat(60));

  // Get collection cards that have external IDs
  const limitClause = limit ? `TOP ${limit}` : '';

  const cards = await prisma.$queryRawUnsafe(`
    SELECT ${limitClause}
      cei.card_id,
      cei.external_id,
      cei.external_name,
      cp.price as current_price,
      cp.last_updated,
      COUNT(DISTINCT uc.user_card_id) as collector_count
    FROM card_external_id cei
    JOIN user_card uc ON cei.card_id = uc.card AND uc.sold_at IS NULL
    LEFT JOIN card_price cp ON cei.card_id = cp.card_id
      AND cp.price_source_id = ${priceSourceId}
      AND cp.price_type_id = ${priceTypeId}
    WHERE cei.price_source_id = ${priceSourceId}
    GROUP BY cei.card_id, cei.external_id, cei.external_name, cp.price, cp.last_updated
    ORDER BY collector_count DESC, cei.card_id
  `);

  console.log(`Cards to refresh: ${cards.length}`);
  console.log('');

  for (const card of cards) {
    stats.refreshProcessed++;

    try {
      const result = await fetchPriceById(card.external_id);

      if (result && result['loose-price'] !== undefined) {
        if (!dryRun) {
          await savePrice(
            card.card_id,
            priceTypeId,
            priceSourceId,
            result['loose-price']
          );
        }
        stats.refreshUpdated++;
      }
    } catch (err) {
      stats.refreshErrors++;
    }

    printRefreshProgress();
    await delay(RATE_LIMIT_MS);
  }

  console.log('');
}

/**
 * MATCH MODE: Find SCP matches for collection cards without external IDs
 */
async function findNewMatches(priceSourceId, priceTypeId, options = {}) {
  const { limit = null, dryRun = false } = options;

  console.log('\n' + '-'.repeat(60));
  console.log('MATCH MODE: Finding SCP matches for unmatched collection cards');
  console.log('-'.repeat(60));

  // Get collection cards without external IDs
  const limitClause = limit ? `TOP ${limit}` : '';

  const cards = await prisma.$queryRawUnsafe(`
    SELECT ${limitClause}
      c.card_id,
      c.card_number,
      s.name as series_name,
      st.name as set_name,
      st.[year] as set_year,
      STRING_AGG(CONCAT(p.first_name, ' ', p.last_name), ' / ') as player_names,
      COUNT(DISTINCT uc.user_card_id) as collector_count
    FROM card c
    JOIN series s ON c.series = s.series_id
    JOIN [set] st ON s.[set] = st.set_id
    JOIN user_card uc ON c.card_id = uc.card AND uc.sold_at IS NULL
    LEFT JOIN card_player_team cpt ON c.card_id = cpt.card
    LEFT JOIN player_team pt ON cpt.player_team = pt.player_team_id
    LEFT JOIN player p ON pt.player = p.player_id
    LEFT JOIN card_external_id cei ON c.card_id = cei.card_id AND cei.price_source_id = ${priceSourceId}
    WHERE cei.card_external_id_id IS NULL
      AND c.card_number IS NOT NULL
      AND c.card_number != ''
      AND s.name NOT LIKE '%Autograph%'
      AND s.name NOT LIKE '%Printing Plate%'
    GROUP BY c.card_id, c.card_number, s.name, st.name, st.[year]
    ORDER BY collector_count DESC, c.card_id
  `);

  console.log(`Cards to match: ${cards.length}`);
  console.log('');

  for (const card of cards) {
    stats.matchProcessed++;

    // Skip cards without players
    if (!card.player_names) {
      stats.matchNoResult++;
      printMatchProgress();
      continue;
    }

    const { match, reason, error } = await findMatch(card);

    if (match) {
      stats.matchFound++;

      if (!dryRun) {
        await saveExternalId(
          card.card_id,
          priceSourceId,
          match.id.toString(),
          match['product-name']
        );

        if (match['loose-price']) {
          await savePrice(
            card.card_id,
            priceTypeId,
            priceSourceId,
            match['loose-price']
          );
          stats.matchPriceUpdated++;
        }
      }
    } else if (reason === 'error') {
      stats.matchErrors++;
    } else {
      stats.matchNoResult++;
    }

    printMatchProgress();
    await delay(RATE_LIMIT_MS);
  }

  console.log('');
}

async function updateCollectionPrices(options = {}) {
  const { mode = 'both', limit = null, dryRun = false } = options;

  console.log('='.repeat(70));
  console.log('COLLECTION PRICE UPDATE');
  console.log('='.repeat(70));
  console.log(`Mode: ${mode}`);
  console.log(`Dry run: ${dryRun}`);
  console.log(`Limit: ${limit || 'none'}`);

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

  // Get collection summary
  const collectionStats = await prisma.$queryRaw`
    SELECT
      COUNT(DISTINCT uc.card) as unique_cards,
      COUNT(DISTINCT uc.[user]) as total_collectors,
      COUNT(uc.user_card_id) as total_items
    FROM user_card uc
    WHERE uc.sold_at IS NULL
  `;

  console.log('');
  console.log('Collection Summary:');
  console.log(`  Unique cards in collections: ${Number(collectionStats[0].unique_cards).toLocaleString()}`);
  console.log(`  Active collectors: ${Number(collectionStats[0].total_collectors).toLocaleString()}`);
  console.log(`  Total collection items: ${Number(collectionStats[0].total_items).toLocaleString()}`);

  // Run appropriate mode(s)
  if (mode === 'refresh' || mode === 'both') {
    await refreshExistingPrices(priceSource.price_source_id, priceType.price_type_id, { limit, dryRun });
  }

  if (mode === 'match' || mode === 'both') {
    // Reset timer for match mode
    stats.startTime = Date.now();
    await findNewMatches(priceSource.price_source_id, priceType.price_type_id, { limit, dryRun });
  }

  // Final summary
  console.log('\n' + '='.repeat(70));
  console.log('UPDATE COMPLETE');
  console.log('='.repeat(70));

  if (mode === 'refresh' || mode === 'both') {
    console.log('\nRefresh Results:');
    console.log(`  Processed:  ${stats.refreshProcessed}`);
    console.log(`  Updated:    ${stats.refreshUpdated}`);
    console.log(`  Errors:     ${stats.refreshErrors}`);
  }

  if (mode === 'match' || mode === 'both') {
    const matchRate = stats.matchProcessed > 0
      ? (stats.matchFound / stats.matchProcessed * 100).toFixed(1)
      : 0;
    console.log('\nMatch Results:');
    console.log(`  Processed:  ${stats.matchProcessed}`);
    console.log(`  Matched:    ${stats.matchFound} (${matchRate}%)`);
    console.log(`  Prices:     ${stats.matchPriceUpdated}`);
    console.log(`  No match:   ${stats.matchNoResult}`);
    console.log(`  Errors:     ${stats.matchErrors}`);
  }

  console.log(`\nTotal retries: ${stats.retries}`);

  if (dryRun) {
    console.log('\n[DRY RUN - No data was saved]');
  }
}

// Parse command line args
const args = process.argv.slice(2);
const modeArg = args.find(a => a.startsWith('--mode='));
const mode = modeArg ? modeArg.split('=')[1] : 'both';
const limitArg = args.find(a => a.startsWith('--limit='));
const limit = limitArg ? parseInt(limitArg.split('=')[1]) : null;
const dryRun = args.includes('--dry-run');

if (!['refresh', 'match', 'both'].includes(mode)) {
  console.error('Invalid mode. Use: refresh, match, or both');
  process.exit(1);
}

updateCollectionPrices({ mode, limit, dryRun })
  .then(() => prisma.$disconnect())
  .catch(err => {
    console.error('\nFatal error:', err);
    prisma.$disconnect();
    process.exit(1);
  });
