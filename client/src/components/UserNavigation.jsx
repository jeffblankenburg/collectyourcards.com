import { Link, useLocation } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import Icon from './Icon'
import './UserNavigation.css'

function UserNavigation() {
  const location = useLocation()
  const { isAuthenticated, user } = useAuth()

  const publicRoutes = [
    { path: '/players', name: 'Players', icon: 'player' },
    { path: '/teams', name: 'Teams', icon: 'team' },
    { path: '/sets', name: 'Sets', icon: 'series' }
  ]

  // Check if user has seller access (seller_role or admin)
  const hasSellerAccess = user?.seller_role ||
    user?.role === 'admin' ||
    user?.role === 'superadmin'

  // Build user routes dynamically
  const userRoutes = [
    ...(hasSellerAccess ? [{ path: '/seller', name: 'My Sales', icon: 'dollar-sign' }] : []),
    { path: '/collection', name: 'My Collection', icon: 'collections' },
    { path: '/lists', name: 'My Lists', icon: 'list' }
  ]

  return (
    <nav className="user-navigation">
      <div className="user-nav-container">
        {/* Left side: Public links */}
        <div className="user-nav-items left">
          {publicRoutes.map(route => (
            <Link
              key={route.path}
              to={route.path}
              className={`user-nav-item ${location.pathname.startsWith(route.path) ? 'active' : ''}`}
            >
              <Icon name={route.icon} size={16} />
              <span>{route.name}</span>
            </Link>
          ))}
        </div>

        {/* Right side: Authenticated user links */}
        {isAuthenticated && (
          <div className="user-nav-items right">
            {userRoutes.map(route => (
              <Link
                key={route.path}
                to={route.path}
                className={`user-nav-item ${location.pathname.startsWith(route.path) ? 'active' : ''}`}
              >
                <Icon name={route.icon} size={16} />
                <span>{route.name}</span>
              </Link>
            ))}
          </div>
        )}
      </div>
    </nav>
  )
}

export default UserNavigation
