import React, { useState, useEffect } from 'react'
import ClubMapEditor from '../components/ClubMapEditor'
import { GAME_SYSTEMS_MAIN, GAME_SYSTEMS_BOTTOM, ALL_GAME_SYSTEMS } from '../constants'

interface ClubInfo {
  id: number; name: string; description: string; openTime: string; closeTime: string;
  vkUrl?: string; telegramUrl?: string; instagramUrl?: string; whatsAppUrl?: string;
  youTubeUrl?: string; discordUrl?: string; websiteUrl?: string;
  contactEmail?: string; contactPhone?: string
}
interface Membership { id: number; status: string; isModerator: boolean; appliedAt: string; user: { id: string; name: string; email: string; enabledGameSystems?: string } }
interface GameTable { id: number; clubId: number; number: string; size: string; supportedGames: string; x: number; y: number; width: number; height: number; eventsOnly: boolean }
interface ClubEventData { id: number; title: string; startTime: string; endTime: string; maxParticipants: number; eventType: string; gameSystem?: string; tableIds?: string; participants: { id: string; name: string }[] }
interface ClubDecoration { id: number; type: 'wall' | 'window' | 'door'; x: number; y: number; width: number; height: number }

export default function ClubAdminPage() {
  const [clubKey, setClubKey] = useState(localStorage.getItem('clubKey') || '')
  const [club, setClub] = useState<ClubInfo | null>(null)
  const [tables, setTables] = useState<GameTable[]>([])
  const [decorations, setDecorations] = useState<ClubDecoration[]>([])
  const [memberships, setMemberships] = useState<Membership[]>([])
  const [error, setError] = useState('')
  const [tab, setTab] = useState<'map' | 'members' | 'settings' | 'events'>('map')
  const [editingTable, setEditingTable] = useState<Partial<GameTable> | null>(null)
  const [selectedGames, setSelectedGames] = useState<string[]>([])
  const [openTime, setOpenTime] = useState('10:00')
  const [closeTime, setCloseTime] = useState('22:00')
  const [vkUrl, setVkUrl] = useState('')
  const [telegramUrl, setTelegramUrl] = useState('')
  const [instagramUrl, setInstagramUrl] = useState('')
  const [whatsAppUrl, setWhatsAppUrl] = useState('')
  const [youTubeUrl, setYouTubeUrl] = useState('')
  const [discordUrl, setDiscordUrl] = useState('')
  const [websiteUrl, setWebsiteUrl] = useState('')
  const [contactEmail, setContactEmail] = useState('')
  const [contactPhone, setContactPhone] = useState('')
  const [settingsSaved, setSettingsSaved] = useState(false)
  const [events, setEvents] = useState<ClubEventData[]>([])
  const [newEvent, setNewEvent] = useState({ title: '', startTime: '', endTime: '', maxParticipants: 8, eventType: 'Tournament', gameSystem: '', tableIds: '' })
  const [selectedEventTables, setSelectedEventTables] = useState<number[]>([])
  const [showEventForm, setShowEventForm] = useState(false)
  const [editingEventId, setEditingEventId] = useState<number | null>(null)
  const [editingEventStartTime, setEditingEventStartTime] = useState('')
  const [editingEventEndTime, setEditingEventEndTime] = useState('')
  const [editingEventDateError, setEditingEventDateError] = useState('')
  const [inviteEventId, setInviteEventId] = useState<number | null>(null)
  const [inviteUserId, setInviteUserId] = useState('')
  const [editingTitleEventId, setEditingTitleEventId] = useState<number | null>(null)
  const [editingTitleValue, setEditingTitleValue] = useState('')
  const [expandedGsMemberId, setExpandedGsMemberId] = useState<number | null>(null)
  const [memberGameSystems, setMemberGameSystems] = useState<Record<number, string[]>>({})
  const [savingGsMemberId, setSavingGsMemberId] = useState<number | null>(null)

  const login = async () => {
    localStorage.setItem('clubKey', clubKey)
    const res = await fetch('/api/clubadmin/me', { headers: { 'X-Club-Key': clubKey } })
    if (res.ok) {
      const data = await res.json()
      setClub(data)
      setOpenTime(data.openTime || '10:00')
      setCloseTime(data.closeTime || '22:00')
      setVkUrl(data.vkUrl || '')
      setTelegramUrl(data.telegramUrl || '')
      setInstagramUrl(data.instagramUrl || '')
      setWhatsAppUrl(data.whatsAppUrl || '')
      setYouTubeUrl(data.youTubeUrl || '')
      setDiscordUrl(data.discordUrl || '')
      setWebsiteUrl(data.websiteUrl || '')
      setContactEmail(data.contactEmail || '')
      setContactPhone(data.contactPhone || '')
      setError('')
      loadData(clubKey)
    } else {
      setError('Invalid club key')
    }
  }

  const loadData = async (key: string) => {
    const [tablesRes, membRes, eventsRes, decorationsRes] = await Promise.all([
      fetch('/api/clubadmin/tables', { headers: { 'X-Club-Key': key } }),
      fetch('/api/clubadmin/memberships', { headers: { 'X-Club-Key': key } }),
      fetch('/api/clubadmin/events', { headers: { 'X-Club-Key': key } }),
      fetch('/api/clubadmin/decorations', { headers: { 'X-Club-Key': key } })
    ])
    if (tablesRes.ok) setTables(await tablesRes.json())
    if (membRes.ok) setMemberships(await membRes.json())
    if (eventsRes.ok) setEvents(await eventsRes.json())
    if (decorationsRes.ok) setDecorations(await decorationsRes.json())
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
    if (res.ok) setMemberships(memberships.map(m => m.id === id ? { ...m, status: 'Kicked', isModerator: false } : m))
  }

  const toggleModerator = async (id: number, currentValue: boolean) => {
    const res = await fetch(`/api/clubadmin/memberships/${id}/set-moderator`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Club-Key': clubKey },
      body: JSON.stringify({ isModerator: !currentValue })
    })
    if (res.ok) setMemberships(memberships.map(m => m.id === id ? { ...m, isModerator: !currentValue } : m))
  }

  const toggleGsEditor = (m: Membership) => {
    if (expandedGsMemberId === m.id) {
      setExpandedGsMemberId(null)
    } else {
      setExpandedGsMemberId(m.id)
      if (!(m.id in memberGameSystems)) {
        const gs = m.user.enabledGameSystems ? m.user.enabledGameSystems.split('|').filter(Boolean) : []
        setMemberGameSystems(prev => ({ ...prev, [m.id]: gs }))
      }
    }
  }

  const toggleMemberGs = (memberId: number, gs: string) => {
    setMemberGameSystems(prev => {
      const cur = prev[memberId] || []
      return { ...prev, [memberId]: cur.includes(gs) ? cur.filter(s => s !== gs) : [...cur, gs] }
    })
  }

  const saveMemberGameSystems = async (memberId: number) => {
    setSavingGsMemberId(memberId)
    const systems = memberGameSystems[memberId] || []
    const res = await fetch(`/api/clubadmin/memberships/${memberId}/game-systems`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', 'X-Club-Key': clubKey },
      body: JSON.stringify({ enabledGameSystems: systems })
    })
    if (res.ok) {
      const data = await res.json()
      setMemberships(memberships.map(m => m.id === memberId ? { ...m, user: { ...m.user, enabledGameSystems: data.enabledGameSystems } } : m))
    }
    setSavingGsMemberId(null)
  }

  const saveSettings = async () => {
    const res = await fetch('/api/clubadmin/settings', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', 'X-Club-Key': clubKey },
      body: JSON.stringify({
        openTime, closeTime,
        vkUrl: vkUrl || null, telegramUrl: telegramUrl || null,
        instagramUrl: instagramUrl || null, whatsAppUrl: whatsAppUrl || null,
        youTubeUrl: youTubeUrl || null, discordUrl: discordUrl || null,
        websiteUrl: websiteUrl || null, contactEmail: contactEmail || null,
        contactPhone: contactPhone || null
      })
    })
    if (res.ok) {
      const data = await res.json()
      setClub(prev => prev ? {
        ...prev,
        openTime: data.openTime, closeTime: data.closeTime,
        vkUrl: data.vkUrl, telegramUrl: data.telegramUrl,
        instagramUrl: data.instagramUrl, whatsAppUrl: data.whatsAppUrl,
        youTubeUrl: data.youTubeUrl, discordUrl: data.discordUrl,
        websiteUrl: data.websiteUrl, contactEmail: data.contactEmail,
        contactPhone: data.contactPhone
      } : prev)
      setSettingsSaved(true)
      setTimeout(() => setSettingsSaved(false), 2000)
    }
  }

  const createEvent = async () => {
    const body = {
      title: newEvent.title,
      startTime: newEvent.startTime.length === 16 ? newEvent.startTime + ':00' : newEvent.startTime,
      endTime: newEvent.endTime.length === 16 ? newEvent.endTime + ':00' : newEvent.endTime,
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
      setNewEvent({ title: '', startTime: '', endTime: '', maxParticipants: 8, eventType: 'Tournament', gameSystem: '', tableIds: '' })
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
    const pad = (n: number) => String(n).padStart(2, '0')
    const toLocal = (iso: string) => {
      const d = new Date(iso)
      return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:00`
    }
    setEditingEventId(ev.id)
    setEditingEventStartTime(toLocal(ev.startTime))
    setEditingEventEndTime(toLocal(ev.endTime))
    setEditingEventDateError('')
  }

  const saveEventDate = async (id: number) => {
    if (!editingEventStartTime || !editingEventEndTime) return
    const isoStart = editingEventStartTime.length === 16 ? editingEventStartTime + ':00' : editingEventStartTime
    const isoEnd = editingEventEndTime.length === 16 ? editingEventEndTime + ':00' : editingEventEndTime
    const res = await fetch(`/api/clubadmin/events/${id}/date`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', 'X-Club-Key': clubKey },
      body: JSON.stringify({ startTime: isoStart, endTime: isoEnd })
    })
    if (res.ok) {
      const data = await res.json()
      setEvents(events.map(e => e.id === id ? { ...e, startTime: data.startTime, endTime: data.endTime } : e))
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

  const saveEventTitle = async (id: number) => {
    const trimmed = editingTitleValue.trim()
    if (!trimmed) return
    const res = await fetch(`/api/clubadmin/events/${id}/title`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', 'X-Club-Key': clubKey },
      body: JSON.stringify({ title: trimmed })
    })
    if (res.ok) {
      const data = await res.json()
      setEvents(events.map(e => e.id === id ? { ...e, title: data.title } : e))
      setEditingTitleEventId(null)
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

  const addDecoration = async (type: 'wall' | 'window' | 'door', x: number, y: number, width: number, height: number) => {
    const res = await fetch('/api/clubadmin/decorations', {
      method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Club-Key': clubKey },
      body: JSON.stringify({ type, x, y, width, height })
    })
    if (res.ok) { const d = await res.json(); setDecorations(prev => [...prev, d]) }
  }

  const moveDecoration = async (id: number, x: number, y: number) => {
    const deco = decorations.find(d => d.id === id)
    if (!deco) return
    const res = await fetch(`/api/clubadmin/decorations/${id}`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json', 'X-Club-Key': clubKey },
      body: JSON.stringify({ ...deco, x, y })
    })
    if (res.ok) { const d = await res.json(); setDecorations(decorations.map(x => x.id === d.id ? d : x)) }
  }

  const deleteDecoration = async (id: number) => {
    await fetch(`/api/clubadmin/decorations/${id}`, { method: 'DELETE', headers: { 'X-Club-Key': clubKey } })
    setDecorations(decorations.filter(d => d.id !== id))
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
  const tabBarStyle: React.CSSProperties = { display: 'flex', borderBottom: '2px solid #0f3460', marginBottom: 24 }
  const tabStyle = (active: boolean): React.CSSProperties => ({
    background: 'none',
    color: active ? '#e94560' : '#aaa',
    border: 'none',
    borderBottom: active ? '2px solid #e94560' : '2px solid transparent',
    padding: '10px 20px',
    cursor: 'pointer',
    fontSize: 14,
    marginBottom: -2,
    transition: 'color 0.15s',
  })
  const thStyle: React.CSSProperties = { textAlign: 'left', padding: '8px 12px', color: '#aaa', fontWeight: 600, fontSize: 13, borderBottom: '1px solid #0f3460' }
  const tdStyle: React.CSSProperties = { padding: '8px 12px', fontSize: 13, borderBottom: '1px solid #16213e', verticalAlign: 'middle' }

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
      <div style={tabBarStyle}>
        <button style={tabStyle(tab === 'map')} onClick={() => setTab('map')}>Map Editor</button>
        <button style={tabStyle(tab === 'members')} onClick={() => setTab('members')}>
          Members{memberships.filter(m => m.status === 'Pending').length > 0 && <span style={{ marginLeft: 6, background: '#e94560', color: '#fff', borderRadius: 10, padding: '1px 7px', fontSize: 11 }}>{memberships.filter(m => m.status === 'Pending').length}</span>}
        </button>
        <button style={tabStyle(tab === 'events')} onClick={() => setTab('events')}>
          События{events.length > 0 && <span style={{ marginLeft: 6, background: '#533483', color: '#fff', borderRadius: 10, padding: '1px 7px', fontSize: 11 }}>{events.length}</span>}
        </button>
        <button style={tabStyle(tab === 'settings')} onClick={() => setTab('settings')}>Настройки</button>
      </div>

      {tab === 'map' && (
        <>
          <ClubMapEditor
            tables={tables}
            decorations={decorations}
            onPositionChange={updateTablePosition}
            onTableClick={t => { setEditingTable(t); setSelectedGames(t.supportedGames ? t.supportedGames.split('|').filter(g => ALL_GAME_SYSTEMS.includes(g)) : []) }}
            onAddDecoration={addDecoration}
            onMoveDecoration={moveDecoration}
            onDeleteDecoration={deleteDecoration}
          />
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
                <button style={btnStyle} onClick={() => { setEditingTable(t); setSelectedGames(t.supportedGames ? t.supportedGames.split('|').filter(g => ALL_GAME_SYSTEMS.includes(g)) : []) }}>Edit</button>
                <button style={{ ...btnStyle, background: '#1a6e3c' }} onClick={() => copyTable(t.id)}>Copy</button>
              </div>
            </div>
          ))}
        </>
      )}

      {tab === 'members' && (
        <>
          <h3>Membership Applications</h3>
          {memberships.length === 0 ? (
            <p style={{ color: '#aaa' }}>No applications yet.</p>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', background: '#16213e', borderRadius: 8, overflow: 'hidden' }}>
                <thead>
                  <tr style={{ background: '#0f3460' }}>
                    <th style={thStyle}>Имя</th>
                    <th style={thStyle}>Email</th>
                    <th style={thStyle}>Дата заявки</th>
                    <th style={thStyle}>Статус</th>
                    <th style={thStyle}>Модератор</th>
                    <th style={thStyle}>Действия</th>
                  </tr>
                </thead>
                <tbody>
                  {memberships.map(m => (
                    <React.Fragment key={m.id}>
                    <tr style={{ background: '#16213e' }}>
                      <td style={tdStyle}><strong>{m.user.name}</strong></td>
                      <td style={{ ...tdStyle, color: '#aaa' }}>{m.user.email}</td>
                      <td style={{ ...tdStyle, color: '#aaa' }}>{new Date(m.appliedAt).toLocaleDateString()}</td>
                      <td style={{ ...tdStyle, color: membershipStatusColor(m.status) }}>{membershipStatusLabel(m.status)}</td>
                      <td style={tdStyle}>
                        {m.status === 'Approved' && (
                          <span style={{ color: m.isModerator ? '#ffc107' : '#555', fontSize: 16 }} title={m.isModerator ? 'Модератор' : 'Не модератор'}>
                            {m.isModerator ? '⭐' : '—'}
                          </span>
                        )}
                      </td>
                      <td style={tdStyle}>
                        {m.status === 'Pending' && (
                          <>
                            <button style={{ ...btnStyle, background: '#4caf50' }} onClick={() => updateMembership(m.id, 'approve')}>Approve</button>
                            <button style={{ ...btnStyle, background: '#e94560' }} onClick={() => updateMembership(m.id, 'reject')}>Reject</button>
                          </>
                        )}
                        {m.status === 'Approved' && (
                          <>
                            <button
                              style={{ ...btnStyle, background: m.isModerator ? '#7b4a00' : '#1a5a3c' }}
                              onClick={() => toggleModerator(m.id, m.isModerator)}
                              title={m.isModerator ? 'Снять роль модератора' : 'Назначить модератором'}
                            >
                              {m.isModerator ? '⭐ Снять' : '⭐ Модератор'}
                            </button>
                            <button
                              style={{ ...btnStyle, background: expandedGsMemberId === m.id ? '#1a3a6a' : '#0f3460' }}
                              onClick={() => toggleGsEditor(m)}
                              title="Редактировать игровые системы"
                            >🎲 Системы</button>
                            <button style={{ ...btnStyle, background: '#ff5722' }} onClick={() => kickMember(m.id)}>Исключить</button>
                          </>
                        )}
                      </td>
                    </tr>
                    {expandedGsMemberId === m.id && m.status === 'Approved' && (
                      <tr>
                        <td colSpan={6} style={{ padding: '12px 16px', background: '#101c36', borderBottom: '1px solid #0f3460' }}>
                          <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
                            <button
                              style={{ ...btnStyle, background: '#1a5a3c', fontSize: 12, padding: '4px 12px' }}
                              onClick={() => setMemberGameSystems(prev => ({ ...prev, [m.id]: [...ALL_GAME_SYSTEMS] }))}
                            >✓ Все включить</button>
                            <button
                              style={{ ...btnStyle, background: '#7b1a1a', fontSize: 12, padding: '4px 12px' }}
                              onClick={() => setMemberGameSystems(prev => ({ ...prev, [m.id]: [] }))}
                            >✗ Все выключить</button>
                          </div>
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '2px 16px', marginBottom: 10 }}>
                            {GAME_SYSTEMS_MAIN.map(gs => (
                              <label key={gs} style={{ display: 'flex', alignItems: 'center', gap: 5, color: '#eee', fontSize: 13, cursor: 'pointer', padding: '3px 0' }}>
                                <input
                                  type="checkbox"
                                  checked={(memberGameSystems[m.id] || []).includes(gs)}
                                  onChange={() => toggleMemberGs(m.id, gs)}
                                />
                                {gs}
                              </label>
                            ))}
                          </div>
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '2px 16px', borderTop: '1px solid #0f3460', paddingTop: 8, marginBottom: 10 }}>
                            {GAME_SYSTEMS_BOTTOM.map(gs => (
                              <label key={gs} style={{ display: 'flex', alignItems: 'center', gap: 5, color: '#eee', fontSize: 13, cursor: 'pointer', padding: '3px 0' }}>
                                <input
                                  type="checkbox"
                                  checked={(memberGameSystems[m.id] || []).includes(gs)}
                                  onChange={() => toggleMemberGs(m.id, gs)}
                                />
                                {gs}
                              </label>
                            ))}
                          </div>
                          <button
                            style={{ ...btnStyle, background: '#e94560', opacity: savingGsMemberId === m.id ? 0.7 : 1 }}
                            onClick={() => saveMemberGameSystems(m.id)}
                            disabled={savingGsMemberId === m.id}
                          >
                            {savingGsMemberId === m.id ? 'Сохраняем...' : 'Сохранить'}
                          </button>
                        </td>
                      </tr>
                    )}
                    </React.Fragment>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {tab === 'settings' && (
        <>
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
            </div>
          </div>

          <div style={{ ...cardStyle, marginTop: 16 }}>
            <h3>Соцсети и контакты</h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 12 }}>
              {([
                { label: 'ВКонтакте', value: vkUrl, setter: setVkUrl, placeholder: 'https://vk.com/yourclub' },
                { label: 'Telegram', value: telegramUrl, setter: setTelegramUrl, placeholder: 'https://t.me/yourclub' },
                { label: 'Instagram', value: instagramUrl, setter: setInstagramUrl, placeholder: 'https://instagram.com/yourclub' },
                { label: 'WhatsApp', value: whatsAppUrl, setter: setWhatsAppUrl, placeholder: 'https://wa.me/79001234567' },
                { label: 'YouTube', value: youTubeUrl, setter: setYouTubeUrl, placeholder: 'https://youtube.com/@yourclub' },
                { label: 'Discord', value: discordUrl, setter: setDiscordUrl, placeholder: 'https://discord.gg/yourclub' },
                { label: 'Сайт', value: websiteUrl, setter: setWebsiteUrl, placeholder: 'https://yourclub.ru' },
                { label: 'E-mail', value: contactEmail, setter: setContactEmail, placeholder: 'info@yourclub.ru' },
                { label: 'Телефон', value: contactPhone, setter: setContactPhone, placeholder: '+7 900 123-45-67' },
              ] as { label: string; value: string; setter: (v: string) => void; placeholder: string }[]).map(({ label, value, setter, placeholder }) => (
                <div key={label}>
                  <label style={{ color: '#aaa', fontSize: 13, display: 'block', marginBottom: 4 }}>{label}</label>
                  <input style={inputStyle} type="text" value={value} placeholder={placeholder}
                    onChange={e => setter(e.target.value)} />
                </div>
              ))}
            </div>
            <div style={{ marginTop: 18, display: 'flex', alignItems: 'center', gap: 12 }}>
              <button style={btnStyle} onClick={saveSettings}>Сохранить</button>
              {settingsSaved && <span style={{ color: '#4caf50' }}>✓ Сохранено</span>}
            </div>
          </div>
        </>
      )}

      {tab === 'events' && (
        <>
          <div style={{ marginBottom: 16 }}>
            <button style={btnStyle} onClick={() => {
              if (!showEventForm && club?.openTime) {
                const [h, m = 0] = club.openTime.split(':').map(Number)
                const now = new Date()
                const d = new Date()
                d.setHours(h, m ?? 0, 0, 0)
                if (d <= now) d.setDate(d.getDate() + 1)
                const pad = (n: number) => String(n).padStart(2, '0')
                const defaultDate = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(h)}:${pad(m)}`
                setNewEvent(prev => ({ ...prev, startTime: defaultDate, endTime: defaultDate }))
              }
              setShowEventForm(v => !v)
            }}>
              {showEventForm ? '✕ Отмена' : '+ Создать событие'}
            </button>
          </div>

          {showEventForm && (
            <div style={{ ...cardStyle, border: '1px solid #e94560' }}>
              <h3>Новое событие</h3>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                <input style={inputStyle} placeholder="Название" value={newEvent.title}
                  onChange={e => setNewEvent({ ...newEvent, title: e.target.value })} />
                <label style={{ color: '#aaa', fontSize: 13, alignSelf: 'center' }}>Начало:</label>
                <input style={inputStyle} type="datetime-local" step={3600} value={newEvent.startTime}
                  onChange={e => setNewEvent({ ...newEvent, startTime: e.target.value })} />
                <label style={{ color: '#aaa', fontSize: 13, alignSelf: 'center' }}>Конец:</label>
                <input style={inputStyle} type="datetime-local" step={3600} value={newEvent.endTime}
                  onChange={e => setNewEvent({ ...newEvent, endTime: e.target.value })} />
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
                <button style={btnStyle} onClick={createEvent} disabled={!newEvent.title || !newEvent.startTime || !newEvent.endTime}>Создать</button>
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
                      📅 {new Date(ev.startTime).toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                      {' – '}
                      {new Date(ev.endTime).toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                      &nbsp;·&nbsp;👥 {ev.participants.length}/{ev.maxParticipants}
                      {tableNumbers && <>&nbsp;·&nbsp;🎲 {tableNumbers}</>}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    <button style={{ ...btnStyle, background: '#533483' }} onClick={() => {
                      if (editingTitleEventId === ev.id) { setEditingTitleEventId(null) }
                      else { setEditingTitleEventId(ev.id); setEditingTitleValue(ev.title) }
                    }}>
                      {editingTitleEventId === ev.id ? '✕' : '✏️ Название'}
                    </button>
                    <button style={{ ...btnStyle, background: '#1a6e3c' }} onClick={() => editingEventId === ev.id ? setEditingEventId(null) : startEditingEventDate(ev)}>
                      {editingEventId === ev.id ? '✕' : '📅 Дата'}
                    </button>
                    <button style={{ ...btnStyle, background: '#0f3460' }} onClick={() => { setInviteEventId(inviteEventId === ev.id ? null : ev.id); setInviteUserId('') }}>
                      {inviteEventId === ev.id ? '✕' : '+ Пригласить'}
                    </button>
                    <button style={{ ...btnStyle, background: '#e94560' }} onClick={() => deleteEvent(ev.id)}>Удалить</button>
                  </div>
                </div>

                {editingTitleEventId === ev.id && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', paddingTop: 4 }}>
                    <input style={{ ...inputStyle, minWidth: 220 }} value={editingTitleValue}
                      onChange={e => setEditingTitleValue(e.target.value)}
                      onKeyDown={e => {
                        if (e.key === 'Enter') saveEventTitle(ev.id)
                        if (e.key === 'Escape') setEditingTitleEventId(null)
                      }}
                      placeholder="Название события" autoFocus />
                    <button style={{ ...btnStyle, background: '#4caf50' }} onClick={() => saveEventTitle(ev.id)} disabled={!editingTitleValue.trim()}>Сохранить</button>
                  </div>
                )}

                {editingEventId === ev.id && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', paddingTop: 4 }}>
                    <label style={{ color: '#aaa', fontSize: 13 }}>Начало:</label>
                    <input style={inputStyle} type="datetime-local" step={3600} value={editingEventStartTime}
                      onChange={e => { setEditingEventStartTime(e.target.value); setEditingEventDateError('') }} />
                    <label style={{ color: '#aaa', fontSize: 13 }}>Конец:</label>
                    <input style={inputStyle} type="datetime-local" step={3600} value={editingEventEndTime}
                      onChange={e => { setEditingEventEndTime(e.target.value); setEditingEventDateError('') }} />
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
