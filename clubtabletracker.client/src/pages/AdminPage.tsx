import { useState, useEffect } from 'react'

interface Club {
  id: number
  name: string
  description: string
  accessKey: string
}

export default function AdminPage() {
  const [masterKey, setMasterKey] = useState(localStorage.getItem('masterKey') || '')
  const [clubs, setClubs] = useState<Club[]>([])
  const [newName, setNewName] = useState('')
  const [newDesc, setNewDesc] = useState('')
  const [error, setError] = useState('')
  const [authed, setAuthed] = useState(false)

  const login = () => {
    localStorage.setItem('masterKey', masterKey)
    loadClubs(masterKey)
  }

  const loadClubs = async (key: string) => {
    const res = await fetch('/api/admin/clubs', { headers: { 'X-Master-Key': key } })
    if (res.ok) {
      setClubs(await res.json())
      setAuthed(true)
      setError('')
    } else {
      setError('Invalid master key')
      setAuthed(false)
    }
  }

  useEffect(() => {
    if (masterKey) loadClubs(masterKey)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const createClub = async () => {
    if (!newName) return
    const res = await fetch('/api/admin/clubs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Master-Key': masterKey },
      body: JSON.stringify({ name: newName, description: newDesc })
    })
    if (res.ok) {
      const club = await res.json()
      setClubs([...clubs, club])
      setNewName('')
      setNewDesc('')
    }
  }

  const regenerateKey = async (id: number) => {
    const res = await fetch(`/api/admin/clubs/${id}/regenerate-key`, {
      method: 'POST',
      headers: { 'X-Master-Key': masterKey }
    })
    if (res.ok) {
      const { accessKey } = await res.json()
      setClubs(clubs.map(c => c.id === id ? { ...c, accessKey } : c))
    }
  }

  const cardStyle: React.CSSProperties = {
    background: '#16213e', border: '1px solid #0f3460', borderRadius: 8,
    padding: 16, marginBottom: 16
  }
  const inputStyle: React.CSSProperties = {
    background: '#0f3460', border: '1px solid #533483', color: '#eee',
    padding: '8px 12px', borderRadius: 4, marginRight: 8, width: 200
  }
  const btnStyle: React.CSSProperties = {
    background: '#533483', color: '#fff', border: 'none',
    padding: '8px 16px', borderRadius: 4, cursor: 'pointer'
  }

  if (!authed) {
    return (
      <div style={{ padding: 40 }}>
        <h1 style={{ color: '#e94560' }}>🎲 ClubTableTracker Admin</h1>
        <div style={cardStyle}>
          <h2>Master Key Login</h2>
          <input style={inputStyle} type="password" placeholder="Master Key"
            value={masterKey} onChange={e => setMasterKey(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && login()} />
          <button style={btnStyle} onClick={login}>Login</button>
          {error && <p style={{ color: '#e94560' }}>{error}</p>}
        </div>
      </div>
    )
  }

  return (
    <div style={{ padding: 40 }}>
      <h1 style={{ color: '#e94560' }}>🎲 ClubTableTracker Admin</h1>
      <div style={cardStyle}>
        <h2>Create Club</h2>
        <input style={inputStyle} placeholder="Club Name" value={newName} onChange={e => setNewName(e.target.value)} />
        <input style={inputStyle} placeholder="Description" value={newDesc} onChange={e => setNewDesc(e.target.value)} />
        <button style={btnStyle} onClick={createClub}>Create Club</button>
      </div>
      <h2>Clubs</h2>
      {clubs.map(club => (
        <div key={club.id} style={cardStyle}>
          <h3>{club.name}</h3>
          <p style={{ color: '#aaa' }}>{club.description}</p>
          <p>Access Key: <code style={{ background: '#0f3460', padding: '2px 8px', borderRadius: 3 }}>{club.accessKey}</code></p>
          <button style={{ ...btnStyle, background: '#e94560' }} onClick={() => regenerateKey(club.id)}>
            Regenerate Key
          </button>
        </div>
      ))}
    </div>
  )
}
