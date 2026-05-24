import { Alert } from "../ui/Alert";

export function ApiAlert() {
  return (
    <Alert tone="warning" title="Modo offline — IA não configurada">
      Você pode organizar mídias, catálogo e roteiros manualmente. Para match visual e legendas,
      adicione pelo menos uma chave no <code className="font-mono">.env</code> (
      <code className="text-ag-accent font-mono">GEMINI_API_KEY</code>,{" "}
      <code className="text-ag-accent font-mono">GROQ_API_KEY</code>,{" "}
      <code className="text-ag-accent font-mono">OPENROUTER_API_KEY</code>, etc.). O provedor
      ativo é escolhido no painel IA (ícone ✨ no topo), não precisa editar{" "}
      <code className="text-ag-accent font-mono">AI_PROVIDER</code> a cada troca.
      <p className="text-xs mt-2 text-ag-muted">
        Reinicie com npm run dev apenas depois de alterar chaves no .env.
      </p>
    </Alert>
  );
}
