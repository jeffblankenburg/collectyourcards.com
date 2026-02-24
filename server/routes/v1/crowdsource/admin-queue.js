const express = require('express')
const { prisma } = require('../../../config/prisma-singleton')
const { authMiddleware, adminCheck } = require('./middleware')

const router = express.Router()

// =============================================================================
// ADMIN STATS
// =============================================================================

// Get admin statistics (admin only)
router.get('/admin/stats',
  authMiddleware,
  adminCheck,
  async (req, res) => {
    try {
      const stats = await prisma.$queryRaw`
        SELECT
          (SELECT COUNT(*) FROM card_edit_submissions) as total_card_edits,
          (SELECT COUNT(*) FROM card_edit_submissions WHERE status = 'pending') as pending_card_edits,
          (SELECT COUNT(*) FROM set_submissions) as total_sets,
          (SELECT COUNT(*) FROM set_submissions WHERE status = 'pending') as pending_sets,
          (SELECT COUNT(*) FROM series_submissions) as total_series,
          (SELECT COUNT(*) FROM series_submissions WHERE status = 'pending') as pending_series,
          (SELECT COUNT(*) FROM card_submissions) as total_cards,
          (SELECT COUNT(*) FROM card_submissions WHERE status = 'pending') as pending_cards,
          (SELECT COUNT(*) FROM player_edit_submissions) as total_player_edits,
          (SELECT COUNT(*) FROM player_edit_submissions WHERE status = 'pending') as pending_player_edits,
          (SELECT COUNT(*) FROM player_alias_submissions) as total_player_aliases,
          (SELECT COUNT(*) FROM player_alias_submissions WHERE status = 'pending') as pending_player_aliases,
          (SELECT COUNT(*) FROM player_team_submissions) as total_player_teams,
          (SELECT COUNT(*) FROM player_team_submissions WHERE status = 'pending') as pending_player_teams,
          (SELECT COUNT(DISTINCT user_id) FROM contributor_stats) as unique_contributors,
          (SELECT COUNT(*) FROM contributor_stats WHERE trust_level != 'novice') as trusted_contributors
      `

      const s = stats[0]
      const totalPending = Number(s.pending_card_edits) + Number(s.pending_sets) + Number(s.pending_series) + Number(s.pending_cards) + Number(s.pending_player_edits) + Number(s.pending_player_aliases) + Number(s.pending_player_teams)

      res.json({
        success: true,
        stats: {
          total_card_edits: Number(s.total_card_edits),
          pending_card_edits: Number(s.pending_card_edits),
          total_sets: Number(s.total_sets),
          pending_sets: Number(s.pending_sets),
          total_series: Number(s.total_series),
          pending_series: Number(s.pending_series),
          total_cards: Number(s.total_cards),
          pending_cards: Number(s.pending_cards),
          total_player_edits: Number(s.total_player_edits),
          pending_player_edits: Number(s.pending_player_edits),
          total_player_aliases: Number(s.total_player_aliases),
          pending_player_aliases: Number(s.pending_player_aliases),
          total_player_teams: Number(s.total_player_teams),
          pending_player_teams: Number(s.pending_player_teams),
          total_pending: totalPending,
          unique_contributors: Number(s.unique_contributors),
          trusted_contributors: Number(s.trusted_contributors)
        }
      })

    } catch (error) {
      console.error('Error fetching admin stats:', error)
      res.status(500).json({
        error: 'Server error',
        message: 'Failed to fetch stats'
      })
    }
  }
)

// =============================================================================
// UNIFIED ADMIN REVIEW QUEUE (all submission types)
// =============================================================================

// Get all pending submissions for review (admin only)
router.get('/admin/review-all',
  authMiddleware,
  adminCheck,
  async (req, res) => {
    try {
      const { type, limit = 50, offset = 0 } = req.query
      const limitNum = Math.min(parseInt(limit) || 50, 100)
      const offsetNum = parseInt(offset) || 0

      const results = { sets: [], series: [], cards: [], card_edits: [], player_edits: [], player_aliases: [], player_teams: [], team_edits: [] }

      // Get set submissions
      if (!type || type === 'set') {
        const sets = await prisma.$queryRaw`
          SELECT ss.submission_id, ss.user_id, ss.proposed_name, ss.proposed_year,
                 ss.proposed_sport, ss.proposed_manufacturer, ss.proposed_description,
                 ss.submission_notes, ss.status, ss.created_at,
                 u.username as submitter_username, u.email as submitter_email,
                 cs.trust_level as submitter_trust_level, cs.approval_rate as submitter_approval_rate
          FROM set_submissions ss
          JOIN [user] u ON ss.user_id = u.user_id
          LEFT JOIN contributor_stats cs ON ss.user_id = cs.user_id
          WHERE ss.status = 'pending'
          ORDER BY ss.created_at ASC
        `
        results.sets = sets.map(s => ({
          submission_type: 'set',
          submission_id: Number(s.submission_id),
          user_id: Number(s.user_id),
          submitter_username: s.submitter_username,
          submitter_email: s.submitter_email,
          submitter_trust_level: s.submitter_trust_level || 'novice',
          submitter_approval_rate: s.submitter_approval_rate ? Number(s.submitter_approval_rate) : null,
          proposed_name: s.proposed_name,
          proposed_year: s.proposed_year,
          proposed_sport: s.proposed_sport,
          proposed_manufacturer: s.proposed_manufacturer,
          proposed_description: s.proposed_description,
          submission_notes: s.submission_notes,
          created_at: s.created_at
        }))
      }

      // Get series submissions
      if (!type || type === 'series') {
        const series = await prisma.$queryRaw`
          SELECT ss.submission_id, ss.user_id, ss.set_id, ss.set_submission_id,
                 ss.proposed_name, ss.proposed_description, ss.proposed_base_card_count,
                 ss.proposed_is_parallel, ss.proposed_parallel_name, ss.proposed_print_run,
                 ss.submission_notes, ss.status, ss.created_at,
                 s.name as set_name, s.year as set_year,
                 sub.proposed_name as pending_set_name, sub.proposed_year as pending_set_year,
                 u.username as submitter_username, u.email as submitter_email,
                 cs.trust_level as submitter_trust_level, cs.approval_rate as submitter_approval_rate
          FROM series_submissions ss
          LEFT JOIN [set] s ON ss.set_id = s.set_id
          LEFT JOIN set_submissions sub ON ss.set_submission_id = sub.submission_id
          JOIN [user] u ON ss.user_id = u.user_id
          LEFT JOIN contributor_stats cs ON ss.user_id = cs.user_id
          WHERE ss.status = 'pending'
          ORDER BY ss.created_at ASC
        `
        results.series = series.map(s => ({
          submission_type: 'series',
          submission_id: Number(s.submission_id),
          user_id: Number(s.user_id),
          set_id: s.set_id ? Number(s.set_id) : null,
          set_submission_id: s.set_submission_id ? Number(s.set_submission_id) : null,
          submitter_username: s.submitter_username,
          submitter_email: s.submitter_email,
          submitter_trust_level: s.submitter_trust_level || 'novice',
          submitter_approval_rate: s.submitter_approval_rate ? Number(s.submitter_approval_rate) : null,
          proposed_name: s.proposed_name,
          proposed_description: s.proposed_description,
          proposed_base_card_count: s.proposed_base_card_count ? Number(s.proposed_base_card_count) : null,
          proposed_is_parallel: s.proposed_is_parallel,
          proposed_parallel_name: s.proposed_parallel_name,
          proposed_print_run: s.proposed_print_run ? Number(s.proposed_print_run) : null,
          set_name: s.set_name || s.pending_set_name,
          set_year: s.set_year || s.pending_set_year,
          submission_notes: s.submission_notes,
          created_at: s.created_at
        }))
      }

      // Get card submissions (new cards)
      if (!type || type === 'card') {
        // Get valid colors from database for validation
        const validColors = await prisma.$queryRaw`SELECT name FROM color`
        const validColorNames = new Set(validColors.map(c => c.name.toLowerCase()))

        // Check if proposed_color column exists (for backwards compatibility)
        const hasColorColumn = await prisma.$queryRaw`
          SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
          WHERE TABLE_NAME = 'card_submissions' AND COLUMN_NAME = 'proposed_color'
        `
        const includeColor = hasColorColumn.length > 0

        const cards = includeColor
          ? await prisma.$queryRaw`
              SELECT cs.submission_id, cs.user_id, cs.series_id, cs.series_submission_id,
                     cs.batch_id, cs.batch_sequence, cs.proposed_card_number,
                     cs.proposed_player_names, cs.proposed_team_names,
                     cs.proposed_is_rookie, cs.proposed_is_autograph, cs.proposed_is_relic,
                     cs.proposed_is_short_print, cs.proposed_print_run, cs.proposed_notes,
                     cs.proposed_color, cs.submission_notes, cs.status, cs.created_at,
                     s.name as series_name, st.name as set_name, st.year as set_year,
                     u.username as submitter_username, u.email as submitter_email,
                     cst.trust_level as submitter_trust_level, cst.approval_rate as submitter_approval_rate
              FROM card_submissions cs
              LEFT JOIN series s ON cs.series_id = s.series_id
              LEFT JOIN [set] st ON s.[set] = st.set_id
              JOIN [user] u ON cs.user_id = u.user_id
              LEFT JOIN contributor_stats cst ON cs.user_id = cst.user_id
              WHERE cs.status = 'pending'
              ORDER BY cs.created_at ASC
            `
          : await prisma.$queryRaw`
              SELECT cs.submission_id, cs.user_id, cs.series_id, cs.series_submission_id,
                     cs.batch_id, cs.batch_sequence, cs.proposed_card_number,
                     cs.proposed_player_names, cs.proposed_team_names,
                     cs.proposed_is_rookie, cs.proposed_is_autograph, cs.proposed_is_relic,
                     cs.proposed_is_short_print, cs.proposed_print_run, cs.proposed_notes,
                     cs.submission_notes, cs.status, cs.created_at,
                     s.name as series_name, st.name as set_name, st.year as set_year,
                     u.username as submitter_username, u.email as submitter_email,
                     cst.trust_level as submitter_trust_level, cst.approval_rate as submitter_approval_rate
              FROM card_submissions cs
              LEFT JOIN series s ON cs.series_id = s.series_id
              LEFT JOIN [set] st ON s.[set] = st.set_id
              JOIN [user] u ON cs.user_id = u.user_id
              LEFT JOIN contributor_stats cst ON cs.user_id = cst.user_id
              WHERE cs.status = 'pending'
              ORDER BY cs.created_at ASC
            `

        results.cards = cards.map(c => {
          // Check if proposed_color is valid (exists in our color table)
          const proposedColor = c.proposed_color || null
          const hasInvalidColor = proposedColor && !validColorNames.has(proposedColor.toLowerCase())

          return {
            submission_type: 'card',
            submission_id: Number(c.submission_id),
            user_id: Number(c.user_id),
            series_id: c.series_id ? Number(c.series_id) : null,
            series_submission_id: c.series_submission_id ? Number(c.series_submission_id) : null,
            batch_id: c.batch_id,
            batch_sequence: c.batch_sequence,
            submitter_username: c.submitter_username,
            submitter_email: c.submitter_email,
            submitter_trust_level: c.submitter_trust_level || 'novice',
            submitter_approval_rate: c.submitter_approval_rate ? Number(c.submitter_approval_rate) : null,
            proposed_card_number: c.proposed_card_number,
            proposed_player_names: c.proposed_player_names,
            proposed_team_names: c.proposed_team_names,
            proposed_is_rookie: c.proposed_is_rookie,
            proposed_is_autograph: c.proposed_is_autograph,
            proposed_is_relic: c.proposed_is_relic,
            proposed_is_short_print: c.proposed_is_short_print,
            proposed_print_run: c.proposed_print_run ? Number(c.proposed_print_run) : null,
            proposed_color: proposedColor,
            proposed_notes: c.proposed_notes,
            series_name: c.series_name,
            set_name: c.set_name,
            set_year: c.set_year ? Number(c.set_year) : null,
            submission_notes: c.submission_notes,
            created_at: c.created_at,
            // Flag for admin review - true if color was provided but doesn't match our database
            has_invalid_color: hasInvalidColor
          }
        })
      }

      // Get card edit submissions
      if (!type || type === 'card_edit') {
        const cardEdits = await prisma.$queryRaw`
          SELECT ces.submission_id, ces.card_id, ces.user_id,
                 ces.proposed_card_number, ces.proposed_is_rookie, ces.proposed_is_autograph,
                 ces.proposed_is_relic, ces.proposed_is_short_print, ces.proposed_print_run,
                 ces.proposed_notes, ces.submission_notes, ces.created_at,
                 c.card_number as current_card_number, c.is_rookie as current_is_rookie,
                 c.is_autograph as current_is_autograph, c.is_relic as current_is_relic,
                 c.is_short_print as current_is_short_print, c.print_run as current_print_run,
                 c.notes as current_notes,
                 s.name as series_name, st.name as set_name, st.year as set_year,
                 (SELECT STRING_AGG(p.first_name + ' ' + p.last_name, ', ')
                  FROM card_player_team cpt
                  JOIN player_team pt ON cpt.player_team = pt.player_team_id
                  JOIN player p ON pt.player = p.player_id
                  WHERE cpt.card = c.card_id) as player_names,
                 u.username as submitter_username, u.email as submitter_email,
                 cs.trust_level as submitter_trust_level, cs.approval_rate as submitter_approval_rate
          FROM card_edit_submissions ces
          JOIN card c ON ces.card_id = c.card_id
          LEFT JOIN series s ON c.series = s.series_id
          LEFT JOIN [set] st ON s.[set] = st.set_id
          JOIN [user] u ON ces.user_id = u.user_id
          LEFT JOIN contributor_stats cs ON ces.user_id = cs.user_id
          WHERE ces.status = 'pending'
          ORDER BY ces.created_at ASC
        `
        results.card_edits = cardEdits.map(ce => ({
          submission_type: 'card_edit',
          submission_id: Number(ce.submission_id),
          card_id: Number(ce.card_id),
          user_id: Number(ce.user_id),
          submitter_username: ce.submitter_username,
          submitter_email: ce.submitter_email,
          submitter_trust_level: ce.submitter_trust_level || 'novice',
          submitter_approval_rate: ce.submitter_approval_rate ? Number(ce.submitter_approval_rate) : null,
          proposed_card_number: ce.proposed_card_number,
          proposed_is_rookie: ce.proposed_is_rookie,
          proposed_is_autograph: ce.proposed_is_autograph,
          proposed_is_relic: ce.proposed_is_relic,
          proposed_is_short_print: ce.proposed_is_short_print,
          proposed_print_run: ce.proposed_print_run ? Number(ce.proposed_print_run) : null,
          proposed_notes: ce.proposed_notes,
          current_card_number: ce.current_card_number,
          current_is_rookie: ce.current_is_rookie,
          current_is_autograph: ce.current_is_autograph,
          current_is_relic: ce.current_is_relic,
          current_is_short_print: ce.current_is_short_print,
          current_print_run: ce.current_print_run ? Number(ce.current_print_run) : null,
          current_notes: ce.current_notes,
          player_names: ce.player_names,
          series_name: ce.series_name,
          set_name: ce.set_name,
          set_year: ce.set_year ? Number(ce.set_year) : null,
          submission_notes: ce.submission_notes,
          created_at: ce.created_at
        }))
      }

      // Get player edit submissions
      if (!type || type === 'player_edit') {
        const playerEdits = await prisma.$queryRaw`
          SELECT pes.submission_id, pes.player_id, pes.user_id,
                 pes.previous_first_name, pes.previous_last_name, pes.previous_nick_name,
                 pes.previous_birthdate, pes.previous_is_hof,
                 pes.proposed_first_name, pes.proposed_last_name, pes.proposed_nick_name,
                 pes.proposed_birthdate, pes.proposed_is_hof,
                 pes.submission_notes, pes.status, pes.created_at,
                 p.first_name as current_first_name, p.last_name as current_last_name,
                 u.username as submitter_username, u.email as submitter_email,
                 cs.trust_level as submitter_trust_level, cs.approval_rate as submitter_approval_rate
          FROM player_edit_submissions pes
          JOIN player p ON pes.player_id = p.player_id
          JOIN [user] u ON pes.user_id = u.user_id
          LEFT JOIN contributor_stats cs ON pes.user_id = cs.user_id
          WHERE pes.status = 'pending'
          ORDER BY pes.created_at ASC
        `
        results.player_edits = playerEdits.map(pe => ({
          submission_type: 'player_edit',
          submission_id: Number(pe.submission_id),
          player_id: Number(pe.player_id),
          user_id: Number(pe.user_id),
          submitter_username: pe.submitter_username,
          submitter_email: pe.submitter_email,
          submitter_trust_level: pe.submitter_trust_level || 'novice',
          submitter_approval_rate: pe.submitter_approval_rate ? Number(pe.submitter_approval_rate) : null,
          player_name: `${pe.current_first_name} ${pe.current_last_name}`,
          previous_first_name: pe.previous_first_name,
          previous_last_name: pe.previous_last_name,
          previous_nick_name: pe.previous_nick_name,
          previous_birthdate: pe.previous_birthdate,
          previous_is_hof: pe.previous_is_hof,
          proposed_first_name: pe.proposed_first_name,
          proposed_last_name: pe.proposed_last_name,
          proposed_nick_name: pe.proposed_nick_name,
          proposed_birthdate: pe.proposed_birthdate,
          proposed_is_hof: pe.proposed_is_hof,
          submission_notes: pe.submission_notes,
          created_at: pe.created_at
        }))
      }

      // Get player alias submissions
      if (!type || type === 'player_alias') {
        const playerAliases = await prisma.$queryRaw`
          SELECT pas.submission_id, pas.player_id, pas.user_id,
                 pas.proposed_alias_name, pas.proposed_alias_type,
                 pas.submission_notes, pas.status, pas.created_at,
                 p.first_name, p.last_name,
                 u.username as submitter_username, u.email as submitter_email,
                 cs.trust_level as submitter_trust_level, cs.approval_rate as submitter_approval_rate
          FROM player_alias_submissions pas
          JOIN player p ON pas.player_id = p.player_id
          JOIN [user] u ON pas.user_id = u.user_id
          LEFT JOIN contributor_stats cs ON pas.user_id = cs.user_id
          WHERE pas.status = 'pending'
          ORDER BY pas.created_at ASC
        `
        results.player_aliases = playerAliases.map(pa => ({
          submission_type: 'player_alias',
          submission_id: Number(pa.submission_id),
          player_id: Number(pa.player_id),
          user_id: Number(pa.user_id),
          submitter_username: pa.submitter_username,
          submitter_email: pa.submitter_email,
          submitter_trust_level: pa.submitter_trust_level || 'novice',
          submitter_approval_rate: pa.submitter_approval_rate ? Number(pa.submitter_approval_rate) : null,
          player_name: `${pa.first_name} ${pa.last_name}`,
          proposed_alias_name: pa.proposed_alias_name,
          proposed_alias_type: pa.proposed_alias_type,
          submission_notes: pa.submission_notes,
          created_at: pa.created_at
        }))
      }

      // Get player-team submissions
      if (!type || type === 'player_team') {
        const playerTeams = await prisma.$queryRaw`
          SELECT pts.submission_id, pts.player_id, pts.team_id, pts.user_id,
                 pts.action_type, pts.submission_notes, pts.status, pts.created_at,
                 p.first_name, p.last_name, t.name as team_name,
                 u.username as submitter_username, u.email as submitter_email,
                 cs.trust_level as submitter_trust_level, cs.approval_rate as submitter_approval_rate
          FROM player_team_submissions pts
          JOIN player p ON pts.player_id = p.player_id
          JOIN team t ON pts.team_id = t.team_Id
          JOIN [user] u ON pts.user_id = u.user_id
          LEFT JOIN contributor_stats cs ON pts.user_id = cs.user_id
          WHERE pts.status = 'pending'
          ORDER BY pts.created_at ASC
        `
        results.player_teams = playerTeams.map(pt => ({
          submission_type: 'player_team',
          submission_id: Number(pt.submission_id),
          player_id: Number(pt.player_id),
          team_id: Number(pt.team_id),
          user_id: Number(pt.user_id),
          submitter_username: pt.submitter_username,
          submitter_email: pt.submitter_email,
          submitter_trust_level: pt.submitter_trust_level || 'novice',
          submitter_approval_rate: pt.submitter_approval_rate ? Number(pt.submitter_approval_rate) : null,
          player_name: `${pt.first_name} ${pt.last_name}`,
          team_name: pt.team_name,
          action_type: pt.action_type,
          submission_notes: pt.submission_notes,
          created_at: pt.created_at
        }))
      }

      // Get team edit submissions
      if (!type || type === 'team_edit') {
        const teamEdits = await prisma.$queryRaw`
          SELECT tes.submission_id, tes.team_id, tes.user_id,
                 tes.previous_name, tes.previous_city, tes.previous_mascot,
                 tes.previous_abbreviation, tes.previous_primary_color, tes.previous_secondary_color,
                 tes.proposed_name, tes.proposed_city, tes.proposed_mascot,
                 tes.proposed_abbreviation, tes.proposed_primary_color, tes.proposed_secondary_color,
                 tes.submission_notes, tes.created_at,
                 t.name as current_team_name,
                 u.username as submitter_username, u.email as submitter_email,
                 cs.trust_level as submitter_trust_level, cs.approval_rate as submitter_approval_rate
          FROM team_edit_submissions tes
          JOIN team t ON tes.team_id = t.team_Id
          JOIN [user] u ON tes.user_id = u.user_id
          LEFT JOIN contributor_stats cs ON tes.user_id = cs.user_id
          WHERE tes.status = 'pending'
          ORDER BY tes.created_at ASC
        `
        results.team_edits = teamEdits.map(te => ({
          submission_type: 'team_edit',
          submission_id: Number(te.submission_id),
          team_id: Number(te.team_id),
          user_id: Number(te.user_id),
          submitter_username: te.submitter_username,
          submitter_email: te.submitter_email,
          submitter_trust_level: te.submitter_trust_level || 'novice',
          submitter_approval_rate: te.submitter_approval_rate ? Number(te.submitter_approval_rate) : null,
          current_team_name: te.current_team_name,
          previous_name: te.previous_name,
          previous_city: te.previous_city,
          previous_mascot: te.previous_mascot,
          previous_abbreviation: te.previous_abbreviation,
          previous_primary_color: te.previous_primary_color,
          previous_secondary_color: te.previous_secondary_color,
          proposed_name: te.proposed_name,
          proposed_city: te.proposed_city,
          proposed_mascot: te.proposed_mascot,
          proposed_abbreviation: te.proposed_abbreviation,
          proposed_primary_color: te.proposed_primary_color,
          proposed_secondary_color: te.proposed_secondary_color,
          submission_notes: te.submission_notes,
          created_at: te.created_at
        }))
      }

      // Combine and sort by created_at
      const allSubmissions = [
        ...results.sets,
        ...results.series,
        ...results.cards,
        ...results.card_edits,
        ...results.player_edits,
        ...results.player_aliases,
        ...results.player_teams,
        ...results.team_edits
      ].sort((a, b) => new Date(a.created_at) - new Date(b.created_at))
        .slice(offsetNum, offsetNum + limitNum)

      res.json({
        success: true,
        submissions: allSubmissions,
        counts: {
          sets: results.sets.length,
          series: results.series.length,
          cards: results.cards.length,
          card_edits: results.card_edits.length,
          player_edits: results.player_edits.length,
          player_aliases: results.player_aliases.length,
          player_teams: results.player_teams.length,
          team_edits: results.team_edits.length,
          total: results.sets.length + results.series.length + results.cards.length + results.card_edits.length + results.player_edits.length + results.player_aliases.length + results.player_teams.length + results.team_edits.length
        }
      })

    } catch (error) {
      console.error('Error fetching admin review queue:', error)
      res.status(500).json({
        error: 'Server error',
        message: 'Failed to fetch review queue'
      })
    }
  }
)

module.exports = router
