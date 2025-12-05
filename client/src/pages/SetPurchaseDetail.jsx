import React, { useState, useEffect, useCallback } from 'react'
import { Link, useParams, useNavigate } from 'react-router-dom'
import axios from 'axios'
import { useToast } from '../contexts/ToastContext'
import Icon from '../components/Icon'
import ConfirmModal from '../components/modals/ConfirmModal'
import './SetPurchaseDetailScoped.css'

function SetPurchaseDetail() {
  const { setId } = useParams()
  const navigate = useNavigate()
  const { addToast } = useToast()

  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [productTypes, setProductTypes] = useState({})
  const [showAddPurchase, setShowAddPurchase] = useState(false)
  const [editingPurchase, setEditingPurchase] = useState(null)
  const [deleteConfirm, setDeleteConfirm] = useState(null)
  const [formLoading, setFormLoading] = useState(false)

  const [formData, setFormData] = useState({
    product_type: 'hobby_box',
    purchase_date: new Date().toISOString().split('T')[0],
    quantity: 1,
    total_cost: '',
    estimated_cards: '',
    source: '',
    notes: ''
  })

  useEffect(() => {
    document.title = 'Set Purchase - Collect Your Cards'
    fetchData()
  }, [setId])

  const fetchData = async () => {
    setLoading(true)
    try {
      const response = await axios.get(`/api/seller/set-investments/${setId}`)
      setData(response.data)
      setProductTypes(response.data.product_types || {})
      if (response.data.set) {
        document.title = `${response.data.set.year} ${response.data.set.name} - Collect Your Cards`
      }
    } catch (error) {
      console.error('Error fetching purchase detail:', error)
      if (error.response?.status === 404) {
        addToast('Set not found', 'error')
        navigate('/seller/purchases')
      } else {
        addToast('Failed to load purchase data', 'error')
      }
    } finally {
      setLoading(false)
    }
  }

  const resetForm = () => {
    setFormData({
      product_type: 'hobby_box',
      purchase_date: new Date().toISOString().split('T')[0],
      quantity: 1,
      total_cost: '',
      estimated_cards: '',
      source: '',
      notes: ''
    })
    setEditingPurchase(null)
  }

  const handleFormChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }))
  }

  const handleEditPurchase = (purchase) => {
    setEditingPurchase(purchase)
    setFormData({
      product_type: purchase.product_type,
      purchase_date: purchase.purchase_date?.split('T')[0] || new Date().toISOString().split('T')[0],
      quantity: purchase.quantity || 1,
      total_cost: purchase.total_cost || '',
      estimated_cards: purchase.estimated_cards || '',
      source: purchase.source || '',
      notes: purchase.notes || ''
    })
    setShowAddPurchase(true)
  }

  const handleSubmitPurchase = async (e) => {
    e.preventDefault()
    if (!formData.total_cost || parseFloat(formData.total_cost) <= 0) {
      addToast('Please enter a valid total cost', 'error')
      return
    }
    setFormLoading(true)
    try {
      if (editingPurchase) {
        await axios.put(`/api/seller/product-purchases/${editingPurchase.product_purchase_id}`, formData)
        addToast('Purchase updated successfully', 'success')
      } else {
        await axios.post('/api/seller/product-purchases', { ...formData, set_id: setId })
        addToast('Purchase added successfully', 'success')
      }
      setShowAddPurchase(false)
      resetForm()
      fetchData()
    } catch (error) {
      addToast(error.response?.data?.error || 'Failed to save purchase', 'error')
    } finally {
      setFormLoading(false)
    }
  }

  const handleDeletePurchase = async () => {
    if (!deleteConfirm) return
    try {
      await axios.delete(`/api/seller/product-purchases/${deleteConfirm.product_purchase_id}`)
      addToast('Purchase deleted successfully', 'success')
      setDeleteConfirm(null)
      fetchData()
    } catch (error) {
      addToast('Failed to delete purchase', 'error')
    }
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

  const formatDate = (dateStr) => {
    if (!dateStr) return '-'
    return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  }


  const getStatusClass = (status) => {
    switch (status) {
      case 'sold': return 'detail-status-sold'
      case 'listed': return 'detail-status-listed'
      default: return ''
    }
  }

  if (loading) {
    return (
      <div className="set-purchase-detail-page">
        <div className="detail-loading">
          <Icon name="loader" size={32} className="spinning" />
          <p>Loading...</p>
        </div>
      </div>
    )
  }

  if (!data) {
    return (
      <div className="set-purchase-detail-page">
        <div className="detail-error">
          <Icon name="alert-circle" size={48} />
          <p>Failed to load data</p>
          <Link to="/seller/purchases" className="detail-back-btn">
            <Icon name="arrow-left" size={16} /> Back to Purchases
          </Link>
        </div>
      </div>
    )
  }

  const { set, purchases, sales, summary } = data

  return (
    <div className="set-purchase-detail-page">
      <div className="detail-header">
        <div className="detail-title">
          <Link to="/seller/purchases" className="detail-back-link"><Icon name="arrow-left" size={20} /></Link>
          <div className="detail-title-text">
            <span className="detail-year">{set.year}</span>
            <h1>{set.name}</h1>
            {set.manufacturer && <span className="detail-mfg">{set.manufacturer}</span>}
          </div>
        </div>
        <button className="detail-add-btn" onClick={() => { resetForm(); setShowAddPurchase(!showAddPurchase) }}>
          <Icon name={showAddPurchase ? 'x' : 'plus'} size={16} />
          {showAddPurchase ? 'Cancel' : 'Add Purchase'}
        </button>
      </div>

      <div className="detail-summary-cards">
        <div className="detail-summary-card">
          <div className="detail-summary-label">Total Spent</div>
          <div className="detail-summary-value detail-value-spent">{formatCurrency(summary.total_investment)}</div>
        </div>
        <div className="detail-summary-card">
          <div className="detail-summary-label">Sales Revenue</div>
          <div className="detail-summary-value detail-value-revenue">{formatCurrency(summary.sales_revenue)}</div>
        </div>
        <div className="detail-summary-card">
          <div className="detail-summary-label">Net Profit</div>
          <div className="detail-summary-value">{formatCurrency(summary.net_profit)}</div>
        </div>
        <div className="detail-summary-card">
          <div className="detail-summary-label">Cards Sold</div>
          <div className="detail-summary-value">{summary.cards_sold}</div>
        </div>
        <div className="detail-summary-card">
          <div className="detail-summary-label">Listed</div>
          <div className="detail-summary-value">{summary.cards_listed}</div>
        </div>
        <div className="detail-summary-card">
          <div className="detail-summary-label">Recovery</div>
          <div className="detail-summary-value">{formatPercentage(summary.recovery_percentage)}</div>
        </div>
      </div>

      {showAddPurchase && (
        <div className="detail-form-container">
          <form onSubmit={handleSubmitPurchase} className="detail-form">
            <h3>{editingPurchase ? 'Edit Purchase' : 'Add Purchase'}</h3>
            <div className="detail-form-grid">
              <div className="detail-form-group">
                <label>Product Type *</label>
                <select value={formData.product_type} onChange={(e) => handleFormChange('product_type', e.target.value)} className="detail-form-select">
                  {Object.entries(productTypes).map(([key, label]) => (<option key={key} value={key}>{label}</option>))}
                </select>
              </div>
              <div className="detail-form-group">
                <label>Purchase Date *</label>
                <input type="date" value={formData.purchase_date} onChange={(e) => handleFormChange('purchase_date', e.target.value)} className="detail-form-input" required />
              </div>
              <div className="detail-form-group">
                <label>Quantity *</label>
                <input type="number" min="1" value={formData.quantity} onChange={(e) => handleFormChange('quantity', e.target.value)} className="detail-form-input" required />
              </div>
              <div className="detail-form-group">
                <label>Total Cost *</label>
                <input type="number" step="0.01" min="0.01" placeholder="0.00" value={formData.total_cost} onChange={(e) => handleFormChange('total_cost', e.target.value)} className="detail-form-input" required />
              </div>
              <div className="detail-form-group">
                <label>Estimated Cards</label>
                <input type="number" min="0" placeholder="Cards expected" value={formData.estimated_cards} onChange={(e) => handleFormChange('estimated_cards', e.target.value)} className="detail-form-input" />
              </div>
              <div className="detail-form-group">
                <label>Source</label>
                <input type="text" placeholder="e.g., LCS, eBay, Target" value={formData.source} onChange={(e) => handleFormChange('source', e.target.value)} className="detail-form-input" />
              </div>
              <div className="detail-form-group detail-form-wide">
                <label>Notes</label>
                <textarea placeholder="Any additional notes..." value={formData.notes} onChange={(e) => handleFormChange('notes', e.target.value)} className="detail-form-textarea" rows={2} />
              </div>
            </div>
            <div className="detail-form-actions">
              <button type="button" className="detail-form-cancel" onClick={() => { setShowAddPurchase(false); resetForm() }}>Cancel</button>
              <button type="submit" className="detail-form-submit" disabled={formLoading}>
                {formLoading ? <><Icon name="loader" size={16} className="spinning" /> Saving...</> : <><Icon name="check" size={16} /> {editingPurchase ? 'Save Changes' : 'Add Purchase'}</>}
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="detail-section">
        <h2><Icon name="package" size={20} /> Purchases ({purchases.length})</h2>
        {purchases.length === 0 ? (
          <div className="detail-empty"><p>No purchases recorded for this set yet.</p></div>
        ) : (
          <div className="detail-purchases-grid">
            {purchases.map(purchase => (
              <div key={purchase.product_purchase_id} className="detail-purchase-card">
                <div className="detail-purchase-header">
                  <div className="detail-purchase-type">{purchase.product_type_display}{purchase.quantity > 1 && <span className="detail-purchase-qty">x{purchase.quantity}</span>}</div>
                  <div className="detail-purchase-actions">
                    <button className="detail-purchase-edit" onClick={() => handleEditPurchase(purchase)} title="Edit"><Icon name="edit" size={14} /></button>
                    <button className="detail-purchase-delete" onClick={() => setDeleteConfirm(purchase)} title="Delete"><Icon name="trash" size={14} /></button>
                  </div>
                </div>
                <div className="detail-purchase-stats">
                  <div className="detail-purchase-stat"><span className="detail-purchase-label">Cost</span><span className="detail-purchase-value">{formatCurrency(purchase.total_cost)}</span></div>
                  <div className="detail-purchase-stat"><span className="detail-purchase-label">Per Unit</span><span className="detail-purchase-value">{formatCurrency(purchase.cost_per_unit)}</span></div>
                  <div className="detail-purchase-stat"><span className="detail-purchase-label">Date</span><span className="detail-purchase-value">{formatDate(purchase.purchase_date)}</span></div>
                  {purchase.estimated_cards > 0 && <div className="detail-purchase-stat"><span className="detail-purchase-label">Est. Cards</span><span className="detail-purchase-value">{purchase.estimated_cards}</span></div>}
                  {purchase.estimated_cards > 0 && <div className="detail-purchase-stat"><span className="detail-purchase-label">Cost/Card</span><span className="detail-purchase-value">{formatCurrency(purchase.total_cost / purchase.estimated_cards)}</span></div>}
                </div>
                {purchase.source && <div className="detail-purchase-source"><Icon name="shopping" size={12} />{purchase.source}</div>}
                {purchase.notes && <div className="detail-purchase-notes">{purchase.notes}</div>}
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="detail-section">
        <h2><Icon name="dollar-sign" size={20} /> Sales ({sales.length})</h2>
        {sales.length === 0 ? (
          <div className="detail-empty"><p>No cards from this set have been listed or sold yet.</p></div>
        ) : (
          <div className="detail-sales-table-container">
            <div className="detail-sales-mobile">
              {sales.map(sale => (
                <div key={sale.sale_id} className="detail-sale-card">
                  <div className="detail-sale-header">
                    <div className="detail-sale-card-info">
                      <span className="detail-sale-number">#{sale.card_info?.card_number}</span>
                      <span className="detail-sale-player">{sale.card_info?.players || 'Unknown'}</span>
                      {sale.card_info?.is_rookie && <span className="detail-tag detail-tag-rc">RC</span>}
                    </div>
                    <span className={`detail-sale-status ${getStatusClass(sale.status)}`}>{sale.status}</span>
                  </div>
                  <div className="detail-sale-stats">
                    <div className="detail-sale-stat"><span className="detail-sale-label">Sale</span><span className="detail-sale-value">{formatCurrency(sale.sale_price)}</span></div>
                    <div className="detail-sale-stat"><span className="detail-sale-label">Profit</span><span className="detail-sale-value">{formatCurrency(sale.net_profit)}</span></div>
                    <div className="detail-sale-stat"><span className="detail-sale-label">Date</span><span className="detail-sale-value">{formatDate(sale.sale_date)}</span></div>
                  </div>
                </div>
              ))}
            </div>
            <div className="detail-sales-table-wrapper">
              <table className="detail-sales-table">
                <thead>
                  <tr>
                    <th>Card #</th>
                    <th>Player</th>
                    <th>Series</th>
                    <th>Tags</th>
                    <th>Status</th>
                    <th>Platform</th>
                    <th>Date</th>
                    <th className="detail-th-right">Cost</th>
                    <th className="detail-th-right">Sale $</th>
                    <th className="detail-th-right">Ship $</th>
                    <th className="detail-th-right">Fees</th>
                    <th className="detail-th-right">Ship Cost</th>
                    <th className="detail-th-right">Supplies</th>
                    <th className="detail-th-right">Profit</th>
                    <th className="detail-th-right">%</th>
                  </tr>
                </thead>
                <tbody>
                  {sales.map(sale => (
                    <tr key={sale.sale_id}>
                      <td>{sale.card_info?.card_number || '-'}</td>
                      <td className="detail-td-player">
                        {sale.card_info ? (
                          <div className="detail-player-info">
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
                            <span className="detail-player-name">{sale.card_info.players}</span>
                            {sale.card_info.is_rookie && <span className="detail-tag detail-tag-rc">RC</span>}
                          </div>
                        ) : '-'}
                      </td>
                      <td className="detail-td-series">
                        <div className="detail-series-info">
                          <span className="detail-series-name" title={sale.card_info?.series_name || ''}>
                            {sale.card_info?.series_name || '-'}
                          </span>
                          {sale.card_info?.print_run && (
                            <span className="detail-print-info">/{sale.card_info.print_run}</span>
                          )}
                        </div>
                      </td>
                      <td className="detail-td-tags">
                        <div className="detail-tags">
                          {sale.card_info?.color && (
                            <span
                              className="detail-tag"
                              style={{
                                backgroundColor: sale.card_info.color_hex || '#666',
                                borderColor: sale.card_info.color_hex || '#666'
                              }}
                            >
                              {sale.card_info.color}
                            </span>
                          )}
                          {sale.card_info?.is_autograph && <span className="detail-tag detail-tag-auto">Auto</span>}
                          {sale.card_info?.is_relic && <span className="detail-tag detail-tag-relic">Relic</span>}
                          {sale.card_info?.is_short_print && <span className="detail-tag detail-tag-sp">SP</span>}
                        </div>
                      </td>
                      <td><span className={`detail-sale-status ${getStatusClass(sale.status)}`}>{sale.status}</span></td>
                      <td>{sale.platform?.name || '-'}</td>
                      <td>{formatDate(sale.sale_date)}</td>
                      <td className="detail-td-right">{formatCurrency(sale.purchase_price)}</td>
                      <td className="detail-td-right">{formatCurrency(sale.sale_price)}</td>
                      <td className="detail-td-right">{formatCurrency(sale.shipping_charged)}</td>
                      <td className="detail-td-right">{formatCurrency(sale.platform_fees)}</td>
                      <td className="detail-td-right">{formatCurrency(sale.shipping_cost)}</td>
                      <td className="detail-td-right">{formatCurrency(sale.supply_cost)}</td>
                      <td className={`detail-td-right detail-td-profit ${sale.net_profit > 0 ? 'detail-profit-positive' : sale.net_profit < 0 ? 'detail-profit-negative' : ''}`}>
                        {formatCurrency(sale.net_profit)}
                      </td>
                      <td className={`detail-td-right detail-td-percent ${sale.net_profit > 0 ? 'detail-profit-positive' : sale.net_profit < 0 ? 'detail-profit-negative' : ''}`}>
                        {sale.sale_price > 0 ? `${Math.round((sale.net_profit / sale.sale_price) * 100)}%` : '-'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      <ConfirmModal isOpen={!!deleteConfirm} onClose={() => setDeleteConfirm(null)} onConfirm={handleDeletePurchase} title="Delete Purchase" message={`Are you sure you want to delete this ${deleteConfirm?.product_type_display || 'purchase'}? This action cannot be undone.`} confirmText="Delete" confirmVariant="danger" icon="trash-2" />
    </div>
  )
}

export default SetPurchaseDetail
