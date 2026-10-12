"use client"

import { useEffect } from "react"
import { initializeAutoRecurrence } from "@/lib/auto-recurrence"
import { useAuth } from "@/contexts/auth-context"

export function AutoRecurrenceInitializer() {
  const { user, isViewer } = useAuth()
  // Só gera com usuário logado e com permissão de escrita.
  const canWrite = !!user && !isViewer
  useEffect(() => {
    if (!canWrite) return
    return initializeAutoRecurrence()
  }, [canWrite])

  return null
}
