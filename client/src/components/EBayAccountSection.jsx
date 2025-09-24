import React, { useState, useEffect } from 'react'
import { useToast } from '../contexts/ToastContext'
import axios from 'axios'
import Icon from './Icon'
import './EBayAccountSection.css'

function EBayAccountSection() {
  const { showToast } = useToast()
  const [ebayAccount, setEbayAccount] = useState(null)
  const [connecting, setConnecting] = useState(false)
  const [disconnecting, setDisconnecting] = useState(false)
  const [loading, setLoading] = useState(true)
  const [syncing, setSyncing] = useState(false)
  const [purchases, setPurchases] = useState([])
  const [testing, setTesting] = useState(false)
  const [showTesting, setShowTesting] = useState(false)

  useEffect(() => {
    checkEbayStatus()
    
    // Check for eBay error parameters in URL
    const urlParams = new URLSearchParams(window.location.search)
    const ebayError = urlParams.get('ebay_error')
    
    if (ebayError) {
      let errorMessage = 'Failed to connect eBay account'
      
      switch (ebayError) {
        case 'temporarily_unavailable':
          errorMessage = 'eBay servers are temporarily unavailable. Please try connecting again in a few minutes.'
          break
        case 'access_denied':
          errorMessage = 'eBay connection was cancelled or denied'
          break
        case 'expired_state':
          errorMessage = 'eBay connection expired. Please try again.'
          break
        case 'missing_parameters':
          errorMessage = 'Invalid eBay response. Please try connecting again.'
          break
        case 'legacy_auth_not_supported':
          errorMessage = 'Legacy eBay authentication detected. Please ensure your eBay Developer account is configured for OAuth 2.0.'
          break
        default:
          errorMessage = 'Failed to connect eBay account. Please try again.'
      }
      
      showToast(errorMessage, 'error')
      
      // Clean up URL parameters
      const newUrl = window.location.pathname
      window.history.replaceState({}, document.title, newUrl)
    }
  }, [])

  // Load purchases when connected
  useEffect(() => {
    if (ebayAccount) {
      fetchPurchases()
    }
  }, [ebayAccount])

  const checkEbayStatus = async () => {
    try {
      setLoading(true)
      const response = await axios.get('/api/ebay/auth/status')
      
      if (response.data.connected) {
        setEbayAccount(response.data.account)
      } else {
        setEbayAccount(null)
      }
    } catch (error) {
      console.error('Error checking eBay status:', error)
      if (error.response?.status !== 401) {
        showToast('Failed to check eBay connection status', 'error')
      }
      setEbayAccount(null)
    } finally {
      setLoading(false)
    }
  }

  const handleConnect = async () => {
    try {
      setConnecting(true)
      const response = await axios.post('/api/ebay/auth/initiate')
      
      // Redirect to eBay OAuth page
      window.location.href = response.data.authUrl
    } catch (error) {
      console.error('Error initiating eBay connection:', error)
      const errorMessage = error.response?.data?.error || 'Failed to start eBay connection'
      showToast(errorMessage, 'error')
      setConnecting(false)
    }
  }

  const handleDisconnect = async () => {
    try {
      setDisconnecting(true)
      console.log('Attempting to disconnect eBay account...')
      
      const response = await axios.delete('/api/ebay/auth/disconnect')
      console.log('Disconnect response:', response.data)
      
      // Immediately update UI state
      setEbayAccount(null)
      setPurchases([]) // Clear purchases when disconnecting
      setDisconnecting(false)
      
      showToast('eBay account disconnected successfully', 'success')
      
      // Verify disconnection with server (optional - UI is already updated)
      checkEbayStatus()
    } catch (error) {
      console.error('Error disconnecting eBay account:', error)
      console.error('Error details:', {
        status: error.response?.status,
        statusText: error.response?.statusText,
        data: error.response?.data
      })
      
      const errorMessage = error.response?.data?.error || error.response?.data?.message || 'Failed to disconnect eBay account'
      showToast(errorMessage, 'error')
      setDisconnecting(false)
    }
  }

  const handleRefreshToken = async () => {
    try {
      await axios.post('/api/ebay/auth/refresh')
      showToast('eBay connection refreshed successfully', 'success')
      checkEbayStatus()
    } catch (error) {
      console.error('Error refreshing eBay token:', error)
      const errorMessage = error.response?.data?.error || 'Failed to refresh eBay connection'
      showToast(errorMessage, 'error')
    }
  }
  
  const handleSyncPurchases = async () => {
    try {
      setSyncing(true)
      const response = await axios.post('/api/ebay/sync/orders')
      
      const { stats, automaticProcessing } = response.data
      
      let message = `Sync complete! Found ${stats.newPurchases} new purchases`
      if (automaticProcessing?.cardsAddedToCollection > 0) {
        message += ` • ${automaticProcessing.cardsAddedToCollection} cards automatically added to your collection!`
      }
      if (automaticProcessing?.cardsSuggestedForReview > 0) {
        message += ` • ${automaticProcessing.cardsSuggestedForReview} cards need review`
      }
      if (automaticProcessing?.totalCardsDetected > 0) {
        message += ` • ${automaticProcessing.totalCardsDetected} sports cards detected`
      }
      
      showToast(message, 'success')
      
      // Fetch the purchases
      fetchPurchases()
      
      // Update last sync time
      checkEbayStatus()
    } catch (error) {
      console.error('Error syncing eBay purchases:', error)
      const errorMessage = error.response?.data?.error || 'Failed to sync eBay purchases'
      showToast(errorMessage, 'error')
    } finally {
      setSyncing(false)
    }
  }
  
  const fetchPurchases = async () => {
    try {
      const response = await axios.get('/api/ebay/sync/purchases')
      setPurchases(response.data.purchases || [])
    } catch (error) {
      console.error('Error fetching purchases:', error)
    }
  }

  const formatDate = (dateString) => {
    if (!dateString) return 'Unknown'
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const formatCurrency = (amount, currency = 'USD') => {
    if (!amount) return '$0.00'
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency,
      minimumFractionDigits: 2
    }).format(amount)
  }

  const handleTestConnection = async () => {
    try {
      setTesting(true)
      const response = await axios.get('/api/ebay/test/connection')
      
      if (response.data.success) {
        showToast('eBay connection test passed! All systems working.', 'success')
      } else {
        showToast(`Connection test failed: ${response.data.recommendation}`, 'error')
      }
      
      console.log('eBay connection test:', response.data)
    } catch (error) {
      console.error('Error testing eBay connection:', error)
      showToast('Failed to test eBay connection', 'error')
    } finally {
      setTesting(false)
    }
  }

  const handleMockSync = async (scenario = 'mixed_realistic') => {
    try {
      setSyncing(true)
      const response = await axios.post('/api/ebay/test/mock-sync', { scenario })
      
      const { stats, automaticProcessing } = response.data
      
      let message = `Mock sync complete! Added ${stats.newPurchases} purchases`
      if (automaticProcessing?.cardsAddedToCollection > 0) {
        message += ` • ${automaticProcessing.cardsAddedToCollection} cards automatically added to your collection!`
      }
      if (automaticProcessing?.cardsSuggestedForReview > 0) {
        message += ` • ${automaticProcessing.cardsSuggestedForReview} cards need review`
      }
      if (automaticProcessing?.totalCardsDetected > 0) {
        message += ` • ${automaticProcessing.totalCardsDetected} sports cards detected`
      }
      
      showToast(message, 'success')
      
      // Refresh data
      fetchPurchases()
      checkEbayStatus()
    } catch (error) {
      console.error('Error with mock sync:', error)
      const errorMessage = error.response?.data?.error || 'Failed to perform mock sync'
      showToast(errorMessage, 'error')
    } finally {
      setSyncing(false)
    }
  }

  const handleSmartSync = async () => {
    try {
      setSyncing(true)
      const response = await axios.post('/api/ebay/test/smart-sync')
      
      if (response.data.useRealSync) {
        showToast('eBay sandbox is working! Use the regular Sync Purchases button.', 'info')
      } else {
        const { stats, automaticProcessing } = response.data
        
        let message = `Smart sync used mock data: ${stats.newPurchases} purchases`
        if (automaticProcessing?.cardsAddedToCollection > 0) {
          message += ` • ${automaticProcessing.cardsAddedToCollection} cards automatically added!`
        }
        
        showToast(message, 'success')
        fetchPurchases()
        checkEbayStatus()
      }
    } catch (error) {
      console.error('Error with smart sync:', error)
      showToast('Smart sync failed', 'error')
    } finally {
      setSyncing(false)
    }
  }

  const handleProcessExisting = async () => {
    try {
      setSyncing(true)
      const response = await axios.post('/api/ebay/sync/process-existing')
      
      const { stats, automaticProcessing } = response.data
      
      if (stats.processed === 0) {
        showToast('No unprocessed purchases found', 'info')
      } else {
        let message = `Processed ${stats.processed} existing purchases`
        if (automaticProcessing?.cardsAddedToCollection > 0) {
          message += ` • ${automaticProcessing.cardsAddedToCollection} cards automatically added to your collection!`
        }
        if (automaticProcessing?.cardsSuggestedForReview > 0) {
          message += ` • ${automaticProcessing.cardsSuggestedForReview} cards suggested for review`
        }
        
        showToast(message, 'success')
      }
      
      // Refresh data
      fetchPurchases()
      checkEbayStatus()
    } catch (error) {
      console.error('Error processing existing purchases:', error)
      showToast('Failed to process existing purchases', 'error')
    } finally {
      setSyncing(false)
    }
  }

  const handleClearTestData = async () => {
    try {
      await axios.delete('/api/ebay/test/clear-data')
      showToast('All eBay test data cleared successfully', 'success')
      setPurchases([])
      checkEbayStatus()
    } catch (error) {
      console.error('Error clearing test data:', error)
      showToast('Failed to clear test data', 'error')
    }
  }

  if (loading) {
    return (
      <div className="ebay-section">
        <h3>
          <Icon name="package" size={20} />
          eBay Integration
        </h3>
        <div className="ebay-loading">
          <Icon name="activity" size={20} className="spinner" />
          <span>Checking eBay connection...</span>
        </div>
      </div>
    )
  }

  return (
    <div className="ebay-section">
      <h3>
        <Icon name="package" size={20} />
        eBay Integration
      </h3>
      <p className="section-description">
        Connect your eBay account to automatically detect sports card purchases and add them to your collection.
      </p>

      {ebayAccount ? (
        <div className="ebay-connected">
          <div className="connection-status">
            <div className="status-indicator connected">
              <Icon name="check-circle" size={16} />
              <span>Connected</span>
            </div>
          </div>

          <div className="ebay-account-info">
            <div className="account-detail">
              <label>eBay Username:</label>
              <span>{ebayAccount.username || 'Unknown'}</span>
            </div>
            <div className="account-detail">
              <label>Connected:</label>
              <span>{formatDate(ebayAccount.connectedAt)}</span>
            </div>
            <div className="account-detail">
              <label>Last Sync:</label>
              <span>{ebayAccount.lastSync ? formatDate(ebayAccount.lastSync) : 'Never'}</span>
            </div>
            <div className="account-detail">
              <label>Permissions:</label>
              <div className="permissions-list">
                <span className="permission">Purchase History</span>
                <span className="permission">Public Profile</span>
              </div>
            </div>
          </div>

          <div className="ebay-features">
            <h4>
              <Icon name="zap" size={16} />
              Automatic Features
            </h4>
            <div className="features-list">
              <div className="feature-item">
                <Icon name="search" size={14} />
                <span>Sports card detection from eBay purchases</span>
              </div>
              <div className="feature-item">
                <Icon name="plus-circle" size={14} />
                <span>Automatic addition to "In Transit" location</span>
              </div>
              <div className="feature-item">
                <Icon name="bell" size={14} />
                <span>Real-time purchase notifications</span>
              </div>
              <div className="feature-item">
                <Icon name="target" size={14} />
                <span>AI-powered card matching to database</span>
              </div>
            </div>
          </div>

          <div className="ebay-actions">
            <button
              type="button"
              onClick={handleSyncPurchases}
              disabled={syncing}
              className="sync-btn"
            >
              {syncing ? (
                <>
                  <Icon name="activity" size={14} className="spinner" />
                  Syncing...
                </>
              ) : (
                <>
                  <Icon name="download" size={14} />
                  Sync Purchases
                </>
              )}
            </button>
            {purchases.length > 0 && (
              <button
                type="button"
                onClick={handleProcessExisting}
                disabled={syncing}
                className="sync-btn"
              >
                {syncing ? (
                  <>
                    <Icon name="activity" size={14} className="spinner" />
                    Processing...
                  </>
                ) : (
                  <>
                    <Icon name="zap" size={14} />
                    Process Existing ({purchases.length})
                  </>
                )}
              </button>
            )}
            <button
              type="button"
              onClick={handleRefreshToken}
              className="refresh-btn"
            >
              <Icon name="refresh-cw" size={14} />
              Refresh Connection
            </button>
            <button
              type="button"
              onClick={handleDisconnect}
              disabled={disconnecting}
              className="disconnect-btn"
            >
              {disconnecting ? (
                <>
                  <Icon name="activity" size={14} className="spinner" />
                  Disconnecting...
                </>
              ) : (
                <>
                  <Icon name="unlink" size={14} />
                  Disconnect
                </>
              )}
            </button>
          </div>

          {/* Testing Section */}
          <div className="ebay-testing">
            <div className="testing-header">
              <button
                type="button"
                onClick={() => setShowTesting(!showTesting)}
                className="testing-toggle"
              >
                <Icon name={showTesting ? "chevron-up" : "chevron-down"} size={14} />
                Developer Testing Tools
                <span className="testing-badge">DEV TOOLS</span>
              </button>
            </div>
            
            {showTesting && (
              <div className="testing-content">
                <p className="testing-description">
                  Development tools for testing eBay integration with mock data and verifying API connectivity.
                </p>
                
                <div className="testing-actions">
                  <button
                    type="button"
                    onClick={handleTestConnection}
                    disabled={testing}
                    className="test-btn"
                  >
                    {testing ? (
                      <>
                        <Icon name="activity" size={14} className="spinner" />
                        Testing...
                      </>
                    ) : (
                      <>
                        <Icon name="wifi" size={14} />
                        Test Connection
                      </>
                    )}
                  </button>
                  
                  <button
                    type="button"
                    onClick={() => handleMockSync('sports_cards_only')}
                    disabled={syncing}
                    className="test-btn"
                  >
                    <Icon name="target" size={14} />
                    Mock Sports Cards
                  </button>
                  
                  <button
                    type="button"
                    onClick={() => handleMockSync('mixed_realistic')}
                    disabled={syncing}
                    className="test-btn"
                  >
                    <Icon name="shuffle" size={14} />
                    Mock Mixed Items
                  </button>
                  
                  <button
                    type="button"
                    onClick={handleSmartSync}
                    disabled={syncing}
                    className="test-btn smart"
                  >
                    <Icon name="zap" size={14} />
                    Smart Sync
                  </button>
                  
                  <button
                    type="button"
                    onClick={handleClearTestData}
                    className="test-btn danger"
                  >
                    <Icon name="trash-2" size={14} />
                    Clear Test Data
                  </button>
                </div>
                
                <div className="testing-help">
                  <p><strong>Smart Sync:</strong> Tries real eBay first, falls back to mock data if API fails</p>
                  <p><strong>Mock Syncs:</strong> Generate realistic test data for development</p>
                  <p><strong>Test Connection:</strong> Verify eBay API credentials and production status</p>
                </div>
              </div>
            )}
          </div>

          {/* Recent Purchases Section */}
          {purchases.length > 0 && (
            <div className="ebay-purchases">
              <h4>
                <Icon name="shopping-bag" size={16} />
                Recent eBay Purchases ({purchases.length})
              </h4>
              <div className="purchases-list">
                {purchases.slice(0, 10).map((purchase) => (
                  <div key={purchase.id} className="purchase-item">
                    <div className="purchase-image">
                      {purchase.image_url ? (
                        <img src={purchase.image_url} alt={purchase.title} />
                      ) : (
                        <div className="no-image">
                          <Icon name="image" size={20} />
                        </div>
                      )}
                    </div>
                    <div className="purchase-details">
                      <div className="purchase-title">{purchase.title}</div>
                      <div className="purchase-meta">
                        <span className="purchase-price">
                          {formatCurrency(purchase.price, purchase.currency)}
                        </span>
                        <span className="purchase-date">
                          {formatDate(purchase.purchase_date)}
                        </span>
                        {purchase.seller_name && (
                          <span className="purchase-seller">
                            Seller: {purchase.seller_name}
                          </span>
                        )}
                      </div>
                      <div className="purchase-status">
                        {purchase.is_sports_card ? (
                          <span className="status-badge sports-card">
                            <Icon name="target" size={12} />
                            Sports Card Detected
                          </span>
                        ) : (
                          <span className="status-badge not-card">
                            <Icon name="minus-circle" size={12} />
                            Not a Sports Card
                          </span>
                        )}
                        <span className="status-badge processing">
                          <Icon name="clock" size={12} />
                          {purchase.status.replace('_', ' ').toUpperCase()}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              {purchases.length > 10 && (
                <div className="purchases-footer">
                  <p>Showing 10 of {purchases.length} purchases</p>
                </div>
              )}
            </div>
          )}
        </div>
      ) : (
        <div className="ebay-disconnected">
          <div className="connection-status">
            <div className="status-indicator disconnected">
              <Icon name="x-circle" size={16} />
              <span>Not Connected</span>
            </div>
          </div>

          <div className="ebay-benefits">
            <h4>
              <Icon name="star" size={16} />
              Benefits of Connecting eBay
            </h4>
            <div className="benefits-list">
              <div className="benefit-item">
                <Icon name="zap" size={14} />
                <div>
                  <strong>Automatic Card Detection</strong>
                  <span>We'll automatically identify sports cards from your eBay purchases</span>
                </div>
              </div>
              <div className="benefit-item">
                <Icon name="plus-circle" size={14} />
                <div>
                  <strong>Instant Collection Updates</strong>
                  <span>Cards are automatically added to your "In Transit" location</span>
                </div>
              </div>
              <div className="benefit-item">
                <Icon name="bell" size={14} />
                <div>
                  <strong>Purchase Notifications</strong>
                  <span>Get notified when we detect new card purchases</span>
                </div>
              </div>
              <div className="benefit-item">
                <Icon name="shield" size={14} />
                <div>
                  <strong>Privacy Protected</strong>
                  <span>We only access purchase history, your data stays secure</span>
                </div>
              </div>
            </div>
          </div>

          <div className="ebay-connect-action">
            <button
              type="button"
              onClick={handleConnect}
              disabled={connecting}
              className="connect-btn"
            >
              {connecting ? (
                <>
                  <Icon name="activity" size={16} className="spinner" />
                  Connecting to eBay...
                </>
              ) : (
                <>
                  <Icon name="link" size={16} />
                  Connect eBay Account
                </>
              )}
            </button>
            <small className="connect-help">
              You'll be redirected to eBay to authorize this connection securely
            </small>
          </div>
        </div>
      )}
    </div>
  )
}

export default EBayAccountSection