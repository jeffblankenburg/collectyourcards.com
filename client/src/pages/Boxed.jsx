import React, { useState, useEffect, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import axios from 'axios'
import { useAuth } from '../contexts/AuthContext'
import Icon from '../components/Icon'
import './BoxedScoped.css'

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

// Map sport names to emoji (lowercase keys to match database values)
const SPORT_EMOJI = {
  'baseball': '⚾',
  'football': '🏈',
  'basketball': '🏀',
  'hockey': '🏒',
  'soccer': '⚽',
  'golf': '⛳',
  'tennis': '🎾',
  'racing': '🏎️',
  'wrestling': '🤼',
  'boxing': '🥊',
  'mma': '🥊',
  'multi-sport': '🏅'
}

const getSportEmoji = (sportName) => SPORT_EMOJI[sportName?.toLowerCase()] || '🏅'

function Boxed() {
  const { year, username } = useParams()
  const navigate = useNavigate()
  const { isAuthenticated } = useAuth()

  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [currentSlide, setCurrentSlide] = useState(0)
  const [isAnimating, setIsAnimating] = useState(false)

  // Determine if viewing someone else's Boxed
  const isPublicView = !!username
  const currentYear = new Date().getFullYear()
  const displayYear = year ? parseInt(year) : currentYear

  useEffect(() => {
    const title = isPublicView
      ? `${username}'s ${displayYear} Boxed - Collect Your Cards`
      : `${displayYear} Boxed - Collect Your Cards`
    document.title = title

    if (isPublicView) {
      fetchPublicBoxedData()
    } else if (isAuthenticated) {
      fetchBoxedData()
    }
  }, [displayYear, isAuthenticated, username, isPublicView])

  const fetchBoxedData = async () => {
    setLoading(true)
    setError(null)
    try {
      const response = await axios.get(`/api/user/wrapped/${displayYear}`)
      setData(response.data)
    } catch (err) {
      console.error('Error fetching boxed data:', err)
      setError(err.response?.data?.error || 'Failed to load your year in cards')
    } finally {
      setLoading(false)
    }
  }

  const fetchPublicBoxedData = async () => {
    setLoading(true)
    setError(null)
    try {
      const response = await axios.get(`/api/user/wrapped/public/${username}/${displayYear}`)
      setData(response.data)
    } catch (err) {
      console.error('Error fetching public boxed data:', err)
      if (err.response?.status === 404) {
        setError('This user\'s Boxed is not available or their profile is not public')
      } else {
        setError(err.response?.data?.error || 'Failed to load Boxed data')
      }
    } finally {
      setLoading(false)
    }
  }

  const goToSlide = useCallback((index) => {
    if (isAnimating) return
    setIsAnimating(true)
    setCurrentSlide(index)
    setTimeout(() => setIsAnimating(false), 400)
  }, [isAnimating])

  const nextSlide = useCallback(() => {
    if (data && currentSlide < slides.length - 1) {
      goToSlide(currentSlide + 1)
    }
  }, [currentSlide, data, goToSlide])

  const prevSlide = useCallback(() => {
    if (currentSlide > 0) {
      goToSlide(currentSlide - 1)
    }
  }, [currentSlide, goToSlide])

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'ArrowRight' || e.key === ' ') {
        e.preventDefault()
        nextSlide()
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault()
        prevSlide()
      } else if (e.key === 'Escape') {
        navigate('/')
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [nextSlide, prevSlide, navigate])

  // Download shareable image
  const downloadShareImage = useCallback(async () => {
    if (!data) return

    // First, load the logo image to get its dimensions
    const logoImg = new Image()
    logoImg.crossOrigin = 'anonymous'

    await new Promise((resolve, reject) => {
      logoImg.onload = resolve
      logoImg.onerror = reject
      logoImg.src = `/images/${displayYear}_boxed.png`
    })

    // Calculate dimensions
    const width = 1080
    const logoMaxWidth = 340
    const logoScale = logoMaxWidth / logoImg.width
    const logoDrawWidth = logoImg.width * logoScale
    const logoDrawHeight = logoImg.height * logoScale
    const logoX = (width - logoDrawWidth) / 2
    const logoY = 25

    // Calculate content height to determine canvas size
    const statsStartY = logoY + logoDrawHeight + 20
    const cardsBoxHeight = 100
    const listRowHeight = 28
    const playersBoxHeight = 36 + (Math.min(data.top_players.length, 5) * listRowHeight) + 12
    const teamsBoxHeight = 36 + (Math.min(data.top_teams.length, 5) * listRowHeight) + 12
    const personalityBoxHeight = 70
    const totalsHeaderHeight = 28
    const totalsBoxHeight = 70
    const sectionGap = 8

    const specialsBoxHeight = 70
    const contentEndY = statsStartY + cardsBoxHeight + sectionGap + playersBoxHeight + sectionGap + teamsBoxHeight + sectionGap + personalityBoxHeight + sectionGap + totalsHeaderHeight + totalsBoxHeight + specialsBoxHeight

    // Dynamic height based on content + footer
    const footerSpace = 55 // Space for footer text + bottom padding
    const height = contentEndY + footerSpace

    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('2d')
    canvas.width = width
    canvas.height = height

    // Background - solid dark
    ctx.fillStyle = '#0a0a0f'
    ctx.fillRect(0, 0, width, height)

    // Subtle grid pattern
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.03)'
    ctx.lineWidth = 1
    for (let i = 0; i < width; i += 40) {
      ctx.beginPath()
      ctx.moveTo(i, 0)
      ctx.lineTo(i, height)
      ctx.stroke()
    }
    for (let i = 0; i < height; i += 40) {
      ctx.beginPath()
      ctx.moveTo(0, i)
      ctx.lineTo(width, i)
      ctx.stroke()
    }

    const centerX = width / 2

    // === BOXED LOGO IMAGE ===
    ctx.drawImage(logoImg, logoX, logoY, logoDrawWidth, logoDrawHeight)

    // === STATS GRID ===
    const statBoxWidth = 700
    const statBoxX = (width - statBoxWidth) / 2
    const statBoxPadding = 40

    // Helper function to fit text within max width
    const fitText = (text, maxWidth, baseSize, fontWeight = '700') => {
      let fontSize = baseSize
      ctx.font = `${fontWeight} ${fontSize}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif`
      while (ctx.measureText(text).width > maxWidth && fontSize > 16) {
        fontSize -= 2
        ctx.font = `${fontWeight} ${fontSize}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif`
      }
      return fontSize
    }

    // Cards Added stat with growth
    ctx.fillStyle = 'rgba(255, 255, 255, 0.03)'
    ctx.fillRect(statBoxX, statsStartY, statBoxWidth, cardsBoxHeight)
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)'
    ctx.lineWidth = 2
    ctx.strokeRect(statBoxX, statsStartY, statBoxWidth, cardsBoxHeight)

    ctx.textAlign = 'center'
    ctx.font = '500 14px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif'
    ctx.fillStyle = 'rgba(255, 255, 255, 0.5)'
    ctx.fillText('CARDS ADDED', centerX, statsStartY + 24)

    ctx.font = '900 42px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif'
    ctx.fillStyle = '#4ade80'
    ctx.fillText(data.collection.cards_added.toLocaleString(), centerX, statsStartY + 62)

    // Growth percentage
    if (data.collection.growth_percentage) {
      const growth = parseFloat(data.collection.growth_percentage)
      const isPositive = growth > 0
      ctx.font = '600 16px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif'
      ctx.fillStyle = isPositive ? '#4ade80' : '#f87171'
      const growthText = `${isPositive ? '▲' : '▼'} ${Math.abs(growth)}% vs last year`
      ctx.fillText(growthText, centerX, statsStartY + 88)
    }

    // === TOP 5 PLAYERS ===
    const playersY = statsStartY + cardsBoxHeight + sectionGap

    ctx.fillStyle = 'rgba(251, 191, 36, 0.06)'
    ctx.fillRect(statBoxX, playersY, statBoxWidth, playersBoxHeight)
    ctx.strokeStyle = 'rgba(251, 191, 36, 0.25)'
    ctx.lineWidth = 2
    ctx.strokeRect(statBoxX, playersY, statBoxWidth, playersBoxHeight)

    ctx.font = '500 14px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif'
    ctx.fillStyle = 'rgba(255, 255, 255, 0.5)'
    ctx.fillText('TOP 5 PLAYERS', centerX, playersY + 24)

    // Draw player rows
    data.top_players.slice(0, 5).forEach((player, i) => {
      const rowY = playersY + 44 + (i * listRowHeight)
      const rowPadding = 60

      // Rank
      ctx.font = '600 16px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif'
      ctx.fillStyle = i === 0 ? '#fbbf24' : 'rgba(255, 255, 255, 0.4)'
      ctx.textAlign = 'left'
      ctx.fillText(`${i + 1}.`, statBoxX + rowPadding, rowY)

      // Player name
      ctx.font = i === 0 ? '700 18px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif' : '500 16px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif'
      ctx.fillStyle = i === 0 ? '#fbbf24' : '#ffffff'
      ctx.fillText(player.name, statBoxX + rowPadding + 30, rowY)

      // Card count
      ctx.font = '500 14px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif'
      ctx.fillStyle = 'rgba(255, 255, 255, 0.5)'
      ctx.textAlign = 'right'
      ctx.fillText(`${player.count.toLocaleString()}`, statBoxX + statBoxWidth - rowPadding, rowY)
    })
    ctx.textAlign = 'center'

    // === TOP 5 TEAMS ===
    const teamsY = playersY + playersBoxHeight + sectionGap

    ctx.fillStyle = 'rgba(255, 255, 255, 0.03)'
    ctx.fillRect(statBoxX, teamsY, statBoxWidth, teamsBoxHeight)
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)'
    ctx.lineWidth = 2
    ctx.strokeRect(statBoxX, teamsY, statBoxWidth, teamsBoxHeight)

    ctx.font = '500 14px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif'
    ctx.fillStyle = 'rgba(255, 255, 255, 0.5)'
    ctx.fillText('TOP 5 TEAMS', centerX, teamsY + 24)

    // Draw team rows with circles
    data.top_teams.slice(0, 5).forEach((team, i) => {
      const rowY = teamsY + 44 + (i * listRowHeight)
      const rowPadding = 60
      const circleRadius = 10

      // Team Circle
      const circleCenterX = statBoxX + rowPadding + 14
      const circleCenterY = rowY - 4

      ctx.beginPath()
      ctx.arc(circleCenterX, circleCenterY, circleRadius, 0, Math.PI * 2)
      ctx.fillStyle = team.primary_color || '#666666'
      ctx.fill()
      ctx.strokeStyle = team.secondary_color || '#999999'
      ctx.lineWidth = 2
      ctx.stroke()

      // Abbreviation in circle
      if (team.abbreviation) {
        ctx.font = '700 7px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif'
        ctx.fillStyle = '#ffffff'
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        ctx.fillText(team.abbreviation, circleCenterX, circleCenterY)
        ctx.textBaseline = 'alphabetic'
      }

      // Team name
      ctx.font = i === 0 ? '700 18px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif' : '500 16px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif'
      ctx.fillStyle = i === 0 ? '#ffffff' : 'rgba(255, 255, 255, 0.85)'
      ctx.textAlign = 'left'
      ctx.fillText(team.name, statBoxX + rowPadding + 34, rowY)

      // Card count
      ctx.font = '500 14px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif'
      ctx.fillStyle = 'rgba(255, 255, 255, 0.5)'
      ctx.textAlign = 'right'
      ctx.fillText(`${team.count.toLocaleString()}`, statBoxX + statBoxWidth - rowPadding, rowY)
    })
    ctx.textAlign = 'center'

    // === COLLECTOR TYPE ===
    const personalityY = teamsY + teamsBoxHeight + sectionGap
    ctx.fillStyle = 'rgba(255, 255, 255, 0.03)'
    ctx.fillRect(statBoxX, personalityY, statBoxWidth, personalityBoxHeight)
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)'
    ctx.lineWidth = 2
    ctx.strokeRect(statBoxX, personalityY, statBoxWidth, personalityBoxHeight)

    ctx.font = '500 14px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif'
    ctx.fillStyle = 'rgba(255, 255, 255, 0.5)'
    ctx.fillText('COLLECTOR TYPE', centerX, personalityY + 24)

    // Emoji and type side by side, centered
    const personalityType = data.personality.type
    ctx.font = '36px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif'
    const emojiWidth = ctx.measureText(data.personality.emoji).width
    fitText(personalityType, statBoxWidth - statBoxPadding * 2 - emojiWidth - 20, 28, '700')
    const typeWidth = ctx.measureText(personalityType).width
    const totalPersonalityWidth = emojiWidth + 12 + typeWidth
    const personalityStartX = centerX - totalPersonalityWidth / 2

    ctx.font = '36px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif'
    ctx.fillText(data.personality.emoji, personalityStartX + emojiWidth / 2, personalityY + 56)

    ctx.fillStyle = '#ffffff'
    ctx.textAlign = 'left'
    fitText(personalityType, statBoxWidth - statBoxPadding * 2 - emojiWidth - 20, 28, '700')
    ctx.fillText(personalityType, personalityStartX + emojiWidth + 12, personalityY + 52)
    ctx.textAlign = 'center'

    // === TOTALS SECTION ===
    const totalsHeaderY = personalityY + personalityBoxHeight + sectionGap
    const totalsY = totalsHeaderY + totalsHeaderHeight
    const totalsColWidth = statBoxWidth / 3

    // Header bar
    ctx.fillStyle = 'rgba(255, 255, 255, 0.05)'
    ctx.fillRect(statBoxX, totalsHeaderY, statBoxWidth, totalsHeaderHeight)
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)'
    ctx.lineWidth = 2
    ctx.strokeRect(statBoxX, totalsHeaderY, statBoxWidth, totalsHeaderHeight)

    ctx.font = '600 14px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif'
    ctx.fillStyle = 'rgba(255, 255, 255, 0.5)'
    ctx.fillText('MY COLLECTION STATS', centerX, totalsHeaderY + 19)

    // Totals row
    ctx.fillStyle = 'rgba(255, 255, 255, 0.03)'
    ctx.fillRect(statBoxX, totalsY, statBoxWidth, totalsBoxHeight)
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)'
    ctx.lineWidth = 2
    ctx.strokeRect(statBoxX, totalsY, statBoxWidth, totalsBoxHeight)

    // Total Cards
    ctx.font = '500 12px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif'
    ctx.fillStyle = 'rgba(255, 255, 255, 0.5)'
    ctx.fillText('TOTAL CARDS', statBoxX + totalsColWidth / 2, totalsY + 22)
    ctx.font = '700 24px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif'
    ctx.fillStyle = '#ffffff'
    ctx.fillText(data.collection.total_collection_size.toLocaleString(), statBoxX + totalsColWidth / 2, totalsY + 52)

    // Total Players
    ctx.font = '500 12px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif'
    ctx.fillStyle = 'rgba(255, 255, 255, 0.5)'
    ctx.fillText('PLAYERS', statBoxX + totalsColWidth + totalsColWidth / 2, totalsY + 22)
    ctx.font = '700 24px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif'
    ctx.fillStyle = '#ffffff'
    ctx.fillText(data.collection.unique_players.toLocaleString(), statBoxX + totalsColWidth + totalsColWidth / 2, totalsY + 52)

    // Total Value
    ctx.font = '500 12px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif'
    ctx.fillStyle = 'rgba(255, 255, 255, 0.5)'
    ctx.fillText('EST. VALUE', statBoxX + totalsColWidth * 2 + totalsColWidth / 2, totalsY + 22)
    ctx.font = '700 24px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif'
    ctx.fillStyle = '#4ade80'
    const valueText = data.collection.total_value_added > 0
      ? `$${data.collection.total_value_added.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`
      : '$0'
    ctx.fillText(valueText, statBoxX + totalsColWidth * 2 + totalsColWidth / 2, totalsY + 52)

    // === SPECIAL CARDS ROW (Row 2) ===
    const specialsY = totalsY + totalsBoxHeight

    ctx.fillStyle = 'rgba(255, 255, 255, 0.03)'
    ctx.fillRect(statBoxX, specialsY, statBoxWidth, specialsBoxHeight)
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)'
    ctx.lineWidth = 2
    ctx.strokeRect(statBoxX, specialsY, statBoxWidth, specialsBoxHeight)

    // Rookies
    ctx.font = '500 12px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif'
    ctx.fillStyle = 'rgba(255, 255, 255, 0.5)'
    ctx.fillText('ROOKIES', statBoxX + totalsColWidth / 2, specialsY + 22)
    ctx.font = '700 24px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif'
    ctx.fillStyle = '#f59e0b'
    ctx.fillText((data.attributes?.rookies || 0).toLocaleString(), statBoxX + totalsColWidth / 2, specialsY + 52)

    // Autographs
    ctx.font = '500 12px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif'
    ctx.fillStyle = 'rgba(255, 255, 255, 0.5)'
    ctx.fillText('AUTOGRAPHS', statBoxX + totalsColWidth + totalsColWidth / 2, specialsY + 22)
    ctx.font = '700 24px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif'
    ctx.fillStyle = '#8b5cf6'
    ctx.fillText((data.attributes?.autographs || 0).toLocaleString(), statBoxX + totalsColWidth + totalsColWidth / 2, specialsY + 52)

    // Relics
    ctx.font = '500 12px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif'
    ctx.fillStyle = 'rgba(255, 255, 255, 0.5)'
    ctx.fillText('RELICS', statBoxX + totalsColWidth * 2 + totalsColWidth / 2, specialsY + 22)
    ctx.font = '700 24px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif'
    ctx.fillStyle = '#06b6d4'
    ctx.fillText((data.attributes?.relics || 0).toLocaleString(), statBoxX + totalsColWidth * 2 + totalsColWidth / 2, specialsY + 52)

    // === FOOTER ===
    const footerY = specialsY + specialsBoxHeight + 35
    ctx.font = '500 20px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif'
    ctx.fillStyle = 'rgba(255, 255, 255, 0.3)'
    const footerText = data.public_profile_url
      ? `See my collection at ${data.public_profile_url.replace('https://', '')}`
      : 'collectyourcards.com'
    ctx.fillText(footerText, centerX, footerY)

    // Download
    const link = document.createElement('a')
    link.download = `boxed-${displayYear}.png`
    link.href = canvas.toDataURL('image/png')
    link.click()
  }, [data, displayYear])

  // Only require authentication for viewing your own Boxed (not public views)
  if (!isPublicView && !isAuthenticated) {
    return (
      <div className="boxed-page">
        <div className="boxed-auth-required">
          <div className="boxed-lock-icon">
            <Icon name="lock" size={32} />
          </div>
          <h2>Sign in to view your Boxed</h2>
          <p>See your year in cards by signing in to your account.</p>
          <button onClick={() => navigate('/login')} className="boxed-login-btn">
            Sign In
          </button>
        </div>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="boxed-page">
        <div className="boxed-loading">
          <div className="boxed-loading-box"></div>
          <p>Opening {isPublicView ? `${username}'s` : 'your'} {displayYear} box...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="boxed-page">
        <div className="boxed-error">
          <Icon name="alert-circle" size={48} />
          <h2>Oops!</h2>
          <p>{error}</p>
          <button onClick={isPublicView ? fetchPublicBoxedData : fetchBoxedData} className="boxed-retry-btn">
            Try Again
          </button>
        </div>
      </div>
    )
  }

  if (!data) return null

  // Build slides array
  const slides = [
    // Intro slide
    {
      id: 'intro',
      content: (
        <div className="boxed-slide boxed-slide-intro">
          <img
            src={`/images/${displayYear}_boxed.png`}
            alt={`${displayYear} Boxed`}
            className="boxed-intro-image"
          />
          <p className="boxed-intro-subtitle">
            {isPublicView ? `${data.user?.name || username}'s year in cards` : 'Your year in cards, all wrapped up'}
          </p>
          <div className="boxed-intro-hint">
            <Icon name="chevron-right" size={20} />
            <span>Tap to open</span>
          </div>
        </div>
      )
    },
    // Cards added
    {
      id: 'cards-added',
      content: (
        <div className="boxed-slide boxed-slide-stats">
          <div className="boxed-stat-label">{isPublicView ? `This year ${data.user?.name || username} added` : 'This year you added'}</div>
          <div className="boxed-stat-box">
            <div className="boxed-stat-number">
              {data.collection.cards_added.toLocaleString()}
            </div>
            <div className="boxed-stat-unit">cards</div>
          </div>
          <div className="boxed-stat-label">to your collection</div>
          {data.collection.growth_percentage && (
            <div className="boxed-stat-comparison">
              {parseFloat(data.collection.growth_percentage) > 0 ? (
                <span className="boxed-growth-positive">
                  <Icon name="trending-up" size={18} />
                  {data.collection.growth_percentage}% vs last year
                </span>
              ) : (
                <span className="boxed-growth-negative">
                  <Icon name="trending-down" size={18} />
                  {Math.abs(parseFloat(data.collection.growth_percentage))}% vs last year
                </span>
              )}
            </div>
          )}
          {data.sports && data.sports.length > 0 && (
            <div className="boxed-sports-breakdown">
              {data.sports.slice(0, 4).map((sport) => (
                <div key={sport.name} className="boxed-sport-tag" title={sport.name}>
                  <span className="boxed-sport-emoji">{getSportEmoji(sport.name)}</span>
                  <span className="boxed-sport-count">{sport.count.toLocaleString()}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )
    },
    // Total collection
    {
      id: 'total-collection',
      content: (
        <div className="boxed-slide boxed-slide-stats">
          <div className="boxed-stat-label">{isPublicView ? `${data.user?.name || username}'s collection has` : 'Your collection now has'}</div>
          <div className="boxed-stat-box">
            <div className="boxed-stat-number">
              {data.collection.total_collection_size.toLocaleString()}
            </div>
            <div className="boxed-stat-unit">total cards</div>
          </div>
          <div className="boxed-mini-stats">
            <div className="boxed-mini-box">
              <div className="boxed-mini-value">{data.collection.unique_players}</div>
              <div className="boxed-mini-label">Players</div>
            </div>
            <div className="boxed-mini-box">
              <div className="boxed-mini-value">{data.collection.unique_teams}</div>
              <div className="boxed-mini-label">Teams</div>
            </div>
            <div className="boxed-mini-box">
              <div className="boxed-mini-value">{data.collection.unique_sets}</div>
              <div className="boxed-mini-label">Sets</div>
            </div>
          </div>
        </div>
      )
    },
    // Top player
    data.top_players.length > 0 && {
      id: 'top-player',
      content: (
        <div className="boxed-slide boxed-slide-player">
          <div className="boxed-stat-label">{isPublicView ? `${data.user?.name || username}'s #1 player` : 'Your #1 player'}</div>
          <div className="boxed-player-box">
            <div className="boxed-player-name">{data.top_players[0].name}</div>
            <div className="boxed-player-count">{data.top_players[0].count} cards</div>
          </div>
          {data.top_players.length > 1 && (
            <div className="boxed-runners-up boxed-top-10">
              {data.top_players.slice(1, 10).map((p, i) => (
                <div key={p.player_id} className="boxed-runner-box">
                  <span className="boxed-runner-rank">#{i + 2}</span>
                  <span className="boxed-runner-name">{p.name}</span>
                  <span className="boxed-runner-count">{p.count}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )
    },
    // Top team
    data.top_teams.length > 0 && {
      id: 'top-team',
      content: (
        <div className="boxed-slide boxed-slide-team-list">
          <div className="boxed-stat-label">{isPublicView ? `${data.user?.name || username}'s #1 team` : 'Your #1 team'}</div>
          <div className="boxed-team-header-box" style={{
            background: data.top_teams[0].primary_color ? `linear-gradient(135deg, ${data.top_teams[0].primary_color} 0%, ${data.top_teams[0].secondary_color || data.top_teams[0].primary_color} 100%)` : undefined
          }}>
            <div className="boxed-team-name">{data.top_teams[0].name}</div>
            <div className="boxed-team-count">{data.top_teams[0].count} cards</div>
          </div>
          {data.top_teams.length > 1 && (
            <div className="boxed-runners-up boxed-top-10">
              {data.top_teams.slice(1, 10).map((t, i) => (
                <div key={t.team_id} className="boxed-runner-box boxed-team-runner">
                  <span className="boxed-runner-rank">#{i + 2}</span>
                  <div
                    className="boxed-team-circle-small"
                    style={{
                      background: t.primary_color || '#666',
                      borderColor: t.secondary_color || '#999'
                    }}
                  >
                    {t.abbreviation}
                  </div>
                  <span className="boxed-runner-name">{t.name}</span>
                  <span className="boxed-runner-count">{t.count}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )
    },
    // Top sets
    data.top_sets.length > 0 && {
      id: 'top-sets',
      content: (
        <div className="boxed-slide boxed-slide-sets-list">
          <div className="boxed-stat-label">{isPublicView ? `${data.user?.name || username}'s #1 set` : 'Your #1 set'}</div>
          <div className="boxed-set-header-box">
            <div className="boxed-set-name">{data.top_sets[0].name}</div>
            <div className="boxed-set-count">{data.top_sets[0].count} cards</div>
          </div>
          {data.top_sets.length > 1 && (
            <div className="boxed-runners-up boxed-top-10">
              {data.top_sets.slice(1, 10).map((s, i) => (
                <div key={s.set_id} className="boxed-runner-box boxed-set-runner">
                  <span className="boxed-runner-rank">#{i + 2}</span>
                  <span className="boxed-runner-name">{s.name}</span>
                  <span className="boxed-runner-count">{s.count}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )
    },
    // Personality
    {
      id: 'personality',
      content: (
        <div className="boxed-slide boxed-slide-personality">
          <div className="boxed-stat-label">{isPublicView ? `${data.user?.name || username}'s collector type` : 'Your collector type'}</div>
          <div className="boxed-personality-box">
            <div className="boxed-personality-emoji">{data.personality.emoji}</div>
            <div className="boxed-personality-type">{data.personality.type}</div>
          </div>
          <div className="boxed-personality-desc">{data.personality.description}</div>
        </div>
      )
    },
    // Attributes
    (data.attributes.rookies > 0 || data.attributes.autographs > 0 || data.attributes.relics > 0) && {
      id: 'attributes',
      content: (
        <div className="boxed-slide boxed-slide-attributes">
          <div className="boxed-stat-label">Special cards collected</div>
          <div className="boxed-attributes-grid">
            {data.attributes.rookies > 0 && (
              <div className="boxed-attribute-box">
                <div className="boxed-attribute-tag boxed-attr-rc">RC</div>
                <div className="boxed-attribute-value">{data.attributes.rookies}</div>
                <div className="boxed-attribute-label">Rookies</div>
              </div>
            )}
            {data.attributes.autographs > 0 && (
              <div className="boxed-attribute-box">
                <div className="boxed-attribute-tag boxed-attr-auto">AUTO</div>
                <div className="boxed-attribute-value">{data.attributes.autographs}</div>
                <div className="boxed-attribute-label">Autographs</div>
              </div>
            )}
            {data.attributes.relics > 0 && (
              <div className="boxed-attribute-box">
                <div className="boxed-attribute-tag boxed-attr-relic">RELIC</div>
                <div className="boxed-attribute-value">{data.attributes.relics}</div>
                <div className="boxed-attribute-label">Relics</div>
              </div>
            )}
            {data.attributes.numbered_cards > 0 && (
              <div className="boxed-attribute-box">
                <div className="boxed-attribute-tag boxed-attr-num">/##</div>
                <div className="boxed-attribute-value">{data.attributes.numbered_cards}</div>
                <div className="boxed-attribute-label">Numbered</div>
              </div>
            )}
          </div>
        </div>
      )
    },
    // Biggest day
    data.activity.biggest_day && {
      id: 'biggest-day',
      content: (
        <div className="boxed-slide boxed-slide-stats">
          <div className="boxed-stat-label">Biggest collecting day</div>
          <div className="boxed-date-box">
            {new Date(data.activity.biggest_day.date).toLocaleDateString('en-US', {
              month: 'short',
              day: 'numeric'
            })}
          </div>
          <div className="boxed-stat-box">
            <div className="boxed-stat-number">{data.activity.biggest_day.count}</div>
            <div className="boxed-stat-unit">cards in one day</div>
          </div>
        </div>
      )
    },
    // Monthly breakdown
    {
      id: 'monthly',
      content: (
        <div className="boxed-slide boxed-slide-chart">
          <div className="boxed-stat-label">Your collecting timeline</div>
          <div className="boxed-chart-container">
            {data.activity.cards_by_month.map((count, i) => {
              const maxCount = Math.max(...data.activity.cards_by_month)
              const height = maxCount > 0 ? (count / maxCount) * 100 : 0
              return (
                <div key={i} className="boxed-chart-bar-container">
                  <div
                    className="boxed-chart-bar"
                    style={{ height: `${Math.max(height, 3)}%` }}
                  >
                    {count > 0 && <span className="boxed-chart-value">{count}</span>}
                  </div>
                  <div className="boxed-chart-label">{MONTH_NAMES[i]}</div>
                </div>
              )
            })}
          </div>
        </div>
      )
    },
    // Activity patterns
    {
      id: 'patterns',
      content: (
        <div className="boxed-slide boxed-slide-patterns">
          <div className="boxed-stat-label">{isPublicView ? `${data.user?.name || username}'s collecting habits` : 'Your collecting habits'}</div>
          <div className="boxed-patterns-main">
            <div className="boxed-pattern-hero">
              <div className="boxed-pattern-icon-large">
                {data.activity.time_preference === 'Night Owl' ? '🦉' : '🐦'}
              </div>
              <div className="boxed-pattern-title">{data.activity.time_preference}</div>
              <div className="boxed-pattern-detail">
                {data.activity.time_preference === 'Night Owl'
                  ? `${data.activity.evening_cards || 0} cards added after 6pm`
                  : `${data.activity.morning_cards || 0} cards added before noon`}
              </div>
            </div>
          </div>
          <div className="boxed-patterns-secondary">
            <div className="boxed-pattern-stat">
              <div className="boxed-pattern-stat-icon">📅</div>
              <div className="boxed-pattern-stat-content">
                <div className="boxed-pattern-stat-value">{data.activity.favorite_day}s</div>
                <div className="boxed-pattern-stat-label">Your busiest day</div>
              </div>
            </div>
            {data.activity.biggest_day && (
              <div className="boxed-pattern-stat">
                <div className="boxed-pattern-stat-icon">🔥</div>
                <div className="boxed-pattern-stat-content">
                  <div className="boxed-pattern-stat-value">{data.activity.biggest_day.count} cards</div>
                  <div className="boxed-pattern-stat-label">Best single day ({new Date(data.activity.biggest_day.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })})</div>
                </div>
              </div>
            )}
          </div>
        </div>
      )
    },
    // Engagement stats (if any engagement)
    data.engagement && (data.engagement.comments > 0 || data.engagement.achievements_earned > 0 || data.engagement.sessions > 0) && {
      id: 'engagement',
      content: (
        <div className="boxed-slide boxed-slide-engagement">
          <div className="boxed-stat-label">{isPublicView ? `${data.user?.name || username}'s community engagement` : 'Your community engagement'}</div>
          <div className="boxed-engagement-grid">
            {data.engagement.achievements_earned > 0 && (
              <div className="boxed-engagement-box">
                <div className="boxed-engagement-icon">🏅</div>
                <div className="boxed-engagement-value">{data.engagement.achievements_earned}</div>
                <div className="boxed-engagement-label">Achievements Earned</div>
              </div>
            )}
            {data.engagement.comments > 0 && (
              <div className="boxed-engagement-box">
                <div className="boxed-engagement-icon">💬</div>
                <div className="boxed-engagement-value">{data.engagement.comments}</div>
                <div className="boxed-engagement-label">Comments</div>
              </div>
            )}
            {data.engagement.sessions > 0 && (
              <div className="boxed-engagement-box">
                <div className="boxed-engagement-icon">🔑</div>
                <div className="boxed-engagement-value">{data.engagement.sessions}</div>
                <div className="boxed-engagement-label">Sessions</div>
              </div>
            )}
            {data.engagement.following > 0 && (
              <div className="boxed-engagement-box">
                <div className="boxed-engagement-icon">👥</div>
                <div className="boxed-engagement-value">{data.engagement.following}</div>
                <div className="boxed-engagement-label">Following</div>
              </div>
            )}
            {data.engagement.followers_gained > 0 && (
              <div className="boxed-engagement-box">
                <div className="boxed-engagement-icon">⭐</div>
                <div className="boxed-engagement-value">{data.engagement.followers_gained}</div>
                <div className="boxed-engagement-label">New Followers</div>
              </div>
            )}
            {data.activity.lists_created > 0 && (
              <div className="boxed-engagement-box">
                <div className="boxed-engagement-icon">📋</div>
                <div className="boxed-engagement-value">{data.activity.lists_created}</div>
                <div className="boxed-engagement-label">Lists Created</div>
              </div>
            )}
          </div>
        </div>
      )
    },
    // Seller stats (if applicable)
    data.seller_stats && {
      id: 'seller',
      content: (
        <div className="boxed-slide boxed-slide-seller">
          <div className="boxed-stat-label">{isPublicView ? `${data.user?.name || username}'s selling year` : 'Your selling year'}</div>
          <div className="boxed-seller-grid">
            <div className="boxed-seller-box">
              <div className="boxed-seller-value">${data.seller_stats.total_revenue.toFixed(0)}</div>
              <div className="boxed-seller-label">Revenue</div>
            </div>
            <div className="boxed-seller-box boxed-seller-profit">
              <div className="boxed-seller-value">${data.seller_stats.total_profit.toFixed(0)}</div>
              <div className="boxed-seller-label">Profit</div>
            </div>
            <div className="boxed-seller-box">
              <div className="boxed-seller-value">{data.seller_stats.cards_sold}</div>
              <div className="boxed-seller-label">Sold</div>
            </div>
          </div>
        </div>
      )
    },
    // Outro - Image preview with download
    {
      id: 'outro',
      content: (
        <div className="boxed-slide boxed-slide-preview">
          {/* Image preview matching the downloadable image */}
          <div className="boxed-preview-container">
            {/* Boxed logo image */}
            <img
              src={`/images/${displayYear}_boxed.png`}
              alt={`${displayYear} Boxed`}
              className="boxed-preview-image"
            />

            {/* Cards Added */}
            <div className="boxed-preview-stat-box">
              <div className="boxed-preview-stat-label">CARDS ADDED</div>
              <div className="boxed-preview-stat-value boxed-green">{data.collection.cards_added.toLocaleString()}</div>
              {data.collection.growth_percentage && (
                <div className={`boxed-preview-growth ${parseFloat(data.collection.growth_percentage) > 0 ? 'positive' : 'negative'}`}>
                  {parseFloat(data.collection.growth_percentage) > 0 ? '▲' : '▼'} {Math.abs(parseFloat(data.collection.growth_percentage))}% vs last year
                </div>
              )}
            </div>

            {/* Top 5 Players */}
            <div className="boxed-preview-list-box boxed-preview-players">
              <div className="boxed-preview-stat-label">TOP 5 PLAYERS</div>
              <div className="boxed-preview-list">
                {data.top_players.slice(0, 5).map((player, i) => (
                  <div key={player.player_id} className={`boxed-preview-list-row ${i === 0 ? 'boxed-preview-top' : ''}`}>
                    <span className="boxed-preview-rank">{i + 1}.</span>
                    <span className="boxed-preview-name">{player.name}</span>
                    <span className="boxed-preview-count">{player.count.toLocaleString()}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Top 5 Teams */}
            <div className="boxed-preview-list-box">
              <div className="boxed-preview-stat-label">TOP 5 TEAMS</div>
              <div className="boxed-preview-list">
                {data.top_teams.slice(0, 5).map((team, i) => (
                  <div key={team.team_id} className={`boxed-preview-list-row ${i === 0 ? 'boxed-preview-top' : ''}`}>
                    <div
                      className="boxed-preview-team-circle"
                      style={{
                        background: team.primary_color || '#666',
                        borderColor: team.secondary_color || '#999'
                      }}
                    >
                      {team.abbreviation}
                    </div>
                    <span className="boxed-preview-name">{team.name}</span>
                    <span className="boxed-preview-count">{team.count.toLocaleString()}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Collector Type */}
            <div className="boxed-preview-stat-box boxed-preview-personality">
              <div className="boxed-preview-stat-label">COLLECTOR TYPE</div>
              <div className="boxed-preview-personality-content">
                <span className="boxed-preview-emoji">{data.personality.emoji}</span>
                <span className="boxed-preview-type">{data.personality.type}</span>
              </div>
            </div>

            {/* Totals Section */}
            <div className="boxed-preview-totals-section">
              <div className="boxed-preview-totals-header">{isPublicView ? `${data.user?.name || username}'s Collection Stats` : 'My Collection Stats'}</div>
              <div className="boxed-preview-totals">
                <div className="boxed-preview-total-item">
                  <div className="boxed-preview-total-value">{data.collection.total_collection_size.toLocaleString()}</div>
                  <div className="boxed-preview-total-label">Total Cards</div>
                </div>
                <div className="boxed-preview-total-item">
                  <div className="boxed-preview-total-value">{data.collection.unique_players.toLocaleString()}</div>
                  <div className="boxed-preview-total-label">Players</div>
                </div>
                <div className="boxed-preview-total-item">
                  <div className="boxed-preview-total-value boxed-green">
                    ${data.collection.total_value_added > 0 ? data.collection.total_value_added.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 }) : '0'}
                  </div>
                  <div className="boxed-preview-total-label">Est. Value</div>
                </div>
              </div>
              {/* Special Cards Row */}
              <div className="boxed-preview-totals boxed-preview-totals-row2">
                <div className="boxed-preview-total-item">
                  <div className="boxed-preview-total-value boxed-rc">{data.attributes?.rookies?.toLocaleString() || 0}</div>
                  <div className="boxed-preview-total-label">Rookies</div>
                </div>
                <div className="boxed-preview-total-item">
                  <div className="boxed-preview-total-value boxed-auto">{data.attributes?.autographs?.toLocaleString() || 0}</div>
                  <div className="boxed-preview-total-label">Autographs</div>
                </div>
                <div className="boxed-preview-total-item">
                  <div className="boxed-preview-total-value boxed-relic">{data.attributes?.relics?.toLocaleString() || 0}</div>
                  <div className="boxed-preview-total-label">Relics</div>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="boxed-preview-footer">
              {data.public_profile_url
                ? `See my collection at ${data.public_profile_url.replace('https://', '')}`
                : 'collectyourcards.com'}
            </div>
          </div>

          {/* Action buttons */}
          <div className="boxed-preview-actions">
            {!isPublicView && (
              <button
                className="boxed-download-btn"
                onClick={(e) => {
                  e.stopPropagation()
                  downloadShareImage()
                }}
              >
                <Icon name="download" size={18} />
                Download Image
              </button>
            )}
            <button
              className="boxed-restart-btn"
              onClick={(e) => { e.stopPropagation(); goToSlide(0) }}
            >
              <Icon name="refresh-cw" size={18} />
              Replay
            </button>
            {isPublicView && (
              <button
                className="boxed-view-profile-btn"
                onClick={(e) => { e.stopPropagation(); navigate(`/${username}`) }}
              >
                <Icon name="user" size={18} />
                View Profile
              </button>
            )}
          </div>
        </div>
      )
    }
  ].filter(Boolean) // Remove falsy slides

  const currentSlideData = slides[currentSlide]

  return (
    <div className="boxed-page" onClick={nextSlide}>
      {/* Close button */}
      <button
        className="boxed-close-btn"
        onClick={(e) => { e.stopPropagation(); navigate('/') }}
      >
        <Icon name="x" size={20} />
      </button>

      {/* Progress bar - boxy squares */}
      <div className="boxed-progress">
        {slides.map((_, i) => (
          <div
            key={i}
            className={`boxed-progress-box ${i === currentSlide ? 'active' : ''} ${i < currentSlide ? 'completed' : ''}`}
            onClick={(e) => { e.stopPropagation(); goToSlide(i) }}
          />
        ))}
      </div>

      {/* Slide content */}
      <div
        className={`boxed-slide-container ${isAnimating ? 'animating' : ''}`}
        style={currentSlideData.style}
      >
        {currentSlideData.content}
      </div>

      {/* Navigation arrows - square buttons */}
      <div className="boxed-nav">
        <button
          className="boxed-nav-btn"
          onClick={(e) => { e.stopPropagation(); prevSlide() }}
          disabled={currentSlide === 0}
        >
          <Icon name="chevron-left" size={28} />
        </button>
        <button
          className="boxed-nav-btn"
          onClick={(e) => { e.stopPropagation(); nextSlide() }}
          disabled={currentSlide === slides.length - 1}
        >
          <Icon name="chevron-right" size={28} />
        </button>
      </div>

      {/* Slide counter */}
      <div className="boxed-counter">
        {currentSlide + 1} / {slides.length}
      </div>
    </div>
  )
}

export default Boxed
