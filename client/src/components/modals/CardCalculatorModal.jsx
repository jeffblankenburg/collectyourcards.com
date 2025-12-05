/**
 * CardCalculatorModal - Calculate estimated cards from boxes/packs/cards
 * Helps users figure out total card count for a purchase
 */

import { useState, useEffect } from 'react'
import Icon from '../Icon'
import './CardCalculatorModal.css'

const CardCalculatorModal = ({ isOpen, onClose, onApply, initialValue }) => {
  const [boxes, setBoxes] = useState(1)
  const [packsPerBox, setPacksPerBox] = useState(24)
  const [cardsPerPack, setCardsPerPack] = useState(10)

  // Reset values when modal opens
  useEffect(() => {
    if (isOpen) {
      setBoxes(1)
      setPacksPerBox(24)
      setCardsPerPack(10)
    }
  }, [isOpen])

  const totalCards = boxes * packsPerBox * cardsPerPack

  const handleApply = () => {
    onApply(totalCards)
    onClose()
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      handleApply()
    } else if (e.key === 'Escape') {
      onClose()
    }
  }

  if (!isOpen) return null

  return (
    <div className="card-calc-overlay" onClick={onClose}>
      <div className="card-calc-modal" onClick={(e) => e.stopPropagation()} onKeyDown={handleKeyDown}>
        <div className="card-calc-header">
          <div className="card-calc-title">
            <Icon name="calculator" size={20} />
            <h3>Card Count Calculator</h3>
          </div>
          <button className="card-calc-close" onClick={onClose}>
            <Icon name="x" size={18} />
          </button>
        </div>

        <div className="card-calc-body">
          <div className="card-calc-fields">
            <div className="card-calc-field">
              <label>Boxes</label>
              <input
                type="number"
                min="1"
                value={boxes}
                onChange={(e) => setBoxes(Math.max(1, parseInt(e.target.value) || 1))}
                autoFocus
              />
            </div>

            <div className="card-calc-operator">×</div>

            <div className="card-calc-field">
              <label>Packs/Box</label>
              <input
                type="number"
                min="1"
                value={packsPerBox}
                onChange={(e) => setPacksPerBox(Math.max(1, parseInt(e.target.value) || 1))}
              />
            </div>

            <div className="card-calc-operator">×</div>

            <div className="card-calc-field">
              <label>Cards/Pack</label>
              <input
                type="number"
                min="1"
                value={cardsPerPack}
                onChange={(e) => setCardsPerPack(Math.max(1, parseInt(e.target.value) || 1))}
              />
            </div>

            <div className="card-calc-operator">=</div>

            <div className="card-calc-result">
              <label>Total Cards</label>
              <div className="card-calc-total">{totalCards.toLocaleString()}</div>
            </div>
          </div>

          <div className="card-calc-presets">
            <span className="card-calc-presets-label">Common configurations:</span>
            <div className="card-calc-preset-buttons">
              <button
                type="button"
                className="card-calc-preset"
                onClick={() => { setBoxes(1); setPacksPerBox(24); setCardsPerPack(10); }}
              >
                Hobby (24×10)
              </button>
              <button
                type="button"
                className="card-calc-preset"
                onClick={() => { setBoxes(1); setPacksPerBox(10); setCardsPerPack(14); }}
              >
                Jumbo (10×14)
              </button>
              <button
                type="button"
                className="card-calc-preset"
                onClick={() => { setBoxes(1); setPacksPerBox(6); setCardsPerPack(12); }}
              >
                Blaster (6×12)
              </button>
              <button
                type="button"
                className="card-calc-preset"
                onClick={() => { setBoxes(1); setPacksPerBox(1); setCardsPerPack(67); }}
              >
                Hanger (67)
              </button>
              <button
                type="button"
                className="card-calc-preset"
                onClick={() => { setBoxes(1); setPacksPerBox(3); setCardsPerPack(50); }}
              >
                Mega (3×50)
              </button>
              <button
                type="button"
                className="card-calc-preset"
                onClick={() => { setBoxes(1); setPacksPerBox(1); setCardsPerPack(30); }}
              >
                Cello (30)
              </button>
            </div>
          </div>
        </div>

        <div className="card-calc-footer">
          <button type="button" className="card-calc-cancel" onClick={onClose}>
            Cancel
          </button>
          <button type="button" className="card-calc-apply" onClick={handleApply}>
            <Icon name="check" size={16} />
            Apply ({totalCards.toLocaleString()} cards)
          </button>
        </div>
      </div>
    </div>
  )
}

export default CardCalculatorModal
