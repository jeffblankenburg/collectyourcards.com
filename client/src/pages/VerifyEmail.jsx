import React, { useState, useEffect } from 'react'
import { useSearchParams, useNavigate, Link } from 'react-router-dom'
import axios from 'axios'
import Icon from '../components/Icon'
import './Auth.css' // Reuse Auth page styles

function VerifyEmail() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const [status, setStatus] = useState('verifying') // 'verifying', 'success', 'error'
  const [errorMessage, setErrorMessage] = useState('')
  
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
        // Redirect to login after 3 seconds
        setTimeout(() => {
          navigate('/auth/login')
        }, 3000)
      } else {
        setStatus('error')
        setErrorMessage(response.data.message || 'Verification failed. Please try again.')
      }
    } catch (error) {
      setStatus('error')
      if (error.response?.status === 400) {
        setErrorMessage('Invalid or expired verification token. Please request a new verification email.')
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
                <h2>Email Verified Successfully!</h2>
                <p>Your email has been verified. You will be redirected to the login page shortly.</p>
                <Link to="/auth/login" className="auth-button primary">
                  Go to Login
                </Link>
              </div>
            )}
            
            {status === 'error' && (
              <div className="verification-status error">
                <Icon name="alert-circle" size={48} className="error-icon" />
                <h2>Verification Failed</h2>
                <p className="error-message">{errorMessage}</p>
                <div className="verification-actions">
                  <Link to="/auth/signup" className="auth-button secondary">
                    Sign Up Again
                  </Link>
                  <Link to="/auth/login" className="auth-button primary">
                    Go to Login
                  </Link>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

export default VerifyEmail