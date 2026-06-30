import type { PublishPlatform } from "../../../src/lib/publish/platforms";
import { metaFacebookPageProvider } from "./metaFacebookPageProvider";
import { metaInstagramProvider } from "./metaInstagramProvider";
import { linkedinProvider } from "./linkedinProvider";
import { pinterestProvider } from "./pinterestProvider";
import type { PublishProvider } from "./types";

const providers: PublishProvider[] = [
  metaInstagramProvider,
  metaFacebookPageProvider,
  linkedinProvider,
  pinterestProvider,
];

const byPlatform = new Map<PublishPlatform, PublishProvider>(
  providers.map((p) => [p.platform, p])
);

export function getPublishProvider(platform: string): PublishProvider | null {
  return byPlatform.get(platform as PublishPlatform) ?? null;
}

export function listPublishProviders(): PublishProvider[] {
  return [...providers];
}
