import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import axios from 'axios'
import { useToast } from '../contexts/ToastContext'
import {
  Search,
  RefreshCw,
  Filter,
  Bug,
  Lightbulb,
  MessageCircle,
  ExternalLink,
  Eye,
  Clock,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Loader2,
  ChevronDown,
  BarChart3
} from 'lucide-react'
import './AdminFeedbackScoped.css'

const STATUS_CONFIG = {
  new: { label: 'New', color: '#3b82f6', icon: Clock },
  in_review: { label: 'In Review', color: '#8b5cf6', icon: Eye },
  in_progress: { label: 'In Progress', color: '#f59e0b', icon: Loader2 },
  resolved: { label: 'Resolved', color: '#22c55e', icon: CheckCircle },
  closed: { label: 'Closed', color: '#6b7280', icon: XCircle },
  wont_fix: { label: "Won't Fix", color: '#ef4444', icon: AlertTriangle }
}

const TYPE_CONFIG = {
  bug: { label: 'Bug Report', icon: Bug, color: '#ef4444' },
  feature: { label: 'Feature Request', icon: Lightbulb, color: '#f59e0b' },
  general: { label: 'General Feedback', icon: MessageCircle, color: '#3b82f6' }
}

const PRIORITY_CONFIG = {
  low: { label: 'Low', color: '#22c55e' },
  medium: { label: 'Medium', color: '#f59e0b' },
  high: { label: 'High', color: '#f97316' },
  critical: { label: 'Critical', color: '#ef4444' }
}

function AdminFeedback() {
  const navigate = useNavigate()
  const { success, error: showError } = useToast()
  const searchTimeoutRef = useRef(null)

  // Data state
  const [submissions, setSubmissions] = useState([])
  const [stats, setStats] = useState(null)
  const [loading, setLoading] = useState(true)
  const [statsLoading, setStatsLoading] = useState(true)

  // Filter state
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [typeFilter, setTypeFilter] = useState('all')
  const [sortBy, setSortBy] = useState('created_at')
  const [sortOrder, setSortOrder] = useState('desc')

  // Pagination
  const [total, setTotal] = useState(0)
  const [offset, setOffset] = useState(0)
  const limit = 25

  useEffect(() => {
    document.title = 'Admin Feedback - Collect Your Cards'
    loadStats()
  }, [])

  useEffect(() => {
    loadSubmissions()
  }, [statusFilter, typeFilter, sortBy, sortOrder, offset])

  // Debounced search
  useEffect(() => {
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current)
    }
    searchTimeoutRef.current = setTimeout(() => {
      setOffset(0)
      loadSubmissions()
    }, 300)

    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current)
      }
    }
  }, [searchTerm])

  const loadStats = async () => {
    try {
      setStatsLoading(true)
      const response = await axios.get('/api/admin/feedback/stats')
      setStats(response.data.data)
    } catch (err) {
      console.error('Failed to load stats:', err)
    } finally {
      setStatsLoading(false)
    }
  }

  const loadSubmissions = async () => {
    try {
      setLoading(true)
      const params = new URLSearchParams({
        limit,
        offset,
        sort_by: sortBy,
        sort_order: sortOrder
      })

      if (statusFilter !== 'all') params.append('status', statusFilter)
      if (typeFilter !== 'all') params.append('type', typeFilter)
      if (searchTerm) params.append('search', searchTerm)

      const response = await axios.get(`/api/admin/feedback?${params}`)
      setSubmissions(response.data.data)
      setTotal(response.data.total)
    } catch (err) {
      console.error('Failed to load submissions:', err)
      showError('Failed to load feedback submissions')
    } finally {
      setLoading(false)
    }
  }

  const handleStatusChange = async (submissionId, newStatus) => {
    try {
      await axios.put(`/api/admin/feedback/${submissionId}/status`, {
        status: newStatus,
        notify_user: true
      })
      success('Status updated successfully')
      loadSubmissions()
      loadStats()
    } catch (err) {
      console.error('Failed to update status:', err)
      showError('Failed to update status')
    }
  }

  const handleViewDetail = (submission) => {
    navigate(`/admin/feedback/${submission.feedback_id}`)
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

  return (
    <div className="admin-feedback-page">
      <div className="admin-feedback-header">
        <div className="admin-feedback-header-left">
          <h1>User Feedback</h1>
          <p>Manage bug reports, feature requests, and general feedback</p>
        </div>
        <button
          className="admin-feedback-refresh-btn"
          onClick={() => { loadSubmissions(); loadStats() }}
          disabled={loading}
        >
          <RefreshCw size={16} className={loading ? 'spinning' : ''} />
          Refresh
        </button>
      </div>

      {/* Stats Cards */}
      {stats && (
        <div className="admin-feedback-stats">
          <div className="admin-feedback-stat-card">
            <div className="admin-feedback-stat-value">{stats.by_status?.new || 0}</div>
            <div className="admin-feedback-stat-label">New</div>
          </div>
          <div className="admin-feedback-stat-card">
            <div className="admin-feedback-stat-value">
              {(stats.by_status?.in_review || 0) + (stats.by_status?.in_progress || 0)}
            </div>
            <div className="admin-feedback-stat-label">Active</div>
          </div>
          <div className="admin-feedback-stat-card">
            <div className="admin-feedback-stat-value">{stats.by_status?.resolved || 0}</div>
            <div className="admin-feedback-stat-label">Resolved</div>
          </div>
          <div className="admin-feedback-stat-card">
            <div className="admin-feedback-stat-value">{stats.recent_30_days || 0}</div>
            <div className="admin-feedback-stat-label">Last 30 Days</div>
          </div>
          {stats.avg_resolution_hours && (
            <div className="admin-feedback-stat-card">
              <div className="admin-feedback-stat-value">{stats.avg_resolution_hours}h</div>
              <div className="admin-feedback-stat-label">Avg Resolution</div>
            </div>
          )}
        </div>
      )}

      {/* Filters */}
      <div className="admin-feedback-filters">
        <div className="admin-feedback-search">
          <Search size={16} />
          <input
            type="text"
            placeholder="Search feedback..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
          />
        </div>

        <div className="admin-feedback-filter-group">
          <Filter size={14} />
          <select
            value={statusFilter}
            onChange={e => { setStatusFilter(e.target.value); setOffset(0) }}
          >
            <option value="all">All Statuses</option>
            {Object.entries(STATUS_CONFIG).map(([value, config]) => (
              <option key={value} value={value}>{config.label}</option>
            ))}
          </select>
        </div>

        <div className="admin-feedback-filter-group">
          <select
            value={typeFilter}
            onChange={e => { setTypeFilter(e.target.value); setOffset(0) }}
          >
            <option value="all">All Types</option>
            {Object.entries(TYPE_CONFIG).map(([value, config]) => (
              <option key={value} value={value}>{config.label}</option>
            ))}
          </select>
        </div>

        <div className="admin-feedback-filter-group">
          <select
            value={`${sortBy}-${sortOrder}`}
            onChange={e => {
              const [field, order] = e.target.value.split('-')
              setSortBy(field)
              setSortOrder(order)
              setOffset(0)
            }}
          >
            <option value="created_at-desc">Newest First</option>
            <option value="created_at-asc">Oldest First</option>
            <option value="updated_at-desc">Recently Updated</option>
            <option value="priority-desc">Priority (High First)</option>
          </select>
        </div>
      </div>

      {/* Results count */}
      <div className="admin-feedback-results-info">
        Showing {submissions.length} of {total} submissions
      </div>

      {/* Submissions Table */}
      <div className="admin-feedback-table-container">
        {loading ? (
          <div className="admin-feedback-loading">
            <Loader2 size={32} className="spinning" />
            <p>Loading feedback...</p>
          </div>
        ) : submissions.length === 0 ? (
          <div className="admin-feedback-empty">
            <MessageCircle size={48} />
            <p>No feedback submissions found</p>
          </div>
        ) : (
          <table className="admin-feedback-table">
            <thead>
              <tr>
                <th style={{ width: 60 }}>ID</th>
                <th style={{ width: 100 }}>Reference</th>
                <th style={{ width: 100 }}>Type</th>
                <th>Subject</th>
                <th style={{ width: 120 }}>Email</th>
                <th style={{ width: 80 }}>Priority</th>
                <th style={{ width: 110 }}>Status</th>
                <th style={{ width: 100 }}>Submitted</th>
                <th style={{ width: 80 }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {submissions.map(submission => {
                const typeConfig = TYPE_CONFIG[submission.submission_type] || TYPE_CONFIG.general
                const statusConfig = STATUS_CONFIG[submission.status] || STATUS_CONFIG.new
                const priorityConfig = PRIORITY_CONFIG[submission.priority] || PRIORITY_CONFIG.medium
                const TypeIcon = typeConfig.icon
                const StatusIcon = statusConfig.icon

                return (
                  <tr
                    key={submission.feedback_id}
                    onClick={() => handleViewDetail(submission)}
                    className="admin-feedback-row"
                  >
                    <td className="admin-feedback-id">{submission.feedback_id}</td>
                    <td>
                      <code className="admin-feedback-ref">{submission.reference_number}</code>
                    </td>
                    <td>
                      <span
                        className="admin-feedback-type-badge"
                        style={{ '--type-color': typeConfig.color }}
                      >
                        <TypeIcon size={14} />
                        {typeConfig.label}
                      </span>
                    </td>
                    <td className="admin-feedback-subject">
                      <span className="admin-feedback-subject-text">{submission.subject}</span>
                      {submission.response_count > 0 && (
                        <span className="admin-feedback-response-count">
                          {submission.response_count} response{submission.response_count > 1 ? 's' : ''}
                        </span>
                      )}
                    </td>
                    <td className="admin-feedback-email">
                      {submission.email}
                    </td>
                    <td>
                      <span
                        className="admin-feedback-priority-badge"
                        style={{ '--priority-color': priorityConfig.color }}
                      >
                        {priorityConfig.label}
                      </span>
                    </td>
                    <td onClick={e => e.stopPropagation()}>
                      <div className="admin-feedback-status-dropdown">
                        <select
                          value={submission.status}
                          onChange={e => handleStatusChange(submission.feedback_id, e.target.value)}
                          style={{ '--status-color': statusConfig.color }}
                          className="admin-feedback-status-select"
                        >
                          {Object.entries(STATUS_CONFIG).map(([value, config]) => (
                            <option key={value} value={value}>{config.label}</option>
                          ))}
                        </select>
                        <ChevronDown size={14} className="admin-feedback-status-chevron" />
                      </div>
                    </td>
                    <td className="admin-feedback-date">
                      {getTimeAgo(submission.created_at)}
                    </td>
                    <td>
                      <div className="admin-feedback-actions">
                        <button
                          className="admin-feedback-action-btn"
                          onClick={(e) => {
                            e.stopPropagation()
                            handleViewDetail(submission)
                          }}
                          title="View Details"
                        >
                          <Eye size={16} />
                        </button>
                        {submission.github_issue_url && (
                          <a
                            href={submission.github_issue_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="admin-feedback-action-btn"
                            onClick={e => e.stopPropagation()}
                            title="View GitHub Issue"
                          >
                            <ExternalLink size={16} />
                          </a>
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Pagination */}
      {total > limit && (
        <div className="admin-feedback-pagination">
          <button
            onClick={() => setOffset(Math.max(0, offset - limit))}
            disabled={offset === 0}
            className="admin-feedback-page-btn"
          >
            Previous
          </button>
          <span className="admin-feedback-page-info">
            Page {Math.floor(offset / limit) + 1} of {Math.ceil(total / limit)}
          </span>
          <button
            onClick={() => setOffset(offset + limit)}
            disabled={offset + limit >= total}
            className="admin-feedback-page-btn"
          >
            Next
          </button>
        </div>
      )}
    </div>
  )
}

export default AdminFeedback
