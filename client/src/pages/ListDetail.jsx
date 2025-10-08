import React, { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import axios from 'axios'
import { useToast } from '../contexts/ToastContext'
import { useAuth } from '../contexts/AuthContext'
import Icon from '../components/Icon'
import CardTable from '../components/tables/CardTable'
import './ListDetail.css'

function ListDetail() {
  const { slug } = useParams()
  const navigate = useNavigate()
  const { addToast } = useToast()
  const { user } = useAuth()

  const [list, setList] = useState(null)
  const [cards, setCards] = useState([])
  const [loading, setLoading] = useState(true)
  const [editingName, setEditingName] = useState(false)
  const [newName, setNewName] = useState('')
  const [removingCardId, setRemovingCardId] = useState(null)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [bulkSelectionMode, setBulkSelectionMode] = useState(false)
  const [selectedCards, setSelectedCards] = useState(new Set())
  const [searchQuery, setSearchQuery] = useState('')

  useEffect(() => {
    if (!user) {
      navigate('/login')
      return
    }
    loadListDetails()
  }, [user, slug, navigate])

  const loadListDetails = async () => {
    try {
      setLoading(true)
      const response = await axios.get(`/api/user/lists/${slug}`)
      setList(response.data.list)
      setCards(response.data.cards || [])
      setNewName(response.data.list.name)
    } catch (error) {
      console.error('Error loading list details:', error)
      if (error.response?.status === 404) {
        addToast('List not found or access denied', 'error')
        navigate('/lists')
      } else {
        addToast('Failed to load list details', 'error')
      }
    } finally {
      setLoading(false)
    }
  }

  const handleSaveName = async () => {
    if (!newName.trim()) {
      addToast('List name cannot be empty', 'error')
      return
    }

    try {
      const response = await axios.put(`/api/user/lists/${slug}`, {
        name: newName.trim()
      })

      setList(response.data.list)
      setEditingName(false)
      addToast('List name updated', 'success')
      // Update URL with new slug if name changed
      if (response.data.list.slug !== slug) {
        navigate(`/lists/${response.data.list.slug}`, { replace: true })
      }
    } catch (error) {
      console.error('Error updating list name:', error)
      addToast(error.response?.data?.message || 'Failed to update list name', 'error')
    }
  }

  const handleRemoveCard = async (cardId) => {
    try {
      setRemovingCardId(cardId)
      await axios.delete(`/api/user/lists/${slug}/cards/${cardId}`)

      setCards(cards.filter(card => card.card_id !== cardId))
      setList({
        ...list,
        card_count: list.card_count - 1
      })
      addToast('Card removed from list', 'success')
    } catch (error) {
      console.error('Error removing card:', error)
      addToast(error.response?.data?.message || 'Failed to remove card', 'error')
    } finally {
      setRemovingCardId(null)
    }
  }

  const handleDeleteList = async () => {
    try {
      await axios.delete(`/api/user/lists/${slug}`)
      addToast('List deleted successfully', 'success')
      navigate('/lists')
    } catch (error) {
      console.error('Error deleting list:', error)
      addToast(error.response?.data?.message || 'Failed to delete list', 'error')
    }
  }

  const handleDeleteClick = () => {
    setShowDeleteConfirm(true)
  }

  const handleCancelDelete = () => {
    setShowDeleteConfirm(false)
  }

  const handleConfirmDelete = () => {
    setShowDeleteConfirm(false)
    handleDeleteList()
  }

  const handleRemoveFromList = async (card) => {
    await handleRemoveCard(card.card_id)
  }

  const handleBulkSelectionToggle = () => {
    setBulkSelectionMode(!bulkSelectionMode)
    setSelectedCards(new Set())
  }

  const formatDate = (dateString) => {
    const date = new Date(dateString)
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    })
  }

  if (loading) {
    return (
      <div className="list-detail-page">
        <div className="list-detail-container">
          <div className="loading-spinner">
            <div className="card-icon-spinner"></div>
            <p>Loading list...</p>
          </div>
        </div>
      </div>
    )
  }

  if (!list) {
    return null
  }

  return (
    <div className="list-detail-page">
      <div className="list-detail-container">
        <button className="back-button" onClick={() => navigate('/lists')}>
          <Icon name="arrow-left" size={20} />
          Back to Lists
        </button>

        <div className="list-detail-header">
          <div className="list-detail-header-content">
            {editingName ? (
              <div className="edit-name-form">
                <input
                  type="text"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handleSaveName()}
                  autoFocus
                />
                <button className="save-name-button" onClick={handleSaveName}>
                  <Icon name="check" size={20} />
                </button>
                <button
                  className="cancel-name-button"
                  onClick={() => {
                    setEditingName(false)
                    setNewName(list.name)
                  }}
                >
                  <Icon name="x" size={20} />
                </button>
              </div>
            ) : (
              <div className="list-name-display">
                <h1>{list.name}</h1>
                <button
                  className="edit-name-trigger"
                  onClick={() => setEditingName(true)}
                  title="Rename list"
                >
                  <Icon name="edit" size={20} />
                </button>
              </div>
            )}
            <div className="list-meta">
              <span className="list-card-count">
                {list.card_count} {list.card_count === 1 ? 'card' : 'cards'}
              </span>
            </div>
          </div>

          <button className="delete-list-button" onClick={handleDeleteClick}>
            <Icon name="trash" size={20} />
            Delete List
          </button>
        </div>

        {showDeleteConfirm && (
          <div className="delete-confirm-overlay" onClick={handleCancelDelete}>
            <div className="delete-confirm-modal" onClick={(e) => e.stopPropagation()}>
              <div className="delete-confirm-header">
                <Icon name="alert-triangle" size={32} />
                <h2>Delete List?</h2>
              </div>
              <p>
                Are you sure you want to delete "<strong>{list.name}</strong>"?<br />
                All cards will be removed from this list.
              </p>
              <div className="delete-confirm-actions">
                <button className="cancel-button" onClick={handleCancelDelete}>
                  Cancel
                </button>
                <button className="confirm-delete-button" onClick={handleConfirmDelete}>
                  <Icon name="trash" size={16} />
                  Delete List
                </button>
              </div>
            </div>
          </div>
        )}

        {cards.length === 0 ? (
          <div className="empty-list">
            <Icon name="inbox" size={64} />
            <h2>This list is empty</h2>
            <p>Add cards to this list from card detail pages, card tables, or series pages</p>
          </div>
        ) : (
          <CardTable
            cards={cards}
            showRemoveFromList={true}
            onRemoveFromList={handleRemoveFromList}
            removingCardId={removingCardId}
            bulkSelectionMode={bulkSelectionMode}
            selectedCards={selectedCards}
            onBulkSelectionToggle={handleBulkSelectionToggle}
            onCardSelection={setSelectedCards}
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            showBulkActions={true}
            showSearch={true}
            maxHeight="none"
            defaultSort="card_number"
          />
        )}
      </div>
    </div>
  )
}

export default ListDetail
