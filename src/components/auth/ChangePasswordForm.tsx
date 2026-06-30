"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "../../context/AuthContext";
import { changePasswordApi } from "../../lib/api/apiClient";
import { AuraLogo } from "../brand/AuraLogo";
import { Button } from "../ui/Button";

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

  const inputClass =
    "mt-1.5 w-full rounded-lg border border-ag-border bg-ag-bg px-3 py-2.5 text-ag-text ag-focus-ring focus:border-[var(--ag-focus-border)]";

  return (
    <div className="min-h-screen flex items-center justify-center ag-auth-mesh px-4">
      <div className="w-full max-w-md rounded-xl border border-ag-border bg-ag-surface-1 p-8 shadow-[var(--ag-shadow-lg)]">
        <div className="flex justify-center mb-8">
          <AuraLogo variant="stacked" iconSize={48} showTagline tagline="Defina uma nova senha para continuar." />
        </div>
        <form onSubmit={submit} className="space-y-4">
          <label className="block text-sm">
            <span className="text-ag-muted font-medium">Senha temporária / atual</span>
            <input
              type="password"
              required
              className={inputClass}
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              autoComplete="current-password"
            />
          </label>
          <label className="block text-sm">
            <span className="text-ag-muted font-medium">Nova senha</span>
            <input
              type="password"
              required
              minLength={8}
              className={inputClass}
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              autoComplete="new-password"
            />
          </label>
          <label className="block text-sm">
            <span className="text-ag-muted font-medium">Confirmar nova senha</span>
            <input
              type="password"
              required
              minLength={8}
              className={inputClass}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              autoComplete="new-password"
            />
          </label>
          {error && <p className="text-sm text-ag-danger">{error}</p>}
          <Button type="submit" variant="accent" size="lg" className="w-full ag-gradient-btn" loading={submitting}>
            Salvar nova senha
          </Button>
        </form>
      </div>
    </div>
  );
}
