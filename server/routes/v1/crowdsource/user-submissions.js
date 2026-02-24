const express = require('express')
const { prisma } = require('../../../config/prisma-singleton')
const { authMiddleware } = require('./middleware')
const { ensureContributorStats } = require('./helpers')

const router = express.Router()

// =============================================================================
// USER SUBMISSION QUERIES
// =============================================================================

// Get user's card edit submissions
router.get('/my-submissions',
  authMiddleware,
  async (req, res) => {
    try {
      const userId = BigInt(req.user.userId)
      const { status, limit = 50, offset = 0 } = req.query
      const limitNum = Math.min(parseInt(limit) || 50, 100)
      const offsetNum = parseInt(offset) || 0

      let statusFilter = ''
      if (status && ['pending', 'approved', 'rejected'].includes(status)) {
        statusFilter = `AND ces.status = '${status}'`
      }

      const submissions = await prisma.$queryRawUnsafe(`
        SELECT
          ces.submission_id,
          ces.card_id,
          ces.proposed_card_number,
          ces.proposed_is_rookie,
          ces.proposed_is_autograph,
          ces.proposed_is_relic,
          ces.proposed_is_short_print,
          ces.proposed_print_run,
          ces.proposed_notes,
          ces.submission_notes,
          ces.status,
          ces.review_notes,
          ces.created_at,
          ces.reviewed_at,
          c.card_number as current_card_number,
          c.is_rookie as current_is_rookie,
          c.is_autograph as current_is_autograph,
          c.is_relic as current_is_relic,
          c.is_short_print as current_is_short_print,
          c.print_run as current_print_run,
          c.notes as current_notes,
          s.name as series_name,
          st.name as set_name,
          st.year as set_year,
          (
            SELECT STRING_AGG(p.first_name + ' ' + p.last_name, ', ')
            FROM card_player cp
            JOIN player p ON cp.player = p.player_id
            WHERE cp.card = c.card_id
          ) as player_names
        FROM card_edit_submissions ces
        JOIN card c ON ces.card_id = c.card_id
        LEFT JOIN series s ON c.series = s.series_id
        LEFT JOIN [set] st ON s.[set] = st.set_id
        WHERE ces.user_id = ${userId}
        ${statusFilter}
        ORDER BY ces.created_at DESC
        OFFSET ${offsetNum} ROWS FETCH NEXT ${limitNum} ROWS ONLY
      `)

      // Get total count
      const countResult = await prisma.$queryRawUnsafe(`
        SELECT COUNT(*) as total
        FROM card_edit_submissions ces
        WHERE ces.user_id = ${userId}
        ${statusFilter}
      `)

      // Serialize BigInts
      const serialized = submissions.map(s => ({
        submission_id: Number(s.submission_id),
        card_id: Number(s.card_id),
        proposed_card_number: s.proposed_card_number,
        proposed_is_rookie: s.proposed_is_rookie,
        proposed_is_autograph: s.proposed_is_autograph,
        proposed_is_relic: s.proposed_is_relic,
        proposed_is_short_print: s.proposed_is_short_print,
        proposed_print_run: s.proposed_print_run ? Number(s.proposed_print_run) : null,
        proposed_notes: s.proposed_notes,
        submission_notes: s.submission_notes,
        status: s.status,
        review_notes: s.review_notes,
        created_at: s.created_at,
        reviewed_at: s.reviewed_at,
        current_card_number: s.current_card_number,
        current_is_rookie: s.current_is_rookie,
        current_is_autograph: s.current_is_autograph,
        current_is_relic: s.current_is_relic,
        current_is_short_print: s.current_is_short_print,
        current_print_run: s.current_print_run ? Number(s.current_print_run) : null,
        current_notes: s.current_notes,
        series_name: s.series_name,
        set_name: s.set_name,
        set_year: s.set_year ? Number(s.set_year) : null,
        player_names: s.player_names
      }))

      res.json({
        success: true,
        submissions: serialized,
        total: Number(countResult[0].total),
        limit: limitNum,
        offset: offsetNum
      })

    } catch (error) {
      console.error('Error fetching user submissions:', error)
      res.status(500).json({
        error: 'Server error',
        message: 'Failed to fetch submissions'
      })
    }
  }
)

// Get all user submissions across all types
router.get('/my-all-submissions',
  authMiddleware,
  async (req, res) => {
    try {
      const userId = BigInt(req.user.userId)
      const { status, type, limit = 50, offset = 0 } = req.query
      const limitNum = Math.min(parseInt(limit) || 50, 100)
      const offsetNum = parseInt(offset) || 0

      // Get submissions based on type filter or all
      const results = { sets: [], series: [], cards: [], card_edits: [] }

      if (!type || type === 'set') {
        let sets
        if (status && ['pending', 'approved', 'rejected'].includes(status)) {
          sets = await prisma.$queryRaw`
            SELECT 'set' as submission_type, submission_id, proposed_name, proposed_year,
                   proposed_sport, proposed_manufacturer, status, created_at, reviewed_at, review_notes
            FROM set_submissions
            WHERE user_id = ${userId} AND status = ${status}
            ORDER BY created_at DESC
          `
        } else {
          sets = await prisma.$queryRaw`
            SELECT 'set' as submission_type, submission_id, proposed_name, proposed_year,
                   proposed_sport, proposed_manufacturer, status, created_at, reviewed_at, review_notes
            FROM set_submissions
            WHERE user_id = ${userId}
            ORDER BY created_at DESC
          `
        }
        results.sets = sets.map(s => ({
          submission_type: 'set',
          submission_id: Number(s.submission_id),
          name: s.proposed_name,
          year: s.proposed_year,
          sport: s.proposed_sport,
          manufacturer: s.proposed_manufacturer,
          status: s.status,
          created_at: s.created_at,
          reviewed_at: s.reviewed_at,
          review_notes: s.review_notes
        }))
      }

      if (!type || type === 'series') {
        let series
        if (status && ['pending', 'approved', 'rejected'].includes(status)) {
          series = await prisma.$queryRaw`
            SELECT 'series' as submission_type, ss.submission_id, ss.proposed_name,
                   ss.proposed_is_parallel, ss.proposed_parallel_name, ss.status,
                   ss.created_at, ss.reviewed_at, ss.review_notes,
                   s.name as set_name, s.year as set_year,
                   sub.proposed_name as pending_set_name, sub.proposed_year as pending_set_year
            FROM series_submissions ss
            LEFT JOIN [set] s ON ss.set_id = s.set_id
            LEFT JOIN set_submissions sub ON ss.set_submission_id = sub.submission_id
            WHERE ss.user_id = ${userId} AND ss.status = ${status}
            ORDER BY ss.created_at DESC
          `
        } else {
          series = await prisma.$queryRaw`
            SELECT 'series' as submission_type, ss.submission_id, ss.proposed_name,
                   ss.proposed_is_parallel, ss.proposed_parallel_name, ss.status,
                   ss.created_at, ss.reviewed_at, ss.review_notes,
                   s.name as set_name, s.year as set_year,
                   sub.proposed_name as pending_set_name, sub.proposed_year as pending_set_year
            FROM series_submissions ss
            LEFT JOIN [set] s ON ss.set_id = s.set_id
            LEFT JOIN set_submissions sub ON ss.set_submission_id = sub.submission_id
            WHERE ss.user_id = ${userId}
            ORDER BY ss.created_at DESC
          `
        }
        results.series = series.map(s => ({
          submission_type: 'series',
          submission_id: Number(s.submission_id),
          name: s.proposed_name,
          is_parallel: s.proposed_is_parallel,
          parallel_name: s.proposed_parallel_name,
          set_name: s.set_name || s.pending_set_name,
          set_year: s.set_year || s.pending_set_year,
          status: s.status,
          created_at: s.created_at,
          reviewed_at: s.reviewed_at,
          review_notes: s.review_notes
        }))
      }

      if (!type || type === 'card') {
        let cards
        if (status && ['pending', 'approved', 'rejected'].includes(status)) {
          cards = await prisma.$queryRaw`
            SELECT 'card' as submission_type, cs.submission_id, cs.batch_id,
                   cs.proposed_card_number, cs.proposed_player_names, cs.proposed_team_names,
                   cs.status, cs.created_at, cs.reviewed_at, cs.review_notes,
                   s.name as series_name, st.name as set_name, st.year as set_year
            FROM card_submissions cs
            LEFT JOIN series s ON cs.series_id = s.series_id
            LEFT JOIN [set] st ON s.[set] = st.set_id
            WHERE cs.user_id = ${userId} AND cs.status = ${status}
            ORDER BY cs.created_at DESC
          `
        } else {
          cards = await prisma.$queryRaw`
            SELECT 'card' as submission_type, cs.submission_id, cs.batch_id,
                   cs.proposed_card_number, cs.proposed_player_names, cs.proposed_team_names,
                   cs.status, cs.created_at, cs.reviewed_at, cs.review_notes,
                   s.name as series_name, st.name as set_name, st.year as set_year
            FROM card_submissions cs
            LEFT JOIN series s ON cs.series_id = s.series_id
            LEFT JOIN [set] st ON s.[set] = st.set_id
            WHERE cs.user_id = ${userId}
            ORDER BY cs.created_at DESC
          `
        }
        results.cards = cards.map(c => ({
          submission_type: 'card',
          submission_id: Number(c.submission_id),
          batch_id: c.batch_id,
          card_number: c.proposed_card_number,
          player_names: c.proposed_player_names,
          team_names: c.proposed_team_names,
          series_name: c.series_name,
          set_name: c.set_name,
          set_year: c.set_year,
          status: c.status,
          created_at: c.created_at,
          reviewed_at: c.reviewed_at,
          review_notes: c.review_notes
        }))
      }

      if (!type || type === 'card_edit') {
        let cardEdits
        if (status && ['pending', 'approved', 'rejected'].includes(status)) {
          cardEdits = await prisma.$queryRaw`
            SELECT 'card_edit' as submission_type, ces.submission_id, ces.card_id,
                   ces.proposed_card_number, ces.status, ces.created_at, ces.reviewed_at, ces.review_notes,
                   c.card_number as current_card_number, s.name as series_name,
                   st.name as set_name, st.year as set_year,
                   (SELECT STRING_AGG(p.first_name + ' ' + p.last_name, ', ')
                    FROM card_player_team cpt
                    JOIN player_team pt ON cpt.player_team = pt.player_team_id
                    JOIN player p ON pt.player = p.player_id
                    WHERE cpt.card = c.card_id) as player_names
            FROM card_edit_submissions ces
            JOIN card c ON ces.card_id = c.card_id
            LEFT JOIN series s ON c.series = s.series_id
            LEFT JOIN [set] st ON s.[set] = st.set_id
            WHERE ces.user_id = ${userId} AND ces.status = ${status}
            ORDER BY ces.created_at DESC
          `
        } else {
          cardEdits = await prisma.$queryRaw`
            SELECT 'card_edit' as submission_type, ces.submission_id, ces.card_id,
                   ces.proposed_card_number, ces.status, ces.created_at, ces.reviewed_at, ces.review_notes,
                   c.card_number as current_card_number, s.name as series_name,
                   st.name as set_name, st.year as set_year,
                   (SELECT STRING_AGG(p.first_name + ' ' + p.last_name, ', ')
                    FROM card_player_team cpt
                    JOIN player_team pt ON cpt.player_team = pt.player_team_id
                    JOIN player p ON pt.player = p.player_id
                    WHERE cpt.card = c.card_id) as player_names
            FROM card_edit_submissions ces
            JOIN card c ON ces.card_id = c.card_id
            LEFT JOIN series s ON c.series = s.series_id
            LEFT JOIN [set] st ON s.[set] = st.set_id
            WHERE ces.user_id = ${userId}
            ORDER BY ces.created_at DESC
          `
        }
        results.card_edits = cardEdits.map(ce => ({
          submission_type: 'card_edit',
          submission_id: Number(ce.submission_id),
          card_id: Number(ce.card_id),
          card_number: ce.current_card_number,
          proposed_card_number: ce.proposed_card_number,
          player_names: ce.player_names,
          series_name: ce.series_name,
          set_name: ce.set_name,
          set_year: ce.set_year,
          status: ce.status,
          created_at: ce.created_at,
          reviewed_at: ce.reviewed_at,
          review_notes: ce.review_notes
        }))
      }

      // Combine and sort by created_at
      const allSubmissions = [
        ...results.sets,
        ...results.series,
        ...results.cards,
        ...results.card_edits
      ].sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
        .slice(offsetNum, offsetNum + limitNum)

      res.json({
        success: true,
        submissions: allSubmissions,
        counts: {
          sets: results.sets.length,
          series: results.series.length,
          cards: results.cards.length,
          card_edits: results.card_edits.length,
          total: results.sets.length + results.series.length + results.cards.length + results.card_edits.length
        }
      })

    } catch (error) {
      console.error('Error fetching all submissions:', error.message)
      console.error('Stack:', error.stack)
      res.status(500).json({
        error: 'Server error',
        message: 'Failed to fetch submissions',
        details: process.env.NODE_ENV === 'development' ? error.message : undefined
      })
    }
  }
)

// Get user's contributor stats
router.get('/my-stats',
  authMiddleware,
  async (req, res) => {
    try {
      const userId = BigInt(req.user.userId)

      // Ensure stats record exists
      await ensureContributorStats(userId)

      const stats = await prisma.$queryRaw`
        SELECT
          cs.total_submissions,
          cs.pending_submissions,
          cs.approved_submissions,
          cs.rejected_submissions,
          cs.approval_rate,
          cs.trust_level,
          cs.trust_points,
          cs.first_submission_at,
          cs.last_submission_at,
          cs.current_streak_days,
          cs.longest_streak_days,
          cs.set_submissions,
          cs.series_submissions,
          cs.card_submissions
        FROM contributor_stats cs
        WHERE cs.user_id = ${userId}
      `

      if (stats.length === 0) {
        return res.json({
          success: true,
          stats: {
            total_submissions: 0,
            pending_submissions: 0,
            approved_submissions: 0,
            rejected_submissions: 0,
            approval_rate: null,
            trust_level: 'novice',
            trust_points: 0,
            first_submission_at: null,
            last_submission_at: null,
            current_streak_days: 0,
            longest_streak_days: 0,
            set_submissions: 0,
            series_submissions: 0,
            card_submissions: 0
          }
        })
      }

      res.json({
        success: true,
        stats: {
          total_submissions: stats[0].total_submissions,
          pending_submissions: stats[0].pending_submissions,
          approved_submissions: stats[0].approved_submissions,
          rejected_submissions: stats[0].rejected_submissions,
          approval_rate: stats[0].approval_rate ? Number(stats[0].approval_rate) : null,
          trust_level: stats[0].trust_level,
          trust_points: stats[0].trust_points,
          first_submission_at: stats[0].first_submission_at,
          last_submission_at: stats[0].last_submission_at,
          current_streak_days: stats[0].current_streak_days,
          longest_streak_days: stats[0].longest_streak_days,
          set_submissions: stats[0].set_submissions || 0,
          series_submissions: stats[0].series_submissions || 0,
          card_submissions: stats[0].card_submissions || 0
        }
      })

    } catch (error) {
      console.error('Error fetching contributor stats:', error)
      res.status(500).json({
        error: 'Server error',
        message: 'Failed to fetch contributor stats'
      })
    }
  }
)

module.exports = router
