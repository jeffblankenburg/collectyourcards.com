import React, { useState, useRef, useEffect } from 'react'
import Icon from './Icon'
import './SocialShareButton.css'

function SocialShareButton({ card, className = '', iconOnly = false, size = 16 }) {
  const [showDropdown, setShowDropdown] = useState(false)
  const [copyButtonText, setCopyButtonText] = useState('Copy Link')
  const dropdownRef = useRef(null)

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setShowDropdown(false)
      }
    }

    if (showDropdown) {
      document.addEventListener('mousedown', handleClickOutside)
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [showDropdown])

  const handleCopyLink = async () => {
    try {
      const currentUrl = window.location.href
      await navigator.clipboard.writeText(currentUrl)
      setCopyButtonText('Copied!')
      setTimeout(() => setCopyButtonText('Copy Link'), 2000)
    } catch (err) {
      console.error('Failed to copy URL:', err)
      setCopyButtonText('Copy Failed')
      setTimeout(() => setCopyButtonText('Copy Link'), 2000)
    }
  }

  const getPlayerNames = () => {
    if (card.player_names) return card.player_names
    if (card.card_player_teams && card.card_player_teams.length > 0) {
      return card.card_player_teams
        .map(cpt => {
          if (cpt.player?.name) return cpt.player.name
          if (cpt.player?.first_name || cpt.player?.last_name) {
            return `${cpt.player.first_name || ''} ${cpt.player.last_name || ''}`.trim()
          }
          return null
        })
        .filter(name => name)
        .join(', ')
    }
    return 'Unknown Player'
  }

  const createShareContent = () => {
    const playerNames = getPlayerNames()
    const cardNumber = card.card_number || 'Unknown'
    const seriesName = card.series_name || 'Unknown Series'
    const year = card.set_year || ''
    const currentUrl = window.location.href
    
    return {
      title: `Check out this ${year} ${seriesName} #${cardNumber} ${playerNames} card!`,
      url: currentUrl,
      hashtags: ['SportCards', 'CardCollector', 'CollectYourCards'].join(','),
      text: `${year} ${seriesName} #${cardNumber} ${playerNames}`
    }
  }

  const shareToTwitter = () => {
    const content = createShareContent()
    const twitterUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(content.title)}&url=${encodeURIComponent(content.url)}&hashtags=${content.hashtags}`
    window.open(twitterUrl, '_blank', 'width=550,height=420')
    setShowDropdown(false)
  }

  const shareToFacebook = () => {
    const content = createShareContent()
    const facebookUrl = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(content.url)}&quote=${encodeURIComponent(content.title)}`
    window.open(facebookUrl, '_blank', 'width=550,height=420')
    setShowDropdown(false)
  }

  const shareToInstagram = () => {
    // Instagram doesn't have a direct share URL, so we copy the link with a message
    const content = createShareContent()
    navigator.clipboard.writeText(`${content.title}\n\n${content.url}`).then(() => {
      setCopyButtonText('Link Copied!')
      setTimeout(() => setCopyButtonText('Copy Link'), 2000)
      window.open('https://www.instagram.com/', '_blank')
    }).catch(err => {
      console.error('Failed to copy for Instagram:', err)
    })
    setShowDropdown(false)
  }

  const shareToBlueSky = () => {
    const content = createShareContent()
    const blueSkyUrl = `https://bsky.app/intent/compose?text=${encodeURIComponent(`${content.title}\n\n${content.url}`)}`
    window.open(blueSkyUrl, '_blank', 'width=550,height=420')
    setShowDropdown(false)
  }


  return (
    <div className={`social-share-container ${className}`} ref={dropdownRef}>
      <button 
        className="social-share-trigger"
        onClick={() => setShowDropdown(!showDropdown)}
        aria-label="Share card"
      >
        <Icon name="upload" size={size} />
        {!iconOnly && 'Share'}
      </button>

      {showDropdown && (
        <div className="social-share-dropdown">
          <div className="share-dropdown-header">
            <span>Share this card</span>
          </div>

          <button 
            className="share-option copy-link"
            onClick={handleCopyLink}
          >
            <Icon name="link" size={16} />
            <span>{copyButtonText}</span>
          </button>

          <div className="share-divider"></div>

          <button 
            className="share-option twitter"
            onClick={shareToTwitter}
          >
            <Icon name="twitter" size={16} />
            <span>Twitter</span>
          </button>

          <button 
            className="share-option facebook"
            onClick={shareToFacebook}
          >
            <Icon name="facebook" size={16} />
            <span>Facebook</span>
          </button>

          <button 
            className="share-option instagram"
            onClick={shareToInstagram}
          >
            <Icon name="camera" size={16} />
            <span>Instagram</span>
          </button>

          <button 
            className="share-option bluesky"
            onClick={shareToBlueSky}
          >
            <Icon name="cloud" size={16} />
            <span>Blue Sky</span>
          </button>
        </div>
      )}
    </div>
  )
}

export default SocialShareButton