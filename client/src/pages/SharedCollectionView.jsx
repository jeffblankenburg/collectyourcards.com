import React, { useState, useEffect } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { useToast } from '../contexts/ToastContext'
import CollectionTable from '../components/tables/CollectionTable'
import Icon from '../components/Icon'
import axios from 'axios'
import { createLogger } from '../utils/logger'
import './CollectionDashboardScoped.css'

const log = createLogger('SharedCollectionView')

function SharedCollectionView() {
  const { slug } = useParams()
  const { error } = useToast()
  const navigate = useNavigate()

  const [view, setView] = useState(null)
  const [cards, setCards] = useState([])
  const [stats, setStats] = useState({
    total_cards: 0,
    unique_players: 0,
    unique_series: 0
  })
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [viewMode, setViewMode] = useState('table')

  useEffect(() => {
    fetchSharedView()
  }, [slug])

  useEffect(() => {
    if (view) {
      document.title = `${view.name} - ${view.owner.username}'s Collection - Collect Your Cards`
    } else {
      document.title = 'Shared Collection - Collect Your Cards'
    }
  }, [view])

  const fetchSharedView = async () => {
    try {
      setLoading(true)
      log.info('Fetching shared view', { slug })

      const response = await axios.get(`/api/collection-views/shared/${slug}`)

      if (response.data.success) {
        setView(response.data.view)
        setCards(response.data.cards || [])
        setStats(response.data.stats || { total_cards: 0, unique_players: 0, unique_series: 0 })
      }
    } catch (err) {
      log.error('Failed to fetch shared view', err)

      if (err.response?.status === 404) {
        error('Collection view not found')
      } else {
        error('Failed to load collection view')
      }

      // Redirect to home after a delay
      setTimeout(() => navigate('/'), 3000)
    } finally {
      setLoading(false)
    }
  }

  const formatCurrency = (value) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(value || 0)
  }

  const formatNumber = (value) => {
    return new Intl.NumberFormat('en-US').format(value || 0)
  }

  if (loading) {
    return (
      <div className="collection-dashboard-page">
        <div className="dashboard-container">
          <div className="loading-state">
            <div className="card-icon-spinner xlarge"></div>
            <p>Loading collection view...</p>
          </div>
        </div>
      </div>
    )
  }

  if (!view) {
    return (
      <div className="collection-dashboard-page">
        <div className="dashboard-container">
          <div className="error-state">
            <Icon name="alert-circle" size={48} />
            <h2>Collection View Not Found</h2>
            <p>The collection view you're looking for doesn't exist or is no longer public.</p>
            <Link to="/" className="btn-primary">Go Home</Link>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="collection-dashboard-page">
      <div className="dashboard-container">

        {/* Header */}
        <header className="dashboard-header">
          <div className="header-top">
            <div className="header-title">
              <div className="title-and-icon">
                <Icon name="share-2" size={24} className="title-icon" />
                <div>
                  <h1 className="dashboard-title">{view.name}</h1>
                  <p className="view-owner">
                    by <Link to={`/${view.owner.username}`} className="owner-link">
                      {view.owner.username}
                    </Link>
                    {view.is_owner && <span className="owner-badge"> (You)</span>}
                  </p>
                  {view.description && (
                    <p className="view-description">{view.description}</p>
                  )}
                </div>
              </div>
            </div>

            <div className="header-stats">
              <div className="stat-item">
                <Icon name="layers" size={18} />
                <div className="stat-content">
                  <span className="stat-value">{formatNumber(stats.total_cards)}</span>
                  <span className="stat-label">Cards</span>
                </div>
              </div>
              <div className="stat-item">
                <Icon name="user" size={18} />
                <div className="stat-content">
                  <span className="stat-value">{formatNumber(stats.unique_players)}</span>
                  <span className="stat-label">Players</span>
                </div>
              </div>
              <div className="stat-item">
                <Icon name="package" size={18} />
                <div className="stat-content">
                  <span className="stat-value">{formatNumber(stats.unique_series)}</span>
                  <span className="stat-label">Series</span>
                </div>
              </div>
              <div className="stat-item">
                <Icon name="eye" size={18} />
                <div className="stat-content">
                  <span className="stat-value">{formatNumber(view.view_count)}</span>
                  <span className="stat-label">Views</span>
                </div>
              </div>
            </div>
          </div>
        </header>

        {/* Collection Table */}
        <section className="collection-table-section">
          <CollectionTable
            cards={cards}
            loading={loading}
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            viewMode={viewMode}
            onViewModeChange={setViewMode}
            showGalleryToggle={true}
            downloadFilename={`${view.slug}-shared-collection`}
            maxHeight="800px"
            visibleColumnsOverride={view.visible_columns}
            showColumnPicker={view.is_owner}
          />
        </section>
      </div>
    </div>
  )
}

export default SharedCollectionView
