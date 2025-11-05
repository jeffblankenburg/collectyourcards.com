import React, { useState } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import Icon from '../Icon'
import EditPlayerModal from '../modals/EditPlayerModal'
import './PlayerCard.css'

function PlayerCard({ player, showBadge = false, onTeamClick = null, customOnClick = null }) {
  const navigate = useNavigate()
  const { user } = useAuth()
  const [showEditModal, setShowEditModal] = useState(false)
  
  // Check if user is admin
  const isAdmin = user && ['admin', 'superadmin', 'data_admin'].includes(user.role)

  const handlePlayerClick = () => {
    if (customOnClick) {
      customOnClick()
    } else {
      const slug = `${player.first_name}-${player.last_name}`
        .toLowerCase()
        .replace(/[^a-z0-9\s-]/g, '')
        .replace(/\s+/g, '-')
        .replace(/-+/g, '-')
        .trim()
      navigate(`/players/${slug}`)
    }
  }

  const handleTeamClick = (e, teamId) => {
    e.stopPropagation()
    if (onTeamClick) {
      onTeamClick(teamId)
    } else {
      // Default team navigation
      navigate(`/teams/${teamId}`)
    }
  }

  return (
    <>
    <div 
      className="playercard-container"
      onClick={handlePlayerClick}
    >
      {showBadge && (
        <div className="playercard-result-type-badge playercard-result-type-badge-player">
          <Icon name="user" size={14} />
          Player
        </div>
      )}
      
      <div className="playercard-content">
        <div className="playercard-name-section">
          <h3 className="playercard-name">
            {player.first_name} {player.last_name}
            {player.is_hof && (
              <Icon name="crown" size={16} className="playercard-hof-icon" title="Hall of Fame" />
            )}
          </h3>
          <div className="playercard-nickname-header">
            {player.nick_name ? (
              <p className="playercard-nickname-text">"{player.nick_name}"</p>
            ) : (
              <p className="playercard-nickname-placeholder">&nbsp;</p>
            )}
          </div>
        </div>
        
        <div className="playercard-teams">
          {player.teams?.map(team => (
            <div
              key={team.team_id}
              className="playercard-team-circle"
              style={{
                '--primary-color': team.primary_color || '#666',
                '--secondary-color': team.secondary_color || '#999'
              }}
              title={`${team.name} (${team.card_count || 0} cards)`}
              onClick={(e) => handleTeamClick(e, team.team_id)}
            >
              {team.abbreviation}
            </div>
          ))}
        </div>
        <div className="playercard-stats">
          <div className="playercard-count">
            <span className="playercard-count-number">{(player.card_count || 0).toLocaleString()}</span>
            <span className="playercard-count-label">Cards</span>
          </div>
          <div className="playercard-rc-count">
            <span className="playercard-rc-count-number">{(player.rookie_count || 0).toLocaleString()}</span>
            <span className="playercard-rc-count-label">Rookies</span>
          </div>
          {/* User Collection Stats for Authenticated Users */}
          {user && player.user_card_count !== undefined && (
            <div className="playercard-user-collection">
              <span className="playercard-user-collection-number">{(player.user_card_count || 0).toLocaleString()}</span>
              <span className="playercard-user-collection-label">Owned</span>
            </div>
          )}
        </div>
      </div>
      
      {isAdmin && (
        <button 
          className="playercard-admin-edit-btn"
          onClick={(e) => {
            e.preventDefault()
            e.stopPropagation()
            console.log('Edit button clicked for player:', player)
            setShowEditModal(true)
          }}
          title="Edit player (Admin)"
        >
          <Icon name="edit" size={14} />
        </button>
      )}
    </div>
    
    {/* Edit Modal - Rendered as Portal */}
    {showEditModal && createPortal(
      <>
        {console.log('Rendering EditPlayerModal for:', player)}
        <EditPlayerModal
          player={player}
          isOpen={showEditModal}
          onClose={() => {
            console.log('Modal close called')
            setShowEditModal(false)
          }}
          onSave={() => {
            console.log('Modal save called')
            setShowEditModal(false)
            // Optionally reload data here if needed
          }}
        />
      </>,
      document.body
    )}
  </>
  )
}

export default PlayerCard