"use client";

import { useState, type FormEvent, type ReactNode } from "react";
import { useAuth } from "../../context/AuthContext";

export function AuthGate({ children }: { children: ReactNode }) {
  const { user, loading, storageMode, login, register } = useAuth();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  if (storageMode === "local") return <>{children}</>;
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-ag-bg text-ag-muted">
        Carregando…
      </div>
    );
  }
  if (user) return <>{children}</>;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      if (mode === "login") await login(email, password);
      else await register(email, password, displayName || email.split("@")[0] || "Usuário");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha na autenticação.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-ag-bg px-4">
      <div className="w-full max-w-md rounded-2xl border border-ag-border bg-ag-surface p-8 shadow-xl">
        <h1 className="text-xl font-bold text-ag-text mb-1">AuraGrid IA</h1>
        <p className="text-sm text-ag-muted mb-6">
          {mode === "login" ? "Entre na sua conta" : "Crie sua conta"}
        </p>
        <form onSubmit={submit} className="space-y-4">
          {mode === "register" && (
            <label className="block text-sm">
              <span className="text-ag-muted">Nome</span>
              <input
                className="mt-1 w-full rounded-xl border border-ag-border bg-ag-bg px-3 py-2"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                autoComplete="name"
              />
            </label>
          )}
          <label className="block text-sm">
            <span className="text-ag-muted">E-mail</span>
            <input
              type="email"
              required
              className="mt-1 w-full rounded-xl border border-ag-border bg-ag-bg px-3 py-2"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
            />
          </label>
          <label className="block text-sm">
            <span className="text-ag-muted">Senha</span>
            <input
              type="password"
              required
              minLength={8}
              className="mt-1 w-full rounded-xl border border-ag-border bg-ag-bg px-3 py-2"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete={mode === "login" ? "current-password" : "new-password"}
            />
          </label>
          {error && <p className="text-sm text-ag-danger">{error}</p>}
          <button
            type="submit"
            disabled={submitting}
            className="w-full rounded-xl bg-ag-accent text-white py-2.5 font-semibold disabled:opacity-50"
          >
            {submitting ? "Aguarde…" : mode === "login" ? "Entrar" : "Cadastrar"}
          </button>
        </form>
        <button
          type="button"
          className="mt-4 text-sm text-ag-accent w-full text-center"
          onClick={() => setMode(mode === "login" ? "register" : "login")}
        >
          {mode === "login" ? "Criar conta" : "Já tenho conta"}
        </button>
      </div>
    </div>
  );
}
