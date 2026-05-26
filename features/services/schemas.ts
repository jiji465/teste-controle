import { z } from "zod"

export const serviceCategorySchema = z.enum(["nf_emission", "consulting", "other"])

export const serviceSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().min(2, "Nome deve ter no mínimo 2 caracteres"),
  clientId: z.string().min(1, "Cliente é obrigatório"),
  description: z.string().optional().or(z.literal("")),
  category: serviceCategorySchema.default("other"),
  dueDate: z.string().min(1, "Data é obrigatória").regex(/^\d{4}-\d{2}-\d{2}$/, "Data inválida (AAAA-MM-DD)"),
  status: z.enum(["pending", "in_progress", "completed", "overdue"]).default("pending"),
  priority: z.enum(["low", "medium", "high", "urgent"]).default("medium"),
  recurrence: z
    .enum(["monthly", "bimonthly", "quarterly", "semiannual", "annual", "custom"])
    .optional(),
  recurrenceInterval: z.coerce.number().min(1).optional(),
  recurrenceEndDate: z.string().optional().or(z.literal("")),
  autoGenerate: z.boolean().default(false),
  notes: z.string().optional().or(z.literal("")),
  tags: z.array(z.string()).default([]),
  // nullish aceita null vindo do Supabase (mesma lição dos outros forms)
  completedAt: z.string().nullish(),
  completedBy: z.string().nullish(),
  createdAt: z.string().nullish(),
})

export type ServiceFormData = z.infer<typeof serviceSchema>
