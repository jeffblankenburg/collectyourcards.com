/**
 * Beckett Checklist Downloader
 *
 * Downloads XLSX checklist files from Beckett.com
 * Stores them locally in data/beckett-checklists/
 *
 * Usage: node scripts/download-beckett-checklists.js [--year=2024] [--max-pages=5]
 */

const axios = require('axios')
const cheerio = require('cheerio')
const fs = require('fs')
const path = require('path')

// Configuration
const CONFIG = {
  baseUrl: 'https://www.beckett.com/news/category/baseball/baseball-card-checklists/',
  outputDir: path.join(__dirname, '..', 'data', 'beckett-checklists'),
  logFile: path.join(__dirname, '..', 'data', 'beckett-checklists', 'download-log.json'),
  delayBetweenRequests: 1500, // Be polite - 1.5 seconds between requests
  maxPages: 30, // Max archive pages to crawl
  userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
}

// Parse command line arguments
const args = process.argv.slice(2)
const yearFilter = args.find(a => a.startsWith('--year='))?.split('=')[1]
const maxPagesArg = args.find(a => a.startsWith('--max-pages='))?.split('=')[1]
if (maxPagesArg) CONFIG.maxPages = parseInt(maxPagesArg)

// State tracking
let downloadLog = {
  lastRun: null,
  downloaded: [],
  failed: [],
  skipped: []
}

// Load existing log if present
function loadLog() {
  try {
    if (fs.existsSync(CONFIG.logFile)) {
      downloadLog = JSON.parse(fs.readFileSync(CONFIG.logFile, 'utf8'))
      console.log(`Loaded existing log: ${downloadLog.downloaded.length} previously downloaded`)
    }
  } catch (e) {
    console.log('Starting fresh log')
  }
}

// Save log
function saveLog() {
  downloadLog.lastRun = new Date().toISOString()
  fs.writeFileSync(CONFIG.logFile, JSON.stringify(downloadLog, null, 2))
}

// Sleep helper
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms))

// Fetch with retry
async function fetchWithRetry(url, retries = 3) {
  for (let i = 0; i < retries; i++) {
    try {
      const response = await axios.get(url, {
        headers: { 'User-Agent': CONFIG.userAgent },
        timeout: 30000
      })
      return response
    } catch (e) {
      if (i === retries - 1) throw e
      console.log(`  Retry ${i + 1}/${retries} for ${url}`)
      await sleep(2000)
    }
  }
}

// Get all checklist article URLs from the archive
async function getChecklistUrls() {
  const urls = []

  for (let page = 1; page <= CONFIG.maxPages; page++) {
    const pageUrl = page === 1
      ? CONFIG.baseUrl
      : `${CONFIG.baseUrl}page/${page}/`

    console.log(`Fetching archive page ${page}...`)

    try {
      const response = await fetchWithRetry(pageUrl)
      const $ = cheerio.load(response.data)

      // Find all article links - they're in h4.title a elements
      const pageUrls = []
      $('h4.title a, .post-title a, article .title a').each((i, el) => {
        const href = $(el).attr('href')
        if (href && href.includes('/news/') && href.includes('-cards')) {
          // Filter by year if specified
          if (yearFilter && !href.includes(yearFilter)) {
            return
          }
          if (!urls.includes(href) && !pageUrls.includes(href)) {
            pageUrls.push(href)
          }
        }
      })

      // Also look for links in the main content area
      $('.content_out a, .archive-posts a').each((i, el) => {
        const href = $(el).attr('href')
        if (href && href.includes('/news/') && href.includes('-baseball-cards') && !href.includes('/category/')) {
          if (yearFilter && !href.includes(yearFilter)) {
            return
          }
          if (!urls.includes(href) && !pageUrls.includes(href)) {
            pageUrls.push(href)
          }
        }
      })

      if (pageUrls.length === 0) {
        console.log(`  No more articles found on page ${page}, stopping.`)
        break
      }

      urls.push(...pageUrls)
      console.log(`  Found ${pageUrls.length} articles (total: ${urls.length})`)

      await sleep(CONFIG.delayBetweenRequests)
    } catch (e) {
      console.log(`  Error fetching page ${page}: ${e.message}`)
      break
    }
  }

  return [...new Set(urls)] // Deduplicate
}

// Extract XLSX download URL from a checklist article page
async function getXlsxUrl(articleUrl) {
  try {
    const response = await fetchWithRetry(articleUrl)
    const $ = cheerio.load(response.data)

    // Look for S3 bucket links to XLSX files
    let xlsxUrl = null

    $('a').each((i, el) => {
      const href = $(el).attr('href') || ''
      if (href.includes('.xlsx') && href.includes('s3.amazonaws.com')) {
        xlsxUrl = href
        return false // Break
      }
    })

    // Also check for direct download links
    if (!xlsxUrl) {
      $('a').each((i, el) => {
        const href = $(el).attr('href') || ''
        const text = $(el).text().toLowerCase()
        if (href.includes('.xlsx') || (text.includes('xlsx') && href.includes('download'))) {
          xlsxUrl = href
          return false
        }
      })
    }

    return xlsxUrl
  } catch (e) {
    console.log(`  Error parsing ${articleUrl}: ${e.message}`)
    return null
  }
}

// Download a file
async function downloadFile(url, filename) {
  const filepath = path.join(CONFIG.outputDir, filename)

  // Check if already downloaded
  if (fs.existsSync(filepath)) {
    return { status: 'exists', filepath }
  }

  try {
    const response = await axios({
      method: 'GET',
      url: url,
      responseType: 'arraybuffer',
      headers: { 'User-Agent': CONFIG.userAgent },
      timeout: 60000
    })

    fs.writeFileSync(filepath, response.data)
    return { status: 'downloaded', filepath, size: response.data.length }
  } catch (e) {
    return { status: 'error', error: e.message }
  }
}

// Extract a clean filename from URL or article title
function getFilename(xlsxUrl, articleUrl) {
  // Try to get filename from XLSX URL
  const urlFilename = xlsxUrl.split('/').pop().split('?')[0]
  if (urlFilename && urlFilename.endsWith('.xlsx')) {
    return urlFilename
  }

  // Generate from article URL
  const slug = articleUrl.split('/').filter(Boolean).pop()
  return `${slug}.xlsx`
}

// Main execution
async function main() {
  console.log('='.repeat(60))
  console.log('BECKETT CHECKLIST DOWNLOADER')
  console.log('='.repeat(60))
  console.log(`Output directory: ${CONFIG.outputDir}`)
  if (yearFilter) console.log(`Year filter: ${yearFilter}`)
  console.log(`Max pages to crawl: ${CONFIG.maxPages}`)
  console.log('')

  // Ensure output directory exists
  if (!fs.existsSync(CONFIG.outputDir)) {
    fs.mkdirSync(CONFIG.outputDir, { recursive: true })
  }

  loadLog()

  // Step 1: Get all checklist article URLs
  console.log('STEP 1: Finding checklist articles...')
  const articleUrls = await getChecklistUrls()
  console.log(`\nFound ${articleUrls.length} checklist articles to process.\n`)

  // Step 2: Process each article
  console.log('STEP 2: Processing articles and downloading XLSX files...\n')

  let downloaded = 0
  let skipped = 0
  let failed = 0

  for (let i = 0; i < articleUrls.length; i++) {
    const articleUrl = articleUrls[i]
    const articleSlug = articleUrl.split('/').filter(Boolean).pop()

    // Check if already processed
    if (downloadLog.downloaded.some(d => d.articleUrl === articleUrl)) {
      console.log(`[${i + 1}/${articleUrls.length}] SKIP (already done): ${articleSlug}`)
      skipped++
      continue
    }

    console.log(`[${i + 1}/${articleUrls.length}] Processing: ${articleSlug}`)

    // Get XLSX URL
    const xlsxUrl = await getXlsxUrl(articleUrl)

    if (!xlsxUrl) {
      console.log(`  -> No XLSX found`)
      downloadLog.skipped.push({ articleUrl, reason: 'no-xlsx' })
      skipped++
      await sleep(CONFIG.delayBetweenRequests)
      continue
    }

    // Download the file
    const filename = getFilename(xlsxUrl, articleUrl)
    console.log(`  -> Downloading: ${filename}`)

    const result = await downloadFile(xlsxUrl, filename)

    if (result.status === 'downloaded') {
      console.log(`  -> SUCCESS (${(result.size / 1024).toFixed(1)} KB)`)
      downloadLog.downloaded.push({
        articleUrl,
        xlsxUrl,
        filename,
        size: result.size,
        downloadedAt: new Date().toISOString()
      })
      downloaded++
    } else if (result.status === 'exists') {
      console.log(`  -> Already exists locally`)
      downloadLog.downloaded.push({
        articleUrl,
        xlsxUrl,
        filename,
        downloadedAt: new Date().toISOString()
      })
      skipped++
    } else {
      console.log(`  -> FAILED: ${result.error}`)
      downloadLog.failed.push({ articleUrl, xlsxUrl, error: result.error })
      failed++
    }

    // Save log periodically
    if ((i + 1) % 10 === 0) {
      saveLog()
    }

    await sleep(CONFIG.delayBetweenRequests)
  }

  // Final save
  saveLog()

  // Summary
  console.log('\n' + '='.repeat(60))
  console.log('DOWNLOAD COMPLETE')
  console.log('='.repeat(60))
  console.log(`Downloaded: ${downloaded}`)
  console.log(`Skipped:    ${skipped}`)
  console.log(`Failed:     ${failed}`)
  console.log(`Total files: ${downloadLog.downloaded.length}`)
  console.log(`\nFiles saved to: ${CONFIG.outputDir}`)
  console.log(`Log saved to: ${CONFIG.logFile}`)
}

main().catch(console.error)
