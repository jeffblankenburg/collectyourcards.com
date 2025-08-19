import React from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import Icon from '../components/Icon'
import './Dashboard.css'

function Dashboard() {
  const { user } = useAuth()

  if (!user) {
    return (
      <div className="dashboard-page">
        <div className="dashboard-container">
          <h2>Please log in to access your dashboard</h2>
        </div>
      </div>
    )
  }

  return (
    <div className="dashboard-page">
      <div className="dashboard-container">
        <header className="dashboard-header">
          <div className="welcome-section">
            <h1>Welcome back, {user.name || user.first_name || 'there'}! 👋</h1>
            <p>Manage your card collection and track your investments</p>
          </div>
          <div className="header-actions">
            <Link to="/profile" className="profile-link">
              <div className="user-avatar">
                {(user.name || user.first_name || 'U')
                  .split(' ')
                  .map(n => n[0])
                  .join('')
                  .substring(0, 2)
                  .toUpperCase()}
              </div>
              <span>Profile</span>
            </Link>
          </div>
        </header>

        <div className="dashboard-stats">
          <div className="stat-card">
            <div className="stat-icon"><Icon name="collections" size={24} /></div>
            <div className="stat-content">
              <h3>Collections</h3>
              <p className="stat-number">0</p>
              <span className="stat-label">Total collections</span>
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-icon"><Icon name="card" size={24} /></div>
            <div className="stat-content">
              <h3>Cards</h3>
              <p className="stat-number">0</p>
              <span className="stat-label">Total cards</span>
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-icon"><Icon name="money" size={24} /></div>
            <div className="stat-content">
              <h3>Value</h3>
              <p className="stat-number">$0.00</p>
              <span className="stat-label">Estimated value</span>
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-icon"><Icon name="trending" size={24} /></div>
            <div className="stat-content">
              <h3>Growth</h3>
              <p className="stat-number">+0%</p>
              <span className="stat-label">This month</span>
            </div>
          </div>
        </div>

        <div className="dashboard-sections">
          <div className="dashboard-section">
            <h2>🚀 Quick Actions</h2>
            <div className="action-grid">
              <button className="action-card" disabled>
                <div className="action-icon">➕</div>
                <h3>Add Cards</h3>
                <p>Add individual cards to your collection</p>
              </button>
              <button className="action-card" disabled>
                <div className="action-icon"><Icon name="import" size={20} /></div>
                <h3>Import Spreadsheet</h3>
                <p>Bulk import from Excel or CSV files</p>
              </button>
              <button className="action-card" disabled>
                <div className="action-icon">🔗</div>
                <h3>Connect eBay</h3>
                <p>Auto-track your eBay purchases</p>
              </button>
              <button className="action-card" disabled>
                <div className="action-icon"><Icon name="mobile" size={20} /></div>
                <h3>Scan Cards</h3>
                <p>Use camera to identify and add cards</p>
              </button>
            </div>
          </div>

          <div className="dashboard-section">
            <h2><Icon name="activity" size={20} /> Recent Activity</h2>
            <div className="activity-feed">
              <div className="activity-item">
                <div className="activity-icon"><Icon name="party" size={16} /></div>
                <div className="activity-content">
                  <h4>Account Created</h4>
                  <p>Welcome to Collect Your Cards!</p>
                  <span className="activity-time">
                    {new Date(user.created_at || Date.now()).toLocaleDateString()}
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div className="dashboard-section">
            <h2><Icon name="fire" size={20} /> Popular Features</h2>
            <div className="feature-list">
              <div className="feature-item">
                <h4><Icon name="collections" size={16} /> Collection Management</h4>
                <p>Organize your cards by sets, years, players, and custom categories</p>
                <span className="feature-status coming-soon">Coming Soon</span>
              </div>
              <div className="feature-item">
                <h4><Icon name="diamond" size={16} /> Value Tracking</h4>
                <p>Track market values and get insights on your collection's worth</p>
                <span className="feature-status coming-soon">Coming Soon</span>
              </div>
              <div className="feature-item">
                <h4><Icon name="target" size={16} /> Wishlist</h4>
                <p>Create wishlists and get notified when cards become available</p>
                <span className="feature-status coming-soon">Coming Soon</span>
              </div>
              <div className="feature-item">
                <h4><Icon name="analytics" size={16} /> Analytics</h4>
                <p>Detailed reports on collection growth, value trends, and more</p>
                <span className="feature-status coming-soon">Coming Soon</span>
              </div>
            </div>
          </div>
        </div>

        <div className="dashboard-footer">
          <div className="help-section">
            <h3>Need Help Getting Started?</h3>
            <p>Check out our quick start guide or contact support</p>
            <div className="help-buttons">
              <Link to="/help" className="help-button">📖 Documentation</Link>
              <Link to="/status" className="help-button"><Icon name="activity" size={16} /> System Status</Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default Dashboard