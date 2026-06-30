import type { PublishPlatform } from "../../../src/lib/publish/platforms";
import type { PublishJobRow } from "../publishJobService";

export type PublishResult = {
  externalMediaId: string;
  permalink: string | null;
};

export type PublishProvider = {
  platform: PublishPlatform;
  execute(job: PublishJobRow): Promise<PublishResult>;
  countPublishedLast24h(clientId: string): Promise<number>;
  maxPublishPer24h: number;
};

export type PublishExecutionError = {
  message: string;
  reconnectRequired?: boolean;
};
