const { prisma } = require('../../../config/prisma-singleton')

// Helper to ensure contributor_stats record exists for user
async function ensureContributorStats(userId) {
  const existing = await prisma.$queryRaw`
    SELECT user_id FROM contributor_stats WHERE user_id = ${userId}
  `

  if (existing.length === 0) {
    await prisma.$executeRaw`
      INSERT INTO contributor_stats (user_id, created_at)
      VALUES (${userId}, GETDATE())
    `
  }
}

// Helper to update contributor stats after submission
async function updateContributorStatsOnSubmit(userId) {
  await prisma.$executeRaw`
    UPDATE contributor_stats
    SET
      total_submissions = total_submissions + 1,
      pending_submissions = pending_submissions + 1,
      last_submission_at = GETDATE(),
      first_submission_at = COALESCE(first_submission_at, GETDATE()),
      updated_at = GETDATE()
    WHERE user_id = ${userId}
  `
}

// Helper to calculate trust level based on points
function calculateTrustLevel(trustPoints) {
  if (trustPoints >= 500) return 'master'
  if (trustPoints >= 300) return 'expert'
  if (trustPoints >= 150) return 'trusted'
  if (trustPoints >= 50) return 'contributor'
  return 'novice'
}

// Helper to update stats when submission is reviewed
async function updateContributorStatsOnReview(userId, wasApproved) {
  const pointChange = wasApproved ? 5 : -2 // Gain 5 points for approval, lose 2 for rejection

  await prisma.$executeRaw`
    UPDATE contributor_stats
    SET
      pending_submissions = pending_submissions - 1,
      approved_submissions = approved_submissions + ${wasApproved ? 1 : 0},
      rejected_submissions = rejected_submissions + ${wasApproved ? 0 : 1},
      trust_points = CASE
        WHEN trust_points + ${pointChange} < 0 THEN 0
        ELSE trust_points + ${pointChange}
      END,
      approval_rate = CASE
        WHEN (approved_submissions + rejected_submissions + 1) > 0
        THEN CAST((approved_submissions + ${wasApproved ? 1 : 0}) AS DECIMAL(5,2)) /
             CAST((approved_submissions + rejected_submissions + 1) AS DECIMAL(5,2)) * 100
        ELSE NULL
      END,
      updated_at = GETDATE()
    WHERE user_id = ${userId}
  `

  // Update trust level based on new points
  const stats = await prisma.$queryRaw`
    SELECT trust_points FROM contributor_stats WHERE user_id = ${userId}
  `

  if (stats.length > 0) {
    const newTrustLevel = calculateTrustLevel(stats[0].trust_points)
    await prisma.$executeRaw`
      UPDATE contributor_stats
      SET trust_level = ${newTrustLevel}
      WHERE user_id = ${userId}
    `
  }
}

module.exports = {
  ensureContributorStats,
  updateContributorStatsOnSubmit,
  updateContributorStatsOnReview,
  calculateTrustLevel
}
