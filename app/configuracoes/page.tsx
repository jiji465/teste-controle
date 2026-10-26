"use client"

/**
 * Configurações do escritório.
 *
 * Feriados estaduais/municipais: os vencimentos já respeitam os feriados
 * NACIONAIS; aqui o escritório cadastra os locais (aniversário da cidade,
 * data magna do estado…) e eles passam a valer em todo cálculo de dia útil.
 */

import { useEffect, useState, type FormEvent } from "react"
import { toast } from "sonner"
import { CalendarPlus, Loader2, Settings, Trash2, UserCircle2 } from "lucide-react"
import { PageHeader } from "@/components/page-header"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { useAuth } from "@/contexts/auth-context"
import { useData } from "@/contexts/data-context"
import {
  deleteOfficeHoliday,
  getOfficeHolidays,
  saveOfficeHoliday,
  type OfficeHoliday,
} from "@/features/settings/services"
import { formatDate, toLocalDateString } from "@/lib/date-utils"
import { errorMessage } from "@/lib/utils"

const SCOPE_LABEL: Record<OfficeHoliday["scope"], string> = {
  estadual: "Estadual",
  municipal: "Municipal",
  facultativo: "Ponto facultativo",
}

const ROLE_LABEL: Record<string, string> = {
  viewer: "Somente leitura",
  editor: "Editor",
  admin: "Administrador",
}

export default function ConfiguracoesPage() {
  const { user, role, isViewer, userName } = useAuth()
  const { refreshData } = useData()
  const [holidays, setHolidays] = useState<OfficeHoliday[] | null>(null)
  const [date, setDate] = useState("")
  const [name, setName] = useState("")
  const [scope, setScope] = useState<OfficeHoliday["scope"]>("municipal")
  const [saving, setSaving] = useState(false)

  const load = async () => {
    try {
      setHolidays(await getOfficeHolidays())
    } catch (e) {
      toast.error(errorMessage(e, "Erro ao carregar feriados"))
      setHolidays([])
    }
  }

  useEffect(() => {
    void load()
  }, [])

  const handleAdd = async (e: FormEvent) => {
    e.preventDefault()
    if (!date || !name.trim()) {
      toast.error("Informe a data e o nome do feriado.")
      return
    }
    setSaving(true)
    try {
      await saveOfficeHoliday({ date, name: name.trim(), scope })
      toast.success("Feriado cadastrado. Os vencimentos foram recalculados.")
      setDate("")
      setName("")
      await load()
      await refreshData()
    } catch (err) {
      toast.error(errorMessage(err, "Erro ao salvar feriado"))
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (h: OfficeHoliday) => {
    try {
      await deleteOfficeHoliday(h.date)
      toast.success(`${h.name} removido`)
      await load()
      await refreshData()
    } catch (err) {
      toast.error(errorMessage(err, "Erro ao remover feriado"))
    }
  }

  // Dia LOCAL: toISOString() é UTC — depois das 21h no Brasil já virava o
  // dia seguinte e o feriado de hoje caía em "passados".
  const today = toLocalDateString(new Date())
  const upcoming = (holidays ?? []).filter((h) => h.date >= today)
  const past = (holidays ?? []).filter((h) => h.date < today)

  return (
    <div className="px-4 lg:px-6 xl:px-8 py-5 space-y-5">
      <PageHeader
        icon={Settings}
        title="Configurações"
        description="Preferências do escritório que afetam o cálculo de vencimentos."
      />

      <div className="grid gap-5 lg:grid-cols-[1fr_320px]">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Feriados estaduais e municipais</CardTitle>
            <CardDescription>
              Os feriados nacionais já são considerados automaticamente. Cadastre aqui os feriados
              locais do escritório — vencimentos que caírem neles são antecipados ou adiados conforme a
              regra de cada obrigação.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            {!isViewer && (
              <form onSubmit={handleAdd} className="grid gap-3 sm:grid-cols-2 sm:items-end 2xl:grid-cols-[160px_1fr_180px_auto]">
                <div className="space-y-1.5">
                  <Label htmlFor="holiday-date">Data</Label>
                  <Input id="holiday-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="holiday-name">Nome</Label>
                  <Input
                    id="holiday-name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Ex.: Aniversário da cidade"
                    required
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="holiday-scope">Tipo</Label>
                  <Select value={scope} onValueChange={(v) => setScope(v as OfficeHoliday["scope"])}>
                    <SelectTrigger id="holiday-scope">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="municipal">Municipal</SelectItem>
                      <SelectItem value="estadual">Estadual</SelectItem>
                      <SelectItem value="facultativo">Ponto facultativo</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Button type="submit" disabled={saving} className="gap-2">
                  {saving ? <Loader2 className="size-4 animate-spin" /> : <CalendarPlus className="size-4" />}
                  Adicionar
                </Button>
              </form>
            )}

            {holidays === null ? (
              <div className="space-y-2">
                <Skeleton className="h-9 w-full" />
                <Skeleton className="h-9 w-full" />
              </div>
            ) : holidays.length === 0 ? (
              <p className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">
                Nenhum feriado local cadastrado.
              </p>
            ) : (
              <div className="space-y-4">
                {[
                  { title: "Próximos", list: upcoming },
                  { title: "Anteriores", list: past },
                ]
                  .filter((g) => g.list.length > 0)
                  .map((g) => (
                    <div key={g.title} className="space-y-1.5">
                      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{g.title}</p>
                      <ul className="divide-y rounded-md border">
                        {g.list.map((h) => (
                          <li key={h.date} className="flex items-center gap-3 px-3 py-2 text-sm">
                            <span className="w-24 shrink-0 tabular-nums">{formatDate(h.date)}</span>
                            <span className="min-w-0 flex-1 truncate font-medium">{h.name}</span>
                            <Badge variant="outline" className="hidden sm:inline-flex">
                              {SCOPE_LABEL[h.scope]}
                            </Badge>
                            {!isViewer && (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="size-8 text-muted-foreground hover:text-destructive"
                                onClick={() => handleDelete(h)}
                                aria-label={`Remover ${h.name}`}
                              >
                                <Trash2 className="size-4" />
                              </Button>
                            )}
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="h-fit">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <UserCircle2 className="size-4" /> Sua conta
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div>
              <p className="text-xs text-muted-foreground">Nome exibido</p>
              <p className="font-medium">{userName}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">E-mail</p>
              <p className="font-medium break-all">{user?.email ?? "—"}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Perfil</p>
              <p className="font-medium">{role ? ROLE_LABEL[role] ?? role : "Sem acesso (aguardando liberação)"}</p>
            </div>
            <p className="text-xs text-muted-foreground">
              O nome exibido aparece em &quot;concluído por&quot; e no histórico. Para alterá-lo, peça ao
              administrador para preencher o campo <code>name</code> do seu usuário no Supabase.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
