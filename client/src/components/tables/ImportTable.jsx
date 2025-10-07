import React, { useState, useMemo } from 'react'
import axios from 'axios'
import { useToast } from '../../contexts/ToastContext'
import Icon from '../Icon'
import './ImportTableScoped.css'

/**
 * ImportTable - Enhanced import review with granular player/team/player_team matching
 * 
 * Features:
 * - Separate validation for players, teams, and player_team combinations
 * - Fuzzy matching suggestions for typos
 * - Dynamic record creation buttons
 * - RC status toggle per card
 * - Detailed validation status indicators
 */
const ImportTable = ({
  cards = [],
  loading = false,
  onCardUpdate = null,
  organizationId = null,
  showSearch = true,
  searchQuery = '',
  onSearchChange = null,
  maxHeight = '600px'
}) => {
  const { showToast } = useToast()
  const [sortField, setSortField] = useState('sortOrder')
  const [sortDirection, setSortDirection] = useState('asc')
  const [expandedCards, setExpandedCards] = useState(new Set())
  
  const handleNotesChange = (cardIndex, newNotes) => {
    if (onCardUpdate) {
      const updatedCards = [...cards]
      updatedCards[cardIndex].notes = newNotes
      onCardUpdate(updatedCards)
    }
  }
  
  // Filter cards based on search query
  const filteredCards = useMemo(() => {
    if (!searchQuery.trim()) return cards
    
    const query = searchQuery.toLowerCase()
    return cards.filter(card => {
      if (card.cardNumber?.toLowerCase().includes(query)) return true
      if (card.playerNames?.toLowerCase().includes(query)) return true
      if (card.teamNames?.toLowerCase().includes(query)) return true
      if (card.notes?.toLowerCase().includes(query)) return true
      return false
    })
  }, [cards, searchQuery])

  // Sort filtered cards
  const sortedCards = useMemo(() => {
    const sorted = [...filteredCards].sort((a, b) => {
      let aVal = a[sortField]
      let bVal = b[sortField]

      if (sortField === 'sortOrder') {
        return sortDirection === 'asc' ? aVal - bVal : bVal - aVal
      } else if (sortField === 'cardNumber') {
        const aNum = parseInt(a.cardNumber)
        const bNum = parseInt(b.cardNumber)
        
        if (!isNaN(aNum) && !isNaN(bNum) && 
            a.cardNumber === aNum.toString() && 
            b.cardNumber === bNum.toString()) {
          return sortDirection === 'asc' ? aNum - bNum : bNum - aNum
        } else {
          aVal = String(a.cardNumber || '').toLowerCase()
          bVal = String(b.cardNumber || '').toLowerCase()
        }
      }

      if (typeof aVal !== 'number') {
        aVal = String(aVal || '').toLowerCase()
        bVal = String(bVal || '').toLowerCase()
        if (aVal < bVal) return sortDirection === 'asc' ? -1 : 1
        if (aVal > bVal) return sortDirection === 'asc' ? 1 : -1
      }
      
      return 0
    })

    return sorted
  }, [filteredCards, sortField, sortDirection])

  const handleSort = (field) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc')
    } else {
      setSortField(field)
      setSortDirection('asc')
    }
  }

  const toggleCardExpansion = (cardIndex) => {
    const newExpanded = new Set(expandedCards)
    if (newExpanded.has(cardIndex)) {
      newExpanded.delete(cardIndex)
    } else {
      newExpanded.add(cardIndex)
    }
    setExpandedCards(newExpanded)
  }

  const handleRCToggle = (cardSortOrder) => {
    if (onCardUpdate) {
      const cardIndex = cards.findIndex(card => card.sortOrder === cardSortOrder)
      if (cardIndex === -1) return
      
      const updatedCards = [...cards]
      updatedCards[cardIndex].isRC = !updatedCards[cardIndex].isRC
      onCardUpdate(updatedCards)
    }
  }

  const handleAutographToggle = (cardSortOrder) => {
    if (onCardUpdate) {
      const cardIndex = cards.findIndex(card => card.sortOrder === cardSortOrder)
      if (cardIndex === -1) return
      
      const updatedCards = [...cards]
      updatedCards[cardIndex].isAutograph = !updatedCards[cardIndex].isAutograph
      onCardUpdate(updatedCards)
    }
  }

  const handleRelicToggle = (cardSortOrder) => {
    if (onCardUpdate) {
      const cardIndex = cards.findIndex(card => card.sortOrder === cardSortOrder)
      if (cardIndex === -1) return
      
      const updatedCards = [...cards]
      updatedCards[cardIndex].isRelic = !updatedCards[cardIndex].isRelic
      onCardUpdate(updatedCards)
    }
  }

  const handleToggleAllRC = () => {
    if (onCardUpdate) {
      const currentlyAllRC = cards.every(card => card.isRC)
      const updatedCards = cards.map(card => ({
        ...card,
        isRC: !currentlyAllRC
      }))
      onCardUpdate(updatedCards)
    }
  }

  const handleToggleAllAutograph = () => {
    if (onCardUpdate) {
      const currentlyAllAutograph = cards.every(card => card.isAutograph)
      const updatedCards = cards.map(card => ({
        ...card,
        isAutograph: !currentlyAllAutograph
      }))
      onCardUpdate(updatedCards)
    }
  }

  const handleToggleAllRelic = () => {
    if (onCardUpdate) {
      const currentlyAllRelic = cards.every(card => card.isRelic)
      const updatedCards = cards.map(card => ({
        ...card,
        isRelic: !currentlyAllRelic
      }))
      onCardUpdate(updatedCards)
    }
  }

  const handlePlayerSelection = async (cardSortOrder, playerIndex, playerId) => {
    if (onCardUpdate) {
      const cardIndex = cards.findIndex(card => card.sortOrder === cardSortOrder)
      if (cardIndex === -1) return
      
      const updatedCards = [...cards]
      const player = updatedCards[cardIndex].players[playerIndex]
      const selectedPlayer = player.playerMatches?.exact?.find(p => p.playerId === playerId) || 
                           player.playerMatches?.fuzzy?.find(p => p.playerId === playerId)
      
      updatedCards[cardIndex].players[playerIndex].selectedPlayer = selectedPlayer
      
      // If player is selected and teams exist, automatically create missing player_team records
      if (selectedPlayer && player.teamMatches?.exact?.length > 0) {
        console.log(`🔗 Player selected: ${selectedPlayer.playerName}, checking for missing player_team records...`)
        
        const playerTeamPromises = []
        
        // Find all teams that this player should be associated with
        const playerTeamNames = player.teamNames || []
        const matchedTeams = playerTeamNames.map(teamName => 
          player.teamMatches.exact.find(match => 
            match.teamName.toLowerCase().includes(teamName.toLowerCase())
          )
        ).filter(team => team)
        
        for (const team of matchedTeams) {
          // Check if player already has this team (from their existing teams)
          const playerAlreadyHasTeam = selectedPlayer.teams?.some(existingTeam => 
            existingTeam.teamId === team.teamId
          )
          
          // Also check if player_team combination already exists in our matches
          const playerTeamExists = player.playerTeamMatches?.some(pt => 
            pt.playerId === selectedPlayer.playerId && pt.teamId === team.teamId
          )
          
          if (playerAlreadyHasTeam) {
            console.log(`⚠️ Player ${selectedPlayer.playerName} already has team ${team.teamName} - skipping creation`)
            
            // Still add it to playerTeamMatches for UI purposes if not already there
            if (!playerTeamExists) {
              if (!player.playerTeamMatches) {
                player.playerTeamMatches = []
              }
              player.playerTeamMatches.push({
                playerTeamId: `existing_${selectedPlayer.playerId}_${team.teamId}`,
                playerId: selectedPlayer.playerId,
                teamId: team.teamId,
                playerName: selectedPlayer.playerName,
                teamName: team.teamName
              })
            }
            continue
          }
          
          if (!playerTeamExists) {
            console.log(`🔗 Creating missing player_team: ${selectedPlayer.playerName} + ${team.teamName}`)
            console.log(`📊 Request data: playerId=${selectedPlayer.playerId} (${typeof selectedPlayer.playerId}), teamId=${team.teamId} (${typeof team.teamId})`)
            
            const playerTeamPromise = axios.post('/api/admin/import/create-player-team', {
              playerId: selectedPlayer.playerId,
              teamId: team.teamId
            }).then(ptResponse => {
              if (ptResponse.data.success) {
                // Ensure playerTeamMatches structure exists
                if (!player.playerTeamMatches) {
                  player.playerTeamMatches = []
                }
                
                // Add the new player-team combination
                player.playerTeamMatches.push(ptResponse.data.playerTeam)
                
                console.log(`✅ Created player_team: ${ptResponse.data.playerTeam.playerName} - ${ptResponse.data.playerTeam.teamName}`)
                return ptResponse.data.playerTeam
              }
            }).catch(ptError => {
              console.error('Error auto-creating player_team:', ptError)
              return null
            })
            
            playerTeamPromises.push(playerTeamPromise)
          }
        }
        
        // Wait for all player_team creations, then update UI
        if (playerTeamPromises.length > 0) {
          Promise.all(playerTeamPromises).then(results => {
            const successfulCreations = results.filter(r => r !== null)
            if (successfulCreations.length > 0) {
              console.log(`✅ Auto-created ${successfulCreations.length} player_team records`)
              if (showToast) {
                showToast(`Auto-created ${successfulCreations.length} player-team combinations`, 'success')
              }
            }
            onCardUpdate([...updatedCards]) // Force re-render after player_team updates
          })
        } else {
          onCardUpdate(updatedCards)
        }
      } else {
        onCardUpdate(updatedCards)
      }
    }
  }

  const isPerfectMatch = (player) => {
    // Check if we have an exact player match AND exact team matches AND player_team records exist
    if (!player.selectedPlayer || !player.teamNames?.length || !player.teamMatches?.exact?.length) {
      return false
    }

    // Verify all team names have exact matches
    const allTeamsMatched = player.teamNames.every(teamName => 
      player.teamMatches.exact.some(match => 
        match.teamName.toLowerCase().includes(teamName.toLowerCase())
      )
    )

    if (!allTeamsMatched) return false

    // Check if player_team records exist for all matched teams
    const matchedTeams = player.teamNames.map(teamName => 
      player.teamMatches.exact.find(match => 
        match.teamName.toLowerCase().includes(teamName.toLowerCase())
      )
    ).filter(team => team)

    const allPlayerTeamsExist = matchedTeams.every(team => 
      player.playerTeamMatches?.some(pt => 
        pt.playerId === player.selectedPlayer.playerId && pt.teamId === team.teamId
      )
    )

    return allPlayerTeamsExist
  }

  const handleTeamSelection = (cardIndex, playerIndex, teamIndex, teamId) => {
    if (onCardUpdate) {
      const updatedCards = [...cards]
      const player = updatedCards[cardIndex].players[playerIndex]

      // Look for team in both exact and fuzzy matches
      const selectedTeam = player.teamMatches.exact?.find(t => t.teamId === teamId) ||
                          player.teamMatches.fuzzy?.find(t => t.teamId === teamId)

      if (selectedTeam) {
        // If team was in fuzzy matches, move it to exact matches
        const wasInFuzzy = player.teamMatches.fuzzy?.some(t => t.teamId === teamId)
        if (wasInFuzzy) {
          // Remove from fuzzy
          player.teamMatches.fuzzy = player.teamMatches.fuzzy.filter(t => t.teamId !== teamId)
          // Add to exact if not already there
          if (!player.teamMatches.exact.some(t => t.teamId === teamId)) {
            player.teamMatches.exact.push(selectedTeam)
          }
        }

        if (!updatedCards[cardIndex].players[playerIndex].selectedTeams) {
          updatedCards[cardIndex].players[playerIndex].selectedTeams = []
        }

        updatedCards[cardIndex].players[playerIndex].selectedTeams[teamIndex] = selectedTeam

        // If player is already selected, try to auto-create player_team record
        if (player.selectedPlayer) {
          const playerId = player.selectedPlayer.playerId
          const teamId = selectedTeam.teamId

          // Check if player_team combination already exists
          const playerTeamExists = player.playerTeamMatches?.some(pt =>
            pt.playerId === playerId && pt.teamId === teamId
          )

          if (!playerTeamExists) {
            console.log(`🔗 Creating player_team for selected fuzzy match: ${player.selectedPlayer.playerName} + ${selectedTeam.teamName}`)

            axios.post('/api/admin/import/create-player-team', {
              playerId: playerId,
              teamId: teamId
            }).then(ptResponse => {
              if (ptResponse.data.success) {
                if (!player.playerTeamMatches) {
                  player.playerTeamMatches = []
                }
                player.playerTeamMatches.push(ptResponse.data.playerTeam)
                console.log(`✅ Created player_team: ${ptResponse.data.playerTeam.playerName} - ${ptResponse.data.playerTeam.teamName}`)

                if (showToast) {
                  showToast(`Created player-team: ${ptResponse.data.playerTeam.playerName} - ${ptResponse.data.playerTeam.teamName}`, 'success')
                }

                // Force re-render after player_team creation
                onCardUpdate([...updatedCards])
              }
            }).catch(ptError => {
              console.error('Error creating player_team:', ptError)
            })
          }
        }

        onCardUpdate(updatedCards)
      }
    }
  }

  const createNewPlayer = async (cardSortOrder, playerIndex, playerName) => {
    try {
      console.log('🔄 Creating new player:', playerName, 'cardSortOrder:', cardSortOrder, 'playerIndex:', playerIndex)
      
      const nameParts = playerName.split(' ')
      const firstName = nameParts[0] || ''
      const lastName = nameParts.slice(1).join(' ') || nameParts[0] || 'Unknown'
      
      console.log('📤 Sending create player request:', { firstName, lastName })
      
      const response = await axios.post('/api/admin/import/create-player', {
        firstName,
        lastName
      })
      
      if (response.data.success) {
        const newPlayerId = response.data.player.playerId
        let createdPlayerTeams = []
        
        // Find the correct card using sortOrder instead of cardIndex
        const cardIndex = cards.findIndex(card => card.sortOrder === cardSortOrder)
        console.log('🔍 Looking for card with sortOrder:', cardSortOrder)
        console.log('🔍 Found cardIndex:', cardIndex)
        console.log('🔍 Total cards in array:', cards.length)
        
        if (cardIndex === -1) {
          console.error('❌ Could not find card with sortOrder:', cardSortOrder)
          console.log('Available sortOrders:', cards.map(c => c.sortOrder))
          if (showToast) {
            showToast('Error: Card not found for player creation', 'error')
          }
          return
        }
        
        // Get current player data before modifying
        const currentPlayer = cards[cardIndex].players[playerIndex]
        console.log('🔍 Current player before update:', currentPlayer)

        // Get card-level teams (all teams from spreadsheet)
        const cardTeams = cards[cardIndex].teamMatches?.exact || []

        // Don't auto-create player_team records - let user select from options in Player Team column

        // Show success toast first, before state updates
        const successMessage = `Created player: ${response.data.player.playerName}`

        if (showToast) {
          showToast(successMessage, 'success')
        }

        // Create new player object (no teams yet)
        const newPlayer = {
          playerId: response.data.player.playerId,
          playerName: response.data.player.playerName,
          firstName: response.data.player.firstName,
          lastName: response.data.player.lastName,
          teams: [] // No teams auto-assigned
        }

        // Use functional update to ensure we get the latest state
        onCardUpdate((prevCards) => {
          // Create new array with updated player
          const updatedCards = [...prevCards]

          // Update ALL cards that have this same player name
          let updatedCount = 0
          updatedCards.forEach((card, cIdx) => {
            card.players?.forEach((player, pIdx) => {
              // Check if this player has the same name as the one we just created
              if (player.name?.toLowerCase() === playerName.toLowerCase() && !player.selectedPlayer) {
                console.log(`🔄 Updating player "${player.name}" on card ${card.sortOrder}`)

                updatedCards[cIdx].players[pIdx] = {
                  ...updatedCards[cIdx].players[pIdx],
                  playerMatches: {
                    exact: [newPlayer], // Set newly created player as exact match
                    fuzzy: []
                  },
                  selectedPlayer: newPlayer, // Set as selected player
                  playerTeamMatches: [], // Empty - no player_team records yet
                  _renderKey: Date.now() // Force React re-render
                }
                updatedCount++
              }
            })
          })

          console.log(`🎯 Updated ${updatedCount} instances of player "${playerName}" across all cards`)

          return updatedCards
        })
      }
    } catch (error) {
      console.error('❌ Error creating player:', error)
      if (showToast) {
        showToast(error.response?.data?.message || 'Failed to create player', 'error')
      }
    }
  }
  
  const hasCompletePlayerMatch = (player) => {
    // Must have a selected player
    if (!player.selectedPlayer) return false
    
    // Must have team names to check against
    if (!player.teamNames || player.teamNames.length === 0) return false
    
    // Check that all team names have exact matches
    const allTeamsMatched = player.teamNames.every(teamName => 
      player.teamMatches?.exact?.some(match => 
        match.teamName.toLowerCase().includes(teamName.toLowerCase())
      )
    )
    
    if (!allTeamsMatched) return false
    
    // Check that player_team combinations exist for the matched teams
    const matchedTeams = player.teamNames.map(teamName => 
      player.teamMatches?.exact?.find(match => 
        match.teamName.toLowerCase().includes(teamName.toLowerCase())
      )
    ).filter(team => team) // Remove any undefined matches
    
    // For each matched team, ensure player_team record exists
    const allPlayerTeamsExist = matchedTeams.every(team => 
      player.playerTeamMatches?.some(pt => 
        pt.playerId === player.selectedPlayer.playerId && pt.teamId === team.teamId
      )
    )
    
    console.log(`🔍 Complete match check for ${player.name}:`, {
      hasSelectedPlayer: !!player.selectedPlayer,
      teamNames: player.teamNames,
      allTeamsMatched,
      matchedTeams: matchedTeams.map(t => t?.teamName),
      playerTeamMatches: player.playerTeamMatches?.map(pt => `${pt.playerName}-${pt.teamName}`),
      allPlayerTeamsExist
    })
    
    return allPlayerTeamsExist
  }

  const getPlayerTeamValidation = (card) => {
    // Check if all players have matches and all teams have matches
    let allPlayersMatched = true
    let allTeamsMatched = true
    let allPlayerTeamsExist = true
    
    card.players?.forEach((player) => {
      // Check player match
      if (!player.selectedPlayer) {
        allPlayersMatched = false
      }
      
      // Check team matches
      player.teamNames?.forEach((teamName) => {
        const hasTeamMatch = player.teamMatches?.exact?.some(match => 
          match.teamName.toLowerCase().includes(teamName.toLowerCase())
        )
        if (!hasTeamMatch) {
          allTeamsMatched = false
        }
      })
      
      // Check player-team combinations if we have both
      if (player.selectedPlayer && player.selectedTeams?.length > 0) {
        player.selectedTeams.forEach(team => {
          if (team) {
            const ptExists = player.playerTeamMatches?.some(
              pt => pt.playerId === player.selectedPlayer.playerId && pt.teamId === team.teamId
            )
            if (!ptExists) {
              allPlayerTeamsExist = false
            }
          }
        })
      }
    })
    
    if (!allPlayersMatched) {
      return <span className="pt-status missing">P</span>
    }
    if (!allTeamsMatched) {
      return <span className="pt-status missing">T</span>
    }
    if (!allPlayerTeamsExist) {
      return <span className="pt-status warning">P-T</span>
    }
    
    return <span className="pt-status ready">✓</span>
  }

  const createNewTeam = async (cardIndex, playerIndex, teamIndex, teamName) => {
    try {
      if (!organizationId) {
        if (showToast) {
          showToast('Organization ID not available - cannot create team', 'error')
        }
        return
      }
      
      const response = await axios.post('/api/admin/import/create-team', {
        teamName: teamName.trim(),
        city: null,
        abbreviation: null,
        organizationId: organizationId
      })
      
      if (response.data.success) {
        const newTeam = response.data.team
        
        if (showToast) {
          showToast(`Created new team: ${newTeam.teamName}`, 'success')
        }
        
        // Update ALL cards that have this team name
        const updatedCards = [...cards]
        let updatedCount = 0
        let playerTeamPromises = []
        
        updatedCards.forEach((card, cardIdx) => {
          card.players.forEach((player, playerIdx) => {
            // Check if this player has the team name we just created
            const hasThisTeam = player.teamNames?.some(name => 
              name.toLowerCase() === teamName.toLowerCase()
            )
            
            if (hasThisTeam) {
              // Ensure teamMatches structure exists
              if (!player.teamMatches) {
                player.teamMatches = { exact: [], fuzzy: [] }
              }
              if (!player.teamMatches.exact) {
                player.teamMatches.exact = []
              }
              
              // Check if team is already in matches (avoid duplicates)
              const teamExists = player.teamMatches.exact.some(team => 
                team.teamId === newTeam.teamId
              )
              
              if (!teamExists) {
                // Add the new team to exact matches
                player.teamMatches.exact.push(newTeam)
                updatedCount++
              }
              
              // For the original card/player, also set it as selected
              if (cardIdx === cardIndex && playerIdx === playerIndex) {
                if (!player.selectedTeams) {
                  player.selectedTeams = []
                }
                player.selectedTeams[teamIndex] = newTeam
              }
              
              // If player is already selected/found, create player_team record
              if (player.selectedPlayer && player.selectedPlayer.playerId) {
                const playerId = player.selectedPlayer.playerId
                const teamId = newTeam.teamId
                
                // Check if player_team combination already exists
                const playerTeamExists = player.playerTeamMatches?.some(pt => 
                  pt.playerId === playerId && pt.teamId === teamId
                )
                
                if (!playerTeamExists) {
                  console.log(`🔗 Creating player_team: ${player.selectedPlayer.playerName} + ${newTeam.teamName}`)
                  
                  // Create player_team record asynchronously
                  const playerTeamPromise = axios.post('/api/admin/import/create-player-team', {
                    playerId: playerId,
                    teamId: teamId
                  }).then(ptResponse => {
                    if (ptResponse.data.success) {
                      // Ensure playerTeamMatches structure exists
                      if (!player.playerTeamMatches) {
                        player.playerTeamMatches = []
                      }
                      
                      // Add the new player-team combination
                      player.playerTeamMatches.push(ptResponse.data.playerTeam)
                      
                      console.log(`✅ Created player_team: ${ptResponse.data.playerTeam.playerName} - ${ptResponse.data.playerTeam.teamName}`)
                      return { cardIdx, playerIdx, playerTeam: ptResponse.data.playerTeam }
                    }
                  }).catch(ptError => {
                    console.error('Error creating player_team:', ptError)
                    return null
                  })
                  
                  playerTeamPromises.push(playerTeamPromise)
                }
              }
            }
          })
        })
        
        console.log(`🔄 Updated ${updatedCount} player entries with new team: ${newTeam.teamName}`)
        
        // Wait for all player_team creations to complete, then update UI
        if (playerTeamPromises.length > 0) {
          Promise.all(playerTeamPromises).then(results => {
            const successfulCreations = results.filter(r => r !== null)
            if (successfulCreations.length > 0) {
              console.log(`✅ Created ${successfulCreations.length} player_team records`)
              if (showToast) {
                showToast(`Created ${successfulCreations.length} player-team combinations for ${newTeam.teamName}`, 'success')
              }
            }
            onCardUpdate([...updatedCards]) // Force re-render after player_team updates
          })
        } else {
          onCardUpdate(updatedCards)
        }
      }
    } catch (error) {
      if (showToast) {
        showToast(error.response?.data?.message || 'Failed to create team', 'error')
      }
    }
  }

  const createPlayerTeam = async (cardIndex, playerIndex, playerId, teamId) => {
    try {
      const response = await axios.post('/api/admin/import/create-player-team', {
        playerId,
        teamId
      })
      
      if (response.data.success) {
        if (showToast) {
          showToast(`Created player-team combination: ${response.data.playerTeam.playerName} - ${response.data.playerTeam.teamName}`, 'success')
        }
        
        // Update the card with the new player_team
        const updatedCards = [...cards]
        const player = updatedCards[cardIndex].players[playerIndex]
        
        // Ensure playerTeamMatches structure exists
        if (!player.playerTeamMatches) {
          player.playerTeamMatches = []
        }
        if (!player.selectedPlayerTeams) {
          player.selectedPlayerTeams = []
        }
        
        // Add the new player-team combination
        player.playerTeamMatches.push(response.data.playerTeam)
        player.selectedPlayerTeams.push(response.data.playerTeam)
        
        onCardUpdate(updatedCards)
      }
    } catch (error) {
      if (showToast) {
        showToast(error.response?.data?.message || 'Failed to create player-team combination', 'error')
      }
    }
  }


  const SortIcon = ({ field }) => {
    if (sortField !== field) return null
    
    return (
      <Icon 
        name={sortDirection === 'asc' ? 'chevron-up' : 'chevron-down'} 
        size={14} 
        className={`import-table-sort-icon ${sortDirection}`}
      />
    )
  }

  if (loading) {
    return (
      <div className="import-table-loading">
        <Icon name="activity" size={24} className="import-table-spinner" />
        <p>Processing import data...</p>
      </div>
    )
  }

  return (
    <div className="import-table-container">
      {/* Table Controls */}
      {showSearch && (
        <div className="import-table-controls">
          <div className="import-table-search-container">
            <input
              type="text"
              placeholder="Search imported cards..."
              value={searchQuery}
              onChange={(e) => onSearchChange?.(e.target.value)}
              className="import-table-search-input"
            />
          </div>
        </div>
      )}

      {/* Table */}
      <div 
        className="import-table-wrapper"
        style={{ 
          maxHeight: maxHeight,
          overflowY: maxHeight === 'none' ? 'hidden' : 'auto'
        }}
      >
        <table className="import-table">
          <thead>
            <tr>
              <th className="expand-header">
                <div className="import-table-header-content">
                  <Icon name="chevron-down" size={14} />
                </div>
              </th>
              <th className="sortable sort-order-header">
                <div className="import-table-header-content" onClick={() => handleSort('sortOrder')}>
                  # <SortIcon field="sortOrder" />
                </div>
              </th>
              <th className="sortable card-number-header">
                <div className="import-table-header-content" onClick={() => handleSort('cardNumber')}>
                  CARD # <SortIcon field="cardNumber" />
                </div>
              </th>
              <th className="sortable player-header">
                <div className="import-table-header-content" onClick={() => handleSort('playerNames')}>
                  PLAYER(S) <SortIcon field="playerNames" />
                </div>
              </th>
              <th className="team-header">
                <div className="import-table-header-content">
                  TEAM(S)
                </div>
              </th>
              <th className="rc-header">
                <div 
                  className="import-table-header-content clickable-header"
                  onClick={handleToggleAllRC}
                  title="Click to toggle all RC"
                >
                  RC
                </div>
              </th>
              <th className="auto-header">
                <div 
                  className="import-table-header-content clickable-header"
                  onClick={handleToggleAllAutograph}
                  title="Click to toggle all AUTO"
                >
                  AUTO
                </div>
              </th>
              <th className="relic-header">
                <div 
                  className="import-table-header-content clickable-header"
                  onClick={handleToggleAllRelic}
                  title="Click to toggle all RELIC"
                >
                  RELIC
                </div>
              </th>
              <th className="player-team-combo-header">
                <div className="import-table-header-content">
                  PLAYER TEAM
                </div>
              </th>
              <th className="notes-header">
                <div className="import-table-header-content">
                  NOTES
                </div>
              </th>
            </tr>
          </thead>
          <tbody>
            {sortedCards.map((card, cardIndex) => {
              const isExpanded = expandedCards.has(cardIndex)
              
              return (
                <React.Fragment key={cardIndex}>
                  <tr className="import-row">
                    <td className="expand-cell">
                      <button 
                        className="expand-button"
                        onClick={() => toggleCardExpansion(cardIndex)}
                      >
                        <Icon 
                          name={isExpanded ? "chevron-up" : "chevron-down"} 
                          size={16} 
                        />
                      </button>
                    </td>
                    <td className="sort-order-cell">
                      <span className="import-sort-order">
                        {card.sortOrder}
                      </span>
                    </td>
                    <td className="card-number-cell">
                      <span className="import-card-number">
                        {card.cardNumber}
                      </span>
                    </td>
                    <td className="player-cell">
                      <div className="import-players-summary">
                        {(card.players || []).map((player, playerIdx) => {
                          
                          return (
                            <div key={`${playerIdx}-${player._renderKey || 0}`} className="import-player-entry">
                              {/* Show original player name + + button if no player selected */}
                              {!player.selectedPlayer && (
                                <div className="player-name-row">
                                  <span className="player-name">{player.name}</span>
                                  <button 
                                    className="add-player-btn"
                                    onClick={() => createNewPlayer(card.sortOrder, playerIdx, player.name)}
                                    title="Create new player"
                                  >
                                    +
                                  </button>
                                </div>
                              )}
                              
                              {/* Show green box with checkmark if player is selected */}
                              {player.selectedPlayer && (
                                <div className="selected-player-box">
                                  <Icon name="check" size={14} />
                                  <span className="selected-player-name">{player.selectedPlayer.playerName}</span>
                                </div>
                              )}
                              
                              {/* Show matches below the player name if no player selected */}
                              {!player.selectedPlayer && (player.playerMatches?.exact?.length > 0 || player.playerMatches?.fuzzy?.length > 0) && (
                                <div className="player-matches-list">
                                  {[...(player.playerMatches?.exact || []), ...(player.playerMatches?.fuzzy || [])]
                                    .slice(0, 5)
                                    .map((match, matchIdx) => {
                                      const isExact = player.playerMatches?.exact?.some(em => em.playerId === match.playerId)
                                      
                                      return (
                                        <div
                                          key={match.playerId}
                                          className={`match-option ${isExact ? 'exact' : 'fuzzy'}`}
                                          onClick={() => handlePlayerSelection(card.sortOrder, playerIdx, match.playerId)}
                                        >
                                          <span className="match-name">{match.playerName}</span>
                                          {match.teams?.length > 0 && (
                                            <div className="match-teams">
                                              {(() => {
                                                // Debug logging for specific players
                                                if (match.playerName.toLowerCase().includes('realmuto')) {
                                                  console.log(`🔍 Frontend Debug - ${match.playerName} teams:`, match.teams)
                                                }
                                                return match.teams.map(team => (
                                                  <div
                                                    key={team.teamId}
                                                    className="mini-team-circle"
                                                    style={{
                                                      '--primary-color': team.primaryColor || '#666',
                                                      '--secondary-color': team.secondaryColor || '#999'
                                                    }}
                                                    title={team.teamName}
                                                  >
                                                    {team.abbreviation || team.teamName?.substring(0, 3)?.toUpperCase()}
                                                  </div>
                                                ))
                                              })()}
                                            </div>
                                          )}
                                        </div>
                                      )
                                    })
                                  }
                                </div>
                              )}
                            </div>
                          )
                        })}
                      </div>
                    </td>
                    <td className="team-cell">
                      <div className="import-team-validation">
                        {card.teamNames?.map((teamName, teamIdx) => {
                          // Find exact match for this team name
                          const exactMatch = card.teamMatches?.exact?.find(match =>
                            match.teamName.toLowerCase().includes(teamName.toLowerCase())
                          )

                          const hasFuzzyMatch = card.teamMatches?.fuzzy?.some(match =>
                            match.teamName.toLowerCase().includes(teamName.toLowerCase())
                          )

                          // Show team name with exact match
                          if (exactMatch) {
                            return (
                              <div key={teamIdx} className="team-status found">
                                ✓ {exactMatch.teamName}
                              </div>
                            )
                          }

                          // Show team name with fuzzy matches as clickable options
                          if (hasFuzzyMatch) {
                            const fuzzyMatches = card.teamMatches.fuzzy.filter(match =>
                              match.teamName.toLowerCase().includes(teamName.toLowerCase())
                            )

                            return (
                              <div key={teamIdx} className="team-match-container">
                                <div className="team-status not-found">
                                  ✗ {teamName}
                                  <button
                                    className="inline-create-team-button"
                                    onClick={() => createNewTeam(cardIndex, null, teamIdx, teamName)}
                                  >
                                    + Create
                                  </button>
                                </div>
                                <div className="fuzzy-team-suggestions">
                                  {fuzzyMatches.slice(0, 3).map(match => (
                                    <div
                                      key={match.teamId}
                                      className="fuzzy-team-option"
                                      onClick={() => {
                                        // Update team name at card level
                                        const updatedCards = [...cards]
                                        updatedCards[cardIndex].teamNames[teamIdx] = match.teamName

                                        // Move from fuzzy to exact
                                        updatedCards[cardIndex].teamMatches.exact.push(match)
                                        updatedCards[cardIndex].teamMatches.fuzzy =
                                          updatedCards[cardIndex].teamMatches.fuzzy.filter(m => m.teamId !== match.teamId)

                                        onCardUpdate(updatedCards)
                                      }}
                                      title={`Select ${match.teamName}`}
                                      style={{
                                        '--primary-color': match.primaryColor || '#666',
                                        '--secondary-color': match.secondaryColor || '#999'
                                      }}
                                    >
                                      <div className="mini-team-circle">
                                        {match.abbreviation || match.teamName?.substring(0, 3)?.toUpperCase()}
                                      </div>
                                      <span className="team-name-text">{match.teamName}</span>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )
                          }

                          // No matches at all - show create button
                          return (
                            <div key={teamIdx} className="team-status not-found">
                              ✗ {teamName}
                              <button
                                className="inline-create-team-button"
                                onClick={() => createNewTeam(cardIndex, null, teamIdx, teamName)}
                              >
                                + Create
                              </button>
                            </div>
                          )
                        })}
                      </div>
                    </td>
                    <td className="rc-cell">
                      <button 
                        className={`import-rc-toggle ${card.isRC ? 'active' : ''}`}
                        onClick={() => handleRCToggle(card.sortOrder)}
                      >
                        {card.isRC ? 'RC' : '—'}
                      </button>
                    </td>
                    <td className="auto-cell">
                      <button 
                        className={`import-auto-toggle ${card.isAutograph ? 'active' : ''}`}
                        onClick={() => handleAutographToggle(card.sortOrder)}
                      >
                        {card.isAutograph ? 'AUTO' : '—'}
                      </button>
                    </td>
                    <td className="relic-cell">
                      <button 
                        className={`import-relic-toggle ${card.isRelic ? 'active' : ''}`}
                        onClick={() => handleRelicToggle(card.sortOrder)}
                      >
                        {card.isRelic ? 'RELIC' : '—'}
                      </button>
                    </td>
                    <td className="player-team-combo-cell">
                      <div className="player-team-combos">
                        {(card.players || []).map((player, playerIdx) => {
                          // Debug logging for first card
                          if (cardIndex === 0) {
                            console.log(`🔍 Player ${playerIdx} (${player.name}):`, {
                              selectedPlayer: player.selectedPlayer,
                              playerTeamCheckTeams: player.playerTeamCheckTeams,
                              playerTeamMatches: player.playerTeamMatches,
                              cardTeams: card.teamMatches?.exact
                            })
                          }

                          // Must have selected player
                          if (!player.selectedPlayer) {
                            return <div key={playerIdx} className="incomplete-combo">-</div>
                          }

                          // Determine which teams to show:
                          // - If player has position-matched teams (playerTeamCheckTeams), show only those
                          // - If no position match (ambiguous), show ALL card teams as options
                          const teamsToShow = (player.playerTeamCheckTeams?.exact?.length > 0)
                            ? player.playerTeamCheckTeams.exact
                            : card.teamMatches?.exact || []

                          if (teamsToShow.length === 0) {
                            return <div key={playerIdx} className="incomplete-combo">-</div>
                          }

                          // Check each team to see if player_team exists
                          const teamResults = teamsToShow.map(team => {
                            const hasPlayerTeam = player.playerTeamMatches?.some(pt =>
                              pt.playerId === player.selectedPlayer.playerId && pt.teamId === team.teamId
                            )

                            if (hasPlayerTeam) {
                              // Show green confirmed player_team
                              return (
                                <div key={`${playerIdx}-${team.teamId}`} className="player-team-exists">
                                  <span className="pt-player-name">{player.selectedPlayer.playerName}</span>
                                  <div
                                    className="mini-team-circle"
                                    style={{
                                      '--primary-color': team.primaryColor || '#666',
                                      '--secondary-color': team.secondaryColor || '#999'
                                    }}
                                    title={team.teamName}
                                  >
                                    {team.abbreviation || team.teamName?.substring(0, 3)?.toUpperCase()}
                                  </div>
                                </div>
                              )
                            } else {
                              // Show blue recommendation button with + player name + team circle
                              return (
                                <button
                                  key={`${playerIdx}-${team.teamId}`}
                                  className="player-team-recommendation"
                                  onClick={async () => {
                                    try {
                                      const response = await axios.post('/api/admin/import/create-player-team', {
                                        playerId: player.selectedPlayer.playerId,
                                        teamId: team.teamId
                                      })

                                      if (response.data.success) {
                                        if (showToast) {
                                          showToast(`Created player-team: ${player.selectedPlayer.playerName} - ${team.teamName}`, 'success')
                                        }

                                        // Update state: add the new player_team and update playerTeamCheckTeams to only show this team
                                        const updatedCards = [...cards]
                                        const playerData = updatedCards[cardIndex].players[playerIdx]

                                        // Add to player_team matches
                                        if (!playerData.playerTeamMatches) {
                                          playerData.playerTeamMatches = []
                                        }
                                        playerData.playerTeamMatches.push(response.data.playerTeam)

                                        // Update playerTeamCheckTeams to only show the selected team
                                        // This switches the display from "all teams" to "only this team"
                                        playerData.playerTeamCheckTeams = {
                                          exact: [team],
                                          fuzzy: []
                                        }

                                        onCardUpdate(updatedCards)
                                      }
                                    } catch (error) {
                                      console.error('Error creating player_team:', error)
                                      if (showToast) {
                                        showToast(error.response?.data?.message || 'Failed to create player-team', 'error')
                                      }
                                    }
                                  }}
                                  title={`Create player-team: ${player.selectedPlayer.playerName} - ${team.teamName}`}
                                >
                                  <span className="pt-plus">+</span>
                                  <span className="pt-player-name">{player.selectedPlayer.playerName}</span>
                                  <div
                                    className="mini-team-circle"
                                    style={{
                                      '--primary-color': team.primaryColor || '#666',
                                      '--secondary-color': team.secondaryColor || '#999'
                                    }}
                                    title={team.teamName}
                                  >
                                    {team.abbreviation || team.teamName?.substring(0, 3)?.toUpperCase()}
                                  </div>
                                </button>
                              )
                            }
                          })

                          return (
                            <div key={playerIdx} className="player-team-results">
                              {teamResults}
                            </div>
                          )
                        })}
                      </div>
                    </td>
                    <td className="notes-cell">
                      <input
                        type="text"
                        className="import-notes-input"
                        value={card.notes || ''}
                        onChange={(e) => handleNotesChange(cardIndex, e.target.value)}
                        placeholder="Add notes..."
                      />
                    </td>
                  </tr>
                  
                  {/* Expanded Details Row */}
                  {isExpanded && (
                    <tr className="import-details-row">
                      <td colSpan="9" className="import-details-cell">
                        <div className="import-details-content">
                          {(card.players || []).map((player, playerIndex) => (
                            <div key={playerIndex} className="import-player-details">
                              <h4 className="import-player-title">
                                Player: {player.name}
                                {player.selectedPlayer && (
                                  <span className="import-selected-indicator">
                                    → {player.selectedPlayer.playerName}
                                  </span>
                                )}
                              </h4>
                              
                              {/* Player Matching Section */}
                              <div className="import-matching-section">
                                <div className="import-section-title">
                                  <Icon name="user" size={16} />
                                  Player Matches
                                </div>
                                
                                {/* Exact Player Matches - Dropdown Style */}
                                {player.playerMatches?.exact?.length > 0 && (
                                  <div className="import-matches-group">
                                    <h5>Exact Matches:</h5>
                                    <select 
                                      value={player.selectedPlayer?.playerId || ''}
                                      onChange={(e) => handlePlayerSelection(cardIndex, playerIndex, e.target.value)}
                                      className="import-match-select"
                                    >
                                      <option value="">Choose player...</option>
                                      {player.playerMatches.exact.map(match => (
                                        <option key={match.playerId} value={match.playerId}>
                                          {match.playerName}
                                        </option>
                                      ))}
                                    </select>
                                  </div>
                                )}
                                
                                {/* Fuzzy Player Matches */}
                                {player.playerMatches?.fuzzy?.length > 0 && (
                                  <div className="import-matches-group">
                                    <h5>Similar Names (possible typos):</h5>
                                    <select 
                                      value={player.selectedPlayer?.playerId || ''}
                                      onChange={(e) => handlePlayerSelection(cardIndex, playerIndex, e.target.value)}
                                      className="import-match-select fuzzy"
                                    >
                                      <option value="">Choose similar name...</option>
                                      {player.playerMatches.fuzzy.map(match => (
                                        <option key={match.playerId} value={match.playerId}>
                                          {match.playerName} (possible typo)
                                        </option>
                                      ))}
                                    </select>
                                  </div>
                                )}
                                
                                {/* Create New Player */}
                                {(!player.playerMatches?.exact?.length && !player.selectedPlayer) && (
                                  <div className="import-create-section">
                                    <button 
                                      className="import-create-button"
                                      onClick={(e) => {
                                        e.preventDefault()
                                        console.log('🖱️ Create Player button clicked!', {
                                          cardIndex,
                                          playerIndex, 
                                          playerName: player.name,
                                          player
                                        })
                                        createNewPlayer(cardIndex, playerIndex, player.name)
                                      }}
                                    >
                                      <Icon name="plus-circle" size={14} />
                                      Create New Player: "{player.name}"
                                    </button>
                                  </div>
                                )}
                              </div>
                              
                              {/* Team Matching Section */}
                              <div className="import-matching-section">
                                <div className="import-section-title">
                                  <Icon name="shield" size={16} />
                                  Team Matches
                                </div>
                                
                                {player.teamNames?.map((teamName, teamIndex) => (
                                  <div key={teamIndex} className="import-team-matching">
                                    <h5>Team: {teamName}</h5>

                                    {(player.teamMatches?.exact?.length > 0 || player.teamMatches?.fuzzy?.length > 0) ? (
                                      <select
                                        value={player.selectedTeams?.[teamIndex]?.teamId || ''}
                                        onChange={(e) => handleTeamSelection(cardIndex, playerIndex, teamIndex, e.target.value)}
                                        className="import-match-select"
                                      >
                                        <option value="">Choose team...</option>
                                        {player.teamMatches.exact?.length > 0 && (
                                          <optgroup label="Exact Matches">
                                            {player.teamMatches.exact.map(team => (
                                              <option key={team.teamId} value={team.teamId}>
                                                {team.teamName}
                                              </option>
                                            ))}
                                          </optgroup>
                                        )}
                                        {player.teamMatches.fuzzy?.length > 0 && (
                                          <optgroup label="Suggestions">
                                            {player.teamMatches.fuzzy.map(team => (
                                              <option key={team.teamId} value={team.teamId}>
                                                {team.teamName}
                                              </option>
                                            ))}
                                          </optgroup>
                                        )}
                                      </select>
                                    ) : (
                                      <div className="import-create-section">
                                        <button 
                                          className="import-create-button"
                                          onClick={() => createNewTeam(cardIndex, playerIndex, teamIndex, teamName)}
                                        >
                                          <Icon name="plus-circle" size={14} />
                                          Create New Team: "{teamName}"
                                        </button>
                                      </div>
                                    )}
                                  </div>
                                ))}
                              </div>
                              
                              {/* Player-Team Combination Section */}
                              {player.selectedPlayer && player.selectedTeams?.some(t => t) && (
                                <div className="import-matching-section">
                                  <div className="import-section-title">
                                    <Icon name="link" size={16} />
                                    Player-Team Combinations
                                  </div>
                                  
                                  {player.selectedTeams?.map((selectedTeam, teamIndex) => {
                                    if (!selectedTeam) return null
                                    
                                    const existingPlayerTeam = player.playerTeamMatches?.find(
                                      pt => pt.playerId === player.selectedPlayer.playerId && 
                                           pt.teamId === selectedTeam.teamId
                                    )
                                    
                                    return (
                                      <div key={teamIndex} className="import-player-team-combo">
                                        <span className="import-combo-text">
                                          {player.selectedPlayer.playerName} ↔ {selectedTeam.teamName}
                                        </span>
                                        
                                        {existingPlayerTeam ? (
                                          <div className="import-combo-exists">
                                            <Icon name="check-circle" size={14} />
                                            Combination exists
                                          </div>
                                        ) : (
                                          <button 
                                            className="import-create-button small"
                                            onClick={() => createPlayerTeam(
                                              cardIndex, 
                                              playerIndex, 
                                              player.selectedPlayer.playerId, 
                                              selectedTeam.teamId
                                            )}
                                          >
                                            <Icon name="plus-circle" size={14} />
                                            Create Combination
                                          </button>
                                        )}
                                      </div>
                                    )
                                  })}
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Footer */}
      <div className="import-table-footer">
        <div className="import-table-info">
          Showing {sortedCards.length} of {cards.length} cards for import
          {searchQuery && ` (filtered by "${searchQuery}")`}
        </div>
        
        <div className="import-table-stats">
          {(() => {
            let ready = 0, needsWork = 0
            sortedCards.forEach(card => {
              // Check if card is ready (all validations pass)
              let isReady = true

              // 1. Check all players have matches
              if (!card.players?.every(player => player.selectedPlayer)) {
                isReady = false
              }

              // 2. Check all card-level teams have matches
              if (card.teamNames?.length > 0) {
                const allTeamsMatched = card.teamNames.every(teamName =>
                  card.teamMatches?.exact?.some(match =>
                    match.teamName.toLowerCase().includes(teamName.toLowerCase())
                  )
                )
                if (!allTeamsMatched) isReady = false
              }

              // 3. Check all players have player_team records
              if (isReady) {
                card.players?.forEach(player => {
                  if (!player.selectedPlayer) return

                  // Get the teams this player should have based on playerTeamCheckTeams
                  const requiredTeams = player.playerTeamCheckTeams?.exact || []

                  // Check if player has player_team records for all required teams
                  requiredTeams.forEach(team => {
                    const hasPlayerTeam = player.playerTeamMatches?.some(pt =>
                      pt.playerId === player.selectedPlayer.playerId && pt.teamId === team.teamId
                    )
                    if (!hasPlayerTeam) isReady = false
                  })
                })
              }

              if (isReady) ready++
              else needsWork++
            })

            return (
              <>
                <span className="import-stat-ready">{ready} Ready</span>
                {needsWork > 0 && <span className="import-stat-needs-work">{needsWork} Need Work</span>}
              </>
            )
          })()}
        </div>
      </div>
    </div>
  )
}

export default ImportTable