import { useCallback, useState } from 'react'

export function usePersistedSize(key: string, defaultVal: number, min: number, max: number) {
  const [size, setSize] = useState(() => {
    try {
      const raw = localStorage.getItem(key)
      if (raw) {
        const n = Number(raw)
        if (!Number.isNaN(n)) return Math.min(max, Math.max(min, n))
      }
    } catch {
      /* ignore */
    }
    return defaultVal
  })

  const set = useCallback(
    (next: number | ((prev: number) => number)) => {
      setSize((prev) => {
        const raw = typeof next === 'function' ? next(prev) : next
        const clamped = Math.min(max, Math.max(min, raw))
        try {
          localStorage.setItem(key, String(Math.round(clamped)))
        } catch {
          /* ignore */
        }
        return clamped
      })
    },
    [key, min, max],
  )

  return [size, set] as const
}
