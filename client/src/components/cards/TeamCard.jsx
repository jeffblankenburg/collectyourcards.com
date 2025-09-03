import React from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import Icon from '../Icon'
import './TeamCard.css'

function TeamCard({ team, showBadge = false, customOnClick = null }) {
  const navigate = useNavigate()
  const { user } = useAuth()
  
  // Check if user is admin
  const isAdmin = user && ['admin', 'superadmin', 'data_admin'].includes(user.role)


  const handleTeamClick = () => {
    if (customOnClick) {
      customOnClick()
    } else {
      const slug = `${team.name}`
        .toLowerCase()
        .replace(/[^a-z0-9\s-]/g, '')
        .replace(/\s+/g, '-')
        .replace(/-+/g, '-')
        .trim()
      navigate(`/teams/${slug}`)
    }
  }

  return (
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
        <div className="teamcard-name-section">
          <h3 className="teamcard-name">
            {team.name}
          </h3>
          <div className="teamcard-organization-header">
            {team.organization_abbreviation ? (
              <p className="teamcard-organization-text">{team.organization_abbreviation}</p>
            ) : (
              <p className="teamcard-organization-text teamcard-organization-placeholder">&nbsp;</p>
            )}
          </div>
        </div>
        
        <div className="teamcard-circles">
          <div
            className="teamcard-team-circle"
            style={{
              '--primary-color': team.primary_color || '#666',
              '--secondary-color': team.secondary_color || '#999'
            }}
            title={team.name}
          >
            {team.abbreviation}
          </div>
        </div>

        <div className="teamcard-stats">
          <div className="teamcard-count">
            <span className="teamcard-count-number">{(team.card_count || 0).toLocaleString()}</span>
            <span className="teamcard-count-label">Cards</span>
          </div>
          <div className="teamcard-player-count">
            <span className="teamcard-player-count-number">{(team.player_count || 0).toLocaleString()}</span>
            <span className="teamcard-player-count-label">Players</span>
          </div>
        </div>
      </div>
      
      {/* Admin Edit Button */}
      {isAdmin && (
        <button 
          className="teamcard-admin-edit-btn"
          onClick={(e) => {
            e.stopPropagation()
            navigate(`/admin/teams?search=${encodeURIComponent(team.name)}`)
          }}
          title="Edit team (Admin)"
        >
          <Icon name="edit" size={14} />
        </button>
      )}
    </div>
  )
}

export default TeamCard