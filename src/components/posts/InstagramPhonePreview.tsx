import {
  Bookmark,
  Heart,
  Image as ImageIcon,
  MessageCircle,
  Send,
} from "lucide-react";
import type { PlannedPost } from "../../types";
import { cn } from "../../lib/cn";

export function InstagramPhonePreview({
  post,
  variant = "studio",
  username = "auragrid_style",
}: {
  post: PlannedPost;
  variant?: "studio" | "compact";
  username?: string;
}) {
  const isCompact = variant === "compact";
  const handle = username.replace(/^@/, "");

  return (
    <div className={cn("w-full", isCompact && "pt-3")}>
      {!isCompact && (
        <p className="text-[10px] font-mono uppercase tracking-[0.18em] text-ag-muted mb-4 text-center w-full">
          Prévia ao vivo
        </p>
      )}

      <div
        className={cn(
          "mx-auto relative",
          isCompact ? "max-w-[280px]" : "max-w-[300px] w-full"
        )}
      >
        <div
          className="absolute -inset-3 rounded-[2.5rem] opacity-40 blur-2xl pointer-events-none"
          style={{
            background:
              "radial-gradient(circle at 50% 30%, color-mix(in srgb, var(--ag-accent) 35%, transparent), transparent 70%)",
          }}
        />

        <div className="relative rounded-[2rem] border-[6px] border-ag-border/90 bg-black shadow-2xl overflow-hidden">
          <div className="absolute top-0 inset-x-0 z-10 h-5 flex justify-center items-end pb-0.5">
            <div className="h-1 w-14 rounded-full bg-stone-700" />
          </div>

          <div className="pt-4 bg-black text-white text-[10px] min-h-[420px] flex flex-col">
            <div className="flex justify-between items-center px-3 py-2 border-b border-white/10">
              <span className="font-display italic text-sm">Instagram</span>
              <div className="flex gap-2 opacity-80">
                <Heart className="h-3.5 w-3.5" />
                <MessageCircle className="h-3.5 w-3.5" />
                <Send className="h-3.5 w-3.5" />
              </div>
            </div>

            <div className="flex items-center gap-2 px-3 py-2">
              <div className="h-6 w-6 rounded-full bg-gradient-to-tr from-amber-400 via-pink-500 to-violet-600 p-[1.5px]">
                <div className="h-full w-full rounded-full bg-stone-950 flex items-center justify-center text-[8px] font-display italic text-ag-accent font-bold">
                  A
                </div>
              </div>
              <span className="font-semibold text-[10px]">{handle}</span>
            </div>

            <div className="aspect-[4/5] w-full bg-stone-900 flex items-center justify-center overflow-hidden shrink-0">
              {post.image ? (
                <img
                  src={post.image}
                  alt=""
                  referrerPolicy="no-referrer"
                  className="w-full h-full object-cover"
                />
              ) : (
                <ImageIcon className="h-8 w-8 text-stone-600" />
              )}
            </div>

            <div className="flex justify-between px-3 py-2">
              <div className="flex gap-2.5">
                <Heart className="h-4 w-4 text-red-500 fill-red-500" />
                <MessageCircle className="h-4 w-4" />
                <Send className="h-4 w-4" />
              </div>
              <Bookmark className="h-4 w-4" />
            </div>

            <div className="px-3 pb-4 flex-1 overflow-y-auto max-h-[140px] leading-relaxed text-[9px] text-stone-300 whitespace-pre-wrap break-words">
              {post.caption ? (
                <>
                  <span className="font-semibold text-white">{handle}</span>
                  {" "}
                  {post.caption}
                </>
              ) : (
                <>
                  <span className="font-semibold text-white">{handle}</span>
                  {" Legenda após gerar com IA."}
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
