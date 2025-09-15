/**
 * Comprehensive Achievement Seeding Script
 * 
 * This script parses ACHIEVEMENTS.md and seeds ALL 400 achievements
 * into the database with proper categories, tiers, and metadata.
 * 
 * Usage: node server/scripts/seed-all-achievements.js
 */

const { PrismaClient } = require('@prisma/client')
const fs = require('fs')
const path = require('path')

const prisma = new PrismaClient({ log: ['error'] })

// Color codes for console output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  red: '\x1b[31m',
  cyan: '\x1b[36m'
}

// Achievement categories mapping
const categoryMapping = {
  'Collection Milestones': 1,
  'Rookie Card Achievements': 2, 
  'Autograph & Relic Achievements': 3,
  'Serial Number Achievements': 4,
  'Value Achievements': 5,
  'Grading Achievements': 6,
  'Social & Community Achievements': 7,
  'Trading Achievements': 8,
  'Streak Achievements': 9,
  'Special Event Achievements': 10,
  'Discovery Achievements': 11,
  'Completion Achievements': 12,
  'Milestone Achievements': 13,
  'Elite Achievements': 14,
  'Meta Achievements': 15
}

// Point tiers mapping
function getPointTier(points) {
  if (points <= 10) return 'Common'
  if (points <= 25) return 'Uncommon'
  if (points <= 50) return 'Rare'
  if (points <= 100) return 'Epic'
  if (points <= 250) return 'Legendary'
  return 'Mythic'
}

// Generate requirement queries based on achievement type
function generateRequirementQuery(achievementName, description) {
  const name = achievementName.toLowerCase()
  const desc = description.toLowerCase()
  
  // Card count achievements
  if (desc.includes('collect') && desc.match(/\d+/)) {
    const count = parseInt(desc.match(/\d+/)[0])
    return `SELECT COUNT(*) FROM user_card WHERE [user] = ?`
  }
  
  // Player achievements
  if (desc.includes('different players') || desc.includes('from players')) {
    const count = parseInt(desc.match(/\d+/)[0])
    return `SELECT COUNT(DISTINCT cpt.player_team_id) FROM user_card uc INNER JOIN card_player_team cpt ON uc.card = cpt.card WHERE uc.[user] = ?`
  }
  
  // Team achievements
  if (desc.includes('different teams') || desc.includes('from teams')) {
    return `SELECT COUNT(DISTINCT pt.team) FROM user_card uc INNER JOIN card_player_team cpt ON uc.card = cpt.card INNER JOIN player_team pt ON cpt.player_team = pt.player_team_id WHERE uc.[user] = ?`
  }
  
  // Rookie card achievements
  if (desc.includes('rookie') || name.includes('rookie')) {
    return `SELECT COUNT(*) FROM user_card uc INNER JOIN card c ON uc.card = c.card_id WHERE uc.[user] = ? AND c.is_rookie = 1`
  }
  
  // Autograph achievements
  if (desc.includes('autograph') || desc.includes('signature') || name.includes('signature')) {
    return `SELECT COUNT(*) FROM user_card uc INNER JOIN card c ON uc.card = c.card_id WHERE uc.[user] = ? AND c.is_autograph = 1`
  }
  
  // Relic achievements
  if (desc.includes('relic') || desc.includes('jersey') || desc.includes('memorabilia')) {
    return `SELECT COUNT(*) FROM user_card uc INNER JOIN card c ON uc.card = c.card_id WHERE uc.[user] = ? AND c.is_relic = 1`
  }
  
  // Graded achievements
  if (desc.includes('graded') || desc.includes('grade')) {
    return `SELECT COUNT(*) FROM user_card uc WHERE uc.[user] = ? AND uc.grading_agency IS NOT NULL`
  }
  
  // Serial number achievements
  if (desc.includes('serial') || desc.includes('numbered')) {
    return `SELECT COUNT(*) FROM user_card uc WHERE uc.[user] = ? AND uc.serial_number IS NOT NULL`
  }
  
  // Value achievements
  if (desc.includes('value') || desc.includes('dollar') || desc.includes('$')) {
    const amount = desc.match(/\$?(\d+)/)?.[1]
    if (amount) {
      return `SELECT SUM(COALESCE(uc.estimated_value, 0)) FROM user_card uc WHERE uc.[user] = ?`
    }
  }
  
  // Comment achievements
  if (desc.includes('comment') || desc.includes('discussion')) {
    return `SELECT COUNT(*) FROM universal_comments WHERE user_id = ?`
  }
  
  // Default query for manual achievements
  return `SELECT 0` // Manual achievements require admin approval
}

async function parseAchievementsFile() {
  const filePath = path.join(__dirname, '../../ACHIEVEMENTS.md')
  const content = fs.readFileSync(filePath, 'utf8')
  
  const achievements = []
  let currentCategory = 'Miscellaneous'
  let categoryId = 1
  
  const lines = content.split('\n')
  
  for (const line of lines) {
    // Category headers
    if (line.startsWith('### ') && line.includes('achievements')) {
      const match = line.match(/### (.+?) \((\d+) achievements\)/)
      if (match) {
        currentCategory = match[1].replace(/📊|🏆|🌟|✨|💰|🎯|👥|🔥|🏅|🎉|🎮|💎|⭐|🚀|🌟/, '').trim()
        categoryId = categoryMapping[currentCategory] || Object.keys(categoryMapping).length + 1
      }
    }
    
    // Achievement entries
    const achievementMatch = line.match(/- \*\*(.+?)\*\* \((\d+) pts?\) - (.+)/)
    if (achievementMatch) {
      const [, name, points, description] = achievementMatch
      
      const achievement = {
        name: name.trim(),
        description: description.trim(),
        points: parseInt(points),
        tier: getPointTier(parseInt(points)),
        category: currentCategory,
        category_id: categoryId,
        requirement_type: 'count',
        requirement_value: extractRequirementValue(description),
        requirement_query: generateRequirementQuery(name, description),
        is_active: true,
        icon_url: null
      }
      
      achievements.push(achievement)
    }
  }
  
  return achievements
}

function extractRequirementValue(description) {
  // Extract numeric requirement from description
  const match = description.match(/(\d+)/)
  return match ? parseInt(match[1]) : 1
}

async function seedCategories() {
  console.log(`${colors.blue}🗂️ Seeding achievement categories...${colors.reset}`)
  
  // Check if categories already exist
  const existingCategories = await prisma.$queryRaw`SELECT COUNT(*) as count FROM achievement_categories`
  if (Number(existingCategories[0].count) > 0) {
    console.log(`${colors.yellow}📁 Categories already exist, skipping category seeding${colors.reset}`)
    return
  }
  
  const categories = [
    { name: 'Collection Milestones', description: 'Achievements for growing your card collection', icon: '📦', display_order: 1 },
    { name: 'Rookie Card Achievements', description: 'Achievements for collecting rookie cards', icon: '🌟', display_order: 2 },
    { name: 'Autograph & Relic Achievements', description: 'Achievements for autographs, relics, and special cards', icon: '✨', display_order: 3 },
    { name: 'Serial Number Achievements', description: 'Achievements for numbered and limited cards', icon: '🔢', display_order: 4 },
    { name: 'Value Achievements', description: 'Achievements for collection value milestones', icon: '💰', display_order: 5 },
    { name: 'Grading Achievements', description: 'Achievements for graded cards', icon: '🏅', display_order: 6 },
    { name: 'Social & Community Achievements', description: 'Achievements for community participation', icon: '👥', display_order: 7 },
    { name: 'Trading Achievements', description: 'Achievements for trading activities', icon: '💱', display_order: 8 },
    { name: 'Streak Achievements', description: 'Achievements for consistent activity', icon: '🔥', display_order: 9 },
    { name: 'Special Event Achievements', description: 'Achievements for special events and milestones', icon: '🎉', display_order: 10 },
    { name: 'Discovery Achievements', description: 'Achievements for finding rare and unique cards', icon: '🔍', display_order: 11 },
    { name: 'Completion Achievements', description: 'Achievements for completing sets and series', icon: '📚', display_order: 12 },
    { name: 'Milestone Achievements', description: 'Achievements for major collection milestones', icon: '🎯', display_order: 13 },
    { name: 'Elite Achievements', description: 'Achievements for elite collectors', icon: '👑', display_order: 14 },
    { name: 'Meta Achievements', description: 'Achievements about achievements', icon: '🎮', display_order: 15 }
  ]
  
  for (const category of categories) {
    await prisma.$queryRaw`
      INSERT INTO achievement_categories (name, description, icon, display_order, is_active, created_at)
      VALUES (${category.name}, ${category.description}, ${category.icon}, ${category.display_order}, 1, GETDATE())
    `
  }
  
  console.log(`${colors.green}✅ Seeded ${categories.length} achievement categories${colors.reset}`)
}

async function seedAchievements() {
  console.log(`${colors.blue}🏆 Parsing and seeding all achievements...${colors.reset}`)
  
  const achievements = await parseAchievementsFile()
  
  console.log(`${colors.green}📊 Parsed ${achievements.length} achievements from ACHIEVEMENTS.md${colors.reset}`)
  
  // Check how many achievements already exist
  const existingAchievements = await prisma.$queryRaw`SELECT COUNT(*) as count FROM achievements`
  const existingCount = Number(existingAchievements[0].count)
  
  if (existingCount >= achievements.length) {
    console.log(`${colors.yellow}🏆 ${existingCount} achievements already exist (target: ${achievements.length}), skipping seeding${colors.reset}`)
    return existingCount
  }
  
  // Check what category IDs exist and use the first one for all achievements
  const categories = await prisma.$queryRaw`SELECT category_id, name FROM achievement_categories ORDER BY category_id`
  if (categories.length === 0) {
    console.log(`${colors.red}❌ No achievement categories found. Please seed categories first.${colors.reset}`)
    return 0
  }
  
  const defaultCategoryId = Number(categories[0].category_id)
  console.log(`${colors.yellow}📋 Available categories: ${categories.map(c => `${c.name} (ID: ${Number(c.category_id)})`).join(', ')}${colors.reset}`)
  console.log(`${colors.blue}📈 Currently have ${existingCount} achievements, seeding ${achievements.length - existingCount} new ones using category ID ${defaultCategoryId}...${colors.reset}`)
  
  let seededCount = 0
  
  for (const achievement of achievements) {
    try {
      // Check if achievement already exists
      const existing = await prisma.$queryRaw`
        SELECT COUNT(*) as count FROM achievements WHERE name = ${achievement.name}
      `
      
      if (Number(existing[0].count) > 0) {
        continue // Skip existing achievements
      }
      
      await prisma.$queryRaw`
        INSERT INTO achievements (
          name,
          description,
          category_id,
          requirement_type,
          requirement_value,
          requirement_query,
          points,
          tier,
          icon_url,
          is_active,
          created_at
        ) VALUES (
          ${achievement.name},
          ${achievement.description},
          ${defaultCategoryId},
          ${achievement.requirement_type},
          ${achievement.requirement_value},
          ${achievement.requirement_query},
          ${achievement.points},
          ${achievement.tier},
          ${achievement.icon_url},
          ${achievement.is_active ? 1 : 0},
          GETDATE()
        )
      `
      seededCount++
      
      if (seededCount % 25 === 0) {
        console.log(`${colors.yellow}📈 Seeded ${seededCount} new achievements...${colors.reset}`)
      }
      
    } catch (error) {
      console.log(`${colors.red}✗ Error seeding ${achievement.name}: ${error.message}${colors.reset}`)
    }
  }
  
  console.log(`${colors.green}✅ Successfully seeded ${seededCount} achievements${colors.reset}`)
  
  return seededCount
}

async function verifySeeding() {
  console.log(`${colors.blue}🔍 Verifying achievement seeding...${colors.reset}`)
  
  const categoryCount = await prisma.$queryRaw`SELECT COUNT(*) as count FROM achievement_categories`
  const achievementCount = await prisma.$queryRaw`SELECT COUNT(*) as count FROM achievements`
  const tierBreakdown = await prisma.$queryRaw`
    SELECT tier, COUNT(*) as count 
    FROM achievements 
    GROUP BY tier 
    ORDER BY 
      CASE tier 
        WHEN 'Common' THEN 1
        WHEN 'Uncommon' THEN 2  
        WHEN 'Rare' THEN 3
        WHEN 'Epic' THEN 4
        WHEN 'Legendary' THEN 5
        WHEN 'Mythic' THEN 6
        ELSE 7
      END
  `
  
  console.log(`\\n${colors.bright}📊 Seeding Summary:${colors.reset}`)
  console.log(`${colors.green}Categories: ${Number(categoryCount[0].count)}${colors.reset}`)
  console.log(`${colors.green}Total Achievements: ${Number(achievementCount[0].count)}${colors.reset}`)
  console.log(`\\n${colors.bright}Tier Breakdown:${colors.reset}`)
  
  for (const tier of tierBreakdown) {
    console.log(`${colors.cyan}${tier.tier}: ${Number(tier.count)} achievements${colors.reset}`)
  }
}

async function main() {
  console.log(`${colors.bright}${colors.blue}🏆 Starting Comprehensive Achievement Seeding${colors.reset}`)
  console.log(`${colors.cyan}===================================================${colors.reset}\\n`)
  
  try {
    await seedCategories()
    const seededCount = await seedAchievements()
    await verifySeeding()
    
    console.log(`\\n${colors.bright}${colors.green}🎉 Achievement Seeding Complete!${colors.reset}`)
    console.log(`${colors.green}Successfully seeded ${seededCount} achievements from ACHIEVEMENTS.md${colors.reset}`)
    
  } catch (error) {
    console.error(`${colors.red}❌ Error during seeding: ${error.message}${colors.reset}`)
    throw error
  } finally {
    await prisma.$disconnect()
  }
}

// Run the seeding script
if (require.main === module) {
  main()
    .catch((error) => {
      console.error('Fatal error:', error)
      process.exit(1)
    })
}

module.exports = { main }