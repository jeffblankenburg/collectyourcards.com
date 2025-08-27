import React from 'react'
import { useNavigate } from 'react-router-dom'
import Icon from '../Icon'
import './CardResult.css'

function CardResult({ card, showBadge = false }) {
  const navigate = useNavigate()

  const handleCardClick = () => {
    navigate(`/series/${card.series_id}`)
  }

  return (
    <div 
      className="card-base card-interactive" 
      onClick={handleCardClick}
    >
      {showBadge && (
        <div className="result-type-badge card">
          <Icon name="card" size={14} />
          Card
        </div>
      )}
      
      <div className="card-result-content">
        <div className="card-info">
          <h3 className="card-number">#{card.card_number}</h3>
          <p className="card-player">{card.player_name || 'Unknown Player'}</p>
          <p className="card-series">{card.series_name}</p>
        </div>
        
        <div className="card-badges">
          {card.is_rookie && <span className="badge badge-rookie">RC</span>}
          {card.is_autograph && <span className="badge badge-auto">Auto</span>}
          {card.is_relic && <span className="badge badge-relic">Relic</span>}
          {card.print_run && <span className="badge badge-hof">/{card.print_run}</span>}
        </div>
      </div>
    </div>
  )
}

export default CardResult