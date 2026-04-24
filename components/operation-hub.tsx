"use client"

import { useState, useMemo } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import { Progress } from "@/components/ui/progress"
import { 
  CheckCircle2, 
  Clock, 
  AlertTriangle, 
  PlayCircle, 
  ArrowRight,
  Filter,
  MoreHorizontal,
  ChevronDown,
  Activity
} from "lucide-react"
import type { ObligationWithDetails } from "@/lib/types"
import { saveObligation } from "@/lib/storage"
import { toast } from "sonner"
import { useData } from "@/contexts/data-context"
import { Lock, Unlock, UserPlus } from "lucide-react"

type OperationHubProps = {
  obligations: ObligationWithDetails[]
  onUpdate: () => void
}

export function OperationHub({ obligations, onUpdate, currentPeriod }: OperationHubProps & { currentPeriod: string }) {
  const { lockedPeriods, togglePeriodLock, refreshData } = useData()
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [isAssignDialogOpen, setIsAssignDialogOpen] = useState(false)
  const [analystName, setAnalystName] = useState("")
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set())
  const CATEGORY_VISIBLE_LIMIT = 8

  const isLocked = useMemo(() => lockedPeriods.includes(currentPeriod), [lockedPeriods, currentPeriod])

  // Só obrigações cuja competência bate com o período selecionado.
  // Sem competencyMonth NÃO aparecem (são considerados itens "soltos").
  const periodObligations = useMemo(
    () => obligations.filter((o) => o.competencyMonth === currentPeriod),
    [obligations, currentPeriod],
  )

  const stats = useMemo(() => {
    const total = periodObligations.length
    const completed = periodObligations.filter(o => o.status === 'completed').length
    const inProgress = periodObligations.filter(o => o.status === 'in_progress').length
    const pending = periodObligations.filter(o => o.status === 'pending').length
    const overdue = periodObligations.filter(o => o.status !== 'completed' && new Date(o.calculatedDueDate) < new Date()).length

    return {
      total,
      completed,
      inProgress,
      pending,
      overdue,
      percent: total > 0 ? Math.round((completed / total) * 100) : 0
    }
  }, [periodObligations])

  const categories = useMemo(() => {
    return {
      SPED: periodObligations.filter(o => o.category === 'sped'),
      'Guias de Imposto': periodObligations.filter(o => o.category === 'tax_guide'),
      'Certidões': periodObligations.filter(o => o.category === 'certificate'),
      'Declarações': periodObligations.filter(o => o.category === 'declaration'),
      'Outras': periodObligations.filter(o => o.category === 'other'),
    }
  }, [periodObligations])

  const handleBulkComplete = () => {
    if (selectedIds.length === 0 || isLocked) return
    
    selectedIds.forEach(id => {
      const obligation = obligations.find(o => o.id === id)
      if (obligation && obligation.status !== 'completed') {
        const updated = {
          ...obligation,
          status: 'completed' as const,
          completedAt: new Date().toISOString(),
          history: [
            ...(obligation.history || []),
            {
              id: crypto.randomUUID(),
              action: 'completed' as const,
              description: 'Obrigação concluída em lote via Hub de Operações',
              timestamp: new Date().toISOString()
            }
          ]
        }
        saveObligation(updated)
      }
    })
    
    toast.success(`${selectedIds.length} obrigações concluídas!`)
    setSelectedIds([])
    onUpdate()
  }

  const handleBulkAssign = async () => {
    if (selectedIds.length === 0 || !analystName || isLocked) return
    
    const { saveObligation } = await import("@/lib/supabase/database")
    
    await Promise.all(selectedIds.map(async id => {
      const obligation = obligations.find(o => o.id === id)
      if (obligation) {
        const updated = {
          ...obligation,
          assignedTo: analystName,
          history: [
            ...(obligation.history || []),
            {
              id: crypto.randomUUID(),
              action: 'edited' as any,
              description: `Responsável alterado para ${analystName} em lote`,
              timestamp: new Date().toISOString(),
              user: "Sistema"
            }
          ]
        }
        await saveObligation(updated)
      }
    }))
    
    toast.success(`${selectedIds.length} tarefas atribuídas a ${analystName}`)
    setSelectedIds([])
    setAnalystName("")
    setIsAssignDialogOpen(false)
    onUpdate()
  }

  const isNearDue = (dateStr: string) => {
    const dueDate = new Date(dateStr)
    const today = new Date()
    const diffTime = dueDate.getTime() - today.getTime()
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
    return diffDays >= 0 && diffDays <= 2
  }

  return (
    <div className="space-y-6">
      {/* Header com Progresso Geral */}
      <div className="grid md:grid-cols-4 gap-4">
        <Card className="glass-card md:col-span-2">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg flex items-center gap-2">
                <Activity className="size-5 text-primary" />
                Progresso do Período
              </CardTitle>
              <Badge variant="outline" className="font-mono">{stats.percent}%</Badge>
            </div>
          </CardHeader>
          <CardContent>
            <Progress value={stats.percent} className="h-3 mb-4" />
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>{stats.completed} de {stats.total} tarefas concluídas</span>
              <span className="font-medium text-primary">{stats.total - stats.completed} restantes</span>
            </div>
          </CardContent>
        </Card>

        <Card className="glass-card">
          <CardHeader className="pb-2">
            <CardDescription className="text-xs uppercase font-bold tracking-wider">Atrasos Críticos</CardDescription>
            <CardTitle className="text-3xl text-red-600 font-bold">{stats.overdue}</CardTitle>
          </CardHeader>
        </Card>

        <Card className="glass-card">
          <CardHeader className="pb-2">
            <CardDescription className="text-xs uppercase font-bold tracking-wider">Em Andamento</CardDescription>
            <CardTitle className="text-3xl text-blue-600 font-bold">{stats.inProgress}</CardTitle>
          </CardHeader>
        </Card>
      </div>

      {/* Tabela de Execução em Lote */}
      <Card className="border-none shadow-none bg-transparent">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <h3 className="text-xl font-bold tracking-tight">Execução em Lote</h3>
            {isLocked && (
              <Badge variant="secondary" className="bg-amber-100 text-amber-800 border-amber-200">
                <Lock className="size-3 mr-1" /> Período Encerrado
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-2">
            {selectedIds.length > 0 && !isLocked && (
              <div className="animate-in slide-in-from-right-4 flex items-center gap-2 bg-primary/10 p-1 pl-3 rounded-full border border-primary/20">
                <span className="text-xs font-bold text-primary">{selectedIds.length} selecionados</span>
                <Button 
                  size="sm" 
                  variant="outline" 
                  onClick={() => setIsAssignDialogOpen(true)}
                  className="rounded-full h-8 px-4 border-primary/20 text-primary hover:bg-primary/5"
                >
                  <UserPlus className="size-3.5 mr-2" />
                  Atribuir
                </Button>
                <Button size="sm" onClick={handleBulkComplete} className="rounded-full h-8 px-4 bg-primary hover:bg-primary/90">
                  Concluir Lote
                </Button>
              </div>
            )}
            
            {stats.percent === 100 && !isLocked && (
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => togglePeriodLock(currentPeriod)}
                className="rounded-full h-8 border-green-200 text-green-700 hover:bg-green-50"
              >
                <Lock className="size-3.5 mr-2" />
                Encerrar Período
              </Button>
            )}

            {isLocked && (
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => togglePeriodLock(currentPeriod)}
                className="rounded-full h-8 border-amber-200 text-amber-700 hover:bg-amber-50"
              >
                <Unlock className="size-3.5 mr-2" />
                Reabrir Período
              </Button>
            )}

            <Button variant="outline" size="sm" className="rounded-full h-8">
              <Filter className="size-3.5 mr-2" />
              Filtrar
            </Button>
          </div>
        </div>

        {periodObligations.length === 0 && (
          <div className="text-center py-12 px-6 border-2 border-dashed rounded-lg bg-muted/20">
            <p className="font-medium text-sm">Nenhuma obrigação para a competência <span className="font-mono">{currentPeriod}</span></p>
            <p className="text-xs text-muted-foreground mt-1">
              Cadastre obrigações com mês de competência <strong>{currentPeriod}</strong> ou volte para o mês atual no seletor de período.
            </p>
          </div>
        )}

        <div className="space-y-3">
          {Object.entries(categories).map(([cat, items]) => {
            if (items.length === 0) return null
            const isExpanded = expandedCategories.has(cat)
            const visibleItems = isExpanded ? items : items.slice(0, CATEGORY_VISIBLE_LIMIT)
            const hiddenCount = items.length - visibleItems.length
            return (
              <div key={cat} className="space-y-2">
                <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-muted-foreground mb-1 px-1">
                  <span>{cat}</span>
                  <div className="h-px bg-border flex-1" />
                  <span>{items.filter(i => i.status === 'completed').length}/{items.length}</span>
                </div>

                <div className="grid gap-2">
                  {visibleItems.map(obl => (
                    <div 
                      key={obl.id} 
                      className={`
                        flex items-center gap-4 p-3 rounded-xl border transition-all hover:shadow-md
                        ${selectedIds.includes(obl.id) ? 'bg-primary/5 border-primary/30' : 'bg-card border-border/50'}
                        ${obl.status === 'completed' ? 'opacity-60' : ''}
                        ${!selectedIds.includes(obl.id) && obl.status !== 'completed' && isNearDue(obl.calculatedDueDate) ? 'border-red-200 bg-red-50/30' : ''}
                      `}
                    >
                      <Checkbox 
                        checked={selectedIds.includes(obl.id)}
                        onCheckedChange={(checked) => {
                          if (checked) setSelectedIds(prev => [...prev, obl.id])
                          else setSelectedIds(prev => prev.filter(id => id !== obl.id))
                        }}
                        disabled={obl.status === 'completed' || isLocked}
                      />
                      
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="font-semibold text-sm truncate">{obl.name}</p>
                          <Badge variant="outline" className="text-[10px] h-4 py-0 px-1.5 font-normal bg-muted/30">
                            {obl.client.name}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-3 mt-1">
                          <span className={`text-[10px] flex items-center gap-1 ${obl.status !== 'completed' && isNearDue(obl.calculatedDueDate) ? 'text-red-600 font-bold' : 'text-muted-foreground'}`}>
                            {obl.status !== 'completed' && isNearDue(obl.calculatedDueDate) ? <AlertTriangle className="size-3" /> : <Clock className="size-3" />}
                            Vence: {new Date(obl.calculatedDueDate).toLocaleDateString('pt-BR')}
                            {obl.status !== 'completed' && isNearDue(obl.calculatedDueDate) && " (URGENTE)"}
                          </span>
                          {obl.assignedTo && (
                            <span className="text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                              Resp: {obl.assignedTo}
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        {obl.status === 'completed' ? (
                          <Badge className="bg-green-100 text-green-700 hover:bg-green-100 border-none">
                            Concluído
                          </Badge>
                        ) : obl.status === 'in_progress' ? (
                          <Badge className="bg-blue-100 text-blue-700 hover:bg-blue-100 border-none">
                            Em Andamento
                          </Badge>
                        ) : (
                          <Badge variant="secondary" className="border-none">
                            Pendente
                          </Badge>
                        )}
                        <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full">
                          <MoreHorizontal className="size-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                  {hiddenCount > 0 && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="w-full text-xs text-muted-foreground hover:text-foreground"
                      onClick={() =>
                        setExpandedCategories((prev) => {
                          const next = new Set(prev)
                          if (next.has(cat)) next.delete(cat)
                          else next.add(cat)
                          return next
                        })
                      }
                    >
                      {isExpanded ? "Mostrar menos" : `Ver mais ${hiddenCount} itens`}
                    </Button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </Card>

      {/* Modal de Atribuição */}
      {isAssignDialogOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <Card className="w-full max-w-md animate-in zoom-in-95">
            <CardHeader>
              <CardTitle>Atribuir Responsável</CardTitle>
              <CardDescription>Defina quem será o analista responsável pelas {selectedIds.length} tarefas selecionadas.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Nome do Analista</label>
                <input 
                  type="text" 
                  value={analystName}
                  onChange={(e) => setAnalystName(e.target.value)}
                  className="w-full p-2 rounded-md border bg-background"
                  placeholder="Ex: João Silva"
                  autoFocus
                />
              </div>
            </CardContent>
            <div className="flex justify-end gap-3 p-6 pt-0">
              <Button variant="outline" onClick={() => setIsAssignDialogOpen(false)}>Cancelar</Button>
              <Button onClick={handleBulkAssign} disabled={!analystName}>Confirmar Atribuição</Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  )
}
