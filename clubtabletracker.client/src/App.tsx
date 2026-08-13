import { Routes, Route } from 'react-router-dom'
import HomePage from './pages/HomePage'
import AdminPage from './pages/AdminPage'
import ClubAdminPage from './pages/ClubAdminPage'
import SettingsPage from './pages/SettingsPage'
import ClubPage from './pages/ClubPage'
import MessengerPage from './pages/MessengerPage'
import LoginPage from './pages/LoginPage'
import OAuthCallbackPage from './pages/OAuthCallbackPage'
// Pre-migration legacy pages (restored from commit 0cd3688 "v4 в верстку")
import LegacyHomePage from './pages/legacy/HomePage'
import LegacyAdminPage from './pages/legacy/AdminPage'
import LegacyClubAdminPage from './pages/legacy/ClubAdminPage'
import LegacySettingsPage from './pages/legacy/SettingsPage'
import LegacyClubPage from './pages/legacy/ClubPage'
import LegacyMessengerPage from './pages/legacy/MessengerPage'
import DesignToggle from './components/DesignToggle'
import { useDesignMode } from './utils/useDesignMode'
import './styles/legacy.css'

function App() {
  const { isLegacy, toggle } = useDesignMode()

  return (
    <div className={isLegacy ? 'legacy-app' : 'gd-app'} style={{ minHeight: '100vh' }}>
      <Routes>
        <Route path="/" element={isLegacy ? <LegacyHomePage /> : <HomePage />} />
        {/* /login did not exist pre-migration (auth lived on the home page) —
            the Grimdark LoginPage is used in both modes */}
        <Route path="/login" element={<LoginPage />} />
        <Route path="/admin" element={isLegacy ? <LegacyAdminPage /> : <AdminPage />} />
        <Route path="/clubAdmin" element={isLegacy ? <LegacyClubAdminPage /> : <ClubAdminPage />} />
        <Route path="/settings" element={isLegacy ? <LegacySettingsPage /> : <SettingsPage />} />
        <Route path="/club/:clubId" element={isLegacy ? <LegacyClubPage /> : <ClubPage />} />
        <Route path="/messages" element={isLegacy ? <LegacyMessengerPage /> : <MessengerPage />} />
        <Route path="/auth/yandex/callback" element={<OAuthCallbackPage provider="yandex" />} />
        <Route path="/auth/vk/callback" element={<OAuthCallbackPage provider="vk" />} />
      </Routes>
      <DesignToggle design={isLegacy ? 'legacy' : 'grimdark'} onToggle={toggle} />
    </div>
  )
}

export default App
