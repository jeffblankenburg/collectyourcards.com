import React, { useState, useEffect, useRef, useMemo, memo, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { useSearchParams } from 'react-router-dom'
import axios from 'axios'
import { useAuth } from '../contexts/AuthContext'
import { useToast } from '../contexts/ToastContext'
import Icon from '../components/Icon'
import './AdminPlayersScoped.css'

// Memoized component for player name display
const PlayerName = memo(({ player }) => {
  const firstName = player.first_name || ''
  const lastName = player.last_name || ''
  const nickname = player.nick_name || ''
  
  // If we have both first and last name, and a nickname, return JSX with styling
  if (firstName && lastName && nickname) {
    return (
      <span>
        {firstName} <span className="player-nickname-inline">"{nickname}"</span> {lastName}
      </span>
    )
  }
  
  // If we have first and last name but no nickname, format as "First Last"
  if (firstName && lastName) {
    return `${firstName} ${lastName}`
  }
  
  // If we only have nickname, use that
  if (nickname) {
    return nickname
  }
  
  // Fallback to any available name or unknown
  return `${firstName} ${lastName}`.trim() || 'Unknown Player'
})

// Memoized component for team circles (optimized)
const TeamCircles = memo(({ player }) => {
  if (!player.teams || player.teams.length === 0) {
    return (
      <div 
        className="team-circle-base team-circle-sm no-teams" 
        title="No teams assigned"
      >
        —
      </div>
    )
  }
  
  // Remove duplicates based on team_id using Map for better performance
  const uniqueTeamsMap = new Map()
  player.teams.forEach(team => {
    if (!uniqueTeamsMap.has(team.team_id)) {
      uniqueTeamsMap.set(team.team_id, team)
    }
  })
  const uniqueTeams = Array.from(uniqueTeamsMap.values())
  
  return (
    <div className="player-teams">
      {uniqueTeams.map(team => (
        <div
          key={team.team_id}
          className="team-circle-base team-circle-sm"
          style={{
            '--primary-color': team.primary_color || '#666',
            '--secondary-color': team.secondary_color || '#999'
          }}
          title={`${team.name || 'Unknown Team'} (player_team_id: ${team.player_team_id || 'N/A'})`}
        >
          {team.abbreviation || '?'}
        </div>
      ))}
    </div>
  )
})

function AdminPlayers() {
  const [searchParams] = useSearchParams()
  const [players, setPlayers] = useState([])
  const [totalPlayers, setTotalPlayers] = useState(0)
  const [loading, setLoading] = useState(true)
  const [searching, setSearching] = useState(false)
  const [searchTerm, setSearchTerm] = useState(searchParams.get('search') || '')
  const [isSearchMode, setIsSearchMode] = useState(false)
  const [lastUpdated, setLastUpdated] = useState(null)
  const [sortField, setSortField] = useState('player_id')
  const [sortDirection, setSortDirection] = useState('asc')
  const [editingPlayer, setEditingPlayer] = useState(null)
  const [showAddModal, setShowAddModal] = useState(false)
  const [editForm, setEditForm] = useState({})
  const [availableTeams, setAvailableTeams] = useState([])
  const [saving, setSaving] = useState(false)
  const [showTeamDropdown, setShowTeamDropdown] = useState(false)
  const [showReassignModal, setShowReassignModal] = useState(false)
  const [teamToRemove, setTeamToRemove] = useState(null)
  const [reassignToTeam, setReassignToTeam] = useState('')
  const [reassigning, setReassigning] = useState(false)
  const [teamSearchTerm, setTeamSearchTerm] = useState('')
  const [showMergeModal, setShowMergeModal] = useState(false)
  const [playerToMerge, setPlayerToMerge] = useState(null)
  const [mergeTargetSearch, setMergeTargetSearch] = useState('')
  const [mergeTargetResults, setMergeTargetResults] = useState([])
  const [selectedMergeTarget, setSelectedMergeTarget] = useState(null)
  const [merging, setMerging] = useState(false)
  const [dropdownPosition, setDropdownPosition] = useState({ top: 0, left: 0 })
  const [playerToDelete, setPlayerToDelete] = useState(null)
  const [deleting, setDeleting] = useState(false)
  const [showZeroCardsOnly, setShowZeroCardsOnly] = useState(false)
  const [showDuplicatesOnly, setShowDuplicatesOnly] = useState(false)
  const [showCardReassignModal, setShowCardReassignModal] = useState(false)
  const [playerCards, setPlayerCards] = useState([])
  const [selectedCardIds, setSelectedCardIds] = useState([])
  const [playerTeamSearch, setPlayerTeamSearch] = useState('')
  const [playerTeamResults, setPlayerTeamResults] = useState([])
  const [selectedPlayerTeam, setSelectedPlayerTeam] = useState(null)
  const [reassigningCards, setReassigningCards] = useState(false)
  const [collapsedTeams, setCollapsedTeams] = useState(new Set())
  const [showDisplayCardModal, setShowDisplayCardModal] = useState(false)
  const [displayCardOptions, setDisplayCardOptions] = useState([])
  const [selectedDisplayCard, setSelectedDisplayCard] = useState(null)
  const [settingDisplayCard, setSettingDisplayCard] = useState(false)
  const [duplicatePairs, setDuplicatePairs] = useState([])
  const [dismissingPair, setDismissingPair] = useState(null)
  const addButtonRef = useRef(null)
  const playerTeamSearchDebounceRef = useRef(null)
  const { user } = useAuth()
  const { addToast } = useToast()
  const isSuperAdmin = user?.role === 'superadmin'

  useEffect(() => {
    document.title = 'Admin Players - Collect Your Cards'
    // Load with initial search if provided in URL
    loadPlayers(searchParams.get('search') || '')
  }, [])

  const loadPlayers = async (searchQuery = '', zeroCardsFilter = false, duplicatesFilter = false) => {
    const startTime = performance.now()
    const requestId = Math.random().toString(36).substr(2, 9)

    try {
      console.log(`AdminPlayers[${requestId}]: Starting load request`)
      const apiStartTime = performance.now()

      setLoading(!searchQuery && !zeroCardsFilter && !duplicatesFilter) // Only show main loading for initial load
      setSearching(!!searchQuery || zeroCardsFilter || duplicatesFilter) // Show search loading for searches

      const params = new URLSearchParams()
      params.append('limit', '500') // Increase limit for duplicate detection
      if (searchQuery.trim()) {
        params.append('search', searchQuery.trim())
      }
      if (zeroCardsFilter) {
        params.append('zeroCards', 'true')
      }
      if (duplicatesFilter) {
        params.append('duplicates', 'true')
      }

      const response = await axios.get(`/api/admin/players?${params.toString()}`)
      const apiEndTime = performance.now()
      console.log(`AdminPlayers[${requestId}]: API request took ${(apiEndTime - apiStartTime).toFixed(2)}ms`)
      
      const processingStartTime = performance.now()
      const playersData = response.data.players || []
      console.log(`AdminPlayers[${requestId}]: Received ${playersData.length} players from API`)
      
      // More efficient duplicate checking
      const playerIdSet = new Set()
      const duplicateIds = []
      playersData.forEach(p => {
        if (playerIdSet.has(p.player_id)) {
          duplicateIds.push(p.player_id)
        } else {
          playerIdSet.add(p.player_id)
        }
      })
      
      if (duplicateIds.length > 0) {
        console.warn('AdminPlayers: Duplicate player IDs detected from API:', [...new Set(duplicateIds)])
      }
      
      const processingEndTime = performance.now()
      console.log(`AdminPlayers[${requestId}]: Data processing took ${(processingEndTime - processingStartTime).toFixed(2)}ms`)
      
      const stateUpdateStartTime = performance.now()
      setPlayers(playersData)
      setLastUpdated(new Date())
      setIsSearchMode(!!searchQuery.trim())

      // Process duplicate pairs for the pairs view
      if (duplicatesFilter && playersData.length > 0) {
        const pairs = []
        const processedPairIds = new Set()

        playersData.forEach(player => {
          if (player.duplicate_matches && player.duplicate_matches.length > 0) {
            player.duplicate_matches.forEach(match => {
              // Create a unique pair ID to avoid duplicates
              const pairId = [player.player_id, match.player_id].sort((a, b) => a - b).join('-')

              if (!processedPairIds.has(pairId)) {
                processedPairIds.add(pairId)

                // Find the full match player data from playersData
                const matchPlayer = playersData.find(p => p.player_id === match.player_id) || {
                  player_id: match.player_id,
                  first_name: match.first_name,
                  last_name: match.last_name,
                  nick_name: match.nick_name,
                  teams: [],
                  card_count: 0
                }

                pairs.push({
                  pairId,
                  player1: player,
                  player2: matchPlayer
                })
              }
            })
          }
        })

        setDuplicatePairs(pairs)
      } else {
        setDuplicatePairs([])
      }
      
      // Get total count from database if not searching
      if (!searchQuery.trim()) {
        try {
          const countResponse = await axios.get('/api/database/status')
          if (countResponse.data?.records?.players) {
            setTotalPlayers(countResponse.data.records.players)
          }
        } catch (error) {
          console.error('Failed to get total player count:', error)
        }
      }
      
      const stateUpdateEndTime = performance.now()
      const totalTime = stateUpdateEndTime - startTime
      console.log(`AdminPlayers[${requestId}]: State update took ${(stateUpdateEndTime - stateUpdateStartTime).toFixed(2)}ms`)
      console.log(`AdminPlayers[${requestId}]: Total load time: ${totalTime.toFixed(2)}ms`)
      
    } catch (error) {
      console.error('Error loading players:', error)
      addToast(`Failed to load players: ${error.response?.data?.message || error.message}`, 'error')
    } finally {
      setLoading(false)
      setSearching(false)
    }
  }

  const handleSearch = (e) => {
    const value = e.target.value
    setSearchTerm(value)
    
    // Debounce search
    clearTimeout(window.playerSearchTimeout)
    window.playerSearchTimeout = setTimeout(() => {
      loadPlayers(value)
    }, 300)
  }

  const handleRefresh = () => {
    if (isSearchMode) {
      loadPlayers(searchTerm, showZeroCardsOnly, showDuplicatesOnly)
    } else {
      loadPlayers('', showZeroCardsOnly, showDuplicatesOnly)
    }
  }

  const handleZeroCardsToggle = () => {
    const newValue = !showZeroCardsOnly
    setShowZeroCardsOnly(newValue)
    // Turn off duplicates filter when enabling zero cards
    if (newValue) {
      setShowDuplicatesOnly(false)
    }
    loadPlayers(searchTerm, newValue, false)
  }

  const handleDuplicatesToggle = () => {
    const newValue = !showDuplicatesOnly
    setShowDuplicatesOnly(newValue)
    // Turn off zero cards filter when enabling duplicates
    if (newValue) {
      setShowZeroCardsOnly(false)
    }
    loadPlayers(searchTerm, false, newValue)
  }

  const handleSort = (field) => {
    let direction = 'asc'
    if (sortField === field && sortDirection === 'asc') {
      direction = 'desc'
    }
    setSortField(field)
    setSortDirection(direction)
  }

  const sortedPlayers = useMemo(() => {
    console.time('AdminPlayers: Sorting and deduplication')
    console.log(`AdminPlayers: Processing ${players.length} players for sorting`)
    
    // Deduplicate players by player_id using Map for O(n) performance
    const uniquePlayersMap = new Map()
    players.forEach(player => {
      if (!uniquePlayersMap.has(player.player_id)) {
        uniquePlayersMap.set(player.player_id, player)
      }
    })
    const uniquePlayers = Array.from(uniquePlayersMap.values())
    console.log(`AdminPlayers: After deduplication: ${uniquePlayers.length} unique players`)
    
    // Sort the deduplicated players
    const sorted = uniquePlayers.sort((a, b) => {
      let aValue, bValue
      
      switch (sortField) {
        case 'player_id':
          aValue = a.player_id
          bValue = b.player_id
          break
        case 'name':
          aValue = `${a.first_name || ''} ${a.last_name || ''}`.trim().toLowerCase()
          bValue = `${b.first_name || ''} ${b.last_name || ''}`.trim().toLowerCase()
          break
        case 'card_count':
          aValue = a.card_count || 0
          bValue = b.card_count || 0
          break
        case 'is_hof':
          aValue = a.is_hof ? 1 : 0
          bValue = b.is_hof ? 1 : 0
          break
        case 'team_count':
          aValue = a.teams?.length || 0
          bValue = b.teams?.length || 0
          break
        default:
          return 0
      }

      if (aValue < bValue) {
        return sortDirection === 'asc' ? -1 : 1
      }
      if (aValue > bValue) {
        return sortDirection === 'asc' ? 1 : -1
      }
      return 0
    })
    
    console.timeEnd('AdminPlayers: Sorting and deduplication')
    return sorted
  }, [players, sortField, sortDirection])

  const loadTeams = async () => {
    try {
      const response = await axios.get('/api/admin/teams')
      setAvailableTeams(response.data.teams || [])
    } catch (error) {
      console.error('Error loading teams:', error)
      addToast('Failed to load teams', 'error')
    }
  }

  const handleEditPlayer = async (player) => {
    setEditingPlayer(player)
    setEditForm({
      first_name: player.first_name || '',
      last_name: player.last_name || '',
      nick_name: player.nick_name || '',
      birthdate: player.birthdate ? player.birthdate.split('T')[0] : '',
      is_hof: player.is_hof || false
    })

    // Load teams if not already loaded
    if (availableTeams.length === 0) {
      await loadTeams()
    }

    // Load detailed team data with card counts for this player
    try {
      const response = await axios.get(`/api/admin/players/${player.player_id}/teams`)
      // Update the player object with detailed team data that includes card counts
      let updatedPlayer = {
        ...player,
        teams: response.data.teams || []
      }

      // Load display card details if player has one assigned
      if (player.display_card) {
        try {
          const cardResponse = await axios.get(`/api/admin/players/${player.player_id}/cards`)
          const cards = cardResponse.data.cards || []
          const displayCard = cards.find(c => c.card_id === player.display_card)
          if (displayCard) {
            updatedPlayer.displayCardDetails = displayCard
          }
        } catch (error) {
          console.error('Error loading display card details:', error)
        }
      }

      setEditingPlayer(updatedPlayer)
    } catch (error) {
      console.error('Error loading player team details:', error)
      // Continue with existing team data if detailed load fails
    }
  }

  const handleCloseModal = () => {
    setEditingPlayer(null)
    setShowAddModal(false)
    setEditForm({})
    setSaving(false)
    setShowTeamDropdown(false)
    setShowReassignModal(false)
    setTeamToRemove(null)
    setReassignToTeam('')
    setReassigning(false)
    setTeamSearchTerm('')
    setPlayerToDelete(null)
    setDeleting(false)
  }

  const handleShowAddModal = async () => {
    // Reset form
    setEditForm({
      first_name: '',
      last_name: '',
      nick_name: '',
      birthdate: '',
      is_hof: false,
      teams: []
    })
    
    // Load teams if not already loaded
    if (availableTeams.length === 0) {
      await loadTeams()
    }
    
    setShowAddModal(true)
  }

  const handleAddTeamToNewPlayer = (teamId) => {
    const team = availableTeams.find(t => t.team_id === teamId)
    if (team) {
      setEditForm(prev => ({
        ...prev,
        teams: [...(prev.teams || []), team]
      }))
    }
    setShowTeamDropdown(false)
    setTeamSearchTerm('')
  }

  const handleRemoveTeamFromNewPlayer = (teamId) => {
    setEditForm(prev => ({
      ...prev,
      teams: (prev.teams || []).filter(t => t.team_id !== teamId)
    }))
  }

  const handleAddPlayer = async () => {
    try {
      setSaving(true)
      
      // First create the player
      const response = await axios.post('/api/admin/players', {
        first_name: editForm.first_name?.trim() || null,
        last_name: editForm.last_name?.trim() || null,
        nick_name: editForm.nick_name?.trim() || null,
        birthdate: editForm.birthdate || null,
        is_hof: editForm.is_hof || false
      })
      
      const newPlayerId = response.data.player?.player_id
      
      // Then add teams if any were selected
      if (newPlayerId && editForm.teams && editForm.teams.length > 0) {
        for (const team of editForm.teams) {
          try {
            await axios.post(`/api/admin/players/${newPlayerId}/teams`, {
              team_id: team.team_id
            })
          } catch (teamError) {
            console.error(`Error adding team ${team.name}:`, teamError)
            // Continue with other teams even if one fails
          }
        }
      }
      
      addToast('Player created successfully', 'success')

      // Refresh the players list - preserve current filter state
      await loadPlayers(searchTerm, showZeroCardsOnly, showDuplicatesOnly)

      // Close modal
      handleCloseModal()
    } catch (error) {
      console.error('Error creating player:', error)
      addToast(error.response?.data?.message || 'Failed to create player', 'error')
    } finally {
      setSaving(false)
    }
  }

  const handleReassignCards = async () => {
    if (!editingPlayer || !teamToRemove || !reassignToTeam) return
    
    try {
      setReassigning(true)
      
      // First reassign the cards
      await axios.post(`/api/admin/players/${editingPlayer.player_id}/reassign-cards`, {
        from_team_id: teamToRemove.team_id,
        to_team_id: parseInt(reassignToTeam)
      })
      
      // Then remove the team
      await axios.delete(`/api/admin/players/${editingPlayer.player_id}/teams/${teamToRemove.team_id}`)
      
      addToast(`Reassigned ${teamToRemove.card_count} cards and removed team successfully`, 'success')
      
      // Reload detailed team data with updated card counts
      const response = await axios.get(`/api/admin/players/${editingPlayer.player_id}/teams`)
      const updatedPlayer = {
        ...editingPlayer,
        teams: response.data.teams || []
      }
      setEditingPlayer(updatedPlayer)
      
      // Close reassignment modal
      setShowReassignModal(false)
      setTeamToRemove(null)
      setReassignToTeam('')

      // Reload main players list to keep it in sync - preserve current filter state
      await loadPlayers(searchTerm, showZeroCardsOnly, showDuplicatesOnly)
      
    } catch (error) {
      console.error('Error reassigning cards:', error)
      addToast(error.response?.data?.message || 'Failed to reassign cards', 'error')
    } finally {
      setReassigning(false)
    }
  }

  const handleFormChange = (field, value) => {
    setEditForm(prev => ({
      ...prev,
      [field]: value
    }))
  }

  const handleAddTeam = async (teamId) => {
    if (!editingPlayer || !teamId) return
    
    try {
      await axios.post(`/api/admin/players/${editingPlayer.player_id}/teams`, {
        team_id: parseInt(teamId)
      })
      
      addToast('Team added successfully', 'success')

      // Reload detailed team data with card counts
      const response = await axios.get(`/api/admin/players/${editingPlayer.player_id}/teams`)
      const updatedPlayer = {
        ...editingPlayer,
        teams: response.data.teams || []
      }
      setEditingPlayer(updatedPlayer)

      // Reload main players list to keep it in sync - preserve current filter state
      await loadPlayers(searchTerm, showZeroCardsOnly, showDuplicatesOnly)

      // Clear search term and close dropdown
      setTeamSearchTerm('')
      setShowTeamDropdown(false)
    } catch (error) {
      console.error('Error adding team:', error)
      addToast(error.response?.data?.message || 'Failed to add team', 'error')
    }
  }

  const handleRemoveTeam = async (teamId, cardCount) => {
    if (!editingPlayer || !teamId) return
    
    const teamToRemoveObj = editingPlayer.teams.find(t => t.team_id === teamId)
    
    // If there are cards assigned to this team, show reassignment modal
    if (cardCount > 0) {
      const otherTeams = editingPlayer.teams.filter(t => t.team_id !== teamId)
      
      if (otherTeams.length === 0) {
        addToast('Cannot remove team: Player has cards assigned to this team and no other teams to reassign to. Add another team first.', 'error')
        return
      }
      
      // Show reassignment modal
      setTeamToRemove(teamToRemoveObj)
      setReassignToTeam('')
      setShowReassignModal(true)
      return
    }
    
    // If no cards, proceed with direct removal
    try {
      await axios.delete(`/api/admin/players/${editingPlayer.player_id}/teams/${teamId}`)
      
      addToast('Team removed successfully', 'success')

      // Reload detailed team data with card counts
      const response = await axios.get(`/api/admin/players/${editingPlayer.player_id}/teams`)
      const updatedPlayer = {
        ...editingPlayer,
        teams: response.data.teams || []
      }
      setEditingPlayer(updatedPlayer)

      // Reload main players list to keep it in sync - preserve current filter state
      await loadPlayers(searchTerm, showZeroCardsOnly, showDuplicatesOnly)
    } catch (error) {
      console.error('Error removing team:', error)
      const errorMessage = error.response?.data?.message || 'Failed to remove team'
      addToast(errorMessage, 'error')
    }
  }

  const handleSavePlayer = async () => {
    if (!editingPlayer) return
    
    try {
      setSaving(true)
      
      await axios.put(`/api/admin/players/${editingPlayer.player_id}`, {
        first_name: editForm.first_name.trim(),
        last_name: editForm.last_name.trim(),
        nick_name: editForm.nick_name.trim() || null,
        birthdate: editForm.birthdate || null,
        is_hof: editForm.is_hof
      })
      
      addToast('Player updated successfully', 'success')
      handleCloseModal()

      // Reload players to get updated data - preserve current filter state
      loadPlayers(searchTerm, showZeroCardsOnly, showDuplicatesOnly)
    } catch (error) {
      console.error('Error updating player:', error)
      addToast(error.response?.data?.message || 'Failed to update player', 'error')
    } finally {
      setSaving(false)
    }
  }

  const handleDeletePlayer = async () => {
    if (!playerToDelete) return
    
    try {
      setDeleting(true)
      
      await axios.delete(`/api/admin/players/${playerToDelete.player_id}`)
      
      addToast(`Deleted player: ${getPlayerNameString(playerToDelete)}`, 'success')
      
      // Close delete modal
      setPlayerToDelete(null)

      // Reload players to get updated data - preserve current filter state
      await loadPlayers(searchTerm, showZeroCardsOnly, showDuplicatesOnly)
      
    } catch (error) {
      console.error('Error deleting player:', error)
      addToast(error.response?.data?.message || 'Failed to delete player', 'error')
    } finally {
      setDeleting(false)
    }
  }


  // Merge player handler
  const handleMergeTargetSearch = async (searchValue) => {
    setMergeTargetSearch(searchValue)

    if (searchValue.length < 2) {
      setMergeTargetResults([])
      return
    }

    try {
      const response = await axios.get('/api/admin/players', {
        params: {
          search: searchValue,
          limit: 20 // Increase limit since we'll expand to player_team rows
        }
      })

      // Filter out the player being merged and expand to player_team rows
      const players = response.data.players.filter(p => p.player_id !== playerToMerge?.player_id)

      // Expand each player into separate rows for each team
      const expandedResults = []
      players.forEach(player => {
        if (player.teams && player.teams.length > 0) {
          // Create a row for each team
          player.teams.forEach(team => {
            expandedResults.push({
              player_id: player.player_id,
              first_name: player.first_name,
              last_name: player.last_name,
              nick_name: player.nick_name,
              card_count: player.card_count,
              team: team,
              display_name: `${player.first_name || ''} ${player.last_name || ''}`.trim(),
              all_teams: player.teams // Keep reference to all teams for display
            })
          })
        } else {
          // Player with no teams - show as a single row
          expandedResults.push({
            player_id: player.player_id,
            first_name: player.first_name,
            last_name: player.last_name,
            nick_name: player.nick_name,
            card_count: player.card_count,
            team: null,
            display_name: `${player.first_name || ''} ${player.last_name || ''}`.trim(),
            all_teams: []
          })
        }
      })

      setMergeTargetResults(expandedResults)
    } catch (error) {
      console.error('Error searching for merge target:', error)
      addToast('Failed to search for players', 'error')
    }
  }

  const handleMergeConfirm = async () => {
    if (!playerToMerge || !selectedMergeTarget) return

    try {
      setMerging(true)

      await axios.post(`/api/admin/players/${playerToMerge.player_id}/merge`, {
        targetPlayerId: selectedMergeTarget.player_id,
        targetTeamId: selectedMergeTarget.team?.team_id || null
      })

      const teamSuffix = selectedMergeTarget.team ? ` (${selectedMergeTarget.team.name})` : ''
      addToast(
        `Merged ${getPlayerNameString(playerToMerge)} into ${getPlayerNameString(selectedMergeTarget)}${teamSuffix}`,
        'success'
      )

      // Close modal and reload
      setShowMergeModal(false)
      setPlayerToMerge(null)
      setSelectedMergeTarget(null)
      setMergeTargetSearch('')
      setMergeTargetResults([])

      await loadPlayers(searchTerm, showZeroCardsOnly, showDuplicatesOnly)

    } catch (error) {
      console.error('Error merging players:', error)
      addToast(error.response?.data?.message || 'Failed to merge players', 'error')
    } finally {
      setMerging(false)
    }
  }

  // Utility function for getting player name as string (for toasts, etc.)
  const getPlayerNameString = useCallback((player) => {
    const firstName = player.first_name || ''
    const lastName = player.last_name || ''
    const nickname = player.nick_name || ''

    // If we have both first and last name, and a nickname
    if (firstName && lastName && nickname) {
      return `${firstName} "${nickname}" ${lastName}`
    }

    // If we have first and last name but no nickname
    if (firstName && lastName) {
      return `${firstName} ${lastName}`
    }

    // If we only have nickname, use that
    if (nickname) {
      return nickname
    }

    // Fallback to any available name or unknown
    return `${firstName} ${lastName}`.trim() || 'Unknown Player'
  }, [])

  // Dismiss duplicate pair handler
  const handleDismissDuplicate = async (player1Id, player2Id) => {
    const pairId = [player1Id, player2Id].sort((a, b) => a - b).join('-')
    setDismissingPair(pairId)

    try {
      await axios.post('/api/admin/players/duplicates/dismiss', {
        player1_id: player1Id,
        player2_id: player2Id
      })

      addToast('Pair marked as not duplicates', 'success')

      // Remove the pair from the local state
      setDuplicatePairs(prev => prev.filter(p => p.pairId !== pairId))

    } catch (error) {
      console.error('Error dismissing duplicate pair:', error)
      addToast(error.response?.data?.message || 'Failed to dismiss duplicate pair', 'error')
    } finally {
      setDismissingPair(null)
    }
  }

  // Card reassignment handlers
  const handleShowCardReassignModal = async () => {
    if (!editingPlayer) return

    try {
      const response = await axios.get(`/api/admin/players/${editingPlayer.player_id}/cards`)
      const cards = response.data.cards || []
      setPlayerCards(cards)

      // Extract all unique team IDs and collapse them all by default
      const teamIds = new Set(cards.map(card => card.team_id))
      setCollapsedTeams(teamIds)

      setSelectedCardIds([])
      setPlayerTeamSearch('')
      setPlayerTeamResults([])
      setSelectedPlayerTeam(null)
      setShowCardReassignModal(true)
    } catch (error) {
      console.error('Error loading player cards:', error)
      addToast('Failed to load player cards', 'error')
    }
  }

  const handleCardSelection = (cardId) => {
    setSelectedCardIds(prev => {
      if (prev.includes(cardId)) {
        return prev.filter(id => id !== cardId)
      } else {
        return [...prev, cardId]
      }
    })
  }

  const handleSelectAllCards = () => {
    if (selectedCardIds.length === playerCards.length) {
      setSelectedCardIds([])
    } else {
      setSelectedCardIds(playerCards.map(card => card.card_id))
    }
  }

  const handleSelectTeamCards = (teamCards) => {
    const teamCardIds = teamCards.map(card => card.card_id)
    const allTeamCardsSelected = teamCardIds.every(id => selectedCardIds.includes(id))

    if (allTeamCardsSelected) {
      // Deselect all cards from this team
      setSelectedCardIds(prev => prev.filter(id => !teamCardIds.includes(id)))
    } else {
      // Select all cards from this team
      setSelectedCardIds(prev => [...new Set([...prev, ...teamCardIds])])
    }
  }

  const handleToggleTeamCollapse = (teamId) => {
    setCollapsedTeams(prev => {
      const newSet = new Set(prev)
      if (newSet.has(teamId)) {
        newSet.delete(teamId)
      } else {
        newSet.add(teamId)
      }
      return newSet
    })
  }

  const handlePlayerTeamSearch = (searchValue) => {
    setPlayerTeamSearch(searchValue)

    // Clear any existing debounce timer
    if (playerTeamSearchDebounceRef.current) {
      clearTimeout(playerTeamSearchDebounceRef.current)
    }

    if (searchValue.length < 2) {
      setPlayerTeamResults([])
      return
    }

    // Debounce the API call by 300ms
    playerTeamSearchDebounceRef.current = setTimeout(async () => {
      try {
        const response = await axios.get('/api/admin/players/player-teams/search', {
          params: { search: searchValue }
        })

        // Filter out player-teams that belong to the current editing player
        const filteredResults = (response.data.playerTeams || []).filter(
          pt => pt.player_id !== editingPlayer?.player_id
        )

        setPlayerTeamResults(filteredResults)
      } catch (error) {
        console.error('Error searching player-teams:', error)
        addToast('Failed to search player-teams', 'error')
      }
    }, 300)
  }

  const handleReassignSelectedCards = async () => {
    if (!editingPlayer || selectedCardIds.length === 0 || !selectedPlayerTeam) return

    try {
      setReassigningCards(true)

      await axios.post(`/api/admin/players/${editingPlayer.player_id}/reassign-selected-cards`, {
        card_ids: selectedCardIds,
        target_player_team_id: selectedPlayerTeam.player_team_id
      })

      addToast(
        `Reassigned ${selectedCardIds.length} card(s) to ${selectedPlayerTeam.first_name} ${selectedPlayerTeam.last_name} - ${selectedPlayerTeam.team_name}`,
        'success'
      )

      // Close modal
      setShowCardReassignModal(false)
      setSelectedCardIds([])
      setPlayerCards([])
      setPlayerTeamSearch('')
      setPlayerTeamResults([])
      setSelectedPlayerTeam(null)

      // Reload player data
      const response = await axios.get(`/api/admin/players/${editingPlayer.player_id}/teams`)
      const updatedPlayer = {
        ...editingPlayer,
        teams: response.data.teams || []
      }
      setEditingPlayer(updatedPlayer)

      // Reload main players list
      await loadPlayers(searchTerm, showZeroCardsOnly, showDuplicatesOnly)

    } catch (error) {
      console.error('Error reassigning cards:', error)
      addToast(error.response?.data?.message || 'Failed to reassign cards', 'error')
    } finally {
      setReassigningCards(false)
    }
  }

  // Display card handlers
  const handleShowDisplayCardModal = async () => {
    if (!editingPlayer) return

    try {
      const response = await axios.get(`/api/admin/players/${editingPlayer.player_id}/cards`)
      const cards = response.data.cards || []

      // Filter to only cards that have images
      const cardsWithImages = cards.filter(card =>
        card.front_image_url || card.back_image_url
      )

      setDisplayCardOptions(cardsWithImages)
      setSelectedDisplayCard(editingPlayer.display_card || null)
      setShowDisplayCardModal(true)
    } catch (error) {
      console.error('Error loading player cards:', error)
      addToast('Failed to load player cards', 'error')
    }
  }

  const handleSetDisplayCard = async () => {
    if (!editingPlayer) return

    try {
      setSettingDisplayCard(true)

      await axios.put(`/api/admin/players/${editingPlayer.player_id}/display-card`, {
        card_id: selectedDisplayCard
      })

      addToast(
        selectedDisplayCard
          ? 'Display card assigned successfully'
          : 'Display card removed successfully',
        'success'
      )

      // Update the editing player with the new display card
      setEditingPlayer({
        ...editingPlayer,
        display_card: selectedDisplayCard
      })

      // Close modal
      setShowDisplayCardModal(false)
      setDisplayCardOptions([])
      setSelectedDisplayCard(null)

      // Reload main players list
      await loadPlayers(searchTerm, showZeroCardsOnly, showDuplicatesOnly)

    } catch (error) {
      console.error('Error setting display card:', error)
      addToast(error.response?.data?.message || 'Failed to set display card', 'error')
    } finally {
      setSettingDisplayCard(false)
    }
  }

  return (
    <div className="admin-players-page">
      <div className="admin-header">
        <div className="admin-title">
          <Icon name="user" size={32} />
          <h1>{totalPlayers > 0 ? `${totalPlayers.toLocaleString()} Players` : 'Players'}</h1>
        </div>

        <div className="admin-controls">
          <button
            className="new-item-button"
            onClick={handleShowAddModal}
            title="Add new player"
          >
            <Icon name="plus" size={22} />
          </button>
          <button
            className={`filter-button ${showZeroCardsOnly ? 'active' : ''}`}
            onClick={handleZeroCardsToggle}
            title={showZeroCardsOnly ? "Show all players" : "Show only players with 0 cards"}
          >
            <Icon name="filter" size={18} />
            {showZeroCardsOnly ? 'Showing 0 Cards' : '0 Cards'}
          </button>
          <button
            className={`filter-button ${showDuplicatesOnly ? 'active' : ''}`}
            onClick={handleDuplicatesToggle}
            title={showDuplicatesOnly ? "Show all players" : "Show potential duplicate players"}
          >
            <Icon name="copy" size={18} />
            {showDuplicatesOnly ? 'Showing Duplicates' : 'Duplicates'}
          </button>
          <div className="search-box">
            <Icon name="search" size={20} />
            <input
              type="text"
              placeholder="Search players by name..."
              value={searchTerm}
              onChange={handleSearch}
              autoFocus
            />
            {searching && <div className="card-icon-spinner small"></div>}
          </div>
        </div>
      </div>

      <div className="players-content">
        {loading ? (
          <div className="loading-state">
            <div className="card-icon-spinner"></div>
            <span>Loading players...</span>
          </div>
        ) : showDuplicatesOnly ? (
          /* Duplicates Pairs View */
          <div className="players-section">
            <div className="section-header">
              <div className="section-info">
                <h2>Potential Duplicate Pairs ({duplicatePairs.length})</h2>
              </div>
            </div>

            <div className="duplicate-pairs-container">
              {duplicatePairs.length === 0 ? (
                <div className="empty-state">
                  <Icon name="check-circle" size={48} />
                  <h3>No duplicates found</h3>
                  <p>No potential duplicate players were detected in the database.</p>
                </div>
              ) : (
                duplicatePairs.map(pair => (
                  <div key={pair.pairId} className="duplicate-pair-card">
                    {/* Player 1 */}
                    <div className="duplicate-player">
                      <div className="duplicate-player-header">
                        <span className="player-id">ID: {pair.player1.player_id}</span>
                        <span className="player-cards">{(pair.player1.card_count || 0).toLocaleString()} cards</span>
                      </div>
                      <div className="duplicate-player-name">
                        <PlayerName player={pair.player1} />
                        {pair.player1.is_hof && (
                          <span className="hof-indicator" title="Hall of Fame">
                            <Icon name="star" size={14} />
                          </span>
                        )}
                      </div>
                      <div className="duplicate-player-teams">
                        <TeamCircles player={pair.player1} />
                      </div>
                      <div className="duplicate-player-actions">
                        <button
                          className="merge-direction-btn"
                          title={`Merge into ${pair.player1.first_name} ${pair.player1.last_name} (keep this one)`}
                          onClick={() => {
                            setPlayerToMerge(pair.player2)
                            setSelectedMergeTarget({
                              player_id: pair.player1.player_id,
                              first_name: pair.player1.first_name,
                              last_name: pair.player1.last_name,
                              nick_name: pair.player1.nick_name,
                              card_count: pair.player1.card_count,
                              team: pair.player1.teams?.[0] || null,
                              all_teams: pair.player1.teams || []
                            })
                            setShowMergeModal(true)
                          }}
                        >
                          <Icon name="arrow-left" size={16} />
                          Keep This
                        </button>
                      </div>
                    </div>

                    {/* Merge indicator */}
                    <div className="duplicate-merge-indicator">
                      <Icon name="combine" size={24} />
                    </div>

                    {/* Player 2 */}
                    <div className="duplicate-player">
                      <div className="duplicate-player-header">
                        <span className="player-id">ID: {pair.player2.player_id}</span>
                        <span className="player-cards">{(pair.player2.card_count || 0).toLocaleString()} cards</span>
                      </div>
                      <div className="duplicate-player-name">
                        <PlayerName player={pair.player2} />
                        {pair.player2.is_hof && (
                          <span className="hof-indicator" title="Hall of Fame">
                            <Icon name="star" size={14} />
                          </span>
                        )}
                      </div>
                      <div className="duplicate-player-teams">
                        <TeamCircles player={pair.player2} />
                      </div>
                      <div className="duplicate-player-actions">
                        <button
                          className="merge-direction-btn"
                          title={`Merge into ${pair.player2.first_name} ${pair.player2.last_name} (keep this one)`}
                          onClick={() => {
                            setPlayerToMerge(pair.player1)
                            setSelectedMergeTarget({
                              player_id: pair.player2.player_id,
                              first_name: pair.player2.first_name,
                              last_name: pair.player2.last_name,
                              nick_name: pair.player2.nick_name,
                              card_count: pair.player2.card_count,
                              team: pair.player2.teams?.[0] || null,
                              all_teams: pair.player2.teams || []
                            })
                            setShowMergeModal(true)
                          }}
                        >
                          Keep This
                          <Icon name="arrow-right" size={16} />
                        </button>
                      </div>
                    </div>

                    {/* Not a Duplicate button */}
                    <button
                      className="dismiss-duplicate-btn"
                      onClick={() => handleDismissDuplicate(pair.player1.player_id, pair.player2.player_id)}
                      disabled={dismissingPair === pair.pairId}
                      title="Mark as not duplicates - this pair won't appear again"
                    >
                      {dismissingPair === pair.pairId ? (
                        <div className="spinner small"></div>
                      ) : (
                        <Icon name="x" size={16} />
                      )}
                      Not a Duplicate
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        ) : (
          <div className="players-section">
            <div className="section-header">
              <div className="section-info">
                <h2>
                  {isSearchMode
                    ? `Search Results (${players.length})`
                    : `Most Recently Viewed Players (${players.length})`
                  }
                </h2>
              </div>
            </div>

            <div className="players-table">
              <div className="table-header">
                <div className="col-header center">Actions</div>
                <div 
                  className={`col-header sortable ${sortField === 'player_id' ? 'active' : ''}`}
                  onClick={() => handleSort('player_id')}
                >
                  ID
                  {sortField === 'player_id' && (
                    <Icon 
                      name={sortDirection === 'asc' ? 'chevron-up' : 'chevron-down'} 
                      size={14} 
                      className="sort-icon" 
                    />
                  )}
                </div>
                <div 
                  className={`col-header sortable ${sortField === 'name' ? 'active' : ''}`}
                  onClick={() => handleSort('name')}
                >
                  Player
                  {sortField === 'name' && (
                    <Icon 
                      name={sortDirection === 'asc' ? 'chevron-up' : 'chevron-down'} 
                      size={14} 
                      className="sort-icon" 
                    />
                  )}
                </div>
                <div 
                  className={`col-header center sortable ${sortField === 'card_count' ? 'active' : ''}`}
                  onClick={() => handleSort('card_count')}
                >
                  Cards
                  {sortField === 'card_count' && (
                    <Icon 
                      name={sortDirection === 'asc' ? 'chevron-up' : 'chevron-down'} 
                      size={14} 
                      className="sort-icon" 
                    />
                  )}
                </div>
                <div 
                  className={`col-header center sortable ${sortField === 'is_hof' ? 'active' : ''}`}
                  onClick={() => handleSort('is_hof')}
                >
                  HOF
                  {sortField === 'is_hof' && (
                    <Icon 
                      name={sortDirection === 'asc' ? 'chevron-up' : 'chevron-down'} 
                      size={14} 
                      className="sort-icon" 
                    />
                  )}
                </div>
              </div>
              
              {sortedPlayers.map(player => (
                <div 
                  key={player.player_id} 
                  className="player-row"
                  onDoubleClick={() => handleEditPlayer(player)}
                  title="Double-click to edit player"
                >
                  <div className="col-actions">
                    <button
                      className="edit-btn"
                      title="Edit player"
                      onClick={() => handleEditPlayer(player)}
                    >
                      <Icon name="edit" size={16} />
                    </button>
                    <button
                      className="merge-btn"
                      title="Merge this player into another player"
                      onClick={() => {
                        setPlayerToMerge(player)
                        setShowMergeModal(true)
                        setMergeTargetSearch('')
                        setMergeTargetResults([])
                        setSelectedMergeTarget(null)
                      }}
                    >
                      <Icon name="combine" size={16} />
                    </button>
                    {player.card_count === 0 && (
                      <button
                        className="delete-btn"
                        title="Delete player (only allowed for players with 0 cards)"
                        onClick={() => setPlayerToDelete(player)}
                      >
                        <Icon name="trash-2" size={16} />
                      </button>
                    )}
                  </div>
                  <div className="col-id">{player.player_id}</div>
                  <div className="col-player">
                    <div className="player-info">
                      <div className="player-name">
                        <PlayerName player={player} />
                        {player.duplicate_matches && player.duplicate_matches.length > 0 && (
                          <div className="duplicate-matches">
                            <Icon name="alert-triangle" size={14} className="duplicate-icon" />
                            <span className="duplicate-label">Possible duplicates:</span>
                            {player.duplicate_matches.map((match, idx) => (
                              <span key={match.player_id} className="duplicate-match">
                                {match.first_name} {match.nick_name && `"${match.nick_name}"`} {match.last_name}
                                {idx < player.duplicate_matches.length - 1 && ', '}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                      <TeamCircles player={player} />
                    </div>
                  </div>
                  <div className="col-cards">{(player.card_count || 0).toLocaleString()}</div>
                  <div className="col-hof">
                    {player.is_hof && (
                      <div className="hof-badge" title="Hall of Fame">
                        <Icon name="star" size={16} />
                      </div>
                    )}
                  </div>
                </div>
              ))}

              {players.length === 0 && (
                <div className="empty-state">
                  <Icon name="search" size={48} />
                  <h3>No players found</h3>
                  <p>
                    {isSearchMode 
                      ? `No players match "${searchTerm}". Try a different search term.`
                      : 'No recently viewed players found. Players will appear here after users visit their detail pages.'
                    }
                  </p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Edit Player Modal */}
      {editingPlayer && (
        <div className="modal-overlay" onClick={handleCloseModal}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>
                <Icon name="user" size={20} />
                Edit Player #{editingPlayer.player_id}
              </h3>
              <button 
                className="modal-close-btn" 
                onClick={handleCloseModal}
                type="button"
              >
                <Icon name="x" size={20} />
              </button>
            </div>

            <div className="modal-form">
                <div className="form-group">
                  <label>First Name</label>
                  <input
                    type="text"
                    className="form-input"
                    value={editForm.first_name || ''}
                    onChange={(e) => handleFormChange('first_name', e.target.value)}
                    placeholder="First name"
                  />
                </div>

                <div className="form-group">
                  <label>Last Name</label>
                  <input
                    type="text"
                    className="form-input"
                    value={editForm.last_name || ''}
                    onChange={(e) => handleFormChange('last_name', e.target.value)}
                    placeholder="Last name"
                  />
                </div>

                <div className="form-group">
                  <label>Nickname</label>
                  <input
                    type="text"
                    className="form-input"
                    value={editForm.nick_name || ''}
                    onChange={(e) => handleFormChange('nick_name', e.target.value)}
                    placeholder="Optional"
                  />
                </div>

                <div className="form-group">
                  <label>Birthdate</label>
                  <input
                    type="date"
                    className="form-input"
                    value={editForm.birthdate || ''}
                    onChange={(e) => handleFormChange('birthdate', e.target.value)}
                  />
                </div>

                <div className="form-group">
                  <label>Hall of Fame</label>
                  <button
                    type="button"
                    className={`hof-toggle ${editForm.is_hof ? 'hof-active' : ''}`}
                    onClick={() => handleFormChange('is_hof', !editForm.is_hof)}
                  >
                    <Icon name="star" size={16} />
                    <span>Hall of Fame</span>
                    {editForm.is_hof && <Icon name="check" size={16} className="hof-check" />}
                  </button>
                </div>

                {/* Display Card Section */}
                <div className="form-group">
                  <label>Display Card</label>
                  <button
                    type="button"
                    className="set-display-card-btn-main"
                    onClick={handleShowDisplayCardModal}
                    title="Set display card for this player"
                  >
                    <Icon name="image" size={16} />
                    {editingPlayer.display_card ? 'Change Display Card' : 'Set Display Card'}
                  </button>
                  {editingPlayer.displayCardDetails && (
                    <div className="current-display-card">
                      <div className="display-card-images">
                        {editingPlayer.displayCardDetails.front_image_url && (
                          <img src={editingPlayer.displayCardDetails.front_image_url} alt="Front" />
                        )}
                        {editingPlayer.displayCardDetails.back_image_url && (
                          <img src={editingPlayer.displayCardDetails.back_image_url} alt="Back" />
                        )}
                      </div>
                      <div className="display-card-info">
                        <span className="display-card-series">{editingPlayer.displayCardDetails.series_name}</span>
                        <span className="display-card-number">#{editingPlayer.displayCardDetails.card_number}</span>
                      </div>
                    </div>
                  )}
                </div>

                {/* Teams Section */}
                <div className="teams-section">
                  <div className="teams-header">
                    <h4>Teams ({editingPlayer.teams?.length || 0})</h4>
                    <div className="teams-header-actions">
                      <button
                        type="button"
                        className="reassign-cards-btn"
                        onClick={handleShowCardReassignModal}
                        title="Reassign specific cards to another player"
                      >
                        <Icon name="shuffle" size={14} />
                        Reassign Cards
                      </button>
                      <div className="add-team-container">
                      <button
                        ref={addButtonRef}
                        type="button"
                        className={`add-team-btn ${showTeamDropdown ? 'active' : ''}`}
                        onClick={(e) => {
                          if (!showTeamDropdown) {
                            const rect = e.currentTarget.getBoundingClientRect()
                            setDropdownPosition({
                              top: rect.bottom + 8,
                              left: rect.left
                            })
                          }
                          setShowTeamDropdown(!showTeamDropdown)
                        }}
                      >
                        <Icon name={showTeamDropdown ? 'x' : 'plus'} size={16} />
                      </button>
                      
                      {showTeamDropdown && createPortal(
                        <div className="admin-players-page">
                          <div className="team-dropdown" style={{
                            position: 'fixed',
                            top: `${dropdownPosition.top}px`,
                            left: `${dropdownPosition.left}px`,
                            zIndex: 10000,
                            maxHeight: '400px',
                            width: '300px'
                          }}>
                            <div className="team-search-box">
                              <Icon name="search" size={16} />
                              <input
                                type="text"
                                placeholder="Search teams..."
                                value={teamSearchTerm}
                                onChange={(e) => setTeamSearchTerm(e.target.value)}
                                className="team-search-input"
                                autoFocus
                              />
                            </div>
                            <div className="team-options-list">
                              {availableTeams
                                .filter(team => !editingPlayer.teams?.some(pt => pt.team_id === team.team_id))
                                .filter(team =>
                                  !teamSearchTerm.trim() ||
                                  team.name?.toLowerCase().includes(teamSearchTerm.toLowerCase()) ||
                                  team.city?.toLowerCase().includes(teamSearchTerm.toLowerCase()) ||
                                  team.abbreviation?.toLowerCase().includes(teamSearchTerm.toLowerCase())
                                )
                                .map(team => (
                                  <button
                                    key={team.team_id}
                                    type="button"
                                    className="team-option"
                                    onClick={() => {
                                      handleAddTeam(team.team_id)
                                    }}
                                  >
                                    <div
                                      className="team-circle-base team-circle-xs"
                                      style={{
                                        '--primary-color': team.primary_color || '#666',
                                        '--secondary-color': team.secondary_color || '#999'
                                      }}
                                    >
                                      {team.abbreviation}
                                    </div>
                                    <span>{team.name}</span>
                                  </button>
                                ))
                              }
                            </div>
                          </div>
                        </div>,
                        document.body
                      )}
                    </div>
                    </div>
                  </div>

                  <div className="team-warning">
                    <Icon name="warning" size={16} />
                    <span>WARNING: Changes to the team list happen immediately.</span>
                  </div>
                  
                  <div className="teams-list">
                    {editingPlayer.teams && editingPlayer.teams.length > 0 ? (
                      editingPlayer.teams.map(team => (
                        <div key={team.team_id} className="team-item">
                          <div
                            className="team-circle-base team-circle-sm"
                            style={{
                              '--primary-color': team.primary_color || '#666',
                              '--secondary-color': team.secondary_color || '#999'
                            }}
                            title={`${team.name} (player_team_id: ${team.player_team_id || 'N/A'})`}
                          >
                            {team.abbreviation}
                          </div>
                          <div className="team-info">
                            <span className="team-name">
                              {team.name}
                              {team.card_count > 0 && (
                                <>
                                  {' '}
                                  <span style={{
                                    fontSize: '0.65rem',
                                    color: 'rgba(156, 163, 175, 0.9)',
                                    fontWeight: '500',
                                    backgroundColor: 'rgba(156, 163, 175, 0.15)',
                                    padding: '2px 6px',
                                    borderRadius: '10px',
                                    display: 'inline-block'
                                  }}>
                                    {team.card_count}
                                  </span>
                                </>
                              )}
                            </span>
                          </div>
                          <button
                            type="button"
                            className="remove-team-btn"
                            onClick={() => handleRemoveTeam(team.team_id, team.card_count || 0)}
                            title={`Remove ${team.name}${team.card_count > 0 ? ` (${team.card_count} cards will need reassignment)` : ''}`}
                          >
                            <Icon name="minus" size={14} />
                          </button>
                        </div>
                      ))
                    ) : (
                      <div className="no-teams-message">
                        No teams assigned
                      </div>
                    )}
                  </div>
                </div>

                <div className="modal-actions">
                  <button 
                    type="button" 
                    className="btn-cancel" 
                    onClick={handleCloseModal}
                    disabled={saving}
                  >
                    Cancel
                  </button>
                  <button 
                    type="button" 
                    className="btn-primary" 
                    onClick={handleSavePlayer}
                    disabled={saving || (!editForm.first_name?.trim() && !editForm.last_name?.trim() && !editForm.nick_name?.trim())}
                  >
                    {saving ? (
                      <>
                        <div className="spinner"></div>
                        Saving...
                      </>
                    ) : (
                      <>
                        <Icon name="check" size={16} />
                        Save Changes
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
      )}

      {/* Card Reassignment Modal */}
      {showReassignModal && teamToRemove && (
        <div className="modal-overlay" onClick={() => setShowReassignModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>
                <Icon name="refresh-cw" size={20} />
                Reassign Cards
              </h3>
              <button 
                className="modal-close-btn" 
                onClick={() => setShowReassignModal(false)}
                type="button"
              >
                <Icon name="x" size={20} />
              </button>
            </div>

            <div className="modal-form">
              <div className="form-group">
                <div className="reassign-info">
                  <p>
                    <strong>{editingPlayer.first_name} {editingPlayer.last_name}</strong> has{' '}
                    <span className="card-count">{teamToRemove.card_count} cards</span>{' '}
                    assigned to <strong>{teamToRemove.name}</strong>.
                  </p>
                  <p>
                    Before removing this team, you must reassign these cards to another team that {editingPlayer.first_name} {editingPlayer.last_name} is already assigned to.
                  </p>
                </div>
              </div>

              <div className="form-group">
                <label>Reassign cards to:</label>
                <select 
                  className="form-input"
                  value={reassignToTeam}
                  onChange={(e) => setReassignToTeam(e.target.value)}
                  disabled={reassigning}
                >
                  <option value="">Select a team...</option>
                  {editingPlayer.teams
                    .filter(team => team.team_id !== teamToRemove.team_id)
                    .map(team => (
                      <option key={team.team_id} value={team.team_id}>
                        {team.name} ({team.card_count} cards)
                      </option>
                    ))
                  }
                </select>
              </div>

              <div className="modal-actions">
                <button 
                  type="button" 
                  className="btn-cancel" 
                  onClick={() => setShowReassignModal(false)}
                  disabled={reassigning}
                >
                  Cancel
                </button>
                <button 
                  type="button" 
                  className="btn-primary" 
                  onClick={handleReassignCards}
                  disabled={reassigning || !reassignToTeam}
                >
                  {reassigning ? (
                    <>
                      <div className="spinner"></div>
                      Reassigning...
                    </>
                  ) : (
                    <>
                      <Icon name="refresh-cw" size={16} />
                      Reassign {teamToRemove.card_count} Cards & Remove Team
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete Player Confirmation Modal */}
      {playerToDelete && (
        <div className="modal-overlay" onClick={() => setPlayerToDelete(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>
                <Icon name="trash-2" size={20} />
                Delete Player
              </h3>
              <button 
                className="modal-close-btn" 
                onClick={() => setPlayerToDelete(null)}
                type="button"
              >
                <Icon name="x" size={20} />
              </button>
            </div>

            <div className="modal-form">
              <div className="form-group">
                <div className="delete-warning">
                  <Icon name="alert-triangle" size={24} className="warning-icon" />
                  <div className="warning-content">
                    <p>
                      <strong>Are you sure you want to delete this player?</strong>
                    </p>
                    <p>
                      Player: <strong>{getPlayerNameString(playerToDelete)}</strong> (ID: {playerToDelete.player_id})
                    </p>
                    <p>
                      Cards: <strong>{playerToDelete.card_count || 0}</strong>
                    </p>
                    {playerToDelete.card_count > 0 ? (
                      <p className="error-text">
                        <strong>Cannot delete:</strong> This player has {playerToDelete.card_count} cards.
                        Only players with 0 cards can be deleted.
                      </p>
                    ) : (
                      <p className="success-text">
                        This player has no cards and can be safely deleted.
                        This will also remove all player-team relationships.
                      </p>
                    )}
                  </div>
                </div>
              </div>

              <div className="modal-actions">
                <button 
                  type="button" 
                  className="btn-cancel" 
                  onClick={() => setPlayerToDelete(null)}
                  disabled={deleting}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="btn-danger"
                  onClick={handleDeletePlayer}
                  disabled={deleting || playerToDelete.card_count > 0}
                >
                  {deleting ? (
                    <>
                      <div className="spinner"></div>
                      Deleting...
                    </>
                  ) : (
                    <>
                      <Icon name="trash-2" size={16} />
                      Delete Player
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Add Player Modal */}
      {showAddModal && (
        <div className="modal-overlay" onClick={handleCloseModal}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>
                <Icon name="user-plus" size={20} />
                Add New Player
              </h3>
              <button 
                className="modal-close-btn" 
                onClick={handleCloseModal}
                type="button"
              >
                <Icon name="x" size={20} />
              </button>
            </div>

            <div className="modal-form">
                <div className="form-group">
                  <label>First Name</label>
                  <input
                    type="text"
                    className="form-input"
                    value={editForm.first_name || ''}
                    onChange={(e) => handleFormChange('first_name', e.target.value)}
                    placeholder="First name"
                  />
                </div>

                <div className="form-group">
                  <label>Last Name</label>
                  <input
                    type="text"
                    className="form-input"
                    value={editForm.last_name || ''}
                    onChange={(e) => handleFormChange('last_name', e.target.value)}
                    placeholder="Last name"
                  />
                </div>

                <div className="form-group">
                  <label>Nickname</label>
                  <input
                    type="text"
                    className="form-input"
                    value={editForm.nick_name || ''}
                    onChange={(e) => handleFormChange('nick_name', e.target.value)}
                    placeholder="Optional"
                  />
                </div>

                <div className="form-group">
                  <label>Birthdate</label>
                  <input
                    type="date"
                    className="form-input"
                    value={editForm.birthdate || ''}
                    onChange={(e) => handleFormChange('birthdate', e.target.value)}
                  />
                </div>

                <div className="form-group">
                  <label>Hall of Fame</label>
                  <button
                    type="button"
                    className={`hof-toggle ${editForm.is_hof ? 'hof-active' : ''}`}
                    onClick={() => handleFormChange('is_hof', !editForm.is_hof)}
                  >
                    <Icon name="star" size={16} />
                    <span>Hall of Fame</span>
                    {editForm.is_hof && <Icon name="check" size={16} className="hof-check" />}
                  </button>
                </div>

                {/* Teams Section for Add Modal */}
                <div className="teams-section">
                  <div className="teams-header">
                    <h4>Teams ({(editForm.teams || []).length})</h4>
                    <div className="add-team-container">
                      <button
                        ref={addButtonRef}
                        type="button"
                        className={`add-team-btn ${showTeamDropdown ? 'active' : ''}`}
                        onClick={(e) => {
                          if (!showTeamDropdown) {
                            const rect = e.currentTarget.getBoundingClientRect()
                            setDropdownPosition({
                              top: rect.bottom + 8,
                              left: rect.left
                            })
                          }
                          setShowTeamDropdown(!showTeamDropdown)
                        }}
                      >
                        <Icon name={showTeamDropdown ? 'x' : 'plus'} size={16} />
                      </button>
                      
                      {showTeamDropdown && createPortal(
                        <div className="admin-players-page">
                          <div className="team-dropdown" style={{
                            position: 'fixed',
                            top: `${dropdownPosition.top}px`,
                            left: `${dropdownPosition.left}px`,
                            zIndex: 10000,
                            maxHeight: '400px',
                            width: '300px'
                          }}>
                            <div className="team-search-box">
                              <Icon name="search" size={16} />
                              <input
                                type="text"
                                placeholder="Search teams..."
                                value={teamSearchTerm}
                                onChange={(e) => setTeamSearchTerm(e.target.value)}
                                className="team-search-input"
                                autoFocus
                              />
                            </div>
                            <div className="team-options-list">
                              {availableTeams
                                .filter(team => !(editForm.teams || []).some(pt => pt.team_id === team.team_id))
                                .filter(team =>
                                  !teamSearchTerm.trim() ||
                                  team.name?.toLowerCase().includes(teamSearchTerm.toLowerCase()) ||
                                  team.city?.toLowerCase().includes(teamSearchTerm.toLowerCase()) ||
                                  team.abbreviation?.toLowerCase().includes(teamSearchTerm.toLowerCase())
                                )
                                .map(team => (
                                  <button
                                    key={team.team_id}
                                    type="button"
                                    className="team-option"
                                    onClick={() => handleAddTeamToNewPlayer(team.team_id)}
                                  >
                                    <div
                                      className="team-circle-base team-circle-xs"
                                      style={{
                                        '--primary-color': team.primary_color || '#666',
                                        '--secondary-color': team.secondary_color || '#999'
                                      }}
                                    >
                                      {team.abbreviation}
                                    </div>
                                    <span>{team.name}</span>
                                  </button>
                                ))
                              }
                            </div>
                          </div>
                        </div>,
                        document.body
                      )}
                    </div>
                  </div>
                  
                  <div className="teams-list">
                    {(editForm.teams || []).length > 0 ? (
                      (editForm.teams || []).map(team => (
                        <div key={team.team_id} className="team-item">
                          <div
                            className="team-circle-base team-circle-sm"
                            style={{
                              '--primary-color': team.primary_color || '#666',
                              '--secondary-color': team.secondary_color || '#999'
                            }}
                            title={team.name}
                          >
                            {team.abbreviation}
                          </div>
                          <div className="team-info">
                            <span className="team-name">{team.name}</span>
                          </div>
                          <button
                            type="button"
                            className="remove-team-btn"
                            onClick={() => handleRemoveTeamFromNewPlayer(team.team_id)}
                            title={`Remove ${team.name}`}
                          >
                            <Icon name="minus" size={14} />
                          </button>
                        </div>
                      ))
                    ) : (
                      <div className="no-teams-message">
                        No teams assigned
                      </div>
                    )}
                  </div>
                </div>

                <div className="modal-actions">
                <button 
                  type="button" 
                  className="btn-cancel" 
                  onClick={handleCloseModal}
                  disabled={saving}
                >
                  Cancel
                </button>
                <button 
                  type="button" 
                  className="btn-primary" 
                  onClick={handleAddPlayer}
                  disabled={saving || (!editForm.first_name?.trim() && !editForm.last_name?.trim() && !editForm.nick_name?.trim())}
                >
                  {saving ? (
                    <>
                      <div className="spinner"></div>
                      Creating...
                    </>
                  ) : (
                    <>
                      <Icon name="user-plus" size={16} />
                      Create Player
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Merge Player Modal */}
      {showMergeModal && playerToMerge && (
        <div className="modal-overlay" onClick={() => setShowMergeModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>
                <Icon name="combine" size={20} />
                Merge Players
              </h3>
              <button
                className="modal-close-btn"
                onClick={() => setShowMergeModal(false)}
                type="button"
              >
                <Icon name="x" size={20} />
              </button>
            </div>

            <div className="modal-form">
              {/* Player to be eliminated */}
              <div className="form-group">
                <div className="merge-warning">
                  <Icon name="alert-triangle" size={24} className="warning-icon" />
                  <div className="warning-content">
                    <p>
                      <strong>This player will be ELIMINATED:</strong>
                    </p>
                    <p className="player-display">
                      {getPlayerNameString(playerToMerge)} (ID: {playerToMerge.player_id})
                    </p>
                    <p>
                      Cards: <strong>{playerToMerge.card_count || 0}</strong>
                    </p>
                    <p className="error-text">
                      <strong>WARNING:</strong> This action is irreversible. All cards will be reassigned to the target player.
                    </p>
                  </div>
                </div>
              </div>

              {/* Search for target player */}
              <div className="form-group">
                <label>Search for player to merge into:</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="Type player name..."
                  value={mergeTargetSearch}
                  onChange={(e) => handleMergeTargetSearch(e.target.value)}
                  disabled={merging}
                  autoFocus
                />
              </div>

              {/* Search results */}
              {mergeTargetResults.length > 0 && (
                <div className="form-group">
                  <label>Select target player:</label>
                  <div className="merge-results">
                    {mergeTargetResults.map((result, idx) => (
                      <button
                        key={`${result.player_id}-${result.team?.team_id || 'noteam'}-${idx}`}
                        type="button"
                        className={`merge-result-item ${selectedMergeTarget?.player_id === result.player_id && selectedMergeTarget?.team?.team_id === result.team?.team_id ? 'selected' : ''}`}
                        onClick={() => setSelectedMergeTarget(result)}
                        disabled={merging}
                      >
                        <div className="result-info">
                          <div className="result-name-row">
                            <span className="result-name">{getPlayerNameString(result)}</span>
                            {result.team && (
                              <div className="result-primary-team">
                                <div
                                  className="team-circle-base team-circle-sm"
                                  style={{
                                    '--primary-color': result.team.primary_color || '#666',
                                    '--secondary-color': result.team.secondary_color || '#999'
                                  }}
                                  title={`${result.team.name} (player_team_id: ${result.team.player_team_id || 'N/A'})`}
                                >
                                  {result.team.abbreviation}
                                </div>
                                <span className="team-name-display">{result.team.name}</span>
                              </div>
                            )}
                            {!result.team && (
                              <span className="no-team-indicator">(No Team)</span>
                            )}
                          </div>
                          <span className="result-details">
                            ID: {result.player_id} • Cards: {result.card_count || 0} • All Teams: {result.all_teams?.length || 0}
                          </span>
                        </div>
                        {selectedMergeTarget?.player_id === result.player_id && selectedMergeTarget?.team?.team_id === result.team?.team_id && (
                          <Icon name="check-circle" size={20} className="check-icon" />
                        )}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Confirmation section */}
              {selectedMergeTarget && (
                <div className="form-group">
                  <div className="merge-confirmation">
                    <Icon name="arrow-right" size={24} className="arrow-icon" />
                    <div className="confirmation-content">
                      <p>
                        <strong>All cards will be reassigned to:</strong>
                      </p>
                      <div className="confirmation-player-display">
                        <p className="player-display success-text">
                          {getPlayerNameString(selectedMergeTarget)} (ID: {selectedMergeTarget.player_id})
                        </p>
                        {selectedMergeTarget.team && (
                          <div className="confirmation-team">
                            <div
                              className="team-circle-base team-circle-sm"
                              style={{
                                '--primary-color': selectedMergeTarget.team.primary_color || '#666',
                                '--secondary-color': selectedMergeTarget.team.secondary_color || '#999'
                              }}
                              title={`${selectedMergeTarget.team.name} (player_team_id: ${selectedMergeTarget.team.player_team_id || 'N/A'})`}
                            >
                              {selectedMergeTarget.team.abbreviation}
                            </div>
                            <span className="team-name-display">{selectedMergeTarget.team.name}</span>
                          </div>
                        )}
                      </div>
                      <p>
                        After merge, this player will have <strong>{(selectedMergeTarget.card_count || 0) + (playerToMerge.card_count || 0)}</strong> total cards.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              <div className="modal-actions">
                <button
                  type="button"
                  className="btn-cancel"
                  onClick={() => setShowMergeModal(false)}
                  disabled={merging}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="btn-danger"
                  onClick={handleMergeConfirm}
                  disabled={merging || !selectedMergeTarget}
                >
                  {merging ? (
                    <>
                      <div className="spinner"></div>
                      Merging...
                    </>
                  ) : (
                    <>
                      <Icon name="combine" size={16} />
                      Merge Players (Irreversible)
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Selected Cards Reassignment Modal */}
      {showCardReassignModal && editingPlayer && (
        <div className="modal-overlay" onClick={() => setShowCardReassignModal(false)}>
          <div className="modal-content large-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>
                <Icon name="shuffle" size={20} />
                Reassign Selected Cards - {getPlayerNameString(editingPlayer)}
              </h3>
              <button
                className="modal-close-btn"
                onClick={() => setShowCardReassignModal(false)}
                type="button"
              >
                <Icon name="x" size={20} />
              </button>
            </div>

            <div className="modal-form">
              {/* Step 1: Search for target player-team */}
              <div className="form-group">
                <label>Step 1: Search for target player-team</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="Type player name or team name..."
                  value={playerTeamSearch}
                  onChange={(e) => handlePlayerTeamSearch(e.target.value)}
                  disabled={reassigningCards}
                  autoFocus
                />
                {playerTeamSearch.length > 0 && playerTeamSearch.length < 2 && (
                  <p className="field-hint">Type at least 2 characters to search</p>
                )}
              </div>

              {/* Search results */}
              {playerTeamResults.length > 0 && (
                <div className="form-group">
                  <label>Select target player-team:</label>
                  <div className="player-team-results">
                    {playerTeamResults.map((result) => (
                      <button
                        key={result.player_team_id}
                        type="button"
                        className={`player-team-result-item ${selectedPlayerTeam?.player_team_id === result.player_team_id ? 'selected' : ''}`}
                        onClick={() => setSelectedPlayerTeam(result)}
                        disabled={reassigningCards}
                      >
                        <div
                          className="team-circle-base team-circle-sm"
                          style={{
                            '--primary-color': result.primary_color || '#666',
                            '--secondary-color': result.secondary_color || '#999'
                          }}
                          title={result.team_name}
                        >
                          {result.team_abbreviation}
                        </div>
                        <span className="result-name">
                          {result.first_name} {result.last_name}
                        </span>
                        <span className="result-ids">
                          player_id: {result.player_id} • player_team_id: {result.player_team_id}
                        </span>
                        {selectedPlayerTeam?.player_team_id === result.player_team_id && (
                          <Icon name="check-circle" size={20} className="check-icon" />
                        )}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Selected target display */}
              {selectedPlayerTeam && (
                <div className="form-group">
                  <div className="selected-target-display">
                    <Icon name="arrow-right" size={20} className="arrow-icon" />
                    <div className="target-info">
                      <p><strong>Target:</strong> {selectedPlayerTeam.first_name} {selectedPlayerTeam.last_name} - {selectedPlayerTeam.team_name}</p>
                      <p className="target-details">Currently has {selectedPlayerTeam.card_count || 0} cards</p>
                    </div>
                  </div>
                </div>
              )}

              {/* Step 2: Select cards */}
              <div className="form-group">
                <label>Step 2: Select cards to reassign ({selectedCardIds.length} selected)</label>
                {playerCards.length > 0 && (
                  <button
                    type="button"
                    className="select-all-btn"
                    onClick={handleSelectAllCards}
                    disabled={reassigningCards}
                  >
                    {selectedCardIds.length === playerCards.length ? 'Deselect All' : 'Select All'}
                  </button>
                )}
              </div>

              {/* Cards list grouped by team */}
              {playerCards.length > 0 ? (
                <div className="cards-list">
                  {(() => {
                    // Group cards by team
                    const cardsByTeam = {}
                    playerCards.forEach(card => {
                      const teamKey = card.team_id
                      if (!cardsByTeam[teamKey]) {
                        cardsByTeam[teamKey] = {
                          team_name: card.team_name,
                          team_abbreviation: card.team_abbreviation,
                          primary_color: card.primary_color,
                          secondary_color: card.secondary_color,
                          cards: []
                        }
                      }
                      cardsByTeam[teamKey].cards.push(card)
                    })

                    return Object.entries(cardsByTeam).map(([teamId, group]) => {
                      const isCollapsed = collapsedTeams.has(parseInt(teamId))

                      return (
                        <div key={teamId} className="team-card-group">
                          <div className="team-group-header">
                            <button
                              type="button"
                              className="collapse-team-btn"
                              onClick={() => handleToggleTeamCollapse(parseInt(teamId))}
                              disabled={reassigningCards}
                              title={isCollapsed ? "Expand team" : "Collapse team"}
                            >
                              <Icon name={isCollapsed ? 'chevron-right' : 'chevron-down'} size={16} />
                            </button>
                            <div
                              className="team-circle-base team-circle-sm"
                              style={{
                                '--primary-color': group.primary_color || '#666',
                                '--secondary-color': group.secondary_color || '#999'
                              }}
                              title={group.team_name}
                            >
                              {group.team_abbreviation}
                            </div>
                            <span className="team-group-name">{group.team_name} ({group.cards.length} cards)</span>
                            <button
                              type="button"
                              className="select-team-btn"
                              onClick={() => handleSelectTeamCards(group.cards)}
                              disabled={reassigningCards}
                            >
                              {group.cards.every(card => selectedCardIds.includes(card.card_id)) ? 'Deselect All' : 'Select All'}
                            </button>
                          </div>
                          {!isCollapsed && (
                            <div className="team-cards">
                              {group.cards.map(card => (
                                <label key={card.card_id} className="card-checkbox-item">
                                  <input
                                    type="checkbox"
                                    checked={selectedCardIds.includes(card.card_id)}
                                    onChange={() => handleCardSelection(card.card_id)}
                                    disabled={reassigningCards}
                                  />
                                  <span className="card-info">
                                    <span className="card-details">
                                      {card.series_year} {card.series_name} #{card.card_number}
                                    </span>
                                    {(card.is_rc || card.is_auto || card.is_relic || card.is_sp) && (
                                      <span className="card-badges">
                                        {card.is_rc && <span className="badge badge-rc">RC</span>}
                                        {card.is_auto && <span className="badge badge-auto">AUTO</span>}
                                        {card.is_relic && <span className="badge badge-relic">RELIC</span>}
                                        {card.is_sp && <span className="badge badge-sp">SP</span>}
                                      </span>
                                    )}
                                  </span>
                                </label>
                              ))}
                            </div>
                          )}
                        </div>
                      )
                    })
                  })()}
                </div>
              ) : (
                <div className="empty-state">
                  <p>No cards found for this player</p>
                </div>
              )}

              {/* Action buttons */}
              <div className="modal-actions">
                <button
                  type="button"
                  className="btn-cancel"
                  onClick={() => setShowCardReassignModal(false)}
                  disabled={reassigningCards}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="btn-primary"
                  onClick={handleReassignSelectedCards}
                  disabled={reassigningCards || selectedCardIds.length === 0 || !selectedPlayerTeam}
                >
                  {reassigningCards ? (
                    <>
                      <div className="spinner"></div>
                      Reassigning...
                    </>
                  ) : (
                    <>
                      <Icon name="shuffle" size={16} />
                      Reassign {selectedCardIds.length} Card{selectedCardIds.length !== 1 ? 's' : ''}
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Display Card Assignment Modal */}
      {showDisplayCardModal && editingPlayer && (
        <div className="modal-overlay" onClick={() => setShowDisplayCardModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>
                <Icon name="image" size={20} />
                Set Display Card - {getPlayerNameString(editingPlayer)}
              </h3>
              <button
                className="modal-close-btn"
                onClick={() => setShowDisplayCardModal(false)}
                type="button"
              >
                <Icon name="x" size={20} />
              </button>
            </div>

            <div className="modal-form">
              <div className="form-group">
                <p className="field-hint">
                  Select one card to use as the display image for this player on player cards and detail pages.
                </p>
              </div>

              {/* Remove display card option */}
              {editingPlayer.display_card && (
                <div className="form-group">
                  <button
                    type="button"
                    className="remove-display-card-btn"
                    onClick={() => setSelectedDisplayCard(null)}
                    disabled={settingDisplayCard}
                  >
                    <Icon name="x-circle" size={16} />
                    Remove Display Card
                  </button>
                </div>
              )}

              {/* Cards list */}
              {displayCardOptions.length > 0 ? (
                <div className="display-card-options">
                  {(() => {
                    // Group cards by team
                    const cardsByTeam = {}
                    displayCardOptions.forEach(card => {
                      const teamKey = card.team_id
                      if (!cardsByTeam[teamKey]) {
                        cardsByTeam[teamKey] = {
                          team_name: card.team_name,
                          team_abbreviation: card.team_abbreviation,
                          primary_color: card.primary_color,
                          secondary_color: card.secondary_color,
                          cards: []
                        }
                      }
                      cardsByTeam[teamKey].cards.push(card)
                    })

                    return Object.entries(cardsByTeam).map(([teamId, group]) => (
                      <div key={teamId} className="display-card-team-group">
                        <div className="display-card-team-header">
                          <div
                            className="team-circle-base team-circle-sm"
                            style={{
                              '--primary-color': group.primary_color || '#666',
                              '--secondary-color': group.secondary_color || '#999'
                            }}
                            title={group.team_name}
                          >
                            {group.team_abbreviation}
                          </div>
                          <span className="team-name">{group.team_name} ({group.cards.length} cards)</span>
                        </div>
                        <div className="display-card-list">
                          {group.cards.map(card => (
                            <button
                              key={card.card_id}
                              type="button"
                              className={`display-card-option ${selectedDisplayCard === card.card_id ? 'selected' : ''}`}
                              onClick={() => setSelectedDisplayCard(card.card_id)}
                              disabled={settingDisplayCard}
                            >
                              <div className="display-card-images-small">
                                {card.front_image_url && (
                                  <img src={card.front_image_url} alt="Front" />
                                )}
                                {card.back_image_url && (
                                  <img src={card.back_image_url} alt="Back" />
                                )}
                              </div>
                              <div className="card-info">
                                <span className="card-details">
                                  {card.series_name} #{card.card_number}
                                </span>
                              </div>
                              {selectedDisplayCard === card.card_id && (
                                <Icon name="check-circle" size={20} className="check-icon" />
                              )}
                            </button>
                          ))}
                        </div>
                      </div>
                    ))
                  })()}
                </div>
              ) : (
                <div className="empty-state">
                  <Icon name="inbox" size={48} />
                  <p>No cards found for this player</p>
                </div>
              )}

              {/* Action buttons */}
              <div className="modal-actions">
                <button
                  type="button"
                  className="btn-cancel"
                  onClick={() => setShowDisplayCardModal(false)}
                  disabled={settingDisplayCard}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="btn-primary"
                  onClick={handleSetDisplayCard}
                  disabled={settingDisplayCard || selectedDisplayCard === editingPlayer.display_card}
                >
                  {settingDisplayCard ? (
                    <>
                      <div className="spinner"></div>
                      Saving...
                    </>
                  ) : (
                    <>
                      <Icon name="check" size={16} />
                      {selectedDisplayCard ? 'Set Display Card' : 'Remove Display Card'}
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default AdminPlayers