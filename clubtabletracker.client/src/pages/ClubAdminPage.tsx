import { useState, useEffect } from 'react'
import ClubMapEditor from '../components/ClubMapEditor'
import { GAME_SYSTEMS_MAIN, GAME_SYSTEMS_BOTTOM } from '../constants'

interface ClubInfo { id: number; name: string; description: string; openTime: string; closeTime: string }
interface Membership { id: number; status: string; appliedAt: string; user: { id: string; name: string; email: string } }
interface GameTable { id: number; clubId: number; number: string; size: string; supportedGames: string; x: number; y: number; width: number; height: number; eventsOnly: boolean }
interface ClubEventData { id: number; title: string; date: string; maxParticipants: number; eventType: string; gameSystem?: string; tableIds?: string; participants: { id: string; name: string }[] }

export default function ClubAdminPage() {
  const [clubKey, setClubKey] = useState(localStorage.getItem('clubKey') || '')
  const [club, setClub] = useState<ClubInfo | null>(null)
  const [tables, setTables] = useState<GameTable[]>([])
  const [memberships, setMemberships] = useState<Membership[]>([])
  const [error, setError] = useState('')
  const [tab, setTab] = useState<'map' | 'members' | 'settings' | 'events'>('map')
  const [editingTable, setEditingTable] = useState<Partial<GameTable> | null>(null)
  const [selectedGames, setSelectedGames] = useState<string[]>([])
  const [openTime, setOpenTime] = useState('10:00')
  const [closeTime, setCloseTime] = useState('22:00')
  const [settingsSaved, setSettingsSaved] = useState(false)
  const [events, setEvents] = useState<ClubEventData[]>([])
  const [newEvent, setNewEvent] = useState({ title: '', date: '', maxParticipants: 8, eventType: 'Tournament', gameSystem: '', tableIds: '' })
  const [selectedEventTables, setSelectedEventTables] = useState<number[]>([])
  const [showEventForm, setShowEventForm] = useState(false)
  const [editingEventId, setEditingEventId] = useState<number | null>(null)
  const [editingEventDate, setEditingEventDate] = useState('')
  const [editingEventDateError, setEditingEventDateError] = useState('')
  const [inviteEventId, setInviteEventId] = useState<number | null>(null)
  const [inviteUserId, setInviteUserId] = useState('')

  const login = async () => {
    localStorage.setItem('clubKey', clubKey)
    const res = await fetch('/api/clubadmin/me', { headers: { 'X-Club-Key': clubKey } })
    if (res.ok) {
      const data = await res.json()
      setClub(data)
      setOpenTime(data.openTime || '10:00')
      setCloseTime(data.closeTime || '22:00')
      setError('')
      loadData(clubKey)
    } else {
      setError('Invalid club key')
    }
  }

  const loadData = async (key: string) => {
    const [tablesRes, membRes, eventsRes] = await Promise.all([
      fetch('/api/clubadmin/tables', { headers: { 'X-Club-Key': key } }),
      fetch('/api/clubadmin/memberships', { headers: { 'X-Club-Key': key } }),
      fetch('/api/clubadmin/events', { headers: { 'X-Club-Key': key } })
    ])
    if (tablesRes.ok) setTables(await tablesRes.json())
    if (membRes.ok) setMemberships(await membRes.json())
    if (eventsRes.ok) setEvents(await eventsRes.json())
  }

  useEffect(() => {
    if (clubKey) login()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const saveTable = async () => {
    if (!editingTable) return
    const body = {
      number: editingTable.number || '',
      size: editingTable.size || 'Medium',
      supportedGames: selectedGames.join('|'),
      x: editingTable.x || 0,
      y: editingTable.y || 0,
      width: editingTable.width || 100,
      height: editingTable.height || 60,
      eventsOnly: editingTable.eventsOnly || false
    }
    if (editingTable.id) {
      const res = await fetch(`/api/clubadmin/tables/${editingTable.id}`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json', 'X-Club-Key': clubKey },
        body: JSON.stringify(body)
      })
      if (res.ok) { const t = await res.json(); setTables(tables.map(x => x.id === t.id ? t : x)) }
    } else {
      const res = await fetch('/api/clubadmin/tables', {
        method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Club-Key': clubKey },
        body: JSON.stringify(body)
      })
      if (res.ok) { setTables([...tables, await res.json()]) }
    }
    setEditingTable(null)
    setSelectedGames([])
  }

  const deleteTable = async (id: number) => {
    await fetch(`/api/clubadmin/tables/${id}`, { method: 'DELETE', headers: { 'X-Club-Key': clubKey } })
    setTables(tables.filter(t => t.id !== id))
  }

  const copyTable = async (id: number) => {
    const res = await fetch(`/api/clubadmin/tables/${id}/copy`, { method: 'POST', headers: { 'X-Club-Key': clubKey } })
    if (res.ok) { setTables([...tables, await res.json()]) }
  }

  const updateMembership = async (id: number, action: 'approve' | 'reject') => {
    const res = await fetch(`/api/clubadmin/memberships/${id}/${action}`, {
      method: 'POST', headers: { 'X-Club-Key': clubKey }
    })
    if (res.ok) setMemberships(memberships.map(m => m.id === id ? { ...m, status: action === 'approve' ? 'Approved' : 'Rejected' } : m))
  }

  const kickMember = async (id: number) => {
    const res = await fetch(`/api/clubadmin/memberships/${id}/kick`, {
      method: 'POST', headers: { 'X-Club-Key': clubKey }
    })
    if (res.ok) setMemberships(memberships.map(m => m.id === id ? { ...m, status: 'Kicked' } : m))
  }

  const saveSettings = async () => {
    const res = await fetch('/api/clubadmin/settings', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', 'X-Club-Key': clubKey },
      body: JSON.stringify({ openTime, closeTime })
    })
    if (res.ok) {
      const data = await res.json()
      setClub(prev => prev ? { ...prev, openTime: data.openTime, closeTime: data.closeTime } : prev)
      setSettingsSaved(true)
      setTimeout(() => setSettingsSaved(false), 2000)
    }
  }

  const createEvent = async () => {
    const body = {
      title: newEvent.title,
      date: new Date(newEvent.date).toISOString(),
      maxParticipants: newEvent.maxParticipants,
      eventType: newEvent.eventType,
      gameSystem: newEvent.gameSystem || null,
      tableIds: selectedEventTables.length > 0 ? selectedEventTables.join(',') : null
    }
    const res = await fetch('/api/clubadmin/events', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Club-Key': clubKey },
      body: JSON.stringify(body)
    })
    if (res.ok) {
      const ev = await res.json()
      setEvents([...events, { ...ev, participants: [] }])
      setNewEvent({ title: '', date: '', maxParticipants: 8, eventType: 'Tournament', gameSystem: '', tableIds: '' })
      setSelectedEventTables([])
      setShowEventForm(false)
    }
  }

  const deleteEvent = async (id: number) => {
    if (!confirm('Удалить событие?')) return
    const res = await fetch(`/api/clubadmin/events/${id}`, { method: 'DELETE', headers: { 'X-Club-Key': clubKey } })
    if (res.ok) setEvents(events.filter(e => e.id !== id))
  }

  const startEditingEventDate = (ev: ClubEventData) => {
    // Convert stored ISO date to local datetime-local string without seconds
    const d = new Date(ev.date)
    const pad = (n: number) => String(n).padStart(2, '0')
    const local = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:00`
    setEditingEventId(ev.id)
    setEditingEventDate(local)
    setEditingEventDateError('')
  }

  const saveEventDate = async (id: number) => {
    if (!editingEventDate) return
    const isoDate = new Date(editingEventDate).toISOString()
    const res = await fetch(`/api/clubadmin/events/${id}/date`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', 'X-Club-Key': clubKey },
      body: JSON.stringify({ date: isoDate })
    })
    if (res.ok) {
      const data = await res.json()
      setEvents(events.map(e => e.id === id ? { ...e, date: data.date } : e))
      setEditingEventId(null)
      setEditingEventDateError('')
    } else {
      const text = await res.text()
      setEditingEventDateError(text || 'Ошибка сохранения')
    }
  }

  const inviteParticipant = async (eventId: number) => {
    if (!inviteUserId) return
    const res = await fetch(`/api/clubadmin/events/${eventId}/participants/${encodeURIComponent(inviteUserId)}`, {
      method: 'POST', headers: { 'X-Club-Key': clubKey }
    })
    if (res.ok) {
      const participant = await res.json()
      setEvents(events.map(e => e.id === eventId ? { ...e, participants: [...e.participants, participant] } : e))
      setInviteUserId('')
      setInviteEventId(null)
    } else {
      const text = await res.text()
      alert(text || 'Ошибка при приглашении')
    }
  }

  const removeParticipant = async (eventId: number, userId: string) => {
    const res = await fetch(`/api/clubadmin/events/${eventId}/participants/${encodeURIComponent(userId)}`, {
      method: 'DELETE', headers: { 'X-Club-Key': clubKey }
    })
    if (res.ok) {
      setEvents(events.map(e => e.id === eventId ? { ...e, participants: e.participants.filter(p => p.id !== userId) } : e))
    }
  }

  const updateTablePosition = async (id: number, x: number, y: number) => {
    const table = tables.find(t => t.id === id)
    if (!table) return
    const res = await fetch(`/api/clubadmin/tables/${id}`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json', 'X-Club-Key': clubKey },
      body: JSON.stringify({ ...table, x, y, eventsOnly: table.eventsOnly })
    })
    if (res.ok) { const t = await res.json(); setTables(tables.map(x => x.id === t.id ? t : x)) }
  }

  const membershipStatusColor = (status: string) => {
    if (status === 'Approved') return '#4caf50'
    if (status === 'Rejected') return '#e94560'
    if (status === 'Kicked') return '#ff5722'
    return '#ffc107'
  }
  const membershipStatusLabel = (status: string) => status === 'Kicked' ? 'Исключён' : status

  const cardStyle: React.CSSProperties = { background: '#16213e', border: '1px solid #0f3460', borderRadius: 8, padding: 16, marginBottom: 16 }
  const inputStyle: React.CSSProperties = { background: '#0f3460', border: '1px solid #533483', color: '#eee', padding: '8px 12px', borderRadius: 4, marginRight: 8, marginBottom: 8 }
  const btnStyle: React.CSSProperties = { background: '#533483', color: '#fff', border: 'none', padding: '8px 16px', borderRadius: 4, cursor: 'pointer', marginRight: 8 }

  if (!club) {
    return (
      <div style={{ padding: 40 }}>
        <h1 style={{ color: '#e94560' }}>🎲 Club Admin</h1>
        <div style={cardStyle}>
          <h2>Club Key Login</h2>
          <input style={inputStyle} type="password" placeholder="Club Access Key"
            value={clubKey} onChange={e => setClubKey(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && login()} />
          <button style={btnStyle} onClick={login}>Login</button>
          {error && <p style={{ color: '#e94560' }}>{error}</p>}
        </div>
      </div>
    )
  }

  return (
    <div style={{ padding: 40 }}>
      <h1 style={{ color: '#e94560' }}>🎲 {club.name} — Club Admin</h1>
      <div style={{ marginBottom: 16 }}>
        <button style={{ ...btnStyle, background: tab === 'map' ? '#e94560' : '#533483' }} onClick={() => setTab('map')}>Map Editor</button>
        <button style={{ ...btnStyle, background: tab === 'members' ? '#e94560' : '#533483' }} onClick={() => setTab('members')}>Members ({memberships.filter(m => m.status === 'Pending').length} pending)</button>
        <button style={{ ...btnStyle, background: tab === 'events' ? '#e94560' : '#533483' }} onClick={() => setTab('events')}>События ({events.length})</button>
        <button style={{ ...btnStyle, background: tab === 'settings' ? '#e94560' : '#533483' }} onClick={() => setTab('settings')}>Настройки</button>
      </div>

      {tab === 'map' && (
        <>
          <ClubMapEditor tables={tables} onPositionChange={updateTablePosition} onTableClick={t => { setEditingTable(t); setSelectedGames(t.supportedGames ? t.supportedGames.split('|').filter(Boolean) : []) }} />
          <div style={{ ...cardStyle, marginTop: 16 }}>
            <h3>Add New Table</h3>
            <button style={btnStyle} onClick={() => { setEditingTable({ number: '', size: 'Medium', x: 50, y: 50, width: 100, height: 60, eventsOnly: false }); setSelectedGames([]) }}>+ Add Table</button>
          </div>
          {editingTable && (
            <div style={{ ...cardStyle, border: '1px solid #e94560' }}>
              <h3>{editingTable.id ? 'Edit Table' : 'New Table'}</h3>
              <div>
                <input style={inputStyle} placeholder="Table Number" value={editingTable.number || ''} onChange={e => setEditingTable({ ...editingTable, number: e.target.value })} />
                <select style={inputStyle} value={editingTable.size || 'Medium'} onChange={e => setEditingTable({ ...editingTable, size: e.target.value })}>
                  <option value="Small">Small</option>
                  <option value="Medium">Medium</option>
                  <option value="Large">Large</option>
                </select>
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: 8, color: '#aaa' }}>Supported Games:</label>
                {[...GAME_SYSTEMS_MAIN, ...GAME_SYSTEMS_BOTTOM].map(game => (
                  <label key={game} style={{ display: 'inline-block', margin: '4px 8px', cursor: 'pointer' }}>
                    <input type="checkbox" checked={selectedGames.includes(game)}
                      onChange={e => setSelectedGames(e.target.checked ? [...selectedGames, game] : selectedGames.filter(g => g !== game))} />
                    {' '}{game}
                  </label>
                ))}
              </div>
              <div style={{ marginTop: 16 }}>
                <label style={{ cursor: 'pointer', color: '#eee' }}>
                  <input type="checkbox" checked={editingTable.eventsOnly || false}
                    onChange={e => setEditingTable({ ...editingTable, eventsOnly: e.target.checked })} />
                  {' '}Только для событий
                </label>
              </div>
              <div style={{ marginTop: 16 }}>
                <button style={btnStyle} onClick={saveTable}>Save</button>
                <button style={{ ...btnStyle, background: '#555' }} onClick={() => setEditingTable(null)}>Cancel</button>
                {editingTable.id && <button style={{ ...btnStyle, background: '#e94560' }} onClick={() => { deleteTable(editingTable.id!); setEditingTable(null) }}>Delete</button>}
              </div>
            </div>
          )}
          <h3 style={{ marginTop: 24 }}>Tables</h3>
          {tables.map(t => (
            <div key={t.id} style={{ ...cardStyle, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <strong>Table #{t.number}</strong> — {t.size}
                <div style={{ color: '#aaa', fontSize: 13 }}>{t.supportedGames ? t.supportedGames.split('|').filter(Boolean).join(', ') : ''}</div>
              </div>
              <div>
                <button style={btnStyle} onClick={() => { setEditingTable(t); setSelectedGames(t.supportedGames.split('|').filter(Boolean)) }}>Edit</button>
                <button style={{ ...btnStyle, background: '#1a6e3c' }} onClick={() => copyTable(t.id)}>Copy</button>
              </div>
            </div>
          ))}
        </>
      )}

      {tab === 'members' && (
        <>
          <h3>Membership Applications</h3>
          {memberships.length === 0 && <p style={{ color: '#aaa' }}>No applications yet.</p>}
          {memberships.map(m => (
            <div key={m.id} style={{ ...cardStyle, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <strong>{m.user.name}</strong> ({m.user.email})
                <div style={{ color: '#aaa', fontSize: 13 }}>Applied: {new Date(m.appliedAt).toLocaleDateString()}</div>
                <div style={{ color: membershipStatusColor(m.status) }}>{membershipStatusLabel(m.status)}</div>
              </div>
              {m.status === 'Pending' && (
                <div>
                  <button style={{ ...btnStyle, background: '#4caf50' }} onClick={() => updateMembership(m.id, 'approve')}>Approve</button>
                  <button style={{ ...btnStyle, background: '#e94560' }} onClick={() => updateMembership(m.id, 'reject')}>Reject</button>
                </div>
              )}
              {m.status === 'Approved' && (
                <div>
                  <button style={{ ...btnStyle, background: '#ff5722' }} onClick={() => kickMember(m.id)}>Исключить</button>
                </div>
              )}
            </div>
          ))}
        </>
      )}

      {tab === 'settings' && (
        <div style={cardStyle}>
          <h3>Часы работы клуба</h3>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
            <div>
              <label style={{ color: '#aaa', fontSize: 13, display: 'block', marginBottom: 4 }}>Открытие</label>
              <input style={inputStyle} type="time" value={openTime} onChange={e => setOpenTime(e.target.value)} />
            </div>
            <div>
              <label style={{ color: '#aaa', fontSize: 13, display: 'block', marginBottom: 4 }}>Закрытие</label>
              <input style={inputStyle} type="time" value={closeTime} onChange={e => setCloseTime(e.target.value)} />
            </div>
            <button style={{ ...btnStyle, marginTop: 18 }} onClick={saveSettings}>Сохранить</button>
            {settingsSaved && <span style={{ color: '#4caf50', marginTop: 18 }}>✓ Сохранено</span>}
          </div>
        </div>
      )}

      {tab === 'events' && (
        <>
          <div style={{ marginBottom: 16 }}>
            <button style={btnStyle} onClick={() => setShowEventForm(v => !v)}>
              {showEventForm ? '✕ Отмена' : '+ Создать событие'}
            </button>
          </div>

          {showEventForm && (
            <div style={{ ...cardStyle, border: '1px solid #e94560' }}>
              <h3>Новое событие</h3>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                <input style={inputStyle} placeholder="Название" value={newEvent.title}
                  onChange={e => setNewEvent({ ...newEvent, title: e.target.value })} />
                <input style={inputStyle} type="datetime-local" value={newEvent.date}
                  onChange={e => setNewEvent({ ...newEvent, date: e.target.value })} />
                <input style={{ ...inputStyle, width: 80 }} type="number" min={2} placeholder="Макс. участников"
                  value={newEvent.maxParticipants}
                  onChange={e => setNewEvent({ ...newEvent, maxParticipants: parseInt(e.target.value) || 2 })} />
                <select style={inputStyle} value={newEvent.eventType}
                  onChange={e => setNewEvent({ ...newEvent, eventType: e.target.value })}>
                  <option value="Tournament">Турнир</option>
                </select>
                <select style={inputStyle} value={newEvent.gameSystem}
                  onChange={e => setNewEvent({ ...newEvent, gameSystem: e.target.value })}>
                  <option value="">— Игровая система —</option>
                  {[...GAME_SYSTEMS_MAIN, ...GAME_SYSTEMS_BOTTOM].map(g => <option key={g} value={g}>{g}</option>)}
                </select>
              </div>
              <div style={{ marginTop: 10 }}>
                <label style={{ color: '#aaa', fontSize: 13, display: 'block', marginBottom: 6 }}>Столы события:</label>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  {tables.map(t => (
                    <label key={t.id} style={{ cursor: 'pointer', color: '#eee', fontSize: 13 }}>
                      <input type="checkbox" checked={selectedEventTables.includes(t.id)}
                        onChange={e => setSelectedEventTables(e.target.checked
                          ? [...selectedEventTables, t.id]
                          : selectedEventTables.filter(id => id !== t.id))} />
                      {' '}Стол {t.number}
                    </label>
                  ))}
                </div>
              </div>
              <div style={{ marginTop: 14 }}>
                <button style={btnStyle} onClick={createEvent} disabled={!newEvent.title || !newEvent.date}>Создать</button>
                <button style={{ ...btnStyle, background: '#555' }} onClick={() => setShowEventForm(false)}>Отмена</button>
              </div>
            </div>
          )}

          <h3>Список событий</h3>
          {events.length === 0 && <p style={{ color: '#aaa' }}>Событий пока нет.</p>}
          {events.map(ev => {
            const tableNumbers = ev.tableIds
              ? ev.tableIds.split(',').map(id => tables.find(t => t.id === parseInt(id))?.number).filter(Boolean).join(', ')
              : ''
            const approvedMembers = memberships.filter(m => m.status === 'Approved' && !ev.participants.some(p => p.id === m.user.id))
            return (
              <div key={ev.id} style={{ ...cardStyle, flexDirection: 'column', display: 'flex', gap: 8 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 8 }}>
                  <div>
                    <strong style={{ fontSize: 15, color: '#eee' }}>{ev.title}</strong>
                    <span style={{ marginLeft: 10, color: '#ffc107', fontSize: 13 }}>{ev.eventType}</span>
                    {ev.gameSystem && <span style={{ marginLeft: 8, color: '#888', fontSize: 13, fontStyle: 'italic' }}>{ev.gameSystem}</span>}
                    <div style={{ color: '#aaa', fontSize: 13, marginTop: 4 }}>
                      📅 {new Date(ev.date).toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                      &nbsp;·&nbsp;👥 {ev.participants.length}/{ev.maxParticipants}
                      {tableNumbers && <>&nbsp;·&nbsp;🎲 {tableNumbers}</>}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    <button style={{ ...btnStyle, background: '#1a6e3c' }} onClick={() => editingEventId === ev.id ? setEditingEventId(null) : startEditingEventDate(ev)}>
                      {editingEventId === ev.id ? '✕' : '📅 Дата'}
                    </button>
                    <button style={{ ...btnStyle, background: '#0f3460' }} onClick={() => { setInviteEventId(inviteEventId === ev.id ? null : ev.id); setInviteUserId('') }}>
                      {inviteEventId === ev.id ? '✕' : '+ Пригласить'}
                    </button>
                    <button style={{ ...btnStyle, background: '#e94560' }} onClick={() => deleteEvent(ev.id)}>Удалить</button>
                  </div>
                </div>

                {editingEventId === ev.id && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', paddingTop: 4 }}>
                    <input style={inputStyle} type="datetime-local" step={3600} value={editingEventDate}
                      onChange={e => { setEditingEventDate(e.target.value); setEditingEventDateError('') }} />
                    <button style={{ ...btnStyle, background: '#4caf50' }} onClick={() => saveEventDate(ev.id)}>Сохранить</button>
                    {editingEventDateError && <span style={{ color: '#e94560', fontSize: 13 }}>{editingEventDateError}</span>}
                  </div>
                )}

                {inviteEventId === ev.id && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', paddingTop: 4 }}>
                    <select style={inputStyle} value={inviteUserId} onChange={e => setInviteUserId(e.target.value)}>
                      <option value="">— Выберите игрока —</option>
                      {approvedMembers.map(m => (
                        <option key={m.user.id} value={m.user.id}>{m.user.name}</option>
                      ))}
                    </select>
                    <button style={{ ...btnStyle, background: '#4caf50' }} onClick={() => inviteParticipant(ev.id)} disabled={!inviteUserId}>Пригласить</button>
                    {approvedMembers.length === 0 && <span style={{ color: '#aaa', fontSize: 13 }}>Все одобренные участники уже в событии</span>}
                  </div>
                )}

                {ev.participants.length > 0 && (
                  <div style={{ fontSize: 12, color: '#aaa', marginTop: 2 }}>
                    Участники:{' '}
                    {ev.participants.map((p, i) => (
                      <span key={p.id}>
                        {i > 0 && ', '}
                        {p.name}
                        <button onClick={() => removeParticipant(ev.id, p.id)}
                          aria-label={`Удалить ${p.name} из события`}
                          style={{ background: 'none', border: 'none', color: '#e94560', cursor: 'pointer', marginLeft: 2, padding: '0 2px', fontSize: 11 }}
                          title="Удалить из события">×</button>
                      </span>
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </>
      )}
    </div>
  )
}
