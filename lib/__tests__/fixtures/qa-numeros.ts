/**
 * Dataset controlado do QA de números. "Hoje" = segunda 26/10/2026 10:00
 * (America/Sao_Paulo). Feriados relevantes: 12/10 (seg), 02/11 (seg),
 * 15/11 (dom), 20/11 (sex).
 *
 * Datas de vencimento calculadas À MÃO (regra postpone):
 *  O1  comp 09/26 dia 20 -> 20/10 (ter)            completed 20/10 10:00 BRT (no prazo)
 *  O2  comp 09/26 dia 15 -> 15/10 (qui)            pending  -> ATRASADA
 *  O3  comp 09/26 dia 26 -> 26/10 (seg, HOJE)      pending  -> pendente (vence hoje)
 *  O4  comp 09/26 dia 10 -> 10/10 sáb -> 12/10 feriado -> 13/10 (ter)  completed 13/10 22:30 BRT (no prazo)
 *  O5  comp 08/26 dia 25 -> 25/09 (sex)            completed 28/09 (ATRASO)
 *  O6  comp 10/26 dia 20 -> 20/11 feriado -> 23/11 (seg) pending
 *  O7  comp 09/26 dia 28 -> 28/10 (qua)            in_progress -> pendente
 *  T1  C1 comp 09/26 dia 20 -> 20/10              completed 21/10 (ATRASO)
 *  T2  C2 comp 09/26 dia 25 -> 25/10 dom -> 26/10 (HOJE) pending
 *  T3  C2 comp 08/26 dia 20 -> 20/09 dom -> 21/09  pending -> ATRASADA
 *  T4  C1 sem competência (modelo) pending
 *  I1  C1 12x 1º venc 20/06/26 dia 20: p1 22/06, p2 20/07, p3 20/08, p4 21/09, p5 20/10, p6 23/11, p7 21/12
 *      p1..p5 pagas; p5 paga 23/10 (ATRASO); current=6; in_progress
 *  I2  C2 6x 1º venc 15/09/26 dia 15: p1 15/09 (paga 14/09), p2 15/10 (NÃO paga -> atrasada), p3 16/11 (15/11 dom)
 *      current=2; in_progress
 *  S1  C1 26/10 (hoje) pending; S2 C2 05/10 completed 05/10 23:30 BRT; S3 C1 30/10 pending
 */
import type { Client, Obligation, Tax, Installment, Service } from "../../types"

export const NOW = new Date(2026, 9, 26, 10, 0, 0)

export const clients: Client[] = [
  { id: "C1", name: "Alfa Ltda", email: "", phone: "", status: "active", createdAt: "2025-01-01T12:00:00Z" },
  { id: "C2", name: "Beta ME", email: "", phone: "", status: "active", createdAt: "2025-01-01T12:00:00Z" },
  { id: "C3", name: "Gama SA", email: "", phone: "", status: "inactive", createdAt: "2025-01-01T12:00:00Z" },
]

const ob = (p: Partial<Obligation> & Pick<Obligation, "id" | "clientId" | "competencyMonth" | "dueDay" | "status">): Obligation => ({
  name: p.id,
  category: "declaration",
  frequency: "monthly",
  recurrence: "monthly",
  autoGenerate: false,
  weekendRule: "postpone",
  priority: "medium",
  createdAt: "2026-10-01T12:00:00.000Z",
  ...p,
})

export const obligations: Obligation[] = [
  ob({ id: "O1", clientId: "C1", competencyMonth: "2026-09", dueDay: 20, status: "completed", completedAt: "2026-10-20T13:00:00.000Z" }),
  ob({ id: "O2", clientId: "C1", competencyMonth: "2026-09", dueDay: 15, status: "pending" }),
  ob({ id: "O3", clientId: "C2", competencyMonth: "2026-09", dueDay: 26, status: "pending" }),
  ob({ id: "O4", clientId: "C2", competencyMonth: "2026-09", dueDay: 10, status: "completed", completedAt: "2026-10-14T01:30:00.000Z" }),
  ob({ id: "O5", clientId: "C1", competencyMonth: "2026-08", dueDay: 25, status: "completed", completedAt: "2026-09-28T12:00:00.000Z", createdAt: "2026-09-01T12:00:00.000Z" }),
  ob({ id: "O6", clientId: "C2", competencyMonth: "2026-10", dueDay: 20, status: "pending" }),
  ob({ id: "O7", clientId: "C1", competencyMonth: "2026-09", dueDay: 28, status: "in_progress" }),
]

const tx = (p: Partial<Tax> & Pick<Tax, "id" | "status">): Tax => ({
  name: p.id,
  priority: "medium",
  weekendRule: "postpone",
  createdAt: "2026-10-01T12:00:00.000Z",
  ...p,
})

export const taxes: Tax[] = [
  tx({ id: "T1", clientId: "C1", competencyMonth: "2026-09", dueDay: 20, status: "completed", completedAt: "2026-10-21T12:00:00.000Z" }),
  tx({ id: "T2", clientId: "C2", competencyMonth: "2026-09", dueDay: 25, status: "pending" }),
  tx({ id: "T3", clientId: "C2", competencyMonth: "2026-08", dueDay: 20, status: "pending" }),
  tx({ id: "T4", clientId: "C1", status: "pending" }),
]

export const installments: Installment[] = [
  {
    id: "I1", name: "PERT", clientId: "C1", installmentCount: 12, currentInstallment: 6, dueDay: 20,
    firstDueDate: "2026-06-20", weekendRule: "postpone", status: "in_progress", priority: "high",
    createdAt: "2026-06-01T12:00:00.000Z", autoGenerate: false, recurrence: "monthly",
    paidInstallments: [
      { number: 1, sentAt: "2026-06-19T12:00:00.000Z", paidAt: "2026-06-19T12:00:00.000Z" },
      { number: 2, sentAt: "2026-07-17T12:00:00.000Z", paidAt: "2026-07-17T12:00:00.000Z" },
      { number: 3, sentAt: "2026-08-19T12:00:00.000Z", paidAt: "2026-08-19T12:00:00.000Z" },
      { number: 4, sentAt: "2026-09-18T12:00:00.000Z", paidAt: "2026-09-18T12:00:00.000Z" },
      { number: 5, sentAt: "2026-10-23T15:00:00.000Z", paidAt: "2026-10-23T15:00:00.000Z" },
    ],
  },
  {
    id: "I2", name: "Simples Parc", clientId: "C2", installmentCount: 6, currentInstallment: 2, dueDay: 15,
    firstDueDate: "2026-09-15", weekendRule: "postpone", status: "in_progress", priority: "medium",
    createdAt: "2026-09-01T12:00:00.000Z", autoGenerate: false, recurrence: "monthly",
    paidInstallments: [{ number: 1, sentAt: "2026-09-14T12:00:00.000Z", paidAt: "2026-09-14T12:00:00.000Z" }],
  },
]

const sv = (p: Partial<Service> & Pick<Service, "id" | "clientId" | "dueDate" | "status">): Service => ({
  name: p.id,
  category: "other",
  priority: "medium",
  createdAt: "2026-10-01T12:00:00.000Z",
  ...p,
})

export const services: Service[] = [
  sv({ id: "S1", clientId: "C1", dueDate: "2026-10-26", status: "pending" }),
  sv({ id: "S2", clientId: "C2", dueDate: "2026-10-05", status: "completed", completedAt: "2026-10-06T02:30:00.000Z" }),
  sv({ id: "S3", clientId: "C1", dueDate: "2026-10-30", status: "pending" }),
]
