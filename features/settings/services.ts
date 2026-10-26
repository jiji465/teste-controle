import { hasSupabaseConfig, getSupabaseClient, toDbError, assertAffected } from "@/lib/supabase/core"

/** Feriado estadual/municipal do escritório (entra no cálculo de dia útil). */
export interface OfficeHoliday {
  /** "YYYY-MM-DD" */
  date: string
  name: string
  scope: "estadual" | "municipal" | "facultativo"
}

const LOCAL_KEY = "fiscal_office_holidays"

function readLocal(): OfficeHoliday[] {
  if (typeof window === "undefined") return []
  try {
    return JSON.parse(localStorage.getItem(LOCAL_KEY) ?? "[]") as OfficeHoliday[]
  } catch {
    return []
  }
}

function writeLocal(list: OfficeHoliday[]): void {
  localStorage.setItem(LOCAL_KEY, JSON.stringify(list))
}

export async function getOfficeHolidays(): Promise<OfficeHoliday[]> {
  if (!hasSupabaseConfig()) return readLocal().sort((a, b) => a.date.localeCompare(b.date))
  const supabase = getSupabaseClient()
  const { data, error } = await supabase.from("office_holidays").select("*").order("holiday_date")
  if (error) {
    // Migration 021 ainda não rodada → sem feriados locais, sem quebrar o app
    if (/does not exist|schema cache/i.test(error.message)) return []
    throw toDbError(error)
  }
  return (data ?? []).map((r: { holiday_date: string; name: string; scope: OfficeHoliday["scope"] }) => ({
    date: r.holiday_date,
    name: r.name,
    scope: r.scope,
  }))
}

export async function saveOfficeHoliday(h: OfficeHoliday): Promise<void> {
  if (!hasSupabaseConfig()) {
    writeLocal([...readLocal().filter((x) => x.date !== h.date), h])
    return
  }
  const supabase = getSupabaseClient()
  const { error } = await supabase
    .from("office_holidays")
    .upsert({ holiday_date: h.date, name: h.name, scope: h.scope })
  if (error) throw toDbError(error)
}

export async function deleteOfficeHoliday(date: string): Promise<void> {
  if (!hasSupabaseConfig()) {
    writeLocal(readLocal().filter((x) => x.date !== date))
    return
  }
  const supabase = getSupabaseClient()
  const { data, error } = await supabase.from("office_holidays").delete().eq("holiday_date", date).select("holiday_date")
  if (error) throw toDbError(error)
  assertAffected(data)
}
