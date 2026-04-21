import { useState, useEffect, useRef, useCallback } from 'react'

const CANVAS_W = 1400
const CANVAS_H = 800
const BLOCK_W = 160
const BLOCK_CELL = 20
const BLOCK_HEADER_H = 24

interface CampaignMapBlockFaction { id: number; factionIndex: number; influence: number }
interface CampaignMapBlockData {
  id: number; mapId: number; title: string; posX: number; posY: number
  factions: CampaignMapBlockFaction[]
}
interface CampaignMapLinkData { id: number; fromBlockId: number; toBlockId: number }
interface CampaignMapData {
  id: number; eventId: number; maxInfluence: number; factions: string
  blocks: CampaignMapBlockData[]
  links: CampaignMapLinkData[]
}

interface Props { eventId: number; eventTitle: string; onClose: () => void }

const FACTION_COLORS = ['#e94560','#4caf50','#2196f3','#ff9800','#9c27b0','#00bcd4','#f44336','#8bc34a']

function blockHeight(factionCount: number) {
  return BLOCK_HEADER_H + Math.max(1, factionCount) * BLOCK_CELL
}

const inputStyle: React.CSSProperties = {
  background: '#0f1e3d', color: '#eee', border: '1px solid #1a4a8a',
  borderRadius: 4, padding: '5px 8px', fontSize: 13
}
const btnStyle: React.CSSProperties = {
  background: '#533483', color: '#fff', border: 'none',
  borderRadius: 4, padding: '5px 12px', cursor: 'pointer', fontSize: 13
}

export default function CampaignMapEditor({ eventId, eventTitle, onClose }: Props) {
  const token = localStorage.getItem('token') || ''
  const authHeader = { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' }

  const [mapData, setMapData] = useState<CampaignMapData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  // Settings panel
  const [maxInfluence, setMaxInfluence] = useState(5)
  const [factionsRaw, setFactionsRaw] = useState<string[]>([''])
  const [settingsError, setSettingsError] = useState('')
  const [settingsSaving, setSettingsSaving] = useState(false)

  // Block drag
  const [dragging, setDragging] = useState<{ id: number; ox: number; oy: number } | null>(null)
  const [localPos, setLocalPos] = useState<Record<number, { x: number; y: number }>>({})
  const containerRef = useRef<HTMLDivElement>(null)

  // Modes
  type Mode = 'select' | 'connect'
  const [mode, setMode] = useState<Mode>('select')
  const [linkSource, setLinkSource] = useState<number | null>(null)

  // Edit block panel
  const [editingBlock, setEditingBlock] = useState<CampaignMapBlockData | null>(null)
  const [editTitle, setEditTitle] = useState('')
  const [editInfluences, setEditInfluences] = useState<number[]>([])
  const [editSaving, setEditSaving] = useState(false)

  // Link hover
  const [hoveredLinkId, setHoveredLinkId] = useState<number | null>(null)

  const factions: string[] = mapData ? JSON.parse(mapData.factions) : []
  const N = mapData?.maxInfluence ?? maxInfluence
  const hasBlocks = (mapData?.blocks.length ?? 0) > 0

  // ---- Load / create ----
  const loadMap = async () => {
    setLoading(true)
    const res = await fetch(`/api/campaign-map/${eventId}`, { headers: { Authorization: `Bearer ${token}` } })
    if (res.ok) {
      const data: CampaignMapData = await res.json()
      setMapData(data)
      setMaxInfluence(data.maxInfluence)
      setFactionsRaw(JSON.parse(data.factions).length > 0 ? JSON.parse(data.factions) : [''])
    } else if (res.status === 404) {
      setMapData(null)
    } else {
      setError('Ошибка загрузки карты.')
    }
    setLoading(false)
  }

  useEffect(() => {
    loadMap()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventId])

  const createMap = async () => {
    const facs = factionsRaw.map(f => f.trim()).filter(f => f)
    if (facs.length === 0 || maxInfluence < 1) { setSettingsError('Укажите хотя бы одну фракцию и N ≥ 1'); return }
    setSettingsSaving(true)
    const res = await fetch(`/api/campaign-map/${eventId}`, {
      method: 'POST', headers: authHeader,
      body: JSON.stringify({ maxInfluence, factions: facs })
    })
    if (res.ok) { await loadMap(); setSettingsError('') }
    else { setSettingsError((await res.json())?.title ?? 'Ошибка создания карты') }
    setSettingsSaving(false)
  }

  const saveSettings = async () => {
    if (!mapData) return
    const facs = factionsRaw.map(f => f.trim()).filter(f => f)
    if (facs.length === 0 || maxInfluence < 1) { setSettingsError('Укажите хотя бы одну фракцию и N ≥ 1'); return }
    setSettingsSaving(true)
    const res = await fetch(`/api/campaign-map/${eventId}/settings`, {
      method: 'PUT', headers: authHeader,
      body: JSON.stringify({ maxInfluence, factions: facs })
    })
    if (res.ok) { await loadMap(); setSettingsError('') }
    else { setSettingsError('Нельзя менять настройки: на карте уже есть блоки.') }
    setSettingsSaving(false)
  }

  // ---- Blocks ----
  const addBlock = async () => {
    if (!mapData) return
    const res = await fetch(`/api/campaign-map/${eventId}/blocks`, {
      method: 'POST', headers: authHeader,
      body: JSON.stringify({ title: 'Новая территория', posX: CANVAS_W / 2 - BLOCK_W / 2, posY: CANVAS_H / 2 - blockHeight(factions.length) / 2 })
    })
    if (res.ok) { const b = await res.json(); setMapData(prev => prev ? { ...prev, blocks: [...prev.blocks, b] } : prev) }
  }

  const getBlockPos = (block: CampaignMapBlockData) => localPos[block.id] ?? { x: block.posX, y: block.posY }

  const onBlockMouseDown = (e: React.MouseEvent, block: CampaignMapBlockData) => {
    if (mode === 'connect') return
    e.preventDefault(); e.stopPropagation()
    const rect = containerRef.current!.getBoundingClientRect()
    const pos = getBlockPos(block)
    setDragging({ id: block.id, ox: e.clientX - rect.left - pos.x, oy: e.clientY - rect.top - pos.y })
  }

  const onMouseMove = useCallback((e: React.MouseEvent) => {
    if (!dragging || !containerRef.current) return
    const rect = containerRef.current.getBoundingClientRect()
    const x = Math.max(0, Math.min(CANVAS_W - BLOCK_W, e.clientX - rect.left - dragging.ox))
    const y = Math.max(0, Math.min(CANVAS_H - 80, e.clientY - rect.top - dragging.oy))
    setLocalPos(prev => ({ ...prev, [dragging.id]: { x, y } }))
  }, [dragging])

  const onMouseUp = useCallback(async () => {
    if (!dragging) return
    const pos = localPos[dragging.id]
    if (pos) {
      const block = mapData?.blocks.find(b => b.id === dragging.id)
      if (block) {
        const facs = block.factions
        const headers = { 'Authorization': `Bearer ${localStorage.getItem('token') || ''}`, 'Content-Type': 'application/json' }
        await fetch(`/api/campaign-map/${block.mapId}/blocks/${dragging.id}`, {
          method: 'PUT', headers,
          body: JSON.stringify({ title: block.title, posX: pos.x, posY: pos.y, factions: facs.map(f => ({ factionIndex: f.factionIndex, influence: f.influence })) })
        })
        setMapData(prev => prev ? { ...prev, blocks: prev.blocks.map(b => b.id === dragging.id ? { ...b, posX: pos.x, posY: pos.y } : b) } : prev)
      }
    }
    setDragging(null)
  }, [dragging, localPos, mapData])

  const onBlockClick = (e: React.MouseEvent, block: CampaignMapBlockData) => {
    if (dragging) return
    if (mode === 'connect') {
      if (linkSource === null) { setLinkSource(block.id) }
      else if (linkSource !== block.id) {
        createLink(linkSource, block.id)
        setLinkSource(null)
        setMode('select')
      }
      return
    }
    e.stopPropagation()
    openEditBlock(block)
  }

  const openEditBlock = (block: CampaignMapBlockData) => {
    setEditingBlock(block)
    setEditTitle(block.title)
    const infs = factions.map((_, i) => block.factions.find(f => f.factionIndex === i)?.influence ?? 0)
    setEditInfluences(infs)
  }

  const saveBlock = async () => {
    if (!editingBlock) return
    setEditSaving(true)
    const pos = localPos[editingBlock.id] ?? { x: editingBlock.posX, y: editingBlock.posY }
    const res = await fetch(`/api/campaign-map/${eventId}/blocks/${editingBlock.id}`, {
      method: 'PUT', headers: authHeader,
      body: JSON.stringify({
        title: editTitle, posX: pos.x, posY: pos.y,
        factions: factions.map((_, i) => ({ factionIndex: i, influence: editInfluences[i] ?? 0 }))
      })
    })
    if (res.ok) {
      const updated = await res.json()
      setMapData(prev => prev ? { ...prev, blocks: prev.blocks.map(b => b.id === updated.id ? updated : b) } : prev)
      setEditingBlock(null)
    }
    setEditSaving(false)
  }

  const deleteBlock = async () => {
    if (!editingBlock) return
    if (!window.confirm('Удалить блок и все его связи?')) return
    await fetch(`/api/campaign-map/${eventId}/blocks/${editingBlock.id}`, { method: 'DELETE', headers: authHeader })
    setMapData(prev => prev ? {
      ...prev,
      blocks: prev.blocks.filter(b => b.id !== editingBlock.id),
      links: prev.links.filter(l => l.fromBlockId !== editingBlock.id && l.toBlockId !== editingBlock.id)
    } : prev)
    setEditingBlock(null)
  }

  // ---- Links ----
  const createLink = async (from: number, to: number) => {
    const res = await fetch(`/api/campaign-map/${eventId}/links`, {
      method: 'POST', headers: authHeader,
      body: JSON.stringify({ fromBlockId: from, toBlockId: to })
    })
    if (res.ok) { const l = await res.json(); setMapData(prev => prev ? { ...prev, links: [...prev.links, l] } : prev) }
  }

  const deleteLink = async (linkId: number) => {
    if (!window.confirm('Удалить связь?')) return
    await fetch(`/api/campaign-map/${eventId}/links/${linkId}`, { method: 'DELETE', headers: authHeader })
    setMapData(prev => prev ? { ...prev, links: prev.links.filter(l => l.id !== linkId) } : prev)
    setHoveredLinkId(null)
  }

  // ---- Render ----
  const canvasCursor = mode === 'connect' ? (linkSource ? 'crosshair' : 'pointer') : dragging ? 'grabbing' : 'default'

  const overlayStyle: React.CSSProperties = {
    position: 'fixed', inset: 0, background: '#0a0a1a', zIndex: 2000,
    display: 'flex', flexDirection: 'column'
  }

  if (loading) return (
    <div style={overlayStyle}>
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#aaa', fontSize: 20 }}>Загрузка...</div>
    </div>
  )

  if (error) return (
    <div style={overlayStyle}>
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 12 }}>
        <span style={{ color: '#e94560', fontSize: 16 }}>{error}</span>
        <button style={{ ...btnStyle, background: '#c0392b' }} onClick={onClose}>Закрыть</button>
      </div>
    </div>
  )

  return (
    <div style={overlayStyle}>
      {/* Header */}
      <div style={{ background: '#16213e', borderBottom: '1px solid #0f3460', padding: '8px 16px', display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0, flexWrap: 'wrap' }}>
        <span style={{ color: '#eee', fontWeight: 'bold', fontSize: 15 }}>✏️ Редактор карты: {eventTitle}</span>
        {mapData && (
          <>
            <button style={{ ...btnStyle, background: '#1a5276' }} onClick={addBlock}>+ Блок</button>
            <button
              style={{ ...btnStyle, background: mode === 'connect' ? (linkSource ? '#e94560' : '#c27c00') : '#1a6e3c' }}
              onClick={() => { setMode(m => m === 'connect' ? 'select' : 'connect'); setLinkSource(null) }}
            >
              {mode === 'connect' ? (linkSource ? '✕ Отменить связь' : '✕ Режим связей') : '→ Соединить'}
            </button>
            {mode === 'connect' && linkSource && (
              <span style={{ color: '#ffc107', fontSize: 13 }}>Выберите целевой блок…</span>
            )}
            {mode === 'connect' && !linkSource && (
              <span style={{ color: '#aaa', fontSize: 13 }}>Нажмите на блок-источник, затем на цель</span>
            )}
          </>
        )}
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
          <button onClick={onClose} style={{ ...btnStyle, background: '#c0392b' }}>✕ Закрыть</button>
        </div>
      </div>

      {/* Body: settings + canvas */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>

        {/* Settings panel */}
        <div style={{ width: 240, background: '#0f1e3d', borderRight: '1px solid #1a3a6a', padding: 14, overflowY: 'auto', flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ color: '#eee', fontWeight: 'bold', fontSize: 14, marginBottom: 4 }}>⚙️ Настройки карты</div>

          {/* MaxInfluence */}
          <div>
            <label style={{ color: '#aaa', fontSize: 12 }}>N (макс. влияние)</label>
            <input type="number" min={1} max={20} value={maxInfluence}
              disabled={hasBlocks}
              onChange={e => setMaxInfluence(Number(e.target.value))}
              style={{ ...inputStyle, width: '100%', marginTop: 3, opacity: hasBlocks ? 0.5 : 1 }} />
          </div>

          {/* Factions */}
          <div>
            <label style={{ color: '#aaa', fontSize: 12 }}>Фракции (M строк)</label>
            {factionsRaw.map((f, i) => (
              <div key={i} style={{ display: 'flex', gap: 4, marginTop: 4 }}>
                <input value={f} disabled={hasBlocks}
                  onChange={e => setFactionsRaw(prev => prev.map((v, j) => j === i ? e.target.value : v))}
                  style={{ ...inputStyle, flex: 1, opacity: hasBlocks ? 0.5 : 1 }} />
                {!hasBlocks && factionsRaw.length > 1 && (
                  <button onClick={() => setFactionsRaw(prev => prev.filter((_, j) => j !== i))}
                    style={{ ...btnStyle, background: '#c0392b', padding: '4px 8px' }}>×</button>
                )}
              </div>
            ))}
            {!hasBlocks && (
              <button onClick={() => setFactionsRaw(prev => [...prev, ''])}
                style={{ ...btnStyle, background: '#1a5276', fontSize: 12, marginTop: 6, width: '100%' }}>+ Фракция</button>
            )}
          </div>

          {settingsError && <div style={{ color: '#e94560', fontSize: 12 }}>{settingsError}</div>}
          {hasBlocks && <div style={{ color: '#888', fontSize: 11 }}>Настройки заблокированы: на карте есть блоки.</div>}

          {!mapData ? (
            <button style={{ ...btnStyle, background: '#4caf50', width: '100%' }} onClick={createMap} disabled={settingsSaving}>
              {settingsSaving ? 'Создание...' : '✓ Создать карту'}
            </button>
          ) : (
            <button style={{ ...btnStyle, background: hasBlocks ? '#555' : '#4caf50', width: '100%' }}
              onClick={saveSettings} disabled={hasBlocks || settingsSaving}>
              {settingsSaving ? 'Сохранение...' : '✓ Сохранить настройки'}
            </button>
          )}
        </div>

        {/* Canvas */}
        <div style={{ flex: 1, overflow: 'auto', position: 'relative', background: '#0a0a1a' }}>
          {!mapData ? (
            <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', color: '#555', fontSize: 18, textAlign: 'center' }}>
              Настройте параметры и создайте карту
            </div>
          ) : (
            <div ref={containerRef}
              style={{ position: 'relative', width: CANVAS_W, height: CANVAS_H, cursor: canvasCursor }}
              onMouseMove={onMouseMove}
              onMouseUp={onMouseUp}
              onMouseLeave={onMouseUp}
            >
              {/* SVG links */}
              <svg style={{ position: 'absolute', left: 0, top: 0, width: CANVAS_W, height: CANVAS_H, pointerEvents: 'none', overflow: 'visible', zIndex: 1 }}>
                <defs>
                  <marker id="arrow-ed" markerWidth="8" markerHeight="8" refX="4" refY="4" orient="auto">
                    <path d="M0,0 L8,4 L0,8 Z" fill="#7eb8f7" />
                  </marker>
                  <marker id="arrow-ed-hover" markerWidth="8" markerHeight="8" refX="4" refY="4" orient="auto">
                    <path d="M0,0 L8,4 L0,8 Z" fill="#e94560" />
                  </marker>
                </defs>
                {mapData.links.map(link => {
                  const from = mapData.blocks.find(b => b.id === link.fromBlockId)
                  const to = mapData.blocks.find(b => b.id === link.toBlockId)
                  if (!from || !to) return null
                  const fp = getBlockPos(from)
                  const tp = getBlockPos(to)
                  const fc = { x: fp.x + BLOCK_W / 2, y: fp.y + blockHeight(factions.length) / 2 }
                  const tc = { x: tp.x + BLOCK_W / 2, y: tp.y + blockHeight(factions.length) / 2 }
                  const isHovered = hoveredLinkId === link.id
                  return (
                    <line key={link.id}
                      x1={fc.x} y1={fc.y} x2={tc.x} y2={tc.y}
                      stroke={isHovered ? '#e94560' : '#7eb8f7'}
                      strokeWidth={isHovered ? 4 : 2}
                      markerEnd={isHovered ? 'url(#arrow-ed-hover)' : 'url(#arrow-ed)'}
                      style={{ pointerEvents: 'stroke', cursor: 'pointer' }}
                      onMouseEnter={() => setHoveredLinkId(link.id)}
                      onMouseLeave={() => setHoveredLinkId(null)}
                      onClick={() => deleteLink(link.id)}
                    />
                  )
                })}
              </svg>

              {/* Blocks */}
              {mapData.blocks.map(block => {
                const pos = getBlockPos(block)
                const bh = blockHeight(factions.length)
                const isSource = linkSource === block.id
                const isSelected = editingBlock?.id === block.id
                return (
                  <div key={block.id}
                    onMouseDown={e => onBlockMouseDown(e, block)}
                    onClick={e => onBlockClick(e, block)}
                    style={{
                      position: 'absolute', left: pos.x, top: pos.y,
                      width: BLOCK_W, height: bh,
                      border: `2px solid ${isSource ? '#ffc107' : isSelected ? '#e94560' : '#533483'}`,
                      borderRadius: 4, background: '#0a0a1a', overflow: 'hidden',
                      cursor: mode === 'connect' ? 'pointer' : 'grab',
                      boxSizing: 'border-box', zIndex: 2,
                      boxShadow: isSource ? '0 0 12px rgba(255,193,7,0.5)' : isSelected ? '0 0 10px rgba(233,69,96,0.4)' : 'none'
                    }}
                  >
                    <div style={{
                      height: BLOCK_HEADER_H, background: '#16213e',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 11, fontWeight: 'bold', color: '#eee',
                      padding: '0 4px', textAlign: 'center',
                      whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                      borderBottom: '1px solid #533483', userSelect: 'none'
                    }} title={block.title}>
                      {block.title || '—'}
                    </div>
                    {factions.map((_, fi) => {
                      const fdata = block.factions.find(f => f.factionIndex === fi)
                      const influence = fdata?.influence ?? 0
                      const color = FACTION_COLORS[fi % FACTION_COLORS.length]
                      return (
                        <div key={fi} style={{ display: 'flex', height: BLOCK_CELL }}>
                          {Array.from({ length: N }).map((__, j) => (
                            <div key={j} style={{
                              flex: 1, height: BLOCK_CELL,
                              background: influence >= j + 1 ? color : 'rgba(255,255,255,0.04)',
                              borderRight: j < N - 1 ? '1px solid rgba(255,255,255,0.07)' : 'none',
                              borderBottom: fi < factions.length - 1 ? '1px solid rgba(255,255,255,0.07)' : 'none'
                            }} />
                          ))}
                        </div>
                      )
                    })}
                  </div>
                )
              })}

              {mapData.blocks.length === 0 && (
                <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', color: '#555', fontSize: 18, pointerEvents: 'none', textAlign: 'center' }}>
                  Нажмите «+ Блок» для добавления территорий
                </div>
              )}
            </div>
          )}
        </div>

        {/* Block edit panel */}
        {editingBlock && (
          <div style={{ width: 220, background: '#0f1e3d', borderLeft: '1px solid #1a3a6a', padding: 14, overflowY: 'auto', flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ color: '#eee', fontWeight: 'bold', fontSize: 14 }}>📝 Блок</span>
              <button onClick={() => setEditingBlock(null)} style={{ background: 'none', border: 'none', color: '#aaa', fontSize: 18, cursor: 'pointer', lineHeight: 1 }}>✕</button>
            </div>

            <div>
              <label style={{ color: '#aaa', fontSize: 12 }}>Название</label>
              <input value={editTitle} onChange={e => setEditTitle(e.target.value)}
                style={{ ...inputStyle, width: '100%', marginTop: 3 }} maxLength={200} />
            </div>

            {factions.map((name, i) => (
              <div key={i}>
                <label style={{ color: FACTION_COLORS[i % FACTION_COLORS.length], fontSize: 12 }}>{name}: {editInfluences[i] ?? 0}/{N}</label>
                <input type="range" min={0} max={N} value={editInfluences[i] ?? 0}
                  onChange={e => setEditInfluences(prev => { const a = [...prev]; a[i] = Number(e.target.value); return a })}
                  style={{ width: '100%', marginTop: 3, accentColor: FACTION_COLORS[i % FACTION_COLORS.length] }} />
              </div>
            ))}

            <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
              <button style={{ ...btnStyle, background: '#4caf50', flex: 1 }} onClick={saveBlock} disabled={editSaving}>
                {editSaving ? '...' : '✓ Сохранить'}
              </button>
              <button style={{ ...btnStyle, background: '#c0392b' }} onClick={deleteBlock} title="Удалить блок">🗑</button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
