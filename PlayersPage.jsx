import { useState, useEffect } from 'react'
import { useParams, Link, useSearchParams, useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import AdvancedCardTable from '../components/cards/AdvancedCardTable'
import { slugFromName } from '../utils/urlUtils'

const PlayersPage = () => {
  const { id: playerSlug } = useParams()
  const [searchParams] = useSearchParams()
  const { user } = useAuth()
  const navigate = useNavigate()
  
  // Get team filter from URL parameters
  const teamFilter = searchParams.get('team')
  const [teamInfo, setTeamInfo] = useState(null)
  const [loadingTeam, setLoadingTeam] = useState(false)
  const [player, setPlayer] = useState(null)
  const [loading, setLoading] = useState(false)
  const [allPlayers, setAllPlayers] = useState([])
  const [loadingData, setLoadingData] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState([])
  const [isSearching, setIsSearching] = useState(false)
  const [showSearchResults, setShowSearchResults] = useState(false)
  const [selectedIndex, setSelectedIndex] = useState(-1)
  const [selectedTeam, setSelectedTeam] = useState(null)

  // Track player view when viewing individual player
  const trackPlayerView = async (playerId) => {
    if (!user) return
    
    try {
      const response = await fetch(`/api/players/${playerId}/view`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      })
      
      if (!response.ok) {
        console.error('Failed to track player view')
      }
    } catch (error) {
      console.error('Error tracking player view:', error)
    }
  }

  // Search functionality
  const performSearch = async (query) => {
    if (!query.trim()) {
      setSearchResults([])
      setShowSearchResults(false)
      return
    }

    setIsSearching(true)
    
    try {
      const response = await fetch(`/api/players?search=${encodeURIComponent(query)}&limit=10`)
      const data = await response.json()
      
      // Deduplicate search results by player_id
      const uniqueSearchResults = []
      const seenSearchIds = new Set()
      for (const player of (data.players || [])) {
        if (!seenSearchIds.has(player.player_id)) {
          seenSearchIds.add(player.player_id)
          uniqueSearchResults.push(player)
        }
      }
      
      setSearchResults(uniqueSearchResults)
      setShowSearchResults(true)
      setSelectedIndex(-1) // Reset selection when new results arrive
    } catch (error) {
      console.error('Search error:', error)
      setSearchResults([])
    } finally {
      setIsSearching(false)
    }
  }

  // Debounced search effect
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      performSearch(searchQuery)
    }, 300) // 300ms debounce

    return () => clearTimeout(timeoutId)
  }, [searchQuery])

  const handleSearchChange = (e) => {
    const value = e.target.value
    setSearchQuery(value)
    setSelectedIndex(-1) // Reset selection when typing
    
    if (!value.trim()) {
      setShowSearchResults(false)
    }
  }

  const clearSearch = () => {
    setSearchQuery('')
    setSearchResults([])
    setShowSearchResults(false)
    setSelectedIndex(-1)
  }

  // Keyboard navigation handler
  const handleKeyDown = (e) => {
    if (!showSearchResults || searchResults.length === 0) return

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault()
        setSelectedIndex(prev => 
          prev < searchResults.length - 1 ? prev + 1 : 0
        )
        break
      case 'ArrowUp':
        e.preventDefault()
        setSelectedIndex(prev => 
          prev > 0 ? prev - 1 : searchResults.length - 1
        )
        break
      case 'Enter':
        e.preventDefault()
        if (selectedIndex >= 0 && selectedIndex < searchResults.length) {
          const selectedPlayer = searchResults[selectedIndex]
          // Navigate to the selected player
          window.location.href = `/players/${slugFromName(`${selectedPlayer.first_name} ${selectedPlayer.last_name}`)}`
        }
        break
      case 'Escape':
        e.preventDefault()
        setShowSearchResults(false)
        setSelectedIndex(-1)
        break
      default:
        break
    }
  }

  useEffect(() => {
    if (playerSlug) {
      // Convert slug back to searchable name
      const playerName = playerSlug.replace(/-/g, ' ')
      
      // Search for player by name
      setLoading(true)
      fetch(`/api/players?search=${encodeURIComponent(playerName)}&limit=50`)
        .then(res => res.json())
        .then(data => {
          // Find exact match by comparing slugs
          const matchedPlayer = data.players?.find(p => {
            const candidateSlug = slugFromName(`${p.first_name} ${p.last_name}`)
            return candidateSlug === playerSlug
          })
          
          if (matchedPlayer) {
            setPlayer(matchedPlayer)
            // Track the player view
            trackPlayerView(matchedPlayer.player_id)
          }
          setLoading(false)
        })
        .catch(error => {
          console.error('Failed to fetch player:', error)
          setLoading(false)
        })
    }
  }, [playerSlug, user])

  // Auto-select team from query parameter on player detail page
  useEffect(() => {
    if (playerSlug && player && searchParams.get('team')) {
      const teamName = decodeURIComponent(searchParams.get('team'))
      // Find the team in the player's teams
      const team = player.player_teams?.find(pt => pt.team_rel?.name === teamName)
      if (team && team.team_rel) {
        setSelectedTeam({
          team_id: team.team_rel.team_Id,
          name: team.team_rel.name,
          abbreviation: team.team_rel.abbreviation
        })
      }
    }
  }, [playerSlug, player, searchParams])

  // Fetch combined player data for main players page
  useEffect(() => {
    if (!playerSlug) {
      setLoadingData(true)
      
      const fetchPlayerData = async () => {
        // Set a timeout to ensure loading doesn't get stuck
        const timeoutId = setTimeout(() => {
          console.warn('Player data fetch timeout - forcing loading to false')
          setLoadingData(false)
        }, 10000) // 10 second timeout
        
        try {
          // If we have a team filter, only fetch players from that team
          if (teamFilter) {
            // Fetch team info and players in parallel
            const [teamResponse, playersResponse] = await Promise.all([
              fetch(`/api/teams?search=${encodeURIComponent(teamFilter)}&limit=1`),
              fetch(`/api/players?team_name=${encodeURIComponent(teamFilter)}&limit=100`)
            ])
            
            const [teamData, playersData] = await Promise.all([
              teamResponse.json(),
              playersResponse.json()
            ])
            
            // Set team info if we found a match
            if (teamData.teams && teamData.teams.length > 0) {
              setTeamInfo(teamData.teams[0])
            }
            
            // Mark all players as popular (no recent vs popular distinction when filtering by team)
            const playersWithTeamFlag = (playersData.players || []).map(player => ({
              ...player,
              isRecent: false
            }))
            
            setAllPlayers(playersWithTeamFlag)
            clearTimeout(timeoutId)
            setLoadingData(false)
            return
          }
          
          const requests = []
          
          // Fetch recently viewed if user is logged in
          if (user) {
            requests.push(
              fetch('/api/players/recently-viewed?limit=10', {
                headers: {
                  'Authorization': `Bearer ${localStorage.getItem('token')}`
                }
              }).then(res => {
                if (res.ok) {
                  // Handle 304 (Not Modified) responses which have no body
                  if (res.status === 304) {
                    return { players: [] }
                  }
                  return res.json()
                } else {
                  console.warn('Failed to fetch recently viewed players:', res.status)
                  return { players: [] }
                }
              }).catch(error => {
                console.error('Error fetching recently viewed players:', error)
                return { players: [] }
              })
            )
          } else {
            requests.push(Promise.resolve({ players: [] }))
          }
          
          // Fetch popular players
          requests.push(
            fetch('/api/players/popular?limit=30').then(res => {
              if (res.ok) {
                // Handle 304 (Not Modified) responses which have no body
                if (res.status === 304) {
                  return { players: [] }
                }
                return res.json()
              } else {
                console.warn('Failed to fetch popular players:', res.status)
                return { players: [] }
              }
            }).catch(error => {
              console.error('Error fetching popular players:', error)
              return { players: [] }
            })
          )
          
          const [recentlyViewedData, popularPlayersData] = await Promise.all(requests)
          
          // Combine and deduplicate all players (recent first, then popular)
          const combinedPlayers = []
          const seenPlayerIds = new Set()
          
          // Add recently viewed first (highest priority)
          for (const player of (recentlyViewedData.players || [])) {
            if (!seenPlayerIds.has(player.player_id)) {
              seenPlayerIds.add(player.player_id)
              combinedPlayers.push({
                ...player,
                isRecent: true
              })
            }
          }
          
          // Add popular players that aren't already in the list
          for (const player of (popularPlayersData.players || [])) {
            if (!seenPlayerIds.has(player.player_id)) {
              seenPlayerIds.add(player.player_id)
              combinedPlayers.push({
                ...player,
                isRecent: false
              })
            }
          }
          
          setAllPlayers(combinedPlayers)
          // Data loaded successfully
        } catch (error) {
          console.error('Error fetching player data:', error)
          // Set default empty arrays if something goes wrong
          setAllPlayers([])
        } finally {
          clearTimeout(timeoutId) // Clear the timeout
          setLoadingData(false)
        }
      }
      
      fetchPlayerData()
    }
  }, [playerSlug, user?.user_id, teamFilter]) // Include teamFilter in dependencies

  if (playerSlug) {
    // Individual player detail view
    if (loading) {
      return (
        <div className="page-content">
          <div className="page-body">
            <div className="flex justify-center items-center h-full">
              <div className="spinner"></div>
            </div>
          </div>
        </div>
      )
    }

    if (!player) {
      return (
        <div className="page-content">
          <div className="page-body">
            <div className="flex flex-col justify-center items-center h-full text-center">
              <p className="text-gray-500 mb-4">Player not found</p>
              <Link to="/players" className="text-blue-600 hover:text-blue-500">
                ← Back to Players
              </Link>
            </div>
          </div>
        </div>
      )
    }

    return (
      <div className="page-content">
        <div className="page-header">
          {/* Search Box - Same as main players page */}
          <div className="mb-6">
            <div className="max-w-2xl mx-auto" style={{ position: 'relative' }}>
              <div style={{ position: 'relative' }}>
                <input
                  type="text"
                  value={searchQuery}
                  onChange={handleSearchChange}
                  onKeyDown={handleKeyDown}
                  placeholder="Search players..."
                  className="form-input"
                  style={{ 
                    paddingRight: searchQuery ? '6rem' : '3rem',
                    fontSize: '1.125rem',
                    borderRadius: '0.75rem',
                    width: '100%',
                    backgroundColor: 'white',
                    color: 'var(--gray-900)'
                  }}
                  role="combobox"
                  aria-expanded={showSearchResults}
                  aria-haspopup="listbox"
                  aria-activedescendant={selectedIndex >= 0 ? `search-result-${selectedIndex}` : undefined}
                />
                <div
                  style={{
                    position: 'absolute',
                    right: searchQuery ? '3rem' : '0.75rem',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    padding: '0.5rem',
                    color: 'var(--gray-400)',
                    pointerEvents: 'none'
                  }}
                >
                  <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                </div>
                {searchQuery && (
                  <button
                    type="button"
                    onClick={clearSearch}
                    style={{
                      position: 'absolute',
                      right: '0.75rem',
                      top: '50%',
                      transform: 'translateY(-50%)',
                      padding: '0.5rem',
                      color: 'var(--gray-400)',
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                      transition: 'color 0.2s ease'
                    }}
                    onMouseOver={(e) => e.target.style.color = 'var(--gray-600)'}
                    onMouseOut={(e) => e.target.style.color = 'var(--gray-400)'}
                  >
                    <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                )}
              </div>
              
              {/* Search Results Dropdown */}
              {showSearchResults && (searchResults.length > 0 || isSearching) && (
                <div 
                  className="absolute mt-1 bg-white shadow-lg max-h-96 overflow-auto focus:outline-none"
                  style={{ 
                    width: '100%',
                    left: '0',
                    right: '0',
                    border: '1px solid #e5e7eb',
                    boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
                    position: 'absolute',
                    top: '100%',
                    zIndex: 1000,
                    borderRadius: '16px'
                  }}
                  role="listbox"
                  aria-label="Search results"
                >
                  {isSearching ? (
                    <div style={{ padding: '16px', textAlign: 'center', color: '#6b7280' }}>
                      <div className="spinner mx-auto mb-2" style={{ width: '16px', height: '16px' }}></div>
                      Searching...
                    </div>
                  ) : searchResults.length > 0 ? (
                    searchResults.map((searchPlayer, index) => (
                      <div
                        key={searchPlayer.player_id}
                        id={`search-result-${index}`}
                        style={{
                          borderBottom: index < searchResults.length - 1 ? '1px solid #f3f4f6' : 'none',
                          transition: 'background-color 0.15s ease',
                          backgroundColor: selectedIndex === index ? '#e0f2fe' : 'transparent'
                        }}
                        onMouseOver={(e) => {
                          if (selectedIndex !== index) {
                            e.currentTarget.style.backgroundColor = '#f9fafb'
                          }
                        }}
                        onMouseOut={(e) => {
                          e.currentTarget.style.backgroundColor = selectedIndex === index ? '#e0f2fe' : 'transparent'
                        }}
                        onMouseEnter={() => setSelectedIndex(index)}
                        role="option"
                        aria-selected={selectedIndex === index}
                      >
                        <Link
                          to={`/players/${slugFromName(`${searchPlayer.first_name} ${searchPlayer.last_name}`)}`}
                          onClick={clearSearch}
                          style={{
                            display: 'block',
                            padding: '12px 16px',
                            textDecoration: 'none',
                            color: 'inherit'
                          }}
                        >
                          <div style={{ 
                            display: 'grid',
                            gridTemplateColumns: '1fr auto 1fr',
                            alignItems: 'center',
                            gap: '8px',
                            width: '100%'
                          }}>
                            {/* Column 1 - Player name */}
                            <div style={{ minWidth: 0 }}>
                              <div style={{ 
                                fontWeight: '500', 
                                color: '#111827',
                                fontSize: '14px',
                                lineHeight: '1.4'
                              }}>
                                {searchPlayer.first_name}
                                {searchPlayer.nick_name ? (
                                  <span style={{ 
                                    fontWeight: '400',
                                    color: '#6b7280'
                                  }}>
                                    {' '}"{ searchPlayer.nick_name}"{' '}
                                  </span>
                                ) : ' '}
                                {searchPlayer.last_name}
                              </div>
                            </div>
                            
                            {/* Column 2 - Card count */}
                            <div style={{
                              fontSize: '12px',
                              color: '#6b7280',
                              fontWeight: '600',
                              textAlign: 'left',
                              whiteSpace: 'nowrap'
                            }}>
                              {parseInt(searchPlayer.card_count || 0).toLocaleString()} cards
                            </div>
                            
                            {/* Column 3 - Team circles */}
                            <div style={{ 
                              display: 'flex', 
                              gap: '4px',
                              justifyContent: 'flex-end',
                              minWidth: '100px',
                              flexWrap: 'wrap'
                            }}>
                              {searchPlayer.player_teams && searchPlayer.player_teams.length > 0 ? (
                                <>
                                  {searchPlayer.player_teams.map((playerTeam, teamIndex) => {
                                    const team = playerTeam.team_rel;
                                    if (!team) return null;
                                    
                                    // Team color logic (same as player cards)
                                    const getLuminance = (hexColor) => {
                                      const hex = hexColor?.replace('#', '');
                                      if (!hex || hex.length !== 6) return 0.5;
                                      
                                      const r = parseInt(hex.substr(0, 2), 16);
                                      const g = parseInt(hex.substr(2, 2), 16);
                                      const b = parseInt(hex.substr(4, 2), 16);
                                      
                                      return (0.299 * r + 0.587 * g + 0.114 * b) / 255;
                                    };
                                    
                                    // Determine team colors
                                    let bgColor, borderColor;
                                    if (team.primary_color && team.secondary_color) {
                                      const primaryLuminance = getLuminance(team.primary_color);
                                      const secondaryLuminance = getLuminance(team.secondary_color);
                                      
                                      if (primaryLuminance < secondaryLuminance) {
                                        bgColor = team.primary_color;
                                        borderColor = team.secondary_color;
                                      } else {
                                        bgColor = team.secondary_color;
                                        borderColor = team.primary_color;
                                      }
                                    } else {
                                      bgColor = team.primary_color || '#6b7280';
                                      borderColor = team.secondary_color || '#9ca3af';
                                    }
                                    
                                    const getContrastColor = (hexColor) => {
                                      const luminance = getLuminance(hexColor);
                                      return luminance > 0.5 ? '#000000' : '#FFFFFF';
                                    };
                                    
                                    const textColor = getContrastColor(bgColor);
                                    
                                    return (
                                      <div 
                                        key={`team-${team.team_Id}-${teamIndex}`}
                                        style={{
                                          width: '22px',
                                          height: '22px',
                                          backgroundColor: bgColor,
                                          borderRadius: '50%',
                                          display: 'flex',
                                          alignItems: 'center',
                                          justifyContent: 'center',
                                          border: `1px solid ${borderColor}`,
                                          flexShrink: 0
                                        }}
                                        title={team.name}
                                      >
                                        {team.abbreviation && (
                                          <span style={{
                                            color: textColor,
                                            fontSize: '7px',
                                            fontWeight: '700',
                                            lineHeight: '1',
                                            textTransform: 'uppercase'
                                          }}>
                                            {team.abbreviation}
                                          </span>
                                        )}
                                      </div>
                                    );
                                  })}
                                </>
                              ) : (
                                <div style={{ 
                                  fontSize: '12px', 
                                  color: '#9ca3af',
                                  fontStyle: 'italic' 
                                }}>
                                  No teams
                                </div>
                              )}
                            </div>
                          </div>
                        </Link>
                      </div>
                    ))
                  ) : (
                    <div style={{ 
                      padding: '16px', 
                      textAlign: 'center', 
                      color: '#6b7280',
                      fontSize: '14px'
                    }}>
                      No players found
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
          
          <div style={{ 
            background: 'linear-gradient(135deg, #ffffff 0%, #f8fafc 100%)',
            borderRadius: '16px',
            padding: '24px',
            border: '1px solid rgba(229, 231, 235, 0.8)',
            boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05), 0 2px 4px -1px rgba(0, 0, 0, 0.03)',
            marginBottom: '24px'
          }}>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">
              {player.first_name}
              {player.nick_name ? (
                <span style={{ 
                  fontWeight: '400',
                  color: '#6b7280',
                  fontSize: '24px'
                }}>
                  {' '}"{ player.nick_name}"{' '}
                </span>
              ) : ' '}
              {player.last_name}
            </h1>
            
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-4 text-sm text-gray-500">
                {player.is_hof && (
                  <div style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px',
                    backgroundColor: '#fef3c7',
                    color: '#92400e',
                    padding: '6px 12px',
                    borderRadius: '8px',
                    fontSize: '12px',
                    fontWeight: '600',
                    border: '1px solid #fcd34d'
                  }}>
                    <span>⭐</span>
                    <span>Hall of Fame</span>
                  </div>
                )}
                <div style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  backgroundColor: '#f0f9ff',
                  color: '#0369a1',
                  padding: '6px 12px',
                  borderRadius: '8px',
                  fontSize: '12px',
                  fontWeight: '600',
                  border: '1px solid #7dd3fc'
                }}>
                  <svg style={{width: '14px', height: '14px'}} fill="currentColor" viewBox="0 0 24 24">
                    <path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-5 14H7v-2h7v2zm3-4H7v-2h10v2zm0-4H7V7h10v2z"/>
                  </svg>
                  <span>{player.card_count?.toLocaleString() || 0} cards</span>
                </div>
              </div>
              
              {/* Team circles section */}
              {player.player_teams && player.player_teams.length > 0 && (
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px'
                }}>
                  <span style={{
                    fontSize: '12px',
                    fontWeight: '600',
                    color: '#6b7280',
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px'
                  }}>
                    Teams
                  </span>
                  <div style={{
                    display: 'flex',
                    gap: '8px',
                    flexWrap: 'wrap'
                  }}>
                    {player.player_teams.map((playerTeam, index) => {
                      const team = playerTeam.team_rel;
                      if (!team) return null;
                      
                      // Team color logic (same as player cards)
                      const getLuminance = (hexColor) => {
                        const hex = hexColor?.replace('#', '');
                        if (!hex || hex.length !== 6) return 0.5;
                        
                        const r = parseInt(hex.substr(0, 2), 16);
                        const g = parseInt(hex.substr(2, 2), 16);
                        const b = parseInt(hex.substr(4, 2), 16);
                        
                        return (0.299 * r + 0.587 * g + 0.114 * b) / 255;
                      };
                      
                      // Determine team colors
                      let bgColor, borderColor;
                      if (team.primary_color && team.secondary_color) {
                        const primaryLuminance = getLuminance(team.primary_color);
                        const secondaryLuminance = getLuminance(team.secondary_color);
                        
                        if (primaryLuminance < secondaryLuminance) {
                          bgColor = team.primary_color;
                          borderColor = team.secondary_color;
                        } else {
                          bgColor = team.secondary_color;
                          borderColor = team.primary_color;
                        }
                      } else {
                        bgColor = team.primary_color || '#6b7280';
                        borderColor = team.secondary_color || '#9ca3af';
                      }
                      
                      const getContrastColor = (hexColor) => {
                        const luminance = getLuminance(hexColor);
                        return luminance > 0.5 ? '#000000' : '#FFFFFF';
                      };
                      
                      const textColor = getContrastColor(bgColor);
                      
                      return (
                        <div 
                          key={`player-team-${team.team_Id}-${index}`}
                          onClick={() => {
                            if (selectedTeam?.team_id === team.team_Id) {
                              // Clicking the same team deselects it
                              setSelectedTeam(null);
                            } else {
                              // Select this team
                              setSelectedTeam({
                                team_id: team.team_Id,
                                name: team.name,
                                abbreviation: team.abbreviation
                              });
                            }
                          }}
                          style={{
                            width: '36px',
                            height: '36px',
                            backgroundColor: bgColor,
                            borderRadius: '50%',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            border: `2px solid ${borderColor}`,
                            flexShrink: 0,
                            boxShadow: '0 2px 4px rgba(0, 0, 0, 0.1)',
                            transition: 'all 0.2s ease',
                            cursor: 'pointer',
                            position: 'relative'
                          }}
                          onMouseEnter={(e) => {
                            if (selectedTeam?.team_id !== team.team_Id) {
                              e.target.style.transform = 'scale(1.05)'
                            }
                          }}
                          onMouseLeave={(e) => {
                            if (selectedTeam?.team_id !== team.team_Id) {
                              e.target.style.transform = 'scale(1)'
                            }
                          }}
                          title={selectedTeam?.team_id === team.team_Id 
                            ? `${team.name} (${team.city}) - Click to show all teams`
                            : `${team.name} (${team.city}) - Click to filter cards for this team`}
                        >
                          {team.abbreviation && (
                            <span style={{
                              color: textColor,
                              fontSize: '10px',
                              fontWeight: '700',
                              lineHeight: '1',
                              textTransform: 'uppercase'
                            }}>
                              {team.abbreviation}
                            </span>
                          )}
                          {/* Selected team indicator */}
                          {selectedTeam?.team_id === team.team_Id && (
                            <div style={{
                              position: 'absolute',
                              bottom: '-4px',
                              left: '50%',
                              transform: 'translateX(-50%)',
                              width: '24px',
                              height: '3px',
                              backgroundColor: '#2563eb',
                              borderRadius: '2px',
                              boxShadow: '0 1px 3px rgba(37, 99, 235, 0.4)'
                            }} />
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="page-body">
          <AdvancedCardTable 
            key={selectedTeam ? `player-${player.player_id}-team-${selectedTeam.team_id}` : `player-${player.player_id}-all`}
            apiEndpoint={`/api/cards?player_name=${encodeURIComponent(`${player.first_name} ${player.last_name}`)}${selectedTeam ? `&team_id=${selectedTeam.team_id}` : ''}`}
            showPlayerColumn={true}
          />
        </div>
      </div>
    )
  }

  // Players list view
  const PlayerCard = ({ player }) => (
    <Link
      to={`/players/${slugFromName(`${player.first_name} ${player.last_name}`)}`}
      className="block group relative overflow-hidden transition-all duration-300 hover:scale-[1.02] hover:shadow-2xl"
      style={{ 
        aspectRatio: '3/4', 
        width: '100%',
        borderRadius: '16px',
        background: 'linear-gradient(135deg, #ffffff 0%, #f8fafc 100%)',
        border: '1px solid rgba(229, 231, 235, 0.8)',
        boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05), 0 2px 4px -1px rgba(0, 0, 0, 0.03)'
      }}
    >
      {/* Modern gradient overlay */}
      <div className="absolute inset-0 bg-gradient-to-br from-blue-50/30 via-transparent to-purple-50/20 opacity-0 group-hover:opacity-100 transition-opacity duration-300" style={{borderRadius: '16px'}}></div>
      
      {/* Content container with proper spacing */}
      <div style={{
        padding: '20px',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        position: 'relative',
        zIndex: 1
      }}>
        
        {/* Header section - fixed height for consistency */}
        <div style={{
          marginBottom: '4px',
          minHeight: '40px', // Minimum height but allow natural sizing
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'flex-start'
        }}>
          <h3 style={{
            fontSize: '16px',
            fontWeight: '700',
            lineHeight: '1.3',
            color: '#111827',
            marginBottom: '4px',
            transition: 'color 0.2s ease'
          }} className="group-hover:text-blue-700">
            {player.first_name} {player.last_name}
          </h3>
          {player.nick_name && (
            <div style={{
              fontSize: '13px',
              fontWeight: '400',
              color: '#6b7280',
              fontStyle: 'italic',
              lineHeight: '1.3'
            }}>
              "{player.nick_name}"
            </div>
          )}
        </div>

        {/* Team circles section */}
        {player.player_teams && player.player_teams.length > 0 && (
          <div style={{marginBottom: '8px', width: '100%'}}>
            <div style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: '4px',
              width: '190px', // Fixed width to ensure 5 circles fit
              alignItems: 'flex-start',
              justifyContent: 'flex-start'
            }}>
              {player.player_teams.map((playerTeam, index) => {
                const team = playerTeam.team_rel;
                if (!team) return null;
                
                // Team color logic
                const getLuminance = (hexColor) => {
                  const hex = hexColor?.replace('#', '');
                  if (!hex || hex.length !== 6) return 0.5;
                  
                  const r = parseInt(hex.substr(0, 2), 16);
                  const g = parseInt(hex.substr(2, 2), 16);
                  const b = parseInt(hex.substr(4, 2), 16);
                  
                  return (0.299 * r + 0.587 * g + 0.114 * b) / 255;
                };
                
                // Determine team colors
                let bgColor, borderColor;
                if (team.primary_color && team.secondary_color) {
                  const primaryLuminance = getLuminance(team.primary_color);
                  const secondaryLuminance = getLuminance(team.secondary_color);
                  
                  if (primaryLuminance < secondaryLuminance) {
                    bgColor = team.primary_color;
                    borderColor = team.secondary_color;
                  } else {
                    bgColor = team.secondary_color;
                    borderColor = team.primary_color;
                  }
                } else {
                  bgColor = team.primary_color || '#6b7280';
                  borderColor = team.secondary_color || '#9ca3af';
                }
                
                const getContrastColor = (hexColor) => {
                  const luminance = getLuminance(hexColor);
                  return luminance > 0.5 ? '#000000' : '#FFFFFF';
                };
                
                const textColor = getContrastColor(bgColor);
                
                return (
                  <div 
                    key={`team-${team.team_Id}-${index}`}
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      // Navigate to player detail page with team selected
                      navigate(`/players/${slugFromName(`${player.first_name} ${player.last_name}`)}?team=${encodeURIComponent(team.name)}`);
                    }}
                    style={{
                      width: '28px',
                      height: '28px',
                      backgroundColor: bgColor,
                      borderRadius: '50%',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      border: `2px solid ${borderColor}`,
                      flexShrink: 0,
                      boxShadow: '0 2px 4px rgba(0, 0, 0, 0.1)',
                      transition: 'transform 0.2s ease',
                      cursor: 'pointer'
                    }}
                    className="hover:scale-110"
                    title={team.name}
                  >
                    {team.abbreviation && (
                      <span style={{
                        color: textColor,
                        fontSize: '9px',
                        fontWeight: '700',
                        lineHeight: '1',
                        textTransform: 'uppercase'
                      }}>
                        {team.abbreviation}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Hall of Fame badge - positioned after team circles */}
        {player.is_hof && (
          <div style={{marginBottom: '8px'}}>
            <div style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
              backgroundColor: '#fef3c7',
              color: '#92400e',
              padding: '4px 8px',
              borderRadius: '6px',
              fontSize: '11px',
              fontWeight: '600',
              border: '1px solid #fcd34d'
            }}>
              <span>⭐</span>
              <span>Hall of Fame</span>
            </div>
          </div>
        )}
        
        {/* Stats section - pushed to bottom */}
        <div style={{marginTop: 'auto', paddingTop: '8px'}}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '12px 16px',
            backgroundColor: '#f8fafc',
            borderRadius: '10px',
            border: '1px solid #e5e7eb'
          }}>
            <div style={{display: 'flex', alignItems: 'center', gap: '8px'}}>
              <div style={{
                width: '32px',
                height: '32px',
                backgroundColor: '#3b82f6',
                borderRadius: '8px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 2px 4px rgba(59, 130, 246, 0.2)'
              }}>
                <svg style={{width: '16px', height: '16px', color: 'white'}} fill="currentColor" viewBox="0 0 24 24">
                  <path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-5 14H7v-2h7v2zm3-4H7v-2h10v2zm0-4H7V7h10v2z"/>
                </svg>
              </div>
              <div>
                <div style={{
                  fontSize: '11px',
                  color: '#6b7280',
                  fontWeight: '500',
                  textTransform: 'uppercase',
                  letterSpacing: '0.3px'
                }}>
                  Cards
                </div>
                <div style={{
                  fontSize: '16px',
                  fontWeight: '700',
                  color: '#111827'
                }}>
                  {parseInt(player.card_count || 0).toLocaleString()}
                </div>
              </div>
            </div>
            
            {/* Additional badges */}
            <div style={{display: 'flex', gap: '6px', alignItems: 'center'}}>
            </div>
          </div>
        </div>
      </div>
      
    </Link>
  )

  return (
    <div className="page-content">
      <div className="page-header">
        {/* Team Header */}
        {teamFilter && teamInfo && (
          <div style={{ marginBottom: '24px' }}>
            <div style={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: '24px',
              padding: '24px',
              backgroundColor: '#f8fafc',
              borderRadius: '16px',
              border: '1px solid #e5e7eb',
              boxShadow: '0 2px 8px rgba(0, 0, 0, 0.04)'
            }}>
              {/* Team Circle */}
              {teamInfo.primary_color && teamInfo.abbreviation && (
                <div style={{
                  width: '80px',
                  height: '80px',
                  borderRadius: '50%',
                  backgroundColor: teamInfo.primary_color,
                  border: teamInfo.secondary_color ? `3px solid ${teamInfo.secondary_color}` : '3px solid rgba(255,255,255,0.8)',
                  boxShadow: '0 4px 8px rgba(0,0,0,0.1)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '20px',
                  fontWeight: 'bold',
                  color: getTeamTextColor(teamInfo.primary_color),
                  flexShrink: 0
                }}>
                  {teamInfo.abbreviation}
                </div>
              )}
              
              {/* Team Info */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <h1 style={{
                  fontSize: '32px',
                  fontWeight: 'bold',
                  color: '#111827',
                  marginBottom: '8px',
                  lineHeight: '1.2'
                }}>
                  {teamInfo.name}
                </h1>
                
                {teamInfo.organization_rel && (
                  <div style={{
                    fontSize: '16px',
                    color: '#6b7280',
                    fontWeight: '500',
                    marginBottom: '8px'
                  }}>
                    {teamInfo.organization_rel.name}
                  </div>
                )}
                
                <p style={{
                  color: '#6b7280',
                  fontSize: '16px'
                }}>
                  Players who have cards for this team
                </p>
              </div>
              
              {/* Team Stats - Right Side */}
              <div style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '12px',
                alignSelf: 'flex-start'
              }}>
                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  padding: '12px 16px',
                  backgroundColor: '#ffffff',
                  borderRadius: '10px',
                  border: '1px solid #e5e7eb',
                  minWidth: '140px'
                }}>
                  <div style={{display: 'flex', alignItems: 'center', gap: '8px'}}>
                    <div style={{
                      width: '32px',
                      height: '32px',
                      backgroundColor: '#3b82f6',
                      borderRadius: '8px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      boxShadow: '0 2px 4px rgba(59, 130, 246, 0.2)'
                    }}>
                      <svg style={{width: '16px', height: '16px', color: 'white'}} fill="currentColor" viewBox="0 0 24 24">
                        <path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-5 14H7v-2h7v2zm3-4H7v-2h10v2zm0-4H7V7h10v2z"/>
                      </svg>
                    </div>
                    <div>
                      <div style={{
                        fontSize: '11px',
                        color: '#6b7280',
                        fontWeight: '500',
                        textTransform: 'uppercase',
                        letterSpacing: '0.3px'
                      }}>
                        Cards
                      </div>
                      <div style={{
                        fontSize: '16px',
                        fontWeight: '700',
                        color: '#111827'
                      }}>
                        {parseInt(teamInfo.card_count || 0).toLocaleString()}
                      </div>
                    </div>
                  </div>
                </div>
                
                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  padding: '12px 16px',
                  backgroundColor: '#ffffff',
                  borderRadius: '10px',
                  border: '1px solid #e5e7eb',
                  minWidth: '140px'
                }}>
                  <div style={{display: 'flex', alignItems: 'center', gap: '8px'}}>
                    <div style={{
                      width: '32px',
                      height: '32px',
                      backgroundColor: '#10b981',
                      borderRadius: '8px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      boxShadow: '0 2px 4px rgba(16, 185, 129, 0.2)'
                    }}>
                      <svg style={{width: '16px', height: '16px', color: 'white'}} fill="currentColor" viewBox="0 0 24 24">
                        <path d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0z"/>
                      </svg>
                    </div>
                    <div>
                      <div style={{
                        fontSize: '11px',
                        color: '#6b7280',
                        fontWeight: '500',
                        textTransform: 'uppercase',
                        letterSpacing: '0.3px'
                      }}>
                        Players
                      </div>
                      <div style={{
                        fontSize: '16px',
                        fontWeight: '700',
                        color: '#111827'
                      }}>
                        {parseInt(teamInfo.player_count || allPlayers.length || 0).toLocaleString()}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
        
        {/* Search Box */}
        <div className="mt-4">
          <div className="max-w-2xl mx-auto" style={{ position: 'relative' }}>
            <div style={{ position: 'relative' }}>
              <input
                type="text"
                value={searchQuery}
                onChange={handleSearchChange}
                onKeyDown={handleKeyDown}
                placeholder="Search players..."
                className="form-input"
                style={{ 
                  paddingRight: searchQuery ? '6rem' : '3rem',
                  fontSize: '1.125rem',
                  borderRadius: '0.75rem',
                  width: '100%',
                  backgroundColor: 'white',
                  color: 'var(--gray-900)'
                }}
                role="combobox"
                aria-expanded={showSearchResults}
                aria-haspopup="listbox"
                aria-activedescendant={selectedIndex >= 0 ? `search-result-${selectedIndex}` : undefined}
              />
              <div
                style={{
                  position: 'absolute',
                  right: searchQuery ? '3rem' : '0.75rem',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  padding: '0.5rem',
                  color: 'var(--gray-400)',
                  pointerEvents: 'none'
                }}
              >
                <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </div>
              {searchQuery && (
                <button
                  type="button"
                  onClick={clearSearch}
                  style={{
                    position: 'absolute',
                    right: '0.75rem',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    padding: '0.5rem',
                    color: 'var(--gray-400)',
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    transition: 'color 0.2s ease'
                  }}
                  onMouseOver={(e) => e.target.style.color = 'var(--gray-600)'}
                  onMouseOut={(e) => e.target.style.color = 'var(--gray-400)'}
                >
                  <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              )}
            </div>
            
            {/* Search Results Dropdown */}
            {showSearchResults && (searchResults.length > 0 || isSearching) && (
              <div 
                className="absolute mt-1 bg-white shadow-lg max-h-96 overflow-auto focus:outline-none"
                style={{ 
                  width: '100%',
                  left: '0',
                  right: '0',
                  border: '1px solid #e5e7eb',
                  boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
                  position: 'absolute',
                  top: '100%',
                  zIndex: 1000,
                  borderRadius: '16px'
                }}
                role="listbox"
                aria-label="Search results"
              >
                {isSearching ? (
                  <div style={{ padding: '16px', textAlign: 'center', color: '#6b7280' }}>
                    <div className="spinner mx-auto mb-2" style={{ width: '16px', height: '16px' }}></div>
                    Searching...
                  </div>
                ) : searchResults.length > 0 ? (
                  searchResults.map((player, index) => (
                    <div
                      key={player.player_id}
                      id={`search-result-${index}`}
                      style={{
                        borderBottom: index < searchResults.length - 1 ? '1px solid #f3f4f6' : 'none',
                        transition: 'background-color 0.15s ease',
                        backgroundColor: selectedIndex === index ? '#e0f2fe' : 'transparent'
                      }}
                      onMouseOver={(e) => {
                        if (selectedIndex !== index) {
                          e.currentTarget.style.backgroundColor = '#f9fafb'
                        }
                      }}
                      onMouseOut={(e) => {
                        e.currentTarget.style.backgroundColor = selectedIndex === index ? '#e0f2fe' : 'transparent'
                      }}
                      onMouseEnter={() => setSelectedIndex(index)}
                      role="option"
                      aria-selected={selectedIndex === index}
                    >
                      <Link
                        to={`/players/${slugFromName(`${player.first_name} ${player.last_name}`)}`}
                        onClick={clearSearch}
                        style={{
                          display: 'block',
                          padding: '12px 16px',
                          textDecoration: 'none',
                          color: 'inherit'
                        }}
                      >
                        <div style={{ 
                          display: 'grid',
                          gridTemplateColumns: '1fr auto 1fr',
                          alignItems: 'center',
                          gap: '8px',
                          width: '100%'
                        }}>
                          {/* Column 1 - Player name */}
                          <div style={{ minWidth: 0 }}>
                            <div style={{ 
                              fontWeight: '500', 
                              color: '#111827',
                              fontSize: '14px',
                              lineHeight: '1.4'
                            }}>
                              {player.first_name} {player.last_name}
                            </div>
                            {player.nick_name && (
                              <div style={{ 
                                fontSize: '12px', 
                                color: '#6b7280',
                                marginTop: '2px',
                                fontStyle: 'italic'
                              }}>
                                "{player.nick_name}"
                              </div>
                            )}
                          </div>
                          
                          {/* Column 2 - Card count */}
                          <div style={{
                            fontSize: '12px',
                            color: '#6b7280',
                            fontWeight: '600',
                            textAlign: 'left',
                            whiteSpace: 'nowrap'
                          }}>
                            {parseInt(player.card_count || 0).toLocaleString()} cards
                          </div>
                          
                          {/* Column 3 - Team circles */}
                          <div style={{ 
                            display: 'flex', 
                            gap: '4px',
                            justifyContent: 'flex-end',
                            minWidth: '100px',
                            flexWrap: 'wrap'
                          }}>
                            {player.player_teams && player.player_teams.length > 0 ? (
                              <>
                                {player.player_teams.map((playerTeam, index) => {
                                const team = playerTeam.team_rel;
                                if (!team) return null;
                                
                                // Team color logic (same as player cards)
                                const getLuminance = (hexColor) => {
                                  const hex = hexColor?.replace('#', '');
                                  if (!hex || hex.length !== 6) return 0.5;
                                  
                                  const r = parseInt(hex.substr(0, 2), 16);
                                  const g = parseInt(hex.substr(2, 2), 16);
                                  const b = parseInt(hex.substr(4, 2), 16);
                                  
                                  return (0.299 * r + 0.587 * g + 0.114 * b) / 255;
                                };
                                
                                // Determine team colors
                                let bgColor, borderColor;
                                if (team.primary_color && team.secondary_color) {
                                  const primaryLuminance = getLuminance(team.primary_color);
                                  const secondaryLuminance = getLuminance(team.secondary_color);
                                  
                                  if (primaryLuminance < secondaryLuminance) {
                                    bgColor = team.primary_color;
                                    borderColor = team.secondary_color;
                                  } else {
                                    bgColor = team.secondary_color;
                                    borderColor = team.primary_color;
                                  }
                                } else {
                                  bgColor = team.primary_color || '#6b7280';
                                  borderColor = team.secondary_color || '#9ca3af';
                                }
                                
                                const getContrastColor = (hexColor) => {
                                  const luminance = getLuminance(hexColor);
                                  return luminance > 0.5 ? '#000000' : '#FFFFFF';
                                };
                                
                                const textColor = getContrastColor(bgColor);
                                
                                return (
                                  <div 
                                    key={`team-${team.team_Id}-${index}`}
                                    style={{
                                      width: '22px',
                                      height: '22px',
                                      backgroundColor: bgColor,
                                      borderRadius: '50%',
                                      display: 'flex',
                                      alignItems: 'center',
                                      justifyContent: 'center',
                                      border: `1px solid ${borderColor}`,
                                      flexShrink: 0
                                    }}
                                    title={team.name}
                                  >
                                    {team.abbreviation && (
                                      <span style={{
                                        color: textColor,
                                        fontSize: '7px',
                                        fontWeight: '700',
                                        lineHeight: '1',
                                        textTransform: 'uppercase'
                                      }}>
                                        {team.abbreviation}
                                      </span>
                                    )}
                                  </div>
                                );
                              })}
                              </>
                            ) : (
                              <div style={{ 
                                fontSize: '12px', 
                                color: '#9ca3af',
                                fontStyle: 'italic' 
                              }}>
                                No teams
                              </div>
                            )}
                          </div>
                        </div>
                      </Link>
                    </div>
                  ))
                ) : (
                  <div style={{ 
                    padding: '16px', 
                    textAlign: 'center', 
                    color: '#6b7280',
                    fontSize: '14px'
                  }}>
                    No players found
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
        
      </div>

      <div className="page-body overflow-auto">
        {loadingData ? (
          <div className="flex justify-center items-center h-64">
            <div className="spinner"></div>
          </div>
        ) : allPlayers.length > 0 ? (
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 200px))',
              gap: '1rem',
              justifyContent: 'center'
            }}>
              {allPlayers.map((player, index) => (
                <PlayerCard 
                  key={`player-${player.player_id}-${index}`} 
                  player={player} 
                />
              ))}
            </div>
          ) : (
            <div className="text-center py-12">
              <div className="text-gray-400 mb-4">
                <svg style={{width: '48px', height: '48px', margin: '0 auto'}} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0z" />
                </svg>
              </div>
              <p className="text-gray-500">No players found</p>
            </div>
          )}
      </div>
    </div>
  )
}

// Helper function to determine text color based on background
const getTeamTextColor = (hexColor) => {
  if (!hexColor) return '#000000'
  const cleanHex = hexColor.replace('#', '')
  if (cleanHex.length !== 6) return '#000000'
  
  const r = parseInt(cleanHex.substr(0, 2), 16)
  const g = parseInt(cleanHex.substr(2, 2), 16)
  const b = parseInt(cleanHex.substr(4, 2), 16)
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255
  return luminance > 0.5 ? '#000000' : '#FFFFFF'
}

export default PlayersPage