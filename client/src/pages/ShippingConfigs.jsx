import { useState, useEffect, useCallback } from 'react'
import axios from 'axios'
import { useAuth } from '../contexts/AuthContext'
import { useToast } from '../contexts/ToastContext'
import { Link } from 'react-router-dom'
import { Settings, Plus, Trash2, Edit2, Check, X, RefreshCw, AlertCircle, ChevronDown, ChevronUp, ArrowLeft, Package, DollarSign } from 'lucide-react'
import './ShippingConfigsScoped.css'

function ShippingConfigs() {
  const { user, isAuthenticated } = useAuth()
  const { success: showSuccess, error: showError } = useToast()
  const isAdmin = user?.role === 'admin'

  // State
  const [configs, setConfigs] = useState([])
  const [supplyTypes, setSupplyTypes] = useState([])
  const [configCosts, setConfigCosts] = useState({}) // { configId: { total_cost, items, error } }
  const [loading, setLoading] = useState(true)

  // Form state for new config
  const [showAddForm, setShowAddForm] = useState(false)
  const [newConfig, setNewConfig] = useState({
    name: '',
    description: '',
    items: []
  })
  const [adding, setAdding] = useState(false)

  // Editing state
  const [editingConfig, setEditingConfig] = useState(null)
  const [expandedConfig, setExpandedConfig] = useState(null)

  // Fetch cost for a single config
  const fetchConfigCost = async (configId) => {
    try {
      const res = await axios.post('/api/supplies/calculate-cost', {
        shipping_config_id: configId
      })
      return {
        total_cost: res.data.total_cost,
        items: res.data.items || [],
        error: res.data.error || null,
        partial: res.data.partial || false
      }
    } catch (error) {
      return {
        total_cost: null,
        items: [],
        error: error.response?.data?.error || 'Unable to calculate cost',
        partial: false
      }
    }
  }

  // Fetch costs for all configs
  const fetchAllCosts = async (configsList) => {
    const costs = {}
    await Promise.all(
      configsList.map(async (config) => {
        costs[config.shipping_config_id] = await fetchConfigCost(config.shipping_config_id)
      })
    )
    setConfigCosts(costs)
  }

  // Fetch data
  const fetchData = useCallback(async () => {
    if (!isAuthenticated || !isAdmin) return

    setLoading(true)
    try {
      const [configsRes, typesRes] = await Promise.all([
        axios.get('/api/supplies/shipping-configs'),
        axios.get('/api/supplies/types')
      ])

      const configsList = configsRes.data.shipping_configs || []
      setConfigs(configsList)
      setSupplyTypes(typesRes.data.supply_types || [])

      // Fetch costs for all configs
      await fetchAllCosts(configsList)
    } catch (error) {
      console.error('Error fetching data:', error)
    } finally {
      setLoading(false)
    }
  }, [isAuthenticated, isAdmin])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  // Add item to new config
  const handleAddItem = () => {
    if (supplyTypes.length === 0) return
    setNewConfig({
      ...newConfig,
      items: [
        ...newConfig.items,
        { supply_type_id: supplyTypes[0].supply_type_id, quantity: 1 }
      ]
    })
  }

  // Remove item from new config
  const handleRemoveItem = (index) => {
    setNewConfig({
      ...newConfig,
      items: newConfig.items.filter((_, i) => i !== index)
    })
  }

  // Update item in new config
  const handleUpdateItem = (index, field, value) => {
    const updatedItems = [...newConfig.items]
    updatedItems[index] = { ...updatedItems[index], [field]: value }
    setNewConfig({ ...newConfig, items: updatedItems })
  }

  // Create new config
  const handleCreate = async (e) => {
    e.preventDefault()
    if (!newConfig.name.trim()) return

    setAdding(true)
    try {
      await axios.post('/api/supplies/shipping-configs', {
        name: newConfig.name.trim(),
        description: newConfig.description.trim() || null,
        items: newConfig.items.map(item => ({
          supply_type_id: parseInt(item.supply_type_id),
          quantity: parseInt(item.quantity)
        }))
      })
      showSuccess('Shipping config created')
      setNewConfig({ name: '', description: '', items: [] })
      setShowAddForm(false)
      fetchData()
    } catch (error) {
      showError(error.response?.data?.error || 'Failed to create config')
    } finally {
      setAdding(false)
    }
  }

  // Start editing
  const handleStartEdit = (config) => {
    setEditingConfig({
      shipping_config_id: config.shipping_config_id,
      name: config.name,
      description: config.description || '',
      items: config.shipping_config_items.map(item => ({
        supply_type_id: item.supply_type_id,
        quantity: item.quantity
      }))
    })
    setExpandedConfig(config.shipping_config_id)
  }

  // Update config
  const handleUpdate = async () => {
    if (!editingConfig.name.trim()) return

    try {
      await axios.put(`/api/supplies/shipping-configs/${editingConfig.shipping_config_id}`, {
        name: editingConfig.name.trim(),
        description: editingConfig.description.trim() || null,
        items: editingConfig.items.map(item => ({
          supply_type_id: parseInt(item.supply_type_id),
          quantity: parseInt(item.quantity)
        }))
      })
      showSuccess('Shipping config updated')
      setEditingConfig(null)
      fetchData()
    } catch (error) {
      showError(error.response?.data?.error || 'Failed to update config')
    }
  }

  // Delete config
  const handleDelete = async (configId) => {
    if (!confirm('Delete this shipping configuration?')) return

    try {
      await axios.delete(`/api/supplies/shipping-configs/${configId}`)
      showSuccess('Shipping config deleted')
      fetchData()
    } catch (error) {
      showError(error.response?.data?.error || 'Failed to delete config')
    }
  }

  // Add item to editing config
  const handleEditAddItem = () => {
    if (supplyTypes.length === 0) return
    setEditingConfig({
      ...editingConfig,
      items: [
        ...editingConfig.items,
        { supply_type_id: supplyTypes[0].supply_type_id, quantity: 1 }
      ]
    })
  }

  // Remove item from editing config
  const handleEditRemoveItem = (index) => {
    setEditingConfig({
      ...editingConfig,
      items: editingConfig.items.filter((_, i) => i !== index)
    })
  }

  // Update item in editing config
  const handleEditUpdateItem = (index, field, value) => {
    const updatedItems = [...editingConfig.items]
    updatedItems[index] = { ...updatedItems[index], [field]: value }
    setEditingConfig({ ...editingConfig, items: updatedItems })
  }

  // Get supply type name
  const getSupplyTypeName = (typeId) => {
    const type = supplyTypes.find(t => t.supply_type_id === typeId)
    return type?.name || 'Unknown'
  }

  // Format currency
  const formatCurrency = (value) => {
    if (value === null || value === undefined) return '-'
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 4
    }).format(value)
  }

  if (!isAdmin) {
    return (
      <div className="shipping-configs-page">
        <div className="shipping-unauthorized">
          <AlertCircle size={48} />
          <h2>Access Denied</h2>
          <p>You need admin access to manage shipping configurations.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="shipping-configs-page">
      <div className="shipping-header">
        <div className="shipping-title">
          <Settings size={24} />
          <h1>Shipping Configurations</h1>
        </div>
        <div className="shipping-header-actions">
          <Link to="/seller" className="shipping-nav-btn">
            <ArrowLeft size={16} />
            Dashboard
          </Link>
          <Link to="/seller/supplies" className="shipping-nav-btn">
            <Package size={16} />
            Supplies
          </Link>
          <button className="shipping-refresh-btn" onClick={fetchData} disabled={loading}>
            <RefreshCw size={16} className={loading ? 'spinning' : ''} />
            Refresh
          </button>
          <button
            className="shipping-add-btn"
            onClick={() => setShowAddForm(!showAddForm)}
          >
            <Plus size={16} />
            New Config
          </button>
        </div>
      </div>

      {/* Add Form */}
      {showAddForm && (
        <div className="shipping-add-form">
          <h2>Create Shipping Configuration</h2>
          <form onSubmit={handleCreate}>
            <div className="shipping-form-row">
              <div className="shipping-form-field">
                <label>Name</label>
                <input
                  type="text"
                  placeholder="e.g., PWE, Bubble Mailer"
                  value={newConfig.name}
                  onChange={(e) => setNewConfig({ ...newConfig, name: e.target.value })}
                  className="shipping-input"
                  required
                />
              </div>
              <div className="shipping-form-field shipping-field-wide">
                <label>Description (optional)</label>
                <input
                  type="text"
                  placeholder="e.g., Standard plain white envelope shipping"
                  value={newConfig.description}
                  onChange={(e) => setNewConfig({ ...newConfig, description: e.target.value })}
                  className="shipping-input"
                />
              </div>
            </div>

            <div className="shipping-items-section">
              <div className="shipping-items-header">
                <h3>Supplies Required (BOM)</h3>
                <button
                  type="button"
                  onClick={handleAddItem}
                  className="shipping-add-item-btn"
                  disabled={supplyTypes.length === 0}
                >
                  <Plus size={14} /> Add Supply
                </button>
              </div>

              {newConfig.items.length === 0 ? (
                <p className="shipping-items-empty">
                  No supplies added yet. Click "Add Supply" to add items to this configuration.
                </p>
              ) : (
                <div className="shipping-items-list">
                  {newConfig.items.map((item, index) => (
                    <div key={index} className="shipping-item-row">
                      <select
                        value={item.supply_type_id}
                        onChange={(e) => handleUpdateItem(index, 'supply_type_id', e.target.value)}
                        className="shipping-select"
                      >
                        {supplyTypes.map(type => (
                          <option key={type.supply_type_id} value={type.supply_type_id}>
                            {type.name}
                          </option>
                        ))}
                      </select>
                      <span className="shipping-item-x">x</span>
                      <input
                        type="number"
                        value={item.quantity}
                        onChange={(e) => handleUpdateItem(index, 'quantity', e.target.value)}
                        className="shipping-qty-input"
                        min="1"
                      />
                      <button
                        type="button"
                        onClick={() => handleRemoveItem(index)}
                        className="shipping-icon-btn shipping-icon-danger"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="shipping-form-actions">
              <button
                type="button"
                onClick={() => {
                  setShowAddForm(false)
                  setNewConfig({ name: '', description: '', items: [] })
                }}
                className="shipping-cancel-btn"
              >
                Cancel
              </button>
              <button type="submit" disabled={adding || !newConfig.name.trim()} className="shipping-submit-btn">
                {adding ? 'Creating...' : 'Create Config'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Configs List */}
      {loading ? (
        <div className="shipping-loading">
          <RefreshCw size={24} className="spinning" />
          <p>Loading configurations...</p>
        </div>
      ) : configs.length === 0 ? (
        <div className="shipping-empty">
          <Settings size={48} />
          <h3>No Shipping Configurations</h3>
          <p>Create your first shipping configuration to track supply costs.</p>
          <button onClick={() => setShowAddForm(true)}>
            <Plus size={16} /> Create Config
          </button>
        </div>
      ) : (
        <div className="shipping-configs-list">
          {configs.map(config => {
            const isEditing = editingConfig?.shipping_config_id === config.shipping_config_id
            const isExpanded = expandedConfig === config.shipping_config_id
            const costData = configCosts[config.shipping_config_id]

            return (
              <div key={config.shipping_config_id} className="shipping-config-card">
                <div
                  className="shipping-config-header"
                  onClick={() => !isEditing && setExpandedConfig(isExpanded ? null : config.shipping_config_id)}
                >
                  <div className="shipping-config-info">
                    <h3>{config.name}</h3>
                    {config.description && <p>{config.description}</p>}
                    <span className="shipping-config-count">
                      {config.shipping_config_items.length} supplies
                    </span>
                  </div>
                  <div className="shipping-config-cost">
                    {costData?.error && costData?.total_cost === null ? (
                      <span className="shipping-cost-error" title={costData.error}>
                        <AlertCircle size={14} />
                        No inventory
                      </span>
                    ) : costData?.total_cost !== undefined && costData?.total_cost !== null ? (
                      <span className="shipping-cost-value">
                        <DollarSign size={14} />
                        {formatCurrency(costData.total_cost)}
                      </span>
                    ) : costData?.total_cost === 0 ? (
                      <span className="shipping-cost-value">
                        <DollarSign size={14} />
                        {formatCurrency(0)}
                      </span>
                    ) : costData ? (
                      <span className="shipping-cost-error" title={costData.error || 'Unable to calculate'}>
                        <AlertCircle size={14} />
                        Incomplete
                      </span>
                    ) : (
                      <span className="shipping-cost-loading">...</span>
                    )}
                  </div>
                  <div className="shipping-config-actions">
                    {!isEditing && (
                      <>
                        <button
                          className="shipping-icon-btn"
                          onClick={(e) => {
                            e.stopPropagation()
                            handleStartEdit(config)
                          }}
                        >
                          <Edit2 size={16} />
                        </button>
                        <button
                          className="shipping-icon-btn shipping-icon-danger"
                          onClick={(e) => {
                            e.stopPropagation()
                            handleDelete(config.shipping_config_id)
                          }}
                        >
                          <Trash2 size={16} />
                        </button>
                      </>
                    )}
                    {isExpanded ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                  </div>
                </div>

                {isExpanded && (
                  <div className="shipping-config-details">
                    {isEditing ? (
                      <div className="shipping-edit-form">
                        <div className="shipping-form-row">
                          <div className="shipping-form-field">
                            <label>Name</label>
                            <input
                              type="text"
                              value={editingConfig.name}
                              onChange={(e) => setEditingConfig({ ...editingConfig, name: e.target.value })}
                              className="shipping-input"
                            />
                          </div>
                          <div className="shipping-form-field shipping-field-wide">
                            <label>Description</label>
                            <input
                              type="text"
                              value={editingConfig.description}
                              onChange={(e) => setEditingConfig({ ...editingConfig, description: e.target.value })}
                              className="shipping-input"
                            />
                          </div>
                        </div>

                        <div className="shipping-items-section">
                          <div className="shipping-items-header">
                            <h4>Supplies (BOM)</h4>
                            <button
                              type="button"
                              onClick={handleEditAddItem}
                              className="shipping-add-item-btn"
                            >
                              <Plus size={14} /> Add
                            </button>
                          </div>

                          <div className="shipping-items-list">
                            {editingConfig.items.map((item, index) => (
                              <div key={index} className="shipping-item-row">
                                <select
                                  value={item.supply_type_id}
                                  onChange={(e) => handleEditUpdateItem(index, 'supply_type_id', e.target.value)}
                                  className="shipping-select"
                                >
                                  {supplyTypes.map(type => (
                                    <option key={type.supply_type_id} value={type.supply_type_id}>
                                      {type.name}
                                    </option>
                                  ))}
                                </select>
                                <span className="shipping-item-x">x</span>
                                <input
                                  type="number"
                                  value={item.quantity}
                                  onChange={(e) => handleEditUpdateItem(index, 'quantity', e.target.value)}
                                  className="shipping-qty-input"
                                  min="1"
                                />
                                <button
                                  type="button"
                                  onClick={() => handleEditRemoveItem(index)}
                                  className="shipping-icon-btn shipping-icon-danger"
                                >
                                  <Trash2 size={14} />
                                </button>
                              </div>
                            ))}
                          </div>
                        </div>

                        <div className="shipping-form-actions">
                          <button
                            type="button"
                            onClick={() => setEditingConfig(null)}
                            className="shipping-cancel-btn"
                          >
                            Cancel
                          </button>
                          <button
                            type="button"
                            onClick={handleUpdate}
                            className="shipping-submit-btn"
                          >
                            Save Changes
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="shipping-items-display">
                        <h4>Supplies Required:</h4>
                        {config.shipping_config_items.length === 0 ? (
                          <p className="shipping-no-items">No supplies configured</p>
                        ) : (
                          <ul className="shipping-items-ul">
                            {config.shipping_config_items.map(item => {
                              // Find cost data for this supply type
                              const itemCost = costData?.items?.find(
                                i => i.supply_type_id === item.supply_type_id
                              )
                              return (
                                <li key={item.shipping_config_item_id}>
                                  <span className="shipping-item-qty">{item.quantity}x</span>
                                  <span className="shipping-item-name">{item.supply_type?.name || 'Unknown'}</span>
                                  {itemCost ? (
                                    <span className="shipping-item-cost">{formatCurrency(itemCost.cost)}</span>
                                  ) : costData?.error ? (
                                    <span className="shipping-item-cost-error">No stock</span>
                                  ) : null}
                                </li>
                              )
                            })}
                          </ul>
                        )}
                        {costData && !costData.error && (
                          <div className="shipping-cost-total">
                            <span>Total Supply Cost:</span>
                            <strong>{formatCurrency(costData.total_cost)}</strong>
                          </div>
                        )}
                        {costData?.error && (
                          <div className="shipping-cost-warning">
                            <AlertCircle size={14} />
                            <span>{costData.error}</span>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Help Text */}
      <div className="shipping-help">
        <h4>What are Shipping Configurations?</h4>
        <p>
          Shipping configurations (like PWE or Bubble Mailer) define what supplies are needed for each shipping method.
          When you ship a sale, select a configuration and the system will automatically calculate the supply cost
          using FIFO (First In, First Out) pricing from your inventory.
        </p>
        <p>
          <strong>Tip:</strong> Create your supply types and add inventory batches in{' '}
          <a href="/seller/supplies">Supply Management</a> before creating shipping configs.
        </p>
      </div>
    </div>
  )
}

export default ShippingConfigs
