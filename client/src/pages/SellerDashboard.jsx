import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { Link } from 'react-router-dom'
import axios from 'axios'
import { useToast } from '../contexts/ToastContext'
import Icon from '../components/Icon'
import ConfirmModal from '../components/modals/ConfirmModal'
import './SellerDashboardScoped.css'

// Calculate text color based on background brightness
const getContrastColor = (hexColor) => {
  if (!hexColor) return '#ffffff'

  // Remove # if present
  const hex = hexColor.replace('#', '')

  // Parse RGB values
  const r = parseInt(hex.substr(0, 2), 16)
  const g = parseInt(hex.substr(2, 2), 16)
  const b = parseInt(hex.substr(4, 2), 16)

  // Handle invalid hex
  if (isNaN(r) || isNaN(g) || isNaN(b)) return '#ffffff'

  // Calculate relative luminance using WCAG formula
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255

  // Return black for light backgrounds, white for dark
  return luminance > 0.5 ? '#000000' : '#ffffff'
}

function SellerDashboard() {
  const [sales, setSales] = useState([])
  const [platforms, setPlatforms] = useState([])
  const [shippingConfigs, setShippingConfigs] = useState([])
  const [summary, setSummary] = useState(null)
  const [loading, setLoading] = useState(true)
  const [editingCell, setEditingCell] = useState(null) // { saleId, field }
  const [editValue, setEditValue] = useState('')
  const [sortConfig, setSortConfig] = useState({ key: 'sale_date', direction: 'desc' })
  const [showAnalytics, setShowAnalytics] = useState(true)
  const [deleteConfirm, setDeleteConfirm] = useState(null) // sale object to delete
  const inputRef = useRef(null)

  const { addToast } = useToast()

  useEffect(() => {
    document.title = 'Seller Dashboard - Collect Your Cards'
    fetchData()
  }, [])

  // Focus input when editing starts
  useEffect(() => {
    if (editingCell && inputRef.current) {
      inputRef.current.focus()
      inputRef.current.select()
    }
  }, [editingCell])

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

  const startEditing = (saleId, field, currentValue) => {
    setEditingCell({ saleId, field })
    setEditValue(currentValue ?? '')
  }

  const cancelEditing = () => {
    setEditingCell(null)
    setEditValue('')
  }

  const saveEdit = async (saleId, field) => {
    if (!editingCell) return

    const sale = sales.find(s => s.sale_id === saleId)
    if (!sale) return

    // Check if value actually changed
    const originalValue = sale[field]
    let newValue = editValue

    // Handle type conversions
    if (['purchase_price', 'sale_price', 'shipping_charged', 'shipping_cost', 'platform_fees', 'other_fees', 'supply_cost', 'adjustment'].includes(field)) {
      newValue = editValue === '' ? null : parseFloat(editValue)
      if (newValue !== null && isNaN(newValue)) {
        addToast('Please enter a valid number', 'error')
        return
      }
    }

    // If no change, just cancel
    if (String(originalValue ?? '') === String(newValue ?? '')) {
      cancelEditing()
      return
    }

    try {
      await axios.put(`/api/seller/sales/${saleId}`, {
        [field]: newValue
      })

      // Update local state immediately for responsiveness
      setSales(prev => prev.map(s => {
        if (s.sale_id === saleId) {
          const updated = { ...s, [field]: newValue }
          // Recalculate profit fields
          // Profit = Sale $ + Ship $ - Purchase Price - Fees - Ship Cost - Supplies + Adjustment
          const purchasePrice = parseFloat(updated.purchase_price) || 0
          const salePrice = parseFloat(updated.sale_price) || 0
          const shippingCharged = parseFloat(updated.shipping_charged) || 0
          const shippingCost = parseFloat(updated.shipping_cost) || 0
          const platformFees = parseFloat(updated.platform_fees) || 0
          const otherFees = parseFloat(updated.other_fees) || 0
          const supplyCost = parseFloat(updated.supply_cost) || 0
          const adjustment = parseFloat(updated.adjustment) || 0 // negative = cost, positive = profit

          updated.total_revenue = salePrice + shippingCharged
          updated.total_costs = purchasePrice + shippingCost + platformFees + otherFees + supplyCost
          updated.net_profit = updated.total_revenue - updated.total_costs + adjustment

          return updated
        }
        return s
      }))

      cancelEditing()

      // Refresh summary in background
      axios.get('/api/seller/summary').then(res => setSummary(res.data))
    } catch (error) {
      console.error('Error updating sale:', error)
      addToast('Failed to update', 'error')
    }
  }

  const handleKeyDown = (e, saleId, field) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      saveEdit(saleId, field)
    } else if (e.key === 'Escape') {
      cancelEditing()
    } else if (e.key === 'Tab') {
      e.preventDefault()
      saveEdit(saleId, field)
      // Move to next editable field
      // Tab order matches column order: Purchase $, Sale $, Ship $, Fees, Ship Cost, Adjust, Notes
      // (Supplies is read-only, calculated from Ship Config)
      const editableFields = ['purchase_price', 'sale_price', 'shipping_charged', 'platform_fees', 'shipping_cost', 'adjustment', 'notes']
      const currentIndex = editableFields.indexOf(field)
      const nextField = editableFields[(currentIndex + 1) % editableFields.length]
      const sale = sales.find(s => s.sale_id === saleId)
      if (sale) {
        setTimeout(() => startEditing(saleId, nextField, sale[nextField]), 50)
      }
    }
  }

  const handleStatusChange = async (saleId, newStatus) => {
    try {
      await axios.put(`/api/seller/sales/${saleId}`, { status: newStatus })
      setSales(prev => prev.map(s => s.sale_id === saleId ? { ...s, status: newStatus } : s))
      axios.get('/api/seller/summary').then(res => setSummary(res.data))
    } catch (error) {
      console.error('Error updating status:', error)
      addToast('Failed to update status', 'error')
    }
  }

  const handlePlatformChange = async (saleId, newPlatformId) => {
    try {
      await axios.put(`/api/seller/sales/${saleId}`, { platform_id: newPlatformId || null })
      const platform = platforms.find(p => p.platform_id === parseInt(newPlatformId))
      setSales(prev => prev.map(s => s.sale_id === saleId ? { ...s, platform_id: newPlatformId || null, platform } : s))
    } catch (error) {
      console.error('Error updating platform:', error)
      addToast('Failed to update platform', 'error')
    }
  }

  const handleDateChange = async (saleId, newDate) => {
    try {
      await axios.put(`/api/seller/sales/${saleId}`, { sale_date: newDate || null })
      setSales(prev => prev.map(s => s.sale_id === saleId ? { ...s, sale_date: newDate || null } : s))
    } catch (error) {
      console.error('Error updating date:', error)
      addToast('Failed to update date', 'error')
    }
  }

  const handleShippingConfigChange = async (saleId, newConfigId) => {
    try {
      const response = await axios.put(`/api/seller/sales/${saleId}`, { shipping_config_id: newConfigId || null })
      // Update with the full sale from response (includes auto-calculated supply_cost)
      const updatedSale = response.data.sale
      setSales(prev => prev.map(s => s.sale_id === saleId ? { ...s, ...updatedSale } : s))
      // Refresh summary
      axios.get('/api/seller/summary').then(res => setSummary(res.data))
    } catch (error) {
      console.error('Error updating shipping config:', error)
      addToast('Failed to update shipping config', 'error')
    }
  }

  const handleDeleteSale = (sale) => {
    // Open confirmation modal
    setDeleteConfirm(sale)
  }

  const confirmDeleteSale = async () => {
    if (!deleteConfirm) return

    const saleId = deleteConfirm.sale_id

    try {
      const response = await axios.delete(`/api/seller/sales/${saleId}`)
      setSales(prev => prev.filter(s => s.sale_id !== saleId))

      // Show appropriate message based on whether card was restored
      if (response.data.restored_to_collection) {
        addToast('Sale removed and card restored to collection', 'success')
      } else {
        addToast('Sale deleted', 'success')
      }

      axios.get('/api/seller/summary').then(res => setSummary(res.data))
    } catch (error) {
      console.error('Error deleting sale:', error)
      addToast('Failed to delete sale', 'error')
    } finally {
      setDeleteConfirm(null)
    }
  }

  const formatCurrency = (value) => {
    if (value === null || value === undefined || value === '') return ''
    const num = parseFloat(value)
    if (isNaN(num)) return ''
    return num.toFixed(2)
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

  // Sorting function
  const handleSort = (key) => {
    setSortConfig(prev => ({
      key,
      direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc'
    }))
  }

  const getSortValue = (sale, key) => {
    switch (key) {
      case 'card_number':
        return sale.card_info?.card_number || ''
      case 'player':
        return sale.card_info?.players || ''
      case 'series':
        return sale.card_info?.series_name || ''
      case 'status':
        return sale.status || ''
      case 'platform':
        return sale.platform?.name || ''
      case 'sale_date':
        return sale.sale_date || ''
      case 'purchase_price':
        return parseFloat(sale.purchase_price) || 0
      case 'sale_price':
        return parseFloat(sale.sale_price) || 0
      case 'shipping_charged':
        return parseFloat(sale.shipping_charged) || 0
      case 'platform_fees':
        return parseFloat(sale.platform_fees) || 0
      case 'shipping_cost':
        return parseFloat(sale.shipping_cost) || 0
      case 'supply_cost':
        return parseFloat(sale.supply_cost) || 0
      case 'adjustment':
        return parseFloat(sale.adjustment) || 0
      case 'net_profit':
        return parseFloat(sale.net_profit) || 0
      case 'profit_margin':
        const sp = parseFloat(sale.sale_price) || 0
        const np = parseFloat(sale.net_profit) || 0
        return sp > 0 ? (np / sp) * 100 : 0
      default:
        return sale[key] || ''
    }
  }

  const sortedSales = useMemo(() => {
    if (!sales.length) return sales
    const sorted = [...sales].sort((a, b) => {
      const aVal = getSortValue(a, sortConfig.key)
      const bVal = getSortValue(b, sortConfig.key)

      if (typeof aVal === 'number' && typeof bVal === 'number') {
        return sortConfig.direction === 'asc' ? aVal - bVal : bVal - aVal
      }

      const aStr = String(aVal).toLowerCase()
      const bStr = String(bVal).toLowerCase()
      if (sortConfig.direction === 'asc') {
        return aStr.localeCompare(bStr)
      }
      return bStr.localeCompare(aStr)
    })
    return sorted
  }, [sales, sortConfig])

  // Comprehensive Analytics Calculations
  // Only count "sold" items for statistics
  const analytics = useMemo(() => {
    if (!sales.length) return null

    // Filter to only sold items for statistics
    const soldSales = sales.filter(s => s.status === 'sold')
    const listedSales = sales.filter(s => s.status === 'listed')

    // Platform breakdown (sold only)
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
      platformStats[platformName].revenue += parseFloat(sale.sale_price) || 0
      platformStats[platformName].profit += parseFloat(sale.net_profit) || 0
      platformStats[platformName].fees += parseFloat(sale.platform_fees) || 0
    })

    // Set breakdown (from series -> set) - sold only
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
      setStats[setName].revenue += parseFloat(sale.sale_price) || 0
      setStats[setName].profit += parseFloat(sale.net_profit) || 0
    })

    // Player breakdown - sold only
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
      playerStats[playerName].revenue += parseFloat(sale.sale_price) || 0
      playerStats[playerName].profit += parseFloat(sale.net_profit) || 0
    })
    // Calculate avg profit per player
    Object.values(playerStats).forEach(p => {
      p.avgProfit = p.count > 0 ? p.profit / p.count : 0
    })

    // Card type breakdown (RC, Auto, Relic, SP) - sold only
    const typeStats = {
      rookie: { count: 0, revenue: 0, profit: 0 },
      autograph: { count: 0, revenue: 0, profit: 0 },
      relic: { count: 0, revenue: 0, profit: 0 },
      shortPrint: { count: 0, revenue: 0, profit: 0 },
      base: { count: 0, revenue: 0, profit: 0 }
    }
    soldSales.forEach(sale => {
      const cardInfo = sale.card_info
      const revenue = parseFloat(sale.sale_price) || 0
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
    const totals = soldSales.reduce((acc, sale) => {
      acc.purchaseCost += parseFloat(sale.purchase_price) || 0
      acc.revenue += parseFloat(sale.sale_price) || 0
      acc.shippingCharged += parseFloat(sale.shipping_charged) || 0
      acc.fees += parseFloat(sale.platform_fees) || 0
      acc.shippingCost += parseFloat(sale.shipping_cost) || 0
      acc.supplies += parseFloat(sale.supply_cost) || 0
      acc.profit += parseFloat(sale.net_profit) || 0
      return acc
    }, { purchaseCost: 0, revenue: 0, shippingCharged: 0, fees: 0, shippingCost: 0, supplies: 0, profit: 0 })

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

  // Render sort header
  const renderSortHeader = (key, label, align = 'left') => {
    const isActive = sortConfig.key === key
    return (
      <th
        className={`seller-sortable-th ${isActive ? 'seller-sort-active' : ''}`}
        style={{ textAlign: align, cursor: 'pointer' }}
        onClick={() => handleSort(key)}
      >
        <span className="seller-th-content">
          {label}
          <span className="seller-sort-icon">
            {isActive ? (sortConfig.direction === 'asc' ? '▲' : '▼') : '◇'}
          </span>
        </span>
      </th>
    )
  }

  const renderEditableCell = (sale, field, type = 'text') => {
    const isEditing = editingCell?.saleId === sale.sale_id && editingCell?.field === field
    const value = sale[field]

    if (isEditing) {
      return (
        <input
          ref={inputRef}
          type={type === 'currency' ? 'number' : 'text'}
          step={type === 'currency' ? '0.01' : undefined}
          className="seller-inline-input"
          value={editValue}
          onChange={(e) => setEditValue(e.target.value)}
          onBlur={() => saveEdit(sale.sale_id, field)}
          onKeyDown={(e) => handleKeyDown(e, sale.sale_id, field)}
        />
      )
    }

    const displayValue = type === 'currency' ? formatCurrencyDisplay(value) : (value || '-')

    return (
      <span
        className="seller-editable-cell"
        onClick={() => startEditing(sale.sale_id, field, type === 'currency' ? formatCurrency(value) : value)}
        title="Click to edit"
      >
        {displayValue}
      </span>
    )
  }

  // Mobile card view for a single sale
  const renderMobileCard = (sale) => (
    <div key={sale.sale_id} className="seller-mobile-card">
      <div className="seller-mobile-card-header">
        <div className="seller-mobile-card-info">
          {sale.card_info ? (
            <>
              <div className="seller-mobile-card-row">
                <span className="seller-card-number">#{sale.card_info.card_number}</span>
                <div className="seller-player-info">
                  {sale.card_info.player_data?.[0] && (
                    <div
                      className="team-circle-base team-circle-xs"
                      style={{
                        background: sale.card_info.player_data[0].primary_color || '#666',
                        borderColor: sale.card_info.player_data[0].secondary_color || '#999'
                      }}
                      title={sale.card_info.player_data[0].team_name}
                    >
                      {sale.card_info.player_data[0].team_abbreviation || ''}
                    </div>
                  )}
                  <span className="seller-card-player">{sale.card_info.players}</span>
                  {sale.card_info.is_rookie && <span className="seller-tag seller-tag-rc">RC</span>}
                </div>
              </div>
              <div className="seller-mobile-card-row">
                <span className="seller-series-name" title={sale.card_info.series_name}>{sale.card_info.series_name}</span>
                <div className="seller-tags">
                  {sale.card_info.color && (
                    <span
                      className="seller-tag"
                      style={{
                        backgroundColor: sale.card_info.color_hex || '#666',
                        color: getContrastColor(sale.card_info.color_hex),
                        borderColor: sale.card_info.color_hex || '#666'
                      }}
                    >
                      {sale.card_info.color}
                    </span>
                  )}
                  {sale.card_info.is_autograph && <span className="seller-tag seller-tag-auto">Auto</span>}
                  {sale.card_info.is_relic && <span className="seller-tag seller-tag-relic">Relic</span>}
                  {sale.card_info.is_short_print && <span className="seller-tag seller-tag-sp">SP</span>}
                </div>
              </div>
            </>
          ) : (
            <span className="seller-card-unknown">Card #{sale.card_id}</span>
          )}
        </div>
        <button
          className="seller-delete-btn"
          onClick={() => handleDeleteSale(sale)}
          title="Delete sale"
        >
          <Icon name="trash" size={16} />
        </button>
      </div>

      <div className="seller-mobile-card-grid">
        <div className="seller-mobile-field">
          <label>Status</label>
          <select
            className="seller-inline-select seller-status-select"
            value={sale.status}
            onChange={(e) => handleStatusChange(sale.sale_id, e.target.value)}
            data-status={sale.status}
          >
            <option value="listed">Listed</option>
            <option value="sold">Sold</option>
          </select>
        </div>

        <div className="seller-mobile-field">
          <label>Platform</label>
          <select
            className="seller-inline-select"
            value={sale.platform_id || ''}
            onChange={(e) => handlePlatformChange(sale.sale_id, e.target.value)}
          >
            <option value="">-</option>
            {platforms.map(p => (
              <option key={p.platform_id} value={p.platform_id}>{p.name}</option>
            ))}
          </select>
        </div>

        <div className="seller-mobile-field">
          <label>Date</label>
          <input
            type="date"
            className="seller-inline-date"
            value={sale.sale_date ? sale.sale_date.split('T')[0] : new Date().toISOString().split('T')[0]}
            onChange={(e) => handleDateChange(sale.sale_id, e.target.value)}
          />
        </div>

        <div className="seller-mobile-field">
          <label>Cost</label>
          {renderEditableCell(sale, 'purchase_price', 'currency')}
        </div>

        <div className="seller-mobile-field">
          <label>Sale Price</label>
          {renderEditableCell(sale, 'sale_price', 'currency')}
        </div>

        <div className="seller-mobile-field">
          <label>Ship Charged</label>
          {renderEditableCell(sale, 'shipping_charged', 'currency')}
        </div>

        <div className="seller-mobile-field">
          <label>Fees</label>
          {renderEditableCell(sale, 'platform_fees', 'currency')}
        </div>

        <div className="seller-mobile-field">
          <label>Ship Cost</label>
          {renderEditableCell(sale, 'shipping_cost', 'currency')}
        </div>

        <div className="seller-mobile-field">
          <label>Ship Config</label>
          <select
            className="seller-inline-select"
            value={sale.shipping_config_id || ''}
            onChange={(e) => handleShippingConfigChange(sale.sale_id, e.target.value)}
          >
            <option value="">-</option>
            {shippingConfigs.map(c => (
              <option key={c.shipping_config_id} value={c.shipping_config_id}>{c.name}</option>
            ))}
          </select>
        </div>

        <div className="seller-mobile-field">
          <label>Supplies</label>
          <span className="seller-mobile-readonly">{formatCurrencyDisplay(sale.supply_cost)}</span>
        </div>

        <div className="seller-mobile-field">
          <label>Adjust</label>
          {renderEditableCell(sale, 'adjustment', 'currency')}
        </div>

        <div className="seller-mobile-field seller-mobile-field-profit">
          <label>Profit</label>
          <span className={`seller-mobile-profit ${getProfitClass(sale.net_profit)}`}>
            {formatCurrencyDisplay(sale.net_profit)}
            {sale.sale_price > 0 && (
              <span className="seller-mobile-percent">
                ({Math.round((sale.net_profit / sale.sale_price) * 100)}%)
              </span>
            )}
          </span>
        </div>
      </div>

      <div className="seller-mobile-card-footer">
        <div className="seller-mobile-field seller-mobile-field-full">
          <label>Notes</label>
          {renderEditableCell(sale, 'notes')}
        </div>
      </div>
    </div>
  )

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
          <div className="seller-summary-card seller-summary-sold">
            <div className="seller-summary-label">Sold</div>
            <div className="seller-summary-value">{analytics.soldCount}</div>
          </div>
          <div className="seller-summary-card seller-summary-revenue">
            <div className="seller-summary-label">Revenue</div>
            <div className="seller-summary-value">{formatCurrencyDisplay(analytics.totals.revenue)}</div>
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

      {/* Editable Sales Table */}
      <div className="seller-dashboard-table-container">
        {loading ? (
          <div className="seller-dashboard-loading">
            <Icon name="loader" size={32} className="spinning" />
            <p>Loading sales...</p>
          </div>
        ) : sales.length === 0 ? (
          <div className="seller-dashboard-empty">
            <Icon name="package" size={48} />
            <h3>No Sales Yet</h3>
            <p>Click the + button on any card and select "Sell This Card" to add it here.</p>
          </div>
        ) : (
          <>
            {/* Mobile Card View */}
            <div className="seller-mobile-view">
              {sales.map(sale => renderMobileCard(sale))}
            </div>

            {/* Desktop Table View */}
            <div className="seller-table-wrapper">
              <table className="seller-dashboard-table seller-editable-table">
              <colgroup>
                <col style={{ width: '70px' }} /> {/* Card # */}
                <col style={{ width: '180px' }} /> {/* Player */}
                <col style={{ width: '160px' }} /> {/* Series */}
                <col style={{ width: '100px' }} /> {/* Tags */}
                <col style={{ width: '100px' }} /> {/* Status */}
                <col style={{ width: '100px' }} /> {/* Platform */}
                <col style={{ width: '110px' }} /> {/* Date */}
                <col style={{ width: '75px' }} /> {/* Cost (purchase price) */}
                <col style={{ width: '75px' }} /> {/* Sale $ */}
                <col style={{ width: '75px' }} /> {/* Ship $ (charged) */}
                <col style={{ width: '75px' }} /> {/* Fees */}
                <col style={{ width: '75px' }} /> {/* Ship Cost */}
                <col style={{ width: '110px' }} /> {/* Shipping Config */}
                <col style={{ width: '70px' }} /> {/* Supplies (read-only) */}
                <col style={{ width: '70px' }} /> {/* Adjust */}
                <col style={{ width: '80px' }} /> {/* Profit */}
                <col style={{ width: '50px' }} /> {/* % */}
                <col style={{ width: '140px' }} /> {/* Notes */}
                <col style={{ width: '40px' }} /> {/* Delete */}
              </colgroup>
              <thead>
                <tr>
                  {renderSortHeader('card_number', 'Card #')}
                  {renderSortHeader('player', 'Player')}
                  {renderSortHeader('series', 'Series')}
                  <th>Tags</th>
                  {renderSortHeader('status', 'Status')}
                  {renderSortHeader('platform', 'Platform')}
                  {renderSortHeader('sale_date', 'Date')}
                  {renderSortHeader('purchase_price', 'Cost', 'right')}
                  {renderSortHeader('sale_price', 'Sale $', 'right')}
                  {renderSortHeader('shipping_charged', 'Ship $', 'right')}
                  {renderSortHeader('platform_fees', 'Fees', 'right')}
                  {renderSortHeader('shipping_cost', 'Ship Cost', 'right')}
                  <th>Ship Config</th>
                  {renderSortHeader('supply_cost', 'Supplies', 'right')}
                  {renderSortHeader('adjustment', 'Adjust', 'right')}
                  {renderSortHeader('net_profit', 'Profit', 'right')}
                  {renderSortHeader('profit_margin', '%', 'right')}
                  <th>Notes</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {sortedSales.map(sale => (
                  <tr key={sale.sale_id}>
                    {/* Card Number - Read Only */}
                    <td>
                      {sale.card_info?.card_number || '-'}
                    </td>

                    {/* Player + Team + RC */}
                    <td className="seller-td-player">
                      {sale.card_info ? (
                        <div className="seller-player-info">
                          {sale.card_info.player_data?.[0] && (
                            <div
                              className="team-circle-base team-circle-xs"
                              style={{
                                background: sale.card_info.player_data[0].primary_color || '#666',
                                borderColor: sale.card_info.player_data[0].secondary_color || '#999'
                              }}
                              title={sale.card_info.player_data[0].team_name}
                            >
                              {sale.card_info.player_data[0].team_abbreviation || ''}
                            </div>
                          )}
                          <span className="seller-player-name">{sale.card_info.players}</span>
                          {sale.card_info.is_rookie && <span className="seller-tag seller-tag-rc">RC</span>}
                        </div>
                      ) : '-'}
                    </td>

                    {/* Series + Print Run */}
                    <td className="seller-td-series">
                      <div className="seller-series-info">
                        <span
                          className="seller-series-name"
                          title={sale.card_info?.series_name || ''}
                        >
                          {sale.card_info?.series_name || '-'}
                        </span>
                        {sale.card_info?.print_run && (
                          <span className="seller-print-info">/{sale.card_info.print_run}</span>
                        )}
                      </div>
                    </td>

                    {/* Tags: Color, Auto, Relic, SP */}
                    <td className="seller-td-tags">
                      <div className="seller-tags">
                        {sale.card_info?.color && (
                          <span
                            className="seller-tag"
                            style={{
                              backgroundColor: sale.card_info.color_hex || '#666',
                              color: getContrastColor(sale.card_info.color_hex),
                              borderColor: sale.card_info.color_hex || '#666'
                            }}
                          >
                            {sale.card_info.color}
                          </span>
                        )}
                        {sale.card_info?.is_autograph && <span className="seller-tag seller-tag-auto">Auto</span>}
                        {sale.card_info?.is_relic && <span className="seller-tag seller-tag-relic">Relic</span>}
                        {sale.card_info?.is_short_print && <span className="seller-tag seller-tag-sp">SP</span>}
                      </div>
                    </td>

                    {/* Status Dropdown */}
                    <td>
                      <select
                        className="seller-inline-select seller-status-select"
                        value={sale.status}
                        onChange={(e) => handleStatusChange(sale.sale_id, e.target.value)}
                        data-status={sale.status}
                      >
                        <option value="listed">Listed</option>
                        <option value="sold">Sold</option>
                      </select>
                    </td>

                    {/* Platform Dropdown */}
                    <td>
                      <select
                        className="seller-inline-select"
                        value={sale.platform_id || ''}
                        onChange={(e) => handlePlatformChange(sale.sale_id, e.target.value)}
                      >
                        <option value="">-</option>
                        {platforms.map(p => (
                          <option key={p.platform_id} value={p.platform_id}>{p.name}</option>
                        ))}
                      </select>
                    </td>

                    {/* Date - defaults to today */}
                    <td>
                      <input
                        type="date"
                        className="seller-inline-date"
                        value={sale.sale_date ? sale.sale_date.split('T')[0] : new Date().toISOString().split('T')[0]}
                        onChange={(e) => handleDateChange(sale.sale_id, e.target.value)}
                      />
                    </td>

                    {/* Purchase Price (original cost of card) */}
                    <td className="seller-td-currency">{renderEditableCell(sale, 'purchase_price', 'currency')}</td>

                    {/* Sale Price (what you charged for the card) */}
                    <td className="seller-td-currency">{renderEditableCell(sale, 'sale_price', 'currency')}</td>

                    {/* Shipping Charged (what you charged buyer for shipping) */}
                    <td className="seller-td-currency">{renderEditableCell(sale, 'shipping_charged', 'currency')}</td>

                    {/* Platform Fees (eBay fees, etc.) */}
                    <td className="seller-td-currency">{renderEditableCell(sale, 'platform_fees', 'currency')}</td>

                    {/* Shipping Cost (what you paid for shipping) */}
                    <td className="seller-td-currency">{renderEditableCell(sale, 'shipping_cost', 'currency')}</td>

                    {/* Shipping Config Dropdown */}
                    <td>
                      <select
                        className="seller-inline-select"
                        value={sale.shipping_config_id || ''}
                        onChange={(e) => handleShippingConfigChange(sale.sale_id, e.target.value)}
                      >
                        <option value="">-</option>
                        {shippingConfigs.map(c => (
                          <option key={c.shipping_config_id} value={c.shipping_config_id}>{c.name}</option>
                        ))}
                      </select>
                    </td>

                    {/* Supplies Cost - Read Only (auto-calculated from Ship Config) */}
                    <td className="seller-td-currency seller-td-readonly">
                      {formatCurrencyDisplay(sale.supply_cost)}
                    </td>

                    {/* Adjustment - editable (negative = cost, positive = profit) */}
                    <td className="seller-td-currency">{renderEditableCell(sale, 'adjustment', 'currency')}</td>

                    {/* Calculated Net Profit - Read Only */}
                    <td className={`seller-td-currency seller-td-profit ${getProfitClass(sale.net_profit)}`}>
                      {formatCurrencyDisplay(sale.net_profit)}
                    </td>

                    {/* Profit Margin % */}
                    <td className={`seller-td-percent ${getProfitClass(sale.net_profit)}`}>
                      {sale.sale_price > 0 ? `${Math.round((sale.net_profit / sale.sale_price) * 100)}%` : '-'}
                    </td>

                    {/* Notes */}
                    <td className="seller-td-notes">{renderEditableCell(sale, 'notes')}</td>

                    {/* Delete Button */}
                    <td className="seller-td-actions">
                      <button
                        className="seller-delete-btn"
                        onClick={() => handleDeleteSale(sale)}
                        title="Delete sale"
                      >
                        <Icon name="trash" size={14} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
              </table>
            </div>
          </>
        )}
      </div>

      {/* Delete Confirmation Modal */}
      <ConfirmModal
        isOpen={!!deleteConfirm}
        onClose={() => setDeleteConfirm(null)}
        onConfirm={confirmDeleteSale}
        title="Delete Sale"
        message={
          deleteConfirm?.user_card_id
            ? 'This will remove the sale listing and restore the card to your collection. Continue?'
            : 'Are you sure you want to delete this sale?'
        }
        confirmText="Delete"
        cancelText="Cancel"
        variant="danger"
      />
    </div>
  )
}

export default SellerDashboard
