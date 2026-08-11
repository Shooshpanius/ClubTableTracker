export type StatusTone = 'green' | 'amber' | 'red'

export interface StatusDotProps {
  tone: StatusTone
  className?: string
}

export function StatusDot({ tone, className }: StatusDotProps) {
  return <span className={['gd-status-dot', tone, className].filter(Boolean).join(' ')} aria-hidden />
}
