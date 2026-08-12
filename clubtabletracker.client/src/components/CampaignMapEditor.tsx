import { useState, useEffect, useRef, useCallback } from 'react'
import { Button } from './ui'

const CANVAS_W = 1400
const CANVAS_H = 800
const SEG_W = 35
const SEG_H = 30
const SEG_GAP_V = 2
const SEG_GAP_H = 3
const BLOCK_HEADER_H = 24

function blockWidth(factionsCount: number) {
  const m = Math.max(1, factionsCount)
  return m * SEG_W + (m - 1) * SEG_GAP_H
}

interface CampaignMapBlockFaction { id: number; factionIndex: number; influence: number }
interface CampaignMapBlockData {
  id: number; mapId: number; title: string; posX: number; posY: number
  factions: CampaignMapBlockFaction[]
}
interface CampaignMapLinkData { id: number; fromBlockId: number; toBlockId: number }
interface CampaignMapData {
  id: number; eventId: number; maxInfluence: number; factions: string
  factionColors: string
  blocks: CampaignMapBlockData[]
  links: CampaignMapLinkData[]
}

interface Props { eventId: number; eventTitle: string; onClose: () => void }

const FACTION_COLORS = ['#e94560','#4caf50','#2196f3','#ff9800','#9c27b0','#00bcd4','#f44336','#8bc34a']

function blockHeight(maxInfluence: number) {
  const n = Math.max(1, maxInfluence)
  return BLOCK_HEADER_H + n * SEG_H + (n - 1) * SEG_GAP_V
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
  const [factionColorsRaw, setFactionColorsRaw] = useState<string[]>([])

  // Block drag
  const [dragging, setDragging] = useState<{ id: number; ox: number; oy: number } | null>(null)
  const [localPos, setLocalPos] = useState<Record<number, { x: number; y: number }>>({})
  const containerRef = useRef<HTMLDivElement>(null)
  const colorSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  // Suppresses the trailing 'click' that fires right after a drag (mouseup→click),
  // so releasing a drag doesn't open the block-edit panel. Reset on the next mousedown.
  const suppressNextClickRef = useRef(false)
  // Whether the current press actually moved past a small threshold (a real drag).
  // Reset on mousedown; read on mouseup. Without this, a plain click after a previous
  // drag would still see a truthy localPos and be mistaken for a drag.
  const dragMovedRef = useRef(false)
  const dragStartRef = useRef<{ x: number; y: number } | null>(null)

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

  // Effective per-faction colors: stored value (with fallback to the default palette).
  // Used for block-grid rendering and the edit-panel accents.
  const factionColors: string[] = factions.map((_, i) => factionColorsRaw[i] || FACTION_COLORS[i % FACTION_COLORS.length])

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
    const colors = facs.map((_, i) => factionColorsRaw[i] || FACTION_COLORS[i % FACTION_COLORS.length])
    const res = await fetch(`/api/campaign-map/${eventId}`, {
      method: 'POST', headers: authHeader,
      body: JSON.stringify({ maxInfluence, factions: facs, factionColors: colors })
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
    const colors = facs.map((_, i) => factionColorsRaw[i] || FACTION_COLORS[i % FACTION_COLORS.length])
    const res = await fetch(`/api/campaign-map/${eventId}/settings`, {
      method: 'PUT', headers: authHeader,
      body: JSON.stringify({ maxInfluence, factions: facs, factionColors: colors })
    })
    if (res.ok) { await loadMap(); setSettingsError('') }
    else { setSettingsError('Нельзя менять настройки: на карте уже есть блоки.') }
    setSettingsSaving(false)
  }

  // Keep local color state in sync with the server whenever the map (re)loads.
  useEffect(() => {
    if (!mapData) return
    const facs: string[] = JSON.parse(mapData.factions)
    const stored: string[] = JSON.parse(mapData.factionColors || '[]')
    setFactionColorsRaw(facs.map((_, i) => stored[i] || FACTION_COLORS[i % FACTION_COLORS.length]))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mapData?.factionColors, mapData?.factions])

  // Save faction colors. Allowed even when blocks already exist (colors do not
  // affect block geometry). Debounced: the native color picker emits changes while dragging.
  const saveColors = (colors: string[]) => {
    if (!mapData) return
    if (colorSaveTimer.current) clearTimeout(colorSaveTimer.current)
    colorSaveTimer.current = setTimeout(async () => {
      const res = await fetch(`/api/campaign-map/${eventId}/colors`, {
        method: 'PUT', headers: authHeader,
        body: JSON.stringify({ colors })
      })
      if (res.ok) {
        const data = await res.json()
        setMapData(prev => prev ? { ...prev, factionColors: data.factionColors } : prev)
      } else {
        setSettingsError('Не удалось сохранить цвет фракции.')
      }
    }, 400)
  }

  // ---- Blocks ----
  const addBlock = async () => {
    if (!mapData) return
    const res = await fetch(`/api/campaign-map/${eventId}/blocks`, {
      method: 'POST', headers: authHeader,
      body: JSON.stringify({ title: 'Новая территория', posX: CANVAS_W / 2 - blockWidth(factions.length) / 2, posY: CANVAS_H / 2 - blockHeight(N) / 2 })
    })
    if (res.ok) { const b = await res.json(); setMapData(prev => prev ? { ...prev, blocks: [...prev.blocks, b] } : prev) }
  }

  const getBlockPos = (block: CampaignMapBlockData) => localPos[block.id] ?? { x: block.posX, y: block.posY }

  const onBlockMouseDown = (e: React.MouseEvent, block: CampaignMapBlockData) => {
    if (mode === 'connect') return
    e.preventDefault(); e.stopPropagation()
    suppressNextClickRef.current = false
    dragMovedRef.current = false
    dragStartRef.current = { x: e.clientX, y: e.clientY }
    const rect = containerRef.current!.getBoundingClientRect()
    const pos = getBlockPos(block)
    setDragging({ id: block.id, ox: e.clientX - rect.left - pos.x, oy: e.clientY - rect.top - pos.y })
  }

  const onMouseMove = useCallback((e: React.MouseEvent) => {
    if (!dragging || !containerRef.current) return
    // Only count it as a drag once the pointer moves past a small threshold,
    // so a plain click (with negligible jitter) isn't treated as a drag.
    if (!dragMovedRef.current && dragStartRef.current) {
      const dx = e.clientX - dragStartRef.current.x
      const dy = e.clientY - dragStartRef.current.y
      if (dx * dx + dy * dy < 16) return
      dragMovedRef.current = true
    }
    const rect = containerRef.current.getBoundingClientRect()
    const x = Math.max(0, Math.min(CANVAS_W - blockWidth(factions.length), e.clientX - rect.left - dragging.ox))
    const y = Math.max(0, Math.min(CANVAS_H - 80, e.clientY - rect.top - dragging.oy))
    setLocalPos(prev => ({ ...prev, [dragging.id]: { x, y } }))
  }, [dragging, factions.length])

  const onMouseUp = useCallback(async () => {
    const drag = dragging
    if (!drag) return
    const moved = dragMovedRef.current
    const pos = localPos[drag.id]
    // Clear drag state immediately so a pending (async) save doesn't block
    // subsequent clicks from selecting the block.
    setDragging(null)
    if (moved && pos) {
      const block = mapData?.blocks.find(b => b.id === drag.id)
      if (block) {
        // A real drag just ended — suppress the trailing 'click' the browser
        // dispatches right after mouseup, so releasing a drag won't open the panel.
        suppressNextClickRef.current = true
        const facs = block.factions
        const headers = { 'Authorization': `Bearer ${localStorage.getItem('token') || ''}`, 'Content-Type': 'application/json' }
        await fetch(`/api/campaign-map/${eventId}/blocks/${drag.id}`, {
          method: 'PUT', headers,
          body: JSON.stringify({ title: block.title, posX: pos.x, posY: pos.y, factions: facs.map(f => ({ factionIndex: f.factionIndex, influence: f.influence })) })
        })
        setMapData(prev => prev ? { ...prev, blocks: prev.blocks.map(b => b.id === drag.id ? { ...b, posX: pos.x, posY: pos.y } : b) } : prev)
      }
    }
  }, [dragging, localPos, mapData, eventId])

  const onBlockClick = (e: React.MouseEvent, block: CampaignMapBlockData) => {
    if (dragging) return
    if (suppressNextClickRef.current) { suppressNextClickRef.current = false; return }
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

  const blockBorder = (isSrc: boolean, isSel: boolean): string =>
    `2px solid ${isSrc ? 'var(--gd-warn)' : isSel ? 'var(--gd-blood-red)' : 'var(--gd-brass)'}`

  if (loading) return (
    <div className="gd-app gd-cmap-overlay">
      <div className="gd-cmap-center">Загрузка...</div>
    </div>
  )

  if (error) return (
    <div className="gd-app gd-cmap-overlay">
      <div className="gd-cmap-error">
        <span className="gd-error-text" style={{ fontSize: '1rem' }}>{error}</span>
        <Button variant="danger" size="sm" onClick={onClose}>Закрыть</Button>
      </div>
    </div>
  )

  return (
    <div className="gd-app gd-cmap-overlay">
      {/* Header */}
      <div className="gd-cmap-header">
        <span className="gd-cmap-title">✏️ Редактор карты: {eventTitle}</span>
        {mapData && (
          <>
            <Button variant="secondary" size="sm" onClick={addBlock}>+ Блок</Button>
            <Button
              variant={mode === 'connect' ? (linkSource ? 'danger' : 'brass') : 'primary'}
              size="sm"
              onClick={() => { setMode(m => m === 'connect' ? 'select' : 'connect'); setLinkSource(null) }}
            >
              {mode === 'connect' ? (linkSource ? '✕ Отменить связь' : '✕ Режим связей') : '→ Соединить'}
            </Button>
            {mode === 'connect' && linkSource && (
              <span className="gd-text-xs" style={{ color: 'var(--gd-warn)' }}>Выберите целевой блок…</span>
            )}
            {mode === 'connect' && !linkSource && (
              <span className="gd-text-xs gd-text-muted">Нажмите на блок-источник, затем на цель</span>
            )}
          </>
        )}
        <div style={{ marginLeft: 'auto' }}>
          <Button variant="danger" size="sm" onClick={onClose}>✕ Закрыть</Button>
        </div>
      </div>

      {/* Body: settings + canvas */}
      <div className="gd-cmap-body">

        {/* Settings panel */}
        <div className="gd-cmap-sidebar">
          <div className="gd-cmap-sidebar-title">⚙️ Настройки карты</div>

          {/* MaxInfluence */}
          <div>
            <label className="gd-cmap-label">N (макс. влияние)</label>
            <input type="number" min={1} max={20} value={maxInfluence}
              disabled={hasBlocks}
              onChange={e => setMaxInfluence(Number(e.target.value))}
              className="gd-input" style={{ width: '100%', marginTop: 'var(--gd-s1)', opacity: hasBlocks ? 0.5 : 1 }} />
          </div>

          {/* Factions */}
          <div>
            <label className="gd-cmap-label">Фракции (M строк)</label>
            {factionsRaw.map((f, i) => (
              <div key={i} className="gd-flex-row" style={{ gap: 'var(--gd-s1)', marginTop: 'var(--gd-s1)', alignItems: 'center' }}>
                <input type="color" aria-label="Цвет фракции" title="Цвет фракции"
                  value={factionColorsRaw[i] || FACTION_COLORS[i % FACTION_COLORS.length]}
                  onChange={e => {
                    const next = factionsRaw.map((_, j) => j === i ? e.target.value : (factionColorsRaw[j] || FACTION_COLORS[j % FACTION_COLORS.length]))
                    setFactionColorsRaw(next)
                    saveColors(next)
                  }}
                  className="gd-color-input" style={{ width: 30, height: 30, flexShrink: 0 }} />
                <input value={f} disabled={hasBlocks}
                  onChange={e => setFactionsRaw(prev => prev.map((v, j) => j === i ? e.target.value : v))}
                  className="gd-input" style={{ flex: 1, opacity: hasBlocks ? 0.5 : 1 }} />
                {!hasBlocks && factionsRaw.length > 1 && (
                  <Button variant="danger" size="xs" onClick={() => {
                    setFactionsRaw(prev => prev.filter((_, j) => j !== i))
                    setFactionColorsRaw(prev => prev.filter((_, j) => j !== i))
                  }}>×</Button>
                )}
              </div>
            ))}
            {!hasBlocks && (
              <Button variant="secondary" size="sm" onClick={() => {
                setFactionsRaw(prev => [...prev, ''])
                setFactionColorsRaw(prev => [...prev, FACTION_COLORS[factionsRaw.length % FACTION_COLORS.length]])
              }} style={{ marginTop: 'var(--gd-s1)', width: '100%' }}>+ Фракция</Button>
            )}
          </div>

          {settingsError && <div className="gd-error-text">{settingsError}</div>}
          {hasBlocks && <div className="gd-text-xs gd-text-muted">N и список фракций заблокированы (есть блоки). Цвета фракций менять можно.</div>}

          {!mapData ? (
            <Button variant="primary" size="sm" onClick={createMap} disabled={settingsSaving} style={{ width: '100%' }}>
              {settingsSaving ? 'Создание...' : '✓ Создать карту'}
            </Button>
          ) : (
            <Button variant={hasBlocks ? 'ghost' : 'primary'} size="sm"
              onClick={saveSettings} disabled={hasBlocks || settingsSaving} style={{ width: '100%' }}>
              {settingsSaving ? 'Сохранение...' : '✓ Сохранить настройки'}
            </Button>
          )}
        </div>

        {/* Canvas */}
        <div className="gd-cmap-canvas">
          {!mapData ? (
            <div className="gd-cmap-hint">
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
                    <path d="M0,0 L8,4 L0,8 Z" fill="var(--gd-blood-red)" />
                  </marker>
                </defs>
                {mapData.links.map(link => {
                  const from = mapData.blocks.find(b => b.id === link.fromBlockId)
                  const to = mapData.blocks.find(b => b.id === link.toBlockId)
                  if (!from || !to) return null
                  const fp = getBlockPos(from)
                  const tp = getBlockPos(to)
                  const fc = { x: fp.x + blockWidth(factions.length) / 2, y: fp.y + blockHeight(N) / 2 }
                  const tc = { x: tp.x + blockWidth(factions.length) / 2, y: tp.y + blockHeight(N) / 2 }
                  const isHovered = hoveredLinkId === link.id
                  return (
                    <line key={link.id}
                      x1={fc.x} y1={fc.y} x2={tc.x} y2={tc.y}
                      stroke={isHovered ? 'var(--gd-blood-red)' : '#7eb8f7'}
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
                const bh = blockHeight(N)
                const bw = blockWidth(factions.length)
                const isSource = linkSource === block.id
                const isSelected = editingBlock?.id === block.id
                return (
                  <div key={block.id}
                    onMouseDown={e => onBlockMouseDown(e, block)}
                    onClick={e => onBlockClick(e, block)}
                    className="gd-cmap-block"
                    style={{
                      position: 'absolute', left: pos.x, top: pos.y,
                      width: bw, height: bh,
                      border: blockBorder(isSource, isSelected),
                      cursor: mode === 'connect' ? 'pointer' : 'grab',
                      zIndex: 2,
                      boxShadow: isSource ? '0 0 12px rgba(196,144,48,0.5)' : isSelected ? '0 0 10px rgba(196,40,59,0.4)' : 'none'
                    }}
                  >
                    <div className="gd-cmap-block-header"
                      style={{
                        height: BLOCK_HEADER_H,
                        padding: '0 4px', textAlign: 'center',
                        whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis'
                      }} title={block.title}>
                      {block.title || '—'}
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: SEG_GAP_V }}>
                    {Array.from({ length: N }).map((_, rowIdx) => {
                      const level = N - rowIdx
                      return (
                        <div key={rowIdx} style={{ display: 'flex', gap: SEG_GAP_H }}>
                          {factions.map((__, fi) => {
                            const fdata = block.factions.find(f => f.factionIndex === fi)
                            const influence = fdata?.influence ?? 0
                            const color = factionColors[fi] || FACTION_COLORS[fi % FACTION_COLORS.length]
                            return (
                              <div key={fi} style={{
                                width: SEG_W, height: SEG_H,
                                background: influence >= level ? color : 'rgba(255,255,255,0.04)',
                                border: '2px solid var(--gd-fg-muted)',
                                borderRadius: 4,
                                boxSizing: 'border-box'
                              }} />
                            )
                          })}
                        </div>
                      )
                    })}
                    </div>
                  </div>
                )
              })}

              {mapData.blocks.length === 0 && (
                <div className="gd-cmap-hint">
                  Нажмите «+ Блок» для добавления территорий
                </div>
              )}
            </div>
          )}
        </div>

        {/* Block edit panel */}
        {editingBlock && (
          <div className="gd-cmap-edit-panel">
            <div className="gd-flex-between">
              <span className="gd-cmap-sidebar-title">📝 Блок</span>
              <button onClick={() => setEditingBlock(null)} className="gd-cmap-close">✕</button>
            </div>

            <div>
              <label className="gd-cmap-label">Название</label>
              <input value={editTitle} onChange={e => setEditTitle(e.target.value)}
                className="gd-input" style={{ width: '100%', marginTop: 'var(--gd-s1)' }} maxLength={200} />
            </div>

            {factions.map((name, i) => (
              <div key={i}>
                <label style={{ color: factionColors[i] || FACTION_COLORS[i % FACTION_COLORS.length], fontSize: 12 }}>{name}: {editInfluences[i] ?? 0}/{N}</label>
                <input type="range" min={0} max={N} value={editInfluences[i] ?? 0}
                  onChange={e => setEditInfluences(prev => { const a = [...prev]; a[i] = Number(e.target.value); return a })}
                  style={{ width: '100%', marginTop: 'var(--gd-s1)', accentColor: factionColors[i] || FACTION_COLORS[i % FACTION_COLORS.length] }} />
              </div>
            ))}

            <div className="gd-flex-row" style={{ gap: 'var(--gd-s2)', marginTop: 'var(--gd-s1)' }}>
              <Button variant="primary" size="sm" style={{ flex: 1 }} onClick={saveBlock} disabled={editSaving}>
                {editSaving ? '...' : '✓ Сохранить'}
              </Button>
              <Button variant="danger" size="sm" onClick={deleteBlock} title="Удалить блок">🗑</Button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
