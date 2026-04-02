import { useState, useRef, useCallback } from 'react'

const CANVAS_WIDTH = 800
const CANVAS_HEIGHT = 500
const MIN_DECORATION_SIZE = 10

interface GameTable { id: number; number: string; size: string; supportedGames: string; x: number; y: number; width: number; height: number }
interface ClubDecoration { id: number; type: 'wall' | 'window' | 'door'; x: number; y: number; width: number; height: number }

type DrawMode = 'wall' | 'window' | 'door' | null

interface Props {
  tables: GameTable[]
  decorations: ClubDecoration[]
  onPositionChange: (id: number, x: number, y: number) => void
  onTableClick: (table: GameTable) => void
  onAddDecoration: (type: 'wall' | 'window' | 'door', x: number, y: number, width: number, height: number) => void
  onMoveDecoration: (id: number, x: number, y: number) => void
  onDeleteDecoration: (id: number) => void
}

export default function ClubMapEditor({ tables, decorations, onPositionChange, onTableClick, onAddDecoration, onMoveDecoration, onDeleteDecoration }: Props) {
  const [dragging, setDragging] = useState<{ id: number; offsetX: number; offsetY: number } | null>(null)
  const [localPositions, setLocalPositions] = useState<Record<number, { x: number; y: number }>>({})
  const [draggingDeco, setDraggingDeco] = useState<{ id: number; offsetX: number; offsetY: number } | null>(null)
  const [localDecoPositions, setLocalDecoPositions] = useState<Record<number, { x: number; y: number }>>({})
  const [drawMode, setDrawMode] = useState<DrawMode>(null)
  const [drawStart, setDrawStart] = useState<{ x: number; y: number } | null>(null)
  const [drawPreview, setDrawPreview] = useState<{ x: number; y: number; width: number; height: number } | null>(null)
  const [selectedDecoId, setSelectedDecoId] = useState<number | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  const getPos = (table: GameTable) => localPositions[table.id] ?? { x: table.x, y: table.y }
  const getDecoPos = (deco: ClubDecoration) => localDecoPositions[deco.id] ?? { x: deco.x, y: deco.y }

  const onTableMouseDown = (e: React.MouseEvent, table: GameTable) => {
    if (drawMode) return
    e.preventDefault()
    e.stopPropagation()
    const rect = containerRef.current!.getBoundingClientRect()
    const pos = getPos(table)
    setDragging({ id: table.id, offsetX: e.clientX - rect.left - pos.x, offsetY: e.clientY - rect.top - pos.y })
    setSelectedDecoId(null)
  }

  const onDecoMouseDown = (e: React.MouseEvent, deco: ClubDecoration) => {
    if (drawMode) return
    e.preventDefault()
    e.stopPropagation()
    const rect = containerRef.current!.getBoundingClientRect()
    const pos = getDecoPos(deco)
    setDraggingDeco({ id: deco.id, offsetX: e.clientX - rect.left - pos.x, offsetY: e.clientY - rect.top - pos.y })
    setSelectedDecoId(deco.id)
  }

  const onCanvasMouseDown = (e: React.MouseEvent) => {
    if (!drawMode || !containerRef.current) return
    const rect = containerRef.current.getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top
    setDrawStart({ x, y })
    setDrawPreview({ x, y, width: 0, height: 0 })
    setSelectedDecoId(null)
  }

  const onMouseMove = useCallback((e: React.MouseEvent) => {
    if (!containerRef.current) return
    const rect = containerRef.current.getBoundingClientRect()
    if (dragging) {
      const x = Math.max(0, Math.min(CANVAS_WIDTH - 100, e.clientX - rect.left - dragging.offsetX))
      const y = Math.max(0, Math.min(CANVAS_HEIGHT - 60, e.clientY - rect.top - dragging.offsetY))
      setLocalPositions(prev => ({ ...prev, [dragging.id]: { x, y } }))
    }
    if (draggingDeco) {
      const x = Math.max(0, Math.min(CANVAS_WIDTH - 10, e.clientX - rect.left - draggingDeco.offsetX))
      const y = Math.max(0, Math.min(CANVAS_HEIGHT - 10, e.clientY - rect.top - draggingDeco.offsetY))
      setLocalDecoPositions(prev => ({ ...prev, [draggingDeco.id]: { x, y } }))
    }
    if (drawStart) {
      const curX = Math.max(0, Math.min(CANVAS_WIDTH, e.clientX - rect.left))
      const curY = Math.max(0, Math.min(CANVAS_HEIGHT, e.clientY - rect.top))
      setDrawPreview({
        x: Math.min(drawStart.x, curX),
        y: Math.min(drawStart.y, curY),
        width: Math.abs(curX - drawStart.x),
        height: Math.abs(curY - drawStart.y)
      })
    }
  }, [dragging, draggingDeco, drawStart])

  const onMouseUp = useCallback(() => {
    if (dragging) {
      const pos = localPositions[dragging.id]
      if (pos) onPositionChange(dragging.id, pos.x, pos.y)
      setDragging(null)
    }
    if (draggingDeco) {
      const pos = localDecoPositions[draggingDeco.id]
      if (pos) onMoveDecoration(draggingDeco.id, pos.x, pos.y)
      setDraggingDeco(null)
    }
    if (drawStart && drawPreview && drawMode) {
      if (drawPreview.width >= MIN_DECORATION_SIZE && drawPreview.height >= MIN_DECORATION_SIZE) {
        onAddDecoration(drawMode, drawPreview.x, drawPreview.y, drawPreview.width, drawPreview.height)
      }
      setDrawStart(null)
      setDrawPreview(null)
    }
  }, [dragging, draggingDeco, drawStart, drawPreview, drawMode, localPositions, localDecoPositions, onPositionChange, onMoveDecoration, onAddDecoration])

  const decoVisual = (type: 'wall' | 'window' | 'door') => {
    if (type === 'wall') return { background: '#4a4a4a', border: '2px solid #222', color: '#ccc' }
    if (type === 'window') return { background: 'rgba(100, 200, 255, 0.2)', border: '2px dashed #64c8ff', color: '#64c8ff' }
    return { background: 'rgba(255, 200, 100, 0.2)', border: '2px dashed #ffc864', color: '#ffc864' }
  }

  const decoLabel = (type: string) => type === 'wall' ? 'Стена' : type === 'window' ? 'Окно' : 'Дверь'

  const drawBtnStyle = (mode: DrawMode): React.CSSProperties => ({
    background: drawMode === mode ? '#533483' : '#1a2a4a',
    color: '#fff', border: '1px solid #533483', padding: '6px 14px',
    borderRadius: 4, cursor: 'pointer', fontSize: 13
  })

  const canvasCursor = drawMode ? 'crosshair' : (dragging || draggingDeco) ? 'grabbing' : 'default'

  return (
    <div style={{ background: '#0a0a1a', border: '1px solid #0f3460', borderRadius: 8, overflow: 'hidden' }}>
      <div style={{ padding: '8px 12px', background: '#16213e', display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 6 }}>
        <span style={{ color: '#aaa', fontSize: 13 }}>Добавить:</span>
        <button style={drawBtnStyle('wall')} onClick={() => setDrawMode(drawMode === 'wall' ? null : 'wall')}>🧱 Стена</button>
        <button style={drawBtnStyle('window')} onClick={() => setDrawMode(drawMode === 'window' ? null : 'window')}>🪟 Окно</button>
        <button style={drawBtnStyle('door')} onClick={() => setDrawMode(drawMode === 'door' ? null : 'door')}>🚪 Дверь</button>
        {selectedDecoId !== null && (
          <button style={{ background: '#e94560', color: '#fff', border: 'none', padding: '6px 14px', borderRadius: 4, cursor: 'pointer', fontSize: 13, marginLeft: 8 }}
            onClick={() => { onDeleteDecoration(selectedDecoId); setSelectedDecoId(null) }}>
            🗑 Удалить
          </button>
        )}
        <span style={{ color: drawMode ? '#ffc107' : '#555', fontSize: 12, marginLeft: 4 }}>
          {drawMode ? 'Нарисуйте прямоугольник. Нажмите кнопку ещё раз для отмены.' : 'Перетаскивайте столы и элементы. Нажмите на элемент для выбора.'}
        </span>
      </div>
      <div ref={containerRef}
        style={{ position: 'relative', width: CANVAS_WIDTH, height: CANVAS_HEIGHT, cursor: canvasCursor }}
        onMouseMove={onMouseMove} onMouseUp={onMouseUp} onMouseLeave={onMouseUp}
        onMouseDown={onCanvasMouseDown}>
        {decorations.map(deco => {
          const pos = getDecoPos(deco)
          const visual = decoVisual(deco.type)
          const isSelected = selectedDecoId === deco.id
          return (
            <div key={`deco-${deco.id}`}
              onMouseDown={e => onDecoMouseDown(e, deco)}
              onClick={e => { e.stopPropagation(); if (!draggingDeco) setSelectedDecoId(deco.id) }}
              style={{
                position: 'absolute', left: pos.x, top: pos.y,
                width: deco.width, height: deco.height,
                ...visual,
                outline: isSelected ? '2px solid #e94560' : 'none',
                cursor: drawMode ? 'crosshair' : 'grab',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 11, userSelect: 'none', boxSizing: 'border-box', zIndex: 1
              }}>
              {deco.height > 20 && deco.width > 40 && (
                <span style={{ color: visual.color, opacity: 0.9 }}>{decoLabel(deco.type)}</span>
              )}
            </div>
          )
        })}
        {tables.map(table => {
          const pos = getPos(table)
          return (
            <div key={table.id}
              onMouseDown={e => onTableMouseDown(e, table)}
              onClick={() => !dragging && onTableClick(table)}
              style={{
                position: 'absolute', left: pos.x, top: pos.y,
                width: table.width, height: table.height,
                background: '#1a3a5c', border: '2px solid #533483',
                borderRadius: 4, cursor: drawMode ? 'crosshair' : 'grab',
                display: 'flex', flexDirection: 'column',
                alignItems: 'center', justifyContent: 'center',
                color: '#eee', fontSize: 12, userSelect: 'none', zIndex: 2
              }}>
              <div style={{ fontWeight: 'bold' }}>#{table.number}</div>
              <div style={{ fontSize: 10, color: '#aaa' }}>{table.size}</div>
            </div>
          )
        })}
        {drawPreview && drawMode && (
          <div style={{
            position: 'absolute', left: drawPreview.x, top: drawPreview.y,
            width: drawPreview.width, height: drawPreview.height,
            ...decoVisual(drawMode), opacity: 0.5, pointerEvents: 'none', zIndex: 10
          }} />
        )}
        {tables.length === 0 && decorations.length === 0 && (
          <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', color: '#555', fontSize: 18 }}>
            Add tables using the form below
          </div>
        )}
      </div>
    </div>
  )
}
