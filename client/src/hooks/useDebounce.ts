import { useEffect, useRef, useState } from "react"

export function useDebounce<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value)

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delayMs)
    return () => clearTimeout(timer)
  }, [value, delayMs])

  return debounced
}

export function useDebouncedSearch(
  input: string,
  delayMs = 300,
  onChange?: (val: string) => void
): string {
  const debounced = useDebounce(input, delayMs)
  const resolved = input === "" ? "" : debounced
  const onChangeRef = useRef(onChange)
  onChangeRef.current = onChange

  useEffect(() => {
    onChangeRef.current?.(resolved)
  }, [resolved])

  return resolved
}
