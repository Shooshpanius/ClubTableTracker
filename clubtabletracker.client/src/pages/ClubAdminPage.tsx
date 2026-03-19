import { useState, useEffect } from 'react'
import ClubMapEditor from '../components/ClubMapEditor'

interface ClubInfo { id: number; name: string; description: string }
interface Membership { id: number; status: string; appliedAt: string; user: { id: string; name: string; email: string } }
interface GameTable { id: number; clubId: number; number: string; size: string; supportedGames: string; x: number; y: number; width: number; height: number }

const GW_GAMES = [
  'Warhammer 40,000', 'Age of Sigmar', 'The Horus Heresy', 'Necromunda',
  'Blood Bowl', 'Warhammer Underworlds', 'Kill Team', 'Warcry',
  'Aeronautica Imperialis', 'Middle-earth Strategy Battle Game'
]

export default function ClubAdminPage() {
  const [clubKey, setClubKey] = useState(localStorage.getItem('clubKey') || '')
  const [club, setClub] = useState<ClubInfo | null>(null)
  const [tables, setTables] = useState<GameTable[]>([])
  const [memberships, setMemberships] = useState<Membership[]>([])
  const [error, setError] = useState('')
  const [tab, setTab] = useState<'map' | 'members'>('map')
  const [editingTable, setEditingTable] = useState<Partial<GameTable> | null>(null)
  const [selectedGames, setSelectedGames] = useState<string[]>([])

  const login = async () => {
    localStorage.setItem('clubKey', clubKey)
    const res = await fetch('/api/clubadmin/me', { headers: { 'X-Club-Key': clubKey } })
    if (res.ok) {
      setClub(await res.json())
      setError('')
      loadData(clubKey)
    } else {
      setError('Invalid club key')
    }
  }

  const loadData = async (key: string) => {
    const [tablesRes, membRes] = await Promise.all([
      fetch('/api/clubadmin/tables', { headers: { 'X-Club-Key': key } }),
      fetch('/api/clubadmin/memberships', { headers: { 'X-Club-Key': key } })
    ])
    if (tablesRes.ok) setTables(await tablesRes.json())
    if (membRes.ok) setMemberships(await membRes.json())
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
      height: editingTable.height || 60
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

  const updateTablePosition = async (id: number, x: number, y: number) => {
    const table = tables.find(t => t.id === id)
    if (!table) return
    const res = await fetch(`/api/clubadmin/tables/${id}`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json', 'X-Club-Key': clubKey },
      body: JSON.stringify({ ...table, x, y })
    })
    if (res.ok) { const t = await res.json(); setTables(tables.map(x => x.id === t.id ? t : x)) }
  }

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
      </div>

      {tab === 'map' && (
        <>
          <ClubMapEditor tables={tables} onPositionChange={updateTablePosition} onTableClick={t => { setEditingTable(t); setSelectedGames(t.supportedGames ? t.supportedGames.split('|').filter(Boolean) : []) }} />
          <div style={{ ...cardStyle, marginTop: 16 }}>
            <h3>Add New Table</h3>
            <button style={btnStyle} onClick={() => { setEditingTable({ number: '', size: 'Medium', x: 50, y: 50, width: 100, height: 60 }); setSelectedGames([]) }}>+ Add Table</button>
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
                {GW_GAMES.map(game => (
                  <label key={game} style={{ display: 'inline-block', margin: '4px 8px', cursor: 'pointer' }}>
                    <input type="checkbox" checked={selectedGames.includes(game)}
                      onChange={e => setSelectedGames(e.target.checked ? [...selectedGames, game] : selectedGames.filter(g => g !== game))} />
                    {' '}{game}
                  </label>
                ))}
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
                <div style={{ color: m.status === 'Approved' ? '#4caf50' : m.status === 'Rejected' ? '#e94560' : '#ffc107' }}>{m.status}</div>
              </div>
              {m.status === 'Pending' && (
                <div>
                  <button style={{ ...btnStyle, background: '#4caf50' }} onClick={() => updateMembership(m.id, 'approve')}>Approve</button>
                  <button style={{ ...btnStyle, background: '#e94560' }} onClick={() => updateMembership(m.id, 'reject')}>Reject</button>
                </div>
              )}
            </div>
          ))}
        </>
      )}
    </div>
  )
}
