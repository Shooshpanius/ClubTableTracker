interface GameTable { id: number; number: string; size: string; supportedGames: string; x: number; y: number; width: number; height: number }
interface Booking { id: number; tableId: number; user: { id: string; name: string }; participants: { id: string; name: string }[] }
interface ClubDecoration { id: number; type: 'wall' | 'window' | 'door'; x: number; y: number; width: number; height: number }

interface Props {
  tables: GameTable[]
  bookings: Booking[]
  decorations?: ClubDecoration[]
  onTableClick: (table: GameTable) => void
  selectedTableId?: number
}

export default function ClubMap({ tables, bookings, decorations = [], onTableClick, selectedTableId }: Props) {
  const getBookingCount = (tableId: number) =>
    bookings.filter(b => b.tableId === tableId).reduce((acc, b) => acc + 1 + b.participants.length, 0)

  const decoVisual = (type: 'wall' | 'window' | 'door') => {
    if (type === 'wall') return { background: '#4a4a4a', border: '2px solid #222' }
    if (type === 'window') return { background: 'rgba(100, 200, 255, 0.2)', border: '2px dashed #64c8ff' }
    return { background: 'rgba(255, 200, 100, 0.2)', border: '2px dashed #ffc864' }
  }

  return (
    <div style={{ background: '#0a0a1a', border: '1px solid #0f3460', borderRadius: 8, overflow: 'auto' }}>
      <div style={{ position: 'relative', width: 800, height: 500, minWidth: 800 }}>
        {decorations.map(deco => (
          <div key={`deco-${deco.id}`}
            style={{
              position: 'absolute', left: deco.x, top: deco.y,
              width: deco.width, height: deco.height,
              ...decoVisual(deco.type),
              boxSizing: 'border-box', zIndex: 1
            }} />
        ))}
        {tables.map(table => {
          const count = getBookingCount(table.id)
          const color = count === 0 ? '#1a4a1a' : count >= 2 ? '#4a1a1a' : '#4a4a1a'
          const borderColor = table.id === selectedTableId ? '#e94560' : '#0f3460'
          return (
            <div key={table.id}
              onClick={() => onTableClick(table)}
              style={{
                position: 'absolute',
                left: table.x, top: table.y,
                width: table.width, height: table.height,
                background: color, border: `2px solid ${borderColor}`,
                borderRadius: 4, cursor: 'pointer',
                display: 'flex', flexDirection: 'column',
                alignItems: 'center', justifyContent: 'center',
                color: '#eee', fontSize: 12, userSelect: 'none',
                transition: 'border-color 0.2s', zIndex: 2
              }}>
              <div style={{ fontWeight: 'bold' }}>#{table.number}</div>
              <div style={{ fontSize: 10, color: '#aaa' }}>{table.size}</div>
              <div style={{ fontSize: 10 }}>{count > 0 ? `${count}/2 players` : 'Free'}</div>
            </div>
          )
        })}
        {tables.length === 0 && (
          <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', color: '#555', fontSize: 18 }}>
            No tables configured
          </div>
        )}
      </div>
    </div>
  )
}
