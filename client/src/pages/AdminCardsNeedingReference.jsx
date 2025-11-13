import React, { useState, useEffect } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import axios from 'axios'
import { useToast } from '../contexts/ToastContext'
import Icon from '../components/Icon'
import ImageEditor from '../components/ImageEditor'
import './AdminSets.css'
import './AdminCardsScoped.css'
import '../components/UniversalCardTable.css'

function AdminCardsNeedingReference() {
  const navigate = useNavigate()
  const [cards, setCards] = useState([])
  const [loading, setLoading] = useState(true)
  const [totalCards, setTotalCards] = useState(0)
  const [expandedCardId, setExpandedCardId] = useState(null)
  const [communityImages, setCommunityImages] = useState({})
  const [loadingImages, setLoadingImages] = useState({})
  const [showImageEditor, setShowImageEditor] = useState(false)
  const [selectedImageForEdit, setSelectedImageForEdit] = useState(null)
  const [currentCardIdForAssignment, setCurrentCardIdForAssignment] = useState(null)
  const { addToast } = useToast()

  useEffect(() => {
    loadCards()
  }, [])

  const loadCards = async () => {
    try {
      setLoading(true)
      const response = await axios.get('/api/admin/cards/needs-reference', {
        params: {
          limit: 20 // Limit to 20 cards for faster loading
        }
      })
      setCards(response.data.cards || [])
      setTotalCards(response.data.total || 0)
    } catch (error) {
      console.error('Error loading cards:', error)
      addToast(`Failed to load cards: ${error.response?.data?.message || error.message}`, 'error')
    } finally {
      setLoading(false)
    }
  }

  const handleRowClick = async (card) => {
    // Toggle expansion
    if (expandedCardId === card.card_id) {
      setExpandedCardId(null)
      return
    }

    setExpandedCardId(card.card_id)

    // Load community images if not already loaded
    if (!communityImages[card.card_id]) {
      await loadCommunityImages(card.card_id)
    }
  }

  const loadCommunityImages = async (cardId) => {
    try {
      setLoadingImages(prev => ({ ...prev, [cardId]: true }))
      const response = await axios.get(`/api/admin/cards/${cardId}/community-images`)
      setCommunityImages(prev => ({
        ...prev,
        [cardId]: {
          images: response.data.community_images || [],
          currentReference: response.data.current_reference
        }
      }))
    } catch (error) {
      console.error('Error loading community images:', error)
      addToast(`Failed to load images: ${error.response?.data?.message || error.message}`, 'error')
    } finally {
      setLoadingImages(prev => ({ ...prev, [cardId]: false }))
    }
  }

  // Direct assignment - no editing
  const handleDirectAssign = async (cardId, userCardId) => {
    try {
      // Directly assign the user_card as reference (backend will optimize)
      await axios.put(`/api/admin/cards/${cardId}/reference-image`, {
        user_card_id: userCardId
      })

      addToast('Reference image assigned and optimized successfully!', 'success')

      // Remove this card from the list since it now has a reference
      setCards(prev => prev.filter(c => c.card_id !== cardId))
      setTotalCards(prev => prev - 1)
      setExpandedCardId(null)

      // Clear cached images
      setCommunityImages(prev => {
        const updated = { ...prev }
        delete updated[cardId]
        return updated
      })
    } catch (error) {
      console.error('Error assigning reference image:', error)
      addToast(`Failed to assign image: ${error.response?.data?.message || error.message}`, 'error')
    }
  }

  // Edit first workflow - open image editor
  const handleEditFirst = (cardId, userCard) => {
    setCurrentCardIdForAssignment(cardId)
    setSelectedImageForEdit({
      imageUrl: userCard.front_image,
      userCardId: userCard.user_card_id,
      hasFront: !!userCard.front_image,
      hasBack: !!userCard.back_image,
      frontUrl: userCard.front_image,
      backUrl: userCard.back_image
    })
    setShowImageEditor(true)
  }

  const handleImageEditorClose = () => {
    setShowImageEditor(false)
    setSelectedImageForEdit(null)
    setCurrentCardIdForAssignment(null)
  }

  const handleImageEditorSave = async (editedImageBlob) => {
    if (!currentCardIdForAssignment || !editedImageBlob) return

    try {
      // Create FormData to upload the edited image
      const formData = new FormData()
      formData.append('front_image', editedImageBlob, 'edited-image.jpg')

      await axios.put(`/api/admin/cards/${currentCardIdForAssignment}/reference-image`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      })

      addToast('Reference image assigned and optimized successfully!', 'success')

      // Remove this card from the list since it now has a reference
      setCards(prev => prev.filter(c => c.card_id !== currentCardIdForAssignment))
      setTotalCards(prev => prev - 1)
      setExpandedCardId(null)

      // Clear cached images
      setCommunityImages(prev => {
        const updated = { ...prev }
        delete updated[currentCardIdForAssignment]
        return updated
      })

      handleImageEditorClose()
    } catch (error) {
      console.error('Error assigning reference image:', error)
      addToast(`Failed to assign image: ${error.response?.data?.message || error.message}`, 'error')
    }
  }

  if (loading) {
    return (
      <div className="admin-sets-page">
        <div className="loading-state">
          <div className="card-icon-spinner"></div>
          <span>Loading cards...</span>
        </div>
      </div>
    )
  }

  return (
    <div className="admin-sets-page">
      <div className="admin-header">
        <div className="admin-title">
          <Link
            to="/admin"
            className="back-button"
            title="Back to admin dashboard"
          >
            <Icon name="arrow-left" size={24} />
          </Link>
          <Icon name="image" size={32} />
          <h1>Cards Needing Reference Images</h1>
        </div>
      </div>

      <div className="content-area">
        <div className="stats-summary" style={{ marginBottom: '1.5rem', padding: '1rem', background: 'rgba(255,255,255,0.05)', borderRadius: '8px' }}>
          <p style={{ margin: 0, color: 'rgba(255,255,255,0.8)' }}>
            <strong>{totalCards}</strong> cards have user-uploaded photos but no reference image assigned
          </p>
        </div>

        {cards.length === 0 ? (
          <div className="empty-state">
            <Icon name="check-circle" size={48} />
            <p>All cards with photos have reference images assigned!</p>
          </div>
        ) : (
          <div className="cards-table-container">
            <table className="cards-table">
              <thead>
                <tr>
                  <th style={{width: '80px'}}>Year</th>
                  <th style={{width: '20%'}}>Set</th>
                  <th style={{width: '20%'}}>Series</th>
                  <th style={{width: '100px'}}>Card #</th>
                  <th style={{width: '25%'}}>Player</th>
                  <th style={{width: '100px', textAlign: 'center'}}>Photos</th>
                  <th style={{width: '100px', textAlign: 'center'}}>User Cards</th>
                  <th style={{width: '60px'}}></th>
                </tr>
              </thead>
              <tbody>
                {cards.map(card => (
                  <React.Fragment key={card.card_id}>
                    <tr
                      style={{ cursor: 'pointer' }}
                      onClick={() => handleRowClick(card)}
                      className={expandedCardId === card.card_id ? 'expanded' : ''}
                      title="Click to view and assign images"
                    >
                      <td className="center">{card.set.year}</td>
                      <td>{card.set.name}</td>
                      <td>{card.series.name}</td>
                      <td>{card.card_number}</td>
                      <td className="player-cell">
                        {card.player && card.team ? (
                          <div className="player-row">
                            <div
                              className="mini-team-circle"
                              style={{
                                '--primary-color': card.team.primary_color,
                                '--secondary-color': card.team.secondary_color
                              }}
                              title={card.team.name}
                            >
                              {card.team.abbreviation}
                            </div>
                            <span className="player-name">{card.player.name}</span>
                          </div>
                        ) : (
                          <span style={{ color: 'rgba(255,255,255,0.5)', fontStyle: 'italic' }}>No player</span>
                        )}
                      </td>
                      <td className="center">
                        <span style={{
                          background: 'rgba(34, 197, 94, 0.2)',
                          color: '#22c55e',
                          padding: '4px 12px',
                          borderRadius: '12px',
                          fontWeight: '600'
                        }}>
                          {card.photo_count}
                        </span>
                      </td>
                      <td className="center">{card.user_card_count}</td>
                      <td className="action-cell center">
                        <Icon
                          name={expandedCardId === card.card_id ? "chevron-up" : "chevron-down"}
                          size={16}
                        />
                      </td>
                    </tr>
                    {expandedCardId === card.card_id && (
                      <tr className="expanded-row">
                        <td colSpan="8" style={{ padding: 0 }}>
                          <div className="admin-cards-community-images-section" style={{
                            margin: '0',
                            padding: '1.5rem',
                            background: 'rgba(0, 0, 0, 0.2)',
                            borderTop: '1px solid rgba(255, 255, 255, 0.1)'
                          }}>
                            <div className="admin-cards-community-images-header">
                              <span className="admin-cards-community-images-title">
                                Select Reference Image
                              </span>
                            </div>

                            {loadingImages[card.card_id] ? (
                              <div style={{ textAlign: 'center', padding: '2rem', color: 'rgba(255, 255, 255, 0.6)' }}>
                                <div className="card-icon-spinner"></div>
                                <p style={{ marginTop: '1rem' }}>Loading images...</p>
                              </div>
                            ) : communityImages[card.card_id]?.images.length === 0 ? (
                              <div className="admin-cards-no-community-images">
                                <p>No community images available for this card.</p>
                              </div>
                            ) : (
                              <div className="admin-cards-community-images-table">
                                <div className="admin-cards-images-table-header">
                                  <div className="admin-cards-images-col-user">Uploaded By</div>
                                  <div className="admin-cards-images-col-front">Front Image</div>
                                  <div className="admin-cards-images-col-back">Back Image</div>
                                  <div style={{ width: '120px', textAlign: 'center' }}>Actions</div>
                                </div>
                                <div className="admin-cards-images-table-body">
                                  {communityImages[card.card_id]?.images.map((userCard) => (
                                    <div
                                      key={userCard.user_card_id}
                                      className="admin-cards-image-row"
                                      onClick={() => handleDirectAssign(card.card_id, userCard.user_card_id)}
                                      title="Click to assign as reference (no editing)"
                                      style={{ cursor: 'pointer' }}
                                    >
                                      <div className="admin-cards-images-col-user">
                                        <div className="admin-cards-user-info">
                                          <span className="admin-cards-user-email">{userCard.user_email}</span>
                                        </div>
                                      </div>
                                      <div className="admin-cards-images-col-front">
                                        {userCard.front_image ? (
                                          <img src={userCard.front_image} alt="Front" className="admin-cards-thumbnail" />
                                        ) : (
                                          <div className="admin-cards-no-image">No front image</div>
                                        )}
                                      </div>
                                      <div className="admin-cards-images-col-back">
                                        {userCard.back_image ? (
                                          <img src={userCard.back_image} alt="Back" className="admin-cards-thumbnail" />
                                        ) : (
                                          <div className="admin-cards-no-image">No back image</div>
                                        )}
                                      </div>
                                      <div style={{ width: '120px', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                                        <button
                                          onClick={(e) => {
                                            e.stopPropagation()
                                            handleEditFirst(card.card_id, userCard)
                                          }}
                                          style={{
                                            background: 'rgba(59, 130, 246, 0.2)',
                                            border: '1px solid rgba(59, 130, 246, 0.4)',
                                            color: '#3b82f6',
                                            padding: '6px 12px',
                                            borderRadius: '6px',
                                            fontSize: '12px',
                                            fontWeight: '600',
                                            cursor: 'pointer',
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '4px',
                                            whiteSpace: 'nowrap'
                                          }}
                                          title="Edit images before assigning"
                                        >
                                          <Icon name="edit" size={14} />
                                          Edit First
                                        </button>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Image Editor Modal */}
      <ImageEditor
        isOpen={showImageEditor}
        onClose={handleImageEditorClose}
        imageUrl={selectedImageForEdit?.imageUrl}
        onSave={handleImageEditorSave}
        title="Edit & Assign Reference Image"
      />
    </div>
  )
}

export default AdminCardsNeedingReference
