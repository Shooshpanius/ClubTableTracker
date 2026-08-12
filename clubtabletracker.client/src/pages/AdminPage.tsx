import { useState, useEffect } from 'react'
import { Button, Dataslate, Badge, GothicDivider } from '../components/ui'

interface Club {
  id: number
  name: string
  description: string
  accessKey: string
}

export default function AdminPage() {
  const [masterKey, setMasterKey] = useState(sessionStorage.getItem('masterKey') || '')
  const [clubs, setClubs] = useState<Club[]>([])
  const [newName, setNewName] = useState('')
  const [newDesc, setNewDesc] = useState('')
  const [error, setError] = useState('')
  const [authed, setAuthed] = useState(false)
  const [showCreateModal, setShowCreateModal] = useState(false)

  const login = () => {
    sessionStorage.setItem('masterKey', masterKey)
    loadClubs(masterKey)
  }

  const loadClubs = async (key: string) => {
    const res = await fetch('/api/admin/clubs', { headers: { 'X-Master-Key': key } })
    if (res.ok) {
      setClubs(await res.json())
      setAuthed(true)
      setError('')
    } else {
      setError('Неверный мастер-ключ')
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
      setShowCreateModal(false)
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

  if (!authed) {
    return (
      <div className="gd-app" style={{ minHeight: '100vh' }}>
        <div className="gd-gadmin-container">
          <div style={{ marginBottom: 'var(--gd-s4)' }}>
            <h1 className="gd-gadmin-title">Глобальное управление</h1>
            <p className="gd-gadmin-sub">Панель системного администратора · Авторизация</p>
          </div>
          <Dataslate title="Вход по мастер-ключу">
            <input
              className="gd-input"
              type="password"
              placeholder="Мастер-ключ"
              value={masterKey}
              onChange={e => setMasterKey(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && login()}
              style={{ width: '100%' }}
            />
            {error && <p style={{ color: 'var(--gd-danger)', fontSize: '0.8rem' }}>{error}</p>}
            <Button variant="primary" onClick={login}>Войти</Button>
          </Dataslate>
        </div>
      </div>
    )
  }

  return (
    <div className="gd-app" style={{ minHeight: '100vh' }}>
      <div className="gd-gadmin-container">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 'var(--gd-s2)', marginBottom: 'var(--gd-s4)' }}>
          <div>
            <h1 className="gd-gadmin-title">Глобальное управление</h1>
            <p className="gd-gadmin-sub">Панель системного администратора · Все клубы платформы</p>
          </div>
          <Button variant="secondary" size="sm" onClick={() => { sessionStorage.removeItem('masterKey'); setAuthed(false); setMasterKey('') }}>← Выход</Button>
        </div>
        <GothicDivider />

        <Dataslate title={`Клубы (${clubs.length})`}>
          {clubs.length === 0 ? (
            <p className="gd-text-muted">Клубов пока нет</p>
          ) : (
            <table className="gd-gadmin-table">
              <thead>
                <tr>
                  <th>Название</th>
                  <th>Описание</th>
                  <th>Ключ доступа</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {clubs.map(club => (
                  <tr key={club.id}>
                    <td><strong>{club.name}</strong></td>
                    <td className="gd-text-secondary">{club.description || '—'}</td>
                    <td>
                      <code className="gd-gadmin-code">{club.accessKey}</code>
                      {' '}
                      <Badge tone="brass">Активен</Badge>
                    </td>
                    <td>
                      <Button variant="secondary" size="xs" onClick={() => regenerateKey(club.id)}>
                        Сгенерировать
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          <Button variant="primary" size="sm" style={{ marginTop: 'var(--gd-s3)' }} onClick={() => setShowCreateModal(true)}>
            + Создать клуб
          </Button>
        </Dataslate>

        {showCreateModal && (
          <div className="gd-gadmin-modal-overlay" onClick={() => setShowCreateModal(false)}>
            <div className="gd-gadmin-modal" onClick={e => e.stopPropagation()}>
              <h3>Создать клуб</h3>
              <div style={{ marginBottom: 'var(--gd-s3)' }}>
                <label className="gd-gadmin-form-label">Название</label>
                <input className="gd-input" style={{ width: '100%' }} placeholder="Название ордена" value={newName} onChange={e => setNewName(e.target.value)} />
              </div>
              <div style={{ marginBottom: 'var(--gd-s3)' }}>
                <label className="gd-gadmin-form-label">Описание</label>
                <input className="gd-input" style={{ width: '100%' }} placeholder="Краткое описание" value={newDesc} onChange={e => setNewDesc(e.target.value)} />
              </div>
              <div style={{ display: 'flex', gap: 'var(--gd-s2)', justifyContent: 'flex-end' }}>
                <Button variant="secondary" onClick={() => setShowCreateModal(false)}>Отмена</Button>
                <Button variant="primary" onClick={createClub}>Создать</Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
