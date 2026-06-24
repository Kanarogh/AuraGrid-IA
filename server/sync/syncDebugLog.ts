type ServerSyncDebugPayload = Record<string, unknown>;

let bannerPrinted = false;

export function isServerSyncDebugEnabled(): boolean {
  const flag = process.env.SYNC_DEBUG ?? process.env.NEXT_PUBLIC_SYNC_DEBUG;
  if (flag === "1" || flag === "true") return true;
  if (flag === "0" || flag === "false") return false;
  return process.env.NODE_ENV !== "production";
}

function printBanner(): void {
  if (bannerPrinted) return;
  bannerPrinted = true;
  const on = isServerSyncDebugEnabled();
  console.log(
    `[AuraGrid:sync] terminal debug ${on ? "ON" : "OFF"} — ativar: SYNC_DEBUG=1 no .env e reinicie o servidor`
  );
}

/** Log no terminal do servidor (npm run dev / logs Square Cloud). */
export function serverSyncDebugLog(
  event: string,
  payload?: ServerSyncDebugPayload
): void {
  if (!isServerSyncDebugEnabled()) return;

  printBanner();
  const ts = new Date().toISOString().slice(11, 23);
  const line = `[AuraGrid:sync] ${ts} ${event}`;

  if (payload && Object.keys(payload).length) {
    console.log(line, JSON.stringify(payload));
  } else {
    console.log(line);
  }
}
