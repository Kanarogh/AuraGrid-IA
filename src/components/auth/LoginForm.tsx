"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "../../context/AuthContext";
import { APP_NAME } from "../../lib/appBranding";

export function LoginForm({
  onSuccess,
}: {
  onSuccess?: () => void;
}) {
  const { login } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const user = await login(email, password);
      if (user.mustChangePassword) {
        router.replace("/redefinir-senha");
        return;
      }
      onSuccess?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha na autenticação.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-ag-bg px-4">
      <div className="w-full max-w-md rounded-2xl border border-ag-border bg-ag-surface p-8 shadow-xl">
        <h1 className="text-xl font-bold text-ag-text mb-1">{APP_NAME}</h1>
        <p className="text-sm text-ag-muted mb-6">Entre na sua conta</p>
        <form onSubmit={submit} className="space-y-4">
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
              autoComplete="current-password"
            />
          </label>
          {error && <p className="text-sm text-ag-danger">{error}</p>}
          <button
            type="submit"
            disabled={submitting}
            className="w-full rounded-xl bg-ag-accent text-white py-2.5 font-semibold disabled:opacity-50"
          >
            {submitting ? "Aguarde…" : "Entrar"}
          </button>
        </form>
        <p className="mt-4 text-xs text-center text-ag-muted">
          Conta criada pelo administrador da equipe.
        </p>
      </div>
    </div>
  );
}
