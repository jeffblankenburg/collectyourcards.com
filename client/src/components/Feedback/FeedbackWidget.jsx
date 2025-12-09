import { useState } from 'react'
import { MessageSquarePlus } from 'lucide-react'
import FeedbackModal from './FeedbackModal'
import './FeedbackWidget.css'

/**
 * Floating feedback widget that appears on all pages
 * Opens the feedback modal when clicked
 */
function FeedbackWidget() {
  const [isModalOpen, setIsModalOpen] = useState(false)

  const handleOpenModal = () => {
    setIsModalOpen(true)
  }

  const handleCloseModal = () => {
    setIsModalOpen(false)
  }

  return (
    <>
      {/* Floating tab button */}
      <button
        className="feedback-widget-tab"
        onClick={handleOpenModal}
        aria-label="Send feedback"
        title="Send feedback"
      >
        <MessageSquarePlus size={20} />
        <span className="feedback-widget-tab-label">Feedback</span>
      </button>

      {/* Feedback modal */}
      {isModalOpen && (
        <FeedbackModal onClose={handleCloseModal} />
      )}
    </>
  )
}

export default FeedbackWidget
