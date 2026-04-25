import { z } from "zod"
import { taxRegimeSchema } from "@/features/clients/schemas"

export const obligationScopeSchema = z.enum(["federal", "estadual", "municipal"])

export const obligationSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().min(2, "Nome deve ter no mínimo 2 caracteres"),
  description: z.string().optional().or(z.literal("")),
  clientId: z.string().min(1, "Cliente é obrigatório"),
  scope: obligationScopeSchema.optional(),
  applicableRegimes: z.array(taxRegimeSchema).default([]),
  dueDay: z.coerce.number().min(1, "Dia inválido").max(31, "Dia inválido"),
  /** Mês-base do fato gerador no formato "YYYY-MM" (ex: "2026-01" = competência janeiro/2026). */
  competencyMonth: z
    .string()
    .regex(/^\d{4}-\d{2}$/, "Formato esperado: AAAA-MM")
    .optional()
    .or(z.literal("")),
  frequency: z.enum(["monthly", "quarterly", "annual", "custom"]).default("monthly"),
  recurrence: z
    .enum(["monthly", "bimonthly", "quarterly", "semiannual", "annual", "custom"])
    .default("monthly"),
  recurrenceInterval: z.coerce.number().min(1).optional(),
  recurrenceEndDate: z.string().optional().or(z.literal("")),
  autoGenerate: z.boolean().default(false),
  weekendRule: z.enum(["postpone", "anticipate", "keep"]).default("postpone"),
  status: z.enum(["pending", "in_progress", "completed", "overdue"]).default("pending"),
  priority: z.enum(["low", "medium", "high", "urgent"]).default("medium"),
  assignedTo: z.string().optional().or(z.literal("")),
  protocol: z.string().optional().or(z.literal("")),
  notes: z.string().optional().or(z.literal("")),
  tags: z.array(z.string()).default([]),
  createdAt: z.string().optional(),
})

export type ObligationFormData = z.infer<typeof obligationSchema>
