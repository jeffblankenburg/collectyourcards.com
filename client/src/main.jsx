import { StrictMode, lazy, Suspense } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { AuthProvider } from './contexts/AuthContext.jsx'
import { ToastProvider } from './contexts/ToastContext.jsx'
import ProtectedRoute from './components/ProtectedRoute.jsx'
import Layout from './components/Layout.jsx'
import ChunkErrorBoundary from './components/ChunkErrorBoundary.jsx'
import VersionChecker from './components/VersionChecker.jsx'
import App from './App.jsx'
import { setupAxiosInterceptors } from './utils/axios-interceptor.js'
import './index.css'
// import './styles/global-design-system.css' // Temporarily removed to prevent conflicts

// Initialize axios interceptors for automatic API logging
setupAxiosInterceptors()

// Handle Vite preload errors (chunk load failures) - auto reload
window.addEventListener('vite:preloadError', (event) => {
  console.warn('Vite preload error, reloading page:', event.payload)
  window.location.reload()
})

// Loading fallback component
const PageLoader = () => (
  <div style={{
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: '60vh',
    flexDirection: 'column',
    gap: '1rem'
  }}>
    <div style={{
      width: '40px',
      height: '40px',
      border: '3px solid #f3f3f3',
      borderTop: '3px solid #3498db',
      borderRadius: '50%',
      animation: 'spin 1s linear infinite'
    }} />
    <p style={{ color: '#666', fontSize: '14px' }}>Loading...</p>
    <style>{`
      @keyframes spin {
        0% { transform: rotate(0deg); }
        100% { transform: rotate(360deg); }
      }
    `}</style>
  </div>
)

// Lazy load all pages for code splitting
const Auth = lazy(() => import('./pages/Auth.jsx'))
const PlayerDetail = lazy(() => import('./pages/PlayerDetail.jsx'))
const PlayersLanding = lazy(() => import('./pages/PlayersLanding.jsx'))
const TeamsLanding = lazy(() => import('./pages/TeamsLanding.jsx'))
const TeamDetail = lazy(() => import('./pages/TeamDetail.jsx'))
const YearsPage = lazy(() => import('./pages/YearsPage.jsx'))
const SetsPage = lazy(() => import('./pages/SetsPage.jsx'))
const SeriesPage = lazy(() => import('./pages/SeriesPage.jsx'))
const SeriesDetail = lazy(() => import('./pages/SeriesDetail.jsx'))
const SearchResults = lazy(() => import('./pages/SearchResults.jsx'))
const Admin = lazy(() => import('./pages/Admin.jsx'))
const AdminUsers = lazy(() => import('./pages/AdminUsers.jsx'))
const AdminTeams = lazy(() => import('./pages/AdminTeams.jsx'))
const AdminPlayers = lazy(() => import('./pages/AdminPlayers.jsx'))
const AdminSets = lazy(() => import('./pages/AdminSets.jsx'))
const AdminSeries = lazy(() => import('./pages/AdminSeries.jsx'))
const AdminCards = lazy(() => import('./pages/AdminCards.jsx'))
const AdminCardsNeedingReference = lazy(() => import('./pages/AdminCardsNeedingReference.jsx'))
const AdminImport = lazy(() => import('./pages/AdminImport.jsx'))
const CollectionDashboard = lazy(() => import('./pages/CollectionDashboard.jsx'))
const CardDetail = lazy(() => import('./pages/CardDetail.jsx'))
const RainbowView = lazy(() => import('./pages/RainbowView.jsx'))
const PublicProfile = lazy(() => import('./pages/PublicProfile.jsx'))
const ProfileManagement = lazy(() => import('./pages/ProfileManagement.jsx'))
const DesignSystemDemo = lazy(() => import('./pages/DesignSystemDemo.jsx'))
const PWADemo = lazy(() => import('./pages/PWADemo.jsx'))
const Achievements = lazy(() => import('./pages/Achievements.jsx'))
const Notifications = lazy(() => import('./pages/Notifications.jsx'))
const AdminAchievements = lazy(() => import('./pages/AdminAchievements.jsx'))
const AdminQueryTester = lazy(() => import('./pages/AdminQueryTester.jsx'))
const VerifyEmail = lazy(() => import('./pages/VerifyEmail.jsx'))
const CheckEmail = lazy(() => import('./pages/CheckEmail.jsx'))
const Lists = lazy(() => import('./pages/Lists.jsx'))
const ListDetail = lazy(() => import('./pages/ListDetail.jsx'))
const Blog = lazy(() => import('./pages/Blog.jsx'))
const BlogPost = lazy(() => import('./pages/BlogPost.jsx'))
const SharedCollectionView = lazy(() => import('./pages/SharedCollectionView.jsx'))
const SellerDashboard = lazy(() => import('./pages/SellerDashboard.jsx'))
const SuppliesManagement = lazy(() => import('./pages/SuppliesManagement.jsx'))
const ShippingConfigs = lazy(() => import('./pages/ShippingConfigs.jsx'))
const SetPurchases = lazy(() => import('./pages/SetPurchases.jsx'))
const SetPurchaseDetail = lazy(() => import('./pages/SetPurchaseDetail.jsx'))
const SellerSetDetail = lazy(() => import('./pages/SellerSetDetail.jsx'))
const SellerPlayerDetail = lazy(() => import('./pages/SellerPlayerDetail.jsx'))
const SellerAdmin = lazy(() => import('./pages/SellerAdmin.jsx'))

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <ToastProvider>
        <AuthProvider>
          <Layout>
            <ChunkErrorBoundary>
              <Suspense fallback={<PageLoader />}>
                <Routes>
              {/* Home page restored with local styles */}
              <Route path="/" element={<App />} />
              {/* Other routes commented out for page independence */}
              <Route path="/search" element={<SearchResults />} />
              {/* <Route path="/status" element={<Status />} /> */}
              <Route path="/auth/:mode" element={<Auth />} />
              <Route path="/login" element={<Auth />} />
              <Route path="/register" element={<Auth />} />
              <Route path="/verify-email" element={<VerifyEmail />} />
              <Route path="/check-email" element={<CheckEmail />} />
              {/* <Route path="/attributions" element={<Attributions />} /> */}
              {/* <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} /> */}
              <Route path="/profile" element={<ProtectedRoute><ProfileManagement /></ProtectedRoute>} />
              <Route path="/settings" element={<ProtectedRoute><ProfileManagement /></ProtectedRoute>} />
              <Route path="/collection" element={<ProtectedRoute><CollectionDashboard /></ProtectedRoute>} />
              <Route path="/players" element={<PlayersLanding />} />
              <Route path="/players/:playerSlug" element={<PlayerDetail />} />
              <Route path="/players/:playerSlug/:teamSlug" element={<PlayerDetail />} />
              <Route path="/teams" element={<TeamsLanding />} />
              <Route path="/teams/:teamSlug" element={<TeamDetail />} />
              <Route path="/sets" element={<YearsPage />} />
              <Route path="/sets/:year" element={<SetsPage />} />
              <Route path="/sets/:year/:setSlug" element={<SeriesPage />} />
              
              {/* SeriesDetail routes - ONLY THESE ARE ACTIVE */}
              <Route path="/sets/:year/:setSlug/:seriesSlug" element={<SeriesDetail />} />
              <Route path="/series/:seriesSlug" element={<SeriesDetail />} />
              
              {/* CardDetail routes */}
              <Route path="/sets/:year/:setSlug/:seriesSlug/:cardNumber/:playerName" element={<CardDetail />} />
              <Route path="/card/:seriesSlug/:cardNumber/:playerName" element={<CardDetail />} />

              {/* RainbowView route - shows all parallel cards with same card number */}
              <Route path="/rainbow/:year/:setSlug/:seriesSlug/:cardNumber/:playerName" element={<RainbowView />} />

              <Route path="/admin" element={<ProtectedRoute><Admin /></ProtectedRoute>} />
              <Route path="/admin/users" element={<ProtectedRoute><AdminUsers /></ProtectedRoute>} />
              <Route path="/admin/teams" element={<ProtectedRoute><AdminTeams /></ProtectedRoute>} />
              <Route path="/admin/players" element={<ProtectedRoute><AdminPlayers /></ProtectedRoute>} />
              <Route path="/admin/sets" element={<ProtectedRoute><AdminSets /></ProtectedRoute>} />
              <Route path="/admin/sets/:year" element={<ProtectedRoute><AdminSets /></ProtectedRoute>} />
              <Route path="/admin/series" element={<ProtectedRoute><AdminSeries /></ProtectedRoute>} />
              <Route path="/admin/cards" element={<ProtectedRoute><AdminCards /></ProtectedRoute>} />
              <Route path="/admin/cards-needing-reference" element={<ProtectedRoute><AdminCardsNeedingReference /></ProtectedRoute>} />
              {/* <Route path="/admin/sets/:year/:setSlug" element={<ProtectedRoute><AdminSets /></ProtectedRoute>} /> */}
              {/* <Route path="/admin/sets/:year/:setSlug/:seriesSlug" element={<ProtectedRoute><AdminSets /></ProtectedRoute>} /> */}
              <Route path="/admin/cards/:year/:setSlug/:seriesSlug" element={<ProtectedRoute><AdminCards /></ProtectedRoute>} />
              <Route path="/admin/import" element={<ProtectedRoute><AdminImport /></ProtectedRoute>} />
              
              {/* Design System Demo - Testing new CSS system */}
              <Route path="/design-system-demo" element={<DesignSystemDemo />} />

              {/* PWA Demo - Mobile UI Components */}
              <Route path="/pwa-demo" element={<PWADemo />} />

              {/* Achievements routes - MUST BE BEFORE username route */}
              <Route path="/achievements" element={<ProtectedRoute><Achievements /></ProtectedRoute>} />
              <Route path="/notifications" element={<ProtectedRoute><Notifications /></ProtectedRoute>} />
              <Route path="/admin/achievements" element={<ProtectedRoute><AdminAchievements /></ProtectedRoute>} />
              <Route path="/admin/query-tester" element={<ProtectedRoute><AdminQueryTester /></ProtectedRoute>} />
              <Route path="/seller" element={<ProtectedRoute><SellerDashboard /></ProtectedRoute>} />
              <Route path="/seller/supplies" element={<ProtectedRoute><SuppliesManagement /></ProtectedRoute>} />
              <Route path="/seller/shipping" element={<ProtectedRoute><ShippingConfigs /></ProtectedRoute>} />
              <Route path="/seller/purchases" element={<ProtectedRoute><SetPurchases /></ProtectedRoute>} />
              <Route path="/seller/purchases/:setId" element={<ProtectedRoute><SetPurchaseDetail /></ProtectedRoute>} />
              <Route path="/seller/sets/:setId" element={<ProtectedRoute><SellerSetDetail /></ProtectedRoute>} />
              <Route path="/seller/players/:playerId" element={<ProtectedRoute><SellerPlayerDetail /></ProtectedRoute>} />
              <Route path="/admin/seller" element={<ProtectedRoute><SellerAdmin /></ProtectedRoute>} />

              {/* Lists routes - MUST BE BEFORE username route */}
              <Route path="/lists" element={<ProtectedRoute><Lists /></ProtectedRoute>} />
              <Route path="/lists/:slug" element={<ProtectedRoute><ListDetail /></ProtectedRoute>} />

              {/* Blog routes - MUST BE BEFORE username route */}
              <Route path="/blog" element={<Blog />} />
              <Route path="/blog/:slug" element={<BlogPost />} />

              {/* Shared collection view route - MUST BE BEFORE username route */}
              <Route path="/shared/:slug" element={<SharedCollectionView />} />

              {/* Public profile route - MUST BE LAST to avoid conflicts with other routes */}
              <Route path="/:username" element={<PublicProfile />} />

              {/* Public list route - username-scoped lists */}
              <Route path="/:username/:listSlug" element={<ListDetail />} />
                </Routes>
              </Suspense>
            </ChunkErrorBoundary>
            <VersionChecker />
          </Layout>
        </AuthProvider>
      </ToastProvider>
    </BrowserRouter>
  </StrictMode>,
)