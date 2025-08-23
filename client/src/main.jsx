import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { AuthProvider } from './contexts/AuthContext.jsx'
import { ToastProvider } from './contexts/ToastContext.jsx'
import ProtectedRoute from './components/ProtectedRoute.jsx'
import Layout from './components/Layout.jsx'
import App from './App.jsx'
import Status from './pages/Status.jsx'
import Auth from './pages/Auth.jsx'
import Dashboard from './pages/Dashboard.jsx'
import Profile from './pages/Profile.jsx'
import Attributions from './pages/Attributions.jsx'
import PlayerDetail from './pages/PlayerDetail.jsx'
import PlayersLanding from './pages/PlayersLanding.jsx'
import TeamsLanding from './pages/TeamsLanding.jsx'
import TeamDetail from './pages/TeamDetail.jsx'
import SeriesLanding from './pages/SeriesLanding.jsx'
import SeriesDetail from './pages/SeriesDetail.jsx'
import Admin from './pages/Admin.jsx'
import AdminUsers from './pages/AdminUsers.jsx'
import AdminTeams from './pages/AdminTeams.jsx'
import SpreadsheetIngestion from './pages/SpreadsheetIngestion.jsx'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <ToastProvider>
        <AuthProvider>
          <Layout>
            <Routes>
              <Route path="/" element={<App />} />
              <Route path="/status" element={<Status />} />
              <Route path="/auth/:mode" element={<Auth />} />
              <Route path="/login" element={<Auth />} />
              <Route path="/register" element={<Auth />} />
              <Route path="/attributions" element={<Attributions />} />
              <Route 
                path="/dashboard" 
                element={
                  <ProtectedRoute>
                    <Dashboard />
                  </ProtectedRoute>
                } 
              />
              <Route 
                path="/profile" 
                element={
                  <ProtectedRoute>
                    <Profile />
                  </ProtectedRoute>
                } 
              />
              <Route path="/players" element={<PlayersLanding />} />
              <Route path="/players/:playerSlug" element={<PlayerDetail />} />
              <Route path="/teams" element={<TeamsLanding />} />
              <Route path="/teams/:teamSlug" element={<TeamDetail />} />
              <Route path="/series" element={<SeriesLanding />} />
              <Route path="/series/:seriesSlug" element={<SeriesDetail />} />
              <Route 
                path="/admin" 
                element={
                  <ProtectedRoute>
                    <Admin />
                  </ProtectedRoute>
                } 
              />
              <Route 
                path="/admin/users" 
                element={
                  <ProtectedRoute>
                    <AdminUsers />
                  </ProtectedRoute>
                } 
              />
              <Route 
                path="/admin/teams" 
                element={
                  <ProtectedRoute>
                    <AdminTeams />
                  </ProtectedRoute>
                } 
              />
              <Route 
                path="/admin/ingestion" 
                element={
                  <ProtectedRoute>
                    <SpreadsheetIngestion />
                  </ProtectedRoute>
                } 
              />
            </Routes>
          </Layout>
        </AuthProvider>
      </ToastProvider>
    </BrowserRouter>
  </React.StrictMode>,
)