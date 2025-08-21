import React, { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import axios from 'axios'
import { useAuth } from './contexts/AuthContext'
import UniversalSearch from './components/UniversalSearch'
import Icon from './components/Icon'
import './App.css'

function App() {
  const [healthData, setHealthData] = useState(null)
  const [loading, setLoading] = useState(true)
  const { isAuthenticated } = useAuth()

  useEffect(() => {
    // Test API connection
    axios.get('/health')
      .then(response => {
        setHealthData(response.data)
        setLoading(false)
      })
      .catch(error => {
        console.error('API connection failed:', error)
        setLoading(false)
      })
  }, [])

  return (
    <div className="App">
      <header className="App-header">        
        <div className="hero-search">
          <h3><Icon name="search" size={20} /> Search Our Database</h3>
          <p>Search through 793,740 cards, 6,965 players, and 135 teams</p>
          <UniversalSearch className="home-search" />
        </div>

        {!isAuthenticated && (
          <div className="auth-section">
            <h3>Get Started Today</h3>
            <p>Join thousands of collectors managing their card collections</p>
            <div className="auth-actions">
              <Link to="/register" className="action-button primary">
                <Icon name="target" size={16} /> Create Account
              </Link>
              <Link to="/login" className="action-button secondary">
                <Icon name="user" size={16} /> Sign In
              </Link>
            </div>
          </div>
        )}

        <div className="features-preview">
          <h3>Platform Features</h3>
          <div className="feature-grid">
            <div className="feature-card">
              <h4><Icon name="user" size={18} /> Authentication System</h4>
              <p>Secure user registration and login</p>
              <span className="feature-status available"><Icon name="success" size={14} /> Available</span>
            </div>
            <div className="feature-card">
              <h4><Icon name="collections" size={18} /> Collection Management</h4>
              <p>Track your card collection digitally</p>
              <span className="feature-status coming-soon"><Icon name="warning" size={14} /> Coming Soon</span>
            </div>
            <div className="feature-card">
              <h4><Icon name="import" size={18} /> Spreadsheet Import</h4>
              <p>Bulk import from Excel/CSV files</p>
              <span className="feature-status coming-soon"><Icon name="warning" size={14} /> Coming Soon</span>
            </div>
            <div className="feature-card">
              <Icon name="chart" size={24} />
              <h4>Track Progress</h4>
              <p>See what you have, what you need, and discover what you want next</p>
            </div>
          </div>
        </div>

        <div className="tech-stack">
          <h3>Technology Stack</h3>
          <div className="tech-grid">
            <span className="tech-badge">React 18</span>
            <span className="tech-badge">Node.js</span>
            <span className="tech-badge">Express.js</span>
            <span className="tech-badge">Prisma ORM</span>
            <span className="tech-badge">SQL Server</span>
            <span className="tech-badge">JWT Auth</span>
          </div>
        </div>
      </header>
    </div>
  )
}

export default App