import React, { useState } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import Icon from '../Icon'
import SuggestPlayerEditModal from '../modals/SuggestPlayerEditModal'
import './PlayerCard.css'

function PlayerCard({ player: initialPlayer, showBadge = false, onTeamClick = null, customOnClick = null, onDeleteSuccess = null }) {
  const navigate = useNavigate()
  const { user } = useAuth()
  const [showEditModal, setShowEditModal] = useState(false)
  const [player, setPlayer] = useState(initialPlayer)
  const [isDeleted, setIsDeleted] = useState(false)

  // Check if user is authenticated and if admin
  const isAuthenticated = !!user
  const isAdmin = user && ['admin', 'superadmin', 'data_admin'].includes(user.role)

  const handlePlayerUpdated = (updatedPlayer) => {
    setPlayer(updatedPlayer)
  }

  const handleDeleteSuccess = (playerId) => {
    setIsDeleted(true)
    setShowEditModal(false)
    if (onDeleteSuccess) {
      onDeleteSuccess(playerId)
    }
  }

  // Don't render if player was deleted
  if (isDeleted) {
    return null
  }

  const handlePlayerClick = () => {
    if (customOnClick) {
      customOnClick()
    } else {
      navigate(`/players/${player.player_id}`)
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
      
      <div className="playercard-header-row">
        <div className="playercard-header-content">
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
        </div>

        {/* Display Card Image */}
        {player.display_card_front_image && (
          <div className="playercard-image-inline">
            <img
              src={player.display_card_front_image}
              alt={`${player.first_name} ${player.last_name}`}
              className="playercard-display-image"
            />
          </div>
        )}
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
      
      {isAuthenticated && (
        <button
          className="playercard-edit-btn"
          onClick={(e) => {
            e.preventDefault()
            e.stopPropagation()
            setShowEditModal(true)
          }}
          title={isAdmin ? "Edit player" : "Suggest changes to this player"}
        >
          <Icon name="edit" size={14} />
        </button>
      )}
    </div>
    
    {/* Edit Modal - Rendered as Portal */}
    {showEditModal && createPortal(
      <SuggestPlayerEditModal
        player={player}
        teams={player.teams || []}
        isOpen={showEditModal}
        onClose={() => setShowEditModal(false)}
        onSuccess={handlePlayerUpdated}
        onDeleteSuccess={handleDeleteSuccess}
      />,
      document.body
    )}
  </>
  )
}

export default PlayerCard