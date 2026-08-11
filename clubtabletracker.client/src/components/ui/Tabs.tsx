import type { ReactNode } from 'react'

export interface TabItem {
  id: string
  label: ReactNode
  /** Optional numeric badge (e.g. pending requests count). Hidden when 0/undefined. */
  count?: number
}

export interface TabsProps {
  tabs: TabItem[]
  active: string
  onChange: (id: string) => void
  className?: string
}

export function Tabs({ tabs, active, onChange, className }: TabsProps) {
  return (
    <div className={['gd-tabs', className].filter(Boolean).join(' ')} role="tablist">
      {tabs.map((t) => {
        const isActive = t.id === active
        return (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={isActive}
            className={['gd-tab', isActive ? 'gd-tab-active' : ''].filter(Boolean).join(' ')}
            onClick={() => onChange(t.id)}
          >
            {t.label}
            {typeof t.count === 'number' && t.count > 0 ? <span className="gd-tab-cnt">{t.count}</span> : null}
          </button>
        )
      })}
    </div>
  )
}
