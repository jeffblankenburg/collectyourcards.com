const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function checkFinalStats() {
  const userId = 1;
  
  // Get achievement stats
  const stats = await prisma.$queryRaw`
    SELECT * FROM user_achievement_stats WHERE user_id = ${userId}
  `;
  
  if (stats.length > 0) {
    const stat = stats[0];
    console.log('📊 Final Achievement Stats for User #1:');
    console.log(`  Total Points: ${Number(stat.total_points)}`);
    console.log(`  Total Achievements: ${Number(stat.total_achievements)}`);
    console.log(`  Common: ${Number(stat.common_achievements)}`);
    console.log(`  Uncommon: ${Number(stat.uncommon_achievements)}`);
    console.log(`  Rare: ${Number(stat.rare_achievements)}`);
    console.log(`  Epic: ${Number(stat.epic_achievements)}`);
    console.log(`  Legendary: ${Number(stat.legendary_achievements)}`);
    console.log(`  Mythic: ${Number(stat.mythic_achievements)}`);
  }
  
  // Get recent achievements by category  
  const recentAchievements = await prisma.$queryRaw`
    SELECT a.name, a.tier, a.points, ac.name as category_name
    FROM user_achievements ua
    INNER JOIN achievements a ON ua.achievement_id = a.achievement_id
    INNER JOIN achievement_categories ac ON a.category_id = ac.category_id
    WHERE ua.user_id = ${userId}
    ORDER BY ua.completed_at DESC
  `;
  
  console.log(`\n🏆 User has ${recentAchievements.length} total achievements across multiple categories\n`);
  
  const categories = {};
  for (const achievement of recentAchievements) {
    const cat = achievement.category_name;
    if (!categories[cat]) categories[cat] = [];
    categories[cat].push(achievement);
  }
  
  for (const [category, achievements] of Object.entries(categories)) {
    console.log(`${category} (${achievements.length} achievements):`);
    achievements.forEach(a => {
      console.log(`  ✅ ${a.name} (${a.points} pts, ${a.tier})`);
    });
    console.log('');
  }
  
  await prisma.$disconnect();
}

checkFinalStats().catch(console.error);