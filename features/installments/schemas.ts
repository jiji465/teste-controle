import { z } from "zod"

export const installmentSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().min(2, "Nome deve ter no mínimo 2 caracteres"),
  description: z.string().optional().or(z.literal("")),
  clientId: z.string().min(1, "Cliente é obrigatório"),
  taxId: z.string().optional().or(z.literal("none")).or(z.literal("")),
  installmentCount: z.coerce.number().min(1, "Deve haver pelo menos 1 parcela"),
  currentInstallment: z.coerce.number().min(1, "A parcela atual deve ser pelo menos 1"),
  dueDay: z.coerce.number().min(1).max(31),
  firstDueDate: z.string().min(1, "Data de vencimento inicial é obrigatória"),
  weekendRule: z.enum(["postpone", "anticipate", "keep"]).default("postpone"),
  status: z.enum(["pending", "in_progress", "completed", "overdue"]).default("pending"),
  priority: z.enum(["low", "medium", "high", "urgent"]).default("medium"),
  assignedTo: z.string().optional().or(z.literal("")),
  protocol: z.string().optional().or(z.literal("")),
  notes: z.string().optional().or(z.literal("")),
  autoGenerate: z.boolean().default(true),
  recurrence: z.enum(["monthly", "bimonthly", "quarterly", "semiannual", "annual", "custom"]).default("monthly"),
  recurrenceInterval: z.coerce.number().min(1).optional(),
  tags: z.array(z.string()).default([]),
  createdAt: z.string().optional(),
}).superRefine((data, ctx) => {
  if (data.currentInstallment > data.installmentCount) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Parcela atual não pode ser maior que o total",
      path: ["currentInstallment"]
    })
  }
})

export type InstallmentFormData = z.infer<typeof installmentSchema>
