import { useEffect, useRef, useState } from "react";

type UseUserPresenceOptions = {
  projectId: string;
  enabled?: boolean;
};

type UseUserPresenceReturn = {
  isActive: boolean;
  lastHeartbeat: number | null;
};

const HEARTBEAT_INTERVAL_MS = 30_000;

function createPresenceId() {
  return crypto.randomUUID();
}

export function useUserPresence({
  projectId,
  enabled = true,
}: UseUserPresenceOptions): UseUserPresenceReturn {
  const [isActive, setIsActive] = useState(true);
  const [lastHeartbeat, setLastHeartbeat] = useState<number | null>(null);
  const heartbeatTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const presenceIdRef = useRef<string>(createPresenceId());
  const isActiveRef = useRef(true);

  useEffect(() => {
    if (!enabled || !projectId) return;

    const presenceId = presenceIdRef.current;
    let cancelled = false;

    const postPresence = (path: "heartbeat" | "leave", reason?: string, keepalive = false) => {
      const body = JSON.stringify({ presenceId, reason });
      if (keepalive && navigator.sendBeacon) {
        const blob = new Blob([body], { type: "application/json" });
        navigator.sendBeacon(
          `/api/projects/${encodeURIComponent(projectId)}/presence/${path}`,
          blob,
        );
        return Promise.resolve(undefined);
      }
      return fetch(`/api/projects/${encodeURIComponent(projectId)}/presence/${path}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body,
        keepalive,
      });
    };

    const sendLeave = (reason: "leave" | "blur" | "hidden" | "unload") => {
      if (!isActiveRef.current && reason !== "unload" && reason !== "leave") return;
      isActiveRef.current = false;
      setIsActive(false);
      void postPresence("leave", reason, reason === "unload").catch((error) => {
        console.error("Presence leave failed:", error);
      });
    };

    const sendHeartbeat = async () => {
      if (cancelled || document.visibilityState !== "visible" || !document.hasFocus()) return;
      try {
        const response = await postPresence("heartbeat");
        if (response?.ok) {
          isActiveRef.current = true;
          setIsActive(true);
          setLastHeartbeat(Date.now());
        }
      } catch (error) {
        console.error("Heartbeat failed:", error);
      }
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        void sendHeartbeat();
      } else {
        sendLeave("hidden");
      }
    };

    const handleFocus = () => {
      void sendHeartbeat();
    };

    const handleBlur = () => {
      sendLeave("blur");
    };

    const handlePageHide = () => {
      sendLeave("unload");
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("focus", handleFocus);
    window.addEventListener("blur", handleBlur);
    window.addEventListener("pagehide", handlePageHide);

    void sendHeartbeat();
    heartbeatTimerRef.current = setInterval(sendHeartbeat, HEARTBEAT_INTERVAL_MS);

    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("focus", handleFocus);
      window.removeEventListener("blur", handleBlur);
      window.removeEventListener("pagehide", handlePageHide);
      if (heartbeatTimerRef.current) {
        clearInterval(heartbeatTimerRef.current);
        heartbeatTimerRef.current = null;
      }
      sendLeave("leave");
    };
  }, [projectId, enabled]);

  return { isActive, lastHeartbeat };
}
