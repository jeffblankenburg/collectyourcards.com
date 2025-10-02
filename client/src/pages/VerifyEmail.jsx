import React, { useState, useEffect } from 'react'
import { useSearchParams, useNavigate, Link } from 'react-router-dom'
import axios from 'axios'
import { useAuth } from '../contexts/AuthContext'
import Icon from '../components/Icon'
import './Auth.css' // Reuse Auth page styles

function VerifyEmail() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const { setAuth } = useAuth()
  const [status, setStatus] = useState('verifying') // 'verifying', 'success', 'error', 'resend'
  const [errorMessage, setErrorMessage] = useState('')
  const [isResending, setIsResending] = useState(false)
  const [resendMessage, setResendMessage] = useState('')
  
  useEffect(() => {
    // Set page title
    document.title = 'Verify Email - Collect Your Cards'
    
    // Get token from URL
    const token = searchParams.get('token')
    
    if (!token) {
      setStatus('error')
      setErrorMessage('No verification token found. Please check your email for the correct link.')
      return
    }
    
    // Verify the email
    verifyEmail(token)
  }, [searchParams])
  
  const verifyEmail = async (token) => {
    try {
      // Note: /api/auth/verify-email doesn't require authentication
      // The /api/auth namespace includes all auth-related endpoints (register, login, verify, etc.)
      const response = await axios.post('/api/auth/verify-email', { token })
      
      if (response.data.success) {
        setStatus('success')
        
        // Auto-login the user with the returned token
        if (response.data.token && response.data.user) {
          // Store the auth data
          localStorage.setItem('token', response.data.token)
          localStorage.setItem('user', JSON.stringify(response.data.user))
          
          // Update the auth context
          setAuth({
            token: response.data.token,
            user: response.data.user
          })
          
          // Redirect to collection dashboard after 2 seconds
          setTimeout(() => {
            navigate('/collection')
          }, 2000)
        } else {
          // Fallback if no token returned (shouldn't happen with updated backend)
          setTimeout(() => {
            navigate('/auth/login')
          }, 3000)
        }
      } else {
        setStatus('error')
        setErrorMessage(response.data.message || 'Verification failed. Please try again.')
      }
    } catch (error) {
      console.error('Verification error:', error.response?.data)
      setStatus('error')
      if (error.response?.status === 400) {
        // Log the actual error from backend
        const backendMessage = error.response?.data?.message || error.response?.data?.error || 'Invalid or expired verification token'
        const details = error.response?.data?.details
        console.log('Backend error message:', backendMessage)
        if (details) console.log('Backend error details:', details)
        setErrorMessage(`${backendMessage}. Please request a new verification email.`)
      } else if (error.response?.status === 409) {
        // Already verified
        setStatus('success')
        setErrorMessage('Your email has already been verified. You can log in.')
        setTimeout(() => {
          navigate('/auth/login')
        }, 2000)
      } else {
        setErrorMessage(error.response?.data?.message || 'An error occurred during verification. Please try again.')
      }
    }
  }

  const handleResendVerification = () => {
    setStatus('resend')
    setResendMessage('')
  }

  const resendVerificationEmail = async (email) => {
    setIsResending(true)
    setResendMessage('')
    
    try {
      const response = await axios.post('/api/auth/resend-verification', { email })
      
      if (response.data.success || response.status === 200) {
        setResendMessage('Verification email sent! Please check your inbox.')
        setTimeout(() => {
          navigate('/check-email', { state: { email } })
        }, 2000)
      } else {
        setResendMessage(response.data.message || 'Failed to send verification email. Please try again.')
      }
    } catch (error) {
      console.error('Resend verification error:', error)
      setResendMessage(error.response?.data?.message || 'Failed to send verification email. Please try again.')
    } finally {
      setIsResending(false)
    }
  }

  const handleResendSubmit = (e) => {
    e.preventDefault()
    const email = e.target.email.value.trim()
    if (email) {
      resendVerificationEmail(email)
    }
  }
  
  return (
    <div className="auth-page">
      <div className="auth-container">
        <div className="auth-card">
          <div className="auth-header">
            <h1>Email Verification</h1>
          </div>
          
          <div className="auth-content">
            {status === 'verifying' && (
              <div className="verification-status">
                <div className="loading-spinner">
                  <Icon name="refresh" size={32} className="spinner" />
                </div>
                <p>Verifying your email address...</p>
              </div>
            )}
            
            {status === 'success' && (
              <div className="verification-status success">
                <Icon name="check-circle" size={48} className="success-icon" />
                <h2>Welcome to Collect Your Cards!</h2>
                <p>Your email has been verified and you have been logged in automatically.</p>
                <p>Taking you to your collection dashboard...</p>
                <Link to="/collection" className="auth-button primary">
                  Go to Collection
                </Link>
              </div>
            )}
            
            {status === 'error' && (
              <div className="verification-status error">
                <Icon name="alert-circle" size={48} className="error-icon" />
                <h2>Verification Failed</h2>
                <p className="error-message">{errorMessage}</p>
                <div className="verification-actions">
                  <button 
                    className="auth-button secondary"
                    onClick={handleResendVerification}
                  >
                    Resend Verification Email
                  </button>
                  <Link to="/auth/login" className="auth-button primary">
                    Go to Login
                  </Link>
                </div>
              </div>
            )}

            {status === 'resend' && (
              <div className="verification-status">
                <Icon name="mail" size={48} className="success-icon" />
                <h2>Resend Verification Email</h2>
                <p>Enter your email address to receive a new verification link.</p>
                
                <form onSubmit={handleResendSubmit} className="resend-form">
                  <div className="form-group">
                    <input
                      type="email"
                      name="email"
                      placeholder="Enter your email address"
                      required
                      className="form-input"
                      autoComplete="email"
                    />
                  </div>
                  
                  <div className="verification-actions">
                    <button 
                      type="button"
                      className="auth-button secondary"
                      onClick={() => setStatus('error')}
                    >
                      Back
                    </button>
                    <button 
                      type="submit"
                      className="auth-button primary"
                      disabled={isResending}
                    >
                      {isResending ? (
                        <>
                          <Icon name="refresh" size={16} className="spinner" />
                          Sending...
                        </>
                      ) : (
                        'Send Verification Email'
                      )}
                    </button>
                  </div>
                </form>
                
                {resendMessage && (
                  <div className={`resend-message ${resendMessage.includes('sent') ? 'success' : 'error'}`}>
                    {resendMessage}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

export default VerifyEmail