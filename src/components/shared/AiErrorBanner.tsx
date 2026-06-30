import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";

const QUOTA_REGEX = /429|quota|cota|RESOURCE_EXHAUSTED|rate.?limit|insufficient_quota/i;
const TIMEOUT_REGEX = /timeout|timed out|tempo esgotado|ETIMEDOUT/i;
const VISION_REGEX = /image_url|unknown variant.*text/i;

type ErrorKind = "quota" | "timeout" | "vision" | "other";

function classifyError(message: string): ErrorKind {
  if (QUOTA_REGEX.test(message)) return "quota";
  if (TIMEOUT_REGEX.test(message)) return "timeout";
  if (VISION_REGEX.test(message)) return "vision";
  return "other";
}

export function AiErrorBanner({
  message,
  onRetry,
  compact,
}: {
  message: string;
  onRetry: () => void;
  compact?: boolean;
}) {
  const kind = useMemo(() => classifyError(message), [message]);
  const initialCountdown = kind === "quota" ? 30 : 0;
  const [countdown, setCountdown] = useState(initialCountdown);

  useEffect(() => {
    setCountdown(initialCountdown);
  }, [message, initialCountdown]);

  useEffect(() => {
    if (countdown <= 0) return;
    const id = setTimeout(() => setCountdown((c) => Math.max(0, c - 1)), 1000);
    return () => clearTimeout(id);
  }, [countdown]);

  const heading = (() => {
    switch (kind) {
      case "quota":
        return "Cota da IA atingida";
      case "timeout":
        return "Tempo esgotado na IA";
      case "vision":
        return "Falha de visão no modelo";
      default:
        return "Falha ao chamar a IA";
    }
  })();

  return (
    <div
      className={`rounded-xl border border-ag-danger/30 bg-ag-danger/10 ${
        compact ? "px-3 py-2" : "px-4 py-3"
      }`}
      role="alert"
    >
      <div className="flex gap-2.5 items-start">
        <AlertTriangle className="h-4 w-4 text-ag-danger shrink-0 mt-0.5" />
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold text-ag-danger">{heading}</p>
          <p className="text-[11px] text-ag-danger/85 leading-relaxed mt-0.5 break-words">
            {message}
          </p>

          <div className="flex flex-wrap gap-1.5 mt-2.5">
            <button
              type="button"
              onClick={onRetry}
              disabled={countdown > 0}
              className="inline-flex items-center gap-1 text-[10px] font-semibold px-2.5 py-1 rounded-md bg-ag-danger text-ag-accent-fg disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
            >
              <RefreshCw className="h-3 w-3" />
              {countdown > 0 ? `Tentar em ${countdown}s` : "Tentar de novo"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
