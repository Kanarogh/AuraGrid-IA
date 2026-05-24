import { useEffect, useState, type FormEvent } from "react";
import { slugifyClientName } from "../../lib/clientWorkspace";
import { useClientWorkspace } from "../../context/ClientWorkspaceContext";
import { Button } from "../ui/Button";
import { FieldLabel, Input } from "../ui/Input";
import { Modal } from "../ui/Modal";

export function NewClientModal({
  open,
  onClose,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  onCreated?: (clientId: string) => void;
}) {
  const { createClient } = useClientWorkspace();
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [slugTouched, setSlugTouched] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setName("");
    setSlug("");
    setSlugTouched(false);
    setError(null);
  }, [open]);

  useEffect(() => {
    if (!slugTouched && name.trim()) {
      setSlug(slugifyClientName(name));
    }
  }, [name, slugTouched]);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) {
      setError("Informe o nome do cliente.");
      return;
    }
    const newId = createClient(trimmed, slug.trim() || undefined);
    if (!newId) {
      setError("Não foi possível criar o cliente.");
      return;
    }
    onCreated?.(newId);
    onClose();
  };

  return (
    <Modal open={open} onClose={onClose} title="Novo cliente">
      <form onSubmit={handleSubmit} className="space-y-4">
        <p className="text-sm text-ag-muted">
          Cria um workspace vazio: catálogo, roteiro de 30 dias, grid Canva e Gem próprios.
        </p>
        <div>
          <FieldLabel>Nome</FieldLabel>
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Ex.: Boutique Luna"
            autoFocus
          />
        </div>
        <div>
          <FieldLabel>Identificador (slug)</FieldLabel>
          <Input
            value={slug}
            onChange={(e) => {
              setSlugTouched(true);
              setSlug(e.target.value);
            }}
            placeholder="boutique-luna"
            className="font-mono text-sm"
          />
          <p className="text-[10px] text-ag-muted mt-1">
            Usado internamente; deve ser único entre clientes.
          </p>
        </div>
        {error && (
          <p className="text-xs text-ag-danger rounded-lg border border-ag-danger/30 bg-ag-danger/10 px-3 py-2">
            {error}
          </p>
        )}
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit">Criar cliente</Button>
        </div>
      </form>
    </Modal>
  );
}
