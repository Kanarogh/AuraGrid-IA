import { Alert } from "../ui/Alert";

export function ApiAlert() {
  return (
    <Alert tone="warning" title="IA não configurada">
      Configure pelo menos uma chave de API nas variáveis de ambiente do projeto (
      <code className="font-mono">GEMINI_API_KEY</code>,{" "}
      <code className="text-ag-accent font-mono">GROQ_API_KEY</code> ou{" "}
      <code className="text-ag-accent font-mono">OPENROUTER_API_KEY</code>). Na Vercel, use
      Settings → Environment Variables. Configure o provedor completo em{" "}
      <strong>Configurações → IA</strong> ou use o atalho no topo (status IA → Configurar IA).
    </Alert>
  );
}
