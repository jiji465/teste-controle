import { hasSupabaseConfig, getSupabaseClient } from "@/lib/supabase/core"
import type { CustomTemplatePackage, ObligationTemplate } from "@/lib/obligation-templates"
import type { TaxRegime } from "@/lib/types"
import type { BusinessActivity } from "@/lib/obligation-templates"

const LOCAL_KEY = "fiscal_custom_templates"
const MIGRATION_FLAG = "fiscal_templates_migrated_v1"
const DELETED_DEFAULTS_KEY = "fiscal_templates_deleted_defaults"

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
  regime: TaxRegime | null
  activity: BusinessActivity | null
  obligations: ObligationTemplate[]
  created_at: string
  updated_at: string
}

function rowToTemplate(row: Row): CustomTemplatePackage {
  return {
    id: row.id,
    name: row.name,
    description: row.description ?? undefined,
    regime: row.regime ?? undefined,
    activity: row.activity ?? undefined,
    obligations: Array.isArray(row.obligations) ? row.obligations : [],
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

function templateToRow(pkg: CustomTemplatePackage) {
  return {
    id: pkg.id,
    name: pkg.name,
    description: pkg.description ?? null,
    regime: pkg.regime ?? null,
    activity: pkg.activity ?? null,
    obligations: pkg.obligations,
    created_at: pkg.createdAt,
    updated_at: new Date().toISOString(),
  }
}

// ─── API pública ─────────────────────────────────────────────────────────────

/**
 * Retorna templates do Supabase (fonte da verdade) e substitui o cache local.
 * O cache NUNCA é reenviado ao banco: um navegador desatualizado reenviando
 * sua cópia ressuscitava templates apagados ou desfazia edições de outro
 * usuário. Templates antigos só-locais sobem uma única vez pela
 * migrateLocalTemplatesToSupabase().
 */
export async function getCustomTemplatesAsync(): Promise<CustomTemplatePackage[]> {
  if (!hasSupabaseConfig()) return getLocal()

  try {
    const supabase = getSupabaseClient()
    const { data, error } = await supabase
      .from("custom_obligation_templates")
      .select("*")
      .order("name")
    if (error) {
      console.error("[templates] Supabase fetch error, usando cache local:", error)
      return getLocal()
    }

    const remote = (data as Row[]).map(rowToTemplate)
    setLocal(remote)
    return remote
  } catch (err) {
    console.error("[templates] erro inesperado, fallback local:", err)
    return getLocal()
  }
}

/**
 * Salva o template. Aguarda confirmação do Supabase (se configurado) antes
 * de retornar — assim o caller pode confiar que após o `await`, a edição
 * está persistida em ambos os lugares.
 */
export async function saveCustomTemplateAsync(pkg: CustomTemplatePackage): Promise<void> {
  // Garante updatedAt fresco
  const stamped: CustomTemplatePackage = { ...pkg, updatedAt: new Date().toISOString() }

  // Atualiza local primeiro (UI rápida)
  const existing = getLocal()
  const idx = existing.findIndex((t) => t.id === stamped.id)
  if (idx >= 0) existing[idx] = stamped
  else existing.push(stamped)
  setLocal(existing)

  if (!hasSupabaseConfig()) return
  const supabase = getSupabaseClient()
  const { error } = await supabase
    .from("custom_obligation_templates")
    .upsert(templateToRow(stamped))
  if (error) {
    console.error("[templates] erro ao salvar no Supabase:", error)
    throw new Error(`Falha ao salvar no servidor: ${error.message}`)
  }
}

/**
 * Apaga o template do Supabase + local. Se for um template padrão
 * (nome começa com "Padrão · "), também marca o nome como "deletado"
 * pra que o seed não recrie ele.
 */
export async function deleteCustomTemplateAsync(id: string): Promise<void> {
  const local = getLocal()
  const target = local.find((t) => t.id === id)
  const remaining = local.filter((t) => t.id !== id)
  setLocal(remaining)

  // Se era um padrão, marca como deletado pra não ressuscitar
  if (target && target.name.startsWith("Padrão · ")) {
    await markDefaultDeleted(target.name)
  }

  if (!hasSupabaseConfig()) return
  const supabase = getSupabaseClient()
  const { error } = await supabase
    .from("custom_obligation_templates")
    .delete()
    .eq("id", id)
  if (error) {
    console.error("[templates] erro ao deletar no Supabase:", error)
    throw new Error(`Falha ao deletar no servidor: ${error.message}`)
  }
}

// ─── Lista negra de templates padrão deletados ───────────────────────────────

function getLocalDeletedDefaults(): Set<string> {
  if (typeof window === "undefined") return new Set()
  try {
    const raw = localStorage.getItem(DELETED_DEFAULTS_KEY)
    return new Set(raw ? (JSON.parse(raw) as string[]) : [])
  } catch {
    return new Set()
  }
}

function setLocalDeletedDefaults(names: Set<string>): void {
  if (typeof window === "undefined") return
  localStorage.setItem(DELETED_DEFAULTS_KEY, JSON.stringify([...names]))
}

export async function getDeletedDefaultNames(): Promise<Set<string>> {
  const local = getLocalDeletedDefaults()
  if (!hasSupabaseConfig()) return local

  try {
    const supabase = getSupabaseClient()
    const { data, error } = await supabase.from("deleted_default_templates").select("name")
    if (error) {
      console.error("[templates] erro ao buscar deleted defaults:", error)
      return local
    }
    const remote = new Set((data as { name: string }[]).map((r) => r.name))
    // Merge: união de ambos
    const merged = new Set([...local, ...remote])
    setLocalDeletedDefaults(merged)
    return merged
  } catch (err) {
    console.error("[templates] erro inesperado em deleted defaults:", err)
    return local
  }
}

export async function markDefaultDeleted(name: string): Promise<void> {
  const local = getLocalDeletedDefaults()
  local.add(name)
  setLocalDeletedDefaults(local)

  if (!hasSupabaseConfig()) return
  try {
    const supabase = getSupabaseClient()
    const { error } = await supabase
      .from("deleted_default_templates")
      .upsert({ name, deleted_at: new Date().toISOString() })
    if (error) console.error("[templates] erro ao marcar deletado:", error)
  } catch (err) {
    console.error("[templates] erro inesperado ao marcar deletado:", err)
  }
}

/**
 * Reseta a lista negra — usado pelo botão "Restaurar padrões" pra trazer
 * todos os templates padrão de volta.
 */
export async function clearDeletedDefaults(): Promise<void> {
  setLocalDeletedDefaults(new Set())
  if (!hasSupabaseConfig()) return
  try {
    const supabase = getSupabaseClient()
    const { error } = await supabase.from("deleted_default_templates").delete().neq("name", "")
    if (error) console.error("[templates] erro ao limpar deletados:", error)
  } catch (err) {
    console.error("[templates] erro inesperado ao limpar deletados:", err)
  }
}

// ─── Migração one-shot localStorage → Supabase ──────────────────────────────

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
