import type { DesignMode } from '../utils/useDesignMode'

interface DesignToggleProps {
  design: DesignMode
  onToggle: () => void
}

/**
 * Floating quick-toggle between Grimdark and the pre-migration legacy design.
 * Rendered above the routes on every page; styling is intentionally neutral
 * so the button stays visible in both designs.
 */
export default function DesignToggle({ design, onToggle }: DesignToggleProps) {
  const isLegacy = design === 'legacy'
  const label = isLegacy ? 'Переключить на дизайн Grimdark' : 'Переключить на легаси-дизайн'

  return (
    <button
      type="button"
      onClick={onToggle}
      aria-label={label}
      title={label}
      style={{
        position: 'fixed',
        right: 16,
        bottom: 16,
        zIndex: 9999,
        display: 'inline-flex',
        alignItems: 'center',
        gap: 8,
        padding: '10px 14px',
        borderRadius: 8,
        cursor: 'pointer',
        border: '1px solid rgba(255, 255, 255, 0.35)',
        background: isLegacy ? '#1a1a2e' : '#141018',
        color: isLegacy ? '#eee' : '#E8DCC8',
        fontFamily: 'system-ui, sans-serif',
        fontSize: 13,
        fontWeight: 600,
        boxShadow: '0 4px 12px rgba(0, 0, 0, 0.4)',
        opacity: 0.85,
      }}
    >
      {isLegacy ? '▣ Legacy → Grimdark' : '✠ Grimdark → Legacy'}
    </button>
  )
}
