"use client"

/**
 * Painel público (sem login). Mostra SOMENTE dados agregados/anônimos da
 * carteira — nunca nome, CNPJ, fantasia ou localização. Os dados vêm da
 * função `portfolio_publico()` (rpc), a única coisa que o anônimo pode ler;
 * as tabelas seguem trancadas pelo RLS. O detalhe fica atrás do login.
 */

import { useEffect, useState } from "react"
import Link from "next/link"
import { LogIn, Building2, ShieldCheck, Loader2, PieChart } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { createClient } from "@/lib/supabase/client"
import { TAX_REGIME_LABELS } from "@/lib/types"
import { BUSINESS_ACTIVITY_LABELS } from "@/lib/obligation-templates"

type Empresa = { regime: string | null; atividade: string | null; status: string | null }
type Portfolio = {
  total: number
  ativos: number
  inativos: number
  porRegime: Record<string, number>
  porAtividade: Record<string, number>
  empresas: Empresa[]
}

const regimeLabel = (k: string) =>
  (TAX_REGIME_LABELS as Record<string, string>)[k] ?? (k === "nao_informado" ? "Não informado" : k)
const atividadeLabel = (k: string) =>
  (BUSINESS_ACTIVITY_LABELS as Record<string, string>)[k] ?? (k === "nao_informado" ? "Não informado" : k)

function DistBars({ title, data }: { title: string; data: Record<string, number>; }) {
  const entries = Object.entries(data).sort((a, b) => b[1] - a[1])
  const max = Math.max(1, ...entries.map(([, n]) => n))
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-2">
          <PieChart className="size-4 text-muted-foreground" /> {title}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2.5">
        {entries.length === 0 && <p className="text-sm text-muted-foreground">Sem dados.</p>}
        {entries.map(([k, n]) => (
          <div key={k}>
            <div className="flex justify-between text-xs mb-1">
              <span className="text-muted-foreground">{title.includes("regime") ? regimeLabel(k) : atividadeLabel(k)}</span>
              <span className="font-medium tabular-nums">{n}</span>
            </div>
            <div className="h-2 rounded-full bg-muted overflow-hidden">
              <div className="h-full rounded-full bg-primary" style={{ width: `${(n / max) * 100}%` }} />
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  )
}

function Kpi({ label, value }: { label: string; value: number | string }) {
  return (
    <Card>
      <CardContent className="p-4">
        <p className="text-xs text-muted-foreground uppercase tracking-wide">{label}</p>
        <p className="text-2xl font-semibold mt-1 tabular-nums">{value}</p>
      </CardContent>
    </Card>
  )
}

export default function PainelPublicoPage() {
  const [data, setData] = useState<Portfolio | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let alive = true
    ;(async () => {
      try {
        const supabase = createClient()
        const { data, error } = await supabase.rpc("portfolio_publico")
        if (!alive) return
        if (error) throw error
        setData(data as Portfolio)
      } catch (e) {
        if (alive) setError(e instanceof Error ? e.message : "Não foi possível carregar os indicadores.")
      } finally {
        if (alive) setLoading(false)
      }
    })()
    return () => {
      alive = false
    }
  }, [])

  return (
    <div className="min-h-screen bg-gradient-to-br from-background to-muted/30">
      {/* Cabeçalho simples */}
      <header className="border-b bg-background/80 backdrop-blur-sm">
        <div className="mx-auto max-w-5xl px-4 py-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 min-w-0">
            <span className="grid size-8 place-items-center rounded-md bg-primary text-primary-foreground shrink-0">
              <Building2 className="size-4" />
            </span>
            <div className="min-w-0">
              <p className="text-sm font-bold leading-tight truncate">Controle Fiscal — Painel público</p>
              <p className="text-[11px] text-muted-foreground truncate">Indicadores da carteira (sem dados que identifiquem empresas)</p>
            </div>
          </div>
          <Link href="/login">
            <Button size="sm" className="gap-1.5 shrink-0">
              <LogIn className="size-4" /> Entrar
            </Button>
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-6 space-y-6">
        {/* Aviso de privacidade */}
        <div className="flex items-start gap-2 rounded-lg border bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
          <ShieldCheck className="size-4 text-emerald-600 shrink-0 mt-0.5" />
          <span>
            Esta página mostra apenas números agregados e uma lista anônima. Nome, CNPJ, nome fantasia e
            localização das empresas ficam disponíveis apenas para usuários com login.
          </span>
        </div>

        {loading && (
          <div className="flex items-center justify-center py-20 text-muted-foreground">
            <Loader2 className="size-5 animate-spin mr-2" /> Carregando indicadores…
          </div>
        )}

        {error && !loading && (
          <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-6 text-center text-sm text-destructive">
            {error}
          </div>
        )}

        {data && !loading && (
          <>
            <div className="grid grid-cols-3 gap-3">
              <Kpi label="Empresas" value={data.total} />
              <Kpi label="Ativas" value={data.ativos} />
              <Kpi label="Inativas" value={data.inativos} />
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <DistBars title="Por regime tributário" data={data.porRegime} />
              <DistBars title="Por atividade" data={data.porAtividade} />
            </div>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Carteira (anônima) · {data.empresas.length} empresas</CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="divide-y">
                  {data.empresas.map((e, i) => (
                    <li key={i} className="flex flex-wrap items-center gap-2 py-2 text-sm">
                      <span className="text-muted-foreground w-20 shrink-0">Empresa {i + 1}</span>
                      <Badge variant="secondary">{regimeLabel(e.regime ?? "nao_informado")}</Badge>
                      <Badge variant="outline">{atividadeLabel(e.atividade ?? "nao_informado")}</Badge>
                      <span
                        className={
                          "ml-auto text-xs font-medium " +
                          (e.status === "active" ? "text-emerald-600" : "text-muted-foreground")
                        }
                      >
                        {e.status === "active" ? "Ativa" : "Inativa"}
                      </span>
                    </li>
                  ))}
                  {data.empresas.length === 0 && (
                    <li className="py-6 text-center text-sm text-muted-foreground">Nenhuma empresa cadastrada.</li>
                  )}
                </ul>
              </CardContent>
            </Card>
          </>
        )}
      </main>
    </div>
  )
}
