"use client"

import { useEffect } from "react"
import { initializeAutoRecurrence } from "@/lib/auto-recurrence"
import { useAuth } from "@/contexts/auth-context"

export function AutoRecurrenceInitializer() {
  const { user, canWrite: roleCanWrite } = useAuth()
  // Só gera com usuário logado e com permissão de escrita (editor/admin).
  const canWrite = !!user && roleCanWrite
  useEffect(() => {
    if (!canWrite) return
    return initializeAutoRecurrence()
  }, [canWrite])

  return null
}
