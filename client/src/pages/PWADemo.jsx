import React, { useState } from 'react'
import { useIsMobile, isMobileDevice, isStandalone } from '../hooks/useIsMobile'
import Icon from '../components/Icon'
import './PWADemo.css'

function PWADemo() {
  const isMobile = useIsMobile()
  const [activeTab, setActiveTab] = useState('components')
  const [showSheet, setShowSheet] = useState(false)
  const [selectedCard, setSelectedCard] = useState(null)

  // Mock card data
  const mockCards = [
    {
      id: 1,
      player: 'Mike Trout',
      cardNumber: '27',
      series: '2011 Topps Update',
      price: 450,
      imageUrl: 'https://via.placeholder.com/200x280/007bff/ffffff?text=Trout+RC',
      isRookie: true,
      isAutograph: false,
      grade: 'PSA 10'
    },
    {
      id: 2,
      player: 'Ronald Acuña Jr.',
      cardNumber: '1',
      series: '2018 Bowman Chrome',
      price: 275,
      imageUrl: 'https://via.placeholder.com/200x280/28a745/ffffff?text=Acuna+AUTO',
      isRookie: true,
      isAutograph: true,
      grade: 'BGS 9.5'
    },
    {
      id: 3,
      player: 'Shohei Ohtani',
      cardNumber: '700',
      series: '2018 Topps',
      price: 520,
      imageUrl: 'https://via.placeholder.com/200x280/dc3545/ffffff?text=Ohtani',
      isRookie: true,
      isAutograph: false,
      grade: 'PSA 9'
    }
  ]

  return (
    <div className="pwa-demo-page">
      {/* Header with device info */}
      <div className="pwa-demo-header">
        <h1>PWA Mobile UI Demo</h1>
        <div className="pwa-demo-device-info">
          <div className="info-badge">
            <Icon name="monitor" size={16} />
            <span>Screen: {isMobile ? 'Mobile' : 'Desktop'}</span>
          </div>
          <div className="info-badge">
            <Icon name="smartphone" size={16} />
            <span>Device: {isMobileDevice() ? 'Mobile' : 'Desktop'}</span>
          </div>
          <div className="info-badge">
            <Icon name="download" size={16} />
            <span>PWA: {isStandalone() ? 'Installed' : 'Browser'}</span>
          </div>
          <div className="info-badge">
            <Icon name="maximize" size={16} />
            <span>Width: {window.innerWidth}px</span>
          </div>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="pwa-demo-tabs">
        <button
          className={`pwa-tab ${activeTab === 'components' ? 'active' : ''}`}
          onClick={() => setActiveTab('components')}
        >
          <Icon name="layout" size={18} />
          Components
        </button>
        <button
          className={`pwa-tab ${activeTab === 'cards' ? 'active' : ''}`}
          onClick={() => setActiveTab('cards')}
        >
          <Icon name="grid" size={18} />
          Card Grid
        </button>
        <button
          className={`pwa-tab ${activeTab === 'navigation' ? 'active' : ''}`}
          onClick={() => setActiveTab('navigation')}
        >
          <Icon name="menu" size={18} />
          Navigation
        </button>
      </div>

      {/* Content Area */}
      <div className="pwa-demo-content">
        {activeTab === 'components' && (
          <>
            {/* Buttons Section */}
            <section className="pwa-demo-section">
              <h2>Buttons & Touch Targets</h2>
              <p className="section-note">Minimum 44px touch targets for mobile</p>

              <div className="button-grid">
                <button className="pwa-button primary">
                  <Icon name="plus" size={20} />
                  Primary Action
                </button>
                <button className="pwa-button secondary">
                  <Icon name="search" size={20} />
                  Secondary
                </button>
                <button className="pwa-button outline">
                  <Icon name="filter" size={20} />
                  Outline
                </button>
                <button className="pwa-button danger">
                  <Icon name="trash" size={20} />
                  Danger
                </button>
              </div>

              <div className="button-grid">
                <button className="pwa-button-icon">
                  <Icon name="heart" size={24} />
                </button>
                <button className="pwa-button-icon">
                  <Icon name="share-2" size={24} />
                </button>
                <button className="pwa-button-icon">
                  <Icon name="edit" size={24} />
                </button>
                <button className="pwa-button-icon">
                  <Icon name="more-vertical" size={24} />
                </button>
              </div>
            </section>

            {/* Input Fields */}
            <section className="pwa-demo-section">
              <h2>Input Fields</h2>
              <p className="section-note">Mobile-optimized with proper keyboards</p>

              <div className="input-group">
                <label>Search</label>
                <div className="pwa-input-wrapper">
                  <Icon name="search" size={20} className="input-icon" />
                  <input
                    type="search"
                    placeholder="Search cards..."
                    className="pwa-input"
                  />
                </div>
              </div>

              <div className="input-group">
                <label>Email</label>
                <input
                  type="email"
                  placeholder="your@email.com"
                  className="pwa-input"
                  autoComplete="email"
                />
              </div>

              <div className="input-group">
                <label>Price</label>
                <div className="pwa-input-wrapper">
                  <span className="input-prefix">$</span>
                  <input
                    type="number"
                    placeholder="0.00"
                    className="pwa-input"
                    inputMode="decimal"
                  />
                </div>
              </div>
            </section>

            {/* Cards Section */}
            <section className="pwa-demo-section">
              <h2>Card Components</h2>

              <div className="pwa-card">
                <div className="pwa-card-header">
                  <Icon name="star" size={20} />
                  <h3>Featured Card</h3>
                </div>
                <div className="pwa-card-body">
                  <p>This is a standard card component with header, body, and actions.</p>
                </div>
                <div className="pwa-card-actions">
                  <button className="pwa-button-text">Cancel</button>
                  <button className="pwa-button-text primary">Confirm</button>
                </div>
              </div>

              <div className="pwa-card interactive" onClick={() => alert('Card tapped!')}>
                <div className="pwa-card-body">
                  <div className="card-content-row">
                    <Icon name="box" size={40} color="#007bff" />
                    <div>
                      <h4>Tap Me!</h4>
                      <p>This card is interactive</p>
                    </div>
                    <Icon name="chevron-right" size={20} />
                  </div>
                </div>
              </div>
            </section>

            {/* Badges & Tags */}
            <section className="pwa-demo-section">
              <h2>Badges & Tags</h2>

              <div className="badge-row">
                <span className="pwa-badge">Default</span>
                <span className="pwa-badge primary">Primary</span>
                <span className="pwa-badge success">Success</span>
                <span className="pwa-badge warning">Warning</span>
                <span className="pwa-badge danger">Danger</span>
              </div>

              <div className="badge-row">
                <span className="pwa-tag">
                  <Icon name="tag" size={14} />
                  RC
                </span>
                <span className="pwa-tag primary">
                  <Icon name="edit" size={14} />
                  AUTO
                </span>
                <span className="pwa-tag success">
                  <Icon name="award" size={14} />
                  PSA 10
                </span>
              </div>
            </section>

            {/* Lists */}
            <section className="pwa-demo-section">
              <h2>Lists</h2>

              <div className="pwa-list">
                <div className="pwa-list-item">
                  <Icon name="user" size={20} />
                  <div className="list-item-content">
                    <div className="list-item-title">Account Settings</div>
                    <div className="list-item-subtitle">Update your profile</div>
                  </div>
                  <Icon name="chevron-right" size={20} />
                </div>

                <div className="pwa-list-item">
                  <Icon name="bell" size={20} />
                  <div className="list-item-content">
                    <div className="list-item-title">Notifications</div>
                    <div className="list-item-subtitle">3 unread</div>
                  </div>
                  <span className="pwa-badge danger">3</span>
                </div>

                <div className="pwa-list-item">
                  <Icon name="download" size={20} />
                  <div className="list-item-content">
                    <div className="list-item-title">Install App</div>
                    <div className="list-item-subtitle">Add to home screen</div>
                  </div>
                  <Icon name="chevron-right" size={20} />
                </div>
              </div>
            </section>

            {/* Camera Input */}
            <section className="pwa-demo-section">
              <h2>Camera Access</h2>
              <p className="section-note">Direct camera integration (iOS/Android)</p>

              <div className="camera-demo">
                <label className="pwa-button primary" htmlFor="camera-input">
                  <Icon name="camera" size={20} />
                  Take Photo
                </label>
                <input
                  type="file"
                  id="camera-input"
                  accept="image/*"
                  capture="environment"
                  style={{ display: 'none' }}
                  onChange={(e) => {
                    if (e.target.files[0]) {
                      alert(`Selected: ${e.target.files[0].name}`)
                    }
                  }}
                />

                <label className="pwa-button secondary" htmlFor="gallery-input">
                  <Icon name="image" size={20} />
                  Choose from Gallery
                </label>
                <input
                  type="file"
                  id="gallery-input"
                  accept="image/*"
                  style={{ display: 'none' }}
                  onChange={(e) => {
                    if (e.target.files[0]) {
                      alert(`Selected: ${e.target.files[0].name}`)
                    }
                  }}
                />
              </div>
            </section>
          </>
        )}

        {activeTab === 'cards' && (
          <section className="pwa-demo-section">
            <h2>Card Grid (Pinterest Style)</h2>
            <p className="section-note">2 columns on mobile, 3-4 on tablet</p>

            <div className="pwa-card-grid">
              {mockCards.map(card => (
                <div
                  key={card.id}
                  className="pwa-grid-card"
                  onClick={() => {
                    setSelectedCard(card)
                    setShowSheet(true)
                  }}
                >
                  <div className="grid-card-image">
                    <img src={card.imageUrl} alt={card.player} />
                    <div className="grid-card-badges">
                      {card.isRookie && <span className="pwa-badge danger">RC</span>}
                      {card.isAutograph && <span className="pwa-badge primary">AUTO</span>}
                    </div>
                  </div>
                  <div className="grid-card-content">
                    <h4>{card.player}</h4>
                    <p className="card-subtitle">#{card.cardNumber} • {card.series}</p>
                    <div className="card-footer">
                      <span className="card-price">${card.price}</span>
                      <span className="pwa-badge success">{card.grade}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {activeTab === 'navigation' && (
          <>
            <section className="pwa-demo-section">
              <h2>Bottom Tab Navigation</h2>
              <p className="section-note">Primary navigation for mobile apps</p>

              <div className="bottom-nav-demo">
                <button className="nav-tab active">
                  <Icon name="home" size={24} />
                  <span>Home</span>
                </button>
                <button className="nav-tab">
                  <Icon name="search" size={24} />
                  <span>Search</span>
                </button>
                <button className="nav-tab">
                  <Icon name="plus-circle" size={24} />
                  <span>Add</span>
                </button>
                <button className="nav-tab">
                  <Icon name="user" size={24} />
                  <span>Profile</span>
                </button>
              </div>
            </section>

            <section className="pwa-demo-section">
              <h2>Floating Action Button</h2>

              <div style={{ position: 'relative', height: '200px', background: '#f5f5f5', borderRadius: '8px' }}>
                <button className="fab">
                  <Icon name="plus" size={24} />
                </button>
              </div>
            </section>

            <section className="pwa-demo-section">
              <h2>Sticky Header</h2>
              <p className="section-note">Stays at top while scrolling</p>

              <div className="sticky-header-demo">
                <div className="sticky-header">
                  <button className="header-button">
                    <Icon name="menu" size={24} />
                  </button>
                  <h3>Collection</h3>
                  <button className="header-button">
                    <Icon name="filter" size={24} />
                  </button>
                </div>
                <div style={{ padding: '20px' }}>
                  <p>Content below sticky header...</p>
                </div>
              </div>
            </section>
          </>
        )}
      </div>

      {/* Bottom Sheet Demo */}
      {showSheet && selectedCard && (
        <div className="bottom-sheet-overlay" onClick={() => setShowSheet(false)}>
          <div className="bottom-sheet" onClick={(e) => e.stopPropagation()}>
            <div className="sheet-handle"></div>

            <div className="sheet-header">
              <h2>{selectedCard.player}</h2>
              <button className="pwa-button-icon" onClick={() => setShowSheet(false)}>
                <Icon name="x" size={24} />
              </button>
            </div>

            <div className="sheet-image">
              <img src={selectedCard.imageUrl} alt={selectedCard.player} />
            </div>

            <div className="sheet-content">
              <div className="sheet-info-row">
                <div className="info-item">
                  <span className="info-label">Card Number</span>
                  <span className="info-value">#{selectedCard.cardNumber}</span>
                </div>
                <div className="info-item">
                  <span className="info-label">Grade</span>
                  <span className="info-value">{selectedCard.grade}</span>
                </div>
              </div>

              <div className="sheet-info-row">
                <div className="info-item">
                  <span className="info-label">Series</span>
                  <span className="info-value">{selectedCard.series}</span>
                </div>
                <div className="info-item">
                  <span className="info-label">Price</span>
                  <span className="info-value">${selectedCard.price}</span>
                </div>
              </div>

              <div className="sheet-badges">
                {selectedCard.isRookie && <span className="pwa-badge danger">Rookie Card</span>}
                {selectedCard.isAutograph && <span className="pwa-badge primary">Autograph</span>}
              </div>
            </div>

            <div className="sheet-actions">
              <button className="pwa-button outline">
                <Icon name="share-2" size={20} />
                Share
              </button>
              <button className="pwa-button primary">
                <Icon name="edit" size={20} />
                Edit Card
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Install Banner (if not installed) */}
      {!isStandalone() && (
        <div className="install-banner">
          <Icon name="download" size={20} />
          <span>Install this app on your device</span>
          <button className="pwa-button-text primary">Install</button>
        </div>
      )}
    </div>
  )
}

export default PWADemo
