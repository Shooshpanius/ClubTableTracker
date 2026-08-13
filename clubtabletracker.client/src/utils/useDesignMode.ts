import { useCallback, useEffect, useState } from 'react'

export type DesignMode = 'grimdark' | 'legacy'

const STORAGE_KEY = 'ctt-design'

function readInitialMode(): DesignMode {
  try {
    return localStorage.getItem(STORAGE_KEY) === 'legacy' ? 'legacy' : 'grimdark'
  } catch {
    return 'grimdark'
  }
}

/**
 * Toggles between the current Grimdark design and the pre-migration legacy
 * design (restored from commit 0cd3688 into pages/legacy/).
 *
 * The choice is persisted to localStorage and reflected as a
 * `design-legacy` class on <body> so that styles/legacy.css applies.
 */
export function useDesignMode() {
  const [design, setDesign] = useState<DesignMode>(readInitialMode)

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, design)
    } catch {
      /* localStorage unavailable — keep in-memory only */
    }
    document.body.classList.toggle('design-legacy', design === 'legacy')
  }, [design])

  const toggle = useCallback(() => {
    setDesign(prev => (prev === 'grimdark' ? 'legacy' : 'grimdark'))
  }, [])

  return { design, isLegacy: design === 'legacy', toggle }
}
