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
    if (type === 'wall') return { background: 'var(--gd-fg-muted)', border: '2px solid var(--gd-bg)' }
    if (type === 'window') return { background: 'rgba(100, 200, 255, 0.2)', border: '2px dashed var(--gd-brass)' }
    return { background: 'rgba(255, 200, 100, 0.2)', border: '2px dashed var(--gd-warn)' }
  }

  return (
    <div style={{ background: 'var(--gd-bg)', border: '1px solid var(--gd-border)', borderRadius: 8, overflow: 'auto' }}>
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
          const color = count === 0 ? 'var(--gd-success)' : count >= 2 ? 'var(--gd-danger)' : 'var(--gd-warn)'
          const borderColor = table.id === selectedTableId ? 'var(--gd-blood-red)' : 'var(--gd-border)'
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
                color: 'var(--gd-fg)', fontSize: 12, userSelect: 'none',
                transition: 'border-color 0.2s', zIndex: 2
              }}>
              <div style={{ fontWeight: 'bold' }}>#{table.number}</div>
              <div style={{ fontSize: 10, color: 'var(--gd-fg-muted)' }}>{table.size}</div>
            </div>
          )
        })}
        {tables.length === 0 && (
          <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', color: 'var(--gd-fg-muted)', fontSize: 18 }}>
            No tables configured
          </div>
        )}
      </div>
    </div>
  )
}
