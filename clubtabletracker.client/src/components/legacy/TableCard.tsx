interface GameTable { id: number; number: string; size: string; supportedGames: string }

interface Props { table: GameTable; onClick?: () => void }

export default function TableCard({ table, onClick }: Props) {
  return (
    <div onClick={onClick} style={{
      background: '#16213e', border: '1px solid #0f3460', borderRadius: 8,
      padding: 16, cursor: onClick ? 'pointer' : 'default', marginBottom: 8
    }}>
      <h4 style={{ margin: '0 0 4px' }}>Table #{table.number}</h4>
      <div style={{ color: '#aaa', fontSize: 13 }}>Size: {table.size}</div>
      <div style={{ color: '#aaa', fontSize: 13 }}>Games: {table.supportedGames ? table.supportedGames.split('|').filter(Boolean).join(', ') : 'N/A'}</div>
    </div>
  )
}
