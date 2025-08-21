import React from 'react'
import { Link, useLocation } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import Icon from './Icon'
import './Footer.css'

function Footer() {
  const { isAuthenticated } = useAuth()
  const location = useLocation()
  const currentYear = new Date().getFullYear()

  const isActive = (path) => {
    return location.pathname === path
  }

  return (
    <footer className="app-footer">
      <div className="footer-container">
        {/* Navigation Links */}
        <div className="footer-section">
          <h4>Navigation</h4>
          <div className="footer-links">
            <Link to="/" className={`footer-link ${isActive('/') ? 'active' : ''}`}>
              <Icon name="home" size={16} /> Home
            </Link>
            {isAuthenticated ? (
              <>
                <Link to="/dashboard" className={`footer-link ${isActive('/dashboard') ? 'active' : ''}`}>
                  <Icon name="home" size={16} /> Dashboard
                </Link>
                <Link to="/collections" className={`footer-link ${isActive('/collections') ? 'active' : ''}`}>
                  <Icon name="collections" size={16} /> Collections
                </Link>
                <Link to="/import" className={`footer-link ${isActive('/import') ? 'active' : ''}`}>
                  <Icon name="import" size={16} /> Import
                </Link>
                <Link to="/analytics" className={`footer-link ${isActive('/analytics') ? 'active' : ''}`}>
                  <Icon name="analytics" size={16} /> Analytics
                </Link>
              </>
            ) : (
              <>
                <Link to="/features" className={`footer-link ${isActive('/features') ? 'active' : ''}`}>
                  Features
                </Link>
                <Link to="/pricing" className={`footer-link ${isActive('/pricing') ? 'active' : ''}`}>
                  Pricing
                </Link>
              </>
            )}
          </div>
        </div>

        {/* Account Links */}
        <div className="footer-section">
          <h4>Account</h4>
          <div className="footer-links">
            {isAuthenticated ? (
              <>
                <Link to="/profile" className="footer-link">
                  <Icon name="profile" size={16} /> Profile
                </Link>
                <Link to="/help" className="footer-link">
                  <Icon name="help" size={16} /> Help & Support
                </Link>
              </>
            ) : (
              <>
                <Link to="/login" className="footer-link">
                  <Icon name="user" size={16} /> Sign In
                </Link>
                <Link to="/register" className="footer-link">
                  <Icon name="collections" size={16} /> Create Account
                </Link>
              </>
            )}
          </div>
        </div>

        {/* Platform Info */}
        <div className="footer-section">
          <h4>Platform</h4>
          <div className="footer-links">
            <Link to="/status" className="footer-link">
              <Icon name="activity" size={16} /> System Status
            </Link>
            <a href="mailto:support@collectyourcards.com" className="footer-link">
              <Icon name="help" size={16} /> Contact Support
            </a>
            <a href="https://github.com/anthropics/claude-code/issues" target="_blank" rel="noopener noreferrer" className="footer-link">
              <Icon name="info" size={16} /> Feedback
            </a>
          </div>
        </div>

        {/* Legal */}
        <div className="footer-section">
          <h4>Legal</h4>
          <div className="footer-links">
            <Link to="/privacy" className="footer-link">
              Privacy Policy
            </Link>
            <Link to="/terms" className="footer-link">
              Terms of Service
            </Link>
            <Link to="/attributions" className="footer-link">
              Icon Credits
            </Link>
          </div>
        </div>
      </div>

      {/* Bottom Section */}
      <div className="footer-bottom">
        <div className="footer-bottom-content">
          <div className="footer-logo">
            <Icon name="app-logo" size={20} />
            <span>Collect Your Cards</span>
          </div>
          <div className="footer-copyright">
            © {currentYear} Collect Your Cards. All rights reserved.
          </div>
          <div className="footer-built-with">
            Built with care for collectors everywhere
          </div>
        </div>
      </div>
    </footer>
  )
}

export default Footer