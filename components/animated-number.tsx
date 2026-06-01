"use client"

import { useEffect, useRef, useState } from "react"

/**
 * Mostra um número que "sobe" de 0 até `value` quando aparece — dá vida aos
 * KPIs do dashboard. JS mínimo via requestAnimationFrame (sem biblioteca).
 *
 * - Respeita prefers-reduced-motion (mostra o valor final direto).
 * - Reanima quando `value` muda (ex: troca de período).
 */
export function AnimatedNumber({
  value,
  durationMs = 900,
  className,
}: {
  value: number
  durationMs?: number
  className?: string
}) {
  const [display, setDisplay] = useState(0)
  const fromRef = useRef(0)
  const rafRef = useRef<number | null>(null)

  useEffect(() => {
    const reduce =
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches
    const target = Number.isFinite(value) ? value : 0

    if (reduce) {
      setDisplay(target)
      return
    }

    const from = fromRef.current
    const start = performance.now()
    // easeOutCubic — começa rápido, desacelera no fim
    const ease = (t: number) => 1 - Math.pow(1 - t, 3)

    const tick = (now: number) => {
      const elapsed = now - start
      const p = Math.min(1, elapsed / durationMs)
      const current = from + (target - from) * ease(p)
      setDisplay(current)
      if (p < 1) {
        rafRef.current = requestAnimationFrame(tick)
      } else {
        fromRef.current = target
      }
    }
    rafRef.current = requestAnimationFrame(tick)
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
      fromRef.current = target // se desmontar no meio, próxima parte daqui
    }
  }, [value, durationMs])

  return <span className={className}>{Math.max(0, Math.round(display)).toLocaleString("pt-BR")}</span>
}
