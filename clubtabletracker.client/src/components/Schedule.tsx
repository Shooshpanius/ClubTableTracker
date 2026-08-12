interface Booking { id: number; tableId: number; startTime: string; endTime: string; user: { id: string; name: string }; participants: { id: string; name: string }[] }
interface GameTable { id: number; number: string; size: string }

interface Props {
  bookings: Booking[]
  tables: GameTable[]
}

export default function Schedule({ bookings, tables }: Props) {
  const cardStyle: React.CSSProperties = { background: 'var(--gd-surface)', border: '1px solid var(--gd-border)', borderRadius: 8, padding: 12, marginBottom: 8 }
  const sorted = [...bookings].sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime())

  return (
    <div>
      <h3>📅 Schedule</h3>
      {sorted.length === 0 && <p style={{ color: 'var(--gd-fg-muted)' }}>No bookings scheduled.</p>}
      {sorted.map(b => {
        const table = tables.find(t => t.id === b.tableId)
        return (
          <div key={b.id} style={cardStyle}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <strong>Table #{table?.number ?? b.tableId}</strong> — {table?.size}
                <div style={{ color: 'var(--gd-fg-muted)', fontSize: 13, marginTop: 4 }}>
                  {new Date(b.startTime).toLocaleString()} → {new Date(b.endTime).toLocaleString()}
                </div>
                <div style={{ marginTop: 4 }}>
                  <span style={{ color: 'var(--gd-success)' }}>👤 {b.user.name}</span>
                  {b.participants.map(p => <span key={p.id} style={{ color: 'var(--gd-success)', marginLeft: 8 }}>+ {p.name}</span>)}
                </div>
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}
