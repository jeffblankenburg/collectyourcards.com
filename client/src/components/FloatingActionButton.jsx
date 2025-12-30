import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { useIsMobile } from '../hooks/useIsMobile'
import { useHaptic } from '../hooks/useHaptic'
import Icon from './Icon'
import './FloatingActionButton.css'

/**
 * FloatingActionButton - Quick action button for mobile
 *
 * Shows a floating + button that expands to reveal quick actions:
 * - Scan card (barcode scanner)
 * - Search & add
 * - Quick add (manual entry)
 */
function FloatingActionButton({ onQuickAdd, onScanCard }) {
  const [isOpen, setIsOpen] = useState(false)
  const { isAuthenticated } = useAuth()
  const isMobile = useIsMobile(768)
  const navigate = useNavigate()
  const haptic = useHaptic()

  // Only show on mobile and for authenticated users
  if (!isMobile || !isAuthenticated) {
    return null
  }

  const handleToggle = () => {
    haptic.light()
    setIsOpen(!isOpen)
  }

  const handleAction = (action) => {
    haptic.medium()
    setIsOpen(false)

    switch (action) {
      case 'search':
        navigate('/collection?search=true')
        break
      case 'scan':
        if (onScanCard) {
          onScanCard()
        }
        break
      case 'quick-add':
        if (onQuickAdd) {
          onQuickAdd()
        }
        break
      default:
        break
    }
  }

  return (
    <div className={`fab-container ${isOpen ? 'open' : ''}`}>
      {/* Backdrop */}
      {isOpen && (
        <div
          className="fab-backdrop"
          onClick={() => setIsOpen(false)}
        />
      )}

      {/* Action Menu */}
      <div className={`fab-menu ${isOpen ? 'visible' : ''}`}>
        <button
          className="fab-menu-item"
          onClick={() => handleAction('search')}
          aria-label="Search and add card"
        >
          <span className="fab-menu-label">Search</span>
          <div className="fab-menu-icon">
            <Icon name="search" size={20} />
          </div>
        </button>

        {onScanCard && (
          <button
            className="fab-menu-item"
            onClick={() => handleAction('scan')}
            aria-label="Scan card barcode"
          >
            <span className="fab-menu-label">Scan</span>
            <div className="fab-menu-icon">
              <Icon name="camera" size={20} />
            </div>
          </button>
        )}

        {onQuickAdd && (
          <button
            className="fab-menu-item"
            onClick={() => handleAction('quick-add')}
            aria-label="Quick add card"
          >
            <span className="fab-menu-label">Quick Add</span>
            <div className="fab-menu-icon">
              <Icon name="plus" size={20} />
            </div>
          </button>
        )}
      </div>

      {/* Main FAB Button */}
      <button
        className={`fab-button ${isOpen ? 'active' : ''}`}
        onClick={handleToggle}
        aria-label={isOpen ? 'Close menu' : 'Add card'}
        aria-expanded={isOpen}
      >
        <Icon name={isOpen ? 'close' : 'plus'} size={28} />
      </button>
    </div>
  )
}

export default FloatingActionButton
