/**
 * Seed Early Adopter Achievements - Recognize Platform Pioneers
 * Special achievements for users who joined and contributed before 2026
 */

const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient({ log: ['error'] })

async function seedEarlyAdopterAchievements() {
  console.log('🌟 Seeding Early Adopter Achievements for Platform Pioneers...\n')

  const categoryId = 7; // Early Adopter category ID

  const earlyAdopterAchievements = [
    // Account Creation Achievements
    {
      name: 'Platform Pioneer',
      description: 'Joined Collect Your Cards before 2026 - You helped build this community!',
      subcategory: 'Account Creation',
      tier: 'Legendary',
      points: 200,
      requirement_type: 'account_created_before_2026',
      requirement_value: 1,
      icon_url: 'crown'
    },
    {
      name: 'Charter Member',
      description: 'One of the first 100 users to create an account',
      subcategory: 'Account Creation',
      tier: 'Mythic',
      points: 500,
      requirement_type: 'first_100_users',
      requirement_value: 100,
      icon_url: 'trophy'
    },
    {
      name: 'Beta Tester',
      description: 'Logged in during the beta testing phase before official launch',
      subcategory: 'Early Access',
      tier: 'Epic',
      points: 150,
      requirement_type: 'beta_login_2025',
      requirement_value: 1,
      icon_url: 'zap'
    },

    // Platform Engagement Achievements
    {
      name: 'First Explorer',
      description: 'Browsed multiple pages during your first session - helped test navigation',
      subcategory: 'Platform Engagement',
      tier: 'Uncommon',
      points: 25,
      requirement_type: 'early_platform_exploration',
      requirement_value: 1,
      icon_url: 'search'
    },
    {
      name: 'Data Pioneer',
      description: 'Added your first card to the collection before 2026',
      subcategory: 'Platform Engagement',
      tier: 'Rare',
      points: 75,
      requirement_type: 'first_card_before_2026',
      requirement_value: 1,
      icon_url: 'card'
    },
    {
      name: 'Community Founder',
      description: 'Left the first comment on a card, series, or set',
      subcategory: 'Social Pioneer',
      tier: 'Epic',
      points: 100,
      requirement_type: 'first_comment_before_2026',
      requirement_value: 1,
      icon_url: 'message-square'
    },

    // Crowdsourcing & Contribution Achievements
    {
      name: 'Database Builder',
      description: 'Contributed to the sports card database through crowdsourcing activities',
      subcategory: 'Contributor',
      tier: 'Legendary',
      points: 300,
      requirement_type: 'crowdsourcing_contribution',
      requirement_value: 1,
      icon_url: 'database'
    },
    {
      name: 'Bug Hunter',
      description: 'Reported a bug or issue that helped improve the platform',
      subcategory: 'Contributor',
      tier: 'Epic',
      points: 150,
      requirement_type: 'bug_report_submitted',
      requirement_value: 1,
      icon_url: 'shield'
    },
    {
      name: 'Feature Suggester',
      description: 'Suggested a feature or improvement during early development',
      subcategory: 'Contributor',
      tier: 'Rare',
      points: 100,
      requirement_type: 'feature_suggestion',
      requirement_value: 1,
      icon_url: 'star'
    },

    // Social Pioneer Achievements
    {
      name: 'Social Pioneer',
      description: 'One of the first users to share a card on social media',
      subcategory: 'Social Pioneer',
      tier: 'Rare',
      points: 50,
      requirement_type: 'early_social_share',
      requirement_value: 1,
      icon_url: 'share-2'
    },
    {
      name: 'Profile Trailblazer',
      description: 'Set up a complete public profile with bio and favorite cards before 2026',
      subcategory: 'Social Pioneer',
      tier: 'Uncommon',
      points: 35,
      requirement_type: 'complete_profile_early',
      requirement_value: 1,
      icon_url: 'user'
    },

    // Special Milestone Achievements
    {
      name: 'Launch Day Hero',
      description: 'Logged in on the official launch day - witnessed history!',
      subcategory: 'Special Milestone',
      tier: 'Legendary',
      points: 250,
      requirement_type: 'launch_day_login',
      requirement_value: 1,
      icon_url: 'fire'
    },
    {
      name: 'Year One Veteran',
      description: 'Remained active throughout the entire first year of operation',
      subcategory: 'Special Milestone',
      tier: 'Mythic',
      points: 400,
      requirement_type: 'year_one_active',
      requirement_value: 1,
      icon_url: 'crown'
    },

    // Technical Contributor Achievements
    {
      name: 'API Tester',
      description: 'Helped test API endpoints during development phase',
      subcategory: 'Technical Contributor',
      tier: 'Epic',
      points: 125,
      requirement_type: 'api_testing_participation',
      requirement_value: 1,
      icon_url: 'monitor'
    },
    {
      name: 'Mobile Beta User',
      description: 'Tested the mobile experience and provided feedback',
      subcategory: 'Technical Contributor',
      tier: 'Rare',
      points: 75,
      requirement_type: 'mobile_beta_testing',
      requirement_value: 1,
      icon_url: 'smartphone'
    },

    // Secret/Hidden Early Adopter Achievements
    {
      name: 'The Original',
      description: 'User ID #1 - The very first account created on the platform',
      subcategory: 'Secret',
      tier: 'Mythic',
      points: 1000,
      requirement_type: 'user_id_1',
      requirement_value: 1,
      icon_url: 'crown',
      is_secret: true
    },
    {
      name: 'Founder\'s Friend',
      description: 'Connected with the platform founder during early development',
      subcategory: 'Secret',
      tier: 'Legendary',
      points: 300,
      requirement_type: 'founder_interaction',
      requirement_value: 1,
      icon_url: 'heart',
      is_secret: true
    }
  ]

  console.log(`🎯 Adding ${earlyAdopterAchievements.length} early adopter achievements...\n`)

  for (const achievement of earlyAdopterAchievements) {
    try {
      await prisma.$queryRaw`
        INSERT INTO achievements (
          category_id, subcategory, name, description, points, tier,
          icon_url, requirement_type, requirement_value, is_secret,
          is_active, is_repeatable, cooldown_days, created_at, updated_at
        ) VALUES (
          ${categoryId}, ${achievement.subcategory}, ${achievement.name}, 
          ${achievement.description}, ${achievement.points}, ${achievement.tier},
          ${achievement.icon_url}, ${achievement.requirement_type}, ${achievement.requirement_value},
          ${achievement.is_secret || false}, 1, 0, 0, GETDATE(), GETDATE()
        )
      `
      
      console.log(`✅ ${achievement.name} (${achievement.points} pts, ${achievement.tier})`)
    } catch (error) {
      if (error.message.includes('duplicate')) {
        console.log(`⚠️  ${achievement.name} already exists, skipping...`)
      } else {
        console.log(`❌ Error adding ${achievement.name}: ${error.message}`)
      }
    }
  }

  // Get final count
  const totalCount = await prisma.$queryRaw`
    SELECT COUNT(*) as count FROM achievements WHERE category_id = ${categoryId}
  `

  console.log(`\n🎉 Early Adopter Achievement seeding complete!`)
  console.log(`📊 Total Early Adopter achievements in database: ${Number(totalCount[0].count)}`)
  console.log(`🏆 Point values range from 25 to 1000 points`)
  console.log(`🎯 Subcategories: Account Creation, Early Access, Platform Engagement, Social Pioneer, Contributor, Special Milestone, Technical Contributor, Secret`)
  console.log(`🤫 Secret achievements: 2 (The Original, Founder's Friend)`)
}

// Run the seeding
seedEarlyAdopterAchievements()
  .catch(console.error)
  .finally(() => prisma.$disconnect())