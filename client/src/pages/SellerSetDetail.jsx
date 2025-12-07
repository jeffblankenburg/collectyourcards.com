import React, { useState, useEffect } from 'react'
import { Link, useParams, useNavigate } from 'react-router-dom'
import axios from 'axios'
import { useToast } from '../contexts/ToastContext'
import Icon from '../components/Icon'
import ConfirmModal from '../components/modals/ConfirmModal'
import EditableSalesTable from '../components/seller/EditableSalesTable'
import './SellerSetDetailScoped.css'

function SellerSetDetail() {
  const { setId } = useParams()
  const navigate = useNavigate()
  const { addToast } = useToast()

  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [platforms, setPlatforms] = useState([])
  const [shippingConfigs, setShippingConfigs] = useState([])
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
    document.title = 'Set Detail - Collect Your Cards'
    fetchData()
  }, [setId])

  const fetchData = async () => {
    setLoading(true)
    try {
      const [dataRes, platformsRes, shippingRes] = await Promise.all([
        axios.get(`/api/seller/set-investments/${setId}`),
        axios.get('/api/seller/platforms'),
        axios.get('/api/supplies/shipping-configs')
      ])
      setData(dataRes.data)
      setPlatforms(platformsRes.data.platforms || [])
      setShippingConfigs(shippingRes.data.shipping_configs || [])
      setProductTypes(dataRes.data.product_types || {})
      if (dataRes.data.set) {
        document.title = `${dataRes.data.set.year} ${dataRes.data.set.name} - Collect Your Cards`
      }
    } catch (error) {
      console.error('Error fetching set detail:', error)
      if (error.response?.status === 404) {
        addToast('Set not found', 'error')
        navigate('/seller')
      } else {
        addToast('Failed to load set data', 'error')
      }
    } finally {
      setLoading(false)
    }
  }

  const handleSalesUpdate = (updatedSales) => {
    setData(prev => ({ ...prev, sales: updatedSales }))
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

  if (loading) {
    return (
      <div className="seller-set-detail-page">
        <div className="seller-set-detail-loading">
          <Icon name="loader" size={32} className="spinning" />
          <p>Loading...</p>
        </div>
      </div>
    )
  }

  if (!data) {
    return (
      <div className="seller-set-detail-page">
        <div className="seller-set-detail-error">
          <Icon name="alert-circle" size={48} />
          <p>Failed to load data</p>
          <Link to="/seller" className="seller-set-detail-back-btn">
            <Icon name="arrow-left" size={16} /> Back to Sales
          </Link>
        </div>
      </div>
    )
  }

  const { set, purchases, sales, summary } = data

  return (
    <div className="seller-set-detail-page">
      <div className="seller-set-detail-header">
        <div className="seller-set-detail-title">
          <Link to="/seller" className="seller-set-detail-back-link"><Icon name="arrow-left" size={20} /></Link>
          <div className="seller-set-detail-title-text">
            <span className="seller-set-detail-year">{set.year}</span>
            <h1>{set.name}</h1>
            {set.manufacturer && <span className="seller-set-detail-mfg">{set.manufacturer}</span>}
          </div>
        </div>
        <button className="seller-set-detail-add-btn" onClick={() => { resetForm(); setShowAddPurchase(!showAddPurchase) }}>
          <Icon name={showAddPurchase ? 'x' : 'plus'} size={16} />
          {showAddPurchase ? 'Cancel' : 'Add Purchase'}
        </button>
      </div>

      <div className="seller-set-detail-summary-cards">
        <div className="seller-set-detail-summary-card">
          <div className="seller-set-detail-summary-label">Total Spent</div>
          <div className="seller-set-detail-summary-value seller-set-detail-value-spent">{formatCurrency(summary.total_investment)}</div>
        </div>
        <div className="seller-set-detail-summary-card">
          <div className="seller-set-detail-summary-label">Sales Revenue</div>
          <div className="seller-set-detail-summary-value seller-set-detail-value-revenue">{formatCurrency(summary.sales_revenue)}</div>
        </div>
        <div className="seller-set-detail-summary-card">
          <div className="seller-set-detail-summary-label">Net Profit</div>
          <div className="seller-set-detail-summary-value">{formatCurrency(summary.net_profit)}</div>
        </div>
        <div className="seller-set-detail-summary-card">
          <div className="seller-set-detail-summary-label">Cards Sold</div>
          <div className="seller-set-detail-summary-value">{summary.cards_sold}</div>
        </div>
        <div className="seller-set-detail-summary-card">
          <div className="seller-set-detail-summary-label">Listed</div>
          <div className="seller-set-detail-summary-value">{summary.cards_listed}</div>
        </div>
        <div className="seller-set-detail-summary-card">
          <div className="seller-set-detail-summary-label">Recovery</div>
          <div className="seller-set-detail-summary-value">{formatPercentage(summary.recovery_percentage)}</div>
        </div>
      </div>

      {showAddPurchase && (
        <div className="seller-set-detail-form-container">
          <form onSubmit={handleSubmitPurchase} className="seller-set-detail-form">
            <h3>{editingPurchase ? 'Edit Purchase' : 'Add Purchase'}</h3>
            <div className="seller-set-detail-form-grid">
              <div className="seller-set-detail-form-group">
                <label>Product Type *</label>
                <select value={formData.product_type} onChange={(e) => handleFormChange('product_type', e.target.value)} className="seller-set-detail-form-select">
                  {Object.entries(productTypes).map(([key, label]) => (<option key={key} value={key}>{label}</option>))}
                </select>
              </div>
              <div className="seller-set-detail-form-group">
                <label>Purchase Date *</label>
                <input type="date" value={formData.purchase_date} onChange={(e) => handleFormChange('purchase_date', e.target.value)} className="seller-set-detail-form-input" required />
              </div>
              <div className="seller-set-detail-form-group">
                <label>Quantity *</label>
                <input type="number" min="1" value={formData.quantity} onChange={(e) => handleFormChange('quantity', e.target.value)} className="seller-set-detail-form-input" required />
              </div>
              <div className="seller-set-detail-form-group">
                <label>Total Cost *</label>
                <input type="number" step="0.01" min="0.01" placeholder="0.00" value={formData.total_cost} onChange={(e) => handleFormChange('total_cost', e.target.value)} className="seller-set-detail-form-input" required />
              </div>
              <div className="seller-set-detail-form-group">
                <label>Estimated Cards</label>
                <input type="number" min="0" placeholder="Cards expected" value={formData.estimated_cards} onChange={(e) => handleFormChange('estimated_cards', e.target.value)} className="seller-set-detail-form-input" />
              </div>
              <div className="seller-set-detail-form-group">
                <label>Source</label>
                <input type="text" placeholder="e.g., LCS, eBay, Target" value={formData.source} onChange={(e) => handleFormChange('source', e.target.value)} className="seller-set-detail-form-input" />
              </div>
              <div className="seller-set-detail-form-group seller-set-detail-form-wide">
                <label>Notes</label>
                <textarea placeholder="Any additional notes..." value={formData.notes} onChange={(e) => handleFormChange('notes', e.target.value)} className="seller-set-detail-form-textarea" rows={2} />
              </div>
            </div>
            <div className="seller-set-detail-form-actions">
              <button type="button" className="seller-set-detail-form-cancel" onClick={() => { setShowAddPurchase(false); resetForm() }}>Cancel</button>
              <button type="submit" className="seller-set-detail-form-submit" disabled={formLoading}>
                {formLoading ? <><Icon name="loader" size={16} className="spinning" /> Saving...</> : <><Icon name="check" size={16} /> {editingPurchase ? 'Save Changes' : 'Add Purchase'}</>}
              </button>
            </div>
          </form>
        </div>
      )}

      {purchases.length > 0 && (
        <div className="seller-set-detail-section">
          <h2><Icon name="package" size={20} /> Purchases ({purchases.length})</h2>
          <div className="seller-set-detail-purchases-grid">
            {purchases.map(purchase => (
              <div key={purchase.product_purchase_id} className="seller-set-detail-purchase-card">
                <div className="seller-set-detail-purchase-header">
                  <div className="seller-set-detail-purchase-type">{purchase.product_type_display}{purchase.quantity > 1 && <span className="seller-set-detail-purchase-qty">x{purchase.quantity}</span>}</div>
                  <div className="seller-set-detail-purchase-actions">
                    <button className="seller-set-detail-purchase-edit" onClick={() => handleEditPurchase(purchase)} title="Edit"><Icon name="edit" size={14} /></button>
                    <button className="seller-set-detail-purchase-delete" onClick={() => setDeleteConfirm(purchase)} title="Delete"><Icon name="trash" size={14} /></button>
                  </div>
                </div>
                <div className="seller-set-detail-purchase-stats">
                  <div className="seller-set-detail-purchase-stat"><span className="seller-set-detail-purchase-label">Cost</span><span className="seller-set-detail-purchase-value">{formatCurrency(purchase.total_cost)}</span></div>
                  <div className="seller-set-detail-purchase-stat"><span className="seller-set-detail-purchase-label">Per Unit</span><span className="seller-set-detail-purchase-value">{formatCurrency(purchase.cost_per_unit)}</span></div>
                  <div className="seller-set-detail-purchase-stat"><span className="seller-set-detail-purchase-label">Date</span><span className="seller-set-detail-purchase-value">{formatDate(purchase.purchase_date)}</span></div>
                  {purchase.estimated_cards > 0 && <div className="seller-set-detail-purchase-stat"><span className="seller-set-detail-purchase-label">Est. Cards</span><span className="seller-set-detail-purchase-value">{purchase.estimated_cards}</span></div>}
                  {purchase.estimated_cards > 0 && <div className="seller-set-detail-purchase-stat"><span className="seller-set-detail-purchase-label">Cost/Card</span><span className="seller-set-detail-purchase-value">{formatCurrency(purchase.total_cost / purchase.estimated_cards)}</span></div>}
                </div>
                {purchase.source && <div className="seller-set-detail-purchase-source"><Icon name="shopping" size={12} />{purchase.source}</div>}
                {purchase.notes && <div className="seller-set-detail-purchase-notes">{purchase.notes}</div>}
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="seller-set-detail-section">
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
          emptyMessage="No cards from this set have been listed or sold yet."
        />
      </div>

      <ConfirmModal isOpen={!!deleteConfirm} onClose={() => setDeleteConfirm(null)} onConfirm={handleDeletePurchase} title="Delete Purchase" message={`Are you sure you want to delete this ${deleteConfirm?.product_type_display || 'purchase'}? This action cannot be undone.`} confirmText="Delete" confirmVariant="danger" icon="trash-2" />
    </div>
  )
}

export default SellerSetDetail
