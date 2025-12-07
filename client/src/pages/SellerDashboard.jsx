import React, { useState, useEffect, useMemo } from 'react'
import { Link } from 'react-router-dom'
import axios from 'axios'
import { useToast } from '../contexts/ToastContext'
import Icon from '../components/Icon'
import EditableSalesTable from '../components/seller/EditableSalesTable'
import BulkSaleModal from '../components/seller/BulkSaleModal'
import './SellerDashboardScoped.css'

function SellerDashboard() {
  const [sales, setSales] = useState([])
  const [platforms, setPlatforms] = useState([])
  const [shippingConfigs, setShippingConfigs] = useState([])
  const [summary, setSummary] = useState(null)
  const [loading, setLoading] = useState(true)
  const [showAnalytics, setShowAnalytics] = useState(true)
  const [showBulkSaleModal, setShowBulkSaleModal] = useState(false)

  const { addToast } = useToast()

  useEffect(() => {
    document.title = 'Seller Dashboard - Collect Your Cards'
    fetchData()
  }, [])

  const fetchData = async () => {
    setLoading(true)
    try {
      const [salesRes, platformsRes, shippingRes, summaryRes] = await Promise.all([
        axios.get('/api/seller/sales?limit=500'),
        axios.get('/api/seller/platforms'),
        axios.get('/api/supplies/shipping-configs'),
        axios.get('/api/seller/summary')
      ])

      setSales(salesRes.data.sales || [])
      setPlatforms(platformsRes.data.platforms || [])
      setShippingConfigs(shippingRes.data.shipping_configs || [])
      setSummary(summaryRes.data)
    } catch (error) {
      console.error('Error fetching seller data:', error)
      addToast('Failed to load seller data', 'error')
    } finally {
      setLoading(false)
    }
  }

  const refreshSummary = () => {
    axios.get('/api/seller/summary').then(res => setSummary(res.data))
  }

  // Full sales data refresh (needed after grouping/ungrouping)
  const refreshSalesData = async () => {
    try {
      const [salesRes, summaryRes] = await Promise.all([
        axios.get('/api/seller/sales?limit=500'),
        axios.get('/api/seller/summary')
      ])
      setSales(salesRes.data.sales || [])
      setSummary(summaryRes.data)
    } catch (error) {
      console.error('Error refreshing sales data:', error)
    }
  }

  const formatCurrencyDisplay = (value) => {
    if (value === null || value === undefined || value === '') return '-'
    const num = parseFloat(value)
    if (isNaN(num)) return '-'
    return `$${num.toFixed(2)}`
  }

  const getProfitClass = (profit) => {
    if (profit === null || profit === undefined) return ''
    const value = parseFloat(profit)
    if (value > 0) return 'seller-profit-positive'
    if (value < 0) return 'seller-profit-negative'
    return ''
  }

  // Comprehensive Analytics Calculations
  // Only count "sold" items for statistics
  const analytics = useMemo(() => {
    if (!sales.length) return null

    // Filter to only sold items for statistics
    const soldSales = sales.filter(s => s.status === 'sold')
    const listedSales = sales.filter(s => s.status === 'listed')

    // Platform breakdown (sold only)
    // Revenue = sale_price + shipping_charged (total money received)
    const platformStats = {}
    soldSales.forEach(sale => {
      const platformName = sale.platform?.name || 'Unassigned'
      if (!platformStats[platformName]) {
        platformStats[platformName] = {
          name: platformName,
          count: 0,
          revenue: 0,
          profit: 0,
          fees: 0
        }
      }
      platformStats[platformName].count++
      platformStats[platformName].revenue += (parseFloat(sale.sale_price) || 0) + (parseFloat(sale.shipping_charged) || 0)
      platformStats[platformName].profit += parseFloat(sale.net_profit) || 0
      platformStats[platformName].fees += parseFloat(sale.platform_fees) || 0
    })

    // Set breakdown (from series -> set) - sold only
    // Revenue = sale_price + shipping_charged (total money received)
    const setStats = {}
    soldSales.forEach(sale => {
      const setName = sale.card_info?.set_name || 'Unknown Set'
      if (!setStats[setName]) {
        setStats[setName] = {
          name: setName,
          count: 0,
          revenue: 0,
          profit: 0
        }
      }
      setStats[setName].count++
      setStats[setName].revenue += (parseFloat(sale.sale_price) || 0) + (parseFloat(sale.shipping_charged) || 0)
      setStats[setName].profit += parseFloat(sale.net_profit) || 0
    })

    // Player breakdown - sold only
    // Revenue = sale_price + shipping_charged (total money received)
    const playerStats = {}
    soldSales.forEach(sale => {
      const playerName = sale.card_info?.players || 'Unknown'
      if (!playerStats[playerName]) {
        playerStats[playerName] = {
          name: playerName,
          count: 0,
          revenue: 0,
          profit: 0,
          avgProfit: 0
        }
      }
      playerStats[playerName].count++
      playerStats[playerName].revenue += (parseFloat(sale.sale_price) || 0) + (parseFloat(sale.shipping_charged) || 0)
      playerStats[playerName].profit += parseFloat(sale.net_profit) || 0
    })
    // Calculate avg profit per player
    Object.values(playerStats).forEach(p => {
      p.avgProfit = p.count > 0 ? p.profit / p.count : 0
    })

    // Card type breakdown (RC, Auto, Relic, SP) - sold only
    // Revenue = sale_price + shipping_charged (total money received)
    const typeStats = {
      rookie: { count: 0, revenue: 0, profit: 0 },
      autograph: { count: 0, revenue: 0, profit: 0 },
      relic: { count: 0, revenue: 0, profit: 0 },
      shortPrint: { count: 0, revenue: 0, profit: 0 },
      base: { count: 0, revenue: 0, profit: 0 }
    }
    soldSales.forEach(sale => {
      const cardInfo = sale.card_info
      const revenue = (parseFloat(sale.sale_price) || 0) + (parseFloat(sale.shipping_charged) || 0)
      const profit = parseFloat(sale.net_profit) || 0

      if (cardInfo?.is_rookie) {
        typeStats.rookie.count++
        typeStats.rookie.revenue += revenue
        typeStats.rookie.profit += profit
      }
      if (cardInfo?.is_autograph) {
        typeStats.autograph.count++
        typeStats.autograph.revenue += revenue
        typeStats.autograph.profit += profit
      }
      if (cardInfo?.is_relic) {
        typeStats.relic.count++
        typeStats.relic.revenue += revenue
        typeStats.relic.profit += profit
      }
      if (cardInfo?.is_short_print) {
        typeStats.shortPrint.count++
        typeStats.shortPrint.revenue += revenue
        typeStats.shortPrint.profit += profit
      }
      // Base = no special attributes
      if (!cardInfo?.is_rookie && !cardInfo?.is_autograph && !cardInfo?.is_relic && !cardInfo?.is_short_print) {
        typeStats.base.count++
        typeStats.base.revenue += revenue
        typeStats.base.profit += profit
      }
    })

    // Top performers
    const topPlatforms = Object.values(platformStats)
      .filter(p => p.name !== 'Unassigned')
      .sort((a, b) => b.profit - a.profit)
      .slice(0, 5)

    const topSets = Object.values(setStats)
      .filter(s => s.name !== 'Unknown Set')
      .sort((a, b) => b.profit - a.profit)
      .slice(0, 5)

    const topPlayers = Object.values(playerStats)
      .filter(p => p.name !== 'Unknown')
      .sort((a, b) => b.profit - a.profit)
      .slice(0, 5)

    // Overall totals - sold only
    // Revenue = sale_price + shipping_charged (total money received)
    const totals = soldSales.reduce((acc, sale) => {
      acc.purchaseCost += parseFloat(sale.purchase_price) || 0
      acc.salePrice += parseFloat(sale.sale_price) || 0
      acc.shippingCharged += parseFloat(sale.shipping_charged) || 0
      acc.fees += parseFloat(sale.platform_fees) || 0
      acc.shippingCost += parseFloat(sale.shipping_cost) || 0
      acc.supplies += parseFloat(sale.supply_cost) || 0
      acc.profit += parseFloat(sale.net_profit) || 0
      return acc
    }, { purchaseCost: 0, salePrice: 0, shippingCharged: 0, fees: 0, shippingCost: 0, supplies: 0, profit: 0 })

    // Revenue includes shipping charged (total money received from buyer)
    totals.revenue = totals.salePrice + totals.shippingCharged
    totals.avgProfit = soldSales.length > 0 ? totals.profit / soldSales.length : 0
    totals.profitMargin = totals.revenue > 0 ? (totals.profit / totals.revenue) * 100 : 0

    return {
      platformStats: Object.values(platformStats),
      setStats: Object.values(setStats),
      playerStats: Object.values(playerStats),
      typeStats,
      topPlatforms,
      topSets,
      topPlayers,
      totals,
      soldCount: soldSales.length,
      listedCount: listedSales.length,
      totalCount: sales.length,
      uniquePlayers: Object.keys(playerStats).filter(k => k !== 'Unknown').length,
      uniqueSets: Object.keys(setStats).filter(k => k !== 'Unknown Set').length,
      uniquePlatforms: Object.keys(platformStats).filter(k => k !== 'Unassigned').length
    }
  }, [sales])

  return (
    <div className="seller-dashboard-page">
      <div className="seller-dashboard-header">
        <div className="seller-dashboard-title">
          <Icon name="dollar-sign" size={32} />
          <h1>Seller Dashboard</h1>
        </div>
        <div className="seller-dashboard-actions">
          <Link to="/seller/purchases" className="seller-nav-btn seller-nav-btn-primary">
            <Icon name="package" size={16} />
            Set Purchases
          </Link>
          <Link to="/seller/supplies" className="seller-nav-btn">
            <Icon name="layers" size={16} />
            Supplies
          </Link>
          <Link to="/seller/shipping" className="seller-nav-btn">
            <Icon name="mail" size={16} />
            Shipping Configs
          </Link>
          <button className="seller-refresh-btn" onClick={fetchData}>
            <Icon name="refresh-cw" size={16} />
            Refresh
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      {analytics && (
        <div className="seller-dashboard-summary">
          <div className="seller-summary-card">
            <div className="seller-summary-label">Listed</div>
            <div className="seller-summary-value">{analytics.listedCount}</div>
          </div>
          <div className="seller-summary-card">
            <div className="seller-summary-label">Sold</div>
            <div className="seller-summary-value">{analytics.soldCount}</div>
          </div>
          <div className="seller-summary-card seller-summary-profit">
            <div className="seller-summary-label">Profit/Card</div>
            <div className={`seller-summary-value ${getProfitClass(analytics.totals.avgProfit)}`}>
              {formatCurrencyDisplay(analytics.totals.avgProfit)}
            </div>
          </div>
          <div className="seller-summary-card seller-summary-profit">
            <div className="seller-summary-label">Net Profit</div>
            <div className={`seller-summary-value ${getProfitClass(analytics.totals.profit)}`}>
              {formatCurrencyDisplay(analytics.totals.profit)}
            </div>
          </div>
          <div className="seller-summary-card seller-summary-margin">
            <div className="seller-summary-label">Margin</div>
            <div className={`seller-summary-value ${getProfitClass(analytics.totals.profitMargin)}`}>
              {analytics.totals.profitMargin.toFixed(1)}%
            </div>
          </div>
        </div>
      )}

      {/* Analytics Toggle */}
      {analytics && (
        <button
          className="seller-analytics-toggle"
          onClick={() => setShowAnalytics(!showAnalytics)}
        >
          <Icon name={showAnalytics ? 'chevron-up' : 'chevron-down'} size={16} />
          {showAnalytics ? 'Hide Analytics' : 'Show Analytics'}
        </button>
      )}

      {/* Detailed Analytics Section */}
      {analytics && showAnalytics && (
        <div className="seller-analytics-section">
          {/* Platform Breakdown */}
          {analytics.topPlatforms.length > 0 && (
            <div className="seller-analytics-card">
              <h3><Icon name="credit-card" size={18} /> Platform Performance</h3>
              <div className="seller-analytics-table">
                <div className="seller-analytics-row seller-analytics-header">
                  <span className="seller-analytics-name">Platform</span>
                  <span className="seller-analytics-num">Sales</span>
                  <span className="seller-analytics-num">Revenue</span>
                  <span className="seller-analytics-num">Fees</span>
                  <span className="seller-analytics-num">Profit</span>
                </div>
                {analytics.platformStats
                  .filter(p => p.name !== 'Unassigned')
                  .sort((a, b) => b.profit - a.profit)
                  .map(platform => (
                  <div key={platform.name} className="seller-analytics-row">
                    <span className="seller-analytics-name">{platform.name}</span>
                    <span className="seller-analytics-num">{platform.count}</span>
                    <span className="seller-analytics-num">{formatCurrencyDisplay(platform.revenue)}</span>
                    <span className="seller-analytics-num seller-analytics-negative">{formatCurrencyDisplay(platform.fees)}</span>
                    <span className={`seller-analytics-num ${getProfitClass(platform.profit)}`}>
                      {formatCurrencyDisplay(platform.profit)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Top Sets */}
          {analytics.topSets.length > 0 && (
            <div className="seller-analytics-card">
              <h3><Icon name="layers" size={18} /> Most Profitable Sets</h3>
              <div className="seller-analytics-table">
                <div className="seller-analytics-row seller-analytics-header">
                  <span className="seller-analytics-name">Set</span>
                  <span className="seller-analytics-num">Sales</span>
                  <span className="seller-analytics-num">Revenue</span>
                  <span className="seller-analytics-num">Profit</span>
                  <span className="seller-analytics-num">Avg</span>
                </div>
                {analytics.topSets.map(set => (
                  <div key={set.name} className="seller-analytics-row">
                    <span className="seller-analytics-name" title={set.name}>{set.name}</span>
                    <span className="seller-analytics-num">{set.count}</span>
                    <span className="seller-analytics-num">{formatCurrencyDisplay(set.revenue)}</span>
                    <span className={`seller-analytics-num ${getProfitClass(set.profit)}`}>
                      {formatCurrencyDisplay(set.profit)}
                    </span>
                    <span className={`seller-analytics-num ${getProfitClass(set.profit / set.count)}`}>
                      {formatCurrencyDisplay(set.profit / set.count)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Top Players */}
          {analytics.topPlayers.length > 0 && (
            <div className="seller-analytics-card">
              <h3><Icon name="user" size={18} /> Most Profitable Players</h3>
              <div className="seller-analytics-table">
                <div className="seller-analytics-row seller-analytics-header">
                  <span className="seller-analytics-name">Player</span>
                  <span className="seller-analytics-num">Sales</span>
                  <span className="seller-analytics-num">Revenue</span>
                  <span className="seller-analytics-num">Profit</span>
                  <span className="seller-analytics-num">Avg</span>
                </div>
                {analytics.topPlayers.map(player => (
                  <div key={player.name} className="seller-analytics-row">
                    <span className="seller-analytics-name" title={player.name}>{player.name}</span>
                    <span className="seller-analytics-num">{player.count}</span>
                    <span className="seller-analytics-num">{formatCurrencyDisplay(player.revenue)}</span>
                    <span className={`seller-analytics-num ${getProfitClass(player.profit)}`}>
                      {formatCurrencyDisplay(player.profit)}
                    </span>
                    <span className={`seller-analytics-num ${getProfitClass(player.avgProfit)}`}>
                      {formatCurrencyDisplay(player.avgProfit)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Card Type Breakdown */}
          <div className="seller-analytics-card">
            <h3><Icon name="layers" size={18} /> Card Type Performance</h3>
            <div className="seller-analytics-table">
              <div className="seller-analytics-row seller-analytics-header">
                <span className="seller-analytics-name">Type</span>
                <span className="seller-analytics-num">Sales</span>
                <span className="seller-analytics-num">Revenue</span>
                <span className="seller-analytics-num">Profit</span>
                <span className="seller-analytics-num">Avg</span>
              </div>
              {analytics.typeStats.rookie.count > 0 && (
                <div className="seller-analytics-row">
                  <span className="seller-analytics-name"><span className="seller-tag seller-tag-rc">RC</span> Rookies</span>
                  <span className="seller-analytics-num">{analytics.typeStats.rookie.count}</span>
                  <span className="seller-analytics-num">{formatCurrencyDisplay(analytics.typeStats.rookie.revenue)}</span>
                  <span className={`seller-analytics-num ${getProfitClass(analytics.typeStats.rookie.profit)}`}>
                    {formatCurrencyDisplay(analytics.typeStats.rookie.profit)}
                  </span>
                  <span className={`seller-analytics-num ${getProfitClass(analytics.typeStats.rookie.profit / analytics.typeStats.rookie.count)}`}>
                    {formatCurrencyDisplay(analytics.typeStats.rookie.profit / analytics.typeStats.rookie.count)}
                  </span>
                </div>
              )}
              {analytics.typeStats.autograph.count > 0 && (
                <div className="seller-analytics-row">
                  <span className="seller-analytics-name"><span className="seller-tag seller-tag-auto">Auto</span> Autographs</span>
                  <span className="seller-analytics-num">{analytics.typeStats.autograph.count}</span>
                  <span className="seller-analytics-num">{formatCurrencyDisplay(analytics.typeStats.autograph.revenue)}</span>
                  <span className={`seller-analytics-num ${getProfitClass(analytics.typeStats.autograph.profit)}`}>
                    {formatCurrencyDisplay(analytics.typeStats.autograph.profit)}
                  </span>
                  <span className={`seller-analytics-num ${getProfitClass(analytics.typeStats.autograph.profit / analytics.typeStats.autograph.count)}`}>
                    {formatCurrencyDisplay(analytics.typeStats.autograph.profit / analytics.typeStats.autograph.count)}
                  </span>
                </div>
              )}
              {analytics.typeStats.relic.count > 0 && (
                <div className="seller-analytics-row">
                  <span className="seller-analytics-name"><span className="seller-tag seller-tag-relic">Relic</span> Relics</span>
                  <span className="seller-analytics-num">{analytics.typeStats.relic.count}</span>
                  <span className="seller-analytics-num">{formatCurrencyDisplay(analytics.typeStats.relic.revenue)}</span>
                  <span className={`seller-analytics-num ${getProfitClass(analytics.typeStats.relic.profit)}`}>
                    {formatCurrencyDisplay(analytics.typeStats.relic.profit)}
                  </span>
                  <span className={`seller-analytics-num ${getProfitClass(analytics.typeStats.relic.profit / analytics.typeStats.relic.count)}`}>
                    {formatCurrencyDisplay(analytics.typeStats.relic.profit / analytics.typeStats.relic.count)}
                  </span>
                </div>
              )}
              {analytics.typeStats.shortPrint.count > 0 && (
                <div className="seller-analytics-row">
                  <span className="seller-analytics-name"><span className="seller-tag seller-tag-sp">SP</span> Short Prints</span>
                  <span className="seller-analytics-num">{analytics.typeStats.shortPrint.count}</span>
                  <span className="seller-analytics-num">{formatCurrencyDisplay(analytics.typeStats.shortPrint.revenue)}</span>
                  <span className={`seller-analytics-num ${getProfitClass(analytics.typeStats.shortPrint.profit)}`}>
                    {formatCurrencyDisplay(analytics.typeStats.shortPrint.profit)}
                  </span>
                  <span className={`seller-analytics-num ${getProfitClass(analytics.typeStats.shortPrint.profit / analytics.typeStats.shortPrint.count)}`}>
                    {formatCurrencyDisplay(analytics.typeStats.shortPrint.profit / analytics.typeStats.shortPrint.count)}
                  </span>
                </div>
              )}
              {analytics.typeStats.base.count > 0 && (
                <div className="seller-analytics-row">
                  <span className="seller-analytics-name">Base Cards</span>
                  <span className="seller-analytics-num">{analytics.typeStats.base.count}</span>
                  <span className="seller-analytics-num">{formatCurrencyDisplay(analytics.typeStats.base.revenue)}</span>
                  <span className={`seller-analytics-num ${getProfitClass(analytics.typeStats.base.profit)}`}>
                    {formatCurrencyDisplay(analytics.typeStats.base.profit)}
                  </span>
                  <span className={`seller-analytics-num ${getProfitClass(analytics.typeStats.base.profit / analytics.typeStats.base.count)}`}>
                    {formatCurrencyDisplay(analytics.typeStats.base.profit / analytics.typeStats.base.count)}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Cost Breakdown */}
          <div className="seller-analytics-card seller-analytics-costs">
            <h3><Icon name="analytics" size={18} /> Cost Breakdown</h3>
            <div className="seller-cost-grid">
              <div className="seller-cost-item">
                <span className="seller-cost-label">Card Costs</span>
                <span className="seller-cost-value seller-analytics-negative">{formatCurrencyDisplay(analytics.totals.purchaseCost)}</span>
              </div>
              <div className="seller-cost-item">
                <span className="seller-cost-label">Platform Fees</span>
                <span className="seller-cost-value seller-analytics-negative">{formatCurrencyDisplay(analytics.totals.fees)}</span>
              </div>
              <div className="seller-cost-item">
                <span className="seller-cost-label">Shipping Costs</span>
                <span className="seller-cost-value seller-analytics-negative">{formatCurrencyDisplay(analytics.totals.shippingCost)}</span>
              </div>
              <div className="seller-cost-item">
                <span className="seller-cost-label">Supply Costs</span>
                <span className="seller-cost-value seller-analytics-negative">{formatCurrencyDisplay(analytics.totals.supplies)}</span>
              </div>
              <div className="seller-cost-item">
                <span className="seller-cost-label">Shipping Charged</span>
                <span className="seller-cost-value seller-profit-positive">{formatCurrencyDisplay(analytics.totals.shippingCharged)}</span>
              </div>
              <div className="seller-cost-item seller-cost-highlight">
                <span className="seller-cost-label">Avg Profit/Sale</span>
                <span className={`seller-cost-value ${getProfitClass(analytics.totals.avgProfit)}`}>
                  {formatCurrencyDisplay(analytics.totals.avgProfit)}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Editable Sales Table - Using Shared Component */}
      <EditableSalesTable
        sales={sales}
        platforms={platforms}
        shippingConfigs={shippingConfigs}
        onSalesUpdate={setSales}
        onSummaryRefresh={refreshSummary}
        onDataRefresh={refreshSalesData}
        onAddBulkSale={() => setShowBulkSaleModal(true)}
        loading={loading}
        showShippingConfig={true}
        showAdjustment={true}
        showDeleteButton={true}
        emptyMessage="No sales yet. Click the + button on any card and select 'Sell This Card' to add it here."
      />

      {/* Bulk Sale Modal */}
      <BulkSaleModal
        isOpen={showBulkSaleModal}
        onClose={() => setShowBulkSaleModal(false)}
        onSuccess={refreshSalesData}
        platforms={platforms}
        shippingConfigs={shippingConfigs}
      />
    </div>
  )
}

export default SellerDashboard
