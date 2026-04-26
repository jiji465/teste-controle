import { z } from "zod"
import { isValidCNPJ } from "@/lib/cnpj-validation"

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
  tradeName: z.string().optional(),
  cnpj: z
    .string()
    .refine((v) => isValidCNPJ(v), "CNPJ inválido (verifique os dígitos)"),
  email: z.string().email("E-mail inválido").or(z.literal("")),
  phone: z.string().optional(),
  status: z.enum(["active", "inactive"]).default("active"),
  taxRegime: taxRegimeSchema.optional(),
  businessActivity: z.string().optional(),
  cnaeCode: z.string().optional(),
  cnaeDescription: z.string().optional(),
  ie: z.string().optional(),
  im: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  notes: z.string().optional(),
  createdAt: z.string().optional(),
})

export type ClientFormData = z.infer<typeof clientSchema>
