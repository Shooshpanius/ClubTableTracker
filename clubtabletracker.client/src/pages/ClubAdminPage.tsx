import { Fragment, useState, useEffect } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import ClubMapEditor from '../components/ClubMapEditor'
import CampaignMapEditor from '../components/CampaignMapEditor'
import { Button, Dataslate, Badge, GothicDivider } from '../components/ui'
import { GAME_SYSTEMS_MAIN, GAME_SYSTEMS_BOTTOM, ALL_GAME_SYSTEMS } from '../constants'
import { getAttachmentDisplayName } from '../utils/attachmentName'
import { isTokenExpired } from '../utils/auth'

interface ClubInfo {
  id: number; name: string; description: string; openTime: string; closeTime: string; logoUrl?: string; shortName?: string; badgeColor?: string;
}
interface Membership { id: number; status: string; isModerator: boolean; hasKey: boolean; isAdmin: boolean; appliedAt: string; isManualEntry: boolean; user: { id: string; name: string; email: string; enabledGameSystems?: string; city?: string } }
interface GameTable { id: number; clubId: number; number: string; size: string; supportedGames: string; x: number; y: number; width: number; height: number; eventsOnly: boolean }
interface ClubEventData { id: number; title: string; startTime: string; endTime: string; maxParticipants: number; eventType: string; gameSystem?: string; tableIds?: string; description?: string; regulationUrl?: string; regulationUrl2?: string; missionMapUrl?: string; gameMasterId?: string; gameMasterName?: string; status?: string | null; participants: { id: string; name: string; place?: number | null }[] }
interface ClubDecoration { id: number; type: 'wall' | 'window' | 'door'; x: number; y: number; width: number; height: number }

export default function ClubAdminPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const urlClubId = searchParams.get('clubId')
  const [clubKey, setClubKey] = useState(sessionStorage.getItem('clubKey') || '')
  const [adminClubId, setAdminClubId] = useState<number | null>(urlClubId ? parseInt(urlClubId) : null)
  const [token] = useState(() => {
    const stored = localStorage.getItem('token') || ''
    if (stored && isTokenExpired(stored)) {
      localStorage.removeItem('token')
      return ''
    }
    return stored
  })
  const [club, setClub] = useState<ClubInfo | null>(null)
  const [tables, setTables] = useState<GameTable[]>([])
  const [decorations, setDecorations] = useState<ClubDecoration[]>([])
  const [memberships, setMemberships] = useState<Membership[]>([])
  const [error, setError] = useState('')
  const [tab, setTab] = useState<'map' | 'members' | 'settings' | 'events' | 'gallery' | 'chats'>('map')
  const [editingTable, setEditingTable] = useState<Partial<GameTable> | null>(null)
  const [selectedGames, setSelectedGames] = useState<string[]>([])
  const [openTime, setOpenTime] = useState('10:00')
  const [closeTime, setCloseTime] = useState('22:00')
  const [shortName, setShortName] = useState('')
  const [badgeColor, setBadgeColor] = useState('#c4a35a')
  const [settingsSaved, setSettingsSaved] = useState(false)
  const [events, setEvents] = useState<ClubEventData[]>([])
  const [newEvent, setNewEvent] = useState({ title: '', startTime: '', endTime: '', maxParticipants: 8, eventType: 'Tournament', gameSystem: '', tableIds: '', description: '', gameMasterId: '' })
  const [selectedEventTables, setSelectedEventTables] = useState<number[]>([])
  const [showEventForm, setShowEventForm] = useState(false)
  const [editingEventId, setEditingEventId] = useState<number | null>(null)
  const [editingEventStartTime, setEditingEventStartTime] = useState('')
  const [editingEventEndTime, setEditingEventEndTime] = useState('')
  const [editingEventDateError, setEditingEventDateError] = useState('')
  const [inviteEventId, setInviteEventId] = useState<number | null>(null)
  const [inviteUserId, setInviteUserId] = useState('')
  const [editingTablesEventId, setEditingTablesEventId] = useState<number | null>(null)
  const [editingTablesValue, setEditingTablesValue] = useState<number[]>([])
  const [resultsEventId, setResultsEventId] = useState<number | null>(null)
  const [resultsPlaces, setResultsPlaces] = useState<Record<string, number | ''>>({})
  const [resultsError, setResultsError] = useState('')
  const [showArchive, setShowArchive] = useState(false)
  const [editingTitleEventId, setEditingTitleEventId] = useState<number | null>(null)
  const [editingTitleValue, setEditingTitleValue] = useState('')
  const [editingDescEventId, setEditingDescEventId] = useState<number | null>(null)
  const [editingDescValue, setEditingDescValue] = useState('')
  const [regulationUploading, setRegulationUploading] = useState<number | null>(null)
  const [regulation2Uploading, setRegulation2Uploading] = useState<number | null>(null)
  const [missionMapUploading, setMissionMapUploading] = useState<number | null>(null)
  const [expandedGsMemberId, setExpandedGsMemberId] = useState<number | null>(null)
  const [memberGameSystems, setMemberGameSystems] = useState<Record<number, string[]>>({})
  const [savingGsMemberId, setSavingGsMemberId] = useState<number | null>(null)
  const [expandedCityMemberId, setExpandedCityMemberId] = useState<number | null>(null)
  const [editingCityValue, setEditingCityValue] = useState('')
  const [savingCityMemberId, setSavingCityMemberId] = useState<number | null>(null)
  const [cityError, setCityError] = useState('')
  const [showAddManualForm, setShowAddManualForm] = useState(false)
  const [manualName, setManualName] = useState('')
  const [manualEmail, setManualEmail] = useState('')
  const [addManualError, setAddManualError] = useState('')
  const [editingManualMemberId, setEditingManualMemberId] = useState<number | null>(null)
  const [editingManualName, setEditingManualName] = useState('')
  const [editingManualEmail, setEditingManualEmail] = useState('')
  const [editingManualError, setEditingManualError] = useState('')
  const [logoUploading, setLogoUploading] = useState(false)
  const [logoError, setLogoError] = useState('')
  const [galleryPhotos, setGalleryPhotos] = useState<{ id: number; url: string; orderIndex: number }[]>([])
  const [galleryUploading, setGalleryUploading] = useState(false)
  const [galleryError, setGalleryError] = useState('')
  const [campaignMapEditorEvent, setCampaignMapEditorEvent] = useState<ClubEventData | null>(null)
  const [groupChats, setGroupChats] = useState<{ id: number; name: string; isPublic: boolean; logoUrl?: string; createdAt: string; members: { userId: string; name: string }[] }[]>([])
  const [newChatName, setNewChatName] = useState('')
  const [newChatIsPublic, setNewChatIsPublic] = useState(false)
  const [chatError, setChatError] = useState('')
  const [addMemberChatId, setAddMemberChatId] = useState<number | null>(null)
  const [addMemberUserId, setAddMemberUserId] = useState('')

  // Helper: returns auth headers based on current mode (key-based or admin-role-based)
  const authH = (): Record<string, string> => {
    if (adminClubId && token) {
      return { 'Authorization': `Bearer ${token}`, 'X-Club-Id': String(adminClubId) }
    }
    return { 'X-Club-Key': clubKey }
  }

  const login = async () => {
    // Admin-role-based login
    if (adminClubId && token) {
      const res = await fetch('/api/clubadmin/me', { headers: authH() })
      if (res.ok) {
        const data = await res.json()
        setClub(data)
        setOpenTime(data.openTime || '10:00')
        setCloseTime(data.closeTime || '22:00')
        setShortName(data.shortName || '')
        setBadgeColor(data.badgeColor || '#c4a35a')
        setError('')
        loadData()
      } else {
        setError('Нет прав администратора')
        setAdminClubId(null)
      }
      return
    }
    // Key-based login
    sessionStorage.setItem('clubKey', clubKey)
    const res = await fetch('/api/clubadmin/me', { headers: authH() })
    if (res.ok) {
      const data = await res.json()
      setClub(data)
      setOpenTime(data.openTime || '10:00')
      setCloseTime(data.closeTime || '22:00')
      setShortName(data.shortName || '')
      setBadgeColor(data.badgeColor || '#c4a35a')
      setError('')
      loadData()
    } else {
      setError('Invalid club key')
    }
  }

  const loadData = async () => {
    const h = authH()
    const [tablesRes, membRes, eventsRes, decorationsRes, galleryRes, chatsRes] = await Promise.all([
      fetch('/api/clubadmin/tables', { headers: h }),
      fetch('/api/clubadmin/memberships', { headers: h }),
      fetch('/api/clubadmin/events', { headers: h }),
      fetch('/api/clubadmin/decorations', { headers: h }),
      fetch('/api/clubadmin/gallery', { headers: h }),
      fetch('/api/clubadmin/chats', { headers: h })
    ])
    if (tablesRes.ok) setTables(await tablesRes.json())
    if (membRes.ok) setMemberships(await membRes.json())
    if (eventsRes.ok) setEvents(await eventsRes.json())
    if (decorationsRes.ok) setDecorations(await decorationsRes.json())
    if (galleryRes.ok) setGalleryPhotos(await galleryRes.json())
    if (chatsRes.ok) setGroupChats(await chatsRes.json())
  }

  useEffect(() => {
    if (adminClubId && token) {
      login()
    } else if (clubKey) {
      login()
    }
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
        method: 'PUT', headers: { 'Content-Type': 'application/json', ...authH() },
        body: JSON.stringify(body)
      })
      if (res.ok) { const t = await res.json(); setTables(tables.map(x => x.id === t.id ? t : x)) }
    } else {
      const res = await fetch('/api/clubadmin/tables', {
        method: 'POST', headers: { 'Content-Type': 'application/json', ...authH() },
        body: JSON.stringify(body)
      })
      if (res.ok) { setTables([...tables, await res.json()]) }
    }
    setEditingTable(null)
    setSelectedGames([])
  }

  const deleteTable = async (id: number) => {
    await fetch(`/api/clubadmin/tables/${id}`, { method: 'DELETE', headers: authH() })
    setTables(tables.filter(t => t.id !== id))
  }

  const copyTable = async (id: number) => {
    const res = await fetch(`/api/clubadmin/tables/${id}/copy`, { method: 'POST', headers: authH() })
    if (res.ok) { setTables([...tables, await res.json()]) }
  }

  const updateMembership = async (id: number, action: 'approve' | 'reject') => {
    const res = await fetch(`/api/clubadmin/memberships/${id}/${action}`, {
      method: 'POST', headers: authH()
    })
    if (res.ok) setMemberships(memberships.map(m => m.id === id ? { ...m, status: action === 'approve' ? 'Approved' : 'Rejected' } : m))
  }

  const kickMember = async (id: number) => {
    const res = await fetch(`/api/clubadmin/memberships/${id}/kick`, {
      method: 'POST', headers: authH()
    })
    if (res.ok) setMemberships(memberships.map(m => m.id === id ? { ...m, status: 'Kicked', isModerator: false } : m))
  }

  const toggleModerator = async (id: number, currentValue: boolean) => {
    const res = await fetch(`/api/clubadmin/memberships/${id}/set-moderator`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authH() },
      body: JSON.stringify({ isModerator: !currentValue })
    })
    if (res.ok) setMemberships(memberships.map(m => m.id === id ? { ...m, isModerator: !currentValue } : m))
  }

  const toggleKey = async (id: number, currentValue: boolean) => {
    const res = await fetch(`/api/clubadmin/memberships/${id}/set-key`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authH() },
      body: JSON.stringify({ hasKey: !currentValue })
    })
    if (res.ok) setMemberships(memberships.map(m => m.id === id ? { ...m, hasKey: !currentValue } : m))
  }

  const toggleAdmin = async (id: number, currentValue: boolean) => {
    const res = await fetch(`/api/clubadmin/memberships/${id}/set-admin`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authH() },
      body: JSON.stringify({ isAdmin: !currentValue })
    })
    if (res.ok) setMemberships(memberships.map(m => m.id === id ? { ...m, isAdmin: !currentValue } : m))
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
      headers: { 'Content-Type': 'application/json', ...authH() },
      body: JSON.stringify({ enabledGameSystems: systems })
    })
    if (res.ok) {
      const data = await res.json()
      setMemberships(memberships.map(m => m.id === memberId ? { ...m, user: { ...m.user, enabledGameSystems: data.enabledGameSystems } } : m))
    }
    setSavingGsMemberId(null)
  }

  const toggleCityEditor = (m: Membership) => {
    if (expandedCityMemberId === m.id) {
      setExpandedCityMemberId(null)
      setCityError('')
    } else {
      setExpandedCityMemberId(m.id)
      setEditingCityValue(m.user.city || '')
      setCityError('')
    }
  }

  const saveMemberCity = async (memberId: number) => {
    setSavingCityMemberId(memberId)
    setCityError('')
    const res = await fetch(`/api/clubadmin/memberships/${memberId}/city`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', ...authH() },
      body: JSON.stringify({ city: editingCityValue.trim() || null })
    })
    if (res.ok) {
      const data = await res.json()
      setMemberships(memberships.map(m => m.id === memberId ? { ...m, user: { ...m.user, city: data.city ?? undefined } } : m))
      setExpandedCityMemberId(null)
    } else {
      const text = await res.text()
      setCityError(text || 'Ошибка при сохранении города')
    }
    setSavingCityMemberId(null)
  }

  const addManualMember = async () => {
    if (!manualName.trim()) { setAddManualError('Имя не может быть пустым'); return }
    const res = await fetch('/api/clubadmin/memberships/manual', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authH() },
      body: JSON.stringify({ name: manualName.trim(), email: manualEmail.trim() || null })
    })
    if (res.ok) {
      const m = await res.json()
      setMemberships([...memberships, m])
      setManualName('')
      setManualEmail('')
      setAddManualError('')
      setShowAddManualForm(false)
    } else {
      const text = await res.text()
      setAddManualError(text || 'Ошибка при добавлении')
    }
  }

  const startEditManualMember = (m: Membership) => {
    setEditingManualMemberId(m.id)
    setEditingManualName(m.user.name)
    setEditingManualEmail(m.user.email)
    setEditingManualError('')
  }

  const saveManualMemberEdit = async (id: number) => {
    if (!editingManualName.trim()) { setEditingManualError('Имя не может быть пустым'); return }
    const res = await fetch(`/api/clubadmin/memberships/${id}/manual`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', ...authH() },
      body: JSON.stringify({ name: editingManualName.trim(), email: editingManualEmail.trim() || null })
    })
    if (res.ok) {
      const updated = await res.json()
      setMemberships(memberships.map(m => m.id === id ? { ...m, user: { ...m.user, name: updated.user.name, email: updated.user.email } } : m))
      setEditingManualMemberId(null)
      setEditingManualError('')
    } else {
      const text = await res.text()
      setEditingManualError(text || 'Ошибка при сохранении')
    }
  }

  const saveSettings = async () => {
    const res = await fetch('/api/clubadmin/settings', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', ...authH() },
      body: JSON.stringify({
        openTime, closeTime,
        shortName: shortName.trim() || null,
        badgeColor: badgeColor || null,
      })
    })
    if (res.ok) {
      const data = await res.json()
      setClub(prev => prev ? {
        ...prev,
        openTime: data.openTime, closeTime: data.closeTime,
        shortName: data.shortName ?? undefined, badgeColor: data.badgeColor ?? undefined,
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
      tableIds: selectedEventTables.length > 0 ? selectedEventTables.join(',') : null,
      description: newEvent.description.trim() || null,
      gameMasterId: newEvent.gameMasterId || null
    }
    const res = await fetch('/api/clubadmin/events', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authH() },
      body: JSON.stringify(body)
    })
    if (res.ok) {
      const ev = await res.json()
      const gm = memberships.find(m => m.user.id === ev.gameMasterId)
      const gmName = gm ? gm.user.name : undefined
      const existingParticipants: { id: string; name: string }[] = Array.isArray(ev.participants) ? ev.participants : []
      const participants = ev.gameMasterId && !existingParticipants.some((p: { id: string }) => p.id === ev.gameMasterId)
        ? [...existingParticipants, { id: ev.gameMasterId, name: gmName ?? ev.gameMasterId }]
        : existingParticipants
      setEvents([...events, { ...ev, gameMasterName: gmName, participants }])
      setNewEvent({ title: '', startTime: '', endTime: '', maxParticipants: 8, eventType: 'Tournament', gameSystem: '', tableIds: '', description: '', gameMasterId: '' })
      setSelectedEventTables([])
      setShowEventForm(false)
    }
  }

  const deleteEvent = async (id: number) => {
    if (!confirm('Удалить событие?')) return
    const res = await fetch(`/api/clubadmin/events/${id}`, { method: 'DELETE', headers: authH() })
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
      headers: { 'Content-Type': 'application/json', ...authH() },
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

  const startEditingEventTables = (ev: ClubEventData) => {
    setEditingTablesEventId(ev.id)
    setEditingTablesValue(ev.tableIds ? ev.tableIds.split(',').map(id => parseInt(id)).filter(n => !isNaN(n)) : [])
  }

  const saveEventTables = async (id: number) => {
    const res = await fetch(`/api/clubadmin/events/${id}/tables`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', ...authH() },
      body: JSON.stringify({ tableIds: editingTablesValue })
    })
    if (res.ok) {
      const data = await res.json()
      setEvents(events.map(e => e.id === id ? { ...e, tableIds: data.tableIds } : e))
      setEditingTablesEventId(null)
    } else {
      const text = await res.text()
      alert(text || 'Ошибка при сохранении столов')
    }
  }

  const startEditingResults = (ev: ClubEventData) => {
    setResultsEventId(ev.id)
    setResultsError('')
    const places: Record<string, number | ''> = {}
    ev.participants.forEach(p => { places[p.id] = p.place ?? '' })
    setResultsPlaces(places)
  }

  const saveEventResults = async (id: number) => {
    const results = Object.entries(resultsPlaces)
      .filter(([, place]) => place !== '' && place !== null)
      .map(([userId, place]) => ({ userId, place: place as number }))
    const seen = new Set<number>()
    for (const r of results) {
      if (r.place < 1) { setResultsError('Место должно быть не меньше 1'); return }
      if (seen.has(r.place)) { setResultsError(`Место ${r.place} указано более чем одному участнику`); return }
      seen.add(r.place)
    }
    const res = await fetch(`/api/clubadmin/events/${id}/results`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', ...authH() },
      body: JSON.stringify({ results })
    })
    if (res.ok) {
      const data = await res.json()
      setEvents(events.map(e => e.id === id
        ? { ...e, status: data.status ?? e.status, participants: e.participants.map(p => ({ ...p, place: resultsPlaces[p.id] === '' ? null : Number(resultsPlaces[p.id]) || null })) }
        : e))
      setResultsEventId(null)
      setResultsError('')
    } else {
      const text = await res.text()
      setResultsError(text || 'Ошибка при сохранении итогов')
    }
  }

  const completeEvent = async (id: number) => {
    const res = await fetch(`/api/clubadmin/events/${id}/complete`, { method: 'POST', headers: authH() })
    if (res.ok) {
      const data = await res.json()
      setEvents(events.map(e => e.id === id ? { ...e, status: data.status } : e))
    } else {
      const text = await res.text()
      alert(text || 'Ошибка')
    }
  }

  const archiveEvent = async (id: number) => {
    const res = await fetch(`/api/clubadmin/events/${id}/archive`, { method: 'POST', headers: authH() })
    if (res.ok) {
      const data = await res.json()
      setEvents(events.map(e => e.id === id ? { ...e, status: data.status } : e))
    } else {
      const text = await res.text()
      alert(text || 'Ошибка')
    }
  }

  const inviteParticipant = async (eventId: number) => {
    if (!inviteUserId) return
    const res = await fetch(`/api/clubadmin/events/${eventId}/participants/${encodeURIComponent(inviteUserId)}`, {
      method: 'POST', headers: authH()
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
      method: 'DELETE', headers: authH()
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
      headers: { 'Content-Type': 'application/json', ...authH() },
      body: JSON.stringify({ title: trimmed })
    })
    if (res.ok) {
      const data = await res.json()
      setEvents(events.map(e => e.id === id ? { ...e, title: data.title } : e))
      setEditingTitleEventId(null)
    }
  }

  const saveEventDescription = async (id: number) => {
    const res = await fetch(`/api/clubadmin/events/${id}/description`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', ...authH() },
      body: JSON.stringify({ description: editingDescValue.trim() || null })
    })
    if (res.ok) {
      const data = await res.json()
      setEvents(events.map(e => e.id === id ? { ...e, description: data.description } : e))
      setEditingDescEventId(null)
    }
  }

  const uploadRegulation = async (id: number, file: File) => {
    setRegulationUploading(id)
    const formData = new FormData()
    formData.append('file', file)
    const res = await fetch(`/api/clubadmin/events/${id}/regulation`, {
      method: 'POST',
      headers: authH(),
      body: formData
    })
    if (res.ok) {
      const data = await res.json()
      setEvents(events.map(e => e.id === id ? { ...e, regulationUrl: data.regulationUrl } : e))
    }
    setRegulationUploading(null)
  }

  const deleteRegulation = async (id: number) => {
    const res = await fetch(`/api/clubadmin/events/${id}/regulation`, {
      method: 'DELETE',
      headers: authH()
    })
    if (res.ok) setEvents(events.map(e => e.id === id ? { ...e, regulationUrl: undefined } : e))
  }

  const uploadRegulation2 = async (id: number, file: File) => {
    setRegulation2Uploading(id)
    const formData = new FormData()
    formData.append('file', file)
    const res = await fetch(`/api/clubadmin/events/${id}/regulation2`, {
      method: 'POST',
      headers: authH(),
      body: formData
    })
    if (res.ok) {
      const data = await res.json()
      setEvents(events.map(e => e.id === id ? { ...e, regulationUrl2: data.regulationUrl2 } : e))
    }
    setRegulation2Uploading(null)
  }

  const deleteRegulation2 = async (id: number) => {
    const res = await fetch(`/api/clubadmin/events/${id}/regulation2`, {
      method: 'DELETE',
      headers: authH()
    })
    if (res.ok) setEvents(events.map(e => e.id === id ? { ...e, regulationUrl2: undefined } : e))
  }

  const uploadMissionMap = async (id: number, file: File) => {
    setMissionMapUploading(id)
    const formData = new FormData()
    formData.append('file', file)
    const res = await fetch(`/api/clubadmin/events/${id}/missionmap`, {
      method: 'POST',
      headers: authH(),
      body: formData
    })
    if (res.ok) {
      const data = await res.json()
      setEvents(events.map(e => e.id === id ? { ...e, missionMapUrl: data.missionMapUrl } : e))
    }
    setMissionMapUploading(null)
  }

  const deleteMissionMap = async (id: number) => {
    const res = await fetch(`/api/clubadmin/events/${id}/missionmap`, {
      method: 'DELETE',
      headers: authH()
    })
    if (res.ok) setEvents(events.map(e => e.id === id ? { ...e, missionMapUrl: undefined } : e))
  }

  const updateTablePosition = async (id: number, x: number, y: number) => {
    const table = tables.find(t => t.id === id)
    if (!table) return
    const res = await fetch(`/api/clubadmin/tables/${id}`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json', ...authH() },
      body: JSON.stringify({ ...table, x, y, eventsOnly: table.eventsOnly })
    })
    if (res.ok) { const t = await res.json(); setTables(tables.map(x => x.id === t.id ? t : x)) }
  }

  const addDecoration = async (type: 'wall' | 'window' | 'door', x: number, y: number, width: number, height: number) => {
    const res = await fetch('/api/clubadmin/decorations', {
      method: 'POST', headers: { 'Content-Type': 'application/json', ...authH() },
      body: JSON.stringify({ type, x, y, width, height })
    })
    if (res.ok) { const d = await res.json(); setDecorations(prev => [...prev, d]) }
  }

  const moveDecoration = async (id: number, x: number, y: number) => {
    const deco = decorations.find(d => d.id === id)
    if (!deco) return
    const res = await fetch(`/api/clubadmin/decorations/${id}`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json', ...authH() },
      body: JSON.stringify({ ...deco, x, y })
    })
    if (res.ok) { const d = await res.json(); setDecorations(decorations.map(x => x.id === d.id ? d : x)) }
  }

  const deleteDecoration = async (id: number) => {
    await fetch(`/api/clubadmin/decorations/${id}`, { method: 'DELETE', headers: authH() })
    setDecorations(decorations.filter(d => d.id !== id))
  }

  const uploadLogo = async (file: File) => {
    setLogoUploading(true)
    setLogoError('')
    const formData = new FormData()
    formData.append('file', file)
    const res = await fetch('/api/clubadmin/logo', {
      method: 'POST',
      headers: authH(),
      body: formData
    })
    if (res.ok) {
      const data = await res.json()
      setClub(prev => prev ? { ...prev, logoUrl: data.logoUrl } : prev)
    } else {
      const text = await res.text()
      setLogoError(text || 'Ошибка при загрузке лого')
    }
    setLogoUploading(false)
  }

  const deleteLogo = async () => {
    const res = await fetch('/api/clubadmin/logo', { method: 'DELETE', headers: authH() })
    if (res.ok) setClub(prev => prev ? { ...prev, logoUrl: undefined } : prev)
  }

  const uploadGalleryPhoto = async (file: File) => {
    setGalleryUploading(true)
    setGalleryError('')
    const formData = new FormData()
    formData.append('file', file)
    const res = await fetch('/api/clubadmin/gallery', {
      method: 'POST',
      headers: authH(),
      body: formData
    })
    if (res.ok) {
      const photo = await res.json()
      setGalleryPhotos(prev => [...prev, photo])
    } else {
      const text = await res.text()
      setGalleryError(text || 'Ошибка при загрузке фото')
    }
    setGalleryUploading(false)
  }

  const deleteGalleryPhoto = async (id: number) => {
    const res = await fetch(`/api/clubadmin/gallery/${id}`, { method: 'DELETE', headers: authH() })
    if (res.ok) setGalleryPhotos(prev => prev.filter(p => p.id !== id))
  }

  const membershipStatusLabel = (status: string) => status === 'Kicked' ? 'Исключён' : status

  if (!club) {
    // Admin-role-based access: auto-login in progress or failed
    if (adminClubId && token) {
      return (
        <div className="gd-app gd-admin-login">
          <h1 className="gd-admin-title">Панель управления</h1>
          <GothicDivider />
          {error
            ? <Dataslate>
                <p className="gd-error-text">{error}</p>
                <Button variant="secondary" size="sm" onClick={() => { setAdminClubId(null); setError('') }}>Войти по ключу</Button>
              </Dataslate>
            : <p className="gd-text-muted">Авторизация…</p>
          }
        </div>
      )
    }
    // Key-based login form
    return (
      <div className="gd-app gd-admin-login">
        <h1 className="gd-admin-title">Панель управления</h1>
        <GothicDivider />
        <Dataslate title="Доступ по ключу">
          <input className="gd-input" type="password" placeholder="Ключ доступа к клубу"
            value={clubKey} onChange={e => setClubKey(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && login()} />
          <Button onClick={login}>Войти</Button>
          {error && <p className="gd-error-text">{error}</p>}
        </Dataslate>
      </div>
    )
  }

  return (
    <>
    <div className="gd-app gd-admin-container">
      <div className="gd-flex-between gd-flex-wrap" style={{ gap: 'var(--gd-s3)', marginBottom: 'var(--gd-s4)' }}>
        <div>
          <h1 className="gd-admin-title">{club.name}</h1>
          <p className="gd-admin-sub">Панель управления · Магистр</p>
        </div>
        <Button variant="secondary" size="sm" onClick={() => navigate(`/club/${club.id}`)}>← К клубу</Button>
      </div>
      <GothicDivider />
      <div className="gd-tabs">
        <button className={`gd-tab${tab === 'map' ? ' active' : ''}`} onClick={() => setTab('map')}>Столы</button>
        <button className={`gd-tab${tab === 'members' ? ' active' : ''}`} onClick={() => setTab('members')}>
          Участники{memberships.filter(m => m.status === 'Pending').length > 0 && <span className="gd-tab-cnt">{memberships.filter(m => m.status === 'Pending').length}</span>}
        </button>
        <button className={`gd-tab${tab === 'events' ? ' active' : ''}`} onClick={() => setTab('events')}>
          События{events.length > 0 && <span className="gd-tab-cnt">{events.length}</span>}
        </button>
        <button className={`gd-tab${tab === 'settings' ? ' active' : ''}`} onClick={() => setTab('settings')}>Настройки</button>
        <button className={`gd-tab${tab === 'gallery' ? ' active' : ''}`} onClick={() => setTab('gallery')}>
          Галерея{galleryPhotos.length > 0 && <span className="gd-tab-cnt">{galleryPhotos.length}</span>}
        </button>
        <button className={`gd-tab${tab === 'chats' ? ' active' : ''}`} onClick={() => setTab('chats')}>
          Чаты{groupChats.length > 0 && <span className="gd-tab-cnt">{groupChats.length}</span>}
        </button>
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
          <Dataslate style={{ marginTop: 'var(--gd-s4)' }}>
            <h3 className="gd-h3">Добавить стол</h3>
            <Button size="sm" onClick={() => { setEditingTable({ number: '', size: 'Medium', x: 50, y: 50, width: 100, height: 60, eventsOnly: false }); setSelectedGames([]) }}>+ Добавить стол</Button>
          </Dataslate>
          {editingTable && (
            <Dataslate style={{ borderColor: 'var(--gd-blood-red)' }}>
              <h3 className="gd-h3">{editingTable.id ? 'Редактировать стол' : 'Новый стол'}</h3>
              <div className="gd-flex-row gd-flex-wrap" style={{ gap: 'var(--gd-s2)', marginBottom: 'var(--gd-s3)' }}>
                <input className="gd-input" placeholder="Номер" value={editingTable.number || ''} onChange={e => setEditingTable({ ...editingTable, number: e.target.value })} />
                <select className="gd-input gd-select" value={editingTable.size || 'Medium'} onChange={e => setEditingTable({ ...editingTable, size: e.target.value })}>
                  <option value="Small">Small</option>
                  <option value="Medium">Medium</option>
                  <option value="Large">Large</option>
                </select>
              </div>
              <div className="gd-form-row">
                <label className="gd-form-label">Поддерживаемые системы</label>
                <div className="gd-game-systems">
                  {[...GAME_SYSTEMS_MAIN, ...GAME_SYSTEMS_BOTTOM].map(game => (
                    <label key={game}>
                      <input type="checkbox" checked={selectedGames.includes(game)}
                        onChange={e => setSelectedGames(e.target.checked ? [...selectedGames, game] : selectedGames.filter(g => g !== game))} />
                      {' '}{game}
                    </label>
                  ))}
                </div>
              </div>
              <div className="gd-form-row">
                <label style={{ cursor: 'pointer' }}>
                  <input type="checkbox" checked={editingTable.eventsOnly || false}
                    onChange={e => setEditingTable({ ...editingTable, eventsOnly: e.target.checked })} />
                  {' '}Только для событий
                </label>
              </div>
              <div className="gd-flex-row" style={{ gap: 'var(--gd-s2)' }}>
                <Button size="sm" onClick={saveTable}>Сохранить</Button>
                <Button variant="secondary" size="sm" onClick={() => setEditingTable(null)}>Отмена</Button>
                {editingTable.id && <Button variant="danger" size="sm" onClick={() => { deleteTable(editingTable.id!); setEditingTable(null) }}>Удалить</Button>}
              </div>
            </Dataslate>
          )}
          <h3 className="gd-h3" style={{ marginTop: 'var(--gd-s6)' }}>Столы ({tables.length})</h3>
          {tables.map(t => (
            <Dataslate key={t.id} bodyClassName="gd-flex-between">
              <div>
                <strong>Стол #{t.number}</strong> — {t.size}
                <div className="gd-text-muted gd-text-xs">{t.supportedGames ? t.supportedGames.split('|').filter(Boolean).join(', ') : ''}</div>
              </div>
              <div className="gd-flex-row" style={{ gap: 'var(--gd-s2)' }}>
                <Button variant="secondary" size="sm" onClick={() => { setEditingTable(t); setSelectedGames(t.supportedGames ? t.supportedGames.split('|').filter(g => ALL_GAME_SYSTEMS.includes(g)) : []) }}>Ред.</Button>
                <Button variant="secondary" size="sm" onClick={() => copyTable(t.id)}>Копировать</Button>
              </div>
            </Dataslate>
          ))}
        </>
      )}

      {tab === 'members' && (
        <>
          <div className="gd-section-header">
            <h2 className="gd-section-title">Участники ({memberships.length})</h2>
            <Button size="sm" onClick={() => { setShowAddManualForm(v => !v); setAddManualError('') }}>
              {showAddManualForm ? '✕ Отмена' : '+ Ручной участник'}
            </Button>
          </div>
          {showAddManualForm && (
            <Dataslate style={{ borderColor: 'var(--gd-success)' }}>
              <h3 className="gd-h3">Ручное добавление игрока</h3>
              <div className="gd-flex-row gd-flex-wrap" style={{ gap: 'var(--gd-s2)' }}>
                <input className="gd-input" placeholder="Имя игрока *" value={manualName}
                  onChange={e => { setManualName(e.target.value); setAddManualError('') }} />
                <input className="gd-input" placeholder="Email (необязательно)" value={manualEmail}
                  onChange={e => setManualEmail(e.target.value)} />
                <Button size="sm" onClick={addManualMember}>Добавить</Button>
              </div>
              {addManualError && <p className="gd-error-text">{addManualError}</p>}
            </Dataslate>
          )}
          {memberships.length === 0 ? (
            <p className="gd-text-muted">Заявок пока нет.</p>
          ) : (
            <Dataslate bodyClassName="gd-table-scroll">
              <table className="gd-table">
                <thead>
                  <tr>
                    <th>Воин</th>
                    <th>Email</th>
                    <th>Дата</th>
                    <th>Статус</th>
                    <th>Роль</th>
                    <th>Ключ</th>
                    <th>Админ</th>
                    <th>Действия</th>
                  </tr>
                </thead>
                <tbody>
                  {memberships.map(m => (
                    <Fragment key={m.id}>
                    <tr>
                      <td>
                        <strong>{m.user.name}</strong>
                        {m.isManualEntry && <Badge tone="success" className="gd-ml-1">вручную</Badge>}
                      </td>
                      <td>{m.user.email || '—'}</td>
                      <td>{new Date(m.appliedAt).toLocaleDateString()}</td>
                      <td>
                        <Badge tone={m.status === 'Approved' ? 'success' : m.status === 'Pending' ? 'warn' : 'danger'}>
                          {membershipStatusLabel(m.status)}
                        </Badge>
                      </td>
                      <td>
                        {m.status === 'Approved' && (
                          <span title={m.isModerator ? 'Капеллан' : '—'}>
                            {m.isModerator ? '⭐' : '—'}
                          </span>
                        )}
                      </td>
                      <td>
                        {m.status === 'Approved' && (
                          <span title={m.hasKey ? 'С ключом' : 'Без ключа'}>
                            {m.hasKey ? '🗝️' : '—'}
                          </span>
                        )}
                      </td>
                      <td>
                        {m.status === 'Approved' && (
                          <span title={m.isAdmin ? 'Магистр' : '—'}>
                            {m.isAdmin ? '👑' : '—'}
                          </span>
                        )}
                      </td>
                      <td>
                        <div className="gd-flex-row gd-flex-wrap" style={{ gap: 'var(--gd-s1)' }}>
                          {m.status === 'Pending' && (
                            <>
                              <Button variant="secondary" size="sm" onClick={() => updateMembership(m.id, 'approve')}>Approve</Button>
                              <Button variant="danger" size="sm" onClick={() => updateMembership(m.id, 'reject')}>Reject</Button>
                            </>
                          )}
                          {m.status === 'Approved' && (
                            <>
                              {m.isManualEntry && (
                                <Button variant="secondary" size="sm"
                                  onClick={() => editingManualMemberId === m.id ? setEditingManualMemberId(null) : startEditManualMember(m)}
                                  title="Редактировать запись"
                                >✏️</Button>
                              )}
                              {!m.isManualEntry && (
                                <Button variant={m.isModerator ? 'brass' : 'secondary'} size="sm"
                                  onClick={() => toggleModerator(m.id, m.isModerator)}
                                  title={m.isModerator ? 'Снять модератора' : 'Назначить модератором'}
                                >⭐</Button>
                              )}
                              <Button variant={expandedGsMemberId === m.id ? 'brass' : 'secondary'} size="sm"
                                onClick={() => toggleGsEditor(m)}
                                title="Игровые системы"
                              >🎲</Button>
                              <Button variant={expandedCityMemberId === m.id ? 'brass' : 'secondary'} size="sm"
                                onClick={() => toggleCityEditor(m)}
                                title="Город"
                              >🏙️</Button>
                              <Button variant={m.hasKey ? 'brass' : 'secondary'} size="sm"
                                onClick={() => toggleKey(m.id, m.hasKey)}
                                title={m.hasKey ? 'Снять ключ' : 'Выдать ключ'}
                                aria-label={m.hasKey ? 'Снять статус «С ключом»' : 'Назначить статус «С ключом»'}
                              >🗝️</Button>
                              {!m.isManualEntry && (
                                <Button variant={m.isAdmin ? 'danger' : 'secondary'} size="sm"
                                  onClick={() => toggleAdmin(m.id, m.isAdmin)}
                                  title={m.isAdmin ? 'Снять админа' : 'Назначить админом'}
                                >👑</Button>
                              )}
                              <Button variant="danger" size="sm" onClick={() => kickMember(m.id)}>Исключить</Button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                    {editingManualMemberId === m.id && m.isManualEntry && (
                      <tr>
                        <td colSpan={8}>
                          <div className="gd-flex-row gd-flex-wrap" style={{ gap: 'var(--gd-s2)', padding: 'var(--gd-s2) 0' }}>
                            <input className="gd-input" placeholder="Имя игрока *" value={editingManualName}
                              onChange={e => { setEditingManualName(e.target.value); setEditingManualError('') }} />
                            <input className="gd-input" placeholder="Email (необязательно)" value={editingManualEmail}
                              onChange={e => setEditingManualEmail(e.target.value)} />
                            <Button size="sm" onClick={() => saveManualMemberEdit(m.id)}>Сохранить</Button>
                            <Button variant="secondary" size="sm" onClick={() => setEditingManualMemberId(null)}>Отмена</Button>
                          </div>
                          {editingManualError && <p className="gd-error-text">{editingManualError}</p>}
                        </td>
                      </tr>
                    )}
                    {expandedGsMemberId === m.id && m.status === 'Approved' && (
                      <tr>
                        <td colSpan={8}>
                          <div className="gd-flex-row" style={{ gap: 'var(--gd-s2)', marginBottom: 'var(--gd-s3)' }}>
                            <Button variant="secondary" size="sm"
                              onClick={() => setMemberGameSystems(prev => ({ ...prev, [m.id]: [...ALL_GAME_SYSTEMS] }))}
                            >✓ Все</Button>
                            <Button variant="secondary" size="sm"
                              onClick={() => setMemberGameSystems(prev => ({ ...prev, [m.id]: [] }))}
                            >✗ Очистить</Button>
                          </div>
                          <div className="gd-game-systems" style={{ marginBottom: 'var(--gd-s3)' }}>
                            {GAME_SYSTEMS_MAIN.map(gs => (
                              <label key={gs}>
                                <input
                                  type="checkbox"
                                  checked={(memberGameSystems[m.id] || []).includes(gs)}
                                  onChange={() => toggleMemberGs(m.id, gs)}
                                />
                                {gs}
                              </label>
                            ))}
                          </div>
                          <div className="gd-game-systems" style={{ borderTop: '1px solid var(--gd-border)', paddingTop: 'var(--gd-s2)', marginBottom: 'var(--gd-s3)' }}>
                            {GAME_SYSTEMS_BOTTOM.map(gs => (
                              <label key={gs}>
                                <input
                                  type="checkbox"
                                  checked={(memberGameSystems[m.id] || []).includes(gs)}
                                  onChange={() => toggleMemberGs(m.id, gs)}
                                />
                                {gs}
                              </label>
                            ))}
                          </div>
                          <Button size="sm"
                            onClick={() => saveMemberGameSystems(m.id)}
                            disabled={savingGsMemberId === m.id}
                          >
                            {savingGsMemberId === m.id ? 'Сохраняем...' : 'Сохранить'}
                          </Button>
                        </td>
                      </tr>
                    )}
                    {expandedCityMemberId === m.id && m.status === 'Approved' && (
                      <tr>
                        <td colSpan={8}>
                          <div className="gd-flex-row gd-flex-wrap" style={{ gap: 'var(--gd-s2)' }}>
                            <span className="gd-text-muted gd-text-xs">Город:</span>
                            <input
                              className="gd-input"
                              placeholder="Город (необязательно)"
                              maxLength={50}
                              value={editingCityValue}
                              onChange={e => { setEditingCityValue(e.target.value); setCityError('') }}
                            />
                            <Button size="sm"
                              onClick={() => saveMemberCity(m.id)}
                              disabled={savingCityMemberId === m.id}
                            >
                              {savingCityMemberId === m.id ? 'Сохраняем...' : 'Сохранить'}
                            </Button>
                            <Button variant="secondary" size="sm" onClick={() => { setExpandedCityMemberId(null); setCityError('') }}>Отмена</Button>
                          </div>
                          {cityError && <p className="gd-error-text">{cityError}</p>}
                        </td>
                      </tr>
                    )}
                    </Fragment>
                  ))}
                </tbody>
              </table>
            </Dataslate>
          )}
        </>
      )}

      {tab === 'settings' && (
        <>
          <Dataslate title="Настройки клуба">
            <div className="gd-flex-row gd-flex-wrap" style={{ gap: 'var(--gd-s4)', marginBottom: 'var(--gd-s4)' }}>
              <div>
                <label className="gd-form-label">Время открытия</label>
                <input className="gd-input" type="time" value={openTime} onChange={e => setOpenTime(e.target.value)} />
              </div>
              <div>
                <label className="gd-form-label">Время закрытия</label>
                <input className="gd-input" type="time" value={closeTime} onChange={e => setCloseTime(e.target.value)} />
              </div>
            </div>
            <div className="gd-flex-row gd-flex-wrap" style={{ gap: 'var(--gd-s4)', alignItems: 'flex-end', marginBottom: 'var(--gd-s4)' }}>
              <div>
                <label className="gd-form-label">Короткое имя <span className="gd-text-muted">(до 20 символов)</span></label>
                <div className="gd-flex-row" style={{ gap: 'var(--gd-s2)' }}>
                  <input
                    className="gd-input"
                    type="text"
                    maxLength={20}
                    placeholder="Напр.: МГК или Warhammer"
                    value={shortName}
                    onChange={e => setShortName(e.target.value)}
                    style={{ width: 160 }}
                  />
                  <div>
                    <label className="gd-form-label">Цвет бейджа</label>
                    <input
                      type="color"
                      value={badgeColor || '#c4a35a'}
                      onChange={e => setBadgeColor(e.target.value)}
                      className="gd-color-input"
                    />
                  </div>
                  {shortName.trim() && (
                    <span style={{
                      background: badgeColor || '#c4a35a', color: '#fff',
                      borderRadius: '4px', padding: '3px 8px', fontSize: '13px', fontWeight: 'bold',
                    }}>{shortName.trim()}</span>
                  )}
                </div>
              </div>
            </div>
            <div className="gd-flex-row" style={{ gap: 'var(--gd-s3)' }}>
              <Button onClick={saveSettings}>Сохранить</Button>
              {settingsSaved && <span className="gd-text-xs" style={{ color: 'var(--gd-success)' }}>✓ Сохранено</span>}
            </div>
          </Dataslate>
          <Dataslate>
            <h3 className="gd-h3">Логотип клуба</h3>
            <div className="gd-flex-row gd-flex-wrap" style={{ gap: 'var(--gd-s5)' }}>
              {club?.logoUrl && (
                <div style={{ position: 'relative' }}>
                  <img src={club.logoUrl} alt="Лого клуба" style={{ width: 120, height: 120, objectFit: 'contain' }} />
                  <button
                    className="gd-gallery-del"
                    style={{ position: 'absolute', top: -8, right: -8, width: 24, height: 24, fontSize: '0.7rem', lineHeight: '24px' }}
                    onClick={deleteLogo} title="Удалить лого">×</button>
                </div>
              )}
              <div>
                <label className="gd-form-label">
                  {club?.logoUrl ? 'Заменить лого' : 'Загрузить лого'} (jpeg, png, webp, gif, до 5 МБ)
                </label>
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/gif"
                  disabled={logoUploading}
                  onChange={e => { const f = e.target.files?.[0]; if (f) uploadLogo(f); e.target.value = '' }}
                />
                {logoUploading && <p className="gd-text-xs gd-text-muted">Загрузка…</p>}
                {logoError && <p className="gd-error-text">{logoError}</p>}
              </div>
            </div>
          </Dataslate>
        </>
      )}

      {tab === 'gallery' && (
        <>
          <Dataslate title={`Галерея (${galleryPhotos.length}/10)`}>
            <div style={{ marginBottom: 'var(--gd-s4)' }}>
              <label className="gd-form-label">
                Добавить фото (jpeg, png, webp, gif, до 5 МБ)
              </label>
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif"
                disabled={galleryUploading || galleryPhotos.length >= 10}
                onChange={e => { const f = e.target.files?.[0]; if (f) uploadGalleryPhoto(f); e.target.value = '' }}
              />
              {galleryPhotos.length >= 10 && <p className="gd-text-xs" style={{ color: 'var(--gd-warn)' }}>Достигнут лимит в 10 фото</p>}
              {galleryUploading && <p className="gd-text-xs gd-text-muted">Загрузка…</p>}
              {galleryError && <p className="gd-error-text">{galleryError}</p>}
            </div>
            {galleryPhotos.length === 0 ? (
              <p className="gd-text-muted">Фотографий пока нет.</p>
            ) : (
              <div className="gd-gallery-grid">
                {galleryPhotos.map(photo => (
                  <div key={photo.id} className="gd-gallery-item" style={{ position: 'relative' }}>
                    <img src={photo.url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                    <button
                      className="gd-gallery-del"
                      style={{ width: 20, height: 20, fontSize: '0.6rem', lineHeight: '20px' }}
                      onClick={() => deleteGalleryPhoto(photo.id)} title="Удалить фото">×</button>
                  </div>
                ))}
              </div>
            )}
          </Dataslate>
        </>
      )}

      {tab === 'events' && (
        <>
          <div style={{ marginBottom: 'var(--gd-s4)' }}>
            <Button size="sm" onClick={() => {
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
            </Button>
          </div>

          {showEventForm && (
            <Dataslate style={{ borderColor: 'var(--gd-blood-red)' }}>
              <h3 className="gd-h3">Новое событие</h3>
              <div className="gd-flex-row gd-flex-wrap" style={{ gap: 'var(--gd-s2)', marginBottom: 'var(--gd-s3)' }}>
                <input className="gd-input" placeholder="Название" value={newEvent.title}
                  onChange={e => setNewEvent({ ...newEvent, title: e.target.value })} />
                <label className="gd-text-xs gd-text-muted">Начало:</label>
                <input className="gd-input" type="datetime-local" step={3600} value={newEvent.startTime}
                  onChange={e => setNewEvent({ ...newEvent, startTime: e.target.value })} />
                <label className="gd-text-xs gd-text-muted">Конец:</label>
                <input className="gd-input" type="datetime-local" step={3600} value={newEvent.endTime}
                  onChange={e => setNewEvent({ ...newEvent, endTime: e.target.value })} />
                <input className="gd-input" type="number" min={2} placeholder="Макс. уч."
                  style={{ width: 80 }}
                  value={newEvent.maxParticipants}
                  onChange={e => setNewEvent({ ...newEvent, maxParticipants: parseInt(e.target.value) || 2 })} />
                <select className="gd-input gd-select" value={newEvent.eventType}
                  onChange={e => setNewEvent({ ...newEvent, eventType: e.target.value })}>
                  <option value="Tournament">Турнир</option>
                  <option value="Campaign">Кампания</option>
                  <option value="Event">Ивент</option>
                </select>
                <select className="gd-input gd-select" value={newEvent.gameSystem}
                  onChange={e => setNewEvent({ ...newEvent, gameSystem: e.target.value })}>
                  <option value="">— Игровая система —</option>
                  {[...GAME_SYSTEMS_MAIN, ...GAME_SYSTEMS_BOTTOM].map(g => <option key={g} value={g}>{g}</option>)}
                </select>
              </div>
              <div className="gd-form-row">
                <label className="gd-form-label">Столы события</label>
                <div className="gd-flex-row gd-flex-wrap" style={{ gap: 'var(--gd-s2)' }}>
                  {tables.map(t => (
                    <label key={t.id} className="gd-gs-tag">
                      <input type="checkbox" checked={selectedEventTables.includes(t.id)}
                        onChange={e => setSelectedEventTables(e.target.checked
                          ? [...selectedEventTables, t.id]
                          : selectedEventTables.filter(id => id !== t.id))} />
                      {' '}Стол {t.number}
                    </label>
                  ))}
                </div>
              </div>
              <div className="gd-form-row">
                <label className="gd-form-label">Описание (до 500 символов)</label>
                <textarea className="gd-input" style={{ width: '100%', minHeight: 90, resize: 'vertical', fontFamily: 'inherit' }}
                  placeholder="Описание события..."
                  maxLength={500}
                  value={newEvent.description}
                  onChange={e => setNewEvent({ ...newEvent, description: e.target.value })} />
                <span className="gd-text-xs gd-text-muted">{newEvent.description.length}/500</span>
              </div>
              <div className="gd-form-row">
                <label className="gd-form-label">Гейм-мастер (необязательно)</label>
                <select className="gd-input gd-select" value={newEvent.gameMasterId}
                  onChange={e => setNewEvent({ ...newEvent, gameMasterId: e.target.value })}>
                  <option value="">— Не назначен —</option>
                  {memberships.filter(m => m.status === 'Approved' && !m.isManualEntry).map(m => (
                    <option key={m.user.id} value={m.user.id}>{m.user.name}</option>
                  ))}
                </select>
              </div>
              <div className="gd-flex-row" style={{ gap: 'var(--gd-s2)' }}>
                <Button size="sm" onClick={createEvent} disabled={!newEvent.title || !newEvent.startTime || !newEvent.endTime}>Создать</Button>
                <Button variant="secondary" size="sm" onClick={() => setShowEventForm(false)}>Отмена</Button>
              </div>
            </Dataslate>
          )}

          <h3 className="gd-h3" style={{ margin: 'var(--gd-s6) 0 var(--gd-s4)' }}>Существующие события</h3>
          {events.filter(ev => ev.status !== 'Archived').length === 0 && <p className="gd-text-muted">Событий пока нет.</p>}
          {events.filter(ev => ev.status !== 'Archived').map(ev => {
            const isFinished = new Date(ev.endTime) <= new Date()
            const tableNumbers = ev.tableIds
              ? ev.tableIds.split(',').map(id => tables.find(t => t.id === parseInt(id))?.number).filter(Boolean).join(', ')
              : ''
            const approvedMembers = memberships.filter(m => m.status === 'Approved' && !m.isManualEntry && !ev.participants.some(p => p.id === m.user.id))
            return (
              <Dataslate key={ev.id}>
                <div className="gd-flex-between gd-flex-wrap" style={{ gap: 'var(--gd-s2)' }}>
                  <div>
                    <strong style={{ fontSize: '0.95rem' }}>{ev.title}</strong>
                    <Badge tone="warn" className="gd-ml-1">{ev.eventType}</Badge>
                    {ev.status === 'Completed' && <Badge tone="brass" className="gd-ml-1">Завершён</Badge>}
                    {ev.status === 'Archived' && <Badge tone="brass" className="gd-ml-1">Архив</Badge>}
                    {ev.gameSystem && <span className="gd-text-xs gd-text-muted gd-ml-1" style={{ fontStyle: 'italic' }}>{ev.gameSystem}</span>}
                    <div className="gd-text-xs gd-text-muted" style={{ marginTop: 4 }}>
                      📅 {new Date(ev.startTime).toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                      {' – '}
                      {new Date(ev.endTime).toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                      &nbsp;·&nbsp;👥 {ev.participants.length}/{ev.maxParticipants}
                      {tableNumbers && <>&nbsp;·&nbsp;🎲 {tableNumbers}</>}
                    </div>
                    {ev.gameMasterName && (
                      <div className="gd-text-xs" style={{ color: 'var(--gd-brass)', marginTop: 3 }}>
                        🎖️ Гейм-мастер: <strong>{ev.gameMasterName}</strong>
                      </div>
                    )}
                  </div>
                  <div className="gd-flex-row gd-flex-wrap" style={{ gap: 'var(--gd-s1)' }}>
                    <Button variant="secondary" size="sm" onClick={() => {
                      if (editingTitleEventId === ev.id) { setEditingTitleEventId(null) }
                      else { setEditingTitleEventId(ev.id); setEditingTitleValue(ev.title) }
                    }}>
                      {editingTitleEventId === ev.id ? '✕' : '✏️'}
                    </Button>
                    <Button variant="secondary" size="sm" onClick={() => editingEventId === ev.id ? setEditingEventId(null) : startEditingEventDate(ev)}>
                      {editingEventId === ev.id ? '✕' : '📅'}
                    </Button>
                    <Button variant="secondary" size="sm" onClick={() => { setInviteEventId(inviteEventId === ev.id ? null : ev.id); setInviteUserId('') }}>
                      {inviteEventId === ev.id ? '✕' : '+👤'}
                    </Button>
                    <Button variant="secondary" size="sm" onClick={() => {
                      if (editingDescEventId === ev.id) { setEditingDescEventId(null) }
                      else { setEditingDescEventId(ev.id); setEditingDescValue(ev.description ?? '') }
                    }}>
                      {editingDescEventId === ev.id ? '✕' : '📝'}
                    </Button>
                    <Button variant="danger" size="sm" onClick={() => deleteEvent(ev.id)}>Удалить</Button>
                    <Button variant="secondary" size="sm" onClick={() => editingTablesEventId === ev.id ? setEditingTablesEventId(null) : startEditingEventTables(ev)}
                      title="Редактировать столы">
                      {editingTablesEventId === ev.id ? '✕' : '🎲'}
                    </Button>
                    {isFinished && ev.status !== 'Archived' && (
                      <Button variant="secondary" size="sm" onClick={() => resultsEventId === ev.id ? setResultsEventId(null) : startEditingResults(ev)}
                        title="Подвести итоги">
                        {resultsEventId === ev.id ? '✕' : '🏆'}
                      </Button>
                    )}
                    {!ev.status && isFinished && (
                      <Button variant="secondary" size="sm" onClick={() => completeEvent(ev.id)} title="Завершить без итогов">Завершить</Button>
                    )}
                    {ev.status === 'Completed' && (
                      <Button variant="brass" size="sm" onClick={() => archiveEvent(ev.id)} title="Переместить в архив">📦 В архив</Button>
                    )}
                    {ev.eventType === 'Campaign' && (
                      <Button variant="brass" size="sm" onClick={() => setCampaignMapEditorEvent(ev)}>🗺️ Карта</Button>
                    )}
                  </div>
                </div>

                {editingTitleEventId === ev.id && (
                  <div className="gd-flex-row gd-flex-wrap" style={{ gap: 'var(--gd-s2)', paddingTop: 'var(--gd-s2)' }}>
                    <input className="gd-input" style={{ minWidth: 220 }} value={editingTitleValue}
                      onChange={e => setEditingTitleValue(e.target.value)}
                      onKeyDown={e => {
                        if (e.key === 'Enter') saveEventTitle(ev.id)
                        if (e.key === 'Escape') setEditingTitleEventId(null)
                      }}
                      placeholder="Название события" autoFocus />
                    <Button size="sm" onClick={() => saveEventTitle(ev.id)} disabled={!editingTitleValue.trim()}>Сохранить</Button>
                  </div>
                )}

                {editingEventId === ev.id && (
                  <div className="gd-flex-row gd-flex-wrap" style={{ gap: 'var(--gd-s2)', paddingTop: 'var(--gd-s2)' }}>
                    <label className="gd-text-xs gd-text-muted">Начало:</label>
                    <input className="gd-input" type="datetime-local" step={3600} value={editingEventStartTime}
                      onChange={e => { setEditingEventStartTime(e.target.value); setEditingEventDateError('') }} />
                    <label className="gd-text-xs gd-text-muted">Конец:</label>
                    <input className="gd-input" type="datetime-local" step={3600} value={editingEventEndTime}
                      onChange={e => { setEditingEventEndTime(e.target.value); setEditingEventDateError('') }} />
                    <Button size="sm" onClick={() => saveEventDate(ev.id)}>Сохранить</Button>
                    {editingEventDateError && <span className="gd-error-text" style={{ margin: 0 }}>{editingEventDateError}</span>}
                  </div>
                )}

                {editingDescEventId === ev.id && (
                  <div style={{ paddingTop: 'var(--gd-s2)' }}>
                    <textarea className="gd-input" style={{ width: '100%', minHeight: 90, resize: 'vertical', fontFamily: 'inherit' }}
                      placeholder="Описание события..."
                      maxLength={500}
                      value={editingDescValue}
                      onChange={e => setEditingDescValue(e.target.value)} />
                    <div className="gd-flex-row gd-flex-wrap" style={{ gap: 'var(--gd-s2)', marginTop: 6 }}>
                      <span className="gd-text-xs gd-text-muted">{editingDescValue.length}/500</span>
                      <Button size="sm" onClick={() => saveEventDescription(ev.id)}>Сохранить</Button>
                    </div>
                  </div>
                )}

                {editingTablesEventId === ev.id && (
                  <div style={{ paddingTop: 'var(--gd-s2)' }}>
                    <div className="gd-text-xs gd-text-muted" style={{ marginBottom: 4 }}>Столы события</div>
                    <div className="gd-flex-row gd-flex-wrap" style={{ gap: 'var(--gd-s2)' }}>
                      {tables.map(t => (
                        <label key={t.id} className="gd-gs-tag">
                          <input type="checkbox" checked={editingTablesValue.includes(t.id)}
                            onChange={e => setEditingTablesValue(e.target.checked
                              ? [...editingTablesValue, t.id]
                              : editingTablesValue.filter(id => id !== t.id))} />
                          {' '}Стол {t.number}
                        </label>
                      ))}
                    </div>
                    <div className="gd-flex-row" style={{ gap: 'var(--gd-s2)', marginTop: 6 }}>
                      <Button size="sm" onClick={() => saveEventTables(ev.id)}>Сохранить</Button>
                    </div>
                  </div>
                )}

                {resultsEventId === ev.id && (
                  <div style={{ paddingTop: 'var(--gd-s2)' }}>
                    <div className="gd-text-xs gd-text-muted" style={{ marginBottom: 4 }}>Итоги: укажите места участников (можно не всем)</div>
                    {ev.participants.length === 0 && <p className="gd-text-muted">Нет участников.</p>}
                    {ev.participants.map(p => (
                      <div key={p.id} className="gd-flex-row gd-flex-wrap" style={{ gap: 'var(--gd-s2)', marginBottom: 4, alignItems: 'center' }}>
                        <span className="gd-text-xs">{p.name}</span>
                        <input className="gd-input" type="number" min={1} placeholder="—" style={{ width: 70 }}
                          value={resultsPlaces[p.id] ?? ''}
                          onChange={e => setResultsPlaces({ ...resultsPlaces, [p.id]: e.target.value === '' ? '' : parseInt(e.target.value) || '' })} />
                      </div>
                    ))}
                    <div className="gd-flex-row" style={{ gap: 'var(--gd-s2)', marginTop: 6 }}>
                      <Button size="sm" onClick={() => saveEventResults(ev.id)} disabled={ev.participants.length === 0}>Сохранить итоги</Button>
                      {resultsError && <span className="gd-error-text" style={{ margin: 0 }}>{resultsError}</span>}
                    </div>
                  </div>
                )}

                {inviteEventId === ev.id && (
                  <div className="gd-flex-row gd-flex-wrap" style={{ gap: 'var(--gd-s2)', paddingTop: 'var(--gd-s2)' }}>
                    <select className="gd-input gd-select" value={inviteUserId} onChange={e => setInviteUserId(e.target.value)}>
                      <option value="">— Выберите игрока —</option>
                      {approvedMembers.map(m => (
                        <option key={m.user.id} value={m.user.id}>{m.user.name}</option>
                      ))}
                    </select>
                    <Button size="sm" onClick={() => inviteParticipant(ev.id)} disabled={!inviteUserId}>Пригласить</Button>
                    {approvedMembers.length === 0 && <span className="gd-text-xs gd-text-muted">Все одобренные участники уже в событии</span>}
                  </div>
                )}

                {ev.participants.length > 0 && (
                  <div className="gd-text-xs gd-text-muted" style={{ marginTop: 2 }}>
                    Участники:{' '}
                    {ev.participants.map((p, i) => (
                      <span key={p.id}>
                        {i > 0 && ', '}
                        {p.name}
                        <button onClick={() => removeParticipant(ev.id, p.id)}
                          aria-label={`Удалить ${p.name} из события`}
                          style={{ background: 'none', border: 'none', color: 'var(--gd-danger)', cursor: 'pointer', marginLeft: 2, padding: '0 2px', fontSize: 11 }}
                          title="Удалить из события">×</button>
                      </span>
                    ))}
                  </div>
                )}

                {ev.description && editingDescEventId !== ev.id && (
                  <div className="gd-text-xs" style={{ color: 'var(--gd-fg-secondary)', marginTop: 2, whiteSpace: 'pre-wrap' }}>{ev.description}</div>
                )}

                <div className="gd-flex-row gd-flex-wrap" style={{ gap: 'var(--gd-s2)', marginTop: 4 }}>
                  {ev.regulationUrl ? (
                    <>
                      <a href={ev.regulationUrl} target="_blank" rel="noopener noreferrer" className="gd-link">📄 {getAttachmentDisplayName(ev.regulationUrl, 'Регламент 1')}</a>
                      <label className="gd-text-xs gd-text-muted" style={{ cursor: 'pointer' }}>
                        {regulationUploading === ev.id ? 'Загрузка…' : 'Заменить'}
                        <input type="file" accept="application/pdf,.pdf,application/msword,.doc,application/vnd.openxmlformats-officedocument.wordprocessingml.document,.docx" style={{ display: 'none' }}
                          disabled={regulationUploading === ev.id}
                          onChange={e => { const f = e.target.files?.[0]; if (f) uploadRegulation(ev.id, f); e.target.value = '' }} />
                      </label>
                      <button onClick={() => deleteRegulation(ev.id)} className="gd-link-danger"
                        title="Удалить регламент">× Удалить</button>
                    </>
                  ) : (
                    <label className="gd-text-xs gd-text-muted" style={{ cursor: 'pointer' }}>
                      {regulationUploading === ev.id ? 'Загрузка…' : '📎 Регламент 1 (PDF / Word, до 10 МБ)'}
                      <input type="file" accept="application/pdf,.pdf,application/msword,.doc,application/vnd.openxmlformats-officedocument.wordprocessingml.document,.docx" style={{ display: 'none' }}
                        disabled={regulationUploading === ev.id}
                        onChange={e => { const f = e.target.files?.[0]; if (f) uploadRegulation(ev.id, f); e.target.value = '' }} />
                    </label>
                  )}
                </div>

                <div className="gd-flex-row gd-flex-wrap" style={{ gap: 'var(--gd-s2)', marginTop: 4 }}>
                  {ev.regulationUrl2 ? (
                    <>
                      <a href={ev.regulationUrl2} target="_blank" rel="noopener noreferrer" className="gd-link">📄 {getAttachmentDisplayName(ev.regulationUrl2, 'Регламент 2')}</a>
                      <label className="gd-text-xs gd-text-muted" style={{ cursor: 'pointer' }}>
                        {regulation2Uploading === ev.id ? 'Загрузка…' : 'Заменить'}
                        <input type="file" accept="application/pdf,.pdf,application/msword,.doc,application/vnd.openxmlformats-officedocument.wordprocessingml.document,.docx" style={{ display: 'none' }}
                          disabled={regulation2Uploading === ev.id}
                          onChange={e => { const f = e.target.files?.[0]; if (f) uploadRegulation2(ev.id, f); e.target.value = '' }} />
                      </label>
                      <button onClick={() => deleteRegulation2(ev.id)} className="gd-link-danger"
                        title="Удалить регламент 2">× Удалить</button>
                    </>
                  ) : (
                    <label className="gd-text-xs gd-text-muted" style={{ cursor: 'pointer' }}>
                      {regulation2Uploading === ev.id ? 'Загрузка…' : '📎 Регламент 2 (PDF / Word, до 10 МБ)'}
                      <input type="file" accept="application/pdf,.pdf,application/msword,.doc,application/vnd.openxmlformats-officedocument.wordprocessingml.document,.docx" style={{ display: 'none' }}
                        disabled={regulation2Uploading === ev.id}
                        onChange={e => { const f = e.target.files?.[0]; if (f) uploadRegulation2(ev.id, f); e.target.value = '' }} />
                    </label>
                  )}
                </div>

                <div className="gd-flex-row gd-flex-wrap" style={{ gap: 'var(--gd-s2)', marginTop: 4 }}>
                  {ev.missionMapUrl ? (
                    <>
                      <span className="gd-text-xs gd-text-muted">🗺️ Карта миссии:</span>
                      <img src={ev.missionMapUrl} alt="Карта миссии" style={{ maxHeight: 48, maxWidth: 80, borderRadius: 4, cursor: 'pointer', border: '1px solid var(--gd-border)' }}
                        title="Просмотреть" />
                      <label className="gd-text-xs gd-text-muted" style={{ cursor: 'pointer' }}>
                        {missionMapUploading === ev.id ? 'Загрузка…' : 'Заменить'}
                        <input type="file" accept="image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp" style={{ display: 'none' }}
                          disabled={missionMapUploading === ev.id}
                          onChange={e => { const f = e.target.files?.[0]; if (f) uploadMissionMap(ev.id, f); e.target.value = '' }} />
                      </label>
                      <button onClick={() => deleteMissionMap(ev.id)} className="gd-link-danger"
                        title="Удалить карту миссии">× Удалить</button>
                    </>
                  ) : (
                    <label className="gd-text-xs gd-text-muted" style={{ cursor: 'pointer' }}>
                      {missionMapUploading === ev.id ? 'Загрузка…' : '🗺️ Карта миссии (JPG/PNG/WebP, до 10 МБ)'}
                      <input type="file" accept="image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp" style={{ display: 'none' }}
                        disabled={missionMapUploading === ev.id}
                        onChange={e => { const f = e.target.files?.[0]; if (f) uploadMissionMap(ev.id, f); e.target.value = '' }} />
                    </label>
                  )}
                </div>
              </Dataslate>
            )
          })}

          {events.filter(ev => ev.status === 'Archived').length > 0 && (
            <>
              <div style={{ marginTop: 'var(--gd-s6)' }}>
                <Button variant="secondary" size="sm" onClick={() => setShowArchive(v => !v)}>
                  {showArchive ? '✕ Скрыть' : '📦 Архив'} ({events.filter(ev => ev.status === 'Archived').length})
                </Button>
              </div>
              {showArchive && events.filter(ev => ev.status === 'Archived').map(ev => {
                const tableNumbers = ev.tableIds
                  ? ev.tableIds.split(',').map(id => tables.find(t => t.id === parseInt(id))?.number).filter(Boolean).join(', ')
                  : ''
                const placed = ev.participants.filter(p => p.place != null).sort((a, b) => (a.place! - b.place!))
                return (
                  <Dataslate key={ev.id}>
                    <div className="gd-flex-between gd-flex-wrap" style={{ gap: 'var(--gd-s2)' }}>
                      <div>
                        <strong style={{ fontSize: '0.95rem' }}>{ev.title}</strong>
                        <Badge tone="warn" className="gd-ml-1">{ev.eventType}</Badge>
                        <Badge tone="brass" className="gd-ml-1">Архив</Badge>
                        {ev.gameSystem && <span className="gd-text-xs gd-text-muted gd-ml-1" style={{ fontStyle: 'italic' }}>{ev.gameSystem}</span>}
                        <div className="gd-text-xs gd-text-muted" style={{ marginTop: 4 }}>
                          📅 {new Date(ev.startTime).toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                          &nbsp;·&nbsp;👥 {ev.participants.length}/{ev.maxParticipants}
                          {tableNumbers && <>&nbsp;·&nbsp;🎲 {tableNumbers}</>}
                        </div>
                        {placed.length > 0 && (
                          <div className="gd-text-xs" style={{ color: 'var(--gd-brass)', marginTop: 4 }}>
                            🏆 Итоги: {placed.map(p => `${p.place}-е место — ${p.name}`).join('; ')}
                          </div>
                        )}
                      </div>
                      <Button variant="danger" size="sm" onClick={() => deleteEvent(ev.id)}>Удалить</Button>
                    </div>
                  </Dataslate>
                )
              })}
            </>
          )}
        </>
      )}

      {tab === 'chats' && (
        <>
          <Dataslate title="Создать групповой чат">
            <div className="gd-flex-row gd-flex-wrap" style={{ gap: 'var(--gd-s2)' }}>
              <input
                className="gd-input"
                placeholder="Название чата"
                value={newChatName}
                onChange={e => setNewChatName(e.target.value)}
                maxLength={100}
              />
              <div className="gd-flex-row" style={{ gap: 'var(--gd-s4)' }}>
                <label className="gd-gs-tag">
                  <input type="radio" name="chatVisibility" checked={!newChatIsPublic} onChange={() => setNewChatIsPublic(false)} />
                  <span>🔒 Приватный</span>
                </label>
                <label className="gd-gs-tag">
                  <input type="radio" name="chatVisibility" checked={newChatIsPublic} onChange={() => setNewChatIsPublic(true)} />
                  <span>🌐 Публичный</span>
                </label>
              </div>
              <Button
                size="sm"
                onClick={async () => {
                  setChatError('')
                  if (!newChatName.trim()) { setChatError('Введите название'); return }
                  const res = await fetch('/api/clubadmin/chats', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', ...authH() },
                    body: JSON.stringify({ name: newChatName.trim(), isPublic: newChatIsPublic })
                  })
                  if (res.ok) {
                    setNewChatName('')
                    setNewChatIsPublic(false)
                    const chatsRes = await fetch('/api/clubadmin/chats', { headers: authH() })
                    if (chatsRes.ok) setGroupChats(await chatsRes.json())
                  } else {
                    setChatError(await res.text())
                  }
                }}
              >Создать</Button>
            </div>
            {chatError && <p className="gd-error-text">{chatError}</p>}
          </Dataslate>

          {groupChats.length === 0 && <p className="gd-text-muted">Нет групповых чатов</p>}

          {groupChats.map(chat => {
            const approvedMembers = memberships.filter(m => m.status === 'Approved' && !m.user.id.startsWith('manual:'))
            return (
              <Dataslate key={chat.id}>
                <div className="gd-flex-between gd-flex-wrap" style={{ gap: 'var(--gd-s2)', marginBottom: 'var(--gd-s3)' }}>
                  <div className="gd-flex-row" style={{ gap: 'var(--gd-s2)' }}>
                    {chat.logoUrl
                      ? <img src={chat.logoUrl} alt="logo" className="gd-admin-avatar" style={{ width: 40, height: 40 }} />
                      : <div className="gd-admin-avatar" style={{ background: 'var(--gd-blood-red)', width: 40, height: 40 }}>✠</div>
                    }
                    <h4 className="gd-h3" style={{ margin: 0 }}>{chat.name}</h4>
                    <Badge tone={chat.isPublic ? 'success' : 'neutral'}>
                      {chat.isPublic ? '🌐 Публичный' : '🔒 Приватный'}
                    </Badge>
                  </div>
                  <Button
                    variant="danger" size="sm"
                    onClick={async () => {
                      if (!confirm(`Удалить чат «${chat.name}»?`)) return
                      const res = await fetch(`/api/clubadmin/chats/${chat.id}`, { method: 'DELETE', headers: authH() })
                      if (res.ok) setGroupChats(groupChats.filter(c => c.id !== chat.id))
                    }}
                  >Удалить</Button>
                </div>
                <div className="gd-flex-row" style={{ gap: 'var(--gd-s2)', marginBottom: 'var(--gd-s3)' }}>
                  <span className="gd-text-xs gd-text-muted">Лого чата:</span>
                  <Button variant="secondary" size="sm"
                    onClick={() => (document.getElementById(`chat-logo-${chat.id}`) as HTMLInputElement | null)?.click()}
                  >📷 Загрузить</Button>
                  <input id={`chat-logo-${chat.id}`} type="file" accept="image/*" style={{ display: 'none' }} onChange={async e => {
                    const file = e.target.files?.[0]
                    if (!file) return
                    const fd = new FormData()
                    fd.append('file', file)
                    const res = await fetch(`/api/clubadmin/chats/${chat.id}/logo`, { method: 'POST', headers: authH(), body: fd })
                    if (res.ok) {
                      const data = await res.json()
                      setGroupChats(groupChats.map(c => c.id === chat.id ? { ...c, logoUrl: data.logoUrl } : c))
                    }
                    e.target.value = ''
                  }} />
                  {chat.logoUrl && (
                    <Button variant="secondary" size="sm"
                      onClick={async () => {
                        const res = await fetch(`/api/clubadmin/chats/${chat.id}/logo`, { method: 'DELETE', headers: authH() })
                        if (res.ok) setGroupChats(groupChats.map(c => c.id === chat.id ? { ...c, logoUrl: undefined } : c))
                      }}
                    >🗑 Удалить лого</Button>
                  )}
                </div>
                <div style={{ marginBottom: 'var(--gd-s2)' }}>
                  <strong className="gd-text-xs">Участники ({chat.members.length}):</strong>
                  <div className="gd-flex-row gd-flex-wrap" style={{ gap: 'var(--gd-s1)', marginTop: 6 }}>
                    {chat.members.map(m => (
                      <span key={m.userId} className="gd-gs-tag">
                        {m.name}
                        <button
                          className="gd-link-danger"
                          style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, fontSize: 13 }}
                          title="Удалить из чата"
                          onClick={async () => {
                            const res = await fetch(`/api/clubadmin/chats/${chat.id}/members/${m.userId}`, { method: 'DELETE', headers: authH() })
                            if (res.ok) {
                              setGroupChats(groupChats.map(c => c.id === chat.id ? { ...c, members: c.members.filter(x => x.userId !== m.userId) } : c))
                            }
                          }}
                        >×</button>
                      </span>
                    ))}
                  </div>
                </div>
                <div className="gd-flex-row gd-flex-wrap" style={{ gap: 'var(--gd-s2)' }}>
                  {addMemberChatId === chat.id ? (
                    <>
                      <select
                        className="gd-input gd-select"
                        value={addMemberUserId}
                        onChange={e => setAddMemberUserId(e.target.value)}
                      >
                        <option value="">— выбрать участника —</option>
                        {approvedMembers
                          .filter(m => !chat.members.some(cm => cm.userId === m.user.id))
                          .map(m => (
                            <option key={m.user.id} value={m.user.id}>{m.user.name}</option>
                          ))
                        }
                      </select>
                      <Button
                        size="sm"
                        onClick={async () => {
                          if (!addMemberUserId) return
                          const res = await fetch(`/api/clubadmin/chats/${chat.id}/members`, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json', ...authH() },
                            body: JSON.stringify({ userId: addMemberUserId })
                          })
                          if (res.ok) {
                            const member = approvedMembers.find(m => m.user.id === addMemberUserId)
                            if (member) {
                              setGroupChats(groupChats.map(c => c.id === chat.id
                                ? { ...c, members: [...c.members, { userId: member.user.id, name: member.user.name }] }
                                : c))
                            }
                            setAddMemberChatId(null)
                            setAddMemberUserId('')
                          }
                        }}
                      >Добавить</Button>
                      <Button variant="secondary" size="sm" onClick={() => { setAddMemberChatId(null); setAddMemberUserId('') }}>Отмена</Button>
                    </>
                  ) : (
                    <Button size="sm" onClick={() => { setAddMemberChatId(chat.id); setAddMemberUserId('') }}>+ Добавить участника</Button>
                  )}
                </div>
              </Dataslate>
            )
          })}
        </>
      )}
    </div>

    {campaignMapEditorEvent && (
      <CampaignMapEditor
        eventId={campaignMapEditorEvent.id}
        eventTitle={campaignMapEditorEvent.title}
        onClose={() => setCampaignMapEditorEvent(null)}
      />
    )}
    </>
  )
}
