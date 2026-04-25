import { hasSupabaseConfig, getSupabaseClient } from "@/lib/supabase/core"
import type { CustomTemplatePackage, ObligationTemplate } from "@/lib/obligation-templates"

const LOCAL_KEY = "fiscal_custom_templates"
const MIGRATION_FLAG = "fiscal_templates_migrated_v1"

// ─── Acesso local (fallback / cache imediato) ────────────────────────────────

function getLocal(): CustomTemplatePackage[] {
  if (typeof window === "undefined") return []
  try {
    const raw = localStorage.getItem(LOCAL_KEY)
    return raw ? (JSON.parse(raw) as CustomTemplatePackage[]) : []
  } catch {
    return []
  }
}

function setLocal(templates: CustomTemplatePackage[]): void {
  if (typeof window === "undefined") return
  localStorage.setItem(LOCAL_KEY, JSON.stringify(templates))
}

// ─── Mapeamento DB ↔ TS ──────────────────────────────────────────────────────

type Row = {
  id: string
  name: string
  description: string | null
  obligations: ObligationTemplate[]
  created_at: string
  updated_at?: string
}

function rowToTemplate(row: Row): CustomTemplatePackage {
  return {
    id: row.id,
    name: row.name,
    description: row.description ?? undefined,
    obligations: Array.isArray(row.obligations) ? row.obligations : [],
    createdAt: row.created_at,
  }
}

function templateToRow(pkg: CustomTemplatePackage) {
  return {
    id: pkg.id,
    name: pkg.name,
    description: pkg.description ?? null,
    obligations: pkg.obligations,
    created_at: pkg.createdAt,
    updated_at: new Date().toISOString(),
  }
}

// ─── API pública ─────────────────────────────────────────────────────────────

export async function getCustomTemplatesAsync(): Promise<CustomTemplatePackage[]> {
  if (!hasSupabaseConfig()) return getLocal()

  try {
    const supabase = getSupabaseClient()
    const { data, error } = await supabase
      .from("custom_obligation_templates")
      .select("*")
      .order("name")
    if (error) {
      console.error("[templates] Supabase fetch error, fallback local:", error)
      return getLocal()
    }
    const templates = (data as Row[]).map(rowToTemplate)
    // Cache local para acesso síncrono em outros lugares (ex: dialog que ainda usa sync)
    setLocal(templates)
    return templates
  } catch (err) {
    console.error("[templates] erro inesperado, fallback local:", err)
    return getLocal()
  }
}

export async function saveCustomTemplateAsync(pkg: CustomTemplatePackage): Promise<void> {
  // Atualiza local sempre — garante UI rápida e fallback offline
  const existing = getLocal()
  const idx = existing.findIndex((t) => t.id === pkg.id)
  if (idx >= 0) existing[idx] = pkg
  else existing.push(pkg)
  setLocal(existing)

  if (!hasSupabaseConfig()) return
  try {
    const supabase = getSupabaseClient()
    const { error } = await supabase
      .from("custom_obligation_templates")
      .upsert(templateToRow(pkg))
    if (error) console.error("[templates] erro ao salvar no Supabase:", error)
  } catch (err) {
    console.error("[templates] erro inesperado ao salvar:", err)
  }
}

export async function deleteCustomTemplateAsync(id: string): Promise<void> {
  // Remove local primeiro
  const remaining = getLocal().filter((t) => t.id !== id)
  setLocal(remaining)

  if (!hasSupabaseConfig()) return
  try {
    const supabase = getSupabaseClient()
    const { error } = await supabase
      .from("custom_obligation_templates")
      .delete()
      .eq("id", id)
    if (error) console.error("[templates] erro ao deletar no Supabase:", error)
  } catch (err) {
    console.error("[templates] erro inesperado ao deletar:", err)
  }
}

// ─── Migração one-shot localStorage → Supabase ──────────────────────────────
// Roda uma única vez por sessão. Se a tabela do Supabase está vazia mas o
// localStorage tem templates, faz o upload.

export async function migrateLocalTemplatesToSupabase(): Promise<{ migrated: number; skipped: number }> {
  if (typeof window === "undefined") return { migrated: 0, skipped: 0 }
  if (!hasSupabaseConfig()) return { migrated: 0, skipped: 0 }
  if (localStorage.getItem(MIGRATION_FLAG) === "true") return { migrated: 0, skipped: 0 }

  const local = getLocal()
  if (local.length === 0) {
    localStorage.setItem(MIGRATION_FLAG, "true")
    return { migrated: 0, skipped: 0 }
  }

  try {
    const supabase = getSupabaseClient()
    const { data: existing, error: fetchError } = await supabase
      .from("custom_obligation_templates")
      .select("id")
    if (fetchError) {
      console.error("[templates] migração: erro ao verificar existentes:", fetchError)
      return { migrated: 0, skipped: 0 }
    }

    const existingIds = new Set((existing || []).map((r: { id: string }) => r.id))
    const toMigrate = local.filter((t) => !existingIds.has(t.id))

    if (toMigrate.length === 0) {
      localStorage.setItem(MIGRATION_FLAG, "true")
      return { migrated: 0, skipped: local.length }
    }

    const { error: insertError } = await supabase
      .from("custom_obligation_templates")
      .insert(toMigrate.map(templateToRow))

    if (insertError) {
      console.error("[templates] migração: erro ao inserir:", insertError)
      return { migrated: 0, skipped: 0 }
    }

    localStorage.setItem(MIGRATION_FLAG, "true")
    return { migrated: toMigrate.length, skipped: local.length - toMigrate.length }
  } catch (err) {
    console.error("[templates] migração: erro inesperado:", err)
    return { migrated: 0, skipped: 0 }
  }
}
