"use client"

import { useEffect, useState } from "react"
import { useTheme } from "next-themes"
import { Moon, Sun } from "lucide-react"
import { Button } from "@/components/ui/button"

/**
 * Botão sol/lua que alterna entre tema claro e escuro.
 *
 * Usa next-themes (já configurado em components/theme-provider.tsx +
 * app/layout.tsx). Renderiza um placeholder até montar pra evitar
 * hydration mismatch (o tema só é conhecido no cliente).
 */
export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)

  useEffect(() => setMounted(true), [])

  // Só conhece o tema depois de montar — antes disso, servidor e cliente
  // renderizam IDÊNTICOS (Moon + "Tema escuro"), evitando hydration mismatch.
  const isDark = mounted && resolvedTheme === "dark"

  return (
    <Button
      variant="ghost"
      size="icon"
      className="h-9 w-9 rounded-full"
      onClick={() => setTheme(isDark ? "light" : "dark")}
      aria-label={isDark ? "Mudar para tema claro" : "Mudar para tema escuro"}
      title={isDark ? "Tema claro" : "Tema escuro"}
    >
      {isDark ? <Sun className="size-4" /> : <Moon className="size-4" />}
    </Button>
  )
}
