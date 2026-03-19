import { useState, useEffect } from 'react'
import { GoogleLogin } from '@react-oauth/google'
import ClubMap from '../components/ClubMap'
import BookingForm from '../components/BookingForm'
import Schedule from '../components/Schedule'

interface User { id: string; email: string; name: string }
interface Club { id: number; name: string; description: string }
interface Membership { id: number; status: string; club: Club }
interface GameTable { id: number; number: string; size: string; supportedGames: string; x: number; y: number; width: number; height: number }
interface Booking { id: number; tableId: number; startTime: string; endTime: string; user: { id: string; name: string }; participants: { id: string; name: string }[] }

export default function HomePage() {
  const [user, setUser] = useState<User | null>(null)
  const [token, setToken] = useState(localStorage.getItem('token') || '')
  const [clubs, setClubs] = useState<Club[]>([])
  const [memberships, setMemberships] = useState<Membership[]>([])
  const [selectedClub, setSelectedClub] = useState<Club | null>(null)
  const [tables, setTables] = useState<GameTable[]>([])
  const [bookings, setBookings] = useState<Booking[]>([])
  const [selectedTable, setSelectedTable] = useState<GameTable | null>(null)
  const [view, setView] = useState<'map' | 'schedule'>('map')

  useEffect(() => {
    fetch('/api/club').then(r => r.json()).then(setClubs).catch(() => {})
    if (token) {
      const payload = JSON.parse(atob(token.split('.')[1]))
      setUser({
        id: payload['http://schemas.xmlsoap.org/ws/2005/05/identity/claims/nameidentifier'],
        email: payload['http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress'],
        name: payload['http://schemas.xmlsoap.org/ws/2005/05/identity/claims/name']
      })
      fetch('/api/club/my-memberships', { headers: { Authorization: `Bearer ${token}` } })
        .then(r => r.json()).then(setMemberships).catch(() => {})
    }
  }, [token])

  const handleGoogleLogin = async (credentialResponse: { credential?: string }) => {
    if (!credentialResponse.credential) return
    const res = await fetch('/api/auth/google', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ credential: credentialResponse.credential })
    })
    if (res.ok) {
      const data = await res.json()
      localStorage.setItem('token', data.token)
      setToken(data.token)
      setUser(data.user)
    }
  }

  const logout = () => {
    localStorage.removeItem('token')
    setToken('')
    setUser(null)
    setMemberships([])
    setSelectedClub(null)
  }

  const applyToClub = async (clubId: number) => {
    const res = await fetch(`/api/club/${clubId}/apply`, {
      method: 'POST', headers: { Authorization: `Bearer ${token}` }
    })
    if (res.ok) {
      const data = await res.json()
      const club = clubs.find(c => c.id === clubId)!
      setMemberships([...memberships, { id: data.id, status: data.status, club }])
    } else {
      const text = await res.text()
      alert(text || 'Failed to apply')
    }
  }

  const selectClub = async (club: Club) => {
    setSelectedClub(club)
    setSelectedTable(null)
    const [tablesRes, bookingsRes] = await Promise.all([
      fetch(`/api/club/${club.id}/tables`, { headers: { Authorization: `Bearer ${token}` } }),
      fetch(`/api/booking/club/${club.id}`, { headers: { Authorization: `Bearer ${token}` } })
    ])
    if (tablesRes.ok) setTables(await tablesRes.json())
    if (bookingsRes.ok) setBookings(await bookingsRes.json())
  }

  const onBookingCreated = async () => {
    if (!selectedClub) return
    const res = await fetch(`/api/booking/club/${selectedClub.id}`, { headers: { Authorization: `Bearer ${token}` } })
    if (res.ok) setBookings(await res.json())
    setSelectedTable(null)
  }

  const joinBooking = async (bookingId: number) => {
    const res = await fetch(`/api/booking/${bookingId}/join`, {
      method: 'POST', headers: { Authorization: `Bearer ${token}` }
    })
    if (res.ok) onBookingCreated()
    else { const t = await res.text(); alert(t || 'Could not join') }
  }

  const cardStyle: React.CSSProperties = { background: '#16213e', border: '1px solid #0f3460', borderRadius: 8, padding: 16, marginBottom: 16 }
  const btnStyle: React.CSSProperties = { background: '#533483', color: '#fff', border: 'none', padding: '8px 16px', borderRadius: 4, cursor: 'pointer', marginRight: 8 }

  return (
    <div style={{ padding: 40 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 32 }}>
        <h1 style={{ color: '#e94560', margin: 0 }}>🎲 ClubTableTracker</h1>
        {user ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <span style={{ color: '#aaa' }}>👤 {user.name}</span>
            <button style={{ ...btnStyle, background: '#555' }} onClick={logout}>Logout</button>
          </div>
        ) : (
          <GoogleLogin onSuccess={handleGoogleLogin} onError={() => console.log('Login Failed')} />
        )}
      </div>

      {!user && (
        <div style={cardStyle}>
          <h2>Welcome to ClubTableTracker</h2>
          <p style={{ color: '#aaa' }}>Track gaming tables at your local Warhammer and Games Workshop club. Sign in with Google to apply for club membership and book tables.</p>
        </div>
      )}

      <h2>Clubs</h2>
      {clubs.map(club => {
        const membership = memberships.find(m => m.club.id === club.id)
        return (
          <div key={club.id} style={{ ...cardStyle, cursor: membership?.status === 'Approved' ? 'pointer' : 'default' }}
            onClick={() => membership?.status === 'Approved' && selectClub(club)}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h3 style={{ margin: '0 0 4px' }}>{club.name}</h3>
                <p style={{ color: '#aaa', margin: 0 }}>{club.description}</p>
              </div>
              {user && !membership && <button style={btnStyle} onClick={e => { e.stopPropagation(); applyToClub(club.id) }}>Apply</button>}
              {membership && <span style={{ color: membership.status === 'Approved' ? '#4caf50' : membership.status === 'Rejected' ? '#e94560' : '#ffc107', fontSize: 14 }}>{membership.status}{membership.status === 'Approved' ? ' — Click to view' : ''}</span>}
            </div>
          </div>
        )
      })}

      {selectedClub && (
        <div style={{ marginTop: 32 }}>
          <h2>📍 {selectedClub.name}</h2>
          <div style={{ marginBottom: 16 }}>
            <button style={{ ...btnStyle, background: view === 'map' ? '#e94560' : '#533483' }} onClick={() => setView('map')}>Floor Plan</button>
            <button style={{ ...btnStyle, background: view === 'schedule' ? '#e94560' : '#533483' }} onClick={() => setView('schedule')}>Schedule</button>
          </div>
          {view === 'map' && (
            <>
              <ClubMap tables={tables} bookings={bookings} onTableClick={setSelectedTable} selectedTableId={selectedTable?.id} />
              {selectedTable && (
                <div style={{ ...cardStyle, border: '1px solid #e94560', marginTop: 16 }}>
                  <h3>Table #{selectedTable.number} — {selectedTable.size}</h3>
                  <p style={{ color: '#aaa' }}>Games: {selectedTable.supportedGames.replace(/,/g, ', ')}</p>
                  <BookingForm table={selectedTable} token={token} onBooked={onBookingCreated} />
                  <h4 style={{ marginTop: 16 }}>Current Bookings for this table:</h4>
                  {bookings.filter(b => b.tableId === selectedTable.id).length === 0
                    ? <p style={{ color: '#aaa' }}>No bookings yet.</p>
                    : bookings.filter(b => b.tableId === selectedTable.id).map(b => (
                      <div key={b.id} style={{ ...cardStyle, display: 'flex', justifyContent: 'space-between' }}>
                        <div>
                          <strong>{b.user.name}</strong>{b.participants.length > 0 && ` + ${b.participants.map(p => p.name).join(', ')}`}
                          <div style={{ color: '#aaa', fontSize: 13 }}>{new Date(b.startTime).toLocaleString()} — {new Date(b.endTime).toLocaleString()}</div>
                        </div>
                        {user && b.user.id !== user.id && b.participants.length < 1 && (
                          <button style={{ ...btnStyle, background: '#4caf50' }} onClick={() => joinBooking(b.id)}>Join</button>
                        )}
                      </div>
                    ))
                  }
                </div>
              )}
            </>
          )}
          {view === 'schedule' && <Schedule bookings={bookings} tables={tables} />}
        </div>
      )}
    </div>
  )
}
