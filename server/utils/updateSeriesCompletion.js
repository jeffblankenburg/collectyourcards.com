const { prisma } = require('../config/prisma-singleton')
const sql = require('mssql')

/**
 * Update series completion statistics for a specific user and series
 * This should be called whenever:
 * - User adds a card to their collection
 * - User removes a card from their collection
 * - Cards are added/removed from a series (admin operations)
 */
async function updateUserSeriesCompletion(userId, seriesId) {
  try {
    // Get total cards in the series
    const seriesCards = await prisma.$queryRaw`
      SELECT COUNT(*) as total_cards
      FROM card
      WHERE series = ${seriesId}
    `
    const totalCards = Number(seriesCards[0]?.total_cards || 0)

    // Get unique cards user owns in this series
    const ownedCards = await prisma.$queryRaw`
      SELECT COUNT(DISTINCT uc.card) as owned_cards
      FROM user_card uc
      JOIN card c ON uc.card = c.card_id
      WHERE uc.[user] = ${userId}
        AND c.series = ${seriesId}
    `
    const ownedCount = Number(ownedCards[0]?.owned_cards || 0)

    const completionPercentage = totalCards > 0
      ? (ownedCount / totalCards) * 100
      : 0
    const isComplete = totalCards > 0 && ownedCount === totalCards

    // Upsert the completion record using MERGE
    await prisma.$executeRaw`
      MERGE user_series_completion AS target
      USING (SELECT
        ${userId} as user_id,
        ${seriesId} as series_id,
        ${totalCards} as total_cards,
        ${ownedCount} as owned_cards,
        ${completionPercentage} as completion_percentage,
        ${isComplete ? 1 : 0} as is_complete,
        GETDATE() as last_updated
      ) AS source
      ON target.user_id = source.user_id AND target.series_id = source.series_id
      WHEN MATCHED THEN
        UPDATE SET
          total_cards = source.total_cards,
          owned_cards = source.owned_cards,
          completion_percentage = source.completion_percentage,
          is_complete = source.is_complete,
          last_updated = source.last_updated
      WHEN NOT MATCHED THEN
        INSERT (user_id, series_id, total_cards, owned_cards, completion_percentage, is_complete, last_updated)
        VALUES (source.user_id, source.series_id, source.total_cards, source.owned_cards,
                source.completion_percentage, source.is_complete, source.last_updated);
    `

    return { totalCards, ownedCount, completionPercentage, isComplete }
  } catch (error) {
    console.error(`Error updating series completion for user ${userId}, series ${seriesId}:`, error)
    throw error
  }
}

/**
 * Update all series completions for a specific user
 * Useful when backfilling or when a user's collection changes significantly
 */
async function updateAllSeriesForUser(userId) {
  try {
    // Get all series that have cards
    const seriesList = await prisma.$queryRaw`
      SELECT DISTINCT series_id
      FROM series
      WHERE EXISTS (SELECT 1 FROM card WHERE card.series = series.series_id)
    `

    let updated = 0
    for (const series of seriesList) {
      await updateUserSeriesCompletion(userId, series.series_id)
      updated++
    }

    return updated
  } catch (error) {
    console.error(`Error updating all series for user ${userId}:`, error)
    throw error
  }
}

/**
 * Update completion for all users for a specific series
 * Useful when cards are added/removed from a series
 */
async function updateSeriesForAllUsers(seriesId) {
  try {
    // Get all users who have at least one card
    const users = await prisma.$queryRaw`
      SELECT DISTINCT [user] as user_id
      FROM user_card
    `

    let updated = 0
    for (const user of users) {
      await updateUserSeriesCompletion(user.user_id, seriesId)
      updated++
    }

    return updated
  } catch (error) {
    console.error(`Error updating series ${seriesId} for all users:`, error)
    throw error
  }
}

module.exports = {
  updateUserSeriesCompletion,
  updateAllSeriesForUser,
  updateSeriesForAllUsers
}
