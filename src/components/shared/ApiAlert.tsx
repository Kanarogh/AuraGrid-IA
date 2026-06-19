import { Alert } from "../ui/Alert";

export function ApiAlert() {
  return (
    <Alert tone="warning" title="IA não configurada">
      Configure pelo menos uma chave de API nas variáveis de ambiente do projeto (
      <code className="font-mono">GEMINI_API_KEY</code>,{" "}
      <code className="text-ag-accent font-mono">GROQ_API_KEY</code> ou{" "}
      <code className="text-ag-accent font-mono">OPENROUTER_API_KEY</code>). Na Vercel, use
      Settings → Environment Variables. O provedor ativo é escolhido no painel IA (ícone ✨ no topo).
    </Alert>
  );
}
