"use client";

import { useMemo, useState } from "react";
import { ChevronDown, ChevronRight, ExternalLink } from "lucide-react";
import { cn } from "../../lib/cn";
import type { PublishQueueItem } from "../../lib/publish/publishApi";
import {
  publishReadinessIssueLabel,
  summarizeReadinessIssues,
} from "../../lib/publish/publishReadiness";
import { publishReadinessIssues } from "./publishUiUtils";
import { PostFeedImage } from "../posts/PostFeedImage";
import { Button } from "../ui/Button";

export function PublishIncompleteTray({
  items,
  onNavigateToPost,
  expanded: expandedProp,
  onExpandedChange,
}: {
  items: PublishQueueItem[];
  onNavigateToPost: (plannedPostId: string) => void;
  expanded?: boolean;
  onExpandedChange?: (expanded: boolean) => void;
}) {
  const [expandedInternal, setExpandedInternal] = useState(items.length <= 5);
  const expanded = expandedProp ?? expandedInternal;
  const setExpanded = onExpandedChange ?? setExpandedInternal;

  const summary = useMemo(
    () =>
      summarizeReadinessIssues(
        items.map((item) => ({
          isConfirmed: item.isConfirmed,
          imageAssetId: item.imageAssetId,
          caption: item.caption,
        }))
      ),
    [items]
  );

  if (items.length === 0) return null;

  const summaryParts: string[] = [];
  if (summary.missingPhoto > 0) summaryParts.push(`${summary.missingPhoto} sem foto`);
  if (summary.missingCaption > 0) summaryParts.push(`${summary.missingCaption} sem legenda`);
  if (summary.missingApproval > 0) summaryParts.push(`${summary.missingApproval} sem aprovação`);

  return (
    <div
      id="publish-incomplete-tray"
      className="rounded-2xl border border-ag-border bg-ag-surface-2/30 p-3 space-y-2"
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <button
          type="button"
          className="flex items-start gap-2 text-left ag-focus-ring rounded-lg"
          onClick={() => setExpanded(!expanded)}
          aria-expanded={expanded}
        >
          {expanded ? (
            <ChevronDown className="h-4 w-4 mt-0.5 shrink-0 text-ag-muted" />
          ) : (
            <ChevronRight className="h-4 w-4 mt-0.5 shrink-0 text-ag-muted" />
          )}
          <div>
            <p className="text-xs font-mono uppercase tracking-widest text-ag-muted">Incompletos</p>
            <p className="text-sm font-semibold text-ag-text mt-0.5">
              {items.length} {items.length === 1 ? "post" : "posts"} · complete no Planejamento
            </p>
            {summaryParts.length > 0 && (
              <p className="text-[11px] text-ag-muted mt-0.5">{summaryParts.join(" · ")}</p>
            )}
            <p className="text-[11px] text-ag-muted mt-0.5">
              Para agendar no Instagram: foto na nuvem, legenda e aprovação confirmada.
            </p>
          </div>
        </button>
      </div>

      {expanded && (
        <div className="flex flex-col gap-2 max-h-[280px] overflow-y-auto pr-1">
          {items.map((item) => {
            const issues = publishReadinessIssues(item);
            return (
              <div
                key={item.plannedPostId}
                className="flex gap-3 items-center p-2 rounded-xl border border-ag-border/80 bg-ag-surface-1/60"
              >
                <div className="h-12 w-12 rounded-lg overflow-hidden shrink-0 bg-ag-surface-3 relative">
                  {item.imageUrl ? (
                    <PostFeedImage src={item.imageUrl} className="absolute inset-0" priority={false} />
                  ) : (
                    <div className="h-full w-full flex items-center justify-center text-[10px] text-ag-muted text-center px-1">
                      Sem foto
                    </div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-ag-text">
                    Dia {item.dayNumber}
                    <span className="text-xs font-normal text-ag-muted ml-2">{item.dateLabel}</span>
                  </p>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {issues.map((issue) => (
                      <span
                        key={issue}
                        className={cn(
                          "text-[10px] font-medium uppercase tracking-wide px-1.5 py-0.5 rounded-full border",
                          issue === "foto"
                            ? "border-ag-warning/30 bg-ag-warning/10 text-ag-warning"
                            : issue === "legenda"
                              ? "border-ag-accent/30 bg-ag-accent/10 text-ag-accent"
                              : "border-ag-border bg-ag-surface-2 text-ag-muted"
                        )}
                      >
                        {publishReadinessIssueLabel(issue)}
                      </span>
                    ))}
                  </div>
                </div>
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  className="shrink-0"
                  onClick={() => onNavigateToPost(item.plannedPostId)}
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">Completar</span>
                </Button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
