# 📱 Mobile Coding Standards for Collect Your Cards

## 🎯 Overview

This document establishes coding standards for the mobile-first implementation of Collect Your Cards. The mobile version will use completely separate stylesheets optimized for touch interfaces while maintaining obvious visual resemblance to the desktop version through shared design tokens and consistent branding elements.

## 🏗️ CSS Architecture

### 📁 File Structure

```
client/src/
├── styles/
│   ├── mobile/                    # Mobile-only stylesheets
│   │   ├── base/
│   │   │   ├── _reset.css        # Mobile-specific reset
│   │   │   ├── _typography.css   # Mobile typography scale
│   │   │   ├── _colors.css       # Mobile color system
│   │   │   └── _tokens.css       # Mobile design tokens
│   │   ├── components/
│   │   │   ├── _mobile-nav.css   # Bottom navigation
│   │   │   ├── _touch-cards.css  # Touch-optimized cards
│   │   │   ├── _mobile-forms.css # Mobile form controls
│   │   │   └── _gestures.css     # Swipe/touch interactions
│   │   ├── pages/
│   │   │   ├── _mobile-home.css  # Mobile dashboard
│   │   │   ├── _mobile-collection.css
│   │   │   ├── _mobile-players.css
│   │   │   └── _mobile-admin.css
│   │   └── mobile-main.css       # Main mobile stylesheet
│   ├── shared/                    # Shared between mobile/desktop
│   │   ├── _brand-colors.css     # Team colors, brand palette
│   │   ├── _team-circles.css     # Team circle components
│   │   ├── _icons.css           # Icon system
│   │   └── _animations.css      # Shared animations
│   └── desktop/                   # Existing desktop styles
│       └── ... (current structure)
```

### 🎨 Mobile Design Token System

```css
/* client/src/styles/mobile/base/_tokens.css */

/* Mobile-Optimized Spacing Scale */
:root {
  /* Touch-friendly spacing */
  --mobile-space-xs: 4px;   /* Tight spacing */
  --mobile-space-sm: 8px;   /* Small gaps */
  --mobile-space-md: 16px;  /* Standard spacing */
  --mobile-space-lg: 24px;  /* Section spacing */
  --mobile-space-xl: 32px;  /* Page sections */
  --mobile-space-2xl: 48px; /* Major sections */

  /* Touch Target Sizes */
  --touch-target-min: 44px;    /* iOS/Android minimum */
  --touch-target-rec: 48px;    /* Recommended size */
  --touch-target-large: 56px;  /* Primary actions */

  /* Mobile Typography Scale */
  --mobile-text-xs: 12px;      /* Captions, labels */
  --mobile-text-sm: 14px;      /* Body small */
  --mobile-text-base: 16px;    /* Body default (prevents zoom) */
  --mobile-text-lg: 18px;      /* Subheadings */
  --mobile-text-xl: 20px;      /* Card titles */
  --mobile-text-2xl: 24px;     /* Page headings */
  --mobile-text-3xl: 28px;     /* Major headings */

  /* Mobile-Specific Radii */
  --mobile-radius-sm: 6px;     /* Small elements */
  --mobile-radius-md: 12px;    /* Cards, buttons */
  --mobile-radius-lg: 16px;    /* Modals, sheets */
  --mobile-radius-xl: 20px;    /* Major containers */

  /* Z-Index Scale for Mobile */
  --mobile-z-base: 0;
  --mobile-z-dropdown: 100;
  --mobile-z-sticky: 200;
  --mobile-z-modal: 300;
  --mobile-z-overlay: 400;
  --mobile-z-toast: 500;
}
```

### 🎨 Shared Brand Consistency

```css
/* client/src/styles/shared/_brand-colors.css */

:root {
  /* Brand Colors (Shared) */
  --brand-primary: #0066cc;
  --brand-secondary: #28a745;
  --brand-accent: #ffc107;
  --brand-dark: #1a1a1a;
  --brand-light: #ffffff;

  /* Team Colors (Shared - same as desktop) */
  --team-lakers: #552583;
  --team-celtics: #007A33;
  --team-yankees: #132448;
  --team-dodgers: #005A9C;
  /* ... all existing team colors */

  /* Semantic Colors (Mobile-optimized for readability) */
  --mobile-success: #10b981;     /* Higher contrast green */
  --mobile-warning: #f59e0b;     /* More vibrant yellow */
  --mobile-error: #ef4444;       /* High contrast red */
  --mobile-info: #3b82f6;        /* Accessible blue */

  /* Background System (Mobile) */
  --mobile-bg-primary: #ffffff;
  --mobile-bg-secondary: #f8fafc;
  --mobile-bg-tertiary: #f1f5f9;
  --mobile-bg-overlay: rgba(0, 0, 0, 0.6);
  --mobile-bg-card: #ffffff;
  --mobile-bg-input: #f8fafc;

  /* Text Colors (Mobile-optimized contrast) */
  --mobile-text-primary: #1a202c;     /* WCAG AAA */
  --mobile-text-secondary: #4a5568;   /* WCAG AA */
  --mobile-text-tertiary: #718096;    /* WCAG AA */
  --mobile-text-placeholder: #a0aec0; /* Subtle */
}
```

## 📱 Component Naming Conventions

### 🏷️ Mobile Component Prefixes

```jsx
// Mobile components use 'Mobile' prefix
<MobileNavigation />      // Bottom tab navigation
<MobileCard />           // Touch-optimized card
<MobileSearch />         // Mobile search interface
<MobileModal />          // Bottom sheet modal
<MobileButton />         // Touch-friendly button
<MobileInput />          // Mobile form input
<MobileGrid />           // Touch-optimized grid

// Touch-specific interaction components
<TouchCard />            // Swipeable card component
<SwipeableList />        // Left/right swipe actions
<PullToRefresh />        // Pull-down refresh
<BottomSheet />          // Slide-up modal
<FloatingActionButton /> // FAB component
```

### 📂 Mobile Component Structure

```
client/src/components/mobile/
├── navigation/
│   ├── MobileNavigation.jsx
│   ├── MobileNavigation.css
│   ├── MobileHeader.jsx
│   └── MobileHeader.css
├── cards/
│   ├── TouchCard.jsx
│   ├── TouchCard.css
│   ├── SwipeableCard.jsx
│   └── SwipeableCard.css
├── forms/
│   ├── MobileInput.jsx
│   ├── MobileButton.jsx
│   ├── MobileSelect.jsx
│   └── MobileForm.css
├── layout/
│   ├── MobileGrid.jsx
│   ├── BottomSheet.jsx
│   ├── FloatingActionButton.jsx
│   └── MobileLayout.css
└── shared/              # Components used by both mobile and desktop
    ├── TeamCircle.jsx   # Team circles (shared styling)
    ├── Icon.jsx         # Icon system (shared)
    └── Logo.jsx         # Brand logo (shared)
```

## 🎨 CSS Class Naming Standards

### 📱 Mobile-Specific Class Prefixes

```css
/* Mobile component classes */
.mobile-nav { }              /* Mobile navigation */
.mobile-card { }             /* Mobile cards */
.mobile-btn { }              /* Mobile buttons */
.mobile-input { }            /* Mobile inputs */
.mobile-modal { }            /* Mobile modals */

/* Touch interaction classes */
.touch-target { }            /* Minimum 44px touch targets */
.swipeable { }              /* Swipeable elements */
.pullable { }               /* Pull-to-refresh elements */
.tappable { }               /* Tap-specific interactions */

/* Mobile layout classes */
.mobile-container { }        /* Mobile page containers */
.mobile-section { }          /* Mobile page sections */
.mobile-grid { }             /* Mobile grid systems */
.mobile-stack { }            /* Vertical stacking */

/* Mobile state classes */
.mobile-loading { }          /* Mobile loading states */
.mobile-offline { }          /* Offline indicators */
.mobile-syncing { }          /* Sync states */
```

### 🔗 Shared Component Classes

```css
/* Shared elements maintain consistency */
.team-circle { }             /* Team circles (same as desktop) */
.brand-logo { }              /* Logo component */
.icon { }                    /* Icon system */
.card-image { }              /* Card images */
.player-avatar { }           /* Player photos */
.set-badge { }               /* Set indicators */

/* Shared semantic classes */
.success-state { }           /* Success messaging */
.error-state { }             /* Error messaging */
.warning-state { }           /* Warning messaging */
.loading-state { }           /* Loading states */
```

## 📐 Mobile-Specific CSS Standards

### 👆 Touch Target Guidelines

```css
/* Touch Target Standards */
.touch-target {
  min-height: 44px;
  min-width: 44px;
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
}

/* Extend hit area beyond visual element if needed */
.touch-target::after {
  content: '';
  position: absolute;
  top: -8px;
  right: -8px;
  bottom: -8px;
  left: -8px;
  z-index: -1;
}

/* Primary action buttons */
.mobile-btn-primary {
  min-height: 48px;
  min-width: 120px;
  padding: 12px 24px;
  border-radius: var(--mobile-radius-md);
  font-size: var(--mobile-text-base);
  font-weight: 600;
}

/* Secondary actions */
.mobile-btn-secondary {
  min-height: 44px;
  padding: 10px 16px;
  border-radius: var(--mobile-radius-sm);
  font-size: var(--mobile-text-sm);
}
```

### 📱 Mobile Layout Patterns

```css
/* Mobile container standards */
.mobile-container {
  width: 100%;
  min-height: 100vh;
  padding: var(--mobile-space-md);
  box-sizing: border-box;
}

/* Safe area handling for notches */
.mobile-safe-area {
  padding-top: env(safe-area-inset-top);
  padding-bottom: env(safe-area-inset-bottom);
  padding-left: env(safe-area-inset-left);
  padding-right: env(safe-area-inset-right);
}

/* Mobile grid system */
.mobile-grid {
  display: grid;
  gap: var(--mobile-space-md);
  padding: var(--mobile-space-md);
}

.mobile-grid-2 {
  grid-template-columns: repeat(2, 1fr);
}

.mobile-grid-3 {
  grid-template-columns: repeat(3, 1fr);
}

/* Card grid for collections */
.mobile-card-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
  gap: var(--mobile-space-sm);
  padding: var(--mobile-space-md);
}

/* List layouts */
.mobile-list {
  display: flex;
  flex-direction: column;
  gap: var(--mobile-space-xs);
}

.mobile-list-item {
  padding: var(--mobile-space-md);
  border-radius: var(--mobile-radius-md);
  min-height: var(--touch-target-min);
  display: flex;
  align-items: center;
}
```

### 🎭 Mobile Animation Standards

```css
/* Mobile-optimized animations (60fps) */
.mobile-transition {
  transition-duration: 0.2s;
  transition-timing-function: cubic-bezier(0.4, 0, 0.2, 1);
  will-change: transform;
}

/* Slide transitions */
.mobile-slide-up {
  transform: translateY(100%);
  transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.mobile-slide-up.active {
  transform: translateY(0);
}

/* Fade transitions */
.mobile-fade {
  opacity: 0;
  transition: opacity 0.2s ease-out;
}

.mobile-fade.active {
  opacity: 1;
}

/* Scale transitions for touch feedback */
.mobile-scale {
  transform: scale(1);
  transition: transform 0.1s ease-out;
}

.mobile-scale:active {
  transform: scale(0.96);
}
```

## 🔧 Responsive Design for Mobile

### 📏 Mobile Breakpoint System

```css
/* Mobile-first breakpoints */
:root {
  --mobile-xs: 320px;    /* Small phones */
  --mobile-sm: 375px;    /* iPhone SE, standard mobile */
  --mobile-md: 414px;    /* iPhone Pro */
  --mobile-lg: 480px;    /* Large phones */
  --tablet: 768px;       /* Tablets */
  --desktop: 1024px;     /* Desktop */
}

/* Mobile-first media queries */
@media (min-width: 320px) {
  /* Base mobile styles */
}

@media (min-width: 375px) {
  /* Larger phones */
  .mobile-container {
    padding: var(--mobile-space-lg);
  }
}

@media (min-width: 414px) {
  /* iPhone Pro sizes */
  .mobile-grid-3 {
    grid-template-columns: repeat(3, 1fr);
  }
}

@media (min-width: 480px) {
  /* Large phones / small tablets */
  .mobile-card-grid {
    grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
  }
}
```

### 🔄 Desktop Compatibility Layer

```css
/* When mobile styles are loaded on desktop */
@media (min-width: 768px) {
  .mobile-container {
    max-width: 480px;
    margin: 0 auto;
    box-shadow: 0 0 20px rgba(0, 0, 0, 0.1);
  }
  
  .mobile-nav {
    position: fixed;
    bottom: 0;
    left: 50%;
    transform: translateX(-50%);
    max-width: 480px;
    width: 100%;
  }
}
```

## 🧩 Component Development Standards

### 📱 Mobile Component Template

```jsx
// MobileCard.jsx
import React from 'react'
import { TeamCircle } from '../shared/TeamCircle'
import Icon from '../shared/Icon'
import './MobileCard.css'

function MobileCard({ 
  card, 
  onTap, 
  onSwipeLeft, 
  onSwipeRight, 
  className = '',
  ...props 
}) {
  return (
    <div 
      className={`mobile-card ${className}`}
      onClick={onTap}
      {...props}
    >
      <div className="mobile-card-image">
        {card.image_url ? (
          <img 
            src={card.image_url} 
            alt={`${card.player_name} ${card.year}`}
            className="card-image"
          />
        ) : (
          <div className="card-placeholder">
            <Icon name="card" size={48} />
          </div>
        )}
      </div>
      
      <div className="mobile-card-content">
        <div className="mobile-card-header">
          <h3 className="mobile-card-title">{card.player_name}</h3>
          <TeamCircle team={card.team} size="sm" />
        </div>
        
        <div className="mobile-card-details">
          <span className="card-year">{card.year}</span>
          <span className="card-number">#{card.card_number}</span>
        </div>
      </div>
      
      <div className="mobile-card-actions">
        <button className="mobile-btn-icon touch-target">
          <Icon name="heart" size={20} />
        </button>
        <button className="mobile-btn-icon touch-target">
          <Icon name="share" size={20} />
        </button>
      </div>
    </div>
  )
}

export default MobileCard
```

### 📱 Mobile Component CSS Template

```css
/* MobileCard.css */
.mobile-card {
  background: var(--mobile-bg-card);
  border-radius: var(--mobile-radius-md);
  border: 1px solid rgba(0, 0, 0, 0.08);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04);
  overflow: hidden;
  min-height: var(--touch-target-min);
  display: flex;
  flex-direction: column;
  transition: transform 0.2s ease, box-shadow 0.2s ease;
  cursor: pointer;
}

.mobile-card:active {
  transform: scale(0.98);
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.08);
}

.mobile-card-image {
  aspect-ratio: 2.5 / 3.5; /* Standard card ratio */
  background: var(--mobile-bg-tertiary);
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
}

.mobile-card-image .card-image {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.mobile-card-content {
  padding: var(--mobile-space-md);
  flex-grow: 1;
}

.mobile-card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: var(--mobile-space-xs);
}

.mobile-card-title {
  font-size: var(--mobile-text-base);
  font-weight: 600;
  color: var(--mobile-text-primary);
  margin: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  flex-grow: 1;
  margin-right: var(--mobile-space-sm);
}

.mobile-card-details {
  display: flex;
  gap: var(--mobile-space-sm);
  font-size: var(--mobile-text-sm);
  color: var(--mobile-text-secondary);
}

.mobile-card-actions {
  display: flex;
  gap: var(--mobile-space-xs);
  padding: var(--mobile-space-sm);
  border-top: 1px solid rgba(0, 0, 0, 0.04);
}

.mobile-btn-icon {
  width: var(--touch-target-min);
  height: var(--touch-target-min);
  border-radius: var(--mobile-radius-sm);
  border: none;
  background: var(--mobile-bg-secondary);
  color: var(--mobile-text-secondary);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.2s ease;
}

.mobile-btn-icon:hover {
  background: var(--mobile-bg-tertiary);
  color: var(--mobile-text-primary);
}

.mobile-btn-icon:active {
  transform: scale(0.94);
}

/* Mobile-specific states */
@media (max-width: 480px) {
  .mobile-card {
    border-radius: var(--mobile-radius-sm);
  }
  
  .mobile-card-content {
    padding: var(--mobile-space-sm);
  }
  
  .mobile-card-title {
    font-size: var(--mobile-text-sm);
  }
}
```

## 🔄 Integration with Existing System

### 📋 Conditional Loading Strategy

```jsx
// App.jsx - Load mobile or desktop styles conditionally
import React, { useEffect, useState } from 'react'

// Shared styles (always loaded)
import './styles/shared/_brand-colors.css'
import './styles/shared/_team-circles.css'
import './styles/shared/_icons.css'

function App() {
  const [isMobile, setIsMobile] = useState(false)
  
  useEffect(() => {
    const checkMobile = () => {
      const isMobileDevice = window.innerWidth <= 768 || 
                           /Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)
      setIsMobile(isMobileDevice)
    }
    
    checkMobile()
    window.addEventListener('resize', checkMobile)
    return () => window.removeEventListener('resize', checkMobile)
  }, [])
  
  useEffect(() => {
    // Dynamically load mobile or desktop styles
    if (isMobile) {
      import('./styles/mobile/mobile-main.css')
    } else {
      import('./styles/desktop/desktop-main.css')
    }
  }, [isMobile])
  
  return (
    <div className={isMobile ? 'mobile-app' : 'desktop-app'}>
      {/* App content */}
    </div>
  )
}
```

### 🎨 Visual Consistency Rules

```css
/* Ensure team circles look the same on mobile and desktop */
.team-circle {
  width: var(--circle-size, 32px);
  height: var(--circle-size, 32px);
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: bold;
  color: white;
  background: var(--team-color);
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}

/* Size variants */
.team-circle.size-sm { --circle-size: 24px; font-size: 10px; }
.team-circle.size-md { --circle-size: 32px; font-size: 12px; }
.team-circle.size-lg { --circle-size: 48px; font-size: 16px; }

/* Mobile-specific adjustments */
@media (max-width: 768px) {
  .team-circle {
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.12);
  }
}
```

## 🧪 Testing Standards

### 📱 Mobile Testing Requirements

```javascript
// Component tests should include mobile-specific scenarios
describe('MobileCard', () => {
  it('renders with minimum touch target size', () => {
    render(<MobileCard card={mockCard} />)
    const card = screen.getByRole('button')
    
    // Check minimum touch target
    expect(card).toHaveStyle({
      minHeight: '44px',
      minWidth: '44px'
    })
  })
  
  it('handles touch interactions', () => {
    const onTap = jest.fn()
    render(<MobileCard card={mockCard} onTap={onTap} />)
    
    fireEvent.touchStart(screen.getByRole('button'))
    fireEvent.touchEnd(screen.getByRole('button'))
    
    expect(onTap).toHaveBeenCalled()
  })
  
  it('maintains accessibility on mobile', () => {
    render(<MobileCard card={mockCard} />)
    
    // Should have proper ARIA labels
    expect(screen.getByRole('button')).toHaveAttribute('aria-label')
    
    // Should support keyboard navigation
    expect(screen.getByRole('button')).toHaveAttribute('tabindex', '0')
  })
})
```

### 🎯 Visual Regression Testing

```javascript
// Storybook stories for mobile components
export default {
  title: 'Mobile/Cards/MobileCard',
  component: MobileCard,
  parameters: {
    viewport: {
      viewports: {
        mobile: { name: 'Mobile', styles: { width: '375px', height: '667px' } },
        tablet: { name: 'Tablet', styles: { width: '768px', height: '1024px' } }
      }
    }
  }
}

export const Default = {
  args: {
    card: mockCardData
  }
}

export const WithoutImage = {
  args: {
    card: { ...mockCardData, image_url: null }
  }
}

export const LongPlayerName = {
  args: {
    card: { ...mockCardData, player_name: 'This is a very long player name' }
  }
}
```

## 📋 Implementation Checklist

### 🎨 Design System Setup
- [ ] Create mobile design token system
- [ ] Establish mobile color palette with high contrast
- [ ] Define mobile typography scale (16px base to prevent zoom)
- [ ] Create touch target size standards (44px minimum)
- [ ] Set up mobile-specific spacing scale
- [ ] Define mobile animation performance standards

### 📱 Component Architecture
- [ ] Create mobile component library structure
- [ ] Establish naming conventions (Mobile* prefix)
- [ ] Build shared component system (TeamCircle, Icon, etc.)
- [ ] Create mobile-specific interaction components
- [ ] Implement swipe/gesture components
- [ ] Build bottom sheet/modal system

### 🔧 Development Workflow
- [ ] Set up mobile-specific build pipeline
- [ ] Configure mobile testing environment
- [ ] Create Storybook mobile viewport configurations
- [ ] Establish mobile performance budgets
- [ ] Set up mobile accessibility testing
- [ ] Configure mobile-specific linting rules

### ✅ Quality Assurance
- [ ] Touch target size validation
- [ ] Mobile accessibility compliance (WCAG AA)
- [ ] Performance testing on actual devices
- [ ] Cross-platform mobile testing (iOS/Android)
- [ ] Offline functionality testing
- [ ] Battery usage optimization

---

## 💡 Key Implementation Principles

### 🎯 **Separate but Consistent**
Mobile styles are completely separate files but maintain visual consistency through shared design tokens and brand elements.

### 👆 **Touch-First Design**
Every interactive element is designed for touch interaction with minimum 44px targets and appropriate spacing.

### ⚡ **Performance-Optimized**
Mobile CSS is optimized for 60fps animations and minimal reflow/repaint operations.

### 🔄 **Scalable Architecture**  
The component system scales from simple cards to complex admin interfaces while maintaining consistency.

### 🧪 **Testing-Driven**
Every mobile component includes tests for touch interactions, accessibility, and performance.

This coding standards document ensures that the mobile implementation maintains the quality and consistency of the desktop version while being optimized for the unique requirements of mobile users.