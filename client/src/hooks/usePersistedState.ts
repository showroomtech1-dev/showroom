import { useCallback, useState } from "react"

export function usePersistedState<T>(key: string, defaultValue: T): [T, (value: T | ((prev: T) => T)) => void] {
  const [state, setState] = useState<T>(() => {
    try {
      const raw = localStorage.getItem(`showroompro_ui_${key}`)
      if (raw !== null) return JSON.parse(raw) as T
    } catch {
      // ignore
    }
    return defaultValue
  })

  const setPersisted = useCallback(
    (value: T | ((prev: T) => T)) => {
      setState((prev) => {
        const next = typeof value === "function" ? (value as (p: T) => T)(prev) : value
        try {
          localStorage.setItem(`showroompro_ui_${key}`, JSON.stringify(next))
        } catch {
          // ignore
        }
        return next
      })
    },
    [key]
  )

  return [state, setPersisted]
}
