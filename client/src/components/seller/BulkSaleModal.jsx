/**
 * BulkSaleModal - Create a bulk sale (complete base set, etc.)
 * Allows selling items without individual card tracking
 */

import React, { useState, useEffect, useRef } from 'react'
import axios from 'axios'
import { useToast } from '../../contexts/ToastContext'
import Icon from '../Icon'
import './BulkSaleModal.css'

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

function BulkSaleModal({
  isOpen,
  onClose,
  onSuccess,
  platforms = [],
  shippingConfigs = []
}) {
  const { addToast } = useToast()
  const [loading, setLoading] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState([])
  const [searching, setSearching] = useState(false)
  const [selectedSeries, setSelectedSeries] = useState(null)
  const searchTimeoutRef = useRef(null)

  // Form fields
  const [formData, setFormData] = useState({
    bulk_description: '',
    platform_id: '',
    status: 'listed',
    sale_date: new Date().toISOString().split('T')[0],
    purchase_price: '',
    sale_price: '',
    shipping_charged: '',
    shipping_cost: '',
    platform_fees: '',
    supply_cost: '',
    shipping_config_id: '',
    notes: ''
  })

  // Reset form when modal opens
  useEffect(() => {
    if (isOpen) {
      setFormData({
        bulk_description: '',
        platform_id: '',
        status: 'listed',
        sale_date: new Date().toISOString().split('T')[0],
        purchase_price: '',
        sale_price: '',
        shipping_charged: '',
        shipping_cost: '',
        platform_fees: '',
        supply_cost: '',
        shipping_config_id: '',
        notes: ''
      })
      setSelectedSeries(null)
      setSearchQuery('')
      setSearchResults([])
    }
  }, [isOpen])

  // Search for series
  useEffect(() => {
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current)
    }

    if (searchQuery.length < 2) {
      setSearchResults([])
      return
    }

    searchTimeoutRef.current = setTimeout(async () => {
      setSearching(true)
      try {
        const res = await axios.get(`/api/search/series?q=${encodeURIComponent(searchQuery)}&limit=10`)
        setSearchResults(res.data.series || [])
      } catch (error) {
        console.error('Error searching series:', error)
      } finally {
        setSearching(false)
      }
    }, 300)

    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current)
      }
    }
  }, [searchQuery])

  const handleSelectSeries = (series) => {
    setSelectedSeries(series)
    setSearchQuery('')
    setSearchResults([])
  }

  const handleChange = (e) => {
    const { name, value } = e.target
    setFormData(prev => ({ ...prev, [name]: value }))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()

    if (!selectedSeries) {
      addToast('Please select a series', 'error')
      return
    }

    if (!formData.bulk_description.trim()) {
      addToast('Please enter a description', 'error')
      return
    }

    setLoading(true)
    try {
      await axios.post('/api/seller/bulk-sales', {
        series_id: selectedSeries.series_id,
        bulk_description: formData.bulk_description.trim(),
        platform_id: formData.platform_id || null,
        status: formData.status,
        sale_date: formData.sale_date || null,
        purchase_price: formData.purchase_price || null,
        sale_price: formData.sale_price || null,
        shipping_charged: formData.shipping_charged || null,
        shipping_cost: formData.shipping_cost || null,
        platform_fees: formData.platform_fees || null,
        supply_cost: formData.supply_cost || null,
        shipping_config_id: formData.shipping_config_id || null,
        notes: formData.notes || null
      })

      addToast('Bulk sale created successfully', 'success')
      if (onSuccess) onSuccess()
      onClose()
    } catch (error) {
      console.error('Error creating bulk sale:', error)
      addToast(error.response?.data?.error || 'Failed to create bulk sale', 'error')
    } finally {
      setLoading(false)
    }
  }

  if (!isOpen) return null

  const handleBackdropClick = (e) => {
    if (e.target === e.currentTarget && !loading) {
      onClose()
    }
  }

  return (
    <div className="bulk-sale-modal-overlay" onClick={handleBackdropClick}>
      <div className="bulk-sale-modal">
        <div className="bulk-sale-modal-header">
          <h2>
            <Icon name="package" size={20} />
            Add Bulk Sale
          </h2>
          <button className="bulk-sale-modal-close" onClick={onClose} disabled={loading}>
            <Icon name="x" size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="bulk-sale-modal-form">
          {/* Series Selection */}
          <div className="bulk-sale-form-section">
            <label className="bulk-sale-form-label">Series *</label>
            {selectedSeries ? (
              <div className="bulk-sale-selected-series">
                <div className="bulk-sale-series-info">
                  <span className="bulk-sale-series-name">{selectedSeries.name}</span>
                  <div className="bulk-sale-series-meta">
                    <span className="bulk-sale-card-count">{selectedSeries.card_count} cards</span>
                    {selectedSeries.print_run && (
                      <span className="bulk-sale-print-run">/{selectedSeries.print_run}</span>
                    )}
                    {selectedSeries.color_name && (
                      <span
                        className="bulk-sale-color-tag"
                        style={{
                          backgroundColor: selectedSeries.color_hex || '#666',
                          color: selectedSeries.color_hex ? getContrastColor(selectedSeries.color_hex) : '#fff'
                        }}
                      >
                        {selectedSeries.color_name}
                      </span>
                    )}
                  </div>
                </div>
                <button
                  type="button"
                  className="bulk-sale-series-clear"
                  onClick={() => setSelectedSeries(null)}
                >
                  <Icon name="x" size={16} />
                </button>
              </div>
            ) : (
              <div className="bulk-sale-series-search">
                <input
                  type="text"
                  placeholder="Search for a series..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="bulk-sale-search-input"
                />
                {searching && <span className="bulk-sale-searching">Searching...</span>}
                {searchResults.length > 0 && (
                  <div className="bulk-sale-search-results">
                    {searchResults.map(series => (
                      <button
                        key={series.series_id}
                        type="button"
                        className="bulk-sale-search-result"
                        onClick={() => handleSelectSeries(series)}
                      >
                        <span className="bulk-sale-result-series">{series.name}</span>
                        <div className="bulk-sale-result-meta">
                          <span className="bulk-sale-result-count">{series.card_count} cards</span>
                          {series.print_run && (
                            <span className="bulk-sale-result-print">/{series.print_run}</span>
                          )}
                          {series.color_name && (
                            <span
                              className="bulk-sale-result-color"
                              style={{
                                backgroundColor: series.color_hex || '#666',
                                color: series.color_hex ? getContrastColor(series.color_hex) : '#fff'
                              }}
                            >
                              {series.color_name}
                            </span>
                          )}
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Description */}
          <div className="bulk-sale-form-section">
            <label className="bulk-sale-form-label">Description *</label>
            <input
              type="text"
              name="bulk_description"
              value={formData.bulk_description}
              onChange={handleChange}
              placeholder="e.g., Complete Base Set, Base Set minus 5 cards"
              className="bulk-sale-input"
              required
            />
          </div>

          {/* Status and Platform */}
          <div className="bulk-sale-form-row">
            <div className="bulk-sale-form-section">
              <label className="bulk-sale-form-label">Status</label>
              <select
                name="status"
                value={formData.status}
                onChange={handleChange}
                className="bulk-sale-select"
              >
                <option value="listed">Listed</option>
                <option value="sold">Sold</option>
                <option value="shipped">Shipped</option>
                <option value="completed">Completed</option>
              </select>
            </div>
            <div className="bulk-sale-form-section">
              <label className="bulk-sale-form-label">Platform</label>
              <select
                name="platform_id"
                value={formData.platform_id}
                onChange={handleChange}
                className="bulk-sale-select"
              >
                <option value="">-- Select Platform --</option>
                {platforms.map(p => (
                  <option key={p.platform_id} value={p.platform_id}>{p.name}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Date and Shipping Config */}
          <div className="bulk-sale-form-row">
            <div className="bulk-sale-form-section">
              <label className="bulk-sale-form-label">Sale Date</label>
              <input
                type="date"
                name="sale_date"
                value={formData.sale_date}
                onChange={handleChange}
                className="bulk-sale-input"
              />
            </div>
            <div className="bulk-sale-form-section">
              <label className="bulk-sale-form-label">Shipping Config</label>
              <select
                name="shipping_config_id"
                value={formData.shipping_config_id}
                onChange={handleChange}
                className="bulk-sale-select"
              >
                <option value="">-- Select Config --</option>
                {shippingConfigs.map(c => (
                  <option key={c.shipping_config_id} value={c.shipping_config_id}>
                    {c.name} (${c.calculated_cost?.toFixed(2) || '0.00'})
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Financial Fields */}
          <div className="bulk-sale-form-section">
            <label className="bulk-sale-form-label">Financials</label>
            <div className="bulk-sale-financials-grid">
              <div className="bulk-sale-financial-field">
                <label>Cost</label>
                <input
                  type="number"
                  step="0.01"
                  name="purchase_price"
                  value={formData.purchase_price}
                  onChange={handleChange}
                  placeholder="0.00"
                  className="bulk-sale-input-small"
                />
              </div>
              <div className="bulk-sale-financial-field">
                <label>Sale $</label>
                <input
                  type="number"
                  step="0.01"
                  name="sale_price"
                  value={formData.sale_price}
                  onChange={handleChange}
                  placeholder="0.00"
                  className="bulk-sale-input-small"
                />
              </div>
              <div className="bulk-sale-financial-field">
                <label>Ship $</label>
                <input
                  type="number"
                  step="0.01"
                  name="shipping_charged"
                  value={formData.shipping_charged}
                  onChange={handleChange}
                  placeholder="0.00"
                  className="bulk-sale-input-small"
                />
              </div>
              <div className="bulk-sale-financial-field">
                <label>Fees</label>
                <input
                  type="number"
                  step="0.01"
                  name="platform_fees"
                  value={formData.platform_fees}
                  onChange={handleChange}
                  placeholder="0.00"
                  className="bulk-sale-input-small"
                />
              </div>
              <div className="bulk-sale-financial-field">
                <label>Ship Cost</label>
                <input
                  type="number"
                  step="0.01"
                  name="shipping_cost"
                  value={formData.shipping_cost}
                  onChange={handleChange}
                  placeholder="0.00"
                  className="bulk-sale-input-small"
                />
              </div>
              <div className="bulk-sale-financial-field">
                <label>Supplies</label>
                <input
                  type="number"
                  step="0.01"
                  name="supply_cost"
                  value={formData.supply_cost}
                  onChange={handleChange}
                  placeholder="0.00"
                  className="bulk-sale-input-small"
                />
              </div>
            </div>
          </div>

          {/* Notes */}
          <div className="bulk-sale-form-section">
            <label className="bulk-sale-form-label">Notes</label>
            <textarea
              name="notes"
              value={formData.notes}
              onChange={handleChange}
              placeholder="Optional notes..."
              className="bulk-sale-textarea"
              rows={2}
            />
          </div>

          {/* Actions */}
          <div className="bulk-sale-modal-actions">
            <button
              type="button"
              className="bulk-sale-cancel-btn"
              onClick={onClose}
              disabled={loading}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="bulk-sale-submit-btn"
              disabled={loading || !selectedSeries}
            >
              {loading ? (
                <>
                  <Icon name="loader" size={16} className="spinning" />
                  Creating...
                </>
              ) : (
                <>
                  <Icon name="plus" size={16} />
                  Create Bulk Sale
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default BulkSaleModal
