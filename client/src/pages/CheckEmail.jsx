import React, { useEffect } from 'react'
import { Link, useLocation } from 'react-router-dom'
import Icon from '../components/Icon'
import './Auth.css'

function CheckEmail() {
  const location = useLocation()
  const email = location.state?.email || 'your email'
  
  useEffect(() => {
    document.title = 'Check Your Email - Collect Your Cards'
  }, [])
  
  return (
    <div className="auth-page">
      <div className="auth-container">
        <div className="auth-card">
          <div className="auth-header">
            <h1>Check Your Email</h1>
          </div>
          
          <div className="auth-content">
            <div className="verification-status success">
              <Icon name="mail" size={48} className="success-icon" />
              <h2>Registration Successful!</h2>
              <p>We've sent a verification email to:</p>
              <p className="email-highlight">{email}</p>
              <p>Please click the link in the email to activate your account.</p>
              
              <div className="email-tips">
                <h3>Can't find the email?</h3>
                <ul>
                  <li>Check your spam or junk folder</li>
                  <li>Make sure you entered the correct email address</li>
                  <li>Wait a few minutes - emails can sometimes be delayed</li>
                </ul>
              </div>
              
              <div className="verification-actions">
                <Link to="/" className="auth-button secondary">
                  Back to Home
                </Link>
                <Link to="/auth/login" className="auth-button primary">
                  Go to Login
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default CheckEmail