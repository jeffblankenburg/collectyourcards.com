import React from 'react'
import Icon from '../Icon'
import './ModalStyles.css'
import './ConfirmModal.css'

/**
 * ConfirmModal - Reusable confirmation dialog
 *
 * Props:
 * - isOpen: boolean - Whether modal is visible
 * - onClose: function - Called when modal is closed (cancel/escape/backdrop click)
 * - onConfirm: function - Called when confirm button is clicked
 * - title: string - Modal title
 * - message: string|node - Main message/description
 * - confirmText: string - Text for confirm button (default: "Confirm")
 * - cancelText: string - Text for cancel button (default: "Cancel")
 * - confirmVariant: string - "danger" | "warning" | "primary" (default: "primary")
 * - icon: string - Icon name for header (default: "alert-triangle")
 * - loading: boolean - Show loading state on confirm button
 */
function ConfirmModal({
  isOpen,
  onClose,
  onConfirm,
  title = 'Confirm Action',
  message = 'Are you sure you want to proceed?',
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  confirmVariant = 'primary',
  icon = 'alert-triangle',
  loading = false
}) {
  if (!isOpen) return null

  const handleBackdropClick = (e) => {
    if (e.target === e.currentTarget) {
      onClose()
    }
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Escape') {
      onClose()
    }
  }

  React.useEffect(() => {
    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown)
      return () => document.removeEventListener('keydown', handleKeyDown)
    }
  }, [isOpen])

  return (
    <div className="modal-overlay" onClick={handleBackdropClick}>
      <div className="modal-content confirm-modal">
        <div className="modal-header">
          <h3>
            <Icon name={icon} size={20} />
            {title}
          </h3>
          <button className="modal-close-btn" onClick={onClose} disabled={loading}>
            <Icon name="x" size={18} />
          </button>
        </div>

        <div className="confirm-modal-body">
          {typeof message === 'string' ? <p>{message}</p> : message}
        </div>

        <div className="modal-actions confirm-modal-actions">
          <button
            className="btn-cancel"
            onClick={onClose}
            disabled={loading}
          >
            <Icon name="x" size={16} />
            {cancelText}
          </button>
          <button
            className={`btn-confirm btn-${confirmVariant}`}
            onClick={onConfirm}
            disabled={loading}
          >
            {loading ? (
              <>
                <Icon name="loader" size={16} className="spinner" />
                Processing...
              </>
            ) : (
              <>
                <Icon name="check" size={16} />
                {confirmText}
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}

export default ConfirmModal
