import { useState } from "react";
import { Building, ChevronDown, Hash, Info, ListOrdered, PhoneCall, Sparkles } from "lucide-react";
import { cn } from "../../lib/cn";
import { gemInitial } from "../../lib/brandGem";
import type { BrandGem } from "../../types";
import { AiProviderPanel } from "./AiProviderPanel";
import { Card } from "../ui/Card";
import { FieldLabel, Input, Textarea } from "../ui/Input";

export function ConfigPanel({
  open = true,
  variant = "panel",
  brandGem,
  onBrandGemChange,
}: {
  open?: boolean;
  variant?: "panel" | "page";
  onClose?: () => void;
  brandGem: BrandGem;
  onBrandGemChange: (gem: BrandGem) => void;
}) {
  const [footerOpen, setFooterOpen] = useState(false);

  if (!open) return null;

  const isPage = variant === "page";

  const patch = (partial: Partial<BrandGem>) => {
    onBrandGemChange({ ...brandGem, ...partial });
  };

  const patchFooter = (partial: Partial<BrandGem["footer"]>) => {
    onBrandGemChange({ ...brandGem, footer: { ...brandGem.footer, ...partial } });
  };

  const content = (
    <>
      <div className="flex items-center gap-2 mb-1">
        <Sparkles className="h-5 w-5 text-ag-accent" />
        <h2
          className={cn(
            "font-semibold text-ag-text",
            isPage ? "font-display text-2xl" : "font-display text-xl"
          )}
        >
          Gem da marca
        </h2>
      </div>
      <p className="text-sm text-ag-muted mb-6">
        Preencha os campos abaixo para este cliente (
        <code className="text-xs font-mono text-ag-accent">{brandGem.id}</code>). Tudo fica salvo
        automaticamente no workspace — nada vem pré-preenchido com texto de outra marca.
      </p>

      <div className="mb-8">
        <AiProviderPanel />
      </div>

      <div className="rounded-2xl border border-ag-border bg-ag-surface-2/50 p-5 sm:p-6 space-y-5">
        <div className="flex items-center gap-4 pb-4 border-b border-ag-border/60">
          <div
            className="h-14 w-14 rounded-full bg-gradient-to-br from-amber-400/90 to-amber-600/80 flex items-center justify-center text-2xl font-display font-semibold text-stone-900 shadow-md shrink-0"
            aria-hidden
          >
            {gemInitial(brandGem.name)}
          </div>
          <div className="min-w-0 flex-1">
            <FieldLabel>Nome</FieldLabel>
            <Input
              value={brandGem.name}
              onChange={(e) => patch({ name: e.target.value })}
              placeholder="Nome da marca ou do Gem"
              className="text-base font-medium"
            />
          </div>
        </div>

        <div>
          <FieldLabel>Descrição</FieldLabel>
          <Textarea
            value={brandGem.description}
            onChange={(e) => patch({ description: e.target.value })}
            rows={3}
            placeholder="Ex.: papel do assistente, público, idioma das legendas…"
            className="text-sm"
          />
        </div>

        <div>
          <FieldLabel>
            <span className="inline-flex items-center gap-1.5">
              Instruções
              <span
                className="text-ag-muted cursor-help"
                title="Regras completas de tom, idioma, público e estilo — equivalente ao campo Instruções do Gem no Gemini."
              >
                ⓘ
              </span>
            </span>
          </FieldLabel>
          <Textarea
            value={brandGem.instructions}
            onChange={(e) => patch({ instructions: e.target.value })}
            rows={14}
            placeholder="Tom, idioma, regras de venda, estilo Instagram…"
            className="text-sm leading-relaxed font-mono"
          />
          <p className="text-[11px] text-ag-muted mt-1.5">
            Enviado à IA em cada legenda (individual, lote ou refinamento).
          </p>
        </div>

      </div>

      <div className="mt-6 rounded-xl border border-ag-border bg-ag-surface-1/80 overflow-hidden">
        <button
          type="button"
          onClick={() => setFooterOpen((o) => !o)}
          className="w-full flex items-center justify-between gap-2 px-4 py-3 text-left text-sm font-semibold text-ag-text hover:bg-ag-surface-2 cursor-pointer"
        >
          <span>Dados fixos nas legendas</span>
          <ChevronDown
            className={cn("h-4 w-4 text-ag-muted transition-transform", footerOpen && "rotate-180")}
          />
        </button>
        {footerOpen && (
          <div className="px-4 pb-4 pt-0 grid grid-cols-1 sm:grid-cols-2 gap-4 border-t border-ag-border/60">
            <div className="sm:col-span-2">
              <p className="text-xs text-ag-muted py-2 leading-relaxed">
                Ordem da legenda: <strong className="text-ag-text">texto principal</strong> →{" "}
                <strong className="text-ag-text">Referencia: código</strong> só se o post tiver
                vestido ou pessoa com roupa do catálogo →{" "}
                <strong className="text-ag-text">rodapé</strong> (endereço, contato, hashtags).
                Imagem sem peça (paisagem, arte, etc.) não leva linha Referencia.
              </p>
            </div>
            <div className="sm:col-span-2">
              <FieldLabel>
                <span className="inline-flex items-center gap-1">
                  <ListOrdered className="h-3 w-3" /> Estrutura da legenda (opcional)
                </span>
              </FieldLabel>
              <Textarea
                value={brandGem.footer.structure ?? ""}
                onChange={(e) => patchFooter({ structure: e.target.value })}
                rows={4}
                placeholder="Notas extras sobre a ordem dos blocos, se precisar…"
                className="text-sm"
              />
            </div>
            <div>
              <FieldLabel>
                <span className="inline-flex items-center gap-1">
                  <Building className="h-3 w-3" /> Endereço
                </span>
              </FieldLabel>
              <Input
                value={brandGem.footer.address}
                onChange={(e) => patchFooter({ address: e.target.value })}
                placeholder="Endereço da loja (se quiser no rodapé da legenda)"
              />
            </div>
            <div>
              <FieldLabel>
                <span className="inline-flex items-center gap-1">
                  <PhoneCall className="h-3 w-3" /> Contato
                </span>
              </FieldLabel>
              <Input
                value={brandGem.footer.contact}
                onChange={(e) => patchFooter({ contact: e.target.value })}
                placeholder="WhatsApp, CTA, link da bio…"
              />
            </div>
            <div className="sm:col-span-2">
              <FieldLabel>
                <span className="inline-flex items-center gap-1">
                  <Hash className="h-3 w-3" /> Hashtags
                </span>
              </FieldLabel>
              <Input
                value={brandGem.footer.hashtags}
                onChange={(e) => patchFooter({ hashtags: e.target.value })}
                placeholder="#Marca #Coleção …"
              />
            </div>
            <div className="sm:col-span-2">
              <FieldLabel>
                <span className="inline-flex items-center gap-1">
                  <Info className="h-3 w-3" /> Nota legal / rodapé
                </span>
              </FieldLabel>
              <Input
                value={brandGem.footer.extra}
                onChange={(e) => patchFooter({ extra: e.target.value })}
                placeholder="Nota legal ou frase fixa no fim da legenda"
              />
            </div>
          </div>
        )}
      </div>

      {isPage && (
        <p className="text-xs text-ag-muted pt-6 border-t border-ag-border mt-6">
          Salvo automaticamente no workspace deste cliente. Use a lista &quot;Clientes&quot; na
          barra lateral para alternar marcas.
        </p>
      )}
    </>
  );

  if (isPage) {
    return <div className="animate-ag-fade-in">{content}</div>;
  }

  return (
    <Card variant="elevated" className="mb-8 animate-ag-fade-in">
      {content}
    </Card>
  );
}
