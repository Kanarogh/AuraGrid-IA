"use client";

import { CatalogThumbnail } from "../ui/CatalogThumbnail";
import { cn } from "../../lib/cn";

/** Imagem de post do feed — skeleton + fetch autenticado para `/api/v1/media/`. */
export function PostFeedImage({
  src,
  alt = "",
  className,
  imgClassName,
  priority = false,
}: {
  src: string;
  alt?: string;
  className?: string;
  imgClassName?: string;
  priority?: boolean;
}) {
  return (
    <CatalogThumbnail
      src={src}
      alt={alt}
      variant="full"
      priority={priority}
      lazy={!priority}
      className={cn("h-full w-full", className)}
      imgClassName={cn("transition-opacity duration-300", imgClassName)}
    />
  );
}
