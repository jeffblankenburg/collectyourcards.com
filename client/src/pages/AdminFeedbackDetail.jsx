import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import axios from 'axios'
import { useToast } from '../contexts/ToastContext'
import { useAuth } from '../contexts/AuthContext'
import {
  ArrowLeft,
  Bug,
  Lightbulb,
  MessageCircle,
  ExternalLink,
  Send,
  RefreshCw,
  Clock,
  Eye,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Loader2,
  ChevronDown,
  Mail,
  User,
  Globe,
  Monitor,
  FileText,
  Github,
  Trash2,
  Copy
} from 'lucide-react'
import './AdminFeedbackDetailScoped.css'

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

function AdminFeedbackDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { success, error: showError } = useToast()
  const { user } = useAuth()

  const [submission, setSubmission] = useState(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  // Response form
  const [responseText, setResponseText] = useState('')
  const [isInternal, setIsInternal] = useState(false)
  const [sendEmail, setSendEmail] = useState(true)
  const [sendingResponse, setSendingResponse] = useState(false)

  // Admin notes
  const [adminNotes, setAdminNotes] = useState('')
  const [showConsoleLogs, setShowConsoleLogs] = useState(false)

  // Delete confirmation
  const [confirmingDelete, setConfirmingDelete] = useState(false)

  useEffect(() => {
    document.title = 'Feedback Detail - Collect Your Cards'
    loadSubmission()
  }, [id])

  const loadSubmission = async () => {
    try {
      setLoading(true)
      const response = await axios.get(`/api/admin/feedback/${id}`)
      setSubmission(response.data.data)
      setAdminNotes(response.data.data.admin_notes || '')
    } catch (err) {
      console.error('Failed to load submission:', err)
      showError('Failed to load feedback submission')
      navigate('/admin/feedback')
    } finally {
      setLoading(false)
    }
  }

  const handleStatusChange = async (newStatus) => {
    try {
      setSaving(true)
      await axios.put(`/api/admin/feedback/${id}/status`, {
        status: newStatus,
        admin_notes: adminNotes,
        notify_user: true
      })
      success('Status updated successfully')
      loadSubmission()
    } catch (err) {
      console.error('Failed to update status:', err)
      showError('Failed to update status')
    } finally {
      setSaving(false)
    }
  }

  const handleSaveNotes = async () => {
    try {
      setSaving(true)
      await axios.put(`/api/admin/feedback/${id}/status`, {
        status: submission.status,
        admin_notes: adminNotes,
        notify_user: false
      })
      success('Notes saved')
    } catch (err) {
      console.error('Failed to save notes:', err)
      showError('Failed to save notes')
    } finally {
      setSaving(false)
    }
  }

  const handleSendResponse = async (e) => {
    e.preventDefault()
    if (!responseText.trim()) {
      showError('Please enter a response message')
      return
    }

    try {
      setSendingResponse(true)
      await axios.post(`/api/admin/feedback/${id}/respond`, {
        message: responseText.trim(),
        is_internal: isInternal,
        send_email: sendEmail && !isInternal
      })
      success(isInternal ? 'Internal note added' : 'Response sent successfully')
      setResponseText('')
      loadSubmission()
    } catch (err) {
      console.error('Failed to send response:', err)
      showError('Failed to send response')
    } finally {
      setSendingResponse(false)
    }
  }

  const handleCreateGitHubIssue = async () => {
    try {
      setSaving(true)
      const response = await axios.post(`/api/admin/feedback/${id}/github`)
      success('GitHub issue created successfully')
      loadSubmission()
    } catch (err) {
      console.error('Failed to create GitHub issue:', err)
      showError(err.response?.data?.message || 'Failed to create GitHub issue')
    } finally {
      setSaving(false)
    }
  }

  const handleResendConfirmation = async () => {
    try {
      await axios.post(`/api/admin/feedback/${id}/resend-confirmation`)
      success('Confirmation email resent')
    } catch (err) {
      console.error('Failed to resend confirmation:', err)
      showError('Failed to resend confirmation email')
    }
  }

  const handleDelete = async () => {
    if (!confirmingDelete) {
      setConfirmingDelete(true)
      return
    }

    try {
      await axios.delete(`/api/admin/feedback/${id}`)
      success('Feedback deleted')
      navigate('/admin/feedback')
    } catch (err) {
      console.error('Failed to delete:', err)
      showError('Failed to delete feedback')
    } finally {
      setConfirmingDelete(false)
    }
  }

  const cancelDelete = () => {
    setConfirmingDelete(false)
  }

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text)
    success('Copied to clipboard')
  }

  const formatDate = (dateString) => {
    const date = new Date(dateString)
    return date.toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit'
    })
  }

  if (loading) {
    return (
      <div className="admin-feedback-detail-loading">
        <Loader2 size={32} className="spinning" />
        <p>Loading feedback...</p>
      </div>
    )
  }

  if (!submission) {
    return null
  }

  const typeConfig = TYPE_CONFIG[submission.submission_type] || TYPE_CONFIG.general
  const statusConfig = STATUS_CONFIG[submission.status] || STATUS_CONFIG.new
  const priorityConfig = PRIORITY_CONFIG[submission.priority] || PRIORITY_CONFIG.medium
  const TypeIcon = typeConfig.icon
  const StatusIcon = statusConfig.icon

  let consoleLogs = []
  try {
    if (submission.console_logs) {
      consoleLogs = JSON.parse(submission.console_logs)
    }
  } catch (e) {
    consoleLogs = []
  }

  return (
    <div className="admin-feedback-detail-page">
      {/* Header */}
      <div className="admin-feedback-detail-header">
        <button
          className="admin-feedback-detail-back"
          onClick={() => navigate('/admin/feedback')}
        >
          <ArrowLeft size={20} />
          Back to Feedback
        </button>

        <div className="admin-feedback-detail-header-actions">
          {!submission.github_issue_url && (
            <button
              className="admin-feedback-detail-btn admin-feedback-detail-btn-secondary"
              onClick={handleCreateGitHubIssue}
              disabled={saving}
            >
              <Github size={16} />
              Create GitHub Issue
            </button>
          )}
          <button
            className="admin-feedback-detail-btn admin-feedback-detail-btn-secondary"
            onClick={handleResendConfirmation}
          >
            <Mail size={16} />
            Resend Confirmation
          </button>
          {confirmingDelete ? (
            <div className="admin-feedback-detail-delete-confirm">
              <span>Are you sure?</span>
              <button
                className="admin-feedback-detail-btn admin-feedback-detail-btn-danger"
                onClick={handleDelete}
              >
                Yes, Delete
              </button>
              <button
                className="admin-feedback-detail-btn admin-feedback-detail-btn-secondary"
                onClick={cancelDelete}
              >
                Cancel
              </button>
            </div>
          ) : (
            <button
              className="admin-feedback-detail-btn admin-feedback-detail-btn-danger"
              onClick={handleDelete}
            >
              <Trash2 size={16} />
              Delete
            </button>
          )}
        </div>
      </div>

      <div className="admin-feedback-detail-content">
        {/* Main Content */}
        <div className="admin-feedback-detail-main">
          {/* Title Section */}
          <div className="admin-feedback-detail-title-section">
            <div className="admin-feedback-detail-badges">
              <span
                className="admin-feedback-detail-type-badge"
                style={{ '--type-color': typeConfig.color }}
              >
                <TypeIcon size={16} />
                {typeConfig.label}
              </span>
              <span
                className="admin-feedback-detail-priority-badge"
                style={{ '--priority-color': priorityConfig.color }}
              >
                {priorityConfig.label} Priority
              </span>
            </div>
            <h1>{submission.subject}</h1>
            <div className="admin-feedback-detail-meta">
              <code
                className="admin-feedback-detail-ref"
                onClick={() => copyToClipboard(submission.reference_number)}
                title="Click to copy"
              >
                {submission.reference_number}
                <Copy size={12} />
              </code>
              <span className="admin-feedback-detail-date">
                Submitted {formatDate(submission.created_at)}
              </span>
            </div>
          </div>

          {/* Description */}
          <div className="admin-feedback-detail-section">
            <h3><FileText size={18} /> Description</h3>
            <div className="admin-feedback-detail-description">
              {submission.description}
            </div>
          </div>

          {/* Steps to Reproduce */}
          {submission.steps_to_reproduce && (
            <div className="admin-feedback-detail-section">
              <h3><Bug size={18} /> Steps to Reproduce</h3>
              <div className="admin-feedback-detail-steps">
                {submission.steps_to_reproduce}
              </div>
            </div>
          )}

          {/* Console Logs */}
          {consoleLogs.length > 0 && (
            <div className="admin-feedback-detail-section">
              <h3
                className="admin-feedback-detail-collapsible"
                onClick={() => setShowConsoleLogs(!showConsoleLogs)}
              >
                <Monitor size={18} />
                Console Logs ({consoleLogs.length})
                <ChevronDown
                  size={16}
                  className={showConsoleLogs ? 'rotated' : ''}
                />
              </h3>
              {showConsoleLogs && (
                <div className="admin-feedback-detail-console-logs">
                  {consoleLogs.map((log, index) => (
                    <div
                      key={index}
                      className={`admin-feedback-detail-log-entry admin-feedback-detail-log-${log.level}`}
                    >
                      <span className="admin-feedback-detail-log-time">
                        {new Date(log.timestamp).toLocaleTimeString()}
                      </span>
                      <span className="admin-feedback-detail-log-level">
                        [{log.level.toUpperCase()}]
                      </span>
                      <span className="admin-feedback-detail-log-message">
                        {log.message}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Responses */}
          <div className="admin-feedback-detail-section">
            <h3><MessageCircle size={18} /> Responses ({submission.responses?.length || 0})</h3>

            {submission.responses?.length > 0 && (
              <div className="admin-feedback-detail-responses">
                {submission.responses.map(response => (
                  <div
                    key={response.response_id}
                    className={`admin-feedback-detail-response ${response.is_internal ? 'internal' : ''}`}
                  >
                    <div className="admin-feedback-detail-response-header">
                      <div className="admin-feedback-detail-response-author">
                        <User size={16} />
                        {response.responder?.first_name
                          ? `${response.responder.first_name} ${response.responder.last_name || ''}`
                          : response.responder?.username || 'Unknown'}
                      </div>
                      {response.is_internal && (
                        <span className="admin-feedback-detail-response-internal-badge">
                          Internal Note
                        </span>
                      )}
                      <span className="admin-feedback-detail-response-date">
                        {formatDate(response.created_at)}
                      </span>
                    </div>
                    <div className="admin-feedback-detail-response-body">
                      {response.message}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Response Form */}
            <form
              className="admin-feedback-detail-response-form"
              onSubmit={handleSendResponse}
            >
              <textarea
                placeholder="Write a response..."
                value={responseText}
                onChange={e => setResponseText(e.target.value)}
                rows={4}
              />
              <div className="admin-feedback-detail-response-options">
                <label>
                  <input
                    type="checkbox"
                    checked={isInternal}
                    onChange={e => setIsInternal(e.target.checked)}
                  />
                  Internal note (not sent to user)
                </label>
                {!isInternal && (
                  <label>
                    <input
                      type="checkbox"
                      checked={sendEmail}
                      onChange={e => setSendEmail(e.target.checked)}
                    />
                    Send email notification
                  </label>
                )}
              </div>
              <button
                type="submit"
                className="admin-feedback-detail-btn admin-feedback-detail-btn-primary"
                disabled={sendingResponse || !responseText.trim()}
              >
                {sendingResponse ? (
                  <>
                    <Loader2 size={16} className="spinning" />
                    Sending...
                  </>
                ) : (
                  <>
                    <Send size={16} />
                    {isInternal ? 'Add Internal Note' : 'Send Response'}
                  </>
                )}
              </button>
            </form>
          </div>
        </div>

        {/* Sidebar */}
        <div className="admin-feedback-detail-sidebar">
          {/* Status */}
          <div className="admin-feedback-detail-sidebar-section">
            <label>Status</label>
            <div className="admin-feedback-detail-status-dropdown">
              <select
                value={submission.status}
                onChange={e => handleStatusChange(e.target.value)}
                disabled={saving}
                style={{ '--status-color': statusConfig.color }}
              >
                {Object.entries(STATUS_CONFIG).map(([value, config]) => (
                  <option key={value} value={value}>{config.label}</option>
                ))}
              </select>
              <ChevronDown size={16} />
            </div>
          </div>

          {/* Submitter Info */}
          <div className="admin-feedback-detail-sidebar-section">
            <label>Submitter</label>
            <div className="admin-feedback-detail-info-item">
              <Mail size={14} />
              <a href={`mailto:${submission.email}`}>{submission.email}</a>
            </div>
            {submission.user && (
              <div className="admin-feedback-detail-info-item">
                <User size={14} />
                <span>
                  {submission.user.username || `User #${submission.user.user_id}`}
                </span>
              </div>
            )}
          </div>

          {/* Context */}
          <div className="admin-feedback-detail-sidebar-section">
            <label>Context</label>
            <div className="admin-feedback-detail-info-item">
              <Globe size={14} />
              <a href={submission.page_url} target="_blank" rel="noopener noreferrer">
                {submission.page_url}
              </a>
            </div>
            {submission.screen_resolution && (
              <div className="admin-feedback-detail-info-item">
                <Monitor size={14} />
                <span>{submission.screen_resolution}</span>
              </div>
            )}
          </div>

          {/* GitHub Issue */}
          {submission.github_issue_url && (
            <div className="admin-feedback-detail-sidebar-section">
              <label>GitHub Issue</label>
              <a
                href={submission.github_issue_url}
                target="_blank"
                rel="noopener noreferrer"
                className="admin-feedback-detail-github-link"
              >
                <Github size={16} />
                Issue #{submission.github_issue_number}
                <ExternalLink size={14} />
              </a>
            </div>
          )}

          {/* Admin Notes */}
          <div className="admin-feedback-detail-sidebar-section">
            <label>Admin Notes</label>
            <textarea
              placeholder="Internal notes..."
              value={adminNotes}
              onChange={e => setAdminNotes(e.target.value)}
              rows={4}
            />
            <button
              className="admin-feedback-detail-btn admin-feedback-detail-btn-small"
              onClick={handleSaveNotes}
              disabled={saving || adminNotes === (submission.admin_notes || '')}
            >
              Save Notes
            </button>
          </div>

          {/* Resolution Info */}
          {submission.resolved_at && (
            <div className="admin-feedback-detail-sidebar-section">
              <label>Resolution</label>
              <div className="admin-feedback-detail-resolution-info">
                <div>Resolved {formatDate(submission.resolved_at)}</div>
                {submission.resolver && (
                  <div>
                    by {submission.resolver.first_name
                      ? `${submission.resolver.first_name} ${submission.resolver.last_name || ''}`
                      : submission.resolver.username}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default AdminFeedbackDetail
