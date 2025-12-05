import { useState, useEffect, useCallback, useRef } from 'react'
import axios from 'axios'
import { useAuth } from '../contexts/AuthContext'
import { useToast } from '../contexts/ToastContext'
import { Link } from 'react-router-dom'
import { Package, Plus, Trash2, Edit2, Check, X, RefreshCw, AlertCircle, ArrowLeft, Settings, Upload, ExternalLink, Image } from 'lucide-react'
import './SuppliesManagementScoped.css'

function SuppliesManagement() {
  const { user, isAuthenticated } = useAuth()
  const { success: showSuccess, error: showError } = useToast()
  const isAdmin = user?.role === 'admin'

  // State
  const [supplyTypes, setSupplyTypes] = useState([])
  const [batches, setBatches] = useState([])
  const [summary, setSummary] = useState([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('inventory') // 'inventory', 'types', 'batches'

  // Form state for new supply type
  const [newTypeName, setNewTypeName] = useState('')
  const [newTypeDescription, setNewTypeDescription] = useState('')
  const [addingType, setAddingType] = useState(false)

  // Form state for new batch
  const [newBatch, setNewBatch] = useState({
    supply_type_id: '',
    purchase_date: new Date().toISOString().split('T')[0],
    quantity_purchased: '',
    total_cost: '',
    notes: '',
    source_url: ''
  })
  const [addingBatch, setAddingBatch] = useState(false)

  // Editing state
  const [editingType, setEditingType] = useState(null)
  const [editingBatch, setEditingBatch] = useState(null)
  const [editBatchData, setEditBatchData] = useState(null)
  const [uploadingImage, setUploadingImage] = useState(null)
  const [imageModal, setImageModal] = useState(null) // { url, alt }
  const fileInputRef = useRef(null)

  // Handle Escape key for modal
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && imageModal) {
        setImageModal(null)
      }
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [imageModal])

  // Fetch data - only run once on mount and when explicitly called
  const fetchData = useCallback(async () => {
    if (!isAuthenticated || !isAdmin) return

    setLoading(true)
    try {
      const [typesRes, batchesRes, summaryRes] = await Promise.all([
        axios.get('/api/supplies/types'),
        axios.get('/api/supplies/batches?include_depleted=true'),
        axios.get('/api/supplies/batches/summary')
      ])

      setSupplyTypes(typesRes.data.supply_types || [])
      setBatches(batchesRes.data.batches || [])
      setSummary(summaryRes.data.summary || [])
    } catch (error) {
      console.error('Error fetching supplies data:', error)
    } finally {
      setLoading(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated, isAdmin])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  // Supply Type handlers
  const handleAddType = async (e) => {
    e.preventDefault()
    if (!newTypeName.trim()) return

    setAddingType(true)
    try {
      await axios.post('/api/supplies/types', {
        name: newTypeName.trim(),
        description: newTypeDescription.trim() || null
      })
      showSuccess('Supply type created')
      setNewTypeName('')
      setNewTypeDescription('')
      fetchData()
    } catch (error) {
      showError(error.response?.data?.error || 'Failed to create supply type')
    } finally {
      setAddingType(false)
    }
  }

  const handleUpdateType = async (typeId, updates) => {
    try {
      await axios.put(`/api/supplies/types/${typeId}`, updates)
      showSuccess('Supply type updated')
      setEditingType(null)
      fetchData()
    } catch (error) {
      showError(error.response?.data?.error || 'Failed to update supply type')
    }
  }

  const handleDeleteType = async (typeId) => {
    if (!confirm('Are you sure you want to delete this supply type?')) return

    try {
      await axios.delete(`/api/supplies/types/${typeId}`)
      showSuccess('Supply type deleted')
      fetchData()
    } catch (error) {
      showError(error.response?.data?.error || 'Failed to delete supply type')
    }
  }

  // Batch handlers
  const handleAddBatch = async (e) => {
    e.preventDefault()
    if (!newBatch.supply_type_id || !newBatch.quantity_purchased || newBatch.total_cost === '') return

    setAddingBatch(true)
    try {
      await axios.post('/api/supplies/batches', {
        supply_type_id: parseInt(newBatch.supply_type_id),
        purchase_date: newBatch.purchase_date,
        quantity_purchased: parseInt(newBatch.quantity_purchased),
        total_cost: parseFloat(newBatch.total_cost),
        notes: newBatch.notes.trim() || null,
        source_url: newBatch.source_url.trim() || null
      })
      showSuccess('Supply batch added')
      setNewBatch({
        supply_type_id: '',
        purchase_date: new Date().toISOString().split('T')[0],
        quantity_purchased: '',
        total_cost: '',
        notes: '',
        source_url: ''
      })
      fetchData()
    } catch (error) {
      showError(error.response?.data?.error || 'Failed to add batch')
    } finally {
      setAddingBatch(false)
    }
  }

  const startEditingBatch = (batch) => {
    setEditingBatch(batch.supply_batch_id)
    setEditBatchData({
      quantity_remaining: batch.quantity_remaining,
      notes: batch.notes || '',
      source_url: batch.source_url || ''
    })
  }

  const handleUpdateBatch = async (batchId) => {
    try {
      await axios.put(`/api/supplies/batches/${batchId}`, {
        quantity_remaining: parseInt(editBatchData.quantity_remaining),
        notes: editBatchData.notes.trim() || null,
        source_url: editBatchData.source_url.trim() || null
      })
      showSuccess('Batch updated')
      setEditingBatch(null)
      setEditBatchData(null)
      fetchData()
    } catch (error) {
      showError(error.response?.data?.error || 'Failed to update batch')
    }
  }

  const handleImageUpload = async (batchId, file) => {
    if (!file) return

    setUploadingImage(batchId)
    const formData = new FormData()
    formData.append('image', file)

    try {
      await axios.post(`/api/supplies/batches/${batchId}/image`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      })
      showSuccess('Image uploaded')
      fetchData()
    } catch (error) {
      showError(error.response?.data?.error || 'Failed to upload image')
    } finally {
      setUploadingImage(null)
    }
  }

  const handleDeleteImage = async (batchId) => {
    if (!confirm('Delete this image?')) return

    try {
      await axios.delete(`/api/supplies/batches/${batchId}/image`)
      showSuccess('Image deleted')
      fetchData()
    } catch (error) {
      showError(error.response?.data?.error || 'Failed to delete image')
    }
  }

  const handleDepleteBatch = async (batchId) => {
    if (!confirm('Mark this batch as depleted? This cannot be undone.')) return

    try {
      await axios.post(`/api/supplies/batches/${batchId}/deplete`)
      showSuccess('Batch marked as depleted')
      fetchData()
    } catch (error) {
      showError(error.response?.data?.error || 'Failed to deplete batch')
    }
  }

  const handleDeleteBatch = async (batchId) => {
    if (!confirm('Delete this batch? This cannot be undone.')) return

    try {
      await axios.delete(`/api/supplies/batches/${batchId}`)
      showSuccess('Batch deleted')
      fetchData()
    } catch (error) {
      showError(error.response?.data?.error || 'Failed to delete batch')
    }
  }

  // Format currency
  const formatCurrency = (value) => {
    if (value === null || value === undefined) return '-'
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 6
    }).format(value)
  }

  // Format date
  const formatDate = (dateStr) => {
    if (!dateStr) return '-'
    return new Date(dateStr).toLocaleDateString()
  }

  // Get image for a supply type from its batches (most recent batch with an image)
  const getSupplyTypeImage = (supplyTypeId) => {
    const typeBatches = batches
      .filter(b => b.supply_type_id === supplyTypeId && b.image_url)
      .sort((a, b) => new Date(b.purchase_date) - new Date(a.purchase_date))
    return typeBatches.length > 0 ? typeBatches[0].image_url : null
  }

  if (!isAdmin) {
    return (
      <div className="supplies-management-page">
        <div className="supplies-unauthorized">
          <AlertCircle size={48} />
          <h2>Access Denied</h2>
          <p>You need admin access to manage supplies.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="supplies-management-page">
      <div className="supplies-header">
        <div className="supplies-title">
          <Package size={24} />
          <h1>Supply Management</h1>
        </div>
        <div className="supplies-header-actions">
          <Link to="/seller" className="supplies-nav-btn">
            <ArrowLeft size={16} />
            Dashboard
          </Link>
          <Link to="/seller/shipping" className="supplies-nav-btn">
            <Settings size={16} />
            Shipping Configs
          </Link>
          <button className="supplies-refresh-btn" onClick={fetchData} disabled={loading}>
            <RefreshCw size={16} className={loading ? 'spinning' : ''} />
            Refresh
          </button>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="supplies-tabs">
        <button
          className={`supplies-tab ${activeTab === 'inventory' ? 'active' : ''}`}
          onClick={() => setActiveTab('inventory')}
        >
          Inventory Summary
        </button>
        <button
          className={`supplies-tab ${activeTab === 'types' ? 'active' : ''}`}
          onClick={() => setActiveTab('types')}
        >
          Supply Types
        </button>
        <button
          className={`supplies-tab ${activeTab === 'batches' ? 'active' : ''}`}
          onClick={() => setActiveTab('batches')}
        >
          Purchase Batches
        </button>
      </div>

      {loading ? (
        <div className="supplies-loading">
          <RefreshCw size={24} className="spinning" />
          <p>Loading supplies...</p>
        </div>
      ) : (
        <>
          {/* Inventory Summary Tab */}
          {activeTab === 'inventory' && (
            <div className="supplies-section">
              <h2>Current Inventory</h2>
              {summary.length === 0 ? (
                <div className="supplies-empty">
                  <p>No supply types configured yet.</p>
                  <button onClick={() => setActiveTab('types')}>
                    <Plus size={16} /> Add Supply Types
                  </button>
                </div>
              ) : (
                <div className="supplies-summary-grid">
                  {summary.map(item => {
                    const imageUrl = getSupplyTypeImage(item.supply_type_id)
                    return (
                      <div key={item.supply_type_id} className="supplies-summary-card">
                        {imageUrl && (
                          <div className="supplies-summary-image">
                            <img
                              src={imageUrl}
                              alt={item.name}
                              onClick={() => setImageModal({ url: imageUrl, alt: item.name })}
                            />
                          </div>
                        )}
                        <div className="supplies-summary-content">
                          <h3>{item.name}</h3>
                          <div className="supplies-summary-stats">
                            <div className="supplies-stat">
                              <span className="supplies-stat-label">Remaining</span>
                              <span className="supplies-stat-value">{item.total_remaining || 0}</span>
                            </div>
                            <div className="supplies-stat">
                              <span className="supplies-stat-label">Batches</span>
                              <span className="supplies-stat-value">{item.batch_count || 0}</span>
                            </div>
                            <div className="supplies-stat">
                              <span className="supplies-stat-label">Avg Cost</span>
                              <span className="supplies-stat-value">{formatCurrency(item.avg_cost)}</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )}

          {/* Supply Types Tab */}
          {activeTab === 'types' && (
            <div className="supplies-section">
              <h2>Supply Types</h2>

              {/* Add new type form */}
              <form className="supplies-add-form" onSubmit={handleAddType}>
                <input
                  type="text"
                  placeholder="Supply name (e.g., Penny Sleeve)"
                  value={newTypeName}
                  onChange={(e) => setNewTypeName(e.target.value)}
                  className="supplies-input"
                />
                <input
                  type="text"
                  placeholder="Description (optional)"
                  value={newTypeDescription}
                  onChange={(e) => setNewTypeDescription(e.target.value)}
                  className="supplies-input supplies-input-wide"
                />
                <button type="submit" disabled={addingType || !newTypeName.trim()} className="supplies-add-btn">
                  <Plus size={16} /> Add Type
                </button>
              </form>

              {/* Types list */}
              {supplyTypes.length === 0 ? (
                <div className="supplies-empty">
                  <p>No supply types yet. Add some above.</p>
                </div>
              ) : (
                <div className="supplies-list">
                  {supplyTypes.map(type => (
                    <div key={type.supply_type_id} className="supplies-list-item">
                      {editingType === type.supply_type_id ? (
                        <div className="supplies-edit-row">
                          <input
                            type="text"
                            defaultValue={type.name}
                            id={`edit-name-${type.supply_type_id}`}
                            className="supplies-input"
                          />
                          <input
                            type="text"
                            defaultValue={type.description || ''}
                            id={`edit-desc-${type.supply_type_id}`}
                            className="supplies-input supplies-input-wide"
                          />
                          <button
                            className="supplies-icon-btn supplies-icon-success"
                            onClick={() => handleUpdateType(type.supply_type_id, {
                              name: document.getElementById(`edit-name-${type.supply_type_id}`).value,
                              description: document.getElementById(`edit-desc-${type.supply_type_id}`).value
                            })}
                          >
                            <Check size={16} />
                          </button>
                          <button
                            className="supplies-icon-btn"
                            onClick={() => setEditingType(null)}
                          >
                            <X size={16} />
                          </button>
                        </div>
                      ) : (
                        <>
                          <div className="supplies-item-info">
                            <span className="supplies-item-name">{type.name}</span>
                            {type.description && (
                              <span className="supplies-item-desc">{type.description}</span>
                            )}
                          </div>
                          <div className="supplies-item-actions">
                            <button
                              className="supplies-icon-btn"
                              onClick={() => setEditingType(type.supply_type_id)}
                            >
                              <Edit2 size={16} />
                            </button>
                            <button
                              className="supplies-icon-btn supplies-icon-danger"
                              onClick={() => handleDeleteType(type.supply_type_id)}
                            >
                              <Trash2 size={16} />
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Purchase Batches Tab */}
          {activeTab === 'batches' && (
            <div className="supplies-section">
              <h2>Purchase Batches</h2>

              {/* Add new batch form */}
              <form className="supplies-add-form supplies-batch-form" onSubmit={handleAddBatch}>
                <div className="supplies-form-row">
                  <select
                    value={newBatch.supply_type_id}
                    onChange={(e) => setNewBatch({ ...newBatch, supply_type_id: e.target.value })}
                    className="supplies-select"
                    required
                  >
                    <option value="">Select supply type...</option>
                    {supplyTypes.map(type => (
                      <option key={type.supply_type_id} value={type.supply_type_id}>
                        {type.name}
                      </option>
                    ))}
                  </select>
                  <input
                    type="date"
                    value={newBatch.purchase_date}
                    onChange={(e) => setNewBatch({ ...newBatch, purchase_date: e.target.value })}
                    className="supplies-input"
                    required
                  />
                  <input
                    type="number"
                    placeholder="Quantity"
                    value={newBatch.quantity_purchased}
                    onChange={(e) => setNewBatch({ ...newBatch, quantity_purchased: e.target.value })}
                    className="supplies-input supplies-input-small"
                    min="1"
                    required
                  />
                  <input
                    type="number"
                    placeholder="Total Cost"
                    value={newBatch.total_cost}
                    onChange={(e) => setNewBatch({ ...newBatch, total_cost: e.target.value })}
                    className="supplies-input supplies-input-small"
                    step="0.01"
                    min="0"
                    required
                  />
                </div>
                <div className="supplies-form-row">
                  <input
                    type="text"
                    placeholder="Notes (optional)"
                    value={newBatch.notes}
                    onChange={(e) => setNewBatch({ ...newBatch, notes: e.target.value })}
                    className="supplies-input"
                  />
                  <input
                    type="url"
                    placeholder="Purchase URL (optional, e.g., Amazon link)"
                    value={newBatch.source_url}
                    onChange={(e) => setNewBatch({ ...newBatch, source_url: e.target.value })}
                    className="supplies-input supplies-input-wide"
                  />
                  <button type="submit" disabled={addingBatch} className="supplies-add-btn">
                    <Plus size={16} /> Add Batch
                  </button>
                </div>
              </form>

              {/* Cost per unit preview */}
              {newBatch.quantity_purchased && newBatch.total_cost && (
                <div className="supplies-cost-preview">
                  Cost per unit: {formatCurrency(parseFloat(newBatch.total_cost) / parseInt(newBatch.quantity_purchased))}
                </div>
              )}

              {/* Batches list */}
              {batches.length === 0 ? (
                <div className="supplies-empty">
                  <p>No purchase batches yet. Add one above.</p>
                </div>
              ) : (
                <div className="supplies-batches-table-wrapper">
                  <table className="supplies-batches-table">
                    <thead>
                      <tr>
                        <th>Image</th>
                        <th>Type</th>
                        <th>Date</th>
                        <th>Qty</th>
                        <th>Remaining</th>
                        <th>Total Cost</th>
                        <th>Cost/Unit</th>
                        <th>Notes</th>
                        <th>Link</th>
                        <th>Status</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {batches.map(batch => (
                        <tr key={batch.supply_batch_id} className={batch.is_depleted ? 'depleted' : ''}>
                          <td className="supplies-image-cell">
                            {batch.image_url ? (
                              <div className="supplies-image-wrapper">
                                <img
                                  src={batch.image_url}
                                  alt={batch.supply_type?.name || 'Supply'}
                                  className="supplies-batch-image"
                                  onClick={() => setImageModal({ url: batch.image_url, alt: batch.supply_type?.name || 'Supply' })}
                                />
                                <button
                                  className="supplies-image-delete"
                                  onClick={() => handleDeleteImage(batch.supply_batch_id)}
                                  title="Remove image"
                                >
                                  <X size={12} />
                                </button>
                              </div>
                            ) : (
                              <label className="supplies-image-upload">
                                <input
                                  type="file"
                                  accept="image/*"
                                  onChange={(e) => handleImageUpload(batch.supply_batch_id, e.target.files[0])}
                                  style={{ display: 'none' }}
                                />
                                {uploadingImage === batch.supply_batch_id ? (
                                  <RefreshCw size={16} className="spinning" />
                                ) : (
                                  <Upload size={16} />
                                )}
                              </label>
                            )}
                          </td>
                          <td>{batch.supply_type?.name || 'Unknown'}</td>
                          <td>{formatDate(batch.purchase_date)}</td>
                          <td>{batch.quantity_purchased}</td>
                          <td>
                            {editingBatch === batch.supply_batch_id ? (
                              <input
                                type="number"
                                value={editBatchData.quantity_remaining}
                                onChange={(e) => setEditBatchData({ ...editBatchData, quantity_remaining: e.target.value })}
                                className="supplies-inline-input"
                                min="0"
                                max={batch.quantity_purchased}
                              />
                            ) : (
                              batch.quantity_remaining
                            )}
                          </td>
                          <td>{formatCurrency(batch.total_cost)}</td>
                          <td>{formatCurrency(batch.cost_per_unit)}</td>
                          <td className="supplies-notes-cell">
                            {editingBatch === batch.supply_batch_id ? (
                              <input
                                type="text"
                                value={editBatchData.notes}
                                onChange={(e) => setEditBatchData({ ...editBatchData, notes: e.target.value })}
                                className="supplies-inline-input supplies-inline-wide"
                                placeholder="Notes"
                              />
                            ) : (
                              batch.notes || '-'
                            )}
                          </td>
                          <td className="supplies-link-cell">
                            {editingBatch === batch.supply_batch_id ? (
                              <input
                                type="url"
                                value={editBatchData.source_url}
                                onChange={(e) => setEditBatchData({ ...editBatchData, source_url: e.target.value })}
                                className="supplies-inline-input supplies-inline-wide"
                                placeholder="URL"
                              />
                            ) : (
                              batch.source_url ? (
                                <a
                                  href={batch.source_url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="supplies-source-link"
                                  title={batch.source_url}
                                >
                                  <ExternalLink size={14} />
                                </a>
                              ) : '-'
                            )}
                          </td>
                          <td>
                            <span className={`supplies-status ${batch.is_depleted ? 'depleted' : 'active'}`}>
                              {batch.is_depleted ? 'Depleted' : 'Active'}
                            </span>
                          </td>
                          <td>
                            {editingBatch === batch.supply_batch_id ? (
                              <div className="supplies-action-btns">
                                <button
                                  className="supplies-icon-btn supplies-icon-success"
                                  onClick={() => handleUpdateBatch(batch.supply_batch_id)}
                                >
                                  <Check size={14} />
                                </button>
                                <button
                                  className="supplies-icon-btn"
                                  onClick={() => { setEditingBatch(null); setEditBatchData(null); }}
                                >
                                  <X size={14} />
                                </button>
                              </div>
                            ) : (
                              <div className="supplies-action-btns">
                                {!batch.is_depleted && (
                                  <>
                                    <button
                                      className="supplies-icon-btn"
                                      onClick={() => startEditingBatch(batch)}
                                      title="Edit batch"
                                    >
                                      <Edit2 size={14} />
                                    </button>
                                    <button
                                      className="supplies-icon-btn supplies-icon-warning"
                                      onClick={() => handleDepleteBatch(batch.supply_batch_id)}
                                      title="Mark depleted"
                                    >
                                      <AlertCircle size={14} />
                                    </button>
                                  </>
                                )}
                                <button
                                  className="supplies-icon-btn supplies-icon-danger"
                                  onClick={() => handleDeleteBatch(batch.supply_batch_id)}
                                  title="Delete"
                                >
                                  <Trash2 size={14} />
                                </button>
                              </div>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </>
      )}

      {/* Image Modal */}
      {imageModal && (
        <div
          className="supplies-image-modal-overlay"
          onClick={() => setImageModal(null)}
        >
          <div
            className="supplies-image-modal"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              className="supplies-image-modal-close"
              onClick={() => setImageModal(null)}
              title="Close (Esc)"
            >
              <X size={24} />
            </button>
            <img src={imageModal.url} alt={imageModal.alt} />
          </div>
        </div>
      )}
    </div>
  )
}

export default SuppliesManagement
