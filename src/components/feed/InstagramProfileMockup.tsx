import {
  ArrowRight,
  Check,
  Clapperboard,
  Heart,
  Home,
  LayoutGrid,
  Menu,
  Plus,
  Search,
  Tag,
} from "lucide-react";
import type { CanvaGridPage, PlannedPost } from "../../types";
import { gemInitial } from "../../lib/brandGem";
import { sortPostsForInstagramProfile } from "../../lib/instagramFeedOrder";
import { cn } from "../../lib/cn";

function Stat({ value, label }: { value: string | number; label: string }) {
  return (
    <div className="text-center min-w-0 flex-1">
      <p className="text-[13px] font-semibold text-white leading-tight">{value}</p>
      <p className="text-[10px] text-stone-400 leading-tight mt-0.5">{label}</p>
    </div>
  );
}

function StoryHighlight({ label, isNew }: { label: string; isNew?: boolean }) {
  return (
    <div className="flex flex-col items-center gap-1 shrink-0 w-[64px]">
      <div
        className={cn(
          "h-[54px] w-[54px] rounded-full border flex items-center justify-center",
          isNew ? "border-stone-600 bg-stone-900" : "border-stone-700 bg-stone-800/80"
        )}
      >
        {isNew ? (
          <Plus className="h-5 w-5 text-stone-300" strokeWidth={1.5} />
        ) : (
          <div className="h-full w-full rounded-full bg-gradient-to-br from-stone-700 to-stone-900" />
        )}
      </div>
      <span className="text-[9px] text-stone-400 truncate w-full text-center">{label}</span>
    </div>
  );
}

export function InstagramProfileMockup({
  posts,
  canvaPages,
  canvaGridReversed,
  displayName,
  username,
  activePreviewId,
  swapSourceId,
  onSelectPost,
  onSwapDays,
  scheduleOverlay,
}: {
  posts: PlannedPost[];
  canvaPages?: CanvaGridPage[];
  canvaGridReversed?: boolean;
  displayName: string;
  username: string;
  activePreviewId: string;
  swapSourceId: string;
  onSelectPost: (postId: string) => void;
  onSwapDays: (fromId: string, toId: string) => void;
  scheduleOverlay?: Map<
    string,
    {
      scheduledAt: string;
      status: "queued" | "publishing" | "published" | "failed" | "eligible" | "not_ready" | "cancelled";
    }
  >;
}) {
  const handle = username.replace(/^@/, "");
  const ordered = sortPostsForInstagramProfile(posts, {
    canvaPages,
    canvaGridReversed,
  }).filter((p) => Boolean(p.image));
  const confirmed = ordered.filter((p) => p.isConfirmed).length;

  return (
    <div className="relative mx-auto w-full max-w-[400px]">
      <div
        className="absolute -inset-4 rounded-[3rem] opacity-30 blur-3xl pointer-events-none mx-auto max-w-[400px]"
        style={{
          background:
            "radial-gradient(circle at 50% 20%, color-mix(in srgb, var(--ag-accent) 40%, transparent), transparent 65%)",
        }}
      />

      <div className="relative rounded-[2.75rem] border-[7px] border-stone-800 bg-black shadow-[0_24px_80px_rgba(0,0,0,0.55)] overflow-hidden">
        {/* Notch */}
        <div className="absolute top-0 inset-x-0 z-30 flex justify-center pt-1.5 pointer-events-none">
          <div className="h-[22px] w-[100px] rounded-full bg-black border border-stone-800/80" />
        </div>

        <div className="bg-black text-white text-[11px] min-h-[640px] max-h-[min(82vh,780px)] flex flex-col overflow-hidden">
          {/* Top bar */}
          <div className="flex items-center justify-between px-4 pt-9 pb-2 shrink-0">
            <span className="font-semibold text-[13px] tracking-tight truncate pr-2">
              {handle}
            </span>
            <div className="flex items-center gap-4 shrink-0 text-white">
              <Plus className="h-[22px] w-[22px]" strokeWidth={1.75} />
              <Menu className="h-[22px] w-[22px]" strokeWidth={1.75} />
            </div>
          </div>

          <div className="flex-1 overflow-y-auto overflow-x-hidden ag-scrollbar-thin">
            {/* Profile header */}
            <div className="px-4 pt-2 pb-3">
              <div className="flex items-center gap-5">
                <div className="h-[77px] w-[77px] shrink-0 rounded-full p-[2.5px] bg-gradient-to-tr from-amber-400 via-pink-500 to-violet-600">
                  <div className="h-full w-full rounded-full bg-black flex items-center justify-center font-display italic text-xl font-bold text-ag-accent">
                    {gemInitial(displayName)}
                  </div>
                </div>
                <div className="flex flex-1 justify-between gap-1 min-w-0">
                  <Stat value={ordered.length} label="Posts" />
                  <Stat value="—" label="Followers" />
                  <Stat value="—" label="Following" />
                </div>
              </div>

              <div className="mt-3 space-y-0.5">
                <p className="font-semibold text-[12px]">{displayName}</p>
                <p className="text-[11px] text-stone-300 leading-snug">
                  Planejamento editorial · Showroom B2B
                </p>
                {confirmed > 0 && (
                  <p className="text-[10px] text-stone-500">
                    {confirmed} {confirmed === 1 ? "post confirmado" : "posts confirmados"}
                  </p>
                )}
              </div>

              {/* Action buttons */}
              <div className="mt-3 space-y-1.5">
                <button
                  type="button"
                  className="w-full py-1.5 rounded-lg bg-stone-800 text-[11px] font-semibold text-white"
                >
                  Edit profile
                </button>
                <div className="grid grid-cols-3 gap-1.5">
                  {["Promotions", "Insights", "Contact"].map((label) => (
                    <button
                      key={label}
                      type="button"
                      className="py-1.5 rounded-lg bg-stone-800 text-[10px] font-semibold text-white truncate px-1"
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Story highlights */}
              <div className="mt-4 flex gap-3 overflow-x-auto pb-1 -mx-1 px-1 scrollbar-none">
                <StoryHighlight label="New" isNew />
                {["Coleção", "Dia 1", "VIP", "Backstage"].map((label) => (
                  <div key={label}>
                    <StoryHighlight label={label} />
                  </div>
                ))}
              </div>
            </div>

            {/* Content tabs */}
            <div className="flex border-y border-white/10 shrink-0">
              <button
                type="button"
                className="flex-1 flex justify-center py-2.5 border-b-2 border-white text-white"
                aria-current="page"
              >
                <LayoutGrid className="h-[18px] w-[18px]" strokeWidth={1.5} />
              </button>
              <button
                type="button"
                className="flex-1 flex justify-center py-2.5 text-stone-500"
              >
                <Clapperboard className="h-[18px] w-[18px]" strokeWidth={1.5} />
              </button>
              <button
                type="button"
                className="flex-1 flex justify-center py-2.5 text-stone-500"
              >
                <Tag className="h-[18px] w-[18px]" strokeWidth={1.5} />
              </button>
            </div>

            {/* Photo grid */}
            {ordered.length === 0 ? (
              <div className="py-16 px-6 text-center text-stone-500 text-[11px] leading-relaxed">
                Sem fotos no feed ainda.
                <br />
                Adicione posts em Planejamento.
              </div>
            ) : (
              <div className="grid grid-cols-3 gap-[2px]">
                {ordered.map((post) => {
                  const isFocused = post.id === activePreviewId;
                  const sched = scheduleOverlay?.get(post.id);
                  const schedTime = sched
                    ? new Date(sched.scheduledAt).toLocaleTimeString("pt-BR", {
                        hour: "2-digit",
                        minute: "2-digit",
                      })
                    : null;
                  return (
                    <div
                      key={post.id}
                      onClick={() => onSelectPost(post.id)}
                      className={cn(
                        "aspect-[4/5] relative cursor-pointer overflow-hidden bg-stone-900 group",
                        isFocused && "ring-2 ring-ag-accent ring-inset z-10"
                      )}
                    >
                      <img
                        src={post.image!}
                        alt=""
                        referrerPolicy="no-referrer"
                        className="absolute inset-0 w-full h-full object-cover"
                      />
                      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent pt-3 pb-0.5 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                        <span className="text-[8px] font-semibold text-white block text-center">
                          D{post.dayNumber}
                        </span>
                      </div>
                      {swapSourceId && swapSourceId !== post.id && (
                        <div
                          onClick={(e) => {
                            e.stopPropagation();
                            onSwapDays(swapSourceId, post.id);
                          }}
                          className="absolute inset-0 bg-ag-accent/90 flex flex-col items-center justify-center text-ag-accent-fg z-20"
                        >
                          <ArrowRight className="h-4 w-4 animate-bounce" />
                          <span className="text-[8px] font-bold mt-0.5">Inverter</span>
                        </div>
                      )}
                      {post.isConfirmed && !sched && (
                        <div className="absolute top-1 right-1 bg-ag-success text-ag-success-fg p-0.5 rounded-full z-10">
                          <Check className="h-2 w-2" strokeWidth={4} />
                        </div>
                      )}
                      {sched && schedTime && (
                        <div
                          className={cn(
                            "absolute top-1 left-1 right-1 z-10 rounded px-1 py-0.5 text-[7px] font-semibold text-center truncate",
                            sched.status === "published" && "bg-ag-success/90 text-ag-success-fg",
                            sched.status === "failed" && "bg-ag-danger/90 text-ag-danger-fg",
                            sched.status === "publishing" && "bg-ag-accent/90 text-ag-accent-fg",
                            sched.status === "queued" && "bg-ag-accent/90 text-ag-accent-fg",
                            sched.status === "eligible" && "bg-ag-warning/90 text-black"
                          )}
                        >
                          {sched.status === "published" ? "No ar" : schedTime}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Bottom nav */}
          <div className="flex items-center justify-around px-2 py-2.5 border-t border-white/10 shrink-0 bg-black">
            <Home className="h-[22px] w-[22px]" strokeWidth={1.75} />
            <Search className="h-[22px] w-[22px] text-stone-400" strokeWidth={1.75} />
            <Clapperboard className="h-[22px] w-[22px] text-stone-400" strokeWidth={1.75} />
            <Heart className="h-[22px] w-[22px] text-stone-400" strokeWidth={1.75} />
            <div className="h-[22px] w-[22px] rounded-full border border-white/30 p-[1px]">
              <div className="h-full w-full rounded-full bg-gradient-to-tr from-amber-400 via-pink-500 to-violet-600 p-[1px]">
                <div className="h-full w-full rounded-full bg-black flex items-center justify-center text-[7px] font-display italic text-ag-accent font-bold">
                  A
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <p className="text-[10px] text-ag-muted text-center mt-5 leading-relaxed max-w-sm mx-auto">
        Miniaturas em 4:5 (retrato). Topo = mais recente — clique numa foto para abrir o dia no
        estúdio.
      </p>
    </div>
  );
}
