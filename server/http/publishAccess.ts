import type { AssertClientAccessOptions } from "./auth";

export const PUBLISH_READ: AssertClientAccessOptions = {
  section: "post_scheduling",
  minLevel: "read",
};

export const PUBLISH_WRITE: AssertClientAccessOptions = {
  section: "post_scheduling",
  minLevel: "write",
  action: "managePublish",
};

export const META_CONNECT: AssertClientAccessOptions = {
  section: "post_scheduling",
  minLevel: "write",
  action: "connectMeta",
};
