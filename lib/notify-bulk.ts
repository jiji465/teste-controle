import { toast } from "sonner"
import type { BulkToast } from "./bulk-actions"

/** Mostra o toast de uma ação em lote (sucesso, parcial ou falha). */
export function notifyBulk(t: BulkToast): void {
  if (t.kind === "success") toast.success(t.message)
  else if (t.kind === "warning") toast.warning(t.message)
  else toast.error(t.message)
}
