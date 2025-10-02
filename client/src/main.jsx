import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { AuthProvider } from './contexts/AuthContext.jsx'
import { ToastProvider } from './contexts/ToastContext.jsx'
import ProtectedRoute from './components/ProtectedRoute.jsx'
import Layout from './components/Layout.jsx'
import App from './App.jsx'
// import Status from './pages/Status.jsx' // Commented out for SeriesDetail page independence
import Auth from './pages/Auth.jsx'
// import Dashboard from './pages/Dashboard.jsx' // Commented out for SeriesDetail page independence
// import Profile from './pages/Profile.jsx' // Commented out for SeriesDetail page independence
// import Attributions from './pages/Attributions.jsx' // Commented out for SeriesDetail page independence
import PlayerDetail from './pages/PlayerDetail.jsx'
import PlayersLanding from './pages/PlayersLanding.jsx'
import TeamsLanding from './pages/TeamsLanding.jsx'
import TeamDetail from './pages/TeamDetail.jsx'
import YearsPage from './pages/YearsPage.jsx'
import SetsPage from './pages/SetsPage.jsx'
import SeriesPage from './pages/SeriesPage.jsx'
import SeriesDetail from './pages/SeriesDetail/SeriesDetail.jsx'
import SearchResults from './pages/SearchResults.jsx'
import Admin from './pages/Admin.jsx'
import AdminUsers from './pages/AdminUsers.jsx'
import AdminTeams from './pages/AdminTeams.jsx'
import AdminPlayers from './pages/AdminPlayers.jsx'
import AdminSets from './pages/AdminSets.jsx'
import AdminSeries from './pages/AdminSeries.jsx'
import AdminCards from './pages/AdminCards.jsx'
import AdminImport from './pages/AdminImport.jsx'
import CollectionDashboard from './pages/CollectionDashboard.jsx'
import CardDetail from './pages/CardDetail.jsx'
import PublicProfile from './pages/PublicProfile.jsx'
import ProfileManagement from './pages/ProfileManagement.jsx'
import DesignSystemDemo from './pages/DesignSystemDemo.jsx'
import Achievements from './pages/Achievements.jsx'
import Notifications from './pages/Notifications.jsx'
import AdminAchievements from './pages/AdminAchievements.jsx'
import AdminQueryTester from './pages/AdminQueryTester.jsx'
import VerifyEmail from './pages/VerifyEmail.jsx'
import './index.css'
// import './styles/global-design-system.css' // Temporarily removed to prevent conflicts

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <ToastProvider>
        <AuthProvider>
          <Layout>
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
              <Route path="/sets/:year/:setSlug/:seriesSlug/:cardSlug" element={<CardDetail />} />
              <Route path="/card/:seriesSlug/:cardNumber/:playerName" element={<CardDetail />} />
              <Route path="/admin" element={<ProtectedRoute><Admin /></ProtectedRoute>} />
              <Route path="/admin/users" element={<ProtectedRoute><AdminUsers /></ProtectedRoute>} />
              <Route path="/admin/teams" element={<ProtectedRoute><AdminTeams /></ProtectedRoute>} />
              <Route path="/admin/players" element={<ProtectedRoute><AdminPlayers /></ProtectedRoute>} />
              <Route path="/admin/sets" element={<ProtectedRoute><AdminSets /></ProtectedRoute>} />
              <Route path="/admin/sets/:year" element={<ProtectedRoute><AdminSets /></ProtectedRoute>} />
              <Route path="/admin/series" element={<ProtectedRoute><AdminSeries /></ProtectedRoute>} />
              <Route path="/admin/cards" element={<ProtectedRoute><AdminCards /></ProtectedRoute>} />
              {/* <Route path="/admin/sets/:year/:setSlug" element={<ProtectedRoute><AdminSets /></ProtectedRoute>} /> */}
              {/* <Route path="/admin/sets/:year/:setSlug/:seriesSlug" element={<ProtectedRoute><AdminSets /></ProtectedRoute>} /> */}
              <Route path="/admin/cards/:year/:setSlug/:seriesSlug" element={<ProtectedRoute><AdminCards /></ProtectedRoute>} />
              <Route path="/admin/import" element={<ProtectedRoute><AdminImport /></ProtectedRoute>} />
              
              {/* Design System Demo - Testing new CSS system */}
              <Route path="/design-system-demo" element={<DesignSystemDemo />} />
              
              {/* Achievements routes - MUST BE BEFORE username route */}
              <Route path="/achievements" element={<ProtectedRoute><Achievements /></ProtectedRoute>} />
              <Route path="/notifications" element={<ProtectedRoute><Notifications /></ProtectedRoute>} />
              <Route path="/admin/achievements" element={<ProtectedRoute><AdminAchievements /></ProtectedRoute>} />
              <Route path="/admin/query-tester" element={<ProtectedRoute><AdminQueryTester /></ProtectedRoute>} />
              
              {/* Public profile route - MUST BE LAST to avoid conflicts with other routes */}
              <Route path="/:username" element={<PublicProfile />} />
            </Routes>
          </Layout>
        </AuthProvider>
      </ToastProvider>
    </BrowserRouter>
  </React.StrictMode>,
)