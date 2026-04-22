import { z } from "zod"

export const obligationSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().min(2, "Nome deve ter no mínimo 2 caracteres"),
  description: z.string().optional().or(z.literal("")),
  clientId: z.string().min(1, "Cliente é obrigatório"),
  taxId: z.string().optional().or(z.literal("none")).or(z.literal("")),
  dueDay: z.coerce.number().min(1, "Dia inválido").max(31, "Dia inválido"),
  dueMonth: z.coerce.number().min(1).max(12).optional().or(z.literal(0)).or(z.nan()),
  frequency: z.enum(["monthly", "quarterly", "annual", "custom"]).default("monthly"),
  recurrence: z.enum(["monthly", "bimonthly", "quarterly", "semiannual", "annual", "custom"]).default("monthly"),
  recurrenceInterval: z.coerce.number().min(1).optional(),
  recurrenceEndDate: z.string().optional().or(z.literal("")),
  autoGenerate: z.boolean().default(false),
  weekendRule: z.enum(["postpone", "anticipate", "keep"]).default("postpone"),
  status: z.enum(["pending", "in_progress", "completed", "overdue"]).default("pending"),
  priority: z.enum(["low", "medium", "high", "urgent"]).default("medium"),
  assignedTo: z.string().optional().or(z.literal("")),
  protocol: z.string().optional().or(z.literal("")),
  realizationDate: z.string().optional().or(z.literal("")),
  amount: z.coerce.number().min(0).optional().or(z.nan()),
  notes: z.string().optional().or(z.literal("")),
  tags: z.array(z.string()).default([]),
  createdAt: z.string().optional(),
})

export type ObligationFormData = z.infer<typeof obligationSchema>
