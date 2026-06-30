"use client";

import { useState, useEffect, useCallback } from "react";
import { Loader2, Plus, Trash2, UserPlus } from "lucide-react";
import { useClientWorkspace } from "../../context/ClientWorkspaceContext";
import {
  createTeamMemberApi,
  deleteTeamMemberApi,
  fetchTeamMembers,
  updateTeamMemberApi,
  type TeamMemberRecord,
} from "../../lib/api/apiClient";
import { permissionsForRole } from "../../lib/permissions/roleTemplates";
import type { DisplayRole } from "../../lib/permissions/types";
import { generateTemporaryPassword } from "../../lib/team/generateTempPassword";
import { Button } from "../ui/Button";
import { toast } from "../../lib/toast";

const ROLES: { id: DisplayRole; label: string }[] = [
  { id: "manager", label: "Gerente" },
  { id: "editor", label: "Editor" },
  { id: "viewer", label: "Visualizador" },
];

export function TeamMembersPanel() {
  const { clients } = useClientWorkspace();
  const [members, setMembers] = useState<TeamMemberRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [email, setEmail] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [tempPassword, setTempPassword] = useState("");
  const [displayRole, setDisplayRole] = useState<DisplayRole>("editor");
  const [selectedClients, setSelectedClients] = useState<string[]>([]);
  const [enablePublish, setEnablePublish] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editRole, setEditRole] = useState<DisplayRole>("editor");
  const [editClients, setEditClients] = useState<string[]>([]);
  const [editPublish, setEditPublish] = useState(false);
  const [editSuspended, setEditSuspended] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setMembers(await fetchTeamMembers());
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Falha ao carregar equipe.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const toggleClient = (id: string) => {
    setSelectedClients((prev) =>
      prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id]
    );
  };

  const submitMember = async () => {
    if (!email.trim() || !tempPassword || selectedClients.length === 0) {
      toast.warning("Preencha e-mail, senha temporária e selecione ao menos um cliente.");
      return;
    }
    setSubmitting(true);
    try {
      const base = permissionsForRole(displayRole);
      const permissionsByClient: Record<string, typeof base> = {};
      for (const clientId of selectedClients) {
        const perms = structuredClone(base);
        if (enablePublish) {
          perms.sections.post_scheduling = "write";
          perms.actions.managePublish = true;
        } else if (displayRole !== "manager") {
          perms.sections.post_scheduling = "none";
          perms.actions.managePublish = false;
        }
        permissionsByClient[clientId] = perms;
      }
      await createTeamMemberApi({
        email,
        displayName: displayName || email.split("@")[0] || "Membro",
        temporaryPassword: tempPassword,
        displayRole,
        clientIds: selectedClients,
        permissionsByClient,
      });
      toast.success("Membro criado. Compartilhe a senha temporária com segurança.");
      setShowForm(false);
      setEmail("");
      setDisplayName("");
      setTempPassword("");
      setSelectedClients([]);
      setEnablePublish(false);
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Falha ao criar membro.");
    } finally {
      setSubmitting(false);
    }
  };

  const removeMember = async (userId: string) => {
    if (!confirm("Remover este membro da equipe?")) return;
    try {
      await deleteTeamMemberApi(userId);
      toast.success("Membro removido.");
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Falha ao remover.");
    }
  };

  const startEdit = (m: TeamMemberRecord) => {
    setEditingId(m.userId);
    setEditRole(m.displayRole as DisplayRole);
    setEditClients(m.clientAccess.map((a) => a.clientId));
    const perms = m.clientAccess[0]?.permissions;
    setEditPublish(Boolean(perms?.actions.managePublish));
    setEditSuspended(m.status === "suspended");
  };

  const saveEdit = async (userId: string) => {
    if (editClients.length === 0) {
      toast.warning("Selecione ao menos um cliente.");
      return;
    }
    setSubmitting(true);
    try {
      const base = permissionsForRole(editRole);
      const permissionsByClient: Record<string, typeof base> = {};
      for (const clientId of editClients) {
        const perms = structuredClone(base);
        if (editPublish) {
          perms.sections.post_scheduling = "write";
          perms.actions.managePublish = true;
        } else if (editRole !== "manager") {
          perms.sections.post_scheduling = "none";
          perms.actions.managePublish = false;
        }
        permissionsByClient[clientId] = perms;
      }
      await updateTeamMemberApi(userId, {
        displayRole: editRole,
        clientIds: editClients,
        permissionsByClient,
        status: editSuspended ? "suspended" : "active",
      });
      toast.success("Membro atualizado.");
      setEditingId(null);
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Falha ao atualizar.");
    } finally {
      setSubmitting(false);
    }
  };

  const clientNameById = (id: string) => clients.find((c) => c.id === id)?.name ?? id;

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-ag-accent" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-ag-text">Equipe</h2>
          <p className="text-sm text-ag-muted">
            Convide membros, defina clientes e permissões (incl. Programar posts).
          </p>
        </div>
        <Button type="button" variant="accent" size="sm" onClick={() => setShowForm((v) => !v)}>
          <UserPlus className="h-4 w-4" />
          Adicionar membro
        </Button>
      </div>

      {showForm && (
        <div className="rounded-2xl border border-ag-border bg-ag-surface-2/40 p-4 space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="text-sm block">
              <span className="text-ag-muted">E-mail</span>
              <input
                type="email"
                className="mt-1 w-full rounded-xl border border-ag-border bg-ag-bg px-3 py-2"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </label>
            <label className="text-sm block">
              <span className="text-ag-muted">Nome</span>
              <input
                className="mt-1 w-full rounded-xl border border-ag-border bg-ag-bg px-3 py-2"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
              />
            </label>
            <label className="text-sm block">
              <span className="text-ag-muted">Senha temporária</span>
              <div className="mt-1 flex gap-2">
                <input
                  type="text"
                  className="flex-1 rounded-xl border border-ag-border bg-ag-bg px-3 py-2 font-mono text-sm"
                  value={tempPassword}
                  onChange={(e) => setTempPassword(e.target.value)}
                />
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() => setTempPassword(generateTemporaryPassword())}
                >
                  Gerar
                </Button>
              </div>
            </label>
            <label className="text-sm block">
              <span className="text-ag-muted">Função</span>
              <select
                className="mt-1 w-full rounded-xl border border-ag-border bg-ag-bg px-3 py-2"
                value={displayRole}
                onChange={(e) => setDisplayRole(e.target.value as DisplayRole)}
              >
                {ROLES.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.label}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div>
            <p className="text-sm font-medium text-ag-text mb-2">Clientes com acesso</p>
            <div className="flex flex-wrap gap-2">
              {clients.map((c) => (
                <label
                  key={c.id}
                  className="inline-flex items-center gap-2 rounded-lg border border-ag-border px-3 py-1.5 text-sm cursor-pointer"
                >
                  <input
                    type="checkbox"
                    checked={selectedClients.includes(c.id)}
                    onChange={() => toggleClient(c.id)}
                  />
                  {c.name}
                </label>
              ))}
            </div>
          </div>

          <label className="inline-flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={enablePublish}
              onChange={(e) => setEnablePublish(e.target.checked)}
            />
            Permitir Programar posts (redes sociais)
          </label>

          <div className="flex gap-2">
            <Button type="button" variant="accent" disabled={submitting} onClick={() => void submitMember()}>
              {submitting ? "Criando…" : "Criar membro"}
            </Button>
            <Button type="button" variant="secondary" onClick={() => setShowForm(false)}>
              Cancelar
            </Button>
          </div>
        </div>
      )}

      {members.length === 0 ? (
        <p className="text-sm text-ag-muted">Nenhum membro na equipe ainda.</p>
      ) : (
        <ul className="divide-y divide-ag-border rounded-2xl border border-ag-border overflow-hidden">
          {members.map((m) => (
            <li key={m.userId} className="px-4 py-3 bg-ag-surface space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="font-medium text-ag-text">{m.displayName}</p>
                <p className="text-xs text-ag-muted">{m.email} · {m.displayRole}{m.status === "suspended" ? " · suspenso" : ""}</p>
                <p className="text-xs text-ag-muted mt-0.5">
                  {m.clientAccess.map((a) => clientNameById(a.clientId)).join(", ") || "Sem clientes"}
                  {m.mustChangePassword ? " · senha temporária pendente" : ""}
                </p>
              </div>
              <div className="flex gap-2">
                <Button type="button" variant="secondary" size="sm" onClick={() => startEdit(m)}>
                  Editar
                </Button>
              <Button type="button" variant="secondary" size="sm" onClick={() => void removeMember(m.userId)}>
                <Trash2 className="h-4 w-4" />
                Remover
              </Button>
              </div>
              </div>
              {editingId === m.userId && (
                <div className="rounded-xl border border-ag-border p-3 space-y-3">
                  <select
                    className="w-full rounded-xl border border-ag-border bg-ag-bg px-3 py-2 text-sm"
                    value={editRole}
                    onChange={(e) => setEditRole(e.target.value as DisplayRole)}
                  >
                    {ROLES.map((r) => (
                      <option key={r.id} value={r.id}>{r.label}</option>
                    ))}
                  </select>
                  <div className="flex flex-wrap gap-2">
                    {clients.map((c) => (
                      <label key={c.id} className="inline-flex items-center gap-2 text-sm">
                        <input
                          type="checkbox"
                          checked={editClients.includes(c.id)}
                          onChange={() =>
                            setEditClients((prev) =>
                              prev.includes(c.id) ? prev.filter((x) => x !== c.id) : [...prev, c.id]
                            )
                          }
                        />
                        {c.name}
                      </label>
                    ))}
                  </div>
                  <label className="inline-flex items-center gap-2 text-sm">
                    <input type="checkbox" checked={editPublish} onChange={(e) => setEditPublish(e.target.checked)} />
                    Programar posts
                  </label>
                  <label className="inline-flex items-center gap-2 text-sm">
                    <input type="checkbox" checked={editSuspended} onChange={(e) => setEditSuspended(e.target.checked)} />
                    Suspenso
                  </label>
                  <div className="flex gap-2">
                    <Button type="button" variant="accent" size="sm" disabled={submitting} onClick={() => void saveEdit(m.userId)}>
                      Salvar
                    </Button>
                    <Button type="button" variant="secondary" size="sm" onClick={() => setEditingId(null)}>
                      Cancelar
                    </Button>
                  </div>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
