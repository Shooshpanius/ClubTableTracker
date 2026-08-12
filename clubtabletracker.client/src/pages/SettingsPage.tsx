import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { GAME_SYSTEMS_MAIN, GAME_SYSTEMS_BOTTOM, DEFAULT_BOOKING_COLORS, BOOKING_COLORS_LABELS } from '../constants'
import type { BookingColors } from '../constants'
import { isTokenExpired } from '../utils/auth'
import { GoogleLogin } from '@react-oauth/google'
import { isGoogleConfigured } from '../oauthConfig'
import { Button, Dataslate, Badge } from '../components/ui'

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

  const [bioInput, setBioInput] = useState('')
  const [savingBio, setSavingBio] = useState(false)
  const [savedBio, setSavedBio] = useState(false)
  const [errorBio, setErrorBio] = useState('')

  const [cityInput, setCityInput] = useState('')
  const [savingCity, setSavingCity] = useState(false)
  const [savedCity, setSavedCity] = useState(false)
  const [errorCity, setErrorCity] = useState('')

  const [googleLinked, setGoogleLinked] = useState(false)
  const [yandexLinked, setYandexLinked] = useState(false)
  const [linking, setLinking] = useState(false)
  const [linkError, setLinkError] = useState('')
  const [linkSuccess, setLinkSuccess] = useState('')

  useEffect(() => {
    if (!token || isTokenExpired(token)) {
      localStorage.removeItem('token')
      navigate('/')
      return
    }
    fetch('/api/user/me', { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then(data => {
        setGoogleName(data.name || '')
        setGoogleLinked(!!data.googleLinked)
        setYandexLinked(!!data.yandexLinked)
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

  const handleLinkGoogle = async (credential: string) => {
    setLinking(true)
    setLinkError('')
    setLinkSuccess('')
    try {
      const res = await fetch('/api/auth/link-google', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ credential }),
      })
      if (res.ok) {
        const data = await res.json()
        if (data.token) localStorage.setItem('token', data.token)
        setGoogleLinked(true)
        if (data.user?.name) setGoogleName(data.user.name)
        setLinkSuccess('Google-аккаунт привязан')
      } else {
        const text = await res.text()
        setLinkError(text || 'Не удалось привязать Google-аккаунт')
      }
    } catch {
      setLinkError('Сетевая ошибка при привязке')
    } finally {
      setLinking(false)
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
    <div className="gd-app">
      <div className="gd-settings-container">
        {/* Header */}
        <div className="gd-flex-between" style={{ marginBottom: 'var(--gd-s8)' }}>
          <div>
            <h1 className="gd-h1">Когитатор</h1>
            <p className="gd-text-xs gd-text-muted">Настройки профиля и предпочтений</p>
          </div>
          <Button variant="secondary" size="sm" onClick={() => navigate('/')}>← К клубам</Button>
        </div>

        <div className="gd-section-grid">
          {/* ── Profile ── */}
          <Dataslate>
            <h2 className="gd-h2 gd-mb-4">Профиль воина</h2>
            <div className="gd-form-row">
              <label className="gd-form-label">Имя из аккаунта</label>
              <div className="gd-text-sm" style={{ padding: '8px 0' }}>{googleName || '—'}</div>
            </div>
            <div className="gd-form-row">
              <label className="gd-form-label">Имя для отображения</label>
              <input
                className="gd-input"
                type="text"
                placeholder={`Оставьте пустым, чтобы использовать «${googleName}»`}
                value={inputValue}
                maxLength={60}
                onChange={e => { setInputValue(e.target.value); setSaved(false) }}
              />
              <p className="gd-text-xs gd-text-muted gd-mt-2">Будет отображаться везде. Максимум 60 символов.</p>
            </div>
            <div className="gd-form-row">
              <label className="gd-form-label">О себе</label>
              <textarea
                className="gd-input"
                style={{ resize: 'vertical', minHeight: 80 }}
                placeholder="Расскажите о своём ордене…"
                value={bioInput}
                maxLength={500}
                onChange={e => { setBioInput(e.target.value); setSavedBio(false) }}
              />
              <p className="gd-text-xs gd-text-muted gd-mt-2">{bioInput.length} / 500 символов</p>
            </div>
            <div className="gd-form-row">
              <label className="gd-form-label">Город</label>
              <input
                className="gd-input"
                type="text"
                placeholder="Например: Москва"
                value={cityInput}
                maxLength={50}
                onChange={e => { setCityInput(e.target.value); setSavedCity(false) }}
              />
            </div>
            <div className="gd-flex-row gd-flex-wrap gd-gap-2">
              <Button variant="primary" size="sm" onClick={() => { void handleSave(); void handleSaveBio(); void handleSaveCity() }} disabled={saving || savingBio || savingCity}>
                {(saving || savingBio || savingCity) ? 'Сохраняем…' : 'Сохранить профиль'}
              </Button>
              {saved && <span className="gd-text-sm" style={{ color: 'var(--gd-success)' }}>✓ Имя</span>}
              {savedBio && <span className="gd-text-sm" style={{ color: 'var(--gd-success)' }}>✓ Био</span>}
              {savedCity && <span className="gd-text-sm" style={{ color: 'var(--gd-success)' }}>✓ Город</span>}
              {error && <span className="gd-text-sm" style={{ color: 'var(--gd-danger)' }}>{error}</span>}
              {errorBio && <span className="gd-text-sm" style={{ color: 'var(--gd-danger)' }}>{errorBio}</span>}
              {errorCity && <span className="gd-text-sm" style={{ color: 'var(--gd-danger)' }}>{errorCity}</span>}
            </div>
            <div style={{ marginTop: 'var(--gd-s4)', paddingTop: 'var(--gd-s4)', borderTop: '1px solid var(--gd-border)' }}>
              <p className="gd-text-xs gd-text-muted gd-mb-2">Как вас видят другие:</p>
              <div className="gd-h3 gd-text-brass">👤 {effectiveName}</div>
            </div>
          </Dataslate>

          {/* ── Game Systems ── */}
          <Dataslate>
            <h2 className="gd-h2 gd-mb-4">Игровые системы</h2>
            <p className="gd-text-xs gd-text-muted gd-mb-4">
              Отметьте системы, в которые играете — это влияет на подбор соперников.
            </p>
            <div className="gd-gs-check gd-mb-4">
              {[...GAME_SYSTEMS_MAIN, ...GAME_SYSTEMS_BOTTOM].map(gs => (
                <label key={gs} className="gd-gs-tag">
                  <input
                    type="checkbox"
                    checked={enabledGameSystems.includes(gs)}
                    onChange={() => toggleGameSystem(gs)}
                  />
                  {gs}
                </label>
              ))}
            </div>
            <div className="gd-flex-row gd-gap-2">
              <Button variant="primary" size="sm" onClick={() => void handleSaveGameSystems()} disabled={savingGS}>
                {savingGS ? 'Сохраняем…' : 'Сохранить системы'}
              </Button>
              {savedGS && <span className="gd-text-sm" style={{ color: 'var(--gd-success)' }}>✓ Сохранено</span>}
              {errorGS && <span className="gd-text-sm" style={{ color: 'var(--gd-danger)' }}>{errorGS}</span>}
            </div>
          </Dataslate>

          {/* ── Booking Colors ── */}
          <Dataslate>
            <h2 className="gd-h2 gd-mb-4">Цвета брони</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--gd-s3)', marginBottom: 'var(--gd-s4)' }}>
              {(Object.keys(DEFAULT_BOOKING_COLORS) as (keyof BookingColors)[]).map(key => (
                <div key={key}>
                  <label className="gd-form-label">{BOOKING_COLORS_LABELS[key]}</label>
                  <div className="gd-flex-row gd-gap-2 gd-mt-2">
                    <input
                      type="color"
                      value={bookingColors[key]}
                      onChange={e => { setBookingColors(prev => ({ ...prev, [key]: e.target.value })); setSavedColors(false) }}
                      style={{ width: 36, height: 28, border: 'none', cursor: 'pointer', background: 'none', padding: 0 }}
                    />
                    <span style={{ display: 'inline-block', width: 16, height: 16, borderRadius: 3, background: bookingColors[key], border: '1px solid var(--gd-border)', flexShrink: 0 }} />
                  </div>
                </div>
              ))}
            </div>
            <div className="gd-flex-row gd-flex-wrap gd-gap-2">
              <Button variant="primary" size="sm" onClick={() => void handleSaveColors(bookingColors)} disabled={savingColors}>
                {savingColors ? 'Сохраняем…' : 'Сохранить цвета'}
              </Button>
              <Button variant="secondary" size="sm" onClick={handleResetColors} disabled={savingColors}>
                По умолчанию
              </Button>
              {savedColors && <span className="gd-text-sm" style={{ color: 'var(--gd-success)' }}>✓ Сохранено</span>}
              {errorColors && <span className="gd-text-sm" style={{ color: 'var(--gd-danger)' }}>{errorColors}</span>}
            </div>
          </Dataslate>

          {/* ── Linked accounts ── */}
          <Dataslate>
            <h2 className="gd-h2 gd-mb-4">Способы входа</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--gd-s2)' }}>
              <div className="gd-provider-row">
                <span className="name">Яндекс</span>
                {yandexLinked
                  ? <Badge tone="success">Привязан ✓</Badge>
                  : <Badge tone="brass">Не привязан</Badge>}
              </div>
              <div className="gd-provider-row">
                <span className="name">Google</span>
                {googleLinked
                  ? <Badge tone="success">Привязан ✓</Badge>
                  : <Badge tone="brass">Не привязан</Badge>}
              </div>
            </div>
            {!googleLinked && isGoogleConfigured && (
              <div style={{ marginTop: 'var(--gd-s4)', display: 'flex', flexDirection: 'column', gap: 'var(--gd-s2)', alignItems: 'flex-start' }}>
                <GoogleLogin
                  onSuccess={cred => { if (cred.credential) void handleLinkGoogle(cred.credential) }}
                  onError={() => setLinkError('Не удалось получить Google-креденшал')}
                  text="continue_with"
                  width={280}
                />
                {linking && <span className="gd-text-sm gd-text-muted">Привязываем…</span>}
                {linkSuccess && <span className="gd-text-sm" style={{ color: 'var(--gd-success)' }}>{linkSuccess}</span>}
                {linkError && <span className="gd-text-sm" style={{ color: 'var(--gd-danger)' }}>{linkError}</span>}
              </div>
            )}
            {googleLinked && (
              <p className="gd-text-sm gd-text-muted gd-mt-4">
                Google-аккаунт привязан. Вход доступен и по Google, и по Яндексу.
              </p>
            )}
          </Dataslate>

          {/* ── Danger zone ── */}
          <Dataslate style={{ gridColumn: '1 / -1', borderColor: 'rgba(196, 40, 59, 0.3)' }}>
            <div className="gd-flex-between">
              <div>
                <h2 className="gd-h2" style={{ color: 'var(--gd-danger)' }}>Опасная зона</h2>
                <p className="gd-text-xs gd-text-muted">Выход из аккаунта. Все несохранённые данные будут потеряны.</p>
              </div>
              <Button variant="danger" size="sm" onClick={() => {
                localStorage.removeItem('token')
                navigate('/login', { replace: true })
              }}>Исторгнуть</Button>
            </div>
          </Dataslate>
        </div>
      </div>
    </div>
  )
}

