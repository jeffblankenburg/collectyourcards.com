/**
 * OrderSuppliesModal - Add extra supplies to a grouped shipment
 * Allows adding supplies beyond what the shipping config provides
 */

import React, { useState, useEffect } from 'react'
import axios from 'axios'
import { useToast } from '../../contexts/ToastContext'
import Icon from '../Icon'
import './OrderSuppliesModal.css'

function OrderSuppliesModal({ isOpen, onClose, orderData, onSuccess }) {
  const { addToast } = useToast()
  const [supplyTypes, setSupplyTypes] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [supplies, setSupplies] = useState([]) // [{ supply_type_id, quantity }]

  // Fetch supply types on mount
  useEffect(() => {
    if (isOpen) {
      fetchSupplyTypes()
    }
  }, [isOpen])

  const fetchSupplyTypes = async () => {
    try {
      setLoading(true)
      const res = await axios.get('/api/supplies/types')
      setSupplyTypes(res.data.supply_types || [])
    } catch (error) {
      console.error('Error fetching supply types:', error)
      addToast('Failed to load supply types', 'error')
    } finally {
      setLoading(false)
    }
  }

  const addSupplyRow = () => {
    setSupplies([...supplies, { supply_type_id: '', quantity: 1 }])
  }

  const updateSupply = (index, field, value) => {
    const updated = [...supplies]
    updated[index][field] = field === 'quantity' ? parseInt(value) || 1 : value
    setSupplies(updated)
  }

  const removeSupply = (index) => {
    setSupplies(supplies.filter((_, i) => i !== index))
  }

  const handleSave = async () => {
    // Filter out empty rows
    const validSupplies = supplies.filter(s => s.supply_type_id && s.quantity > 0)

    if (validSupplies.length === 0) {
      addToast('Add at least one supply', 'error')
      return
    }

    try {
      setSaving(true)

      // First, clear existing supplies if any
      if (orderData.order?.order_supplies?.length > 0) {
        await axios.delete(`/api/seller/orders/${orderData.order_id}/supplies`)
      }

      // Allocate new supplies
      await axios.post(`/api/seller/orders/${orderData.order_id}/allocate-supplies`, {
        supplies: validSupplies.map(s => ({
          supply_type_id: parseInt(s.supply_type_id),
          quantity: s.quantity
        }))
      })

      addToast('Supplies added to shipment', 'success')
      onSuccess()
      onClose()
    } catch (error) {
      console.error('Error saving supplies:', error)
      const message = error.response?.data?.error || 'Failed to save supplies'
      addToast(message, 'error')
    } finally {
      setSaving(false)
    }
  }

  const handleClearSupplies = async () => {
    if (!orderData.order?.order_supplies?.length) return

    try {
      setSaving(true)
      await axios.delete(`/api/seller/orders/${orderData.order_id}/supplies`)
      addToast('Supplies cleared', 'success')
      onSuccess()
      onClose()
    } catch (error) {
      console.error('Error clearing supplies:', error)
      addToast('Failed to clear supplies', 'error')
    } finally {
      setSaving(false)
    }
  }

  if (!isOpen) return null

  const existingSupplies = orderData.order?.order_supplies || []

  return (
    <div className="order-supplies-modal-overlay" onClick={onClose}>
      <div className="order-supplies-modal" onClick={(e) => e.stopPropagation()}>
        <div className="order-supplies-modal-header">
          <h2>
            <Icon name="layers" size={20} />
            Extra Supplies for Shipment
          </h2>
          <button className="order-supplies-modal-close" onClick={onClose}>
            <Icon name="x" size={20} />
          </button>
        </div>

        <div className="order-supplies-modal-content">
          <p className="order-supplies-modal-info">
            Add supplies beyond what the shipping config provides.
            This is for items like extra toploaders, penny sleeves, etc. when shipping multiple cards.
          </p>

          {/* Show existing supplies if any */}
          {existingSupplies.length > 0 && (
            <div className="order-supplies-existing">
              <h3>Current Extra Supplies</h3>
              <div className="order-supplies-existing-list">
                {existingSupplies.map((usage, i) => (
                  <div key={i} className="order-supplies-existing-item">
                    <span className="order-supplies-existing-name">
                      {usage.supply_batch?.supply_type?.name || 'Unknown'}
                    </span>
                    <span className="order-supplies-existing-qty">x{usage.quantity_used}</span>
                    <span className="order-supplies-existing-cost">
                      ${parseFloat(usage.total_cost).toFixed(2)}
                    </span>
                  </div>
                ))}
              </div>
              <button
                className="order-supplies-clear-btn"
                onClick={handleClearSupplies}
                disabled={saving}
              >
                <Icon name="trash-2" size={14} />
                Clear All Supplies
              </button>
            </div>
          )}

          {/* Add new supplies */}
          <div className="order-supplies-add-section">
            <h3>{existingSupplies.length > 0 ? 'Replace Supplies' : 'Add Supplies'}</h3>

            {loading ? (
              <div className="order-supplies-loading">
                <Icon name="loader" size={24} className="spinning" />
                <span>Loading supply types...</span>
              </div>
            ) : (
              <>
                <div className="order-supplies-rows">
                  {supplies.map((supply, index) => (
                    <div key={index} className="order-supplies-row">
                      <select
                        className="order-supplies-select"
                        value={supply.supply_type_id}
                        onChange={(e) => updateSupply(index, 'supply_type_id', e.target.value)}
                      >
                        <option value="">Select supply type...</option>
                        {supplyTypes.map(st => (
                          <option key={st.supply_type_id} value={st.supply_type_id}>
                            {st.name}
                          </option>
                        ))}
                      </select>
                      <input
                        type="number"
                        className="order-supplies-qty"
                        value={supply.quantity}
                        onChange={(e) => updateSupply(index, 'quantity', e.target.value)}
                        min="1"
                        max="99"
                      />
                      <button
                        className="order-supplies-remove-btn"
                        onClick={() => removeSupply(index)}
                        title="Remove"
                      >
                        <Icon name="x" size={16} />
                      </button>
                    </div>
                  ))}
                </div>

                <button className="order-supplies-add-btn" onClick={addSupplyRow}>
                  <Icon name="plus" size={16} />
                  Add Supply
                </button>
              </>
            )}
          </div>
        </div>

        <div className="order-supplies-modal-footer">
          <button className="order-supplies-cancel-btn" onClick={onClose} disabled={saving}>
            Cancel
          </button>
          <button
            className="order-supplies-save-btn"
            onClick={handleSave}
            disabled={saving || supplies.length === 0}
          >
            {saving ? (
              <>
                <Icon name="loader" size={16} className="spinning" />
                Saving...
              </>
            ) : (
              <>
                <Icon name="check" size={16} />
                Save Supplies
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}

export default OrderSuppliesModal
