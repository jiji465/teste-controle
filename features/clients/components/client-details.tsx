"use client"

import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import {
  Building2,
  Mail,
  Phone,
  Hash,
  Briefcase,
  MapPin,
  CalendarClock,
  FileText,
  Scale,
  Receipt,
  Pencil,
  Copy,
  CheckCircle2,
  XCircle,
  IdCard,
} from "lucide-react"
import type { Client } from "@/lib/types"
import { TAX_REGIME_LABELS, TAX_REGIME_COLORS } from "@/lib/types"
import { BUSINESS_ACTIVITY_LABELS, type BusinessActivity } from "@/lib/obligation-templates"
import { formatDate } from "@/lib/date-utils"
import { toast } from "sonner"

type ClientDetailsProps = {
  client: Client
  open: boolean
  onOpenChange: (open: boolean) => void
  onEdit?: (client: Client) => void
}

export function ClientDetails({ client, open, onOpenChange, onEdit }: ClientDetailsProps) {
  const isActive = client.status === "active"
  const regimeColor = client.taxRegime ? TAX_REGIME_COLORS[client.taxRegime] : ""
  const initials = (client.name || "?")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((s) => s[0]?.toUpperCase())
    .join("")

  const handleCopy = (label: string, value?: string) => {
    if (!value) return
    navigator.clipboard.writeText(value)
    toast.success(`${label} copiado`)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[640px] max-h-[90vh] overflow-y-auto p-0">
        {/* Hero */}
        <div className="relative bg-gradient-to-br from-primary/10 via-primary/5 to-transparent px-6 pt-6 pb-5 border-b">
          <DialogHeader className="space-y-3">
            <div className="flex items-start gap-4">
              <div className="size-14 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0 shadow-sm">
                <span className="text-lg font-bold text-primary">{initials || <Building2 className="size-6" />}</span>
              </div>
              <div className="flex-1 min-w-0">
                <DialogTitle className="text-xl leading-tight break-words">{client.name}</DialogTitle>
                {client.tradeName && (
                  <p className="text-sm text-muted-foreground mt-0.5 break-words">{client.tradeName}</p>
                )}
                <div className="flex flex-wrap gap-1.5 mt-2">
                  <Badge
                    className={
                      isActive
                        ? "bg-green-600 hover:bg-green-700 text-white"
                        : "bg-gray-400 hover:bg-gray-500 text-white"
                    }
                  >
                    {isActive ? <CheckCircle2 className="size-3 mr-1" /> : <XCircle className="size-3 mr-1" />}
                    {isActive ? "Ativo" : "Inativo"}
                  </Badge>
                  {client.taxRegime && (
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${regimeColor}`}
                    >
                      <Scale className="size-3 mr-1" />
                      {TAX_REGIME_LABELS[client.taxRegime]}
                    </span>
                  )}
                  {client.businessActivity && (
                    <Badge variant="outline" className="gap-1">
                      <Briefcase className="size-3" />
                      {BUSINESS_ACTIVITY_LABELS[client.businessActivity as BusinessActivity] ?? client.businessActivity}
                    </Badge>
                  )}
                </div>
              </div>
            </div>
          </DialogHeader>
        </div>

        <div className="px-6 py-5 space-y-5">
          {/* Identificação */}
          <Section title="Identificação" icon={<IdCard className="size-4" />}>
            <InfoTile
              icon={<Hash className="size-4" />}
              label="CNPJ"
              value={client.cnpj}
              mono
              copyable
              onCopy={() => handleCopy("CNPJ", client.cnpj)}
            />
            {client.ie && (
              <InfoTile
                icon={<Hash className="size-4" />}
                label="Inscrição Estadual"
                value={client.ie}
                mono
                copyable
                onCopy={() => handleCopy("IE", client.ie)}
              />
            )}
            {client.im && (
              <InfoTile
                icon={<Hash className="size-4" />}
                label="Inscrição Municipal"
                value={client.im}
                mono
                copyable
                onCopy={() => handleCopy("IM", client.im)}
              />
            )}
            {(client.cnaeCode || client.cnaeDescription) && (
              <InfoTile
                icon={<Receipt className="size-4" />}
                label={`CNAE${client.cnaeCode ? ` ${client.cnaeCode}` : ""}`}
                value={client.cnaeDescription || "—"}
              />
            )}
          </Section>

          {/* Contato */}
          {(client.email || client.phone) && (
            <>
              <Separator />
              <Section title="Contato" icon={<Mail className="size-4" />}>
                {client.email && (
                  <InfoTile
                    icon={<Mail className="size-4" />}
                    label="E-mail"
                    value={client.email}
                    copyable
                    onCopy={() => handleCopy("E-mail", client.email)}
                  />
                )}
                {client.phone && (
                  <InfoTile
                    icon={<Phone className="size-4" />}
                    label="Telefone"
                    value={client.phone}
                    copyable
                    onCopy={() => handleCopy("Telefone", client.phone)}
                  />
                )}
              </Section>
            </>
          )}

          {/* Endereço */}
          {(client.city || client.state) && (
            <>
              <Separator />
              <Section title="Localização" icon={<MapPin className="size-4" />}>
                <InfoTile
                  icon={<MapPin className="size-4" />}
                  label="Cidade / UF"
                  value={[client.city, client.state?.toUpperCase()].filter(Boolean).join(" / ") || "—"}
                />
              </Section>
            </>
          )}

          {/* Observações */}
          {client.notes && (
            <>
              <Separator />
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <FileText className="size-4 text-muted-foreground" />
                  <p className="text-sm font-semibold">Observações</p>
                </div>
                <div className="rounded-lg bg-muted/40 border px-3 py-2.5">
                  <p className="text-sm text-muted-foreground whitespace-pre-wrap">{client.notes}</p>
                </div>
              </div>
            </>
          )}

          <Separator />

          {/* Metadata */}
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <CalendarClock className="size-3.5" />
            Cadastrado em <span className="font-medium">{formatDate(client.createdAt)}</span>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t bg-muted/20 flex items-center justify-end gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Fechar
          </Button>
          {onEdit && (
            <Button
              onClick={() => {
                onOpenChange(false)
                onEdit(client)
              }}
              className="gap-2"
            >
              <Pencil className="size-4" />
              Editar
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}

function Section({
  title,
  icon,
  children,
}: {
  title: string
  icon?: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <div>
      <div className="flex items-center gap-2 mb-2.5">
        <span className="text-muted-foreground">{icon}</span>
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{title}</p>
      </div>
      <div className="grid sm:grid-cols-2 gap-2.5">{children}</div>
    </div>
  )
}

function InfoTile({
  icon,
  label,
  value,
  mono,
  copyable,
  onCopy,
}: {
  icon?: React.ReactNode
  label: string
  value?: string | null
  mono?: boolean
  copyable?: boolean
  onCopy?: () => void
}) {
  return (
    <div className="group rounded-lg border bg-card hover:bg-muted/40 transition-colors px-3 py-2.5 flex items-start gap-2.5">
      {icon && <span className="text-muted-foreground mt-0.5 shrink-0">{icon}</span>}
      <div className="flex-1 min-w-0">
        <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
        <p className={`text-sm break-words ${mono ? "font-mono" : ""}`}>{value || <span className="text-muted-foreground">—</span>}</p>
      </div>
      {copyable && value && (
        <button
          type="button"
          onClick={onCopy}
          className="opacity-0 group-hover:opacity-100 transition-opacity shrink-0 p-1 rounded hover:bg-muted"
          aria-label={`Copiar ${label}`}
        >
          <Copy className="size-3.5 text-muted-foreground" />
        </button>
      )}
    </div>
  )
}
