import { useState, useRef, useCallback } from 'react'

interface GameTable { id: number; number: string; size: string; supportedGames: string; x: number; y: number; width: number; height: number }

interface Props {
  tables: GameTable[]
  onPositionChange: (id: number, x: number, y: number) => void
  onTableClick: (table: GameTable) => void
}

export default function ClubMapEditor({ tables, onPositionChange, onTableClick }: Props) {
  const [dragging, setDragging] = useState<{ id: number; offsetX: number; offsetY: number } | null>(null)
  const [localPositions, setLocalPositions] = useState<Record<number, { x: number; y: number }>>({})
  const containerRef = useRef<HTMLDivElement>(null)

  const getPos = (table: GameTable) => localPositions[table.id] ?? { x: table.x, y: table.y }

  const onMouseDown = (e: React.MouseEvent, table: GameTable) => {
    e.preventDefault()
    const rect = containerRef.current!.getBoundingClientRect()
    const pos = getPos(table)
    setDragging({ id: table.id, offsetX: e.clientX - rect.left - pos.x, offsetY: e.clientY - rect.top - pos.y })
  }

  const onMouseMove = useCallback((e: React.MouseEvent) => {
    if (!dragging || !containerRef.current) return
    const rect = containerRef.current.getBoundingClientRect()
    const x = Math.max(0, Math.min(700, e.clientX - rect.left - dragging.offsetX))
    const y = Math.max(0, Math.min(440, e.clientY - rect.top - dragging.offsetY))
    setLocalPositions(prev => ({ ...prev, [dragging.id]: { x, y } }))
  }, [dragging])

  const onMouseUp = useCallback(() => {
    if (dragging) {
      const pos = localPositions[dragging.id]
      if (pos) onPositionChange(dragging.id, pos.x, pos.y)
      setDragging(null)
    }
  }, [dragging, localPositions, onPositionChange])

  return (
    <div style={{ background: '#0a0a1a', border: '1px solid #0f3460', borderRadius: 8, overflow: 'hidden' }}>
      <div style={{ padding: '8px 12px', background: '#16213e', color: '#aaa', fontSize: 13 }}>
        Drag tables to position them. Click to edit details.
      </div>
      <div ref={containerRef} style={{ position: 'relative', width: 800, height: 500, cursor: dragging ? 'grabbing' : 'default' }}
        onMouseMove={onMouseMove} onMouseUp={onMouseUp} onMouseLeave={onMouseUp}>
        {tables.map(table => {
          const pos = getPos(table)
          return (
            <div key={table.id}
              onMouseDown={e => onMouseDown(e, table)}
              onClick={() => !dragging && onTableClick(table)}
              style={{
                position: 'absolute', left: pos.x, top: pos.y,
                width: table.width, height: table.height,
                background: '#1a3a5c', border: '2px solid #533483',
                borderRadius: 4, cursor: 'grab',
                display: 'flex', flexDirection: 'column',
                alignItems: 'center', justifyContent: 'center',
                color: '#eee', fontSize: 12, userSelect: 'none'
              }}>
              <div style={{ fontWeight: 'bold' }}>#{table.number}</div>
              <div style={{ fontSize: 10, color: '#aaa' }}>{table.size}</div>
            </div>
          )
        })}
        {tables.length === 0 && (
          <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', color: '#555', fontSize: 18 }}>
            Add tables using the form below
          </div>
        )}
      </div>
    </div>
  )
}
