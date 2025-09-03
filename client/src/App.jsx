import React, { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import axios from 'axios'
import { useAuth } from './contexts/AuthContext'
import UniversalSearch from './components/UniversalSearch'
import Icon from './components/Icon'
import './HomePage.css'

function App() {
  const [healthData, setHealthData] = useState(null)
  const [databaseStats, setDatabaseStats] = useState({ cards: 793740, players: 6965, teams: 135 })
  const { isAuthenticated } = useAuth()

  useEffect(() => {
    // Set page title
    document.title = 'Collect Your Cards - Sports Card Collection Manager'
    
    // Load health data and database stats in parallel
    Promise.all([
      axios.get('/health'),
      axios.get('/api/database-stats')
    ])
      .then(([healthResponse, statsResponse]) => {
        setHealthData(healthResponse.data)
        if (statsResponse.data?.stats) {
          setDatabaseStats({
            cards: statsResponse.data.stats.cards,
            players: statsResponse.data.stats.players,
            teams: statsResponse.data.stats.teams
          })
        }
      })
      .catch(error => {
        console.error('API connection failed:', error)
      })
  }, [])

  return (
    <div className="home-page">
      <header className="home-page-header">        
        <div className="home-page-hero-search">
          <h3><Icon name="search" size={20} /> Search Our Database</h3>
          <p>Search through {databaseStats.cards.toLocaleString()} cards, {databaseStats.players.toLocaleString()} players, and {databaseStats.teams.toLocaleString()} teams</p>
          <UniversalSearch className="home-page-search" />
        </div>

        {!isAuthenticated && (
          <div className="home-page-auth-section">
            <h3>Ready to Organize Your Collection?</h3>
            <p>Create an account to start tracking your collection and discover new cards</p>
            <div className="home-page-auth-actions">
              <Link to="/auth/signup" className="home-page-action-button primary">
                <Icon name="collections" size={16} /> Start Collecting
              </Link>
              <Link to="/auth/login" className="home-page-action-button secondary">
                <Icon name="user" size={16} /> Sign In
              </Link>
            </div>
          </div>
        )}

        <div className="home-page-features-preview">
          <h3>What You Can Do</h3>
          <div className="home-page-feature-grid">
            <div className="home-page-feature-card">
              <Icon name="search" size={24} />
              <h4>Search Cards</h4>
              <p>Find cards by number, player, team, or series</p>
            </div>
            <div className="home-page-feature-card">
              <Icon name="collections" size={24} />
              <h4>Track Collections</h4>
              <p>Organize and manage your card collection</p>
            </div>
            <div className="home-page-feature-card">
              <Icon name="import" size={24} />
              <h4>Import Data</h4>
              <p>Upload spreadsheets to quickly build your collection</p>
            </div>
            <div className="home-page-feature-card">
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