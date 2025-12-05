/**
 * EditableSalesTable - Shared editable sales table component
 * Used by both SellerDashboard and SetPurchaseDetail pages
 */

import React, { useState, useEffect, useRef, useMemo } from 'react'
import axios from 'axios'
import { useToast } from '../../contexts/ToastContext'
import Icon from '../Icon'
import ConfirmModal from '../modals/ConfirmModal'
import OrderSuppliesModal from './OrderSuppliesModal'
import './EditableSalesTable.css'

// Calculate text color based on background brightness
const getContrastColor = (hexColor) => {
  if (!hexColor) return '#ffffff'
  const hex = hexColor.replace('#', '')
  const r = parseInt(hex.substr(0, 2), 16)
  const g = parseInt(hex.substr(2, 2), 16)
  const b = parseInt(hex.substr(4, 2), 16)
  if (isNaN(r) || isNaN(g) || isNaN(b)) return '#ffffff'
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255
  return luminance > 0.5 ? '#000000' : '#ffffff'
}

function EditableSalesTable({
  sales,
  platforms,
  shippingConfigs,
  onSalesUpdate,
  onSummaryRefresh,
  onDataRefresh,
  loading = false,
  showShippingConfig = true,
  showAdjustment = true,
  showDeleteButton = true,
  emptyMessage = 'No sales yet.'
}) {
  const { addToast } = useToast()
  const [editingCell, setEditingCell] = useState(null) // { saleId, field }
  const [editValue, setEditValue] = useState('')
  const [sortConfig, setSortConfig] = useState({ key: 'sale_date', direction: 'desc' })
  const [deleteConfirm, setDeleteConfirm] = useState(null)
  const [selectedSales, setSelectedSales] = useState(new Set())
  const [expandedOrders, setExpandedOrders] = useState(new Set())
  const [ungroupConfirm, setUngroupConfirm] = useState(null)
  const [orderSuppliesModal, setOrderSuppliesModal] = useState(null) // { order_id, order }
  const [editingOrderCell, setEditingOrderCell] = useState(null) // { orderId, field, salesInOrder }
  const [editOrderValue, setEditOrderValue] = useState('')
  const inputRef = useRef(null)
  const orderInputRef = useRef(null)

  // Focus input when editing starts
  useEffect(() => {
    if (editingCell && inputRef.current) {
      inputRef.current.focus()
      inputRef.current.select()
    }
  }, [editingCell])

  // Focus order input when editing starts
  useEffect(() => {
    if (editingOrderCell && orderInputRef.current) {
      orderInputRef.current.focus()
      orderInputRef.current.select()
    }
  }, [editingOrderCell])

  const startEditing = (saleId, field, currentValue) => {
    setEditingCell({ saleId, field })
    setEditValue(currentValue ?? '')
  }

  const startOrderEditing = (orderId, field, currentValue, salesInOrder) => {
    setEditingOrderCell({ orderId, field, salesInOrder })
    setEditOrderValue(currentValue ?? '')
  }

  const cancelOrderEditing = () => {
    setEditingOrderCell(null)
    setEditOrderValue('')
  }

  const saveOrderEditing = async () => {
    if (!editingOrderCell) return
    const { orderId, field, salesInOrder } = editingOrderCell
    await handleOrderFieldUpdate(orderId, field, editOrderValue, salesInOrder)
    setEditingOrderCell(null)
    setEditOrderValue('')
  }

  const cancelEditing = () => {
    setEditingCell(null)
    setEditValue('')
  }

  const saveEdit = async (saleId, field) => {
    if (!editingCell) return

    const sale = sales.find(s => s.sale_id === saleId)
    if (!sale) return

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
      await axios.put(`/api/seller/sales/${saleId}`, { [field]: newValue })

      // Update local state with recalculated profit
      const updatedSales = sales.map(s => {
        if (s.sale_id === saleId) {
          const updated = { ...s, [field]: newValue }
          const purchasePrice = parseFloat(updated.purchase_price) || 0
          const salePrice = parseFloat(updated.sale_price) || 0
          const shippingCharged = parseFloat(updated.shipping_charged) || 0
          const shippingCost = parseFloat(updated.shipping_cost) || 0
          const platformFees = parseFloat(updated.platform_fees) || 0
          const otherFees = parseFloat(updated.other_fees) || 0
          const supplyCost = parseFloat(updated.supply_cost) || 0
          const adjustment = parseFloat(updated.adjustment) || 0

          updated.total_revenue = salePrice + shippingCharged
          updated.total_costs = purchasePrice + shippingCost + platformFees + otherFees + supplyCost
          updated.net_profit = updated.total_revenue - updated.total_costs + adjustment

          return updated
        }
        return s
      })

      onSalesUpdate(updatedSales)
      cancelEditing()
      if (onSummaryRefresh) onSummaryRefresh()
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
      onSalesUpdate(sales.map(s => s.sale_id === saleId ? { ...s, status: newStatus } : s))
      if (onSummaryRefresh) onSummaryRefresh()
    } catch (error) {
      console.error('Error updating status:', error)
      addToast('Failed to update status', 'error')
    }
  }

  const handlePlatformChange = async (saleId, newPlatformId) => {
    try {
      await axios.put(`/api/seller/sales/${saleId}`, { platform_id: newPlatformId || null })
      const platform = platforms.find(p => p.platform_id === parseInt(newPlatformId))
      onSalesUpdate(sales.map(s => s.sale_id === saleId ? { ...s, platform_id: newPlatformId || null, platform } : s))
    } catch (error) {
      console.error('Error updating platform:', error)
      addToast('Failed to update platform', 'error')
    }
  }

  const handleDateChange = async (saleId, newDate) => {
    try {
      await axios.put(`/api/seller/sales/${saleId}`, { sale_date: newDate || null })
      onSalesUpdate(sales.map(s => s.sale_id === saleId ? { ...s, sale_date: newDate || null } : s))
    } catch (error) {
      console.error('Error updating date:', error)
      addToast('Failed to update date', 'error')
    }
  }

  const handleShippingConfigChange = async (saleId, newConfigId) => {
    try {
      const response = await axios.put(`/api/seller/sales/${saleId}`, { shipping_config_id: newConfigId || null })
      const updatedSale = response.data.sale
      onSalesUpdate(sales.map(s => s.sale_id === saleId ? { ...s, ...updatedSale } : s))
      if (onSummaryRefresh) onSummaryRefresh()
    } catch (error) {
      console.error('Error updating shipping config:', error)
      addToast('Failed to update shipping config', 'error')
    }
  }

  const handleDeleteSale = (sale) => {
    setDeleteConfirm(sale)
  }

  const confirmDeleteSale = async () => {
    if (!deleteConfirm) return
    const saleId = deleteConfirm.sale_id

    try {
      const response = await axios.delete(`/api/seller/sales/${saleId}`)
      onSalesUpdate(sales.filter(s => s.sale_id !== saleId))

      if (response.data.restored_to_collection) {
        addToast('Sale removed and card restored to collection', 'success')
      } else {
        addToast('Sale deleted', 'success')
      }

      if (onSummaryRefresh) onSummaryRefresh()
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
    if (value > 0) return 'sales-table-profit-positive'
    if (value < 0) return 'sales-table-profit-negative'
    return ''
  }

  // Selection handlers
  const toggleSaleSelection = (saleId) => {
    setSelectedSales(prev => {
      const next = new Set(prev)
      if (next.has(saleId)) {
        next.delete(saleId)
      } else {
        next.add(saleId)
      }
      return next
    })
  }

  const toggleAllSelection = () => {
    if (selectedSales.size === sales.filter(s => !s.order_id).length) {
      setSelectedSales(new Set())
    } else {
      setSelectedSales(new Set(sales.filter(s => !s.order_id).map(s => s.sale_id)))
    }
  }

  const clearSelection = () => {
    setSelectedSales(new Set())
  }

  // Group selected sales into an order
  const handleGroupSelected = async () => {
    if (selectedSales.size < 2) {
      addToast('Select at least 2 cards to group', 'error')
      return
    }

    try {
      const saleIds = Array.from(selectedSales)
      const res = await axios.post('/api/seller/orders', {
        sale_ids: saleIds,
        status: 'pending'
      })

      addToast(`Grouped ${saleIds.length} cards into a shipment`, 'success')
      setSelectedSales(new Set())

      // Auto-expand the new order after data refresh
      const newOrderId = res.data.order?.order_id

      // Refresh the full data to get updated order_id on all sales
      if (onDataRefresh) {
        await onDataRefresh()
        // Auto-expand the new order so user can see the grouped cards
        if (newOrderId) {
          setExpandedOrders(prev => new Set([...prev, newOrderId]))
        }
      } else if (onSummaryRefresh) {
        onSummaryRefresh()
      }
    } catch (error) {
      console.error('Error grouping sales:', error)
      addToast('Failed to group cards', 'error')
    }
  }

  // Update order's shipping config
  const handleOrderShippingConfigChange = async (orderId, newConfigId) => {
    try {
      await axios.put(`/api/seller/orders/${orderId}`, {
        shipping_config_id: newConfigId || null
      })
      addToast('Shipping config updated', 'success')
      if (onDataRefresh) {
        await onDataRefresh()
      }
    } catch (error) {
      console.error('Error updating order shipping config:', error)
      addToast('Failed to update shipping config', 'error')
    }
  }

  // Update order-level field and distribute across all sales in the order
  const handleOrderFieldUpdate = async (orderId, field, totalValue, salesInOrder) => {
    try {
      const numericValue = parseFloat(totalValue) || 0

      // For fees (platform_fees), distribute proportionally based on sale price
      // For other fields (shipping_charged, shipping_cost), distribute equally
      if (field === 'platform_fees') {
        // Calculate total sale price for the order
        const totalSalePrice = salesInOrder.reduce((sum, s) => sum + (parseFloat(s.sale_price) || 0), 0)

        // Distribute fees proportionally, rounding to 2 decimal places
        // Give any remainder to the last card to ensure total matches exactly
        let distributed = 0
        const updates = salesInOrder.map((sale, index) => {
          const salePrice = parseFloat(sale.sale_price) || 0
          const proportion = totalSalePrice > 0 ? salePrice / totalSalePrice : 0
          let cardFees

          if (index === salesInOrder.length - 1) {
            // Last card gets the remainder to avoid rounding errors
            cardFees = Math.round((numericValue - distributed) * 100) / 100
          } else {
            cardFees = Math.round(numericValue * proportion * 100) / 100
            distributed += cardFees
          }

          return axios.put(`/api/seller/sales/${sale.sale_id}`, {
            [field]: cardFees
          })
        })

        await Promise.all(updates)
        addToast(`Fees distributed proportionally across ${salesInOrder.length} cards`, 'success')
      } else {
        // Equal distribution for shipping_charged and shipping_cost
        // Round to 2 decimal places, give remainder to last card
        const baseValue = Math.floor((numericValue / salesInOrder.length) * 100) / 100
        const remainder = Math.round((numericValue - (baseValue * salesInOrder.length)) * 100) / 100

        const updates = salesInOrder.map((sale, index) => {
          const cardValue = index === salesInOrder.length - 1 ? baseValue + remainder : baseValue
          return axios.put(`/api/seller/sales/${sale.sale_id}`, {
            [field]: cardValue
          })
        })

        await Promise.all(updates)
        addToast(`${field.replace(/_/g, ' ')} distributed across ${salesInOrder.length} cards`, 'success')
      }

      if (onDataRefresh) {
        await onDataRefresh()
      }
    } catch (error) {
      console.error(`Error updating order ${field}:`, error)
      addToast(`Failed to update ${field}`, 'error')
    }
  }

  // Ungroup an order (remove all sales from order)
  const handleUngroupOrder = async (orderId) => {
    try {
      await axios.delete(`/api/seller/orders/${orderId}`)
      addToast('Cards ungrouped', 'success')
      setUngroupConfirm(null)

      // Refresh the full data to reflect the ungrouped state
      if (onDataRefresh) {
        await onDataRefresh()
      } else if (onSummaryRefresh) {
        onSummaryRefresh()
      }
    } catch (error) {
      console.error('Error ungrouping order:', error)
      addToast('Failed to ungroup cards', 'error')
    }
  }

  // Toggle order expansion
  const toggleOrderExpanded = (orderId) => {
    setExpandedOrders(prev => {
      const next = new Set(prev)
      if (next.has(orderId)) {
        next.delete(orderId)
      } else {
        next.add(orderId)
      }
      return next
    })
  }

  // Group sales by order_id for display
  const groupedSalesData = useMemo(() => {
    const orders = new Map() // order_id -> { order info, sales: [] }
    const ungrouped = []

    sales.forEach(sale => {
      if (sale.order_id) {
        if (!orders.has(sale.order_id)) {
          orders.set(sale.order_id, {
            order_id: sale.order_id,
            order: sale.order,
            sales: []
          })
        }
        orders.get(sale.order_id).sales.push(sale)
      } else {
        ungrouped.push(sale)
      }
    })

    return { orders: Array.from(orders.values()), ungrouped }
  }, [sales])

  const handleDownloadCSV = () => {
    // Define CSV columns
    const headers = [
      'Card #',
      'Player',
      'Series',
      'Tags',
      'Status',
      'Platform',
      'Date',
      'Cost',
      'Sale Price',
      'Shipping Charged',
      'Platform Fees',
      'Shipping Cost',
      'Supplies',
      'Adjustment',
      'Profit',
      'Profit %',
      'Notes'
    ]

    // Helper to escape CSV values
    const escapeCSV = (value) => {
      if (value === null || value === undefined) return ''
      const str = String(value)
      if (str.includes(',') || str.includes('"') || str.includes('\n')) {
        return `"${str.replace(/"/g, '""')}"`
      }
      return str
    }

    // Build rows from sorted sales
    const rows = sortedSales.map(sale => {
      const tags = []
      if (sale.card_info?.color) tags.push(sale.card_info.color)
      if (sale.card_info?.is_rookie) tags.push('RC')
      if (sale.card_info?.is_autograph) tags.push('Auto')
      if (sale.card_info?.is_relic) tags.push('Relic')
      if (sale.card_info?.is_short_print) tags.push('SP')

      const profitPercent = sale.sale_price > 0
        ? Math.round((sale.net_profit / sale.sale_price) * 100)
        : 0

      return [
        sale.card_info?.card_number || '',
        sale.card_info?.players || '',
        sale.card_info?.series_name || '',
        tags.join(', '),
        sale.status || '',
        sale.platform?.name || '',
        sale.sale_date ? sale.sale_date.split('T')[0] : '',
        sale.purchase_price || '',
        sale.sale_price || '',
        sale.shipping_charged || '',
        sale.platform_fees || '',
        sale.shipping_cost || '',
        sale.supply_cost || '',
        sale.adjustment || '',
        sale.net_profit || '',
        profitPercent ? `${profitPercent}%` : '',
        sale.notes || ''
      ].map(escapeCSV).join(',')
    })

    // Combine headers and rows
    const csv = [headers.join(','), ...rows].join('\n')

    // Create and trigger download
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.setAttribute('href', url)
    link.setAttribute('download', `sales-export-${new Date().toISOString().split('T')[0]}.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)

    addToast(`Exported ${sortedSales.length} sales to CSV`, 'success')
  }

  const handleSort = (key) => {
    setSortConfig(prev => ({
      key,
      direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc'
    }))
  }

  const getSortValue = (sale, key) => {
    switch (key) {
      case 'card_number': return sale.card_info?.card_number || ''
      case 'player': return sale.card_info?.players || ''
      case 'series': return sale.card_info?.series_name || ''
      case 'status': return sale.status || ''
      case 'platform': return sale.platform?.name || ''
      case 'sale_date': return sale.sale_date || ''
      case 'purchase_price': return parseFloat(sale.purchase_price) || 0
      case 'sale_price': return parseFloat(sale.sale_price) || 0
      case 'shipping_charged': return parseFloat(sale.shipping_charged) || 0
      case 'platform_fees': return parseFloat(sale.platform_fees) || 0
      case 'shipping_cost': return parseFloat(sale.shipping_cost) || 0
      case 'supply_cost': return parseFloat(sale.supply_cost) || 0
      case 'adjustment': return parseFloat(sale.adjustment) || 0
      case 'net_profit': return parseFloat(sale.net_profit) || 0
      case 'profit_margin':
        const sp = parseFloat(sale.sale_price) || 0
        const np = parseFloat(sale.net_profit) || 0
        return sp > 0 ? (np / sp) * 100 : 0
      default: return sale[key] || ''
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
      return sortConfig.direction === 'asc' ? aStr.localeCompare(bStr) : bStr.localeCompare(aStr)
    })
    return sorted
  }, [sales, sortConfig])

  const renderSortHeader = (key, label, align = 'left') => {
    const isActive = sortConfig.key === key
    return (
      <th
        className={`sales-table-sortable-th ${isActive ? 'sales-table-sort-active' : ''}`}
        style={{ textAlign: align, cursor: 'pointer' }}
        onClick={() => handleSort(key)}
      >
        <span className="sales-table-th-content">
          {label}
          <span className="sales-table-sort-icon">
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
          className="sales-table-inline-input"
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
        className="sales-table-editable-cell"
        onClick={() => startEditing(sale.sale_id, field, type === 'currency' ? formatCurrency(value) : value)}
        title="Click to edit"
      >
        {displayValue}
      </span>
    )
  }

  const renderMobileCard = (sale) => (
    <div key={sale.sale_id} className="sales-table-mobile-card">
      <div className="sales-table-mobile-card-header">
        <div className="sales-table-mobile-card-info">
          {sale.card_info ? (
            <>
              <div className="sales-table-mobile-card-row">
                <span className="sales-table-card-number">#{sale.card_info.card_number}</span>
                <div className="sales-table-player-info">
                  {sale.card_info.player_data?.[0] && (
                    <div
                      className="sales-table-team-circle"
                      style={{
                        background: sale.card_info.player_data[0].primary_color || '#666',
                        borderColor: sale.card_info.player_data[0].secondary_color || '#999'
                      }}
                      title={sale.card_info.player_data[0].team_name}
                    >
                      {sale.card_info.player_data[0].team_abbreviation || ''}
                    </div>
                  )}
                  <span className="sales-table-card-player">{sale.card_info.players}</span>
                  {sale.card_info.is_rookie && <span className="sales-table-tag sales-table-tag-rc">RC</span>}
                </div>
              </div>
              <div className="sales-table-mobile-card-row">
                <span className="sales-table-series-name" title={sale.card_info.series_name}>{sale.card_info.series_name}</span>
                <div className="sales-table-tags">
                  {sale.card_info.color && (
                    <span
                      className="sales-table-tag"
                      style={{
                        backgroundColor: sale.card_info.color_hex || '#666',
                        color: getContrastColor(sale.card_info.color_hex),
                        borderColor: sale.card_info.color_hex || '#666'
                      }}
                    >
                      {sale.card_info.color}
                    </span>
                  )}
                  {sale.card_info.is_autograph && <span className="sales-table-tag sales-table-tag-auto">Auto</span>}
                  {sale.card_info.is_relic && <span className="sales-table-tag sales-table-tag-relic">Relic</span>}
                  {sale.card_info.is_short_print && <span className="sales-table-tag sales-table-tag-sp">SP</span>}
                </div>
              </div>
            </>
          ) : (
            <span className="sales-table-card-unknown">Card #{sale.card_id}</span>
          )}
        </div>
        {showDeleteButton && (
          <button className="sales-table-delete-btn" onClick={() => handleDeleteSale(sale)} title="Delete sale">
            <Icon name="trash" size={16} />
          </button>
        )}
      </div>

      <div className="sales-table-mobile-card-grid">
        <div className="sales-table-mobile-field">
          <label>Status</label>
          <select
            className="sales-table-inline-select sales-table-status-select"
            value={sale.status}
            onChange={(e) => handleStatusChange(sale.sale_id, e.target.value)}
            data-status={sale.status}
          >
            <option value="listed">Listed</option>
            <option value="sold">Sold</option>
          </select>
        </div>

        <div className="sales-table-mobile-field">
          <label>Platform</label>
          <select
            className="sales-table-inline-select"
            value={sale.platform_id || ''}
            onChange={(e) => handlePlatformChange(sale.sale_id, e.target.value)}
          >
            <option value="">-</option>
            {platforms.map(p => (
              <option key={p.platform_id} value={p.platform_id}>{p.name}</option>
            ))}
          </select>
        </div>

        <div className="sales-table-mobile-field">
          <label>Date</label>
          <input
            type="date"
            className="sales-table-inline-date"
            value={sale.sale_date ? sale.sale_date.split('T')[0] : new Date().toISOString().split('T')[0]}
            onChange={(e) => handleDateChange(sale.sale_id, e.target.value)}
          />
        </div>

        <div className="sales-table-mobile-field">
          <label>Cost</label>
          {renderEditableCell(sale, 'purchase_price', 'currency')}
        </div>

        <div className="sales-table-mobile-field">
          <label>Sale Price</label>
          {renderEditableCell(sale, 'sale_price', 'currency')}
        </div>

        <div className="sales-table-mobile-field">
          <label>Ship Charged</label>
          {renderEditableCell(sale, 'shipping_charged', 'currency')}
        </div>

        <div className="sales-table-mobile-field">
          <label>Fees</label>
          {renderEditableCell(sale, 'platform_fees', 'currency')}
        </div>

        <div className="sales-table-mobile-field">
          <label>Ship Cost</label>
          {renderEditableCell(sale, 'shipping_cost', 'currency')}
        </div>

        {showShippingConfig && (
          <div className="sales-table-mobile-field">
            <label>Ship Config</label>
            <select
              className="sales-table-inline-select"
              value={sale.shipping_config_id || ''}
              onChange={(e) => handleShippingConfigChange(sale.sale_id, e.target.value)}
            >
              <option value="">-</option>
              {shippingConfigs.map(c => (
                <option key={c.shipping_config_id} value={c.shipping_config_id}>{c.name}</option>
              ))}
            </select>
          </div>
        )}

        <div className="sales-table-mobile-field">
          <label>Supplies</label>
          <span className="sales-table-mobile-readonly">{formatCurrencyDisplay(sale.supply_cost)}</span>
        </div>

        {showAdjustment && (
          <div className="sales-table-mobile-field">
            <label>Adjust</label>
            {renderEditableCell(sale, 'adjustment', 'currency')}
          </div>
        )}

        <div className="sales-table-mobile-field sales-table-mobile-field-profit">
          <label>Profit</label>
          <span className={`sales-table-mobile-profit ${getProfitClass(sale.net_profit)}`}>
            {formatCurrencyDisplay(sale.net_profit)}
            {sale.sale_price > 0 && (
              <span className="sales-table-mobile-percent">
                ({Math.round((sale.net_profit / sale.sale_price) * 100)}%)
              </span>
            )}
          </span>
        </div>
      </div>

      <div className="sales-table-mobile-card-footer">
        <div className="sales-table-mobile-field sales-table-mobile-field-full">
          <label>Notes</label>
          {renderEditableCell(sale, 'notes')}
        </div>
      </div>
    </div>
  )

  if (loading) {
    return (
      <div className="sales-table-container">
        <div className="sales-table-loading">
          <Icon name="loader" size={32} className="spinning" />
          <p>Loading sales...</p>
        </div>
      </div>
    )
  }

  if (!sales.length) {
    return (
      <div className="sales-table-container">
        <div className="sales-table-empty">
          <Icon name="package" size={48} />
          <p>{emptyMessage}</p>
        </div>
      </div>
    )
  }

  // Render a single sale row
  const renderSaleRow = (sale, isGrouped = false, isLastInGroup = false) => (
    <tr key={sale.sale_id} className={`${isGrouped ? 'sales-table-grouped-row' : ''} ${isLastInGroup ? 'sales-table-order-group-last' : ''} ${selectedSales.has(sale.sale_id) ? 'sales-table-row-selected' : ''}`}>
      {/* Checkbox for ungrouped sales */}
      <td className="sales-table-td-checkbox">
        {!isGrouped ? (
          <input
            type="checkbox"
            checked={selectedSales.has(sale.sale_id)}
            onChange={() => toggleSaleSelection(sale.sale_id)}
            className="sales-table-checkbox"
          />
        ) : (
          <span className="sales-table-grouped-indent"></span>
        )}
      </td>

      <td>{sale.card_info?.card_number || '-'}</td>

      <td className="sales-table-td-player">
        {sale.card_info ? (
          <div className="sales-table-player-info">
            {sale.card_info.player_data?.[0] && (
              <div
                className="sales-table-team-circle"
                style={{
                  background: sale.card_info.player_data[0].primary_color || '#666',
                  borderColor: sale.card_info.player_data[0].secondary_color || '#999'
                }}
                title={sale.card_info.player_data[0].team_name}
              >
                {sale.card_info.player_data[0].team_abbreviation || ''}
              </div>
            )}
            <span className="sales-table-player-name">{sale.card_info.players}</span>
            {sale.card_info.is_rookie && <span className="sales-table-tag sales-table-tag-rc">RC</span>}
          </div>
        ) : '-'}
      </td>

      <td className="sales-table-td-series">
        <div className="sales-table-series-info">
          <span className="sales-table-series-name" title={sale.card_info?.series_name || ''}>
            {sale.card_info?.series_name || '-'}
          </span>
          {sale.card_info?.print_run && (
            <span className="sales-table-print-info">/{sale.card_info.print_run}</span>
          )}
        </div>
      </td>

      <td className="sales-table-td-tags">
        <div className="sales-table-tags">
          {sale.card_info?.color && (
            <span
              className="sales-table-tag"
              style={{
                backgroundColor: sale.card_info.color_hex || '#666',
                color: getContrastColor(sale.card_info.color_hex),
                borderColor: sale.card_info.color_hex || '#666'
              }}
            >
              {sale.card_info.color}
            </span>
          )}
          {sale.card_info?.is_autograph && <span className="sales-table-tag sales-table-tag-auto">Auto</span>}
          {sale.card_info?.is_relic && <span className="sales-table-tag sales-table-tag-relic">Relic</span>}
          {sale.card_info?.is_short_print && <span className="sales-table-tag sales-table-tag-sp">SP</span>}
        </div>
      </td>

      <td>
        <select
          className="sales-table-inline-select sales-table-status-select"
          value={sale.status}
          onChange={(e) => handleStatusChange(sale.sale_id, e.target.value)}
          data-status={sale.status}
        >
          <option value="listed">Listed</option>
          <option value="sold">Sold</option>
        </select>
      </td>

      <td>
        <select
          className="sales-table-inline-select"
          value={sale.platform_id || ''}
          onChange={(e) => handlePlatformChange(sale.sale_id, e.target.value)}
        >
          <option value="">-</option>
          {platforms.map(p => (
            <option key={p.platform_id} value={p.platform_id}>{p.name}</option>
          ))}
        </select>
      </td>

      <td>
        <input
          type="date"
          className="sales-table-inline-date"
          value={sale.sale_date ? sale.sale_date.split('T')[0] : new Date().toISOString().split('T')[0]}
          onChange={(e) => handleDateChange(sale.sale_id, e.target.value)}
        />
      </td>

      <td className="sales-table-td-currency">{renderEditableCell(sale, 'purchase_price', 'currency')}</td>
      <td className="sales-table-td-currency">{renderEditableCell(sale, 'sale_price', 'currency')}</td>
      {/* Ship $ - read-only for grouped cards (edit at order level, shows distributed value) */}
      <td className="sales-table-td-currency">
        {isGrouped ? (
          <span className="sales-table-grouped-readonly">{formatCurrencyDisplay(sale.shipping_charged)}</span>
        ) : (
          renderEditableCell(sale, 'shipping_charged', 'currency')
        )}
      </td>
      {/* Fees - read-only for grouped cards (edit at order level, shows distributed value) */}
      <td className="sales-table-td-currency">
        {isGrouped ? (
          <span className="sales-table-grouped-readonly">{formatCurrencyDisplay(sale.platform_fees)}</span>
        ) : (
          renderEditableCell(sale, 'platform_fees', 'currency')
        )}
      </td>

      {/* Ship Cost - read-only for grouped cards (edit at order level, shows distributed value) */}
      <td className="sales-table-td-currency">
        {isGrouped ? (
          <span className="sales-table-grouped-readonly">{formatCurrencyDisplay(sale.shipping_cost)}</span>
        ) : (
          renderEditableCell(sale, 'shipping_cost', 'currency')
        )}
      </td>

      {/* Ship Config - hidden for grouped cards (managed at order level) */}
      {showShippingConfig && (
        <td>
          {isGrouped ? (
            <span className="sales-table-grouped-na">-</span>
          ) : (
            <select
              className="sales-table-inline-select"
              value={sale.shipping_config_id || ''}
              onChange={(e) => handleShippingConfigChange(sale.sale_id, e.target.value)}
            >
              <option value="">-</option>
              {shippingConfigs.map(c => (
                <option key={c.shipping_config_id} value={c.shipping_config_id}>{c.name}</option>
              ))}
            </select>
          )}
        </td>
      )}

      {/* Supplies - read-only for grouped cards (shows distributed value from order level) */}
      <td className="sales-table-td-currency sales-table-td-readonly">
        {isGrouped ? (
          <span className="sales-table-grouped-readonly">{formatCurrencyDisplay(sale.supply_cost)}</span>
        ) : (
          formatCurrencyDisplay(sale.supply_cost)
        )}
      </td>

      {showAdjustment && (
        <td className="sales-table-td-currency">{renderEditableCell(sale, 'adjustment', 'currency')}</td>
      )}

      <td className={`sales-table-td-currency sales-table-td-profit ${getProfitClass(sale.net_profit)}`}>
        {formatCurrencyDisplay(sale.net_profit)}
      </td>

      <td className={`sales-table-td-percent ${getProfitClass(sale.net_profit)}`}>
        {sale.sale_price > 0 ? `${Math.round((sale.net_profit / sale.sale_price) * 100)}%` : '-'}
      </td>

      <td className="sales-table-td-notes">{renderEditableCell(sale, 'notes')}</td>

      {showDeleteButton && (
        <td className="sales-table-td-actions">
          <button className="sales-table-delete-btn" onClick={() => handleDeleteSale(sale)} title="Delete sale">
            <Icon name="trash" size={14} />
          </button>
        </td>
      )}
    </tr>
  )

  // Render order header row (collapsible group)
  const renderOrderRow = (orderData) => {
    const { order_id, order, sales: orderSales } = orderData
    const isExpanded = expandedOrders.has(order_id)
    const totalSalePrice = orderSales.reduce((sum, s) => sum + (parseFloat(s.sale_price) || 0), 0)
    const totalShippingCharged = orderSales.reduce((sum, s) => sum + (parseFloat(s.shipping_charged) || 0), 0)
    const totalFees = orderSales.reduce((sum, s) => sum + (parseFloat(s.platform_fees) || 0), 0)
    const totalShippingCost = orderSales.reduce((sum, s) => sum + (parseFloat(s.shipping_cost) || 0), 0)
    const totalProfit = orderSales.reduce((sum, s) => sum + (parseFloat(s.net_profit) || 0), 0)

    // Calculate total supply cost for order:
    // 1. Cost from selected shipping config
    // 2. Plus cost from extra supplies (order_supplies)
    const selectedConfig = shippingConfigs.find(c => c.shipping_config_id === order?.shipping_config_id)
    const configCost = selectedConfig?.calculated_cost || 0
    const extraSuppliesCost = (order?.order_supplies || []).reduce(
      (sum, s) => sum + (parseFloat(s.total_cost) || 0), 0
    )
    const totalSupplyCost = configCost + extraSuppliesCost

    return (
      <React.Fragment key={`order-${order_id}`}>
        <tr className="sales-table-order-row" onClick={() => toggleOrderExpanded(order_id)}>
          {/* Checkbox/Expand */}
          <td className="sales-table-td-checkbox">
            <Icon name={isExpanded ? 'chevron-down' : 'chevron-right'} size={14} />
          </td>
          {/* Card # - show shipment info */}
          <td colSpan={4}>
            <div className="sales-table-order-header">
              <Icon name="package" size={14} />
              <span className="sales-table-order-label">Combined Shipment</span>
              <span className="sales-table-order-count">{orderSales.length} cards</span>
            </div>
          </td>
          {/* Status */}
          <td></td>
          {/* Platform */}
          <td></td>
          {/* Date */}
          <td></td>
          {/* Cost - empty for order row */}
          <td></td>
          {/* Sale $ - total (read-only, sum of individual card prices) */}
          <td className="sales-table-td-currency sales-table-order-total">{formatCurrencyDisplay(totalSalePrice)}</td>
          {/* Ship $ charged - EDITABLE, distributes across cards */}
          <td className="sales-table-td-currency" onClick={(e) => e.stopPropagation()}>
            {editingOrderCell?.orderId === order_id && editingOrderCell?.field === 'shipping_charged' ? (
              <input
                ref={orderInputRef}
                type="text"
                className="sales-table-inline-input"
                value={editOrderValue}
                onChange={(e) => setEditOrderValue(e.target.value)}
                onBlur={saveOrderEditing}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') saveOrderEditing()
                  if (e.key === 'Escape') cancelOrderEditing()
                }}
              />
            ) : (
              <span
                className="sales-table-editable-value"
                onClick={() => startOrderEditing(order_id, 'shipping_charged', totalShippingCharged.toFixed(2), orderSales)}
              >
                {formatCurrencyDisplay(totalShippingCharged)}
              </span>
            )}
          </td>
          {/* Fees - EDITABLE, distributes across cards */}
          <td className="sales-table-td-currency" onClick={(e) => e.stopPropagation()}>
            {editingOrderCell?.orderId === order_id && editingOrderCell?.field === 'platform_fees' ? (
              <input
                ref={orderInputRef}
                type="text"
                className="sales-table-inline-input"
                value={editOrderValue}
                onChange={(e) => setEditOrderValue(e.target.value)}
                onBlur={saveOrderEditing}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') saveOrderEditing()
                  if (e.key === 'Escape') cancelOrderEditing()
                }}
              />
            ) : (
              <span
                className="sales-table-editable-value"
                onClick={() => startOrderEditing(order_id, 'platform_fees', totalFees.toFixed(2), orderSales)}
              >
                {formatCurrencyDisplay(totalFees)}
              </span>
            )}
          </td>
          {/* Ship Cost - EDITABLE, distributes across cards */}
          <td className="sales-table-td-currency" onClick={(e) => e.stopPropagation()}>
            {editingOrderCell?.orderId === order_id && editingOrderCell?.field === 'shipping_cost' ? (
              <input
                ref={orderInputRef}
                type="text"
                className="sales-table-inline-input"
                value={editOrderValue}
                onChange={(e) => setEditOrderValue(e.target.value)}
                onBlur={saveOrderEditing}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') saveOrderEditing()
                  if (e.key === 'Escape') cancelOrderEditing()
                }}
              />
            ) : (
              <span
                className="sales-table-editable-value"
                onClick={() => startOrderEditing(order_id, 'shipping_cost', totalShippingCost.toFixed(2), orderSales)}
              >
                {formatCurrencyDisplay(totalShippingCost)}
              </span>
            )}
          </td>
          {/* Ship Config - ORDER LEVEL (dropdown + button for extra supplies) */}
          {showShippingConfig && (
            <td onClick={(e) => e.stopPropagation()}>
              <div className="sales-table-order-config">
                <select
                  className="sales-table-inline-select"
                  value={order?.shipping_config_id || ''}
                  onChange={(e) => handleOrderShippingConfigChange(order_id, e.target.value)}
                >
                  <option value="">-</option>
                  {shippingConfigs.map(c => (
                    <option key={c.shipping_config_id} value={c.shipping_config_id}>{c.name}</option>
                  ))}
                </select>
                <button
                  className="sales-table-extra-supplies-btn"
                  onClick={() => setOrderSuppliesModal({ order_id, order, orderSales })}
                  title="Add extra supplies to this shipment"
                >
                  <Icon name="plus" size={10} />
                  {order?.order_supplies?.length > 0 && (
                    <span>{order.order_supplies.length}</span>
                  )}
                </button>
              </div>
            </td>
          )}
          {/* Supplies - ORDER LEVEL (show total supply cost) */}
          <td className="sales-table-td-currency">
            {formatCurrencyDisplay(totalSupplyCost)}
          </td>
          {/* Adjust */}
          {showAdjustment && <td></td>}
          {/* Profit - total */}
          <td className={`sales-table-td-currency sales-table-td-profit ${getProfitClass(totalProfit)}`}>
            {formatCurrencyDisplay(totalProfit)}
          </td>
          {/* % */}
          <td className={`sales-table-td-percent ${getProfitClass(totalProfit)}`}>
            {totalSalePrice > 0 ? `${Math.round((totalProfit / totalSalePrice) * 100)}%` : '-'}
          </td>
          {/* Notes */}
          <td></td>
          {/* Actions - Ungroup */}
          {showDeleteButton && (
            <td className="sales-table-td-actions" onClick={(e) => e.stopPropagation()}>
              <button
                className="sales-table-ungroup-btn"
                onClick={() => setUngroupConfirm(orderData)}
                title="Ungroup cards"
              >
                <Icon name="x-circle" size={14} />
              </button>
            </td>
          )}
        </tr>
        {isExpanded && orderSales.map((sale, index) => renderSaleRow(sale, true, index === orderSales.length - 1))}
      </React.Fragment>
    )
  }

  return (
    <div className="sales-table-container">
      {/* Header with selection actions */}
      <div className="sales-table-header">
        <span className="sales-table-count">{sortedSales.length} sale{sortedSales.length !== 1 ? 's' : ''}</span>
        <div className="sales-table-header-actions">
          {selectedSales.size > 0 && (
            <div className="sales-table-selection-bar">
              <span className="sales-table-selection-count">{selectedSales.size} selected</span>
              <button className="sales-table-group-btn" onClick={handleGroupSelected} disabled={selectedSales.size < 2}>
                <Icon name="link" size={14} />
                Group into Shipment
              </button>
              <button className="sales-table-clear-btn" onClick={clearSelection}>
                <Icon name="x" size={14} />
              </button>
            </div>
          )}
          <button className="sales-table-download-btn" onClick={handleDownloadCSV} title="Download as CSV for Excel">
            <Icon name="download" size={16} />
            <span>Export CSV</span>
          </button>
        </div>
      </div>

      {/* Mobile Card View */}
      <div className="sales-table-mobile-view">
        {sortedSales.map(sale => renderMobileCard(sale))}
      </div>

      {/* Desktop Table View */}
      <div className="sales-table-wrapper">
        <table className="sales-table-editable">
          <colgroup>
            <col style={{ width: '36px' }} />
            <col style={{ width: '70px' }} />
            <col style={{ width: '180px' }} />
            <col style={{ width: '160px' }} />
            <col style={{ width: '100px' }} />
            <col style={{ width: '100px' }} />
            <col style={{ width: '100px' }} />
            <col style={{ width: '110px' }} />
            <col style={{ width: '75px' }} />
            <col style={{ width: '75px' }} />
            <col style={{ width: '75px' }} />
            <col style={{ width: '75px' }} />
            <col style={{ width: '75px' }} />
            {showShippingConfig && <col style={{ width: '110px' }} />}
            <col style={{ width: '70px' }} />
            {showAdjustment && <col style={{ width: '70px' }} />}
            <col style={{ width: '80px' }} />
            <col style={{ width: '50px' }} />
            <col style={{ width: '140px' }} />
            {showDeleteButton && <col style={{ width: '40px' }} />}
          </colgroup>
          <thead>
            <tr>
              <th className="sales-table-th-checkbox">
                <input
                  type="checkbox"
                  checked={selectedSales.size > 0 && selectedSales.size === groupedSalesData.ungrouped.length}
                  onChange={toggleAllSelection}
                  className="sales-table-checkbox"
                  title="Select all ungrouped"
                />
              </th>
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
              {showShippingConfig && <th>Ship Config</th>}
              {renderSortHeader('supply_cost', 'Supplies', 'right')}
              {showAdjustment && renderSortHeader('adjustment', 'Adjust', 'right')}
              {renderSortHeader('net_profit', 'Profit', 'right')}
              {renderSortHeader('profit_margin', '%', 'right')}
              <th>Notes</th>
              {showDeleteButton && <th></th>}
            </tr>
          </thead>
          <tbody>
            {/* Render grouped orders first */}
            {groupedSalesData.orders.map(orderData => renderOrderRow(orderData))}
            {/* Render ungrouped sales */}
            {groupedSalesData.ungrouped.map(sale => renderSaleRow(sale, false))}
          </tbody>
        </table>
      </div>

      <ConfirmModal
        isOpen={!!deleteConfirm}
        onClose={() => setDeleteConfirm(null)}
        onConfirm={confirmDeleteSale}
        title="Delete Sale"
        message={
          deleteConfirm?.user_card_id
            ? 'This will remove the sale listing and restore the card to your collection. Continue?'
            : 'This will permanently delete this sale record. Continue?'
        }
        confirmText="Delete"
        confirmVariant="danger"
        icon="trash-2"
      />

      <ConfirmModal
        isOpen={!!ungroupConfirm}
        onClose={() => setUngroupConfirm(null)}
        onConfirm={() => handleUngroupOrder(ungroupConfirm?.order_id)}
        title="Ungroup Shipment"
        message={`Ungroup ${ungroupConfirm?.sales?.length || 0} cards from this shipment? They will become individual sales again.`}
        confirmText="Ungroup"
        confirmVariant="warning"
        icon="minimize-2"
      />

      <OrderSuppliesModal
        isOpen={!!orderSuppliesModal}
        onClose={() => setOrderSuppliesModal(null)}
        orderData={orderSuppliesModal}
        onSuccess={() => {
          if (onDataRefresh) onDataRefresh()
        }}
      />
    </div>
  )
}

export default EditableSalesTable
