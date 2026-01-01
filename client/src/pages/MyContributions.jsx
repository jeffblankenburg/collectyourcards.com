import React, { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import axios from 'axios'
import { useAuth } from '../contexts/AuthContext'
import Icon from '../components/Icon'
import SuggestSetModal from '../components/modals/SuggestSetModal'
import SuggestSeriesModal from '../components/modals/SuggestSeriesModal'
import SuggestCardsModal from '../components/modals/SuggestCardsModal'
import './MyContributionsScoped.css'

function MyContributions() {
  const navigate = useNavigate()
  const { isAuthenticated } = useAuth()
  const [allSubmissions, setAllSubmissions] = useState({
    card_edits: [],
    sets: [],
    series: [],
    cards: []
  })
  const [stats, setStats] = useState(null)
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('all') // all, card_edits, sets, series, cards
  const [statusFilter, setStatusFilter] = useState('all') // all, pending, approved, rejected
  const [error, setError] = useState(null)

  // Modal states
  const [showSetModal, setShowSetModal] = useState(false)
  const [showSeriesModal, setShowSeriesModal] = useState(false)
  const [showCardsModal, setShowCardsModal] = useState(false)

  // Set page title
  useEffect(() => {
    document.title = 'My Contributions - Collect Your Cards'
  }, [])

  // Redirect if not authenticated
  useEffect(() => {
    if (!isAuthenticated) {
      navigate('/auth/login')
    }
  }, [isAuthenticated, navigate])

  const fetchData = useCallback(async () => {
    if (!isAuthenticated) return

    setLoading(true)
    setError(null)

    try {
      const statusParam = statusFilter === 'all' ? '' : `?status=${statusFilter}`
      const [allSubmissionsRes, statsRes] = await Promise.all([
        axios.get(`/api/crowdsource/my-all-submissions${statusParam}`),
        axios.get('/api/crowdsource/my-stats')
      ])

      setAllSubmissions(allSubmissionsRes.data.submissions || {
        card_edits: [],
        sets: [],
        series: [],
        cards: []
      })
      setStats(statsRes.data.stats || null)
    } catch (err) {
      console.error('Error fetching contributions:', err)
      setError('Failed to load your contributions. Please try again.')
    } finally {
      setLoading(false)
    }
  }, [isAuthenticated, statusFilter])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const getTrustLevelInfo = (level) => {
    const levels = {
      novice: { label: 'Novice', color: '#9ca3af', nextLevel: 'Contributor', pointsNeeded: 50 },
      contributor: { label: 'Contributor', color: '#22c55e', nextLevel: 'Trusted', pointsNeeded: 150 },
      trusted: { label: 'Trusted', color: '#3b82f6', nextLevel: 'Expert', pointsNeeded: 300 },
      expert: { label: 'Expert', color: '#a855f7', nextLevel: 'Master', pointsNeeded: 500 },
      master: { label: 'Master', color: '#f59e0b', nextLevel: null, pointsNeeded: null }
    }
    return levels[level] || levels.novice
  }

  const getStatusBadge = (status) => {
    switch (status) {
      case 'pending':
        return <span className="my-contributions-status-badge pending"><Icon name="clock" size={12} /> Pending</span>
      case 'approved':
        return <span className="my-contributions-status-badge approved"><Icon name="check" size={12} /> Approved</span>
      case 'rejected':
        return <span className="my-contributions-status-badge rejected"><Icon name="x" size={12} /> Rejected</span>
      default:
        return null
    }
  }

  const getTypeBadge = (type) => {
    switch (type) {
      case 'card_edit':
        return <span className="my-contributions-type-badge card-edit"><Icon name="edit" size={12} /> Card Edit</span>
      case 'set':
        return <span className="my-contributions-type-badge set"><Icon name="archive" size={12} /> New Set</span>
      case 'series':
        return <span className="my-contributions-type-badge series"><Icon name="layers" size={12} /> New Series</span>
      case 'card':
        return <span className="my-contributions-type-badge card"><Icon name="card" size={12} /> New Card</span>
      default:
        return null
    }
  }

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A'
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit'
    })
  }

  const getCardEditChangeSummary = (submission) => {
    const changes = []
    if (submission.proposed_card_number !== null && submission.proposed_card_number !== submission.current_card_number) {
      changes.push(`Card # → ${submission.proposed_card_number}`)
    }
    if (submission.proposed_is_rookie !== null && submission.proposed_is_rookie !== submission.current_is_rookie) {
      changes.push(submission.proposed_is_rookie ? 'Added Rookie' : 'Removed Rookie')
    }
    if (submission.proposed_is_autograph !== null && submission.proposed_is_autograph !== submission.current_is_autograph) {
      changes.push(submission.proposed_is_autograph ? 'Added Autograph' : 'Removed Autograph')
    }
    if (submission.proposed_is_relic !== null && submission.proposed_is_relic !== submission.current_is_relic) {
      changes.push(submission.proposed_is_relic ? 'Added Relic' : 'Removed Relic')
    }
    if (submission.proposed_is_short_print !== null && submission.proposed_is_short_print !== submission.current_is_short_print) {
      changes.push(submission.proposed_is_short_print ? 'Added SP' : 'Removed SP')
    }
    if (submission.proposed_print_run !== null && submission.proposed_print_run !== submission.current_print_run) {
      changes.push(`Print Run → /${submission.proposed_print_run}`)
    }
    if (submission.proposed_notes !== null && submission.proposed_notes !== submission.current_notes) {
      changes.push('Updated Notes')
    }
    return changes.length > 0 ? changes.join(', ') : 'No changes'
  }

  // Combine all submissions for the unified view
  const getCombinedSubmissions = () => {
    const combined = []

    if (activeTab === 'all' || activeTab === 'card_edits') {
      allSubmissions.card_edits.forEach(s => combined.push({ ...s, type: 'card_edit' }))
    }
    if (activeTab === 'all' || activeTab === 'sets') {
      allSubmissions.sets.forEach(s => combined.push({ ...s, type: 'set' }))
    }
    if (activeTab === 'all' || activeTab === 'series') {
      allSubmissions.series.forEach(s => combined.push({ ...s, type: 'series' }))
    }
    if (activeTab === 'all' || activeTab === 'cards') {
      allSubmissions.cards.forEach(s => combined.push({ ...s, type: 'card' }))
    }

    // Sort by created_at descending
    return combined.sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
  }

  const getSubmissionCounts = () => {
    return {
      all: (allSubmissions.card_edits?.length || 0) +
           (allSubmissions.sets?.length || 0) +
           (allSubmissions.series?.length || 0) +
           (allSubmissions.cards?.length || 0),
      card_edits: allSubmissions.card_edits?.length || 0,
      sets: allSubmissions.sets?.length || 0,
      series: allSubmissions.series?.length || 0,
      cards: allSubmissions.cards?.length || 0
    }
  }

  const handleSubmissionSuccess = () => {
    fetchData() // Refresh the data
  }

  const renderSubmissionCard = (submission) => {
    switch (submission.type) {
      case 'card_edit':
        return (
          <div key={`edit-${submission.submission_id}`} className={`my-contributions-submission-card ${submission.status}`}>
            <div className="my-contributions-submission-header">
              <div className="my-contributions-card-info">
                {getTypeBadge(submission.type)}
                <span
                  className="my-contributions-card-number clickable"
                  onClick={() => navigate(`/cards/${submission.card_id}`)}
                >
                  #{submission.current_card_number}
                </span>
                <span className="my-contributions-player-name">{submission.player_names || 'Unknown Player'}</span>
              </div>
              {getStatusBadge(submission.status)}
            </div>

            <div className="my-contributions-submission-details">
              <div className="my-contributions-series-info">
                <Icon name="layers" size={14} />
                <span>{submission.series_name} • {submission.set_name} {submission.set_year}</span>
              </div>

              <div className="my-contributions-changes">
                <strong>Proposed Changes:</strong> {getCardEditChangeSummary(submission)}
              </div>

              {submission.submission_notes && (
                <div className="my-contributions-notes">
                  <strong>Your Notes:</strong> {submission.submission_notes}
                </div>
              )}

              {submission.status === 'rejected' && submission.review_notes && (
                <div className="my-contributions-review-notes rejected">
                  <Icon name="message-circle" size={14} />
                  <div>
                    <strong>Reviewer Feedback:</strong>
                    <p>{submission.review_notes}</p>
                  </div>
                </div>
              )}
            </div>

            <div className="my-contributions-submission-footer">
              <span className="my-contributions-date">
                <Icon name="calendar" size={12} /> Submitted {formatDate(submission.created_at)}
              </span>
              {submission.reviewed_at && (
                <span className="my-contributions-date">
                  <Icon name="check-square" size={12} /> Reviewed {formatDate(submission.reviewed_at)}
                </span>
              )}
            </div>
          </div>
        )

      case 'set':
        return (
          <div key={`set-${submission.submission_id}`} className={`my-contributions-submission-card ${submission.status}`}>
            <div className="my-contributions-submission-header">
              <div className="my-contributions-card-info">
                {getTypeBadge(submission.type)}
                <span className="my-contributions-set-name">{submission.proposed_name}</span>
              </div>
              {getStatusBadge(submission.status)}
            </div>

            <div className="my-contributions-submission-details">
              <div className="my-contributions-set-info">
                <span className="my-contributions-set-detail">
                  <Icon name="calendar" size={14} /> {submission.proposed_year}
                </span>
                <span className="my-contributions-set-detail">
                  <Icon name="activity" size={14} /> {submission.proposed_sport}
                </span>
                {submission.proposed_manufacturer && (
                  <span className="my-contributions-set-detail">
                    <Icon name="briefcase" size={14} /> {submission.proposed_manufacturer}
                  </span>
                )}
              </div>

              {submission.proposed_description && (
                <div className="my-contributions-description">
                  {submission.proposed_description}
                </div>
              )}

              {submission.submission_notes && (
                <div className="my-contributions-notes">
                  <strong>Your Notes:</strong> {submission.submission_notes}
                </div>
              )}

              {submission.status === 'rejected' && submission.review_notes && (
                <div className="my-contributions-review-notes rejected">
                  <Icon name="message-circle" size={14} />
                  <div>
                    <strong>Reviewer Feedback:</strong>
                    <p>{submission.review_notes}</p>
                  </div>
                </div>
              )}

              {submission.status === 'approved' && submission.created_set_id && (
                <div className="my-contributions-created-link">
                  <Icon name="check-circle" size={14} />
                  <span>Set created! View it in the database.</span>
                </div>
              )}
            </div>

            <div className="my-contributions-submission-footer">
              <span className="my-contributions-date">
                <Icon name="calendar" size={12} /> Submitted {formatDate(submission.created_at)}
              </span>
              {submission.reviewed_at && (
                <span className="my-contributions-date">
                  <Icon name="check-square" size={12} /> Reviewed {formatDate(submission.reviewed_at)}
                </span>
              )}
            </div>
          </div>
        )

      case 'series':
        return (
          <div key={`series-${submission.submission_id}`} className={`my-contributions-submission-card ${submission.status}`}>
            <div className="my-contributions-submission-header">
              <div className="my-contributions-card-info">
                {getTypeBadge(submission.type)}
                <span className="my-contributions-series-name">{submission.proposed_name}</span>
              </div>
              {getStatusBadge(submission.status)}
            </div>

            <div className="my-contributions-submission-details">
              <div className="my-contributions-series-info">
                <Icon name="archive" size={14} />
                <span>
                  {submission.set_name ? `${submission.set_name} ${submission.set_year}` : 'Pending Set Submission'}
                </span>
              </div>

              <div className="my-contributions-series-meta">
                {submission.proposed_base_card_count && (
                  <span className="my-contributions-meta-item">
                    <Icon name="hash" size={12} /> {submission.proposed_base_card_count} cards
                  </span>
                )}
                {submission.proposed_is_parallel && (
                  <span className="my-contributions-meta-item parallel">
                    <Icon name="copy" size={12} /> Parallel: {submission.proposed_parallel_name || 'Yes'}
                  </span>
                )}
                {submission.proposed_print_run && (
                  <span className="my-contributions-meta-item">
                    <Icon name="printer" size={12} /> /{submission.proposed_print_run}
                  </span>
                )}
              </div>

              {submission.proposed_description && (
                <div className="my-contributions-description">
                  {submission.proposed_description}
                </div>
              )}

              {submission.submission_notes && (
                <div className="my-contributions-notes">
                  <strong>Your Notes:</strong> {submission.submission_notes}
                </div>
              )}

              {submission.status === 'rejected' && submission.review_notes && (
                <div className="my-contributions-review-notes rejected">
                  <Icon name="message-circle" size={14} />
                  <div>
                    <strong>Reviewer Feedback:</strong>
                    <p>{submission.review_notes}</p>
                  </div>
                </div>
              )}
            </div>

            <div className="my-contributions-submission-footer">
              <span className="my-contributions-date">
                <Icon name="calendar" size={12} /> Submitted {formatDate(submission.created_at)}
              </span>
              {submission.reviewed_at && (
                <span className="my-contributions-date">
                  <Icon name="check-square" size={12} /> Reviewed {formatDate(submission.reviewed_at)}
                </span>
              )}
            </div>
          </div>
        )

      case 'card':
        return (
          <div key={`card-${submission.submission_id}`} className={`my-contributions-submission-card ${submission.status}`}>
            <div className="my-contributions-submission-header">
              <div className="my-contributions-card-info">
                {getTypeBadge(submission.type)}
                <span className="my-contributions-card-number">#{submission.proposed_card_number}</span>
                <span className="my-contributions-player-name">{submission.proposed_player_names || 'Unknown Player'}</span>
              </div>
              {getStatusBadge(submission.status)}
            </div>

            <div className="my-contributions-submission-details">
              <div className="my-contributions-series-info">
                <Icon name="layers" size={14} />
                <span>
                  {submission.series_name ? submission.series_name : 'Pending Series Submission'}
                </span>
              </div>

              {submission.proposed_team_names && (
                <div className="my-contributions-team-info">
                  <Icon name="users" size={14} />
                  <span>{submission.proposed_team_names}</span>
                </div>
              )}

              <div className="my-contributions-card-attributes">
                {submission.proposed_is_rookie && (
                  <span className="my-contributions-attribute rc">RC</span>
                )}
                {submission.proposed_is_autograph && (
                  <span className="my-contributions-attribute auto">AUTO</span>
                )}
                {submission.proposed_is_relic && (
                  <span className="my-contributions-attribute relic">RELIC</span>
                )}
                {submission.proposed_is_short_print && (
                  <span className="my-contributions-attribute sp">SP</span>
                )}
                {submission.proposed_print_run && (
                  <span className="my-contributions-attribute print-run">/{submission.proposed_print_run}</span>
                )}
              </div>

              {submission.batch_id && (
                <div className="my-contributions-batch-info">
                  <Icon name="package" size={12} />
                  <span>Batch #{submission.batch_sequence} of bulk submission</span>
                </div>
              )}

              {submission.submission_notes && (
                <div className="my-contributions-notes">
                  <strong>Your Notes:</strong> {submission.submission_notes}
                </div>
              )}

              {submission.status === 'rejected' && submission.review_notes && (
                <div className="my-contributions-review-notes rejected">
                  <Icon name="message-circle" size={14} />
                  <div>
                    <strong>Reviewer Feedback:</strong>
                    <p>{submission.review_notes}</p>
                  </div>
                </div>
              )}
            </div>

            <div className="my-contributions-submission-footer">
              <span className="my-contributions-date">
                <Icon name="calendar" size={12} /> Submitted {formatDate(submission.created_at)}
              </span>
              {submission.reviewed_at && (
                <span className="my-contributions-date">
                  <Icon name="check-square" size={12} /> Reviewed {formatDate(submission.reviewed_at)}
                </span>
              )}
            </div>
          </div>
        )

      default:
        return null
    }
  }

  if (!isAuthenticated) {
    return null
  }

  const counts = getSubmissionCounts()
  const combinedSubmissions = getCombinedSubmissions()

  return (
    <div className="my-contributions-page">
      <div className="my-contributions-container">
        {/* Header */}
        <div className="my-contributions-header">
          <div className="my-contributions-header-content">
            <h1><Icon name="users" size={28} /> My Contributions</h1>
            <p>Track your data contributions and help improve the database</p>
          </div>
        </div>

        {/* Quick Actions - Contribution Hub */}
        <div className="my-contributions-actions-section">
          <h2 className="my-contributions-section-title">
            <Icon name="plus-circle" size={20} />
            Contribute New Data
          </h2>
          <div className="my-contributions-actions-grid">
            <button
              className="my-contributions-action-card"
              onClick={() => setShowSetModal(true)}
            >
              <div className="my-contributions-action-icon set">
                <Icon name="archive" size={28} />
              </div>
              <div className="my-contributions-action-content">
                <h3>Submit New Set</h3>
                <p>Add a set that's missing from our database</p>
              </div>
              <Icon name="chevron-right" size={20} className="my-contributions-action-arrow" />
            </button>

            <button
              className="my-contributions-action-card"
              onClick={() => setShowSeriesModal(true)}
            >
              <div className="my-contributions-action-icon series">
                <Icon name="layers" size={28} />
              </div>
              <div className="my-contributions-action-content">
                <h3>Submit New Series</h3>
                <p>Add a series or parallel to an existing set</p>
              </div>
              <Icon name="chevron-right" size={20} className="my-contributions-action-arrow" />
            </button>

            <button
              className="my-contributions-action-card"
              onClick={() => setShowCardsModal(true)}
            >
              <div className="my-contributions-action-icon cards">
                <Icon name="card" size={28} />
              </div>
              <div className="my-contributions-action-content">
                <h3>Submit New Cards</h3>
                <p>Add cards individually or in bulk</p>
              </div>
              <Icon name="chevron-right" size={20} className="my-contributions-action-arrow" />
            </button>

            <button
              className="my-contributions-action-card"
              onClick={() => navigate('/search')}
            >
              <div className="my-contributions-action-icon edit">
                <Icon name="edit" size={28} />
              </div>
              <div className="my-contributions-action-content">
                <h3>Edit Existing Card</h3>
                <p>Find a card and suggest corrections</p>
              </div>
              <Icon name="chevron-right" size={20} className="my-contributions-action-arrow" />
            </button>
          </div>
        </div>

        {/* Stats Cards */}
        {stats && (
          <div className="my-contributions-stats-grid">
            <div className="my-contributions-stat-card">
              <div className="my-contributions-stat-icon total">
                <Icon name="file-text" size={24} />
              </div>
              <div className="my-contributions-stat-content">
                <span className="my-contributions-stat-value">{stats.total_submissions}</span>
                <span className="my-contributions-stat-label">Total Submissions</span>
              </div>
            </div>

            <div className="my-contributions-stat-card">
              <div className="my-contributions-stat-icon pending">
                <Icon name="clock" size={24} />
              </div>
              <div className="my-contributions-stat-content">
                <span className="my-contributions-stat-value">{stats.pending_submissions}</span>
                <span className="my-contributions-stat-label">Pending Review</span>
              </div>
            </div>

            <div className="my-contributions-stat-card">
              <div className="my-contributions-stat-icon approved">
                <Icon name="check-circle" size={24} />
              </div>
              <div className="my-contributions-stat-content">
                <span className="my-contributions-stat-value">{stats.approved_submissions}</span>
                <span className="my-contributions-stat-label">Approved</span>
              </div>
            </div>

            <div className="my-contributions-stat-card">
              <div className="my-contributions-stat-icon rate">
                <Icon name="trending-up" size={24} />
              </div>
              <div className="my-contributions-stat-content">
                <span className="my-contributions-stat-value">
                  {stats.approval_rate !== null ? `${stats.approval_rate.toFixed(0)}%` : '—'}
                </span>
                <span className="my-contributions-stat-label">Approval Rate</span>
              </div>
            </div>
          </div>
        )}

        {/* Trust Level Card */}
        {stats && (
          <div className="my-contributions-trust-card">
            <div className="my-contributions-trust-header">
              <div className="my-contributions-trust-badge" style={{ '--trust-color': getTrustLevelInfo(stats.trust_level).color }}>
                <Icon name="shield" size={20} />
                <span>{getTrustLevelInfo(stats.trust_level).label}</span>
              </div>
              <div className="my-contributions-trust-points">
                <span className="my-contributions-points-value">{stats.trust_points}</span>
                <span className="my-contributions-points-label">Trust Points</span>
              </div>
            </div>
            {getTrustLevelInfo(stats.trust_level).nextLevel && (
              <div className="my-contributions-trust-progress">
                <div className="my-contributions-progress-text">
                  <span>{stats.trust_points} / {getTrustLevelInfo(stats.trust_level).pointsNeeded} points to {getTrustLevelInfo(stats.trust_level).nextLevel}</span>
                </div>
                <div className="my-contributions-progress-bar">
                  <div
                    className="my-contributions-progress-fill"
                    style={{
                      width: `${Math.min(100, (stats.trust_points / getTrustLevelInfo(stats.trust_level).pointsNeeded) * 100)}%`,
                      '--trust-color': getTrustLevelInfo(stats.trust_level).color
                    }}
                  />
                </div>
              </div>
            )}
            <div className="my-contributions-trust-info">
              <Icon name="info" size={14} />
              <span>Earn points by having your submissions approved. Higher trust levels mean your contributions are prioritized for review.</span>
            </div>
          </div>
        )}

        {/* Type Tabs */}
        <div className="my-contributions-type-tabs">
          <button
            className={`my-contributions-type-tab ${activeTab === 'all' ? 'active' : ''}`}
            onClick={() => setActiveTab('all')}
          >
            All <span className="my-contributions-tab-count">{counts.all}</span>
          </button>
          <button
            className={`my-contributions-type-tab ${activeTab === 'card_edits' ? 'active' : ''}`}
            onClick={() => setActiveTab('card_edits')}
          >
            <Icon name="edit" size={14} /> Card Edits <span className="my-contributions-tab-count">{counts.card_edits}</span>
          </button>
          <button
            className={`my-contributions-type-tab ${activeTab === 'sets' ? 'active' : ''}`}
            onClick={() => setActiveTab('sets')}
          >
            <Icon name="archive" size={14} /> Sets <span className="my-contributions-tab-count">{counts.sets}</span>
          </button>
          <button
            className={`my-contributions-type-tab ${activeTab === 'series' ? 'active' : ''}`}
            onClick={() => setActiveTab('series')}
          >
            <Icon name="layers" size={14} /> Series <span className="my-contributions-tab-count">{counts.series}</span>
          </button>
          <button
            className={`my-contributions-type-tab ${activeTab === 'cards' ? 'active' : ''}`}
            onClick={() => setActiveTab('cards')}
          >
            <Icon name="card" size={14} /> Cards <span className="my-contributions-tab-count">{counts.cards}</span>
          </button>
        </div>

        {/* Status Filter Tabs */}
        <div className="my-contributions-filters">
          <button
            className={`my-contributions-filter-btn ${statusFilter === 'all' ? 'active' : ''}`}
            onClick={() => setStatusFilter('all')}
          >
            All Statuses
          </button>
          <button
            className={`my-contributions-filter-btn ${statusFilter === 'pending' ? 'active' : ''}`}
            onClick={() => setStatusFilter('pending')}
          >
            <Icon name="clock" size={14} /> Pending
          </button>
          <button
            className={`my-contributions-filter-btn ${statusFilter === 'approved' ? 'active' : ''}`}
            onClick={() => setStatusFilter('approved')}
          >
            <Icon name="check" size={14} /> Approved
          </button>
          <button
            className={`my-contributions-filter-btn ${statusFilter === 'rejected' ? 'active' : ''}`}
            onClick={() => setStatusFilter('rejected')}
          >
            <Icon name="x" size={14} /> Rejected
          </button>
        </div>

        {/* Loading State */}
        {loading && (
          <div className="my-contributions-loading">
            <Icon name="loader" size={32} className="my-contributions-spinner" />
            <p>Loading your contributions...</p>
          </div>
        )}

        {/* Error State */}
        {error && !loading && (
          <div className="my-contributions-error">
            <Icon name="alert-circle" size={32} />
            <p>{error}</p>
            <button onClick={fetchData} className="my-contributions-retry-btn">
              <Icon name="refresh-cw" size={16} /> Try Again
            </button>
          </div>
        )}

        {/* Empty State */}
        {!loading && !error && combinedSubmissions.length === 0 && (
          <div className="my-contributions-empty">
            <Icon name="inbox" size={48} />
            <h3>No contributions yet</h3>
            <p>Use the actions above to start contributing data to our database, or find a card to suggest edits.</p>
          </div>
        )}

        {/* Submissions List */}
        {!loading && !error && combinedSubmissions.length > 0 && (
          <div className="my-contributions-list">
            {combinedSubmissions.map(submission => renderSubmissionCard(submission))}
          </div>
        )}
      </div>

      {/* Modals */}
      <SuggestSetModal
        isOpen={showSetModal}
        onClose={() => setShowSetModal(false)}
        onSuccess={handleSubmissionSuccess}
      />

      <SuggestSeriesModal
        isOpen={showSeriesModal}
        onClose={() => setShowSeriesModal(false)}
        onSuccess={handleSubmissionSuccess}
      />

      <SuggestCardsModal
        isOpen={showCardsModal}
        onClose={() => setShowCardsModal(false)}
        onSuccess={handleSubmissionSuccess}
      />
    </div>
  )
}

export default MyContributions
