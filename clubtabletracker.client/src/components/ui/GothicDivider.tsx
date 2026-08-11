export interface GothicDividerProps {
  className?: string
}

/** Grimdark gothic divider with the ✠ sigil in the middle. */
export function GothicDivider({ className }: GothicDividerProps) {
  return <div className={['gd-divider', className].filter(Boolean).join(' ')} aria-hidden />
}
