import React, { useState, useEffect, useCallback, useRef } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import axios from 'axios'
import { useToast } from '../contexts/ToastContext'
import Icon from '../components/Icon'
import './SetPurchasesScoped.css'

function SetPurchases() {
  const [setPurchases, setSetPurchases] = useState([])
  const [totals, setTotals] = useState(null)
  const [productTypes, setProductTypes] = useState({})
  const [loading, setLoading] = useState(true)
  const [showAddPurchase, setShowAddPurchase] = useState(false)
  const [sets, setSets] = useState([])
  const [setSearch, setSetSearch] = useState('')
  const [searchResults, setSearchResults] = useState([])
  const [searchLoading, setSearchLoading] = useState(false)
  const [selectedSet, setSelectedSet] = useState(null)
  const [highlightedIndex, setHighlightedIndex] = useState(-1)
  const setSearchInputRef = useRef(null)
  const [formData, setFormData] = useState({
    set_id: '',
    product_type: 'hobby_box',
    purchase_date: new Date().toISOString().split('T')[0],
    quantity: 1,
    total_cost: '',
    estimated_cards: '',
    source: '',
    notes: ''
  })
  const [formLoading, setFormLoading] = useState(false)

  const { addToast } = useToast()
  const navigate = useNavigate()

  useEffect(() => {
    document.title = 'Set Purchases - Collect Your Cards'
    fetchSetPurchases()
  }, [])

  // Focus set search input when form opens
  useEffect(() => {
    if (showAddPurchase && setSearchInputRef.current) {
      setSearchInputRef.current.focus()
    }
  }, [showAddPurchase])

  const fetchSetPurchases = async () => {
    setLoading(true)
    try {
      const response = await axios.get('/api/seller/set-investments')
      setSetPurchases(response.data.investments || [])
      setTotals(response.data.totals || null)
      setProductTypes(response.data.product_types || {})
    } catch (error) {
      console.error('Error fetching set purchases:', error)
      addToast('Failed to load purchases', 'error')
    } finally {
      setLoading(false)
    }
  }

  // Debounced set search
  useEffect(() => {
    if (setSearch.length < 2) {
      setSearchResults([])
      return
    }

    const timer = setTimeout(async () => {
      setSearchLoading(true)
      try {
        const response = await axios.get(`/api/admin/sets?search=${encodeURIComponent(setSearch)}&limit=10`)
        setSearchResults(response.data.sets || [])
      } catch (error) {
        console.error('Error searching sets:', error)
      } finally {
        setSearchLoading(false)
      }
    }, 300)

    return () => clearTimeout(timer)
  }, [setSearch])

  const handleSelectSet = (set) => {
    setSelectedSet(set)
    setFormData(prev => ({ ...prev, set_id: set.set_id }))
    setSetSearch(set.name)
    setSearchResults([])
  }

  const handleFormChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }))
  }

  const handleSubmitPurchase = async (e) => {
    e.preventDefault()

    if (!formData.set_id) {
      addToast('Please select a set', 'error')
      return
    }

    if (!formData.total_cost || parseFloat(formData.total_cost) <= 0) {
      addToast('Please enter a valid total cost', 'error')
      return
    }

    setFormLoading(true)
    try {
      await axios.post('/api/seller/product-purchases', formData)
      addToast('Product purchase added successfully', 'success')
      setShowAddPurchase(false)
      resetForm()
      fetchSetPurchases()
    } catch (error) {
      console.error('Error adding purchase:', error)
      addToast(error.response?.data?.error || 'Failed to add purchase', 'error')
    } finally {
      setFormLoading(false)
    }
  }

  const resetForm = () => {
    setFormData({
      set_id: '',
      product_type: 'hobby_box',
      purchase_date: new Date().toISOString().split('T')[0],
      quantity: 1,
      total_cost: '',
      estimated_cards: '',
      source: '',
      notes: ''
    })
    setSelectedSet(null)
    setSetSearch('')
  }

  const formatCurrency = (value) => {
    if (value === null || value === undefined) return '-'
    const num = parseFloat(value)
    if (isNaN(num)) return '-'
    return `$${num.toFixed(2)}`
  }

  const formatPercentage = (value) => {
    if (value === null || value === undefined) return '-'
    const num = parseFloat(value)
    if (isNaN(num)) return '-'
    return `${num.toFixed(1)}%`
  }

  const getHoleClass = (remainingHole) => {
    if (remainingHole > 0) return 'purchase-hole-negative'
    if (remainingHole < 0) return 'purchase-hole-positive'
    return ''
  }

  const formatHole = (remainingHole) => {
    if (remainingHole === null || remainingHole === undefined) return '-'
    const num = parseFloat(remainingHole)
    if (isNaN(num)) return '-'
    if (num > 0) return `-$${num.toFixed(2)}`
    if (num < 0) return `+$${Math.abs(num).toFixed(2)}`
    return '$0.00'
  }

  return (
    <div className="set-purchases-page">
      <div className="set-purchases-header">
        <div className="set-purchases-title">
          <Icon name="package" size={32} />
          <h1>Set Purchases</h1>
        </div>
        <div className="set-purchases-actions">
          <Link to="/seller" className="purchase-nav-btn">
            <Icon name="arrow-left" size={16} />
            Back to Sales
          </Link>
          <button
            className="purchase-add-btn"
            onClick={() => setShowAddPurchase(!showAddPurchase)}
          >
            <Icon name={showAddPurchase ? 'x' : 'plus'} size={16} />
            {showAddPurchase ? 'Cancel' : 'Add Purchase'}
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      {totals && (
        <div className="purchase-summary-cards">
          <div className="purchase-summary-card">
            <div className="purchase-summary-label">Total Spent</div>
            <div className="purchase-summary-value purchase-value-spent">
              {formatCurrency(totals.total_investment)}
            </div>
          </div>
          <div className="purchase-summary-card">
            <div className="purchase-summary-label">Sales Revenue</div>
            <div className="purchase-summary-value purchase-value-revenue">
              {formatCurrency(totals.total_sales_revenue)}
            </div>
          </div>
          <div className="purchase-summary-card">
            <div className="purchase-summary-label">Cards Sold</div>
            <div className="purchase-summary-value">{totals.total_cards_sold}</div>
          </div>
          <div className="purchase-summary-card">
            <div className="purchase-summary-label">Recovery</div>
            <div className="purchase-summary-value">
              {formatPercentage(totals.recovery_percentage)}
            </div>
          </div>
          <div className="purchase-summary-card purchase-summary-hole">
            <div className="purchase-summary-label">Remaining Hole</div>
            <div className={`purchase-summary-value ${getHoleClass(totals.remaining_hole)}`}>
              {formatHole(totals.remaining_hole)}
            </div>
          </div>
        </div>
      )}

      {/* Add Purchase Form */}
      {showAddPurchase && (
        <div className="purchase-add-form-container">
          <form onSubmit={handleSubmitPurchase} className="purchase-add-form">
            <h3>Add Product Purchase</h3>

            <div className="purchase-form-grid">
              {/* Set Search - Searchable Dropdown */}
              <div className="purchase-form-group purchase-form-wide">
                <label>Set *</label>
                <div className="purchase-set-search">
                  <input
                    ref={setSearchInputRef}
                    type="text"
                    placeholder="Search for a set..."
                    value={selectedSet ? selectedSet.name : setSearch}
                    onChange={(e) => {
                      if (selectedSet) setSelectedSet(null)
                      setSetSearch(e.target.value)
                      setHighlightedIndex(-1)
                    }}
                    onFocus={() => {
                      if (selectedSet) {
                        setSetSearch(selectedSet.name)
                        setSelectedSet(null)
                      }
                    }}
                    onKeyDown={(e) => {
                      if (searchResults.length === 0 || selectedSet) return

                      if (e.key === 'ArrowDown') {
                        e.preventDefault()
                        setHighlightedIndex(prev =>
                          prev < searchResults.length - 1 ? prev + 1 : 0
                        )
                      } else if (e.key === 'ArrowUp') {
                        e.preventDefault()
                        setHighlightedIndex(prev =>
                          prev > 0 ? prev - 1 : searchResults.length - 1
                        )
                      } else if (e.key === 'Enter') {
                        e.preventDefault()
                        if (highlightedIndex >= 0 && highlightedIndex < searchResults.length) {
                          handleSelectSet(searchResults[highlightedIndex])
                        }
                      } else if (e.key === 'Escape') {
                        setSearchResults([])
                        setHighlightedIndex(-1)
                      }
                    }}
                    className="purchase-form-input purchase-set-input"
                  />
                  {searchLoading && <Icon name="loader" size={16} className="spinning purchase-search-spinner" />}
                  {!selectedSet && selectedSet === null && setSearch && (
                    <button
                      type="button"
                      className="purchase-set-clear"
                      onClick={() => {
                        setSetSearch('')
                        setSearchResults([])
                        setHighlightedIndex(-1)
                      }}
                    >
                      <Icon name="x" size={14} />
                    </button>
                  )}
                  {selectedSet && (
                    <button
                      type="button"
                      className="purchase-set-clear"
                      onClick={() => {
                        setSelectedSet(null)
                        setSetSearch('')
                        setSearchResults([])
                        setHighlightedIndex(-1)
                      }}
                    >
                      <Icon name="x" size={14} />
                    </button>
                  )}
                  {searchResults.length > 0 && !selectedSet && (
                    <div className="purchase-search-results">
                      {searchResults.map((set, index) => (
                        <div
                          key={set.set_id}
                          className={`purchase-search-result ${index === highlightedIndex ? 'highlighted' : ''}`}
                          onClick={() => handleSelectSet(set)}
                          onMouseEnter={() => setHighlightedIndex(index)}
                        >
                          <span className="purchase-search-name">{set.name}</span>
                          <span className="purchase-search-counts">
                            {set.series_count || 0} series · {set.card_count || 0} cards
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Product Type */}
              <div className="purchase-form-group">
                <label>Product Type *</label>
                <select
                  value={formData.product_type}
                  onChange={(e) => handleFormChange('product_type', e.target.value)}
                  className="purchase-form-select"
                >
                  {Object.entries(productTypes).map(([key, label]) => (
                    <option key={key} value={key}>{label}</option>
                  ))}
                </select>
              </div>

              {/* Purchase Date */}
              <div className="purchase-form-group">
                <label>Purchase Date *</label>
                <input
                  type="date"
                  value={formData.purchase_date}
                  onChange={(e) => handleFormChange('purchase_date', e.target.value)}
                  className="purchase-form-input"
                  required
                />
              </div>

              {/* Quantity */}
              <div className="purchase-form-group">
                <label>Quantity *</label>
                <input
                  type="number"
                  min="1"
                  value={formData.quantity}
                  onChange={(e) => handleFormChange('quantity', e.target.value)}
                  className="purchase-form-input"
                  required
                />
              </div>

              {/* Total Cost */}
              <div className="purchase-form-group">
                <label>Total Cost *</label>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  placeholder="0.00"
                  value={formData.total_cost}
                  onChange={(e) => handleFormChange('total_cost', e.target.value)}
                  className="purchase-form-input"
                  required
                />
              </div>

              {/* Estimated Cards */}
              <div className="purchase-form-group">
                <label>Estimated Cards</label>
                <input
                  type="number"
                  min="0"
                  placeholder="Cards expected"
                  value={formData.estimated_cards}
                  onChange={(e) => handleFormChange('estimated_cards', e.target.value)}
                  className="purchase-form-input"
                />
              </div>

              {/* Source */}
              <div className="purchase-form-group">
                <label>Source</label>
                <input
                  type="text"
                  placeholder="e.g., LCS, eBay, Target"
                  value={formData.source}
                  onChange={(e) => handleFormChange('source', e.target.value)}
                  className="purchase-form-input"
                />
              </div>

              {/* Notes */}
              <div className="purchase-form-group purchase-form-wide">
                <label>Notes</label>
                <textarea
                  placeholder="Any additional notes..."
                  value={formData.notes}
                  onChange={(e) => handleFormChange('notes', e.target.value)}
                  className="purchase-form-textarea"
                  rows={2}
                />
              </div>
            </div>

            <div className="purchase-form-actions">
              <button
                type="button"
                className="purchase-form-cancel"
                onClick={() => {
                  setShowAddPurchase(false)
                  resetForm()
                }}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="purchase-form-submit"
                disabled={formLoading}
              >
                {formLoading ? (
                  <>
                    <Icon name="loader" size={16} className="spinning" />
                    Adding...
                  </>
                ) : (
                  <>
                    <Icon name="plus" size={16} />
                    Add Purchase
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Purchases Table */}
      <div className="purchase-table-container">
        {loading ? (
          <div className="purchase-loading">
            <Icon name="loader" size={32} className="spinning" />
            <p>Loading purchases...</p>
          </div>
        ) : setPurchases.length === 0 ? (
          <div className="purchase-empty">
            <Icon name="package" size={48} />
            <h3>No Purchases Yet</h3>
            <p>Click "Add Purchase" to track your hobby box and case purchases.</p>
          </div>
        ) : (
          <>
            {/* Mobile Card View */}
            <div className="purchase-mobile-view">
              {setPurchases.map(inv => (
                <div
                  key={inv.set_id}
                  className="purchase-mobile-card"
                  onClick={() => navigate(`/seller/purchases/${inv.set_id}`)}
                >
                  <div className="purchase-mobile-header">
                    <div className="purchase-mobile-set">
                      <span className="purchase-mobile-year">{inv.set_year}</span>
                      <span className="purchase-mobile-name">{inv.set_name}</span>
                    </div>
                    <span className={`purchase-mobile-hole ${getHoleClass(inv.remaining_hole)}`}>
                      {formatHole(inv.remaining_hole)}
                    </span>
                  </div>
                  <div className="purchase-mobile-stats">
                    <div className="purchase-mobile-stat">
                      <span className="purchase-mobile-label">Spent</span>
                      <span className="purchase-mobile-value">{formatCurrency(inv.total_investment)}</span>
                    </div>
                    <div className="purchase-mobile-stat">
                      <span className="purchase-mobile-label">Cost/Card</span>
                      <span className="purchase-mobile-value">
                        {inv.estimated_cards > 0 ? formatCurrency(inv.total_investment / inv.estimated_cards) : '-'}
                      </span>
                    </div>
                    <div className="purchase-mobile-stat">
                      <span className="purchase-mobile-label">Revenue</span>
                      <span className="purchase-mobile-value">{formatCurrency(inv.sales_revenue)}</span>
                    </div>
                    <div className="purchase-mobile-stat">
                      <span className="purchase-mobile-label">Sold</span>
                      <span className="purchase-mobile-value">{inv.cards_sold}</span>
                    </div>
                  </div>
                  <div className="purchase-mobile-footer">
                    <span className="purchase-mobile-purchases">{inv.purchase_count} purchase{inv.purchase_count !== 1 ? 's' : ''}</span>
                    <span className="purchase-mobile-products">{inv.total_products} product{inv.total_products !== 1 ? 's' : ''}</span>
                  </div>
                </div>
              ))}
            </div>

            {/* Desktop Table View */}
            <div className="purchase-table-wrapper">
              <table className="purchase-table">
                <thead>
                  <tr>
                    <th>Year</th>
                    <th>Set</th>
                    <th>Mfg</th>
                    <th className="purchase-th-right">Purchases</th>
                    <th className="purchase-th-right">Products</th>
                    <th className="purchase-th-right">Spent</th>
                    <th className="purchase-th-right">Est. Cards</th>
                    <th className="purchase-th-right">Cost/Card</th>
                    <th className="purchase-th-right">Revenue</th>
                    <th className="purchase-th-right">Sold</th>
                    <th className="purchase-th-right">Recovery</th>
                    <th className="purchase-th-right">Remaining Hole</th>
                  </tr>
                </thead>
                <tbody>
                  {setPurchases.map(inv => (
                    <tr
                      key={inv.set_id}
                      className="purchase-row"
                      onClick={() => navigate(`/seller/purchases/${inv.set_id}`)}
                    >
                      <td>{inv.set_year || '-'}</td>
                      <td className="purchase-td-name">{inv.set_name}</td>
                      <td>{inv.set_manufacturer || '-'}</td>
                      <td className="purchase-td-right">{inv.purchase_count}</td>
                      <td className="purchase-td-right">{inv.total_products}</td>
                      <td className="purchase-td-right purchase-td-spent">
                        {formatCurrency(inv.total_investment)}
                      </td>
                      <td className="purchase-td-right">{inv.estimated_cards || '-'}</td>
                      <td className="purchase-td-right">
                        {inv.estimated_cards > 0 ? formatCurrency(inv.total_investment / inv.estimated_cards) : '-'}
                      </td>
                      <td className="purchase-td-right purchase-td-revenue">
                        {formatCurrency(inv.sales_revenue)}
                      </td>
                      <td className="purchase-td-right">{inv.cards_sold}</td>
                      <td className="purchase-td-right">
                        {formatPercentage(inv.recovery_percentage)}
                      </td>
                      <td className={`purchase-td-right purchase-td-hole ${getHoleClass(inv.remaining_hole)}`}>
                        {formatHole(inv.remaining_hole)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

export default SetPurchases
