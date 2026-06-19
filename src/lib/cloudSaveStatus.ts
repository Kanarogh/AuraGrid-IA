export type CloudSaveStatus = "idle" | "saving" | "saved" | "error";

export const CLOUD_SAVE_EVENT = "auragrid:cloud-save-status";

export function emitCloudSaveStatus(status: CloudSaveStatus) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(CLOUD_SAVE_EVENT, { detail: { status } }));
}
