#!/usr/bin/env node

/**
 * Fix broken route files after migration
 */

const fs = require('fs')
const path = require('path')

const brokenFiles = [
  'server/routes/admin-analytics.js',
  'server/routes/admin-cards.js',
  'server/routes/admin-colors.js',
  'server/routes/admin-players.js',
  'server/routes/admin-sets.js',
  'server/routes/admin-teams.js',
  'server/routes/admin-users.js',
  'server/routes/cards.js',
  'server/routes/grading-agencies.js',
  'server/routes/players-list.js',
  'server/routes/players.js',
  'server/routes/series-by-set.js',
  'server/routes/series-list.js',
  'server/routes/sets-list.js',
  'server/routes/spreadsheet-generation.js',
  'server/routes/teams-list.js',
  'server/routes/teams.js',
  'server/routes/user-collection-cards.js',
  'server/routes/user-collection-stats.js',
  'server/routes/user-locations.js'
]

console.log('🔧 Fixing broken route files...\n')

brokenFiles.forEach(filePath => {
  const fullPath = path.join(process.cwd(), filePath)
  
  try {
    let content = fs.readFileSync(fullPath, 'utf8')
    
    // Check if router is missing
    if (!content.includes('const router = express.Router()')) {
      // Add router declaration after express import
      content = content.replace(
        "const express = require('express')",
        "const express = require('express')\nconst router = express.Router()"
      )
      
      // Check for auth middleware and add imports if needed
      if (content.includes('authMiddleware') && !content.includes("require('../middleware/auth')")) {
        // Add auth middleware import
        content = content.replace(
          "const router = express.Router()",
          "const { authMiddleware, requireAdmin, requireDataAdmin, requireSuperAdmin } = require('../middleware/auth')\nconst router = express.Router()"
        )
      }
      
      // Ensure module.exports = router at the end
      if (!content.includes('module.exports = router')) {
        // Remove any existing module.exports
        content = content.replace(/module\.exports\s*=.*$/gm, '')
        // Add at the end
        content = content.trimEnd() + '\n\nmodule.exports = router'
      }
      
      fs.writeFileSync(fullPath, content)
      console.log(`✅ Fixed: ${filePath}`)
    } else {
      console.log(`⏭️  Already OK: ${filePath}`)
    }
    
  } catch (error) {
    console.error(`❌ Error fixing ${filePath}: ${error.message}`)
  }
})

console.log('\n✅ Fix complete!')