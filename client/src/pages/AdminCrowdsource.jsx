import { useState, useEffect, useRef } from 'react'
import axios from 'axios'
import { useToast } from '../contexts/ToastContext'
import {
  Search,
  RefreshCw,
  Filter,
  Archive,
  Layers,
  CreditCard,
  Edit3,
  CheckCircle,
  XCircle,
  Clock,
  Loader2,
  ChevronDown,
  Users,
  Award,
  MessageSquare
} from 'lucide-react'
import './AdminCrowdsourceScoped.css'

const TYPE_CONFIG = {
  set: { label: 'New Set', icon: Archive, color: '#22c55e' },
  series: { label: 'New Series', icon: Layers, color: '#3b82f6' },
  card: { label: 'New Card', icon: CreditCard, color: '#f59e0b' },
  card_edit: { label: 'Card Edit', icon: Edit3, color: '#8b5cf6' }
}

const TRUST_LEVELS = {
  novice: { label: 'Novice', color: '#6b7280' },
  contributor: { label: 'Contributor', color: '#3b82f6' },
  trusted: { label: 'Trusted', color: '#22c55e' },
  expert: { label: 'Expert', color: '#f59e0b' },
  master: { label: 'Master', color: '#8b5cf6' }
}

function AdminCrowdsource() {
  const { success, error: showError } = useToast()
  const searchTimeoutRef = useRef(null)

  // Data state
  const [submissions, setSubmissions] = useState([])
  const [stats, setStats] = useState(null)
  const [loading, setLoading] = useState(true)
  const [statsLoading, setStatsLoading] = useState(true)

  // Filter state
  const [typeFilter, setTypeFilter] = useState('all')

  // Review modal state
  const [selectedSubmission, setSelectedSubmission] = useState(null)
  const [reviewAction, setReviewAction] = useState(null) // 'approve' or 'reject'
  const [reviewNotes, setReviewNotes] = useState('')
  const [reviewLoading, setReviewLoading] = useState(false)

  useEffect(() => {
    document.title = 'Crowdsource Review - Admin - Collect Your Cards'
    loadStats()
    loadSubmissions()
  }, [])

  useEffect(() => {
    loadSubmissions()
  }, [typeFilter])

  const loadStats = async () => {
    try {
      setStatsLoading(true)
      const response = await axios.get('/api/crowdsource/admin/stats')
      setStats(response.data.stats)
    } catch (err) {
      console.error('Failed to load stats:', err)
    } finally {
      setStatsLoading(false)
    }
  }

  const loadSubmissions = async () => {
    try {
      setLoading(true)
      const params = new URLSearchParams()
      if (typeFilter !== 'all') params.append('type', typeFilter)

      const response = await axios.get(`/api/crowdsource/admin/review-all?${params}`)
      setSubmissions(response.data.submissions || [])
    } catch (err) {
      console.error('Failed to load submissions:', err)
      showError('Failed to load submissions')
    } finally {
      setLoading(false)
    }
  }

  const handleReview = async () => {
    if (!selectedSubmission || !reviewAction) return

    if (reviewAction === 'reject' && reviewNotes.trim().length < 10) {
      showError('Please provide review notes (at least 10 characters) when rejecting.')
      return
    }

    setReviewLoading(true)

    try {
      const type = selectedSubmission.submission_type
      const endpoint = `/api/crowdsource/admin/review/${type}/${selectedSubmission.submission_id}/${reviewAction}`

      await axios.post(endpoint, { review_notes: reviewNotes.trim() || null })

      success(`Submission ${reviewAction === 'approve' ? 'approved' : 'rejected'} successfully!`)
      setSelectedSubmission(null)
      setReviewAction(null)
      setReviewNotes('')
      loadSubmissions()
      loadStats()
    } catch (err) {
      console.error('Failed to review submission:', err)
      showError(err.response?.data?.message || 'Failed to review submission')
    } finally {
      setReviewLoading(false)
    }
  }

  const formatDate = (dateString) => {
    const date = new Date(dateString)
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit'
    })
  }

  const getTimeAgo = (dateString) => {
    const date = new Date(dateString)
    const now = new Date()
    const diffMs = now - date
    const diffMins = Math.floor(diffMs / 60000)
    const diffHours = Math.floor(diffMs / 3600000)
    const diffDays = Math.floor(diffMs / 86400000)

    if (diffMins < 60) return `${diffMins}m ago`
    if (diffHours < 24) return `${diffHours}h ago`
    if (diffDays < 7) return `${diffDays}d ago`
    return formatDate(dateString)
  }

  const renderSubmissionDetails = (submission) => {
    switch (submission.submission_type) {
      case 'set':
        return (
          <div className="admin-crowd-submission-details">
            <div className="admin-crowd-detail-row">
              <span className="admin-crowd-detail-label">Set Name:</span>
              <span className="admin-crowd-detail-value">{submission.proposed_name}</span>
            </div>
            <div className="admin-crowd-detail-row">
              <span className="admin-crowd-detail-label">Year:</span>
              <span className="admin-crowd-detail-value">{submission.proposed_year}</span>
            </div>
            <div className="admin-crowd-detail-row">
              <span className="admin-crowd-detail-label">Sport:</span>
              <span className="admin-crowd-detail-value">{submission.proposed_sport}</span>
            </div>
            {submission.proposed_manufacturer && (
              <div className="admin-crowd-detail-row">
                <span className="admin-crowd-detail-label">Manufacturer:</span>
                <span className="admin-crowd-detail-value">{submission.proposed_manufacturer}</span>
              </div>
            )}
            {submission.proposed_description && (
              <div className="admin-crowd-detail-row">
                <span className="admin-crowd-detail-label">Description:</span>
                <span className="admin-crowd-detail-value">{submission.proposed_description}</span>
              </div>
            )}
          </div>
        )

      case 'series':
        return (
          <div className="admin-crowd-submission-details">
            <div className="admin-crowd-detail-row">
              <span className="admin-crowd-detail-label">Parent Set:</span>
              <span className="admin-crowd-detail-value">{submission.set_year} {submission.set_name}</span>
            </div>
            <div className="admin-crowd-detail-row">
              <span className="admin-crowd-detail-label">Series Name:</span>
              <span className="admin-crowd-detail-value">{submission.proposed_name}</span>
            </div>
            {submission.proposed_is_parallel && (
              <div className="admin-crowd-detail-row">
                <span className="admin-crowd-detail-label">Parallel:</span>
                <span className="admin-crowd-detail-value">{submission.proposed_parallel_name || 'Yes'}</span>
              </div>
            )}
            {submission.proposed_base_card_count && (
              <div className="admin-crowd-detail-row">
                <span className="admin-crowd-detail-label">Card Count:</span>
                <span className="admin-crowd-detail-value">{submission.proposed_base_card_count}</span>
              </div>
            )}
            {submission.proposed_print_run && (
              <div className="admin-crowd-detail-row">
                <span className="admin-crowd-detail-label">Print Run:</span>
                <span className="admin-crowd-detail-value">/{submission.proposed_print_run}</span>
              </div>
            )}
          </div>
        )

      case 'card':
        return (
          <div className="admin-crowd-submission-details">
            <div className="admin-crowd-detail-row">
              <span className="admin-crowd-detail-label">Series:</span>
              <span className="admin-crowd-detail-value">{submission.set_year} {submission.set_name} - {submission.series_name}</span>
            </div>
            <div className="admin-crowd-detail-row">
              <span className="admin-crowd-detail-label">Card #:</span>
              <span className="admin-crowd-detail-value">{submission.proposed_card_number}</span>
            </div>
            {submission.proposed_player_names && (
              <div className="admin-crowd-detail-row">
                <span className="admin-crowd-detail-label">Player(s):</span>
                <span className="admin-crowd-detail-value">{submission.proposed_player_names}</span>
              </div>
            )}
            {submission.proposed_team_names && (
              <div className="admin-crowd-detail-row">
                <span className="admin-crowd-detail-label">Team(s):</span>
                <span className="admin-crowd-detail-value">{submission.proposed_team_names}</span>
              </div>
            )}
            <div className="admin-crowd-detail-flags">
              {submission.proposed_is_rookie && <span className="admin-crowd-flag admin-crowd-flag-rc">RC</span>}
              {submission.proposed_is_autograph && <span className="admin-crowd-flag admin-crowd-flag-auto">AUTO</span>}
              {submission.proposed_is_relic && <span className="admin-crowd-flag admin-crowd-flag-relic">RELIC</span>}
              {submission.proposed_is_short_print && <span className="admin-crowd-flag admin-crowd-flag-sp">SP</span>}
              {submission.proposed_print_run && <span className="admin-crowd-flag admin-crowd-flag-print">/{submission.proposed_print_run}</span>}
            </div>
          </div>
        )

      case 'card_edit':
        return (
          <div className="admin-crowd-submission-details">
            <div className="admin-crowd-detail-row">
              <span className="admin-crowd-detail-label">Card:</span>
              <span className="admin-crowd-detail-value">
                {submission.set_year} {submission.set_name} - {submission.series_name} #{submission.current_card_number}
              </span>
            </div>
            {submission.player_names && (
              <div className="admin-crowd-detail-row">
                <span className="admin-crowd-detail-label">Player(s):</span>
                <span className="admin-crowd-detail-value">{submission.player_names}</span>
              </div>
            )}
            <div className="admin-crowd-changes">
              <strong>Proposed Changes:</strong>
              {submission.proposed_card_number !== null && submission.proposed_card_number !== submission.current_card_number && (
                <div className="admin-crowd-change-row">
                  <span>Card #:</span>
                  <span className="admin-crowd-change-from">{submission.current_card_number}</span>
                  <span className="admin-crowd-change-arrow">→</span>
                  <span className="admin-crowd-change-to">{submission.proposed_card_number}</span>
                </div>
              )}
              {submission.proposed_is_rookie !== null && submission.proposed_is_rookie !== submission.current_is_rookie && (
                <div className="admin-crowd-change-row">
                  <span>Rookie:</span>
                  <span className="admin-crowd-change-from">{submission.current_is_rookie ? 'Yes' : 'No'}</span>
                  <span className="admin-crowd-change-arrow">→</span>
                  <span className="admin-crowd-change-to">{submission.proposed_is_rookie ? 'Yes' : 'No'}</span>
                </div>
              )}
              {submission.proposed_is_autograph !== null && submission.proposed_is_autograph !== submission.current_is_autograph && (
                <div className="admin-crowd-change-row">
                  <span>Autograph:</span>
                  <span className="admin-crowd-change-from">{submission.current_is_autograph ? 'Yes' : 'No'}</span>
                  <span className="admin-crowd-change-arrow">→</span>
                  <span className="admin-crowd-change-to">{submission.proposed_is_autograph ? 'Yes' : 'No'}</span>
                </div>
              )}
              {submission.proposed_is_relic !== null && submission.proposed_is_relic !== submission.current_is_relic && (
                <div className="admin-crowd-change-row">
                  <span>Relic:</span>
                  <span className="admin-crowd-change-from">{submission.current_is_relic ? 'Yes' : 'No'}</span>
                  <span className="admin-crowd-change-arrow">→</span>
                  <span className="admin-crowd-change-to">{submission.proposed_is_relic ? 'Yes' : 'No'}</span>
                </div>
              )}
              {submission.proposed_is_short_print !== null && submission.proposed_is_short_print !== submission.current_is_short_print && (
                <div className="admin-crowd-change-row">
                  <span>Short Print:</span>
                  <span className="admin-crowd-change-from">{submission.current_is_short_print ? 'Yes' : 'No'}</span>
                  <span className="admin-crowd-change-arrow">→</span>
                  <span className="admin-crowd-change-to">{submission.proposed_is_short_print ? 'Yes' : 'No'}</span>
                </div>
              )}
              {submission.proposed_print_run !== null && submission.proposed_print_run !== submission.current_print_run && (
                <div className="admin-crowd-change-row">
                  <span>Print Run:</span>
                  <span className="admin-crowd-change-from">{submission.current_print_run ? `/${submission.current_print_run}` : 'None'}</span>
                  <span className="admin-crowd-change-arrow">→</span>
                  <span className="admin-crowd-change-to">/{submission.proposed_print_run}</span>
                </div>
              )}
            </div>
          </div>
        )

      default:
        return null
    }
  }

  return (
    <div className="admin-crowd-page">
      <div className="admin-crowd-header">
        <div className="admin-crowd-header-left">
          <h1>Crowdsource Review Queue</h1>
          <p>Review and approve community submissions</p>
        </div>
        <button
          className="admin-crowd-refresh-btn"
          onClick={() => { loadSubmissions(); loadStats() }}
          disabled={loading}
        >
          <RefreshCw size={16} className={loading ? 'spinning' : ''} />
          Refresh
        </button>
      </div>

      {/* Stats Cards */}
      {stats && (
        <div className="admin-crowd-stats">
          <div className="admin-crowd-stat-card admin-crowd-stat-pending">
            <Clock size={20} />
            <div className="admin-crowd-stat-value">{stats.total_pending}</div>
            <div className="admin-crowd-stat-label">Pending</div>
          </div>
          <div className="admin-crowd-stat-card">
            <Archive size={20} />
            <div className="admin-crowd-stat-value">{stats.pending_sets}</div>
            <div className="admin-crowd-stat-label">Sets</div>
          </div>
          <div className="admin-crowd-stat-card">
            <Layers size={20} />
            <div className="admin-crowd-stat-value">{stats.pending_series}</div>
            <div className="admin-crowd-stat-label">Series</div>
          </div>
          <div className="admin-crowd-stat-card">
            <CreditCard size={20} />
            <div className="admin-crowd-stat-value">{stats.pending_cards}</div>
            <div className="admin-crowd-stat-label">Cards</div>
          </div>
          <div className="admin-crowd-stat-card">
            <Edit3 size={20} />
            <div className="admin-crowd-stat-value">{stats.pending_card_edits}</div>
            <div className="admin-crowd-stat-label">Edits</div>
          </div>
          <div className="admin-crowd-stat-card">
            <Users size={20} />
            <div className="admin-crowd-stat-value">{stats.unique_contributors}</div>
            <div className="admin-crowd-stat-label">Contributors</div>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="admin-crowd-filters">
        <div className="admin-crowd-filter-group">
          <Filter size={14} />
          <select
            value={typeFilter}
            onChange={e => setTypeFilter(e.target.value)}
          >
            <option value="all">All Types</option>
            <option value="set">New Sets</option>
            <option value="series">New Series</option>
            <option value="card">New Cards</option>
            <option value="card_edit">Card Edits</option>
          </select>
        </div>
        <div className="admin-crowd-results-info">
          Showing {submissions.length} pending submission{submissions.length !== 1 ? 's' : ''}
        </div>
      </div>

      {/* Submissions List */}
      <div className="admin-crowd-submissions-container">
        {loading ? (
          <div className="admin-crowd-loading">
            <Loader2 size={32} className="spinning" />
            <p>Loading submissions...</p>
          </div>
        ) : submissions.length === 0 ? (
          <div className="admin-crowd-empty">
            <CheckCircle size={48} />
            <h3>All caught up!</h3>
            <p>No pending submissions to review.</p>
          </div>
        ) : (
          <div className="admin-crowd-submissions-list">
            {submissions.map(submission => {
              const typeConfig = TYPE_CONFIG[submission.submission_type]
              const TypeIcon = typeConfig?.icon || Edit3
              const trustConfig = TRUST_LEVELS[submission.submitter_trust_level] || TRUST_LEVELS.novice

              return (
                <div
                  key={`${submission.submission_type}-${submission.submission_id}`}
                  className="admin-crowd-submission-card"
                >
                  <div className="admin-crowd-submission-header">
                    <div className="admin-crowd-submission-type" style={{ '--type-color': typeConfig?.color }}>
                      <TypeIcon size={16} />
                      {typeConfig?.label}
                    </div>
                    <span className="admin-crowd-submission-time">{getTimeAgo(submission.created_at)}</span>
                  </div>

                  {renderSubmissionDetails(submission)}

                  {submission.submission_notes && (
                    <div className="admin-crowd-submission-notes">
                      <MessageSquare size={14} />
                      <span>{submission.submission_notes}</span>
                    </div>
                  )}

                  <div className="admin-crowd-submission-footer">
                    <div className="admin-crowd-submitter">
                      <span className="admin-crowd-submitter-name">{submission.submitter_username}</span>
                      <span
                        className="admin-crowd-trust-badge"
                        style={{ '--trust-color': trustConfig.color }}
                      >
                        <Award size={12} />
                        {trustConfig.label}
                        {submission.submitter_approval_rate !== null && ` (${Math.round(submission.submitter_approval_rate)}%)`}
                      </span>
                    </div>
                    <div className="admin-crowd-actions">
                      <button
                        className="admin-crowd-approve-btn"
                        onClick={() => {
                          setSelectedSubmission(submission)
                          setReviewAction('approve')
                          setReviewNotes('')
                        }}
                      >
                        <CheckCircle size={16} />
                        Approve
                      </button>
                      <button
                        className="admin-crowd-reject-btn"
                        onClick={() => {
                          setSelectedSubmission(submission)
                          setReviewAction('reject')
                          setReviewNotes('')
                        }}
                      >
                        <XCircle size={16} />
                        Reject
                      </button>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Review Modal */}
      {selectedSubmission && reviewAction && (
        <div className="admin-crowd-modal-overlay" onClick={() => { setSelectedSubmission(null); setReviewAction(null) }}>
          <div className="admin-crowd-modal" onClick={e => e.stopPropagation()}>
            <div className="admin-crowd-modal-header">
              <h3>{reviewAction === 'approve' ? 'Approve Submission' : 'Reject Submission'}</h3>
              <button
                className="admin-crowd-modal-close"
                onClick={() => { setSelectedSubmission(null); setReviewAction(null) }}
              >
                <XCircle size={20} />
              </button>
            </div>
            <div className="admin-crowd-modal-body">
              {renderSubmissionDetails(selectedSubmission)}
              <div className="admin-crowd-review-notes">
                <label>
                  Review Notes {reviewAction === 'reject' && <span className="required">*</span>}
                </label>
                <textarea
                  value={reviewNotes}
                  onChange={e => setReviewNotes(e.target.value)}
                  placeholder={reviewAction === 'approve'
                    ? 'Optional notes for this approval...'
                    : 'Please explain why this submission is being rejected (required)...'
                  }
                  rows={3}
                />
              </div>
            </div>
            <div className="admin-crowd-modal-footer">
              <button
                className="admin-crowd-cancel-btn"
                onClick={() => { setSelectedSubmission(null); setReviewAction(null) }}
              >
                Cancel
              </button>
              <button
                className={`admin-crowd-confirm-btn ${reviewAction === 'approve' ? 'approve' : 'reject'}`}
                onClick={handleReview}
                disabled={reviewLoading || (reviewAction === 'reject' && reviewNotes.trim().length < 10)}
              >
                {reviewLoading ? (
                  <Loader2 size={16} className="spinning" />
                ) : reviewAction === 'approve' ? (
                  <>
                    <CheckCircle size={16} />
                    Confirm Approval
                  </>
                ) : (
                  <>
                    <XCircle size={16} />
                    Confirm Rejection
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default AdminCrowdsource
