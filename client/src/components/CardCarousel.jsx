import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import axios from 'axios'
import './CardCarousel.css'

/**
 * CardCarousel - Infinite scrolling carousel of random card images
 *
 * Features:
 * - Displays random card images from any user upload
 * - Infinite scroll animation without visible reset
 * - Clickable cards navigate to card detail page
 * - Only shows card fronts
 */
const CardCarousel = () => {
  const [cards, setCards] = useState([])
  const [loading, setLoading] = useState(true)
  const navigate = useNavigate()

  useEffect(() => {
    const fetchCarouselCards = async () => {
      try {
        const response = await axios.get('/api/cards/carousel?limit=20')
        if (response.data.success) {
          setCards(response.data.cards)
        }
      } catch (error) {
        console.error('Error fetching carousel cards:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchCarouselCards()
  }, [])

  const handleCardClick = (card) => {
    navigate(card.url)
  }

  if (loading || cards.length === 0) {
    return null // Don't show carousel if no cards loaded
  }

  // Duplicate the cards array to create seamless infinite scroll
  // We need 3x the content to ensure smooth looping
  const triplicatedCards = [...cards, ...cards, ...cards]

  return (
    <div className="card-carousel-container">
      <div className="card-carousel-track">
        {triplicatedCards.map((card, index) => (
          <div
            key={`${card.card_id}-${index}`}
            className="card-carousel-item"
            onClick={() => handleCardClick(card)}
            title={`${card.player_name} - ${card.series_name} #${card.card_number}`}
          >
            <img
              src={card.photo_url}
              alt={`${card.player_name} - ${card.card_number}`}
              className="card-carousel-image"
            />
          </div>
        ))}
      </div>
    </div>
  )
}

export default CardCarousel
