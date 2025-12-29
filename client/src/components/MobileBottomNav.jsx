import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import Icon from './Icon'
import './MobileBottomNav.css'

/**
 * MobileBottomNav - Fixed bottom navigation for mobile users
 *
 * Provides thumb-zone accessible navigation for the most common actions:
 * - Home/Search
 * - Browse (Players/Teams/Sets)
 * - Quick Add (for authenticated users)
 * - Collection (for authenticated users)
 * - Profile/Login
 */
function MobileBottomNav() {
  const location = useLocation()
  const navigate = useNavigate()
  const { isAuthenticated, user } = useAuth()

  // Don't show on admin pages
  if (location.pathname.startsWith('/admin')) {
    return null
  }

  const isActive = (path) => {
    if (path === '/') {
      return location.pathname === '/'
    }
    return location.pathname.startsWith(path)
  }

  const handleQuickAdd = () => {
    // Navigate to collection with add modal trigger
    // This could be enhanced to open a quick-add sheet
    navigate('/collection?action=add')
  }

  return (
    <nav className="mobile-bottom-nav">
      <div className="mobile-bottom-nav-container">
        {/* Home/Search */}
        <Link
          to="/"
          className={`mobile-nav-item ${isActive('/') ? 'active' : ''}`}
        >
          <Icon name="home" size={22} />
          <span>Home</span>
        </Link>

        {/* Browse - Players/Teams/Sets */}
        <Link
          to="/players"
          className={`mobile-nav-item ${isActive('/players') || isActive('/teams') || isActive('/sets') ? 'active' : ''}`}
        >
          <Icon name="search" size={22} />
          <span>Browse</span>
        </Link>

        {/* Quick Add - Central action button (authenticated only) */}
        {isAuthenticated ? (
          <button
            className="mobile-nav-item mobile-nav-add-btn"
            onClick={handleQuickAdd}
            aria-label="Quick add card"
          >
            <div className="mobile-nav-add-icon">
              <Icon name="plus" size={24} />
            </div>
            <span>Add</span>
          </button>
        ) : (
          <Link
            to="/sets"
            className={`mobile-nav-item ${isActive('/sets') ? 'active' : ''}`}
          >
            <Icon name="series" size={22} />
            <span>Sets</span>
          </Link>
        )}

        {/* Collection (authenticated) or Sets (public) */}
        {isAuthenticated ? (
          <Link
            to="/collection"
            className={`mobile-nav-item ${isActive('/collection') || isActive('/lists') ? 'active' : ''}`}
          >
            <Icon name="collections" size={22} />
            <span>Collection</span>
          </Link>
        ) : (
          <Link
            to="/auth"
            className={`mobile-nav-item ${isActive('/auth') ? 'active' : ''}`}
          >
            <Icon name="log-in" size={22} />
            <span>Sign In</span>
          </Link>
        )}

        {/* Profile/Account */}
        {isAuthenticated ? (
          <Link
            to="/profile"
            className={`mobile-nav-item ${isActive('/profile') ? 'active' : ''}`}
          >
            {user?.avatar_url ? (
              <img
                src={user.avatar_url}
                alt=""
                className="mobile-nav-avatar"
                onError={(e) => {
                  e.target.style.display = 'none'
                  e.target.nextSibling.style.display = 'flex'
                }}
              />
            ) : null}
            <div
              className="mobile-nav-avatar-fallback"
              style={{ display: user?.avatar_url ? 'none' : 'flex' }}
            >
              {user?.first_name?.[0] || user?.username?.[0] || 'U'}
            </div>
            <span>Profile</span>
          </Link>
        ) : (
          <Link
            to="/players"
            className={`mobile-nav-item ${isActive('/players') ? 'active' : ''}`}
          >
            <Icon name="player" size={22} />
            <span>Players</span>
          </Link>
        )}
      </div>

      {/* Safe area spacer for iOS */}
      <div className="mobile-bottom-nav-safe-area" />
    </nav>
  )
}

export default MobileBottomNav
