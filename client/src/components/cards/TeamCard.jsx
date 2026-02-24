import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import Icon from '../Icon'
import EditTeamModal from '../modals/EditTeamModal'
import './TeamCard.css'

function TeamCard({ team, showBadge = false, customOnClick = null, onTeamUpdate = null, onDeleteSuccess = null }) {
  const navigate = useNavigate()
  const { user, isAuthenticated } = useAuth()
  const [showEditModal, setShowEditModal] = useState(false)
  const [localTeam, setLocalTeam] = useState(team)
  const [isDeleted, setIsDeleted] = useState(false)

  // Check if user is admin
  const isAdmin = user && ['admin', 'superadmin', 'data_admin'].includes(user.role)

  const handleDeleteSuccess = (teamId) => {
    setIsDeleted(true)
    setShowEditModal(false)
    if (onDeleteSuccess) {
      onDeleteSuccess(teamId)
    }
  }

  // Don't render if team was deleted
  if (isDeleted) {
    return null
  }


  const handleTeamClick = () => {
    if (customOnClick) {
      customOnClick()
    } else {
      navigate(`/teams/${team.team_id}`)
    }
  }

  const handleEditClick = (e) => {
    e.stopPropagation()
    setShowEditModal(true)
  }

  return (
    <>
      <div
        className="teamcard-container"
        onClick={handleTeamClick}
      >
        {showBadge && (
          <div className="teamcard-result-type-badge teamcard-result-type-badge-team">
            <Icon name="shield" size={14} />
            Team
          </div>
        )}

        <div className="teamcard-content">
          <div className="teamcard-header-row">
            <div className="teamcard-name-section">
              <h3 className="teamcard-name">
                {localTeam.name}
              </h3>
              <div className="teamcard-organization-header">
                {localTeam.organization_abbreviation ? (
                  <p className="teamcard-organization-text">{localTeam.organization_abbreviation}</p>
                ) : (
                  <p className="teamcard-organization-text teamcard-organization-placeholder">&nbsp;</p>
                )}
              </div>
            </div>

            <div className="teamcard-circles">
              <div
                className="teamcard-team-circle team-circle-xl"
                style={{
                  background: localTeam.primary_color || '#666',
                  borderColor: localTeam.secondary_color || '#999'
                }}
                title={localTeam.name}
              >
                {localTeam.abbreviation}
              </div>
            </div>
          </div>

          <div className="teamcard-stats">
            <div className="teamcard-count">
              <span className="teamcard-count-number">{(localTeam.card_count || 0).toLocaleString()}</span>
              <span className="teamcard-count-label">Cards</span>
            </div>
            <div className="teamcard-player-count">
              <span className="teamcard-player-count-number">{(localTeam.player_count || 0).toLocaleString()}</span>
              <span className="teamcard-player-count-label">Players</span>
            </div>
          </div>
        </div>

        {/* Edit Button - shown for all authenticated users */}
        {isAuthenticated && (
          <button
            className="teamcard-edit-btn"
            onClick={handleEditClick}
            title={isAdmin ? 'Edit team' : 'Suggest team update'}
          >
            <Icon name="edit" size={14} />
          </button>
        )}
      </div>

      {/* Edit Team Modal */}
      {showEditModal && (
        <EditTeamModal
          isOpen={showEditModal}
          onClose={() => setShowEditModal(false)}
          team={localTeam}
          onSave={(updatedTeam) => {
            // Update local state with the new team data
            if (updatedTeam) {
              setLocalTeam(prev => ({ ...prev, ...updatedTeam }))
              // Also notify parent if callback provided
              if (onTeamUpdate) {
                onTeamUpdate(updatedTeam)
              }
            }
            setShowEditModal(false)
          }}
          onDeleteSuccess={handleDeleteSuccess}
        />
      )}
    </>
  )
}

export default TeamCard