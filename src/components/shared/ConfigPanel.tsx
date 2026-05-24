import { useState } from "react";
import { Building, ChevronDown, Hash, Info, PhoneCall, Sparkles } from "lucide-react";
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
  const [footerOpen, setFooterOpen] = useState(true);

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
        Mesma estrutura dos <strong>Gems do Gemini</strong>: nome, descrição e instruções viram o
        system prompt em toda geração de legenda para o cliente ativo (
        <code className="text-xs font-mono text-ag-accent">{brandGem.id}</code>). Troque de cliente
        na barra lateral.
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
              placeholder="Ex.: Palak Euro"
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
            placeholder="Resumo do papel do assistente para esta marca…"
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
            placeholder="Você é o estrategista de marketing da marca… REGRA DE IDIOMA: …"
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
              <p className="text-xs text-ag-muted py-2">
                Endereço, contato e hashtags entram no rodapé de cada legenda gerada (complementam o
                Gem).
              </p>
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
