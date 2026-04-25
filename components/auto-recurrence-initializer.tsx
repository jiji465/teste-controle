"use client"

import { useEffect } from "react"
import { initializeAutoRecurrence } from "@/lib/auto-recurrence"

export function AutoRecurrenceInitializer() {
  useEffect(() => {
    initializeAutoRecurrence()
  }, [])

  return null
}
