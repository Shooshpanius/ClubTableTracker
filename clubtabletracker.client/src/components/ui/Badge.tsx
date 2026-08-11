import type { ReactNode } from 'react'

export type BadgeTone = 'success' | 'warn' | 'danger' | 'blood' | 'brass' | 'neutral'

export interface BadgeProps {
  tone?: BadgeTone
  children?: ReactNode
  className?: string
}

const TONE_CLASS: Record<BadgeTone, string> = {
  success: 'gd-badge-success',
  warn: 'gd-badge-warn',
  danger: 'gd-badge-danger',
  blood: 'gd-badge-blood',
  brass: 'gd-badge-brass',
  neutral: 'gd-badge-neutral',
}

export function Badge({ tone = 'neutral', className, children }: BadgeProps) {
  return (
    <span className={['gd-badge', TONE_CLASS[tone], className].filter(Boolean).join(' ')}>
      {children}
    </span>
  )
}
