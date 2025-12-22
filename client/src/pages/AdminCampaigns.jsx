/**
 * AdminCampaigns - Dashboard for viewing campaign conversion metrics
 * Tracks QR code marketing campaign performance
 */

import React, { useState, useEffect } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { useToast } from '../contexts/ToastContext'
import axios from 'axios'
import Icon from '../components/Icon'
import './AdminCampaignsScoped.css'

function AdminCampaigns() {
  const { user } = useAuth()
  const { error: showError } = useToast()

  const [campaigns, setCampaigns] = useState([])
  const [dailyStats, setDailyStats] = useState([])
  const [selectedCampaign, setSelectedCampaign] = useState(null)
  const [campaignDetails, setCampaignDetails] = useState(null)
  const [loading, setLoading] = useState(true)
  const [periodDays, setPeriodDays] = useState(30)

  // Check if user has admin privileges
  if (!user || !['admin', 'superadmin'].includes(user.role)) {
    return (
      <div className="admin-campaigns-page">
        <div className="admin-campaigns-access-denied">
          <h2>Access Denied</h2>
          <p>You need administrator privileges to access this page.</p>
        </div>
      </div>
    )
  }

  useEffect(() => {
    document.title = 'Campaign Analytics - Collect Your Cards'
    loadCampaignStats()
  }, [periodDays])

  useEffect(() => {
    if (selectedCampaign) {
      loadCampaignDetails(selectedCampaign)
    }
  }, [selectedCampaign])

  const loadCampaignStats = async () => {
    try {
      setLoading(true)
      const response = await axios.get(`/api/campaign/stats?days=${periodDays}`)
      setCampaigns(response.data.campaigns || [])
      setDailyStats(response.data.daily || [])
    } catch (err) {
      console.error('Failed to load campaign stats:', err)
      showError('Failed to load campaign statistics')
    } finally {
      setLoading(false)
    }
  }

  const loadCampaignDetails = async (campaignCode) => {
    try {
      const response = await axios.get(`/api/campaign/stats/${campaignCode}?days=${periodDays}`)
      setCampaignDetails(response.data)
    } catch (err) {
      console.error('Failed to load campaign details:', err)
      showError('Failed to load campaign details')
    }
  }

  // Calculate totals across all campaigns
  const totals = campaigns.reduce((acc, c) => ({
    visits: acc.visits + (c.total_visits || 0),
    signups: acc.signups + (c.signups || 0),
    firstCards: acc.firstCards + (c.first_cards || 0)
  }), { visits: 0, signups: 0, firstCards: 0 })

  const overallSignupRate = totals.visits > 0 ? ((totals.signups / totals.visits) * 100).toFixed(1) : 0
  const overallCardRate = totals.signups > 0 ? ((totals.firstCards / totals.signups) * 100).toFixed(1) : 0

  return (
    <div className="admin-campaigns-page">
      <header className="admin-campaigns-header">
        <h1>
          <Icon name="target" size={28} />
          Campaign Analytics
        </h1>
        <p>Track QR code marketing campaign performance and conversions</p>
      </header>

      {/* Period Selector */}
      <div className="admin-campaigns-controls">
        <div className="admin-campaigns-period-selector">
          <label>Time Period:</label>
          <select value={periodDays} onChange={(e) => setPeriodDays(parseInt(e.target.value))}>
            <option value={7}>Last 7 days</option>
            <option value={30}>Last 30 days</option>
            <option value={90}>Last 90 days</option>
            <option value={365}>Last year</option>
          </select>
        </div>
        <button className="admin-campaigns-refresh" onClick={loadCampaignStats}>
          <Icon name="refresh-cw" size={16} />
          Refresh
        </button>
      </div>

      {loading ? (
        <div className="admin-campaigns-loading">
          <div className="admin-campaigns-spinner"></div>
          <p>Loading campaign data...</p>
        </div>
      ) : (
        <>
          {/* Summary Cards */}
          <div className="admin-campaigns-summary">
            <div className="admin-campaigns-summary-card">
              <div className="admin-campaigns-summary-icon visits">
                <Icon name="eye" size={24} />
              </div>
              <div className="admin-campaigns-summary-content">
                <span className="admin-campaigns-summary-value">{totals.visits.toLocaleString()}</span>
                <span className="admin-campaigns-summary-label">Total Visits</span>
              </div>
            </div>
            <div className="admin-campaigns-summary-card">
              <div className="admin-campaigns-summary-icon signups">
                <Icon name="user-plus" size={24} />
              </div>
              <div className="admin-campaigns-summary-content">
                <span className="admin-campaigns-summary-value">{totals.signups.toLocaleString()}</span>
                <span className="admin-campaigns-summary-label">Signups ({overallSignupRate}%)</span>
              </div>
            </div>
            <div className="admin-campaigns-summary-card">
              <div className="admin-campaigns-summary-icon cards">
                <Icon name="layers" size={24} />
              </div>
              <div className="admin-campaigns-summary-content">
                <span className="admin-campaigns-summary-value">{totals.firstCards.toLocaleString()}</span>
                <span className="admin-campaigns-summary-label">Added Cards ({overallCardRate}%)</span>
              </div>
            </div>
          </div>

          {/* Campaign List */}
          <section className="admin-campaigns-section">
            <h2>Campaigns</h2>
            {campaigns.length === 0 ? (
              <div className="admin-campaigns-empty">
                <Icon name="inbox" size={48} />
                <p>No campaign data yet</p>
                <span>Visits from /start will appear here</span>
              </div>
            ) : (
              <div className="admin-campaigns-table-wrapper">
                <table className="admin-campaigns-table">
                  <thead>
                    <tr>
                      <th>Campaign Code</th>
                      <th>Visits</th>
                      <th>Signups</th>
                      <th>Signup Rate</th>
                      <th>Added Cards</th>
                      <th>Card Rate</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {campaigns.map((campaign) => (
                      <tr
                        key={campaign.campaign_code}
                        className={selectedCampaign === campaign.campaign_code ? 'selected' : ''}
                      >
                        <td className="admin-campaigns-code">{campaign.campaign_code}</td>
                        <td>{campaign.total_visits?.toLocaleString() || 0}</td>
                        <td>{campaign.signups?.toLocaleString() || 0}</td>
                        <td>
                          <span className="admin-campaigns-rate">
                            {campaign.signup_rate?.toFixed(1) || 0}%
                          </span>
                        </td>
                        <td>{campaign.first_cards?.toLocaleString() || 0}</td>
                        <td>
                          <span className="admin-campaigns-rate">
                            {campaign.card_rate?.toFixed(1) || 0}%
                          </span>
                        </td>
                        <td>
                          <button
                            className="admin-campaigns-view-btn"
                            onClick={() => setSelectedCampaign(campaign.campaign_code)}
                          >
                            <Icon name="eye" size={14} />
                            View
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          {/* Campaign Details Modal/Panel */}
          {selectedCampaign && campaignDetails && (
            <section className="admin-campaigns-details">
              <div className="admin-campaigns-details-header">
                <h2>
                  <Icon name="bar-chart-2" size={20} />
                  {selectedCampaign}
                </h2>
                <button
                  className="admin-campaigns-close-btn"
                  onClick={() => {
                    setSelectedCampaign(null)
                    setCampaignDetails(null)
                  }}
                >
                  <Icon name="x" size={18} />
                </button>
              </div>

              {/* Stats Grid */}
              {campaignDetails.stats && (
                <div className="admin-campaigns-details-stats">
                  <div className="admin-campaigns-detail-stat">
                    <span className="admin-campaigns-detail-value">{campaignDetails.stats.total_visits || 0}</span>
                    <span className="admin-campaigns-detail-label">Total Visits</span>
                  </div>
                  <div className="admin-campaigns-detail-stat">
                    <span className="admin-campaigns-detail-value">{campaignDetails.stats.signups || 0}</span>
                    <span className="admin-campaigns-detail-label">Signups</span>
                  </div>
                  <div className="admin-campaigns-detail-stat">
                    <span className="admin-campaigns-detail-value">{campaignDetails.stats.first_cards || 0}</span>
                    <span className="admin-campaigns-detail-label">Added Cards</span>
                  </div>
                </div>
              )}

              {/* Recent Visitors */}
              <h3>Recent Visitors</h3>
              {campaignDetails.recent_visitors?.length > 0 ? (
                <div className="admin-campaigns-visitors-table-wrapper">
                  <table className="admin-campaigns-visitors-table">
                    <thead>
                      <tr>
                        <th>Visited</th>
                        <th>Signed Up</th>
                        <th>First Card</th>
                        <th>User</th>
                      </tr>
                    </thead>
                    <tbody>
                      {campaignDetails.recent_visitors.map((visitor) => (
                        <tr key={visitor.visit_id}>
                          <td>{new Date(visitor.visited_at).toLocaleString()}</td>
                          <td>
                            {visitor.signed_up_at ? (
                              <span className="admin-campaigns-check">
                                <Icon name="check" size={14} />
                                {new Date(visitor.signed_up_at).toLocaleDateString()}
                              </span>
                            ) : (
                              <span className="admin-campaigns-pending">-</span>
                            )}
                          </td>
                          <td>
                            {visitor.first_card_at ? (
                              <span className="admin-campaigns-check">
                                <Icon name="check" size={14} />
                                {new Date(visitor.first_card_at).toLocaleDateString()}
                              </span>
                            ) : (
                              <span className="admin-campaigns-pending">-</span>
                            )}
                          </td>
                          <td>
                            {visitor.username ? (
                              <span className="admin-campaigns-username">{visitor.username}</span>
                            ) : visitor.email ? (
                              <span className="admin-campaigns-email">{visitor.email}</span>
                            ) : (
                              <span className="admin-campaigns-anonymous">Anonymous</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="admin-campaigns-no-visitors">No visitors recorded yet</p>
              )}
            </section>
          )}

          {/* Conversion Funnel */}
          <section className="admin-campaigns-funnel">
            <h2>Conversion Funnel</h2>
            <div className="admin-campaigns-funnel-visual">
              <div className="admin-campaigns-funnel-step">
                <div className="admin-campaigns-funnel-bar" style={{ width: '100%' }}>
                  <span className="admin-campaigns-funnel-count">{totals.visits}</span>
                </div>
                <span className="admin-campaigns-funnel-label">Visited Landing Page</span>
              </div>
              <div className="admin-campaigns-funnel-step">
                <div
                  className="admin-campaigns-funnel-bar"
                  style={{ width: totals.visits > 0 ? `${(totals.signups / totals.visits) * 100}%` : '0%' }}
                >
                  <span className="admin-campaigns-funnel-count">{totals.signups}</span>
                </div>
                <span className="admin-campaigns-funnel-label">Created Account</span>
              </div>
              <div className="admin-campaigns-funnel-step">
                <div
                  className="admin-campaigns-funnel-bar"
                  style={{ width: totals.visits > 0 ? `${(totals.firstCards / totals.visits) * 100}%` : '0%' }}
                >
                  <span className="admin-campaigns-funnel-count">{totals.firstCards}</span>
                </div>
                <span className="admin-campaigns-funnel-label">Added First Card</span>
              </div>
            </div>
          </section>
        </>
      )}
    </div>
  )
}

export default AdminCampaigns
