import type { CSSProperties, ReactNode } from 'react'

export type AvatarSize = 'sm' | 'md' | 'lg'

export interface AvatarProps {
  children?: ReactNode
  size?: AvatarSize
  /** Background color (any CSS color). Falls back to the blood-red token. */
  color?: string
  className?: string
  style?: CSSProperties
  title?: string
}

const SIZE_CLASS: Record<AvatarSize, string> = {
  sm: 'gd-avatar-sm',
  md: '',
  lg: 'gd-avatar-lg',
}

export function Avatar({ children, size = 'md', color, className, style, title }: AvatarProps) {
  const classes = ['gd-avatar', SIZE_CLASS[size], className].filter(Boolean).join(' ')
  const merged: CSSProperties = { ...(color ? { background: color } : null), ...style }
  return (
    <div className={classes} style={merged} title={title}>
      {children}
    </div>
  )
}
