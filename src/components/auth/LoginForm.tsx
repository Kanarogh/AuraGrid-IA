"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "../../context/AuthContext";
import { APP_TAGLINE } from "../../lib/appBranding";
import { AuraLogo } from "../brand/AuraLogo";
import { Button } from "../ui/Button";

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
    <div className="min-h-screen flex items-center justify-center ag-auth-mesh px-4">
      <div className="w-full max-w-md rounded-xl border border-ag-border bg-ag-surface-1 p-8 shadow-[var(--ag-shadow-lg)]">
        <div className="flex justify-center mb-8">
          <AuraLogo variant="stacked" iconSize={48} showTagline tagline={APP_TAGLINE} />
        </div>
        <form onSubmit={submit} className="space-y-4">
          <label className="block text-sm">
            <span className="text-ag-muted font-medium">E-mail</span>
            <input
              type="email"
              required
              className="mt-1.5 w-full rounded-lg border border-ag-border bg-ag-bg px-3 py-2.5 text-ag-text ag-focus-ring focus:border-[var(--ag-focus-border)]"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
            />
          </label>
          <label className="block text-sm">
            <span className="text-ag-muted font-medium">Senha</span>
            <input
              type="password"
              required
              minLength={8}
              className="mt-1.5 w-full rounded-lg border border-ag-border bg-ag-bg px-3 py-2.5 text-ag-text ag-focus-ring focus:border-[var(--ag-focus-border)]"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
            />
          </label>
          {error && <p className="text-sm text-ag-danger">{error}</p>}
          <Button type="submit" variant="accent" size="lg" className="w-full ag-gradient-btn" loading={submitting}>
            Entrar
          </Button>
        </form>
        <p className="mt-6 text-xs text-center text-ag-muted">
          Conta criada pelo administrador da equipe.
        </p>
      </div>
    </div>
  );
}
