import React, { useState } from 'react'
import { useToast } from '../../contexts/ToastContext'
import axios from 'axios'
import Icon from '../Icon'
import './ModalStyles.css'

function ChangePasswordModal({ isOpen, onClose }) {
  const { showToast } = useToast()
  const [formData, setFormData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  })
  const [loading, setLoading] = useState(false)
  const [showCurrentPassword, setShowCurrentPassword] = useState(false)
  const [showNewPassword, setShowNewPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [sendingResetEmail, setSendingResetEmail] = useState(false)

  const handleInputChange = (e) => {
    const { name, value } = e.target
    setFormData(prev => ({
      ...prev,
      [name]: value
    }))
  }

  const validatePassword = (password) => {
    const minLength = 8
    const hasUpperCase = /[A-Z]/.test(password)
    const hasLowerCase = /[a-z]/.test(password)
    const hasNumbers = /\d/.test(password)
    const hasSpecialChar = /[!@#$%^&*(),.?":{}|<>]/.test(password)

    if (password.length < minLength) {
      return 'Password must be at least 8 characters long'
    }
    if (!hasUpperCase || !hasLowerCase) {
      return 'Password must contain both uppercase and lowercase letters'
    }
    if (!hasNumbers) {
      return 'Password must contain at least one number'
    }
    if (!hasSpecialChar) {
      return 'Password must contain at least one special character'
    }
    return null
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    
    if (!formData.currentPassword) {
      showToast('Current password is required', 'error')
      return
    }

    const passwordError = validatePassword(formData.newPassword)
    if (passwordError) {
      showToast(passwordError, 'error')
      return
    }

    if (formData.newPassword !== formData.confirmPassword) {
      showToast('New passwords do not match', 'error')
      return
    }

    if (formData.currentPassword === formData.newPassword) {
      showToast('New password must be different from current password', 'error')
      return
    }

    try {
      setLoading(true)
      
      const config = {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      }
      
      await axios.put('/api/profile/change-password', {
        currentPassword: formData.currentPassword,
        newPassword: formData.newPassword
      }, config)
      
      showToast('Password changed successfully!', 'success')
      
      // Reset form
      setFormData({
        currentPassword: '',
        newPassword: '',
        confirmPassword: ''
      })
      
      onClose()
      
    } catch (err) {
      console.error('Error changing password:', err)
      const errorMessage = err.response?.data?.message || err.response?.data?.error || 'Failed to change password'
      showToast(errorMessage, 'error')
    } finally {
      setLoading(false)
    }
  }

  const handleForgotPassword = async () => {
    try {
      setSendingResetEmail(true)
      
      const config = {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      }
      
      // Get user's email from profile
      const profileResponse = await axios.get('/api/profile', config)
      const userEmail = profileResponse.data.profile.email
      
      // Send password reset email
      await axios.post('/api/auth/forgot-password', {
        email: userEmail
      })
      
      showToast('Password reset email sent! Check your inbox.', 'success')
      onClose()
      
    } catch (err) {
      console.error('Error sending reset email:', err)
      showToast('Failed to send reset email. Please try again.', 'error')
    } finally {
      setSendingResetEmail(false)
    }
  }

  const handleClose = () => {
    setFormData({
      currentPassword: '',
      newPassword: '',
      confirmPassword: ''
    })
    onClose()
  }

  if (!isOpen) return null

  return (
    <div className="modal-overlay" onClick={handleClose}>
      <div className="modal-content change-password-modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3>
            <Icon name="lock" size={20} />
            Change Password
          </h3>
          <button onClick={handleClose} className="modal-close-btn">
            <Icon name="x" size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="modal-form">
          <div className="form-group">
            <label htmlFor="currentPassword">Current Password</label>
            <div className="password-input-wrapper">
              <input
                type={showCurrentPassword ? 'text' : 'password'}
                id="currentPassword"
                name="currentPassword"
                value={formData.currentPassword}
                onChange={handleInputChange}
                required
                className="form-input"
                placeholder="Enter your current password"
              />
              <button
                type="button"
                className="password-toggle-btn"
                onClick={() => setShowCurrentPassword(!showCurrentPassword)}
              >
                <Icon name={showCurrentPassword ? 'eye-off' : 'eye'} size={16} />
              </button>
            </div>
            <div className="forgot-password-link-container">
              <button
                type="button"
                className="forgot-password-link"
                onClick={handleForgotPassword}
                disabled={sendingResetEmail}
              >
                {sendingResetEmail ? (
                  <>
                    <Icon name="activity" size={12} className="spinner" />
                    Sending email...
                  </>
                ) : (
                  'Forgot your current password?'
                )}
              </button>
            </div>
          </div>

          <div className="form-group">
            <label htmlFor="newPassword">New Password</label>
            <div className="password-input-wrapper">
              <input
                type={showNewPassword ? 'text' : 'password'}
                id="newPassword"
                name="newPassword"
                value={formData.newPassword}
                onChange={handleInputChange}
                required
                className="form-input"
                placeholder="Enter your new password"
              />
              <button
                type="button"
                className="password-toggle-btn"
                onClick={() => setShowNewPassword(!showNewPassword)}
              >
                <Icon name={showNewPassword ? 'eye-off' : 'eye'} size={16} />
              </button>
            </div>
            <div className="password-requirements">
              <small>
                Password must be at least 8 characters with uppercase, lowercase, number, and special character
              </small>
            </div>
          </div>

          <div className="form-group">
            <label htmlFor="confirmPassword">Confirm New Password</label>
            <div className="password-input-wrapper">
              <input
                type={showConfirmPassword ? 'text' : 'password'}
                id="confirmPassword"
                name="confirmPassword"
                value={formData.confirmPassword}
                onChange={handleInputChange}
                required
                className="form-input"
                placeholder="Confirm your new password"
              />
              <button
                type="button"
                className="password-toggle-btn"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
              >
                <Icon name={showConfirmPassword ? 'eye-off' : 'eye'} size={16} />
              </button>
            </div>
          </div>

          <div className="modal-actions">
            <button
              type="button"
              onClick={handleClose}
              className="btn-cancel"
              disabled={loading}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn-primary"
              disabled={loading}
            >
              {loading ? (
                <>
                  <Icon name="activity" size={16} className="spinner" />
                  Changing Password...
                </>
              ) : (
                'Change Password'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default ChangePasswordModal