import { Routes, Route } from 'react-router-dom'
import HomePage from './pages/HomePage'
import AdminPage from './pages/AdminPage'
import ClubAdminPage from './pages/ClubAdminPage'
import SettingsPage from './pages/SettingsPage'
import ClubPage from './pages/ClubPage'

function App() {
  return (
    <div style={{ fontFamily: 'Arial, sans-serif', minHeight: '100vh', background: '#1a1a2e', color: '#eee' }}>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/admin" element={<AdminPage />} />
        <Route path="/clubAdmin" element={<ClubAdminPage />} />
        <Route path="/settings" element={<SettingsPage />} />
        <Route path="/club/:clubId" element={<ClubPage />} />
      </Routes>
    </div>
  )
}

export default App