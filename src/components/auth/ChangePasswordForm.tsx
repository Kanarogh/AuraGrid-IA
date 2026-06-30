"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "../../context/AuthContext";
import { changePasswordApi } from "../../lib/api/apiClient";
import { APP_NAME, APP_TAGLINE } from "../../lib/appBranding";

export function ChangePasswordForm({ onSuccess }: { onSuccess?: () => void }) {
  const { refreshUser } = useAuth();
  const router = useRouter();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    if (newPassword.length < 8) {
      setError("A nova senha deve ter pelo menos 8 caracteres.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("As senhas não coincidem.");
      return;
    }
    setSubmitting(true);
    try {
      await changePasswordApi(currentPassword, newPassword);
      await refreshUser();
      onSuccess?.();
      router.replace("/dashboard");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível alterar a senha.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-ag-bg px-4">
      <div className="w-full max-w-md rounded-2xl border border-ag-border bg-ag-surface p-8 shadow-xl">
        <h1 className="text-xl font-bold text-ag-text mb-1">{APP_NAME}</h1>
        <p className="text-sm text-ag-muted mb-6">Defina uma nova senha para continuar.</p>
        <form onSubmit={submit} className="space-y-4">
          <label className="block text-sm">
            <span className="text-ag-muted">Senha temporária / atual</span>
            <input
              type="password"
              required
              className="mt-1 w-full rounded-xl border border-ag-border bg-ag-bg px-3 py-2"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              autoComplete="current-password"
            />
          </label>
          <label className="block text-sm">
            <span className="text-ag-muted">Nova senha</span>
            <input
              type="password"
              required
              minLength={8}
              className="mt-1 w-full rounded-xl border border-ag-border bg-ag-bg px-3 py-2"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              autoComplete="new-password"
            />
          </label>
          <label className="block text-sm">
            <span className="text-ag-muted">Confirmar nova senha</span>
            <input
              type="password"
              required
              minLength={8}
              className="mt-1 w-full rounded-xl border border-ag-border bg-ag-bg px-3 py-2"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              autoComplete="new-password"
            />
          </label>
          {error && <p className="text-sm text-ag-danger">{error}</p>}
          <button
            type="submit"
            disabled={submitting}
            className="w-full rounded-xl bg-ag-accent text-white py-2.5 font-semibold disabled:opacity-50"
          >
            {submitting ? "Salvando…" : "Salvar nova senha"}
          </button>
        </form>
      </div>
    </div>
  );
}
