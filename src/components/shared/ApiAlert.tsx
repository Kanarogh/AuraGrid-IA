import { Alert } from "../ui/Alert";

export function ApiAlert() {
  return (
    <Alert tone="warning" title="IA não configurada">
      Configure a variável <code className="font-mono">GEMINI_API_KEY</code> no ambiente do
      projeto. Na Vercel, use Settings → Environment Variables. Depois ajuste os modelos Gemini em
      <strong> Configurações → IA</strong>.
    </Alert>
  );
}
