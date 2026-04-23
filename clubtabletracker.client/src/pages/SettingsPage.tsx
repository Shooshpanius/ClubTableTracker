import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { GAME_SYSTEMS_MAIN, GAME_SYSTEMS_BOTTOM, DEFAULT_BOOKING_COLORS, BOOKING_COLORS_LABELS } from '../constants'
import type { BookingColors } from '../constants'

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

  const [enabledGameSystems, setEnabledGameSystems] = useState<string[]>([])
  const [savingGS, setSavingGS] = useState(false)
  const [savedGS, setSavedGS] = useState(false)
  const [errorGS, setErrorGS] = useState('')

  const [bookingColors, setBookingColors] = useState<BookingColors>(DEFAULT_BOOKING_COLORS)
  const [savingColors, setSavingColors] = useState(false)
  const [savedColors, setSavedColors] = useState(false)
  const [errorColors, setErrorColors] = useState('')

  const [gsExpanded, setGsExpanded] = useState(false)
  const [colorsExpanded, setColorsExpanded] = useState(false)

  const [bioInput, setBioInput] = useState('')
  const [savingBio, setSavingBio] = useState(false)
  const [savedBio, setSavedBio] = useState(false)
  const [errorBio, setErrorBio] = useState('')

  const [cityInput, setCityInput] = useState('')
  const [savingCity, setSavingCity] = useState(false)
  const [savedCity, setSavedCity] = useState(false)
  const [errorCity, setErrorCity] = useState('')

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
        const gs = data.enabledGameSystems
          ? data.enabledGameSystems.split('|').filter(Boolean)
          : []
        setEnabledGameSystems(gs)
        setBioInput(data.bio || '')
        setCityInput(data.city || '')
        if (data.bookingColors) {
          try {
            setBookingColors({ ...DEFAULT_BOOKING_COLORS, ...JSON.parse(data.bookingColors) })
          } catch { /* ignore */ }
        }
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

  const handleSaveBio = async () => {
    setSavingBio(true)
    setSavedBio(false)
    setErrorBio('')
    try {
      const res = await fetch('/api/user/bio', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ bio: bioInput }),
      })
      if (res.ok) {
        const data = await res.json()
        setBioInput(data.bio || '')
        setSavedBio(true)
      } else {
        setErrorBio('Ошибка при сохранении')
      }
    } catch {
      setErrorBio('Ошибка при сохранении')
    } finally {
      setSavingBio(false)
    }
  }

  const handleSaveCity = async () => {
    setSavingCity(true)
    setSavedCity(false)
    setErrorCity('')
    try {
      const res = await fetch('/api/user/city', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ city: cityInput }),
      })
      if (res.ok) {
        const data = await res.json()
        setCityInput(data.city || '')
        setSavedCity(true)
      } else {
        setErrorCity('Ошибка при сохранении')
      }
    } catch {
      setErrorCity('Ошибка при сохранении')
    } finally {
      setSavingCity(false)
    }
  }

  const toggleGameSystem = (gs: string) => {
    setEnabledGameSystems(prev =>
      prev.includes(gs) ? prev.filter(s => s !== gs) : [...prev, gs]
    )
    setSavedGS(false)
  }

  const handleSaveGameSystems = async () => {
    setSavingGS(true)
    setSavedGS(false)
    setErrorGS('')
    try {
      const res = await fetch('/api/user/game-systems', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ enabledGameSystems }),
      })
      if (res.ok) {
        setSavedGS(true)
      } else {
        setErrorGS('Ошибка при сохранении')
      }
    } catch {
      setErrorGS('Ошибка при сохранении')
    } finally {
      setSavingGS(false)
    }
  }

  const handleSaveColors = async (colors: BookingColors) => {
    setSavingColors(true)
    setSavedColors(false)
    setErrorColors('')
    try {
      const res = await fetch('/api/user/booking-colors', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ bookingColors: JSON.stringify(colors) }),
      })
      if (res.ok) {
        localStorage.setItem('bookingColors', JSON.stringify(colors))
        setSavedColors(true)
      } else {
        setErrorColors('Ошибка при сохранении')
      }
    } catch {
      setErrorColors('Ошибка при сохранении')
    } finally {
      setSavingColors(false)
    }
  }

  const handleResetColors = () => {
    setBookingColors(DEFAULT_BOOKING_COLORS)
    handleSaveColors(DEFAULT_BOOKING_COLORS)
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
        <h2 style={{ marginTop: 0, marginBottom: 20, color: '#eee', fontSize: 18 }}>О себе</h2>

        <div style={{ marginBottom: 20 }}>
          <label style={{ display: 'block', color: '#aaa', fontSize: 13, marginBottom: 6 }}>
            Информация о себе
          </label>
          <textarea
            style={{ ...inputStyle, resize: 'vertical', minHeight: 80 }}
            placeholder="Расскажите немного о себе..."
            value={bioInput}
            maxLength={500}
            onChange={e => { setBioInput(e.target.value); setSavedBio(false) }}
          />
          <div style={{ color: '#666', fontSize: 12, marginTop: 6 }}>
            Будет отображаться в таблице игроков клуба. Максимум 500 символов.
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <button
            style={{ ...btnStyle, background: '#e94560', opacity: savingBio ? 0.7 : 1 }}
            onClick={handleSaveBio}
            disabled={savingBio}
          >
            {savingBio ? 'Сохраняем...' : 'Сохранить'}
          </button>
          {savedBio && <span style={{ color: '#4caf50', fontSize: 14 }}>✓ Сохранено</span>}
          {errorBio && <span style={{ color: '#e94560', fontSize: 14 }}>{errorBio}</span>}
        </div>
      </div>

      <div style={cardStyle}>
        <h2 style={{ marginTop: 0, marginBottom: 20, color: '#eee', fontSize: 18 }}>Город</h2>

        <div style={{ marginBottom: 20 }}>
          <label style={{ display: 'block', color: '#aaa', fontSize: 13, marginBottom: 6 }}>
            Ваш город
          </label>
          <input
            style={inputStyle}
            type="text"
            placeholder="Например: Москва"
            value={cityInput}
            maxLength={100}
            onChange={e => { setCityInput(e.target.value); setSavedCity(false) }}
          />
          <div style={{ color: '#666', fontSize: 12, marginTop: 6 }}>
            Будет отображаться в таблице игроков клуба. Максимум 100 символов.
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <button
            style={{ ...btnStyle, background: '#e94560', opacity: savingCity ? 0.7 : 1 }}
            onClick={handleSaveCity}
            disabled={savingCity}
          >
            {savingCity ? 'Сохраняем...' : 'Сохранить'}
          </button>
          {savedCity && <span style={{ color: '#4caf50', fontSize: 14 }}>✓ Сохранено</span>}
          {errorCity && <span style={{ color: '#e94560', fontSize: 14 }}>{errorCity}</span>}
        </div>
      </div>

      <div style={cardStyle}>
        <h3 style={{ marginTop: 0, color: '#aaa', fontSize: 15, fontWeight: 400 }}>
          Как вас сейчас видят другие:
        </h3>
        <div style={{ color: '#eee', fontSize: 20, fontWeight: 600 }}>👤 {effectiveName}</div>
      </div>

      <div style={{ ...cardStyle, maxWidth: 600, padding: 0, overflow: 'hidden' }}>
        <button
          aria-expanded={gsExpanded}
          aria-controls="gs-accordion-body"
          style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', background: 'none', border: 'none', cursor: 'pointer', padding: '16px 24px', color: '#eee' }}
          onClick={() => setGsExpanded(v => !v)}
        >
          <span style={{ fontSize: 18, fontWeight: 700 }}>🎲 Игровые системы</span>
          <span style={{ fontSize: 18, color: '#888' }}>{gsExpanded ? '▲' : '▼'}</span>
        </button>
        {gsExpanded && (
          <div id="gs-accordion-body" style={{ padding: '0 24px 24px' }}>
            <p style={{ color: '#aaa', fontSize: 13, marginTop: 0, marginBottom: 16 }}>
              Отметьте игровые системы, для которых другие игроки могут приглашать вас в партию.
              Если система не отмечена — вас нельзя выбрать напарником в этой системе.
            </p>
            <div style={{ marginBottom: 8 }}>
              {GAME_SYSTEMS_MAIN.map(gs => (
                <label key={gs} style={{ display: 'block', color: '#eee', fontSize: 14, padding: '5px 0', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={enabledGameSystems.includes(gs)}
                    onChange={() => toggleGameSystem(gs)}
                    style={{ marginRight: 8 }}
                  />
                  {gs}
                </label>
              ))}
            </div>
            <div style={{ borderTop: '1px solid #0f3460', paddingTop: 8, marginTop: 4 }}>
              {GAME_SYSTEMS_BOTTOM.map(gs => (
                <label key={gs} style={{ display: 'block', color: '#eee', fontSize: 14, padding: '5px 0', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={enabledGameSystems.includes(gs)}
                    onChange={() => toggleGameSystem(gs)}
                    style={{ marginRight: 8 }}
                  />
                  {gs}
                </label>
              ))}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', marginTop: 16 }}>
              <button
                style={{ ...btnStyle, background: '#e94560', opacity: savingGS ? 0.7 : 1 }}
                onClick={handleSaveGameSystems}
                disabled={savingGS}
              >
                {savingGS ? 'Сохраняем...' : 'Сохранить'}
              </button>
              {savedGS && <span style={{ color: '#4caf50', fontSize: 14 }}>✓ Сохранено</span>}
              {errorGS && <span style={{ color: '#e94560', fontSize: 14 }}>{errorGS}</span>}
            </div>
          </div>
        )}
      </div>
      <div style={{ ...cardStyle, maxWidth: 600, padding: 0, overflow: 'hidden' }}>
        <button
          aria-expanded={colorsExpanded}
          aria-controls="colors-accordion-body"
          style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', background: 'none', border: 'none', cursor: 'pointer', padding: '16px 24px', color: '#eee' }}
          onClick={() => setColorsExpanded(v => !v)}
        >
          <span style={{ fontSize: 18, fontWeight: 700 }}>🎨 Цвета бронирования</span>
          <span style={{ fontSize: 18, color: '#888' }}>{colorsExpanded ? '▲' : '▼'}</span>
        </button>
        {colorsExpanded && (
          <div id="colors-accordion-body" style={{ padding: '0 24px 24px' }}>
            <p style={{ color: '#aaa', fontSize: 13, marginTop: 0, marginBottom: 16 }}>
              Настройте цвета, которыми обозначаются слоты на временной шкале столов.
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 20 }}>
              {(Object.keys(DEFAULT_BOOKING_COLORS) as (keyof BookingColors)[]).map(key => (
                <label key={key} style={{ display: 'flex', alignItems: 'center', gap: 10, color: '#eee', fontSize: 14 }}>
                  <input
                    type="color"
                    value={bookingColors[key]}
                    onChange={e => { setBookingColors(prev => ({ ...prev, [key]: e.target.value })); setSavedColors(false) }}
                    style={{ width: 36, height: 28, border: 'none', borderRadius: 4, cursor: 'pointer', background: 'none', padding: 0 }}
                  />
                  <span style={{ display: 'inline-block', width: 16, height: 16, borderRadius: 3, background: bookingColors[key], border: '1px solid #555', flexShrink: 0 }} />
                  {BOOKING_COLORS_LABELS[key]}
                </label>
              ))}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
              <button
                style={{ ...btnStyle, background: '#e94560', opacity: savingColors ? 0.7 : 1 }}
                onClick={() => handleSaveColors(bookingColors)}
                disabled={savingColors}
              >
                {savingColors ? 'Сохраняем...' : 'Сохранить'}
              </button>
              <button
                style={{ ...btnStyle, background: '#0f3460' }}
                onClick={handleResetColors}
                disabled={savingColors}
              >
                По умолчанию
              </button>
              {savedColors && <span style={{ color: '#4caf50', fontSize: 14 }}>✓ Сохранено</span>}
              {errorColors && <span style={{ color: '#e94560', fontSize: 14 }}>{errorColors}</span>}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

