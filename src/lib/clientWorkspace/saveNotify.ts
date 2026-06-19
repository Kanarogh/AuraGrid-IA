import type { SaveWorkspaceResult } from "./storage";
import { toast } from "../toast";

let lastQuotaAlertAt = 0;
const QUOTA_ALERT_COOLDOWN_MS = 30_000;

export function notifyStorageSaveFailure(result: SaveWorkspaceResult): void {
  if (result.ok === false) {
    if (result.reason === "quota") {
      const now = Date.now();
      if (now - lastQuotaAlertAt < QUOTA_ALERT_COOLDOWN_MS) return;
      lastQuotaAlertAt = now;
      toast.warning(
        "Não foi possível salvar o catálogo no navegador — o espaço local está cheio.\n\n" +
          "• Remova referências antigas ou fotos muito grandes\n" +
          "• Libere espaço no disco do computador\n" +
          "• Evite recarregar a página até ver esta mensagem desaparecer após um salvamento bem-sucedido\n\n" +
          "Se o problema continuar, envie menos fotos por vez.",
        12_000
      );
      return;
    }

    console.error("[AuraGrid] Falha ao salvar workspace:", result.message);
  }
}
