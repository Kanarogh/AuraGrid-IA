import { useEffect, useRef } from "react";

export function usePublishQueuePoll(
  refresh: () => void | Promise<void>,
  enabled: boolean,
  intervalMs = 30000
) {
  const refreshRef = useRef(refresh);
  refreshRef.current = refresh;

  useEffect(() => {
    if (!enabled) return;
    const id = window.setInterval(() => {
      void refreshRef.current();
    }, intervalMs);
    return () => window.clearInterval(id);
  }, [enabled, intervalMs]);
}
