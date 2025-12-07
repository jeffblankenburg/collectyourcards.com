import React, { useState, useEffect } from 'react'
import { Link, useParams, useNavigate } from 'react-router-dom'
import axios from 'axios'
import { useToast } from '../contexts/ToastContext'
import Icon from '../components/Icon'
import EditableSalesTable from '../components/seller/EditableSalesTable'
import './SellerPlayerDetailScoped.css'

function SellerPlayerDetail() {
  const { playerId } = useParams()
  const navigate = useNavigate()
  const { addToast } = useToast()

  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [platforms, setPlatforms] = useState([])
  const [shippingConfigs, setShippingConfigs] = useState([])

  useEffect(() => {
    document.title = 'Player Detail - Collect Your Cards'
    fetchData()
  }, [playerId])

  const fetchData = async () => {
    setLoading(true)
    try {
      const [dataRes, platformsRes, shippingRes] = await Promise.all([
        axios.get(`/api/seller/player-sales/${playerId}`),
        axios.get('/api/seller/platforms'),
        axios.get('/api/supplies/shipping-configs')
      ])
      setData(dataRes.data)
      setPlatforms(platformsRes.data.platforms || [])
      setShippingConfigs(shippingRes.data.shipping_configs || [])
      if (dataRes.data.player) {
        const player = dataRes.data.player
        document.title = `${player.first_name} ${player.last_name} - Sales - Collect Your Cards`
      }
    } catch (error) {
      console.error('Error fetching player detail:', error)
      if (error.response?.status === 404) {
        addToast('Player not found', 'error')
        navigate('/seller')
      } else {
        addToast('Failed to load player data', 'error')
      }
    } finally {
      setLoading(false)
    }
  }

  const handleSalesUpdate = (updatedSales) => {
    setData(prev => ({ ...prev, sales: updatedSales }))
  }

  const formatCurrency = (value) => {
    if (value === null || value === undefined) return '-'
    const num = parseFloat(value)
    return isNaN(num) ? '-' : `$${num.toFixed(2)}`
  }

  const formatPercentage = (value) => {
    if (value === null || value === undefined) return '-'
    const num = parseFloat(value)
    return isNaN(num) ? '-' : `${num.toFixed(1)}%`
  }

  if (loading) {
    return (
      <div className="seller-player-detail-page">
        <div className="seller-player-detail-loading">
          <Icon name="loader" size={32} className="spinning" />
          <p>Loading...</p>
        </div>
      </div>
    )
  }

  if (!data) {
    return (
      <div className="seller-player-detail-page">
        <div className="seller-player-detail-error">
          <Icon name="alert-circle" size={48} />
          <p>Failed to load data</p>
          <Link to="/seller" className="seller-player-detail-back-btn">
            <Icon name="arrow-left" size={16} /> Back to Sales
          </Link>
        </div>
      </div>
    )
  }

  const { player, sales, summary } = data

  return (
    <div className="seller-player-detail-page">
      <div className="seller-player-detail-header">
        <div className="seller-player-detail-title">
          <Link to="/seller" className="seller-player-detail-back-link"><Icon name="arrow-left" size={20} /></Link>
          <div className="seller-player-detail-title-content">
            {player.primary_team && (
              <div
                className="seller-player-detail-team-circle"
                style={{
                  background: player.primary_team.primary_color || '#666',
                  borderColor: player.primary_team.secondary_color || '#999'
                }}
                title={player.primary_team.name}
              >
                {player.primary_team.abbreviation || player.primary_team.name?.substring(0, 2)}
              </div>
            )}
            <div className="seller-player-detail-title-text">
              <h1>{player.first_name} {player.last_name}</h1>
              {player.primary_team && (
                <span className="seller-player-detail-team">{player.primary_team.name}</span>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="seller-player-detail-summary-cards">
        <div className="seller-player-detail-summary-card">
          <div className="seller-player-detail-summary-label">Cards Sold</div>
          <div className="seller-player-detail-summary-value">{summary.cards_sold}</div>
        </div>
        <div className="seller-player-detail-summary-card">
          <div className="seller-player-detail-summary-label">Cards Listed</div>
          <div className="seller-player-detail-summary-value">{summary.cards_listed}</div>
        </div>
        <div className="seller-player-detail-summary-card">
          <div className="seller-player-detail-summary-label">Total Revenue</div>
          <div className="seller-player-detail-summary-value seller-player-detail-value-revenue">{formatCurrency(summary.total_revenue)}</div>
        </div>
        <div className="seller-player-detail-summary-card">
          <div className="seller-player-detail-summary-label">Total Costs</div>
          <div className="seller-player-detail-summary-value seller-player-detail-value-cost">{formatCurrency(summary.total_costs)}</div>
        </div>
        <div className="seller-player-detail-summary-card">
          <div className="seller-player-detail-summary-label">Net Profit</div>
          <div className={`seller-player-detail-summary-value ${summary.net_profit >= 0 ? 'seller-player-detail-value-positive' : 'seller-player-detail-value-negative'}`}>
            {formatCurrency(summary.net_profit)}
          </div>
        </div>
        <div className="seller-player-detail-summary-card">
          <div className="seller-player-detail-summary-label">Avg Profit/Card</div>
          <div className={`seller-player-detail-summary-value ${summary.avg_profit_per_card >= 0 ? 'seller-player-detail-value-positive' : 'seller-player-detail-value-negative'}`}>
            {formatCurrency(summary.avg_profit_per_card)}
          </div>
        </div>
        <div className="seller-player-detail-summary-card">
          <div className="seller-player-detail-summary-label">Profit Margin</div>
          <div className={`seller-player-detail-summary-value ${summary.profit_margin >= 0 ? 'seller-player-detail-value-positive' : 'seller-player-detail-value-negative'}`}>
            {formatPercentage(summary.profit_margin)}
          </div>
        </div>
      </div>

      <div className="seller-player-detail-section">
        <h2><Icon name="dollar-sign" size={20} /> Sales ({sales.length})</h2>
        <EditableSalesTable
          sales={sales}
          platforms={platforms}
          shippingConfigs={shippingConfigs}
          onSalesUpdate={handleSalesUpdate}
          onSummaryRefresh={fetchData}
          loading={false}
          showShippingConfig={true}
          showAdjustment={true}
          showDeleteButton={true}
          emptyMessage="No cards featuring this player have been listed or sold yet."
        />
      </div>
    </div>
  )
}

export default SellerPlayerDetail
