import React, { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import axios from 'axios'
import { useToast } from '../contexts/ToastContext'
import { useAuth } from '../contexts/AuthContext'
import Icon from '../components/Icon'
import CardTable from '../components/tables/CardTable'
import './ListDetail.css'

function ListDetail() {
  const { slug, username, listSlug } = useParams()
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
  const [togglingPublic, setTogglingPublic] = useState(false)
  const [isPublicView, setIsPublicView] = useState(false)
  const [copyingList, setCopyingList] = useState(false)
  const [listOwner, setListOwner] = useState(null)

  // Determine if we're viewing via /lists/:slug or /:username/:listSlug
  const viewingSlug = listSlug || slug
  const viewingUsername = username

  useEffect(() => {
    // If viewing via /:username/:listSlug, we're in public view mode
    if (viewingUsername) {
      setIsPublicView(true)
      loadListDetails()
    } else {
      // Private view - require authentication
      if (!user) {
        navigate('/login')
        return
      }
      setIsPublicView(false)
      loadListDetails()
    }
  }, [user, viewingSlug, viewingUsername, navigate])

  const loadListDetails = async () => {
    try {
      setLoading(true)
      let response

      if (viewingUsername) {
        // Public view: fetch by username and list slug
        response = await axios.get(`/api/public-lists/${viewingUsername}/${viewingSlug}`)
      } else {
        // Private view: fetch by slug only (user's own list)
        response = await axios.get(`/api/user/lists/${viewingSlug}`)
      }

      setList(response.data.list)
      setCards(response.data.cards || [])
      setNewName(response.data.list.name)

      // For public view, set the list owner info
      if (viewingUsername && response.data.owner) {
        setListOwner(response.data.owner)
      }
    } catch (error) {
      console.error('Error loading list details:', error)
      if (error.response?.status === 404) {
        addToast('List not found or access denied', 'error')
        navigate(viewingUsername ? `/${viewingUsername}` : '/lists')
      } else if (error.response?.status === 403) {
        addToast('This list is private', 'error')
        navigate(viewingUsername ? `/${viewingUsername}` : '/lists')
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

  const handleTogglePublic = async () => {
    try {
      setTogglingPublic(true)
      const response = await axios.patch(`/api/user/lists/${slug}/visibility`, {
        is_public: !list.is_public
      })

      setList(response.data.list)
    } catch (error) {
      console.error('Error toggling list visibility:', error)
      addToast(error.response?.data?.message || 'Failed to update list visibility', 'error')
    } finally {
      setTogglingPublic(false)
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

  const handleCopyList = async () => {
    try {
      setCopyingList(true)
      const response = await axios.post('/api/user/lists/copy', {
        source_username: viewingUsername,
        source_list_slug: viewingSlug
      })

      addToast(`"${list.name}" copied to your lists`, 'success')
      navigate(`/lists/${response.data.list.slug}`)
    } catch (error) {
      console.error('Error copying list:', error)
      addToast(error.response?.data?.message || 'Failed to copy list', 'error')
    } finally {
      setCopyingList(false)
    }
  }

  const handleCardClick = (card) => {
    const setSlug = card.series_rel?.set_slug || 'unknown-set'
    const setYear = card.series_rel?.set_year || '0000'
    const seriesSlug = card.series_rel?.slug || 'unknown-series'
    const cardNumber = card.card_number || '0'

    // Get first player name for URL
    const playerName = card.card_player_teams?.[0]?.player
      ? `${card.card_player_teams[0].player.first_name}-${card.card_player_teams[0].player.last_name}`.toLowerCase().replace(/\s+/g, '-')
      : 'unknown-player'

    navigate(`/card/${seriesSlug}/${cardNumber}/${playerName}`)
  }

  const handlePlayerClick = (player) => {
    if (!player?.player_id) return

    const playerSlug = `${player.first_name}-${player.last_name}`
      .toLowerCase()
      .replace(/\s+/g, '-')
      .replace(/[^a-z0-9-]/g, '')

    navigate(`/players/${playerSlug}`)
  }

  const handleSeriesClick = (series) => {
    if (!series?.slug) return
    navigate(`/series/${series.slug}`)
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
        {!isPublicView && (
          <button className="back-button" onClick={() => navigate('/lists')}>
            <Icon name="arrow-left" size={20} />
            Back to Lists
          </button>
        )}

        <div className="list-detail-header">
          <div className="list-detail-header-content">
            {editingName && !isPublicView ? (
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
                {!isPublicView && (
                  <button
                    className="edit-name-trigger"
                    onClick={() => setEditingName(true)}
                    title="Rename list"
                  >
                    <Icon name="edit" size={20} />
                  </button>
                )}
              </div>
            )}
            <div className="list-meta">
              <span className="list-card-count">
                {list.card_count} {list.card_count === 1 ? 'card' : 'cards'}
              </span>
              {isPublicView && listOwner && (
                <span className="list-owner">
                  Created by{' '}
                  <a href={`/${viewingUsername}`} className="owner-link">
                    {listOwner.first_name} {listOwner.last_name} @{viewingUsername}
                  </a>
                </span>
              )}
            </div>
          </div>

          {isPublicView && user && listOwner && user.username !== viewingUsername && (
            <div className="list-actions">
              <button
                className="copy-list-button"
                onClick={handleCopyList}
                disabled={copyingList}
                title="Copy this list to your collection"
              >
                <Icon name="copy" size={16} />
                {copyingList ? 'Copying...' : 'Copy List'}
              </button>
            </div>
          )}

          {!isPublicView && (
            <div className="list-actions">
              <button
                className="toggle-public-button"
                onClick={handleTogglePublic}
                disabled={togglingPublic}
                title={list.is_public ? 'Public - Click to make private' : 'Private - Click to make public'}
              >
                <Icon name={list.is_public ? 'eye' : 'eye-off'} size={16} />
              </button>
              <button className="delete-list-button" onClick={handleDeleteClick} title="Delete list">
                <Icon name="trash" size={16} />
              </button>
            </div>
          )}
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
            showRemoveFromList={!isPublicView}
            onRemoveFromList={handleRemoveFromList}
            removingCardId={removingCardId}
            bulkSelectionMode={bulkSelectionMode}
            selectedCards={selectedCards}
            onBulkSelectionToggle={handleBulkSelectionToggle}
            onCardSelection={setSelectedCards}
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            showBulkActions={!isPublicView}
            showSearch={true}
            maxHeight="none"
            defaultSort="card_number"
            onCardClick={handleCardClick}
            onPlayerClick={handlePlayerClick}
            onSeriesClick={handleSeriesClick}
          />
        )}
      </div>
    </div>
  )
}

export default ListDetail
