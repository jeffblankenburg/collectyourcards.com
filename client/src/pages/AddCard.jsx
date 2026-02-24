import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { useToast } from '../contexts/ToastContext'
import PlayerSearchPanel from '../components/addcard/PlayerSearchPanel'
import CardBrowserGrid from '../components/addcard/CardBrowserGrid'
import QuickAddModal from '../components/addcard/QuickAddModal'
import SubmitNewCardForm from '../components/addcard/SubmitNewCardForm'
import './AddCardScoped.css'

/**
 * AddCard - Player-first card discovery and collection flow
 *
 * Flow:
 * 1. Search for player
 * 2. Browse player's cards in visual grid
 * 3. Add existing card to collection OR submit new card
 */
export default function AddCard() {
  const { user } = useAuth()
  const { addToast } = useToast()

  // UI State
  const [selectedPlayer, setSelectedPlayer] = useState(null)
  const [showSubmitForm, setShowSubmitForm] = useState(false)
  const [showQuickAddModal, setShowQuickAddModal] = useState(false)
  const [selectedCard, setSelectedCard] = useState(null)

  // Handle player selection
  const handlePlayerSelect = (player) => {
    setSelectedPlayer(player)
    setShowSubmitForm(false) // Reset to grid view
  }

  // Handle clearing player selection
  const handleClearPlayer = () => {
    setSelectedPlayer(null)
    setShowSubmitForm(false)
    setSelectedCard(null)
    setShowQuickAddModal(false)
  }

  // Handle clicking "Add" on a card
  const handleAddCard = (card) => {
    setSelectedCard(card)
    setShowQuickAddModal(true)
  }

  // Handle closing quick add modal
  const handleCloseQuickAdd = () => {
    setShowQuickAddModal(false)
    setSelectedCard(null)
  }

  // Handle successful card add
  const handleAddSuccess = (result) => {
    setShowQuickAddModal(false)
    setSelectedCard(null)
    addToast('Card added to your collection!', 'success')
  }

  // Handle "Can't find my card" click
  const handleCantFind = () => {
    setShowSubmitForm(true)
  }

  // Handle submit form cancel
  const handleSubmitCancel = () => {
    setShowSubmitForm(false)
  }

  // Handle successful new card submission
  const handleSubmitSuccess = (result) => {
    setShowSubmitForm(false)
    addToast('Card submitted for review!', 'success')
  }

  return (
    <div className="add-card-page">
      <div className="add-card-container">
        {/* Header */}
        <div className="add-card-header">
          <Link to="/collection" className="add-card-back-link">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="15 18 9 12 15 6"></polyline>
            </svg>
            Back
          </Link>
          <h1>Add a Card</h1>
          <p className="add-card-subtitle">
            Search for a player to find their cards in our database
          </p>
        </div>

        <div className="add-card-content">
          {/* Step 1: Player Search */}
          <PlayerSearchPanel
            onSelect={handlePlayerSelect}
            selectedPlayer={selectedPlayer}
            onClearSelection={handleClearPlayer}
          />

          {/* Step 2: Card Browser or Submit Form */}
          {selectedPlayer && (
            <div className="add-card-step-2">
              {showSubmitForm ? (
                <SubmitNewCardForm
                  player={selectedPlayer}
                  onSuccess={handleSubmitSuccess}
                  onCancel={handleSubmitCancel}
                />
              ) : (
                <CardBrowserGrid
                  player={selectedPlayer}
                  onAddClick={handleAddCard}
                  onCantFind={handleCantFind}
                />
              )}
            </div>
          )}
        </div>
      </div>

      {/* Quick Add Modal */}
      {showQuickAddModal && selectedCard && (
        <QuickAddModal
          card={selectedCard}
          onClose={handleCloseQuickAdd}
          onSuccess={handleAddSuccess}
        />
      )}
    </div>
  )
}
