import { useState, useEffect } from 'react'
import { GoogleLogin } from '@react-oauth/google'
import BookingForm from '../components/BookingForm'
import TableTimeline from '../components/TableTimeline'
import BookingCalendar from '../components/BookingCalendar'
import { isGoogleConfigured } from '../googleConfig'
import { LAST_PR_NUMBER, LAST_PR_DATE } from '../version'

function useIsMobile(breakpoint = 768): boolean {
  const [isMobile, setIsMobile] = useState(() => window.innerWidth <= breakpoint)
  useEffect(() => {
    const handler = () => setIsMobile(window.innerWidth <= breakpoint)
    window.addEventListener('resize', handler)
    return () => window.removeEventListener('resize', handler)
  }, [breakpoint])
  return isMobile
}


interface User { id: string; email: string; name: string }
interface Club { id: number; name: string; description: string; openTime: string; closeTime: string }
interface Membership { id: number; status: string; club: Club }
interface GameTable { id: number; number: string; size: string; supportedGames: string; x: number; y: number; width: number; height: number }
interface Booking { id: number; tableId: number; startTime: string; endTime: string; gameSystem?: string; user: { id: string; name: string }; participants: { id: string; name: string }[] }

function parseHHMM(t: string): number {
  const [h, m] = t.split(':').map(Number)
  return h * 60 + (m || 0)
}

function toDatetimeLocal(date: Date, totalMinutes: number): string {
  const d = new Date(date)
  d.setHours(Math.floor(totalMinutes / 60), totalMinutes % 60, 0, 0)
  const year = d.getFullYear()
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  const hours = String(d.getHours()).padStart(2, '0')
  const mins = String(d.getMinutes()).padStart(2, '0')
  return `${year}-${month}-${day}T${hours}:${mins}`
}

function formatDate(date: Date): string {
  return date.toLocaleDateString('ru-RU', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })
}

const MAX_BOOKING_PLAYERS = 2

export default function HomePage() {
  const isMobile = useIsMobile()
  const [user, setUser] = useState<User | null>(null)
  const [token, setToken] = useState(localStorage.getItem('token') || '')
  const [clubs, setClubs] = useState<Club[]>([])
  const [memberships, setMemberships] = useState<Membership[]>([])
  const [selectedClub, setSelectedClub] = useState<Club | null>(null)
  const [tables, setTables] = useState<GameTable[]>([])
  const [bookings, setBookings] = useState<Booking[]>([])
  const [selectedTable, setSelectedTable] = useState<GameTable | null>(null)
  const [bookingStart, setBookingStart] = useState('')
  const [bookingEnd, setBookingEnd] = useState('')
  const [selectedDate, setSelectedDate] = useState<Date>(() => {
    const d = new Date()
    d.setHours(0, 0, 0, 0)
    return d
  })

  useEffect(() => {
    fetch('/api/club').then(r => r.json()).then(setClubs).catch(err => console.error('Failed to load clubs:', err))
    if (token) {
      const base64 = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')
      const jsonPayload = decodeURIComponent(
        atob(base64).split('').map(c => '%' + c.charCodeAt(0).toString(16).padStart(2, '0')).join('')
      )
      const payload = JSON.parse(jsonPayload)
      setUser({
        id: payload['http://schemas.xmlsoap.org/ws/2005/05/identity/claims/nameidentifier'],
        email: payload['http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress'],
        name: payload['http://schemas.xmlsoap.org/ws/2005/05/identity/claims/name']
      })
      fetch('/api/club/my-memberships', { headers: { Authorization: `Bearer ${token}` } })
        .then(r => r.json()).then(setMemberships).catch(err => console.error('Failed to load memberships:', err))
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

  const leaveBooking = async (booking: Booking) => {
    if (!confirm(`Выйти из игры ${booking.user.name}?`)) return
    const res = await fetch(`/api/booking/${booking.id}/leave`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` }
    })
    if (res.ok) {
      onBookingCreated()
    } else {
      const text = await res.text()
      alert(text || 'Не удалось выйти из игры')
    }
  }

  const joinBooking = async (booking: Booking) => {
    if (!user) return
    if (booking.user.id === user.id) return
    if (booking.participants.some(p => p.id === user.id)) {
      await leaveBooking(booking)
      return
    }
    if (booking.participants.length >= MAX_BOOKING_PLAYERS - 1) return
    if (!confirm(`Присоединиться к игре ${booking.user.name}?`)) return
    const res = await fetch(`/api/booking/${booking.id}/join`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` }
    })
    if (res.ok) {
      onBookingCreated()
    } else {
      const text = await res.text()
      alert(text || 'Не удалось присоединиться')
    }
  }

  const handleSlotClick = (table: GameTable, startMin: number, endMin: number) => {
    setSelectedTable(table)
    setBookingStart(toDatetimeLocal(selectedDate, startMin))
    setBookingEnd(toDatetimeLocal(selectedDate, endMin))
  }

  const handleTableHeaderClick = (table: GameTable) => {
    setSelectedTable(table)
    setBookingStart('')
    setBookingEnd('')
  }

  const [expandedTableId, setExpandedTableId] = useState<number | null>(null)
  const cardStyle: React.CSSProperties = { background: '#16213e', border: '1px solid #0f3460', borderRadius: 8, padding: 16, marginBottom: 16 }
  const btnStyle: React.CSSProperties = { background: '#533483', color: '#fff', border: 'none', padding: '8px 16px', borderRadius: 4, cursor: 'pointer', marginRight: 8 }
  const warnStyle: React.CSSProperties = { color: '#ffc107', fontSize: 14 }

  const openMin = selectedClub ? parseHHMM(selectedClub.openTime) : 600
  const closeMin = selectedClub ? parseHHMM(selectedClub.closeTime) : 1320
  const totalHours = Math.ceil((closeMin - openMin) / 60)
  const openHour = Math.floor(openMin / 60)
  const RECT_HEIGHT = 360

  return (
    <div style={{ padding: isMobile ? 16 : 40 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 32, flexWrap: 'wrap', gap: 12 }}>
        <div style={{ minWidth: 0 }}>
          <h1 style={{ color: '#e94560', margin: 0, fontSize: isMobile ? 22 : 32, whiteSpace: 'nowrap' }}>🎲 ClubTableTracker</h1>
          <div style={{ color: '#666', fontSize: 12, marginTop: 2 }}>Beta v0.0.{LAST_PR_NUMBER} от {LAST_PR_DATE}</div>
        </div>
        {user ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: isMobile ? 8 : 16, flexWrap: 'wrap' }}>
            <span style={{ color: '#aaa', fontSize: isMobile ? 13 : 14 }}>👤 {user.name}</span>
            <button style={{ ...btnStyle, background: '#555' }} onClick={logout}>Выйти</button>
          </div>
        ) : (
          isGoogleConfigured
            ? <GoogleLogin onSuccess={handleGoogleLogin} onError={() => console.log('Login Failed')} />
            : <span style={{ ...warnStyle, fontSize: isMobile ? 12 : 14 }}>⚠️ Google login is not configured. Set <code>VITE_GOOGLE_CLIENT_ID</code> in your <code>.env</code> file.</span>
        )}
      </div>

      {!user && (
        <div style={cardStyle}>
          <h2>Welcome to ClubTableTracker</h2>
          <p style={{ color: '#aaa' }}>Track gaming tables at your local Warhammer and Games Workshop club. Sign in with Google to apply for club membership and book tables.</p>
        </div>
      )}

      <h2>Клубы</h2>
      {clubs.map(club => {
        const membership = memberships.find(m => m.club.id === club.id)
        const isApproved = membership?.status === 'Approved'
        const isPending = membership?.status === 'Pending'
        const isRejected = membership?.status === 'Rejected'
        const borderColor = selectedClub?.id === club.id
          ? '#e94560'
          : isApproved
            ? '#4caf50'
            : isPending
              ? '#ffc107'
              : isRejected
                ? '#e94560'
                : '#0f3460'
        return (
          <div key={club.id}
            style={{ ...cardStyle, cursor: isApproved ? 'pointer' : 'default', border: `2px solid ${borderColor}` }}
            onClick={() => isApproved && selectClub(club)}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ fontWeight: 'bold', fontSize: 16, marginBottom: 4, color: '#eee' }}>{club.name}</div>
                <div style={{ color: '#aaa', fontSize: 14 }}>{club.description}</div>
              </div>
              <div style={{ flexShrink: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
                {user && !membership && <button style={btnStyle} onClick={e => { e.stopPropagation(); applyToClub(club.id) }}>Подать заявку</button>}
                {isApproved && <span style={{ fontSize: 22 }} title="Одобрено">✅</span>}
                {isPending && <span style={{ fontSize: 22 }} title="На рассмотрении">⏳</span>}
                {isRejected && <span style={{ fontSize: 22 }} title="Отклонено">❌</span>}
              </div>
            </div>
          </div>
        )
      })}

      {selectedClub && (
        <div style={{ marginTop: 32 }}>
          <h2>📍 {selectedClub.name}</h2>

          {isMobile ? (
            /* ===== MOBILE LAYOUT ===== */
            <div>
              {/* Calendar with booking highlights */}
              <div style={{ marginBottom: 16 }}>
                <BookingCalendar
                  bookings={bookings}
                  selectedDate={selectedDate}
                  onSelectDate={date => { setSelectedDate(date); setSelectedTable(null) }}
                />
              </div>

              {/* Legend */}
              <div style={{ display: 'flex', gap: 16, marginBottom: 12, fontSize: 13, flexWrap: 'wrap' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ width: 20, height: 14, background: '#90ee90', display: 'inline-block', borderRadius: 2, border: '1px solid #555' }} />
                  Свободно
                </span>
                <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ width: 20, height: 14, background: '#ffff00', display: 'inline-block', borderRadius: 2, border: '1px solid #555' }} />
                  Занято
                </span>
                {user && <span style={{ color: '#aaa' }}>Нажмите на свободный слот для бронирования</span>}
              </div>

              {/* Accordion tables */}
              {tables.length === 0 && (
                <p style={{ color: '#aaa' }}>Столы не настроены администратором клуба.</p>
              )}
              {tables.map(table => {
                const isExpanded = expandedTableId === table.id
                const isSelected = selectedTable?.id === table.id
                return (
                  <div key={table.id} style={{ ...cardStyle, padding: 0, overflow: 'hidden' }}>
                    {/* Accordion header */}
                    <button
                      onClick={() => {
                        const expanding = !isExpanded
                        setExpandedTableId(expanding ? table.id : null)
                        if (expanding) handleTableHeaderClick(table)
                      }}
                      style={{
                        width: '100%', background: isExpanded ? '#1a2a50' : '#16213e',
                        border: 'none', borderBottom: isExpanded ? '1px solid #0f3460' : 'none',
                        color: isSelected ? '#e94560' : '#eee',
                        padding: '12px 16px', textAlign: 'left', cursor: 'pointer',
                        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                        fontSize: 15, fontWeight: 'bold'
                      }}>
                      <span>Стол {table.number}</span>
                      <span style={{ fontSize: 12, color: '#aaa', fontWeight: 'normal' }}>
                        {table.size}
                      </span>
                      <span style={{ fontSize: 18, color: '#888', marginLeft: 8 }}>{isExpanded ? '▲' : '▼'}</span>
                    </button>

                    {/* Accordion body */}
                    {isExpanded && (
                      <div style={{ padding: 16 }}>
                        <div style={{ display: 'flex', alignItems: 'flex-start' }}>
                          {/* Time scale */}
                          <div style={{ width: 44, flexShrink: 0, position: 'relative', height: RECT_HEIGHT + 28, marginRight: 4 }}>
                            {Array.from({ length: totalHours + 1 }, (_, i) => {
                              const hour = openHour + i
                              const top = (i / totalHours) * RECT_HEIGHT + 28 - 8
                              return (
                                <div key={hour} style={{ position: 'absolute', top, right: 0, fontSize: 11, color: '#888', whiteSpace: 'nowrap' }}>
                                  {String(hour).padStart(2, '0')}:00
                                </div>
                              )
                            })}
                          </div>
                          <TableTimeline
                            table={table}
                            bookings={bookings}
                            openTime={selectedClub.openTime}
                            closeTime={selectedClub.closeTime}
                            selectedDate={selectedDate}
                            currentUserId={user?.id}
                            onSlotClick={user ? handleSlotClick : undefined}
                            onBookingClick={user ? joinBooking : undefined}
                            isSelected={isSelected}
                          />
                        </div>

                        {/* Booking form inside accordion */}
                        {isSelected && user && (
                          <div style={{ ...cardStyle, border: '1px solid #e94560', marginTop: 16 }}>
                            <BookingForm
                              key={`${table.id}-${bookingStart}-${bookingEnd}`}
                              table={table}
                              token={token}
                              onBooked={onBookingCreated}
                              onCancel={() => setSelectedTable(null)}
                              selectedDate={selectedDate}
                              initialStartTime={bookingStart}
                              initialEndTime={bookingEnd}
                              openTime={selectedClub.openTime}
                              closeTime={selectedClub.closeTime}
                            />
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          ) : (
            /* ===== DESKTOP LAYOUT ===== */
            <div style={{ display: 'flex', gap: 24, alignItems: 'flex-start' }}>
              {/* Left: time scale + table timelines */}
              <div style={{ flex: 1, overflowX: 'auto' }}>
                {/* Selected date label */}
                <div style={{ marginBottom: 12, color: '#ffc107', fontSize: 15, fontWeight: 'bold', textTransform: 'capitalize' }}>
                  {formatDate(selectedDate)}
                </div>
                <div style={{ display: 'flex', alignItems: 'flex-start' }}>
                  {/* Time scale */}
                  <div style={{ width: 44, flexShrink: 0, position: 'relative', height: RECT_HEIGHT + 28, marginRight: 4 }}>
                    {Array.from({ length: totalHours + 1 }, (_, i) => {
                      const hour = openHour + i
                      const top = (i / totalHours) * RECT_HEIGHT + 28 - 8
                      return (
                        <div key={hour} style={{ position: 'absolute', top, right: 0, fontSize: 11, color: '#888', whiteSpace: 'nowrap' }}>
                          {String(hour).padStart(2, '0')}:00
                        </div>
                      )
                    })}
                  </div>
                  {/* Tables */}
                  <div style={{ display: 'flex', alignItems: 'flex-start', whiteSpace: 'nowrap' }}>
                    {tables.map(table => (
                      <div key={table.id} onClick={() => handleTableHeaderClick(table)} style={{ cursor: 'pointer' }}>
                        <TableTimeline
                          table={table}
                          bookings={bookings}
                          openTime={selectedClub.openTime}
                          closeTime={selectedClub.closeTime}
                          selectedDate={selectedDate}
                          currentUserId={user?.id}
                          onSlotClick={user ? handleSlotClick : undefined}
                          onBookingClick={user ? joinBooking : undefined}
                          isSelected={selectedTable?.id === table.id}
                        />
                      </div>
                    ))}
                    {tables.length === 0 && (
                      <p style={{ color: '#aaa', marginLeft: 8 }}>Столы не настроены администратором клуба.</p>
                    )}
                  </div>
                </div>

                {/* Legend */}
                <div style={{ display: 'flex', gap: 16, marginTop: 12, fontSize: 13 }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ width: 20, height: 14, background: '#90ee90', display: 'inline-block', borderRadius: 2, border: '1px solid #555' }} />
                    Свободно
                  </span>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ width: 20, height: 14, background: '#ffff00', display: 'inline-block', borderRadius: 2, border: '1px solid #555' }} />
                    Занято
                  </span>
                  {user && <span style={{ color: '#aaa' }}>Нажмите на свободный слот для бронирования</span>}
                </div>

                {/* Booking form */}
                {selectedTable && user && (
                  <div style={{ ...cardStyle, border: '1px solid #e94560', marginTop: 20, whiteSpace: 'normal' }}>
                    <BookingForm
                      key={`${selectedTable.id}-${bookingStart}-${bookingEnd}`}
                      table={selectedTable}
                      token={token}
                      onBooked={onBookingCreated}
                      onCancel={() => setSelectedTable(null)}
                      selectedDate={selectedDate}
                      initialStartTime={bookingStart}
                      initialEndTime={bookingEnd}
                      openTime={selectedClub.openTime}
                      closeTime={selectedClub.closeTime}
                    />
                  </div>
                )}
              </div>

              {/* Right: calendar */}
              <div style={{ width: 220, flexShrink: 0 }}>
                <BookingCalendar
                  bookings={bookings}
                  selectedDate={selectedDate}
                  onSelectDate={date => { setSelectedDate(date); setSelectedTable(null) }}
                />
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
