/**
 * Seller Admin - Manage global seller configuration
 * Product Types, Selling Platforms, Sale Statuses
 * These are system-wide settings managed by site admins
 */

import { useState, useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import axios from 'axios'
import Icon from '../components/Icon'
import ConfirmModal from '../components/modals/ConfirmModal'
import { useToast } from '../contexts/ToastContext'
import './SellerAdminScoped.css'

const SellerAdmin = () => {
  const { addToast } = useToast()
  const [activeTab, setActiveTab] = useState('product-types')
  const [loading, setLoading] = useState(true)

  // Data states
  const [productTypes, setProductTypes] = useState([])
  const [platforms, setPlatforms] = useState([])
  const [saleStatuses, setSaleStatuses] = useState([])

  // Form states
  const [showAddForm, setShowAddForm] = useState(false)
  const [editingItem, setEditingItem] = useState(null)
  const [formData, setFormData] = useState({})
  const [saving, setSaving] = useState(false)

  // Delete confirmation
  const [deleteConfirm, setDeleteConfirm] = useState(null)

  // Drag and drop state
  const [draggedItem, setDraggedItem] = useState(null)
  const [dragOverItem, setDragOverItem] = useState(null)
  const dragCounter = useRef(0)

  // Fetch data based on active tab
  useEffect(() => {
    fetchData()
  }, [activeTab])

  const fetchData = async () => {
    setLoading(true)
    try {
      if (activeTab === 'product-types') {
        const response = await axios.get('/api/admin/seller/product-types?include_inactive=true')
        setProductTypes(response.data.product_types || [])
      } else if (activeTab === 'platforms') {
        const response = await axios.get('/api/admin/seller/platforms?include_inactive=true')
        setPlatforms(response.data.platforms || [])
      } else if (activeTab === 'sale-statuses') {
        const response = await axios.get('/api/admin/seller/sale-statuses?include_inactive=true')
        setSaleStatuses(response.data.sale_statuses || [])
      }
    } catch (error) {
      console.error('Error fetching data:', error)
      addToast('Failed to load data', 'error')
    } finally {
      setLoading(false)
    }
  }

  const handleAdd = () => {
    setEditingItem(null)
    setFormData(getDefaultFormData())
    setShowAddForm(true)
  }

  const handleEdit = (item) => {
    setEditingItem(item)
    setFormData({ ...item })
    setShowAddForm(true)
  }

  const handleCancel = () => {
    setShowAddForm(false)
    setEditingItem(null)
    setFormData({})
  }

  const getDefaultFormData = () => {
    if (activeTab === 'product-types') {
      return { name: '', description: '' }
    } else if (activeTab === 'platforms') {
      return { name: '', fee_percentage: '', payment_fee_pct: '', fixed_fee: '' }
    } else {
      return { name: '', description: '', color: '#6b7280' }
    }
  }

  const getApiPath = () => {
    if (activeTab === 'product-types') return '/api/admin/seller/product-types'
    if (activeTab === 'platforms') return '/api/admin/seller/platforms'
    return '/api/admin/seller/sale-statuses'
  }

  const getIdField = () => {
    if (activeTab === 'product-types') return 'product_type_id'
    if (activeTab === 'platforms') return 'platform_id'
    return 'sale_status_id'
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setSaving(true)

    try {
      const apiPath = getApiPath()

      if (editingItem) {
        const idField = getIdField()
        await axios.put(`${apiPath}/${editingItem[idField]}`, formData)
        addToast('Updated successfully', 'success')
      } else {
        await axios.post(apiPath, formData)
        addToast('Created successfully', 'success')
      }

      handleCancel()
      fetchData()
    } catch (error) {
      console.error('Error saving:', error)
      addToast(error.response?.data?.error || 'Failed to save', 'error')
    } finally {
      setSaving(false)
    }
  }

  const handleDeleteClick = (item) => {
    setDeleteConfirm(item)
  }

  const confirmDelete = async () => {
    if (!deleteConfirm) return

    const idField = getIdField()

    try {
      await axios.delete(`${getApiPath()}/${deleteConfirm[idField]}`)
      addToast('Deleted successfully', 'success')
      fetchData()
    } catch (error) {
      console.error('Error deleting:', error)
      addToast(error.response?.data?.error || 'Failed to delete', 'error')
    } finally {
      setDeleteConfirm(null)
    }
  }

  const handleToggleActive = async (item) => {
    const idField = getIdField()

    try {
      await axios.put(`${getApiPath()}/${item[idField]}`, {
        is_active: !item.is_active
      })
      addToast(item.is_active ? 'Deactivated' : 'Activated', 'success')
      fetchData()
    } catch (error) {
      console.error('Error toggling:', error)
      addToast('Failed to update', 'error')
    }
  }

  const handleSeedDefaults = async () => {
    try {
      await axios.post('/api/admin/seller/seed-defaults')
      addToast('Default values created', 'success')
      fetchData()
    } catch (error) {
      console.error('Error seeding:', error)
      addToast(error.response?.data?.error || 'Failed to seed defaults', 'error')
    }
  }

  const getData = () => {
    if (activeTab === 'product-types') return productTypes
    if (activeTab === 'platforms') return platforms
    return saleStatuses
  }

  const setData = (newData) => {
    if (activeTab === 'product-types') setProductTypes(newData)
    else if (activeTab === 'sale-statuses') setSaleStatuses(newData)
  }

  // Check if current tab supports reordering (has display_order)
  const supportsReorder = () => {
    return activeTab === 'product-types' || activeTab === 'sale-statuses'
  }

  // Drag and drop handlers
  const handleDragStart = (e, item, index) => {
    setDraggedItem({ item, index })
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('text/plain', index)
    // Add a slight delay to allow the drag image to be set
    setTimeout(() => {
      e.target.closest('tr')?.classList.add('seller-admin-dragging')
    }, 0)
  }

  const handleDragEnd = (e) => {
    e.target.closest('tr')?.classList.remove('seller-admin-dragging')
    setDraggedItem(null)
    setDragOverItem(null)
    dragCounter.current = 0
  }

  const handleDragEnter = (e, index) => {
    e.preventDefault()
    dragCounter.current++
    if (draggedItem && draggedItem.index !== index) {
      setDragOverItem(index)
    }
  }

  const handleDragLeave = (e) => {
    dragCounter.current--
    if (dragCounter.current === 0) {
      setDragOverItem(null)
    }
  }

  const handleDragOver = (e) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
  }

  const handleDrop = async (e, dropIndex) => {
    e.preventDefault()

    if (!draggedItem || draggedItem.index === dropIndex) {
      setDraggedItem(null)
      setDragOverItem(null)
      return
    }

    const data = getData()
    const idField = getIdField()
    const newData = [...data]

    // Remove dragged item and insert at new position
    const [removed] = newData.splice(draggedItem.index, 1)
    newData.splice(dropIndex, 0, removed)

    // Update local state immediately for responsiveness
    setData(newData)
    setDraggedItem(null)
    setDragOverItem(null)
    dragCounter.current = 0

    // Prepare reorder payload
    const items = newData.map((item, index) => ({
      id: item[idField],
      display_order: index
    }))

    try {
      await axios.put(`${getApiPath()}/reorder`, { items })
      addToast('Order updated', 'success')
    } catch (error) {
      console.error('Error reordering:', error)
      addToast('Failed to save order', 'error')
      // Revert on error
      fetchData()
    }
  }

  const renderForm = () => {
    if (activeTab === 'product-types') {
      return (
        <>
          <div className="seller-admin-form-group">
            <label>Name *</label>
            <input
              type="text"
              className="seller-admin-input"
              value={formData.name || ''}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="e.g., Hobby Box"
              required
            />
          </div>
          <div className="seller-admin-form-group">
            <label>Description</label>
            <input
              type="text"
              className="seller-admin-input"
              value={formData.description || ''}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Optional description"
            />
          </div>
        </>
      )
    }

    if (activeTab === 'platforms') {
      return (
        <>
          <div className="seller-admin-form-group">
            <label>Name *</label>
            <input
              type="text"
              className="seller-admin-input"
              value={formData.name || ''}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="e.g., eBay"
              required
            />
          </div>
          <div className="seller-admin-form-group">
            <label>Platform Fee %</label>
            <input
              type="number"
              step="0.01"
              className="seller-admin-input"
              value={formData.fee_percentage || ''}
              onChange={(e) => setFormData({ ...formData, fee_percentage: e.target.value })}
              placeholder="e.g., 13.25"
            />
          </div>
          <div className="seller-admin-form-group">
            <label>Payment Fee %</label>
            <input
              type="number"
              step="0.01"
              className="seller-admin-input"
              value={formData.payment_fee_pct || ''}
              onChange={(e) => setFormData({ ...formData, payment_fee_pct: e.target.value })}
              placeholder="e.g., 2.9"
            />
          </div>
          <div className="seller-admin-form-group">
            <label>Fixed Fee</label>
            <input
              type="number"
              step="0.01"
              className="seller-admin-input"
              value={formData.fixed_fee || ''}
              onChange={(e) => setFormData({ ...formData, fixed_fee: e.target.value })}
              placeholder="e.g., 0.30"
            />
          </div>
        </>
      )
    }

    // Sale statuses
    return (
      <>
        <div className="seller-admin-form-group">
          <label>Name *</label>
          <input
            type="text"
            className="seller-admin-input"
            value={formData.name || ''}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            placeholder="e.g., Listed"
            required
          />
        </div>
        <div className="seller-admin-form-group">
          <label>Description</label>
          <input
            type="text"
            className="seller-admin-input"
            value={formData.description || ''}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            placeholder="Optional description"
          />
        </div>
        <div className="seller-admin-form-group">
          <label>Color</label>
          <div className="seller-admin-color-picker">
            <input
              type="color"
              value={formData.color || '#6b7280'}
              onChange={(e) => setFormData({ ...formData, color: e.target.value })}
            />
            <input
              type="text"
              className="seller-admin-input"
              value={formData.color || '#6b7280'}
              onChange={(e) => setFormData({ ...formData, color: e.target.value })}
              placeholder="#6b7280"
            />
          </div>
        </div>
      </>
    )
  }

  const renderTable = () => {
    const data = getData()
    const idField = getIdField()
    const canReorder = supportsReorder()

    if (loading) {
      return (
        <div className="seller-admin-loading">
          <Icon name="loader" size={24} className="spinning" />
          <p>Loading...</p>
        </div>
      )
    }

    if (data.length === 0) {
      return (
        <div className="seller-admin-empty">
          <Icon name="inbox" size={48} />
          <h3>No items yet</h3>
          <p>Click "Add New" to create your first item</p>
          <button className="seller-admin-seed-btn" onClick={handleSeedDefaults}>
            <Icon name="sparkles" size={16} />
            Seed Default Values
          </button>
        </div>
      )
    }

    if (activeTab === 'product-types') {
      return (
        <table className="seller-admin-table">
          <thead>
            <tr>
              <th className="seller-admin-drag-col"></th>
              <th>ID</th>
              <th>Name</th>
              <th>Slug</th>
              <th>Description</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {data.map((item, index) => (
              <tr
                key={item[idField]}
                className={`${!item.is_active ? 'seller-admin-inactive' : ''} ${dragOverItem === index ? 'seller-admin-drag-over' : ''}`}
                draggable={canReorder}
                onDragStart={(e) => handleDragStart(e, item, index)}
                onDragEnd={handleDragEnd}
                onDragEnter={(e) => handleDragEnter(e, index)}
                onDragLeave={handleDragLeave}
                onDragOver={handleDragOver}
                onDrop={(e) => handleDrop(e, index)}
              >
                <td className="seller-admin-drag-handle">
                  <Icon name="grip-vertical" size={16} />
                </td>
                <td>{item[idField]}</td>
                <td>{item.name}</td>
                <td className="seller-admin-code">{item.slug}</td>
                <td>{item.description || '-'}</td>
                <td>
                  <span className={`seller-admin-status ${item.is_active ? 'active' : 'inactive'}`}>
                    {item.is_active ? 'Active' : 'Inactive'}
                  </span>
                </td>
                <td>
                  <div className="seller-admin-actions">
                    <button className="seller-admin-action-btn" onClick={() => handleEdit(item)} title="Edit">
                      <Icon name="edit" size={14} />
                    </button>
                    <button className="seller-admin-action-btn" onClick={() => handleToggleActive(item)} title={item.is_active ? 'Deactivate' : 'Activate'}>
                      <Icon name={item.is_active ? 'eye-off' : 'eye'} size={14} />
                    </button>
                    <button className="seller-admin-action-btn seller-admin-delete" onClick={() => handleDeleteClick(item)} title="Delete">
                      <Icon name="trash" size={14} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )
    }

    if (activeTab === 'platforms') {
      return (
        <table className="seller-admin-table">
          <thead>
            <tr>
              <th>ID</th>
              <th>Name</th>
              <th>Platform Fee %</th>
              <th>Payment Fee %</th>
              <th>Fixed Fee</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {data.map(item => (
              <tr key={item[idField]} className={!item.is_active ? 'seller-admin-inactive' : ''}>
                <td>{item[idField]}</td>
                <td>{item.name}</td>
                <td>{item.fee_percentage ? `${item.fee_percentage}%` : '-'}</td>
                <td>{item.payment_fee_pct ? `${item.payment_fee_pct}%` : '-'}</td>
                <td>{item.fixed_fee ? `$${parseFloat(item.fixed_fee).toFixed(2)}` : '-'}</td>
                <td>
                  <span className={`seller-admin-status ${item.is_active ? 'active' : 'inactive'}`}>
                    {item.is_active ? 'Active' : 'Inactive'}
                  </span>
                </td>
                <td>
                  <div className="seller-admin-actions">
                    <button className="seller-admin-action-btn" onClick={() => handleEdit(item)} title="Edit">
                      <Icon name="edit" size={14} />
                    </button>
                    <button className="seller-admin-action-btn" onClick={() => handleToggleActive(item)} title={item.is_active ? 'Deactivate' : 'Activate'}>
                      <Icon name={item.is_active ? 'eye-off' : 'eye'} size={14} />
                    </button>
                    <button className="seller-admin-action-btn seller-admin-delete" onClick={() => handleDeleteClick(item)} title="Delete">
                      <Icon name="trash" size={14} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )
    }

    // Sale statuses
    return (
      <table className="seller-admin-table">
        <thead>
          <tr>
            <th className="seller-admin-drag-col"></th>
            <th>ID</th>
            <th>Name</th>
            <th>Slug</th>
            <th>Description</th>
            <th>Color</th>
            <th>Status</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {data.map((item, index) => (
            <tr
              key={item[idField]}
              className={`${!item.is_active ? 'seller-admin-inactive' : ''} ${dragOverItem === index ? 'seller-admin-drag-over' : ''}`}
              draggable={canReorder}
              onDragStart={(e) => handleDragStart(e, item, index)}
              onDragEnd={handleDragEnd}
              onDragEnter={(e) => handleDragEnter(e, index)}
              onDragLeave={handleDragLeave}
              onDragOver={handleDragOver}
              onDrop={(e) => handleDrop(e, index)}
            >
              <td className="seller-admin-drag-handle">
                <Icon name="grip-vertical" size={16} />
              </td>
              <td>{item[idField]}</td>
              <td>{item.name}</td>
              <td className="seller-admin-code">{item.slug}</td>
              <td>{item.description || '-'}</td>
              <td style={{ textAlign: 'center' }}>
                <span
                  className="seller-admin-color-chip"
                  style={{ backgroundColor: item.color || '#6b7280' }}
                  title={item.color}
                />
              </td>
              <td>
                <span className={`seller-admin-status ${item.is_active ? 'active' : 'inactive'}`}>
                  {item.is_active ? 'Active' : 'Inactive'}
                </span>
              </td>
              <td>
                <div className="seller-admin-actions">
                  <button className="seller-admin-action-btn" onClick={() => handleEdit(item)} title="Edit">
                    <Icon name="edit" size={14} />
                  </button>
                  <button className="seller-admin-action-btn" onClick={() => handleToggleActive(item)} title={item.is_active ? 'Deactivate' : 'Activate'}>
                    <Icon name={item.is_active ? 'eye-off' : 'eye'} size={14} />
                  </button>
                  <button className="seller-admin-action-btn seller-admin-delete" onClick={() => handleDeleteClick(item)} title="Delete">
                    <Icon name="trash" size={14} />
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    )
  }

  const getTabTitle = () => {
    if (activeTab === 'product-types') return 'Product Types'
    if (activeTab === 'platforms') return 'Selling Platforms'
    return 'Sale Statuses'
  }

  return (
    <div className="seller-admin-page">
      {/* Header */}
      <div className="seller-admin-header">
        <div className="seller-admin-title">
          <Link to="/admin" className="seller-admin-back">
            <Icon name="arrow-left" size={18} />
          </Link>
          <Icon name="settings" size={24} />
          <h1>Seller Admin</h1>
        </div>
        <div className="seller-admin-header-actions">
          <Link to="/seller" className="seller-admin-nav-btn">
            <Icon name="dollar-sign" size={16} />
            Seller Dashboard
          </Link>
        </div>
      </div>

      {/* Info Banner */}
      <div className="seller-admin-info">
        <Icon name="info" size={16} />
        <span>These are global settings that apply to all sellers on the platform.</span>
      </div>

      {/* Tabs */}
      <div className="seller-admin-tabs">
        <button
          className={`seller-admin-tab ${activeTab === 'product-types' ? 'active' : ''}`}
          onClick={() => setActiveTab('product-types')}
        >
          <Icon name="package" size={16} />
          Product Types
        </button>
        <button
          className={`seller-admin-tab ${activeTab === 'platforms' ? 'active' : ''}`}
          onClick={() => setActiveTab('platforms')}
        >
          <Icon name="shopping-cart" size={16} />
          Platforms
        </button>
        <button
          className={`seller-admin-tab ${activeTab === 'sale-statuses' ? 'active' : ''}`}
          onClick={() => setActiveTab('sale-statuses')}
        >
          <Icon name="tag" size={16} />
          Sale Statuses
        </button>
      </div>

      {/* Content */}
      <div className="seller-admin-content">
        <div className="seller-admin-toolbar">
          <h2>{getTabTitle()}</h2>
          <button className="seller-admin-add-btn" onClick={handleAdd}>
            <Icon name="plus" size={16} />
            Add New
          </button>
        </div>

        {/* Reorder hint */}
        {supportsReorder() && getData().length > 1 && (
          <div className="seller-admin-reorder-hint">
            <Icon name="grip-vertical" size={14} />
            <span>Drag rows to reorder</span>
          </div>
        )}

        {/* Add/Edit Form */}
        {showAddForm && (
          <div className="seller-admin-form-container">
            <form onSubmit={handleSubmit} className="seller-admin-form">
              <h3>{editingItem ? 'Edit' : 'Add New'} {getTabTitle().slice(0, -1)}</h3>
              {renderForm()}
              <div className="seller-admin-form-actions">
                <button type="button" className="seller-admin-cancel-btn" onClick={handleCancel}>
                  Cancel
                </button>
                <button type="submit" className="seller-admin-submit-btn" disabled={saving}>
                  {saving ? <Icon name="loader" size={16} className="spinning" /> : <Icon name="check" size={16} />}
                  {editingItem ? 'Update' : 'Create'}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Table */}
        <div className="seller-admin-table-container">
          {renderTable()}
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      <ConfirmModal
        isOpen={!!deleteConfirm}
        onClose={() => setDeleteConfirm(null)}
        onConfirm={confirmDelete}
        title={`Delete ${getTabTitle().slice(0, -1)}`}
        message={`Are you sure you want to delete "${deleteConfirm?.name}"? This may deactivate instead if it's currently in use.`}
        confirmText="Delete"
        cancelText="Cancel"
        variant="danger"
      />
    </div>
  )
}

export default SellerAdmin
