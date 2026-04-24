"use client"

import { useCallback } from "react"
import { useRouter, useSearchParams } from "next/navigation"

/**
 * Syncs a single string state value with a URL search parameter.
 * Returns [currentValue, setter]. Default value is returned when param absent.
 */
export function useUrlState(key: string, defaultValue = "all") {
  const router = useRouter()
  const searchParams = useSearchParams()

  const value = searchParams.get(key) ?? defaultValue

  const setValue = useCallback(
    (next: string) => {
      const params = new URLSearchParams(searchParams.toString())
      if (next === defaultValue) params.delete(key)
      else params.set(key, next)
      const qs = params.toString()
      router.replace(qs ? `?${qs}` : "?", { scroll: false })
    },
    [router, searchParams, key, defaultValue],
  )

  return [value, setValue] as const
}
