import React, { useState, useEffect } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import axios from 'axios'
import { useToast } from '../contexts/ToastContext'
import Icon from '../components/Icon'
import './AdminSets.css'
import '../components/UniversalCardTable.css'

function AdminCardsNeedingReference() {
  const navigate = useNavigate()
  const [cards, setCards] = useState([])
  const [loading, setLoading] = useState(true)
  const [totalCards, setTotalCards] = useState(0)
  const { addToast } = useToast()

  useEffect(() => {
    loadCards()
  }, [])

  const loadCards = async () => {
    try {
      setLoading(true)
      const response = await axios.get('/api/admin/cards/needs-reference', {
        params: {
          limit: 1000 // Get a large batch for now
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

  const handleCardClick = (card) => {
    // Navigate to the admin cards page for this series with a query param to load by series ID
    navigate(`/admin/cards?series=${card.series.series_id}`)
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
                  <th style={{width: '25%'}}>Set</th>
                  <th style={{width: '25%'}}>Series</th>
                  <th style={{width: '120px'}}>Card #</th>
                  <th style={{width: '100px', textAlign: 'center'}}>Photos</th>
                  <th style={{width: '100px', textAlign: 'center'}}>User Cards</th>
                  <th style={{width: '100px'}}></th>
                </tr>
              </thead>
              <tbody>
                {cards.map(card => (
                  <tr
                    key={card.card_id}
                    style={{ cursor: 'pointer' }}
                    onDoubleClick={() => handleCardClick(card)}
                    title="Double-click to edit this card"
                  >
                    <td className="center">{card.set.year}</td>
                    <td>{card.set.name}</td>
                    <td>{card.series.name}</td>
                    <td>{card.card_number}</td>
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
                      <button
                        className="edit-btn"
                        onClick={(e) => {
                          e.stopPropagation()
                          handleCardClick(card)
                        }}
                        title="Assign reference image"
                      >
                        <Icon name="image" size={16} />
                        Assign
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}

export default AdminCardsNeedingReference
