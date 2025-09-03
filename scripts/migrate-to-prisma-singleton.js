#!/usr/bin/env node

/**
 * Script to automatically migrate all files to use Prisma singleton
 */

const fs = require('fs')
const path = require('path')

const filesToUpdate = [
  'server/routes/players.js',
  'server/routes/series-list.js',
  'server/routes/admin-teams.js',
  'server/routes/admin-cards.js',
  'server/routes/search.js',
  'server/routes/admin-colors.js',
  'server/routes/user-collection-stats.js',
  'server/routes/admin-series.js',
  'server/routes/user-cards.js',
  'server/routes/spreadsheet-generation.js',
  'server/routes/grading-agencies.js',
  'server/routes/user-locations.js',
  'server/routes/admin-users.js',
  'server/routes/admin-analytics.js',
  'server/routes/series-by-set.js',
  'server/routes/teams-list.js',
  'server/routes/sets-list.js',
  'server/routes/players-list.js',
  'server/routes/card-detail.js',
  'server/routes/admin-sets.js',
  'server/routes/auth.js',
  'server/routes/status.js',
  'server/routes/user-collection-cards.js',
  'server/routes/simple-card-detail.js',
  'server/routes/player-team-search.js',
  'server/routes/teams.js',
  'server/middleware/auth.js',
  'server/routes/admin-players.js',
  'server/routes/cards.js'
]

console.log('🔧 Migrating to Prisma Singleton...\n')

let successCount = 0
let errorCount = 0
let skippedCount = 0

filesToUpdate.forEach(filePath => {
  const fullPath = path.join(process.cwd(), filePath)
  
  try {
    // Check if file exists
    if (!fs.existsSync(fullPath)) {
      console.log(`⚠️  SKIP: ${filePath} - File not found`)
      skippedCount++
      return
    }
    
    // Read file content
    let content = fs.readFileSync(fullPath, 'utf8')
    
    // Check if it already uses singleton
    if (content.includes('prisma-singleton')) {
      console.log(`✓ SKIP: ${filePath} - Already using singleton`)
      skippedCount++
      return
    }
    
    // Check if it has PrismaClient import
    if (!content.includes('PrismaClient')) {
      console.log(`⚠️  SKIP: ${filePath} - No PrismaClient found`)
      skippedCount++
      return
    }
    
    // Pattern 1: const { PrismaClient } = require('@prisma/client')
    // const prisma = new PrismaClient()
    content = content.replace(
      /const\s*{\s*PrismaClient\s*}\s*=\s*require\(['"]@prisma\/client['"]\)[\s\S]*?const\s+prisma\s*=\s*new\s+PrismaClient\([^)]*\)/g,
      "const { prisma } = require('../config/prisma-singleton')"
    )
    
    // Pattern 2: Handle special cases where prisma is created conditionally
    if (content.includes('let prisma') || content.includes('var prisma')) {
      // Special handling for conditional creation
      const lines = content.split('\n')
      const modifiedLines = []
      let skipNextPrismaCreation = false
      let addedImport = false
      
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i]
        
        // Add import at the top after other requires
        if (!addedImport && line.includes("require(") && !line.includes('PrismaClient')) {
          modifiedLines.push(line)
          modifiedLines.push("const { prisma } = require('../config/prisma-singleton')")
          addedImport = true
          continue
        }
        
        // Skip PrismaClient import and creation
        if (line.includes('PrismaClient') || line.includes('new PrismaClient')) {
          skipNextPrismaCreation = true
          continue
        }
        
        // Skip let/var prisma declarations
        if (line.includes('let prisma') || line.includes('var prisma')) {
          continue
        }
        
        // Skip conditional prisma creation blocks
        if (skipNextPrismaCreation && line.includes('prisma =')) {
          continue
        }
        
        modifiedLines.push(line)
      }
      
      content = modifiedLines.join('\n')
    }
    
    // For middleware/auth.js, adjust the path
    if (filePath.includes('middleware/')) {
      content = content.replace(
        "require('../config/prisma-singleton')",
        "require('../config/prisma-singleton')"
      )
    }
    
    // Write back the modified content
    fs.writeFileSync(fullPath, content)
    console.log(`✅ UPDATED: ${filePath}`)
    successCount++
    
  } catch (error) {
    console.error(`❌ ERROR: ${filePath} - ${error.message}`)
    errorCount++
  }
})

console.log('\n📊 Migration Summary:')
console.log(`✅ Successfully updated: ${successCount} files`)
console.log(`⚠️  Skipped: ${skippedCount} files`)
console.log(`❌ Errors: ${errorCount} files`)

if (successCount > 0) {
  console.log('\n🎉 Migration complete! Next steps:')
  console.log('1. Review the changes with git diff')
  console.log('2. Test the application locally')
  console.log('3. Deploy to production')
  console.log('4. Update DATABASE_URL in Azure with connection pool settings')
}

// Create backup script for rollback
const rollbackScript = `#!/bin/bash
# Rollback script - restore from git
git checkout -- server/routes/*.js server/middleware/*.js
echo "Rolled back to previous state"
`

fs.writeFileSync('rollback-prisma-migration.sh', rollbackScript)
fs.chmodSync('rollback-prisma-migration.sh', '755')
console.log('\n📝 Created rollback-prisma-migration.sh for emergency rollback')