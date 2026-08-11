import type { ButtonHTMLAttributes, ReactNode } from 'react'

export type ButtonVariant = 'primary' | 'brass' | 'secondary' | 'ghost' | 'danger'
export type ButtonSize = 'md' | 'sm' | 'xs'

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  size?: ButtonSize
  block?: boolean
  children?: ReactNode
}

const VARIANT_CLASS: Record<ButtonVariant, string> = {
  primary: 'gd-btn-primary',
  brass: 'gd-btn-brass',
  secondary: 'gd-btn-secondary',
  ghost: 'gd-btn-ghost',
  danger: 'gd-btn-danger',
}

const SIZE_CLASS: Record<ButtonSize, string> = {
  md: '',
  sm: 'gd-btn-sm',
  xs: 'gd-btn-xs',
}

export function Button({
  variant = 'secondary',
  size = 'md',
  block = false,
  className,
  children,
  type = 'button',
  ...rest
}: ButtonProps) {
  const classes = ['gd-btn', VARIANT_CLASS[variant], SIZE_CLASS[size], block ? 'gd-btn-block' : '', className]
    .filter(Boolean)
    .join(' ')
  return (
    <button type={type} className={classes} {...rest}>
      {children}
    </button>
  )
}
