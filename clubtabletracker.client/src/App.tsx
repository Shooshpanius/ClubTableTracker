import { Routes, Route } from 'react-router-dom'
import HomePage from './pages/HomePage'
import AdminPage from './pages/AdminPage'
import ClubAdminPage from './pages/ClubAdminPage'
import SettingsPage from './pages/SettingsPage'
import ClubPage from './pages/ClubPage'
import MessengerPage from './pages/MessengerPage'
import LoginPage from './pages/LoginPage'
import OAuthCallbackPage from './pages/OAuthCallbackPage'

function App() {
  return (
    <div className="gd-app" style={{ minHeight: '100vh' }}>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/admin" element={<AdminPage />} />
        <Route path="/clubAdmin" element={<ClubAdminPage />} />
        <Route path="/settings" element={<SettingsPage />} />
        <Route path="/club/:clubId" element={<ClubPage />} />
        <Route path="/messages" element={<MessengerPage />} />
        <Route path="/auth/yandex/callback" element={<OAuthCallbackPage provider="yandex" />} />
        <Route path="/auth/vk/callback" element={<OAuthCallbackPage provider="vk" />} />
      </Routes>
    </div>
  )
}

export default App