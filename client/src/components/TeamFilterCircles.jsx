import React from 'react'
import './TeamFilterCircles.css'

const TeamFilterCircles = ({ teams, selectedTeamIds, onTeamFilter, compact = false }) => {
  const handleTeamClick = (teamId) => {
    let newSelectedIds
    if (selectedTeamIds.includes(teamId)) {
      // Remove team from selection
      newSelectedIds = selectedTeamIds.filter(id => id !== teamId)
    } else {
      // Add team to selection
      newSelectedIds = [...selectedTeamIds, teamId]
    }
    onTeamFilter(newSelectedIds)
  }

  const clearAllFilters = () => {
    onTeamFilter([])
  }

  if (!teams || teams.length === 0) {
    return (
      <div className="team-filter-empty">
        <p>No team data available</p>
      </div>
    )
  }

  return (
    <div className={`team-filter-circles ${compact ? 'compact' : ''}`}>
      <div className="team-circles-container">
        {teams.map(team => {
          const isSelected = selectedTeamIds.includes(team.team_id)
          
          return (
            <div
              key={team.team_id}
              className={`team-circle ${isSelected ? 'selected' : ''}`}
              onClick={() => handleTeamClick(team.team_id)}
              title={team.name}
              style={{
                '--primary-color': team.primary_color || '#666',
                '--secondary-color': team.secondary_color || '#999'
              }}
            >
              <div className="team-circle-inner">
                <span className="team-abbreviation">
                  {team.abbreviation}
                </span>
              </div>
              <div className="team-card-count">
                {team.card_count}
              </div>
            </div>
          )
        })}
      </div>
      
      {selectedTeamIds.length > 0 && (
        <div className="team-filter-actions">
          <button 
            className="clear-filters-btn"
            onClick={clearAllFilters}
            title="Clear all team filters"
          >
            Clear Filters ({selectedTeamIds.length})
          </button>
        </div>
      )}
    </div>
  )
}

export default TeamFilterCircles