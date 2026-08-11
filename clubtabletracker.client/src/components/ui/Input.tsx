import type { InputHTMLAttributes, ReactNode, SelectHTMLAttributes } from 'react'

export interface TextInputProps extends InputHTMLAttributes<HTMLInputElement> {
  /** Highlights the field with the danger border. */
  invalid?: boolean
}

export function TextInput({ className, invalid, ...rest }: TextInputProps) {
  return (
    <input
      className={['gd-input', className].filter(Boolean).join(' ')}
      style={invalid ? { borderColor: 'var(--gd-danger)' } : undefined}
      {...rest}
    />
  )
}

export interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  children: ReactNode
}

export function Select({ className, children, ...rest }: SelectProps) {
  return (
    <select className={['gd-input', 'gd-select', className].filter(Boolean).join(' ')} {...rest}>
      {children}
    </select>
  )
}
