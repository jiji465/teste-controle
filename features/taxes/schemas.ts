import { z } from "zod"
import { taxRegimeSchema } from "@/features/clients/schemas"

export const taxSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().min(2, "Nome deve ter no mínimo 2 caracteres"),
  description: z.string().optional().or(z.literal("")),
  federalTaxCode: z.string().optional().or(z.literal("")),
  dueDay: z.coerce.number().min(1, "O dia deve ser maior que 0").max(31, "O dia deve ser até 31").optional().or(z.literal(0)),
  status: z.enum(["pending", "in_progress", "completed", "overdue"]).default("pending"),
  priority: z.enum(["low", "medium", "high", "urgent"]).default("medium"),
  recurrence: z.enum(["monthly", "bimonthly", "quarterly", "semiannual", "annual", "custom"]).default("monthly"),
  recurrenceInterval: z.coerce.number().min(1).optional(),
  recurrenceEndDate: z.string().optional().or(z.literal("")),
  autoGenerate: z.boolean().default(false),
  weekendRule: z.enum(["postpone", "anticipate", "keep"]).default("postpone"),
  assignedTo: z.string().optional().or(z.literal("")),
  protocol: z.string().optional().or(z.literal("")),
  notes: z.string().optional().or(z.literal("")),
  tags: z.array(z.string()).default([]),
  applicableRegimes: z.array(taxRegimeSchema).default([]),
  completedAt: z.string().optional(),
  completedBy: z.string().optional(),
  createdAt: z.string().optional(),
})

export type TaxFormData = z.infer<typeof taxSchema>
