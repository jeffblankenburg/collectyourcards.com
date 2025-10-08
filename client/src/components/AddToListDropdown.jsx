import React, { useState, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import axios from 'axios'
import { useToast } from '../contexts/ToastContext'
import Icon from './Icon'
import './AddToListDropdown.css'

/**
 * AddToListDropdown Component
 *
 * Lightweight dropdown for adding cards to collection or lists
 *
 * Props:
 * - card: Card object with card_id
 * - onAddToCollection: Callback for "Add to Collection" (opens AddCardModal)
 * - onAddToList: Optional callback after card is added to list
 * - className: Optional CSS class
 */
function AddToListDropdown({ card, onAddToCollection, onAddToList, className = '' }) {
  const { success, error: showError } = useToast()
  const [isOpen, setIsOpen] = useState(false)
  const [lists, setLists] = useState([])
  const [loading, setLoading] = useState(false)
  const [showNewListInput, setShowNewListInput] = useState(false)
  const [newListName, setNewListName] = useState('')
  const [creatingList, setCreatingList] = useState(false)
  const [dropdownPosition, setDropdownPosition] = useState({ top: 0, left: 0 })
  const buttonRef = useRef(null)
  const dropdownRef = useRef(null)
  const inputRef = useRef(null)

  // Update dropdown position when opened
  useEffect(() => {
    if (isOpen && buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect()
      setDropdownPosition({
        top: rect.bottom + window.scrollY + 4,
        left: rect.left + window.scrollX
      })
    }
  }, [isOpen])

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target) &&
        buttonRef.current &&
        !buttonRef.current.contains(event.target)
      ) {
        setIsOpen(false)
        setShowNewListInput(false)
        setNewListName('')
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside)
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isOpen])

  // Auto-focus input when showing new list form
  useEffect(() => {
    if (showNewListInput && inputRef.current) {
      inputRef.current.focus()
    }
  }, [showNewListInput])

  // Load user's lists when dropdown opens
  useEffect(() => {
    if (isOpen && lists.length === 0) {
      loadLists()
    }
  }, [isOpen])

  const loadLists = async () => {
    try {
      setLoading(true)
      const response = await axios.get('/api/user/lists')
      setLists(response.data.lists || [])
    } catch (err) {
      console.error('Error loading lists:', err)
      showError('Failed to load lists')
    } finally {
      setLoading(false)
    }
  }

  const handleToggleDropdown = (e) => {
    e.stopPropagation()
    setIsOpen(!isOpen)
    if (!isOpen) {
      setShowNewListInput(false)
      setNewListName('')
    }
  }

  const handleAddToCollection = (e) => {
    e.stopPropagation()
    setIsOpen(false)
    if (onAddToCollection) {
      onAddToCollection(card)
    }
  }

  const handleAddToList = async (list, e) => {
    e.stopPropagation()

    try {
      const response = await axios.post(`/api/user/lists/${list.slug}/cards`, {
        cardId: card.card_id
      })

      // Use the message from the server (handles duplicates)
      const resultMessage = response.data.message || `Card added to "${list.name}"`

      // Show warning toast if it was a duplicate, success otherwise
      if (response.data.duplicates > 0 && response.data.added === 0) {
        showError(resultMessage)
      } else {
        success(resultMessage)
      }

      setIsOpen(false)

      // Refresh lists to update card counts
      await loadLists()

      if (onAddToList) {
        onAddToList(list)
      }
    } catch (err) {
      console.error('Error adding to list:', err)
      if (err.response?.data?.message) {
        showError(err.response.data.message)
      } else {
        showError('Failed to add card to list')
      }
    }
  }

  const handleShowNewListForm = (e) => {
    e.stopPropagation()
    setShowNewListInput(true)
  }

  const handleCreateListAndAdd = async () => {
    if (!newListName.trim()) {
      showError('Please enter a list name')
      return
    }

    try {
      setCreatingList(true)

      // Create the list
      const createResponse = await axios.post('/api/user/lists', {
        name: newListName.trim()
      })

      const newList = createResponse.data.list

      // Add card to the new list
      await axios.post(`/api/user/lists/${newList.slug}/cards`, {
        cardId: card.card_id
      })

      success(`Card added to "${newList.name}"`)
      setIsOpen(false)
      setShowNewListInput(false)
      setNewListName('')

      // Refresh lists
      await loadLists()

      if (onAddToList) {
        onAddToList(newList)
      }
    } catch (err) {
      console.error('Error creating list and adding card:', err)
      if (err.response?.data?.message) {
        showError(err.response.data.message)
      } else {
        showError('Failed to create list')
      }
    } finally {
      setCreatingList(false)
    }
  }

  const handleKeyPress = (e) => {
    if (e.key === 'Enter') {
      handleCreateListAndAdd()
    } else if (e.key === 'Escape') {
      setShowNewListInput(false)
      setNewListName('')
    }
  }

  return (
    <div className={`add-to-list-dropdown ${className}`}>
      <button
        ref={buttonRef}
        className="add-to-list-dropdown-trigger"
        onClick={handleToggleDropdown}
        title="Add card"
      >
        <Icon name="plus" size={16} />
      </button>

      {isOpen && createPortal(
        <div
          ref={dropdownRef}
          className="add-to-list-dropdown-menu"
          style={{
            position: 'absolute',
            top: `${dropdownPosition.top}px`,
            left: `${dropdownPosition.left}px`,
            zIndex: 9999
          }}
        >
          {/* Add to Collection (Primary Action) */}
          <button
            className="add-to-list-dropdown-item add-to-collection"
            onClick={handleAddToCollection}
          >
            <Icon name="plus" size={16} />
            <span>Add to Your Collection</span>
          </button>

          <div className="add-to-list-dropdown-divider" />

          {/* Loading State */}
          {loading && (
            <div className="add-to-list-dropdown-loading">
              Loading lists...
            </div>
          )}

          {/* User's Lists */}
          {!loading && lists.length > 0 && (
            <div className="add-to-list-dropdown-lists">
              {lists.map(list => (
                <button
                  key={list.user_list_id}
                  className="add-to-list-dropdown-item list-item"
                  onClick={(e) => handleAddToList(list, e)}
                >
                  <Icon name="list" size={16} />
                  <span className="list-name">{list.name}</span>
                  <span className="list-count">{list.card_count || 0} cards</span>
                </button>
              ))}
            </div>
          )}

          {/* Empty State */}
          {!loading && lists.length === 0 && !showNewListInput && (
            <div className="add-to-list-dropdown-empty">
              <p>No lists yet</p>
            </div>
          )}

          {/* Create New List */}
          {!showNewListInput ? (
            <button
              className="add-to-list-dropdown-item create-new-list"
              onClick={handleShowNewListForm}
            >
              <Icon name="plus" size={16} />
              <span>Create New List</span>
            </button>
          ) : (
            <div className="add-to-list-dropdown-new-list-form" onClick={e => e.stopPropagation()}>
              <input
                ref={inputRef}
                type="text"
                className="new-list-input"
                placeholder="Enter list name..."
                value={newListName}
                onChange={(e) => setNewListName(e.target.value)}
                onKeyDown={handleKeyPress}
                disabled={creatingList}
              />
              <div className="new-list-actions">
                <button
                  className="new-list-confirm"
                  onClick={handleCreateListAndAdd}
                  disabled={!newListName.trim() || creatingList}
                  title="Create list and add card"
                >
                  <Icon name="check" size={14} />
                </button>
                <button
                  className="new-list-cancel"
                  onClick={(e) => {
                    e.stopPropagation()
                    setShowNewListInput(false)
                    setNewListName('')
                  }}
                  disabled={creatingList}
                  title="Cancel"
                >
                  <Icon name="x" size={14} />
                </button>
              </div>
            </div>
          )}
        </div>,
        document.body
      )}
    </div>
  )
}

export default AddToListDropdown
