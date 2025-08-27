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
                <Link to="/collection" className={`footer-link ${isActive('/collection') ? 'active' : ''}`}>
                  <Icon name="collections" size={16} /> Collection
                </Link>
                <Link to="/players" className={`footer-link ${isActive('/players') ? 'active' : ''}`}>
                  <Icon name="user" size={16} /> Players
                </Link>
                <Link to="/teams" className={`footer-link ${isActive('/teams') ? 'active' : ''}`}>
                  <Icon name="shield" size={16} /> Teams
                </Link>
                <Link to="/sets" className={`footer-link ${isActive('/sets') ? 'active' : ''}`}>
                  <Icon name="layers" size={16} /> Sets
                </Link>
              </>
            ) : (
              <>
                <Link to="/players" className={`footer-link ${isActive('/players') ? 'active' : ''}`}>
                  <Icon name="user" size={16} /> Players
                </Link>
                <Link to="/teams" className={`footer-link ${isActive('/teams') ? 'active' : ''}`}>
                  <Icon name="shield" size={16} /> Teams
                </Link>
                <Link to="/sets" className={`footer-link ${isActive('/sets') ? 'active' : ''}`}>
                  <Icon name="layers" size={16} /> Sets
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
                <Link to="/auth/login" className="footer-link">
                  <Icon name="user" size={16} /> Sign In
                </Link>
                <Link to="/auth/signup" className="footer-link">
                  <Icon name="user-plus" size={16} /> Create Account
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

        {/* About */}
        <div className="footer-section">
          <h4>About</h4>
          <div className="footer-links">
            <Link to="/attributions" className="footer-link">
              <Icon name="info" size={16} /> Attributions
            </Link>
            <a href="https://github.com/jeffblankenburg/collectyourcards.com" target="_blank" rel="noopener noreferrer" className="footer-link">
              <Icon name="external-link" size={16} /> Source Code
            </a>
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