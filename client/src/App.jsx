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
            <h3>Ready to Organize Your Collection?</h3>
            <p>Create an account to start tracking your collection and discover new cards</p>
            <div className="auth-actions">
              <Link to="/auth/signup" className="action-button primary">
                <Icon name="collections" size={16} /> Start Collecting
              </Link>
              <Link to="/auth/login" className="action-button secondary">
                <Icon name="user" size={16} /> Sign In
              </Link>
            </div>
          </div>
        )}

        <div className="features-preview">
          <h3>What You Can Do</h3>
          <div className="feature-grid">
            <div className="feature-card">
              <Icon name="search" size={24} />
              <h4>Search Cards</h4>
              <p>Find cards by number, player, team, or series</p>
            </div>
            <div className="feature-card">
              <Icon name="collections" size={24} />
              <h4>Track Collections</h4>
              <p>Organize and manage your card collection</p>
            </div>
            <div className="feature-card">
              <Icon name="import" size={24} />
              <h4>Import Data</h4>
              <p>Upload spreadsheets to quickly build your collection</p>
            </div>
            <div className="feature-card">
              <Icon name="chart" size={24} />
              <h4>View Analytics</h4>
              <p>Analyze collection value and trends</p>
            </div>
          </div>
        </div>

      </header>
    </div>
  )
}

export default App