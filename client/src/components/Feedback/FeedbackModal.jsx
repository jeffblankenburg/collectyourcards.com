import { useState, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import {
  X,
  Bug,
  Lightbulb,
  MessageCircle,
  Camera,
  Send,
  Loader2,
  CheckCircle,
  ExternalLink,
  AlertTriangle
} from 'lucide-react'
import { useAuth } from '../../contexts/AuthContext'
import { useToast } from '../../contexts/ToastContext'
import { getCapturedLogsJson } from './consoleCapture'
import axios from 'axios'
import './FeedbackModal.css'

const FEEDBACK_TYPES = [
  { value: 'bug', label: 'Bug Report', icon: Bug, description: 'Something isn\'t working' },
  { value: 'feature', label: 'Feature Request', icon: Lightbulb, description: 'Suggest an improvement' },
  { value: 'general', label: 'General Feedback', icon: MessageCircle, description: 'Share your thoughts' }
]

const PRIORITY_OPTIONS = [
  { value: 'low', label: 'Low', color: '#28a745' },
  { value: 'medium', label: 'Medium', color: '#ffc107' },
  { value: 'high', label: 'High', color: '#fd7e14' },
  { value: 'critical', label: 'Critical', color: '#dc3545' }
]

function FeedbackModal({ onClose }) {
  const { user, isAuthenticated } = useAuth()
  const { success, error: showError } = useToast()
  const modalRef = useRef(null)

  // Form state
  const [formData, setFormData] = useState({
    submission_type: 'bug',
    subject: '',
    description: '',
    email: user?.email || '',
    priority: 'medium',
    steps_to_reproduce: ''
  })

  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitSuccess, setSubmitSuccess] = useState(null)
  const [includeConsoleLogs, setIncludeConsoleLogs] = useState(true)
  const [errors, setErrors] = useState({})

  // Pre-fill email if user logs in
  useEffect(() => {
    if (user?.email && !formData.email) {
      setFormData(prev => ({ ...prev, email: user.email }))
    }
  }, [user])

  // Handle escape key
  useEffect(() => {
    const handleEscape = (e) => {
      if (e.key === 'Escape') {
        onClose()
      }
    }
    document.addEventListener('keydown', handleEscape)
    return () => document.removeEventListener('keydown', handleEscape)
  }, [onClose])

  // Focus trap
  useEffect(() => {
    if (modalRef.current) {
      modalRef.current.focus()
    }
  }, [])

  const handleChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }))
    // Clear error when user types
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: null }))
    }
  }

  const validateForm = () => {
    const newErrors = {}

    if (!formData.subject.trim()) {
      newErrors.subject = 'Subject is required'
    } else if (formData.subject.length < 3) {
      newErrors.subject = 'Subject must be at least 3 characters'
    }

    if (!formData.description.trim()) {
      newErrors.description = 'Description is required'
    } else if (formData.description.length < 10) {
      newErrors.description = 'Please provide more detail (at least 10 characters)'
    }

    if (!formData.email.trim()) {
      newErrors.email = 'Email is required for follow-up'
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = 'Please enter a valid email address'
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = async (e) => {
    e.preventDefault()

    if (!validateForm()) {
      return
    }

    setIsSubmitting(true)

    try {
      // Gather context data
      const contextData = {
        ...formData,
        page_url: window.location.href,
        user_agent: navigator.userAgent,
        screen_resolution: `${window.screen.width}x${window.screen.height}`,
        console_logs: includeConsoleLogs ? getCapturedLogsJson(50) : null
      }

      const response = await axios.post('/api/feedback', contextData)

      setSubmitSuccess({
        referenceNumber: response.data.data.reference_number,
        githubIssueUrl: response.data.data.github_issue_url
      })

      success('Feedback submitted successfully!')

    } catch (err) {
      console.error('Error submitting feedback:', err)
      showError(err.response?.data?.message || 'Failed to submit feedback. Please try again.')
    } finally {
      setIsSubmitting(false)
    }
  }

  const selectedType = FEEDBACK_TYPES.find(t => t.value === formData.submission_type)

  // Success state
  if (submitSuccess) {
    return createPortal(
      <div className="feedback-modal-overlay" onClick={onClose}>
        <div
          className="feedback-modal"
          onClick={e => e.stopPropagation()}
          ref={modalRef}
          tabIndex={-1}
        >
          <button className="feedback-modal-close" onClick={onClose} aria-label="Close">
            <X size={20} />
          </button>

          <div className="feedback-modal-success">
            <div className="feedback-modal-success-icon">
              <CheckCircle size={64} />
            </div>
            <h2>Thank You!</h2>
            <p>Your feedback has been submitted successfully.</p>

            <div className="feedback-modal-success-details">
              <div className="feedback-modal-success-ref">
                <span className="feedback-modal-success-label">Reference Number:</span>
                <code>{submitSuccess.referenceNumber}</code>
              </div>

              {submitSuccess.githubIssueUrl && (
                <a
                  href={submitSuccess.githubIssueUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="feedback-modal-success-link"
                >
                  <ExternalLink size={16} />
                  Track progress on GitHub
                </a>
              )}
            </div>

            <p className="feedback-modal-success-note">
              We'll send a confirmation email to your inbox with details on how to track your submission.
            </p>

            <button className="feedback-modal-submit-btn" onClick={onClose}>
              Done
            </button>
          </div>
        </div>
      </div>,
      document.body
    )
  }

  return createPortal(
    <div className="feedback-modal-overlay" onClick={onClose}>
      <div
        className="feedback-modal"
        onClick={e => e.stopPropagation()}
        ref={modalRef}
        tabIndex={-1}
      >
        <button className="feedback-modal-close" onClick={onClose} aria-label="Close">
          <X size={20} />
        </button>

        <div className="feedback-modal-header">
          <h2>Send Feedback</h2>
          <p>Help us improve Collect Your Cards</p>
        </div>

        <form onSubmit={handleSubmit} className="feedback-modal-form">
          {/* Feedback Type Selection */}
          <div className="feedback-modal-field">
            <label className="feedback-modal-label">What type of feedback?</label>
            <div className="feedback-modal-type-grid">
              {FEEDBACK_TYPES.map(type => {
                const Icon = type.icon
                const isSelected = formData.submission_type === type.value
                return (
                  <button
                    key={type.value}
                    type="button"
                    className={`feedback-modal-type-btn ${isSelected ? 'selected' : ''}`}
                    onClick={() => handleChange('submission_type', type.value)}
                  >
                    <Icon size={24} />
                    <span className="feedback-modal-type-label">{type.label}</span>
                    <span className="feedback-modal-type-desc">{type.description}</span>
                  </button>
                )
              })}
            </div>
          </div>

          {/* Subject */}
          <div className="feedback-modal-field">
            <label className="feedback-modal-label" htmlFor="feedback-subject">
              Subject <span className="feedback-modal-required">*</span>
            </label>
            <input
              id="feedback-subject"
              type="text"
              className={`feedback-modal-input ${errors.subject ? 'error' : ''}`}
              placeholder="Brief summary of your feedback"
              value={formData.subject}
              onChange={e => handleChange('subject', e.target.value)}
              maxLength={255}
            />
            {errors.subject && (
              <span className="feedback-modal-error">{errors.subject}</span>
            )}
          </div>

          {/* Description */}
          <div className="feedback-modal-field">
            <label className="feedback-modal-label" htmlFor="feedback-description">
              Description <span className="feedback-modal-required">*</span>
            </label>
            <textarea
              id="feedback-description"
              className={`feedback-modal-textarea ${errors.description ? 'error' : ''}`}
              placeholder="Please describe in detail..."
              value={formData.description}
              onChange={e => handleChange('description', e.target.value)}
              rows={4}
            />
            {errors.description && (
              <span className="feedback-modal-error">{errors.description}</span>
            )}
          </div>

          {/* Steps to Reproduce (for bugs) */}
          {formData.submission_type === 'bug' && (
            <div className="feedback-modal-field">
              <label className="feedback-modal-label" htmlFor="feedback-steps">
                Steps to Reproduce <span className="feedback-modal-optional">(optional)</span>
              </label>
              <textarea
                id="feedback-steps"
                className="feedback-modal-textarea"
                placeholder="1. Go to...&#10;2. Click on...&#10;3. See error..."
                value={formData.steps_to_reproduce}
                onChange={e => handleChange('steps_to_reproduce', e.target.value)}
                rows={3}
              />
            </div>
          )}

          {/* Priority */}
          <div className="feedback-modal-field">
            <label className="feedback-modal-label">Priority</label>
            <div className="feedback-modal-priority-row">
              {PRIORITY_OPTIONS.map(option => (
                <button
                  key={option.value}
                  type="button"
                  className={`feedback-modal-priority-btn ${formData.priority === option.value ? 'selected' : ''}`}
                  onClick={() => handleChange('priority', option.value)}
                  style={{
                    '--priority-color': option.color
                  }}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>

          {/* Email */}
          <div className="feedback-modal-field">
            <label className="feedback-modal-label" htmlFor="feedback-email">
              Your Email <span className="feedback-modal-required">*</span>
            </label>
            <input
              id="feedback-email"
              type="email"
              className={`feedback-modal-input ${errors.email ? 'error' : ''}`}
              placeholder="your@email.com"
              value={formData.email}
              onChange={e => handleChange('email', e.target.value)}
              disabled={isAuthenticated && user?.email}
            />
            {errors.email && (
              <span className="feedback-modal-error">{errors.email}</span>
            )}
            {isAuthenticated && user?.email && (
              <span className="feedback-modal-hint">Using your account email</span>
            )}
          </div>

          {/* Console Logs Toggle */}
          <div className="feedback-modal-field">
            <label className="feedback-modal-checkbox-label">
              <input
                type="checkbox"
                checked={includeConsoleLogs}
                onChange={e => setIncludeConsoleLogs(e.target.checked)}
              />
              <span>Include browser logs</span>
              <span className="feedback-modal-checkbox-hint">
                Helps us diagnose issues (sensitive data is filtered)
              </span>
            </label>
          </div>

          {/* Context Info */}
          <div className="feedback-modal-context">
            <AlertTriangle size={14} />
            <span>
              We'll also capture the current page URL and browser info to help diagnose issues.
            </span>
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            className="feedback-modal-submit-btn"
            disabled={isSubmitting}
          >
            {isSubmitting ? (
              <>
                <Loader2 size={18} className="feedback-modal-spinner" />
                Submitting...
              </>
            ) : (
              <>
                <Send size={18} />
                Submit Feedback
              </>
            )}
          </button>
        </form>
      </div>
    </div>,
    document.body
  )
}

export default FeedbackModal
