import type { ReactNode } from 'react'

export interface DataslateProps {
  /** Optional header row (renders the brass dataslate header). */
  title?: ReactNode
  /** Optional leading icon/sigil in the header. */
  icon?: ReactNode
  children: ReactNode
  /** Optional footer row. */
  footer?: ReactNode
  className?: string
  bodyClassName?: string
  /** Adds hover affordance (interactive card). */
  interactive?: boolean
}

export function Dataslate({
  title,
  icon,
  children,
  footer,
  className,
  bodyClassName,
  interactive,
}: DataslateProps) {
  return (
    <div
      className={['gd-dataslate', interactive ? 'gd-card-interactive' : '', className]
        .filter(Boolean)
        .join(' ')}
    >
      {title ? (
        <div className="gd-dataslate-header">
          {icon ? <span aria-hidden>{icon}</span> : null}
          {title}
        </div>
      ) : null}
      <div className={['gd-dataslate-body', bodyClassName].filter(Boolean).join(' ')}>{children}</div>
      {footer ? <div className="gd-dataslate-footer">{footer}</div> : null}
    </div>
  )
}
