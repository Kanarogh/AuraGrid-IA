export async function readJsonResponse<T = unknown>(response: Response): Promise<T> {
  const text = await response.text();

  if (!text.trim()) {
    if (response.status === 404) {
      throw new Error(
        "Rota de indexação não encontrada. Pare o servidor (Ctrl+C no terminal) e execute npm run dev novamente."
      );
    }
    throw new Error(`Servidor retornou resposta vazia (HTTP ${response.status}).`);
  }

  try {
    return JSON.parse(text) as T;
  } catch {
    throw new Error(
      `Resposta inválida do servidor (HTTP ${response.status}). Reinicie com npm run dev.`
    );
  }
}
