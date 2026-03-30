import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'

const cardStyle: React.CSSProperties = {
  background: '#16213e',
  border: '1px solid #0f3460',
  borderRadius: 8,
  padding: 24,
  marginBottom: 16,
  maxWidth: 480,
}

const inputStyle: React.CSSProperties = {
  background: '#0f3460',
  border: '1px solid #1a4080',
  borderRadius: 6,
  color: '#eee',
  padding: '8px 12px',
  fontSize: 15,
  width: '100%',
  boxSizing: 'border-box',
}

const btnStyle: React.CSSProperties = {
  border: 'none',
  borderRadius: 6,
  padding: '8px 18px',
  cursor: 'pointer',
  fontWeight: 600,
  fontSize: 14,
  color: '#fff',
}

export default function SettingsPage() {
  const navigate = useNavigate()
  const token = localStorage.getItem('token') || ''

  const [googleName, setGoogleName] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [inputValue, setInputValue] = useState('')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!token) {
      navigate('/')
      return
    }
    fetch('/api/user/me', { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then(data => {
        setGoogleName(data.name || '')
        const dn = data.displayName || ''
        setDisplayName(dn)
        setInputValue(dn)
      })
      .catch(() => setError('Не удалось загрузить данные профиля'))
  }, [token, navigate])

  const handleSave = async () => {
    setSaving(true)
    setSaved(false)
    setError('')
    try {
      const res = await fetch('/api/user/display-name', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ displayName: inputValue }),
      })
      if (res.ok) {
        const data = await res.json()
        const dn = data.displayName || ''
        setDisplayName(dn)
        setInputValue(dn)
        setSaved(true)
      } else {
        setError('Ошибка при сохранении')
      }
    } catch {
      setError('Ошибка при сохранении')
    } finally {
      setSaving(false)
    }
  }

  const effectiveName = displayName || googleName

  return (
    <div style={{ padding: 40 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 32 }}>
        <button style={{ ...btnStyle, background: '#0f3460' }} onClick={() => navigate('/')}>
          ← Назад
        </button>
        <h1 style={{ color: '#e94560', margin: 0, fontSize: 28 }}>⚙️ Настройки профиля</h1>
      </div>

      <div style={cardStyle}>
        <h2 style={{ marginTop: 0, marginBottom: 20, color: '#eee', fontSize: 18 }}>Имя для отображения</h2>

        <div style={{ marginBottom: 16 }}>
          <label style={{ display: 'block', color: '#aaa', fontSize: 13, marginBottom: 6 }}>
            Имя из Google-аккаунта
          </label>
          <div style={{ color: '#eee', fontSize: 15, padding: '8px 0' }}>{googleName || '—'}</div>
        </div>

        <div style={{ marginBottom: 20 }}>
          <label style={{ display: 'block', color: '#aaa', fontSize: 13, marginBottom: 6 }}>
            Своё имя для отображения
          </label>
          <input
            style={inputStyle}
            type="text"
            placeholder={`Оставьте пустым, чтобы использовать «${googleName}»`}
            value={inputValue}
            maxLength={60}
            onChange={e => { setInputValue(e.target.value); setSaved(false) }}
          />
          <div style={{ color: '#666', fontSize: 12, marginTop: 6 }}>
            Будет отображаться везде вместо имени Google. Максимум 60 символов.
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <button
            style={{ ...btnStyle, background: '#e94560', opacity: saving ? 0.7 : 1 }}
            onClick={handleSave}
            disabled={saving}
          >
            {saving ? 'Сохраняем...' : 'Сохранить'}
          </button>
          {saved && <span style={{ color: '#4caf50', fontSize: 14 }}>✓ Сохранено</span>}
          {error && <span style={{ color: '#e94560', fontSize: 14 }}>{error}</span>}
        </div>
      </div>

      <div style={cardStyle}>
        <h3 style={{ marginTop: 0, color: '#aaa', fontSize: 15, fontWeight: 400 }}>
          Как вас сейчас видят другие:
        </h3>
        <div style={{ color: '#eee', fontSize: 20, fontWeight: 600 }}>👤 {effectiveName}</div>
      </div>
    </div>
  )
}
