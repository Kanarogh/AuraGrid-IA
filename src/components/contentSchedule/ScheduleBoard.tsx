import { useState } from "react";
import { Loader2, Plus } from "lucide-react";
import type { ContentScheduleItem, ContentScheduleSection } from "../../types";
import { CONTENT_SCHEDULE_STATUS_LABELS } from "../../lib/contentSchedule/format";
import { cn } from "../../lib/cn";
import { WorkspaceCard } from "../layout/WorkspaceCard";
import { Button } from "../ui/Button";
import { Badge } from "../ui/Badge";
import { statusBadgeTone } from "./scheduleUi";

type ScheduleBoardProps = {
  postsItems: ContentScheduleItem[];
  storiesItems: ContentScheduleItem[];
  selectedId: string | null;
  isReadOnly?: boolean;
  brandGemReady: boolean;
  creatingSingle: ContentScheduleSection | null;
  hasBrief: boolean;
  onSelect: (id: string) => void;
  onCreateSingle: (section: ContentScheduleSection) => void;
  onApprove: (id: string) => void;
};

export function ScheduleBoard({
  postsItems,
  storiesItems,
  selectedId,
  isReadOnly,
  brandGemReady,
  creatingSingle,
  hasBrief,
  onSelect,
  onCreateSingle,
  onApprove,
}: ScheduleBoardProps) {
  const [activeTab, setActiveTab] = useState<ContentScheduleSection | "all">("all");

  const showPosts = activeTab === "all" || activeTab === "posts";
  const showStories = activeTab === "all" || activeTab === "stories";

  return (
    <div id="schedule-board" className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs font-semibold text-ag-text">Revisar itens</p>
        <div className="flex rounded-lg border border-ag-border/60 p-0.5 bg-ag-surface-2/80">
          {(
            [
              { id: "all" as const, label: "Todos" },
              { id: "posts" as const, label: `Posts (${postsItems.length})` },
              { id: "stories" as const, label: `Stories (${storiesItems.length})` },
            ] as const
          ).map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                "px-2.5 py-1 text-[11px] font-medium rounded-md transition-colors",
                activeTab === tab.id
                  ? "bg-ag-surface-1 text-ag-text shadow-sm"
                  : "text-ag-muted hover:text-ag-text"
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      <div
        className={cn(
          "grid gap-4",
          activeTab === "all" ? "lg:grid-cols-2" : "grid-cols-1"
        )}
      >
        {showPosts && (
          <ScheduleColumn
            section="posts"
            title="Posts de Arte"
            items={postsItems}
            selectedId={selectedId}
            isReadOnly={isReadOnly}
            canCreate={!isReadOnly && brandGemReady}
            creating={creatingSingle === "posts"}
            hasBrief={hasBrief}
            onCreateSingle={() => onCreateSingle("posts")}
            onSelect={onSelect}
            onApprove={onApprove}
          />
        )}
        {showStories && (
          <ScheduleColumn
            section="stories"
            title="Stories"
            items={storiesItems}
            selectedId={selectedId}
            isReadOnly={isReadOnly}
            canCreate={!isReadOnly && brandGemReady}
            creating={creatingSingle === "stories"}
            hasBrief={hasBrief}
            onCreateSingle={() => onCreateSingle("stories")}
            onSelect={onSelect}
            onApprove={onApprove}
          />
        )}
      </div>
    </div>
  );
}

function ScheduleColumn({
  section,
  title,
  items,
  selectedId,
  isReadOnly,
  canCreate,
  creating,
  hasBrief,
  onCreateSingle,
  onSelect,
  onApprove,
}: {
  section: ContentScheduleSection;
  title: string;
  items: ContentScheduleItem[];
  selectedId: string | null;
  isReadOnly?: boolean;
  canCreate?: boolean;
  creating?: boolean;
  hasBrief: boolean;
  onCreateSingle?: () => void;
  onSelect: (id: string) => void;
  onApprove: (id: string) => void;
}) {
  return (
    <WorkspaceCard variant="secondary" padding={false}>
      <div className="border-b border-ag-border/60 px-4 py-3 flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-ag-text">
          {title}{" "}
          <span className="text-ag-muted font-normal">({items.length})</span>
        </h3>
        {canCreate && onCreateSingle && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={creating}
            onClick={onCreateSingle}
          >
            {creating ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Plus className="h-3.5 w-3.5" />
            )}
            Criar
          </Button>
        )}
      </div>
      <ul className="p-3 space-y-2 max-h-[min(520px,50vh)] overflow-y-auto">
        {items.length === 0 ? (
          <li className="rounded-lg border border-dashed border-ag-border/60 px-4 py-8 text-center">
            <p className="text-xs font-medium text-ag-text">Nenhum {section === "posts" ? "post" : "story"} ainda</p>
            <p className="text-[11px] text-ag-muted mt-1 leading-relaxed">
              {hasBrief
                ? "Gere o cronograma completo ou use Criar para adicionar um item avulso."
                : "Comece preenchendo o briefing e clique em Gerar cronograma com IA."}
            </p>
          </li>
        ) : (
          items.map((item) => (
            <li key={item.id}>
              <article
                className={cn(
                  "rounded-lg border transition-all",
                  selectedId === item.id
                    ? "border-ag-accent/50 bg-ag-accent/8 ring-1 ring-ag-accent/25 shadow-sm"
                    : "border-ag-border/50 bg-ag-surface-1/50 hover:border-ag-border hover:bg-ag-surface-2/60"
                )}
              >
                <button
                  type="button"
                  onClick={() => onSelect(item.id)}
                  className="w-full text-left p-3 cursor-pointer"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-ag-text truncate">{item.name}</p>
                      <p className="text-[11px] text-ag-muted mt-0.5">
                        {item.postType}
                        {item.scheduledDate ? ` · ${item.scheduledDate}` : ""}
                      </p>
                    </div>
                    <Badge tone={statusBadgeTone(item.status)} className="shrink-0 text-[10px]">
                      {CONTENT_SCHEDULE_STATUS_LABELS[item.status]}
                    </Badge>
                  </div>
                  <p className="text-xs text-ag-text/85 mt-2 line-clamp-2 leading-relaxed">
                    {item.headline || "Sem headline"}
                  </p>
                </button>
                {!isReadOnly && item.status === "draft" && (
                  <div className="px-3 pb-3 flex justify-end border-t border-ag-border/30 pt-2">
                    <Button
                      type="button"
                      variant="accent"
                      size="sm"
                      className="h-7 text-xs"
                      onClick={() => onApprove(item.id)}
                    >
                      Aprovar
                    </Button>
                  </div>
                )}
              </article>
            </li>
          ))
        )}
      </ul>
    </WorkspaceCard>
  );
}
