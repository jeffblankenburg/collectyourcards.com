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
  const [editingSummary, setEditingSummary] = useState(false)
  const [newSummary, setNewSummary] = useState('')
  const [removingCardId, setRemovingCardId] = useState(null)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [bulkSelectionMode, setBulkSelectionMode] = useState(false)
  const [selectedCards, setSelectedCards] = useState(new Set())
  const [searchQuery, setSearchQuery] = useState('')
  const [togglingPublic, setTogglingPublic] = useState(false)
  const [isPublicView, setIsPublicView] = useState(false)
  const [copyingList, setCopyingList] = useState(false)
  const [listOwner, setListOwner] = useState(null)
  const [sharingList, setSharingList] = useState(false)

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
      setNewSummary(response.data.list.summary || '')

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

  const handleSaveSummary = async () => {
    try {
      const response = await axios.put(`/api/user/lists/${slug}`, {
        summary: newSummary.trim()
      })

      setList(response.data.list)
      setEditingSummary(false)
      addToast('List summary updated', 'success')
    } catch (error) {
      console.error('Error updating list summary:', error)
      addToast(error.response?.data?.message || 'Failed to update list summary', 'error')
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

  const handleShareList = async () => {
    // Determine the username to use for the public URL
    const usernameForUrl = viewingUsername || user?.username
    if (!usernameForUrl) {
      addToast('Unable to generate share link', 'error')
      return
    }

    const publicUrl = `${window.location.origin}/${usernameForUrl}/${viewingSlug}`

    try {
      await navigator.clipboard.writeText(publicUrl)
      setSharingList(true)
      addToast('Link copied to clipboard!', 'success')
      setTimeout(() => setSharingList(false), 2000)
    } catch (error) {
      console.error('Error copying to clipboard:', error)
      addToast('Failed to copy link', 'error')
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
                  <div className="list-name-actions">
                    <button
                      className="edit-name-trigger"
                      onClick={() => setEditingName(true)}
                      title="Rename list"
                    >
                      <Icon name="edit" size={20} />
                    </button>
                    <button
                      className="toggle-public-button-inline"
                      onClick={handleTogglePublic}
                      disabled={togglingPublic}
                      title={list.is_public ? 'Public - Click to make private' : 'Private - Click to make public'}
                    >
                      <Icon name={list.is_public ? 'eye' : 'eye-off'} size={20} />
                    </button>
                    <button
                      className="delete-list-button-inline"
                      onClick={handleDeleteClick}
                      title="Delete list"
                    >
                      <Icon name="trash" size={20} />
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Summary section */}
            {editingSummary && !isPublicView ? (
              <div className="edit-summary-form">
                <textarea
                  value={newSummary}
                  onChange={(e) => setNewSummary(e.target.value)}
                  placeholder="Add a description for this list..."
                  rows={3}
                  autoFocus
                />
                <div className="edit-summary-actions">
                  <button className="save-summary-button" onClick={handleSaveSummary}>
                    <Icon name="check" size={16} />
                    Save
                  </button>
                  <button
                    className="cancel-summary-button"
                    onClick={() => {
                      setEditingSummary(false)
                      setNewSummary(list.summary || '')
                    }}
                  >
                    <Icon name="x" size={16} />
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <>
                {list.summary && (
                  <div className="list-summary-display">
                    <p>{list.summary}</p>
                    {!isPublicView && (
                      <button
                        className="edit-summary-trigger"
                        onClick={() => setEditingSummary(true)}
                        title="Edit summary"
                      >
                        <Icon name="edit" size={16} />
                      </button>
                    )}
                  </div>
                )}
                {!list.summary && !isPublicView && (
                  <button
                    className="add-summary-button"
                    onClick={() => setEditingSummary(true)}
                  >
                    <Icon name="plus" size={16} />
                    Add description
                  </button>
                )}
              </>
            )}

            {isPublicView && listOwner && (
              <div className="list-owner-info">
                Created by{' '}
                <a href={`/${viewingUsername}`} className="owner-link">
                  {listOwner.first_name} {listOwner.last_name} @{viewingUsername}
                </a>
              </div>
            )}
          </div>

          <div className="list-header-right">
            <div className="list-stats">
              <div className="stat-box">
                <div className="stat-value">{list.card_count}</div>
                <div className="stat-label">{list.card_count === 1 ? 'Card' : 'Cards'}</div>
              </div>
              {(!isPublicView || (user && user.username === viewingUsername)) && (
                <>
                  <div className="stat-box">
                    <div className="stat-value">
                      {cards.filter(card => card.user_card_count > 0).length}
                    </div>
                    <div className="stat-label">Owned</div>
                  </div>
                  <div className="stat-box stat-box-highlight">
                    <div className="stat-value">
                      {list.card_count > 0
                        ? Math.round((cards.filter(card => card.user_card_count > 0).length / list.card_count) * 100)
                        : 0}%
                    </div>
                    <div className="stat-label">Complete</div>
                  </div>
                </>
              )}
            </div>

            <button
              className="share-list-button"
              onClick={handleShareList}
              disabled={sharingList}
              title="Copy link to clipboard"
            >
              <Icon name={sharingList ? 'check' : 'share-2'} size={16} />
              {sharingList ? 'Copied!' : 'Share'}
            </button>
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
