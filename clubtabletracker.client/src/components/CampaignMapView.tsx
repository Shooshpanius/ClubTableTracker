import { useState, useEffect, useRef, useCallback } from 'react'

const CANVAS_W = 1200
const CANVAS_H = 700
const BLOCK_CELL = 20
const BLOCK_HEADER_H = 24

function blockWidth(factionsCount: number) {
  return Math.max(1, factionsCount) * BLOCK_CELL
}

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

function blockHeight(maxInfluence: number) {
  return BLOCK_HEADER_H + Math.max(1, maxInfluence) * BLOCK_CELL
}

function blockCenter(block: CampaignMapBlockData, maxInfluence: number, factionsCount: number) {
  return { x: block.posX + blockWidth(factionsCount) / 2, y: block.posY + blockHeight(maxInfluence) / 2 }
}

export default function CampaignMapView({ eventId, eventTitle, onClose }: Props) {
  const [mapData, setMapData] = useState<CampaignMapData | null>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [tooltip, setTooltip] = useState<{ block: CampaignMapBlockData; x: number; y: number } | null>(null)
  const [scale, setScale] = useState(1)
  const [pan, setPan] = useState({ x: 0, y: 0 })
  const [panning, setPanning] = useState(false)
  const panStart = useRef<{ mx: number; my: number; px: number; py: number } | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  // Refs to access latest pan/scale inside passive-false touch handlers without stale closures
  const panRef = useRef({ x: 0, y: 0 })
  const scaleRef = useRef(1)
  useEffect(() => { panRef.current = pan }, [pan])
  useEffect(() => { scaleRef.current = scale }, [scale])

  // Touch gesture state
  const touchRef = useRef<{
    type: 'pan'; startTX: number; startTY: number; startPX: number; startPY: number
  } | {
    type: 'pinch'; startDist: number; startScale: number
  } | null>(null)

  const token = localStorage.getItem('token') || ''

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      const res = await fetch(`/api/campaign-map/${eventId}`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      if (res.ok) {
        setMapData(await res.json())
      } else if (res.status === 404) {
        setError('Карта кампании ещё не создана.')
      } else {
        setError('Ошибка загрузки карты.')
      }
      setLoading(false)
    }
    load()
  }, [eventId, token])

  const factions: string[] = mapData ? JSON.parse(mapData.factions) : []
  const N = mapData?.maxInfluence ?? 0

  const onWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault()
    setScale(s => Math.max(0.3, Math.min(3, s - e.deltaY * 0.001)))
  }, [])

  const onMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button !== 0) return
    setPanning(true)
    panStart.current = { mx: e.clientX, my: e.clientY, px: pan.x, py: pan.y }
  }, [pan])

  const onMouseMove = useCallback((e: React.MouseEvent) => {
    if (!panning || !panStart.current) return
    setPan({ x: panStart.current.px + e.clientX - panStart.current.mx, y: panStart.current.py + e.clientY - panStart.current.my })
  }, [panning])

  const onMouseUp = useCallback(() => { setPanning(false); panStart.current = null }, [])

  // Touch event listeners (passive:false so we can call preventDefault and suppress native scroll)
  useEffect(() => {
    const el = containerRef.current
    if (!el) return

    const onTouchStart = (e: TouchEvent) => {
      e.preventDefault()
      if (e.touches.length === 1) {
        const t = e.touches[0]
        touchRef.current = {
          type: 'pan',
          startTX: t.clientX, startTY: t.clientY,
          startPX: panRef.current.x, startPY: panRef.current.y
        }
      } else if (e.touches.length >= 2) {
        const t1 = e.touches[0], t2 = e.touches[1]
        const dx = t2.clientX - t1.clientX, dy = t2.clientY - t1.clientY
        touchRef.current = {
          type: 'pinch',
          startDist: Math.sqrt(dx * dx + dy * dy),
          startScale: scaleRef.current
        }
      }
    }

    const onTouchMove = (e: TouchEvent) => {
      e.preventDefault()
      const ts = touchRef.current
      if (!ts) return
      if (ts.type === 'pan' && e.touches.length === 1) {
        const t = e.touches[0]
        setPan({ x: ts.startPX + t.clientX - ts.startTX, y: ts.startPY + t.clientY - ts.startTY })
      } else if (ts.type === 'pinch' && e.touches.length >= 2) {
        const t1 = e.touches[0], t2 = e.touches[1]
        const dx = t2.clientX - t1.clientX, dy = t2.clientY - t1.clientY
        const dist = Math.sqrt(dx * dx + dy * dy)
        setScale(Math.max(0.3, Math.min(3, ts.startScale * dist / ts.startDist)))
      }
    }

    const onTouchEnd = (e: TouchEvent) => {
      if (e.touches.length === 0) {
        touchRef.current = null
      } else if (e.touches.length === 1) {
        // Transition from pinch back to single-touch pan
        const t = e.touches[0]
        touchRef.current = {
          type: 'pan',
          startTX: t.clientX, startTY: t.clientY,
          startPX: panRef.current.x, startPY: panRef.current.y
        }
      }
    }

    el.addEventListener('touchstart', onTouchStart, { passive: false })
    el.addEventListener('touchmove', onTouchMove, { passive: false })
    el.addEventListener('touchend', onTouchEnd, { passive: false })
    el.addEventListener('touchcancel', onTouchEnd, { passive: false })
    return () => {
      el.removeEventListener('touchstart', onTouchStart)
      el.removeEventListener('touchmove', onTouchMove)
      el.removeEventListener('touchend', onTouchEnd)
      el.removeEventListener('touchcancel', onTouchEnd)
    }
  }, []) // runs once; reads pan/scale via refs

  const overlayStyle: React.CSSProperties = {
    position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.92)',
    zIndex: 2000, display: 'flex', flexDirection: 'column'
  }

  return (
    <div style={overlayStyle}>
      {/* Header */}
      <div style={{ background: '#16213e', borderBottom: '1px solid #0f3460', padding: '10px 16px', display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0 }}>
        <span style={{ color: '#eee', fontWeight: 'bold', fontSize: 16 }}>🗺️ Карта кампании: {eventTitle}</span>
        <span style={{ color: '#aaa', fontSize: 12, marginLeft: 'auto' }}>Колесо / два пальца — зум · Перетаскивание — прокрутка</span>
        <button onClick={onClose} style={{ background: '#e94560', color: '#fff', border: 'none', borderRadius: 4, padding: '6px 14px', cursor: 'pointer', fontWeight: 'bold', fontSize: 14 }}>✕ Закрыть</button>
      </div>

      {/* Body */}
      <div
        ref={containerRef}
        onWheel={onWheel}
        onMouseDown={onMouseDown}
        onMouseMove={onMouseMove}
        onMouseUp={onMouseUp}
        onMouseLeave={onMouseUp}
        style={{ flex: 1, overflow: 'hidden', cursor: panning ? 'grabbing' : 'grab', userSelect: 'none', position: 'relative', touchAction: 'none' }}
      >
        {loading && <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', color: '#aaa', fontSize: 18 }}>Загрузка...</div>}
        {error && <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', color: '#e94560', fontSize: 16 }}>{error}</div>}
        {mapData && (
          <div style={{ position: 'absolute', transformOrigin: '0 0', transform: `translate(${pan.x}px,${pan.y}px) scale(${scale})` }}>
            <svg style={{ position: 'absolute', left: 0, top: 0, width: CANVAS_W, height: CANVAS_H, pointerEvents: 'none', overflow: 'visible' }}>
              <defs>
                <marker id="arrow-ro" markerWidth="8" markerHeight="8" refX="4" refY="4" orient="auto">
                  <path d="M0,0 L8,4 L0,8 Z" fill="#7eb8f7" />
                </marker>
              </defs>
              {mapData.links.map(link => {
                const from = mapData.blocks.find(b => b.id === link.fromBlockId)
                const to = mapData.blocks.find(b => b.id === link.toBlockId)
                if (!from || !to) return null
                const fc = blockCenter(from, N, factions.length)
                const tc = blockCenter(to, N, factions.length)
                return (
                  <g key={link.id}>
                    <line x1={fc.x} y1={fc.y} x2={tc.x} y2={tc.y}
                      stroke="#7eb8f7" strokeWidth={2} markerEnd="url(#arrow-ro)" />
                  </g>
                )
              })}
            </svg>

            {mapData.blocks.map(block => {
              const bw = blockWidth(factions.length)
              const bh = blockHeight(N)
              return (
                <div
                  key={block.id}
                  onMouseEnter={() => setTooltip({ block, x: block.posX + bw + 8, y: block.posY })}
                  onMouseLeave={() => setTooltip(null)}
                  style={{
                    position: 'absolute', left: block.posX, top: block.posY,
                    width: bw, height: bh,
                    border: '2px solid #533483', borderRadius: 4,
                    background: '#0a0a1a', overflow: 'hidden',
                    boxSizing: 'border-box'
                  }}
                >
                  {/* Header */}
                  <div style={{
                    height: BLOCK_HEADER_H, background: '#16213e',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 11, fontWeight: 'bold', color: '#eee',
                    padding: '0 4px', textAlign: 'center', overflow: 'hidden',
                    whiteSpace: 'nowrap', textOverflow: 'ellipsis', borderBottom: '1px solid #533483'
                  }} title={block.title}>
                    {block.title || '—'}
                  </div>
                  {/* Grid — N rows top-to-bottom (level N..1), M columns (factions); fills bottom-to-top */}
                  {Array.from({ length: N }).map((_, rowIdx) => {
                    const level = N - rowIdx
                    return (
                      <div key={rowIdx} style={{ display: 'flex', height: BLOCK_CELL }}>
                        {factions.map((__, fi) => {
                          const fdata = block.factions.find(f => f.factionIndex === fi)
                          const influence = fdata?.influence ?? 0
                          const color = FACTION_COLORS[fi % FACTION_COLORS.length]
                          return (
                            <div key={fi} style={{
                              width: BLOCK_CELL, height: BLOCK_CELL,
                              background: influence >= level ? color : 'rgba(255,255,255,0.05)',
                              borderRight: fi < factions.length - 1 ? '1px solid rgba(255,255,255,0.08)' : 'none',
                              borderBottom: rowIdx < N - 1 ? '1px solid rgba(255,255,255,0.08)' : 'none'
                            }} />
                          )
                        })}
                      </div>
                    )
                  })}
                </div>
              )
            })}

            {/* Tooltip */}
            {tooltip && (() => {
              const block = tooltip.block
              const factionList = factions.map((name, i) => {
                const fd = block.factions.find(f => f.factionIndex === i)
                return { name, influence: fd?.influence ?? 0 }
              })
              return (
                <div style={{
                  position: 'absolute', left: tooltip.x, top: tooltip.y,
                  background: '#16213e', border: '1px solid #533483', borderRadius: 6,
                  padding: '8px 12px', minWidth: 140, zIndex: 100, pointerEvents: 'none',
                  boxShadow: '0 4px 16px rgba(0,0,0,0.5)'
                }}>
                  <div style={{ fontWeight: 'bold', color: '#eee', marginBottom: 6, fontSize: 13 }}>{block.title || '—'}</div>
                  {factionList.map((f, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3 }}>
                      <div style={{ width: 10, height: 10, borderRadius: 2, background: FACTION_COLORS[i % FACTION_COLORS.length], flexShrink: 0 }} />
                      <span style={{ color: '#ccc', fontSize: 12, flex: 1 }}>{f.name}</span>
                      <span style={{ color: '#ffc107', fontSize: 12, fontWeight: 'bold' }}>{f.influence}/{N}</span>
                    </div>
                  ))}
                </div>
              )
            })()}
          </div>
        )}
      </div>
    </div>
  )
}
