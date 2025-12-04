import React, { useState, useMemo, useEffect, useRef } from 'react'
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
  const [colors, setColors] = useState([])
  const [loadingColors, setLoadingColors] = useState(true)
  const [bulkPrintRun, setBulkPrintRun] = useState('')
  const [bulkColorId, setBulkColorId] = useState('')
  const [bulkNotes, setBulkNotes] = useState('')
  const [showBulkModal, setShowBulkModal] = useState(false) // false, 'printRun', 'color', or 'notes'
  const [openColorDropdown, setOpenColorDropdown] = useState(null) // Track which color dropdown is open (by sortOrder)
  const colorDropdownRef = useRef(null)
  const tableWrapperRef = useRef(null)

  // Fetch colors on mount
  useEffect(() => {
    const fetchColors = async () => {
      try {
        const response = await axios.get('/api/admin/colors')
        setColors(response.data.colors || [])
      } catch (error) {
        console.error('Error fetching colors:', error)
        if (showToast) {
          showToast('Failed to load colors', 'error')
        }
      } finally {
        setLoadingColors(false)
      }
    }
    fetchColors()
  }, [showToast])

  // Handle click outside to close color dropdown
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (colorDropdownRef.current && !colorDropdownRef.current.contains(event.target)) {
        setOpenColorDropdown(null)
      }
    }

    if (openColorDropdown !== null) {
      document.addEventListener('mousedown', handleClickOutside)
      return () => {
        document.removeEventListener('mousedown', handleClickOutside)
      }
    }
  }, [openColorDropdown])

  const handleNotesChange = (cardIndex, newNotes) => {
    if (onCardUpdate) {
      const updatedCards = [...cards]
      updatedCards[cardIndex].notes = newNotes
      onCardUpdate(updatedCards)
    }
  }

  const handlePrintRunChange = (cardSortOrder, newPrintRun) => {
    if (onCardUpdate) {
      const cardIndex = cards.findIndex(card => card.sortOrder === cardSortOrder)
      if (cardIndex === -1) return

      const updatedCards = [...cards]
      updatedCards[cardIndex].printRun = newPrintRun === '' ? null : parseInt(newPrintRun) || null
      onCardUpdate(updatedCards)
    }
  }

  const handleColorChange = (cardSortOrder, newColorId) => {
    if (onCardUpdate) {
      const cardIndex = cards.findIndex(card => card.sortOrder === cardSortOrder)
      if (cardIndex === -1) return

      const updatedCards = [...cards]
      updatedCards[cardIndex].colorId = newColorId === '' ? null : parseInt(newColorId) || null
      onCardUpdate(updatedCards)
    }
  }

  const handleBulkPrintRunApply = () => {
    if (onCardUpdate) {
      const printRunValue = bulkPrintRun === '' ? null : parseInt(bulkPrintRun) || null
      const updatedCards = cards.map(card => ({
        ...card,
        printRun: printRunValue
      }))
      onCardUpdate(updatedCards)
      if (showToast) {
        showToast(`Applied print run ${printRunValue || '(none)'} to all cards`, 'success')
      }
      setShowBulkModal(false)
    }
  }

  const handleBulkColorApply = () => {
    if (onCardUpdate) {
      const colorIdValue = bulkColorId === '' ? null : parseInt(bulkColorId) || null
      const updatedCards = cards.map(card => ({
        ...card,
        colorId: colorIdValue
      }))
      onCardUpdate(updatedCards)
      const colorName = colors.find(c => c.color_id === colorIdValue)?.name || '(none)'
      if (showToast) {
        showToast(`Applied color "${colorName}" to all cards`, 'success')
      }
      setShowBulkModal(false)
    }
  }

  // Filter cards based on search query
  const filteredCards = useMemo(() => {
    if (!searchQuery.trim()) return cards

    const query = searchQuery.toLowerCase()
    return cards.filter(card => {
      // Card number - ensure string
      if (card.cardNumber && String(card.cardNumber).toLowerCase().includes(query)) return true

      // Player names - could be string or array
      if (card.playerNames) {
        if (Array.isArray(card.playerNames)) {
          if (card.playerNames.some(name => name && String(name).toLowerCase().includes(query))) return true
        } else if (String(card.playerNames).toLowerCase().includes(query)) {
          return true
        }
      }

      // Also check players array for names
      if (card.players && Array.isArray(card.players)) {
        if (card.players.some(p => p.name && String(p.name).toLowerCase().includes(query))) return true
      }

      // Team names - could be string or array
      if (card.teamNames) {
        if (Array.isArray(card.teamNames)) {
          if (card.teamNames.some(name => name && String(name).toLowerCase().includes(query))) return true
        } else if (String(card.teamNames).toLowerCase().includes(query)) {
          return true
        }
      }

      // Notes - ensure string
      if (card.notes && String(card.notes).toLowerCase().includes(query)) return true

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

  const handleShortPrintToggle = (cardSortOrder) => {
    if (onCardUpdate) {
      const cardIndex = cards.findIndex(card => card.sortOrder === cardSortOrder)
      if (cardIndex === -1) return

      const updatedCards = [...cards]
      updatedCards[cardIndex].isShortPrint = !updatedCards[cardIndex].isShortPrint
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

  const handleToggleAllShortPrint = () => {
    if (onCardUpdate) {
      const currentlyAllSP = cards.every(card => card.isShortPrint)
      const updatedCards = cards.map(card => ({
        ...card,
        isShortPrint: !currentlyAllSP
      }))
      onCardUpdate(updatedCards)
    }
  }

  const handleBulkNotesApply = () => {
    if (onCardUpdate) {
      const updatedCards = cards.map(card => ({
        ...card,
        notes: bulkNotes
      }))
      onCardUpdate(updatedCards)
      if (showToast) {
        showToast(`Applied notes to all ${cards.length} cards`, 'success')
      }
      setShowBulkModal(false)
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

      // If player is selected and teams exist, check for existing player_team records
      // Use playerTeamCheckTeams (position-matched) which includes dynamically found teams like "No Team Assigned"
      const teamsToCheck = player.playerTeamCheckTeams?.exact || player.teamMatches?.exact || []

      if (selectedPlayer && teamsToCheck.length > 0) {
        console.log(`🔗 Player selected: ${selectedPlayer.playerName}, checking player_team records for ${teamsToCheck.length} teams...`)

        const playerTeamPromises = []

        // Check all position-matched teams (includes "No Team Assigned" if no team was in import data)
        const matchedTeams = teamsToCheck
        
        for (const team of matchedTeams) {
          // Check if player_team combination already exists in our cached matches
          const playerTeamExists = player.playerTeamMatches?.some(pt =>
            pt.playerId === selectedPlayer.playerId && pt.teamId === team.teamId
          )

          // Also check if player already has this team from their database lookup
          const playerAlreadyHasTeam = selectedPlayer.teams?.some(existingTeam =>
            existingTeam.teamId === team.teamId
          )

          if (playerTeamExists) {
            console.log(`✅ Player_team already exists in cache: ${selectedPlayer.playerName} - ${team.teamName}`)
            continue
          }

          if (playerAlreadyHasTeam) {
            console.log(`✅ Player ${selectedPlayer.playerName} already has team ${team.teamName} - adding to cache`)

            // Find the existing player_team record from the player's teams
            const existingTeam = selectedPlayer.teams?.find(t => t.teamId === team.teamId)
            const existingPlayerTeam = {
              playerTeamId: existingTeam?.playerTeamId || `existing_${selectedPlayer.playerId}_${team.teamId}`,
              playerId: selectedPlayer.playerId,
              teamId: team.teamId,
              playerName: selectedPlayer.playerName,
              teamName: team.teamName
            }

            // Add to BOTH arrays for UI and backend import
            if (!player.playerTeamMatches) {
              player.playerTeamMatches = []
            }
            if (!player.selectedPlayerTeams) {
              player.selectedPlayerTeams = []
            }
            player.playerTeamMatches.push(existingPlayerTeam)
            player.selectedPlayerTeams.push(existingPlayerTeam)
            continue
          }

          // Check database to see if player_team exists (for dynamically found teams like "No Team Assigned")
          console.log(`🔍 Checking database for player_team: ${selectedPlayer.playerName} + ${team.teamName}`)

          const checkPromise = axios.post('/api/admin/import/create-player-team', {
            playerId: selectedPlayer.playerId,
            teamId: team.teamId
          }).then(ptResponse => {
            if (ptResponse.data.success) {
              // Ensure playerTeamMatches structure exists
              if (!player.playerTeamMatches) {
                player.playerTeamMatches = []
              }
              // Ensure selectedPlayerTeams structure exists (for backend import)
              if (!player.selectedPlayerTeams) {
                player.selectedPlayerTeams = []
              }

              // Add the player-team combination to BOTH arrays
              player.playerTeamMatches.push(ptResponse.data.playerTeam)
              player.selectedPlayerTeams.push(ptResponse.data.playerTeam)

              console.log(`✅ Created player_team: ${ptResponse.data.playerTeam.playerName} - ${ptResponse.data.playerTeam.teamName}`)
              return ptResponse.data.playerTeam
            }
          }).catch(ptError => {
            // If error is "already exists", that's fine - fetch it
            if (ptError.response?.data?.message?.includes('already exists')) {
              console.log(`✅ Player_team already exists in database: ${selectedPlayer.playerName} - ${team.teamName}`)
              // Create placeholder record for UI
              const existingPlayerTeam = {
                playerTeamId: `existing_${selectedPlayer.playerId}_${team.teamId}`,
                playerId: selectedPlayer.playerId,
                teamId: team.teamId,
                playerName: selectedPlayer.playerName,
                teamName: team.teamName
              }

              if (!player.playerTeamMatches) {
                player.playerTeamMatches = []
              }
              if (!player.selectedPlayerTeams) {
                player.selectedPlayerTeams = []
              }
              player.playerTeamMatches.push(existingPlayerTeam)
              player.selectedPlayerTeams.push(existingPlayerTeam)
              return existingPlayerTeam
            } else {
              console.error('Error checking/creating player_team:', ptError)
              return null
            }
          })

          playerTeamPromises.push(checkPromise)
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

        // If player is already selected, check/create player_team record
        if (player.selectedPlayer) {
          const playerId = player.selectedPlayer.playerId
          const teamId = selectedTeam.teamId

          // Check if player_team combination already exists in cache
          const playerTeamExists = player.playerTeamMatches?.some(pt =>
            pt.playerId === playerId && pt.teamId === teamId
          )

          // Also check if player already has this team from their database lookup
          const playerAlreadyHasTeam = player.selectedPlayer.teams?.some(existingTeam =>
            existingTeam.teamId === teamId
          )

          if (playerTeamExists) {
            console.log(`✅ Player_team already exists in cache: ${player.selectedPlayer.playerName} - ${selectedTeam.teamName}`)
          } else if (playerAlreadyHasTeam) {
            console.log(`✅ Player ${player.selectedPlayer.playerName} already has team ${selectedTeam.teamName} - adding to cache`)

            // Find the existing player_team record from the player's teams
            const existingTeam = player.selectedPlayer.teams?.find(t => t.teamId === teamId)
            const existingPlayerTeam = {
              playerTeamId: existingTeam?.playerTeamId || `existing_${playerId}_${teamId}`,
              playerId: playerId,
              teamId: teamId,
              playerName: player.selectedPlayer.playerName,
              teamName: selectedTeam.teamName
            }

            // Add to BOTH arrays for UI and backend import
            if (!player.playerTeamMatches) {
              player.playerTeamMatches = []
            }
            if (!player.selectedPlayerTeams) {
              player.selectedPlayerTeams = []
            }
            player.playerTeamMatches.push(existingPlayerTeam)
            player.selectedPlayerTeams.push(existingPlayerTeam)

            // Force re-render to show green status
            onCardUpdate([...updatedCards])
          } else {
            // Try to create the player_team record
            console.log(`🔗 Creating player_team for selected team: ${player.selectedPlayer.playerName} + ${selectedTeam.teamName}`)

            axios.post('/api/admin/import/create-player-team', {
              playerId: playerId,
              teamId: teamId
            }).then(ptResponse => {
              if (ptResponse.data.success) {
                if (!player.playerTeamMatches) {
                  player.playerTeamMatches = []
                }
                if (!player.selectedPlayerTeams) {
                  player.selectedPlayerTeams = []
                }
                player.playerTeamMatches.push(ptResponse.data.playerTeam)
                player.selectedPlayerTeams.push(ptResponse.data.playerTeam)
                console.log(`✅ Created player_team: ${ptResponse.data.playerTeam.playerName} - ${ptResponse.data.playerTeam.teamName}`)

                if (showToast) {
                  showToast(`Created player-team: ${ptResponse.data.playerTeam.playerName} - ${ptResponse.data.playerTeam.teamName}`, 'success')
                }

                // Force re-render after player_team creation
                onCardUpdate([...updatedCards])
              }
            }).catch(ptError => {
              // If error is "already exists", that's fine - add to cache
              if (ptError.response?.data?.message?.includes('already exists')) {
                console.log(`✅ Player_team already exists in database: ${player.selectedPlayer.playerName} - ${selectedTeam.teamName}`)
                // Create placeholder record for UI
                const existingPlayerTeam = {
                  playerTeamId: `existing_${playerId}_${teamId}`,
                  playerId: playerId,
                  teamId: teamId,
                  playerName: player.selectedPlayer.playerName,
                  teamName: selectedTeam.teamName
                }

                if (!player.playerTeamMatches) {
                  player.playerTeamMatches = []
                }
                if (!player.selectedPlayerTeams) {
                  player.selectedPlayerTeams = []
                }
                player.playerTeamMatches.push(existingPlayerTeam)
                player.selectedPlayerTeams.push(existingPlayerTeam)

                // Force re-render to show green status
                onCardUpdate([...updatedCards])
              } else {
                console.error('Error creating player_team:', ptError)
              }
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
      const lastName = nameParts.slice(1).join(' ') || '' // Allow empty lastName for single-name subjects

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
          // Check if this CARD has the team name (for card-level display)
          const cardHasThisTeam = card.teamNames?.some(name =>
            name.toLowerCase() === teamName.toLowerCase()
          )

          if (cardHasThisTeam) {
            // Ensure card teamMatches structure exists
            if (!card.teamMatches) {
              card.teamMatches = { exact: [], fuzzy: [] }
            }
            if (!card.teamMatches.exact) {
              card.teamMatches.exact = []
            }

            // Check if team is already in card's exact matches (avoid duplicates)
            const teamExistsInCard = card.teamMatches.exact.some(team =>
              team.teamId === newTeam.teamId
            )

            if (!teamExistsInCard) {
              // Add the new team to card's exact matches
              card.teamMatches.exact.push(newTeam)
              console.log(`✅ Added team ${newTeam.teamName} to card ${cardIdx} exact matches`)
            }

            // Remove from fuzzy matches if present
            if (card.teamMatches.fuzzy) {
              card.teamMatches.fuzzy = card.teamMatches.fuzzy.filter(team =>
                team.teamId !== newTeam.teamId
              )
            }
          }

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
                      // Ensure selectedPlayerTeams structure exists (for backend import)
                      if (!player.selectedPlayerTeams) {
                        player.selectedPlayerTeams = []
                      }

                      // Add the new player-team combination to BOTH arrays
                      player.playerTeamMatches.push(ptResponse.data.playerTeam)
                      player.selectedPlayerTeams.push(ptResponse.data.playerTeam)
                      
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


  // Helper function to check if a card needs work
  const cardNeedsWork = (card) => {
    // 1. Check all players have matches
    if (!card.players?.every(player => player.selectedPlayer)) {
      return true
    }

    // 2. Check all card-level teams have matches
    if (card.teamNames?.length > 0) {
      const allTeamsMatched = card.teamNames.every(teamName =>
        card.teamMatches?.exact?.some(match =>
          match.teamName.toLowerCase().includes(teamName.toLowerCase())
        )
      )
      if (!allTeamsMatched) return true
    }

    // 3. Check all players have player_team records
    for (const player of (card.players || [])) {
      if (!player.selectedPlayer) continue

      // Get the teams this player should have based on playerTeamCheckTeams
      const requiredTeams = player.playerTeamCheckTeams?.exact || []

      // Check if player has player_team records for all required teams
      for (const team of requiredTeams) {
        const hasPlayerTeam = player.playerTeamMatches?.some(pt =>
          pt.playerId === player.selectedPlayer.playerId && pt.teamId === team.teamId
        )
        if (!hasPlayerTeam) return true
      }
    }

    return false
  }

  // Scroll to first card that needs work
  const scrollToFirstProblem = () => {
    // Find first card that needs work in the sorted list
    const firstProblemIndex = sortedCards.findIndex(card => cardNeedsWork(card))

    if (firstProblemIndex >= 0 && tableWrapperRef.current) {
      const problemRow = tableWrapperRef.current.querySelector(`tr[data-card-index="${firstProblemIndex}"]`)
      if (problemRow) {
        problemRow.scrollIntoView({ behavior: 'smooth', block: 'center' })
        // Briefly highlight the row
        problemRow.classList.add('import-row-highlight')
        setTimeout(() => problemRow.classList.remove('import-row-highlight'), 2000)
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
        <div className="card-icon-spinner"></div>
        <p>Processing import data...</p>
      </div>
    )
  }

  return (
    <div className="import-table-container">
      {/* Bulk Edit Modal */}
      {showBulkModal && (
        <div className="bulk-edit-modal-overlay" onClick={() => setShowBulkModal(false)}>
          <div className="bulk-edit-modal" onClick={(e) => e.stopPropagation()}>
            <div className="bulk-edit-header">
              <h3>
                {showBulkModal === 'printRun' && 'Set Print Run for All Cards'}
                {showBulkModal === 'color' && 'Set Color for All Cards'}
                {showBulkModal === 'notes' && 'Set Notes for All Cards'}
              </h3>
              <button className="modal-close-btn" onClick={() => setShowBulkModal(false)}>
                <Icon name="x" size={20} />
              </button>
            </div>
            <div className="bulk-edit-content">
              {showBulkModal === 'printRun' && (
                <>
                  <label htmlFor="bulk-print-run">Print Run:</label>
                  <input
                    id="bulk-print-run"
                    type="number"
                    className="bulk-input"
                    value={bulkPrintRun}
                    onChange={(e) => setBulkPrintRun(e.target.value)}
                    placeholder="Enter print run (leave empty for none)"
                    min="1"
                    autoFocus
                  />
                  <p className="bulk-help-text">
                    This will apply the same print run to all {cards.length} cards in this import.
                  </p>
                </>
              )}
              {showBulkModal === 'color' && (
                <>
                  <label htmlFor="bulk-color">Color:</label>
                  <select
                    id="bulk-color"
                    className="bulk-select"
                    value={bulkColorId}
                    onChange={(e) => setBulkColorId(e.target.value)}
                    autoFocus
                  >
                    <option value="">— No Color —</option>
                    {colors.map(color => (
                      <option key={color.color_id} value={color.color_id}>
                        {color.name}
                      </option>
                    ))}
                  </select>
                  <p className="bulk-help-text">
                    This will apply the same color to all {cards.length} cards in this import.
                  </p>
                </>
              )}
              {showBulkModal === 'notes' && (
                <>
                  <label htmlFor="bulk-notes">Notes:</label>
                  <input
                    id="bulk-notes"
                    type="text"
                    className="bulk-input"
                    value={bulkNotes}
                    onChange={(e) => setBulkNotes(e.target.value)}
                    placeholder="Enter notes to apply to all cards"
                    autoFocus
                  />
                  <p className="bulk-help-text">
                    This will replace the notes on all {cards.length} cards in this import.
                  </p>
                </>
              )}
            </div>
            <div className="bulk-edit-actions">
              <button className="bulk-cancel-btn" onClick={() => setShowBulkModal(false)}>
                Cancel
              </button>
              <button
                className="bulk-apply-btn"
                onClick={
                  showBulkModal === 'printRun' ? handleBulkPrintRunApply :
                  showBulkModal === 'color' ? handleBulkColorApply :
                  handleBulkNotesApply
                }
              >
                Apply to All Cards
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Rest of component */}
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
        ref={tableWrapperRef}
        className="import-table-wrapper"
        style={{
          maxHeight: maxHeight,
          overflowY: maxHeight === 'none' ? 'hidden' : 'auto'
        }}
      >
        <table className="import-table">
          <thead>
            <tr>
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
              <th className="sp-header">
                <div
                  className="import-table-header-content clickable-header"
                  onClick={handleToggleAllShortPrint}
                  title="Click to toggle all SP"
                >
                  SP
                </div>
              </th>
              <th className="print-run-header">
                <div
                  className="import-table-header-content clickable-header"
                  onClick={() => setShowBulkModal('printRun')}
                  title="Click to set print run for all cards"
                >
                  PRINT RUN
                </div>
              </th>
              <th className="color-header">
                <div
                  className="import-table-header-content clickable-header"
                  onClick={() => setShowBulkModal('color')}
                  title="Click to set color for all cards"
                >
                  COLOR
                </div>
              </th>
              <th className="player-team-combo-header">
                <div className="import-table-header-content">
                  PLAYER TEAM
                </div>
              </th>
              <th className="notes-header">
                <div
                  className="import-table-header-content clickable-header"
                  onClick={() => setShowBulkModal('notes')}
                  title="Click to set notes for all cards"
                >
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
                  <tr className="import-row" data-card-index={cardIndex}>
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
                                                    title={`${team.teamName} (Player ID: ${match.playerId})`}
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
                          // Helper function to normalize accents for matching
                          const normalizeAccents = (str) => {
                            return str.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
                          }

                          // Find exact match for this team name (with accent normalization)
                          const normalizedSearchTerm = normalizeAccents(teamName.toLowerCase())
                          const exactMatch = card.teamMatches?.exact?.find(match => {
                            const normalizedTeamName = normalizeAccents(match.teamName.toLowerCase())
                            return normalizedTeamName.includes(normalizedSearchTerm)
                          })

                          const hasFuzzyMatch = card.teamMatches?.fuzzy?.some(match => {
                            const normalizedTeamName = normalizeAccents(match.teamName.toLowerCase())
                            return normalizedTeamName.includes(normalizedSearchTerm)
                          })

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
                            const fuzzyMatches = card.teamMatches.fuzzy.filter(match => {
                              const normalizedTeamName = normalizeAccents(match.teamName.toLowerCase())
                              return normalizedTeamName.includes(normalizedSearchTerm)
                            })

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
                                      onClick={async () => {
                                        // Update team name at card level
                                        const updatedCards = [...cards]
                                        updatedCards[cardIndex].teamNames[teamIdx] = match.teamName

                                        // Move from fuzzy to exact
                                        updatedCards[cardIndex].teamMatches.exact.push(match)
                                        updatedCards[cardIndex].teamMatches.fuzzy =
                                          updatedCards[cardIndex].teamMatches.fuzzy.filter(m => m.teamId !== match.teamId)

                                        // Check for existing player_team relationships for this team
                                        const card = updatedCards[cardIndex]
                                        const playerTeamChecks = []

                                        card.players?.forEach((player, pIdx) => {
                                          if (player.selectedPlayer) {
                                            const playerId = player.selectedPlayer.playerId
                                            const teamId = match.teamId

                                            // Check if player_team already exists in cache
                                            const alreadyInCache = player.playerTeamMatches?.some(pt =>
                                              pt.playerId === playerId && pt.teamId === teamId
                                            )

                                            if (!alreadyInCache) {
                                              // Try to create/fetch player_team from database
                                              const checkPromise = axios.post('/api/admin/import/create-player-team', {
                                                playerId,
                                                teamId
                                              }).then(response => {
                                                if (response.data.success) {
                                                  // Add to cache
                                                  if (!player.playerTeamMatches) player.playerTeamMatches = []
                                                  if (!player.selectedPlayerTeams) player.selectedPlayerTeams = []
                                                  player.playerTeamMatches.push(response.data.playerTeam)
                                                  player.selectedPlayerTeams.push(response.data.playerTeam)
                                                  return response.data.playerTeam
                                                }
                                              }).catch(error => {
                                                // If already exists, add placeholder to cache
                                                if (error.response?.data?.message?.includes('already exists')) {
                                                  const existingPlayerTeam = {
                                                    playerTeamId: `existing_${playerId}_${teamId}`,
                                                    playerId,
                                                    teamId,
                                                    playerName: player.selectedPlayer.playerName,
                                                    teamName: match.teamName
                                                  }
                                                  if (!player.playerTeamMatches) player.playerTeamMatches = []
                                                  if (!player.selectedPlayerTeams) player.selectedPlayerTeams = []
                                                  player.playerTeamMatches.push(existingPlayerTeam)
                                                  player.selectedPlayerTeams.push(existingPlayerTeam)
                                                  return existingPlayerTeam
                                                }
                                                return null
                                              })

                                              playerTeamChecks.push(checkPromise)
                                            }
                                          }
                                        })

                                        // Wait for all checks before updating UI
                                        if (playerTeamChecks.length > 0) {
                                          await Promise.all(playerTeamChecks)
                                        }

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
                    <td className="sp-cell">
                      <button
                        className={`import-sp-toggle ${card.isShortPrint ? 'active' : ''}`}
                        onClick={() => handleShortPrintToggle(card.sortOrder)}
                      >
                        {card.isShortPrint ? 'SP' : '—'}
                      </button>
                    </td>
                    <td className="print-run-cell">
                      <input
                        type="number"
                        className="import-print-run-input"
                        value={card.printRun || ''}
                        onChange={(e) => handlePrintRunChange(card.sortOrder, e.target.value)}
                        placeholder="—"
                        min="1"
                        tabIndex={1000 + cardIndex}
                      />
                    </td>
                    <td className="color-cell">
                      <div
                        className="import-color-dropdown"
                        ref={openColorDropdown === card.sortOrder ? colorDropdownRef : null}
                      >
                        <button
                          className="import-color-trigger"
                          onClick={() => setOpenColorDropdown(
                            openColorDropdown === card.sortOrder ? null : card.sortOrder
                          )}
                          type="button"
                        >
                          {card.colorId ? (
                            <>
                              <span
                                className="import-color-dot"
                                style={{
                                  backgroundColor: colors.find(c => c.color_id === card.colorId)?.hex_value || '#666'
                                }}
                              />
                              <span className="import-color-name">
                                {colors.find(c => c.color_id === card.colorId)?.name || '—'}
                              </span>
                            </>
                          ) : (
                            <span className="import-color-placeholder">—</span>
                          )}
                          <Icon name="chevron-down" size={12} className="import-color-chevron" />
                        </button>

                        {openColorDropdown === card.sortOrder && (
                          <div className="import-color-dropdown-menu">
                            <div
                              className="import-color-option"
                              onClick={() => {
                                handleColorChange(card.sortOrder, '')
                                setOpenColorDropdown(null)
                              }}
                            >
                              <span className="import-color-option-label">No Color</span>
                            </div>
                            {colors.map(color => (
                              <div
                                key={color.color_id}
                                className={`import-color-option ${card.colorId === color.color_id ? 'selected' : ''}`}
                                onClick={() => {
                                  handleColorChange(card.sortOrder, color.color_id)
                                  setOpenColorDropdown(null)
                                }}
                              >
                                <span
                                  className="import-color-dot"
                                  style={{ backgroundColor: color.hex_value || '#666' }}
                                />
                                <span className="import-color-option-label">{color.name}</span>
                                {card.colorId === color.color_id && (
                                  <Icon name="check" size={14} className="import-color-check" />
                                )}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
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
                          const rawTeamsToShow = (player.playerTeamCheckTeams?.exact?.length > 0)
                            ? player.playerTeamCheckTeams.exact
                            : card.teamMatches?.exact || []

                          // Deduplicate teams by teamId to prevent duplicate entries
                          const teamsToShow = rawTeamsToShow.filter((team, index, self) =>
                            index === self.findIndex(t => t.teamId === team.teamId)
                          )

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
                                    title={`${team.teamName} (Player ID: ${player.selectedPlayer.playerId})`}
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
                                        const createdPlayerTeam = response.data.playerTeam

                                        if (showToast) {
                                          showToast(`Created player-team: ${player.selectedPlayer.playerName} - ${team.teamName}`, 'success')
                                        }

                                        // Update ALL cards that have this same player-team combination
                                        const updatedCards = [...cards]
                                        let updatedCount = 0

                                        updatedCards.forEach((card, cIdx) => {
                                          card.players?.forEach((p, pIdx) => {
                                            // Check if this player matches and has this team in their team list
                                            if (p.selectedPlayer?.playerId === player.selectedPlayer.playerId) {
                                              const hasThisTeam = p.playerTeamCheckTeams?.exact?.some(t => t.teamId === team.teamId)

                                              // Check if player_team doesn't already exist
                                              const alreadyHasPlayerTeam = p.playerTeamMatches?.some(pt =>
                                                pt.playerId === player.selectedPlayer.playerId && pt.teamId === team.teamId
                                              )

                                              if (hasThisTeam && !alreadyHasPlayerTeam) {
                                                console.log(`🔄 Adding player_team for "${p.selectedPlayer.playerName}" - "${team.teamName}" on card ${card.sortOrder}`)

                                                // Add to player_team matches
                                                if (!updatedCards[cIdx].players[pIdx].playerTeamMatches) {
                                                  updatedCards[cIdx].players[pIdx].playerTeamMatches = []
                                                }
                                                updatedCards[cIdx].players[pIdx].playerTeamMatches.push(createdPlayerTeam)

                                                // ALSO add to selectedPlayerTeams for backend import
                                                if (!updatedCards[cIdx].players[pIdx].selectedPlayerTeams) {
                                                  updatedCards[cIdx].players[pIdx].selectedPlayerTeams = []
                                                }
                                                updatedCards[cIdx].players[pIdx].selectedPlayerTeams.push(createdPlayerTeam)

                                                // Update playerTeamCheckTeams to only show matched teams
                                                // This removes other team options after selection
                                                const currentTeams = updatedCards[cIdx].players[pIdx].playerTeamCheckTeams?.exact || []
                                                updatedCards[cIdx].players[pIdx].playerTeamCheckTeams = {
                                                  exact: currentTeams.filter(t =>
                                                    updatedCards[cIdx].players[pIdx].playerTeamMatches.some(pt => pt.teamId === t.teamId)
                                                  ),
                                                  fuzzy: []
                                                }

                                                updatedCount++
                                              }
                                            }
                                          })
                                        })

                                        console.log(`🎯 Updated ${updatedCount} instances of player-team "${player.selectedPlayer.playerName}" - "${team.teamName}" across all cards`)

                                        onCardUpdate(updatedCards)
                                      }
                                    } catch (error) {
                                      console.error('Error creating player_team:', error)
                                      if (showToast) {
                                        showToast(error.response?.data?.message || 'Failed to create player-team', 'error')
                                      }
                                    }
                                  }}
                                  title={`Create player-team: ${player.selectedPlayer.playerName} - ${team.teamName} (Player ID: ${player.selectedPlayer.playerId})`}
                                >
                                  <span className="pt-plus">+</span>
                                  <span className="pt-player-name">{player.selectedPlayer.playerName}</span>
                                  <div
                                    className="mini-team-circle"
                                    style={{
                                      '--primary-color': team.primaryColor || '#666',
                                      '--secondary-color': team.secondaryColor || '#999'
                                    }}
                                    title={`${team.teamName} (Player ID: ${player.selectedPlayer.playerId})`}
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
                        tabIndex={2000 + cardIndex}
                      />
                    </td>
                  </tr>
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
              if (cardNeedsWork(card)) {
                needsWork++
              } else {
                ready++
              }
            })

            return (
              <>
                <span className="import-stat-ready">{ready} Ready</span>
                {needsWork > 0 && (
                  <span
                    className="import-stat-needs-work import-stat-clickable"
                    onClick={scrollToFirstProblem}
                    title="Click to scroll to first card that needs attention"
                  >
                    {needsWork} Need Work
                  </span>
                )}
              </>
            )
          })()}
        </div>
      </div>
    </div>
  )
}

export default ImportTable