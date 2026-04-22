import { z } from "zod"

export const taxRegimeSchema = z.enum([
  "simples_nacional",
  "lucro_presumido",
  "lucro_real",
  "mei",
  "imune_isento"
])

export const clientSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().min(2, "O nome deve ter no mínimo 2 caracteres"),
  cnpj: z.string().min(14, "CNPJ inválido"), // Pode adicionar regex mais complexa depois
  email: z.string().email("E-mail inválido").or(z.literal("")),
  phone: z.string().optional(),
  status: z.enum(["active", "inactive"]).default("active"),
  taxRegime: taxRegimeSchema.optional(),
  businessActivity: z.string().optional(),
  ie: z.string().optional(),
  im: z.string().optional(),
  notes: z.string().optional(),
  createdAt: z.string().optional(),
})

export type ClientFormData = z.infer<typeof clientSchema>
