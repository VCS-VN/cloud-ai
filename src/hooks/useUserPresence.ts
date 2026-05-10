import { useEffect, useRef, useState } from "react";

type UseUserPresenceOptions = {
  projectId: string;
  userId: string;
  enabled?: boolean;
};

type UseUserPresenceReturn = {
  isActive: boolean;
  lastHeartbeat: number | null;
};

const HEARTBEAT_INTERVAL_MS = 30_000;

export function useUserPresence({
  projectId,
  userId,
  enabled = true,
}: UseUserPresenceOptions): UseUserPresenceReturn {
  const [isActive, setIsActive] = useState(true);
  const [lastHeartbeat, setLastHeartbeat] = useState<number | null>(null);
  const heartbeatTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const isVisibleRef = useRef(true);

  useEffect(() => {
    if (!enabled || !projectId || !userId) return;

    const handleVisibilityChange = () => {
      const visible = document.visibilityState === "visible";
      isVisibleRef.current = visible;
      setIsActive(visible);
    };

    const handleFocusChange = () => {
      const focused = document.hasFocus();
      if (focused) {
        isVisibleRef.current = true;
        setIsActive(true);
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("focus", handleFocusChange);
    window.addEventListener("blur", handleFocusChange);

    const sendHeartbeat = async () => {
      if (!isVisibleRef.current) return;
      try {
        const response = await fetch(
          `/api/projects/${encodeURIComponent(projectId)}/presence/heartbeat`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ userId }),
          },
        );
        if (response.ok) {
          setLastHeartbeat(Date.now());
        }
      } catch (error) {
        console.error("Heartbeat failed:", error);
      }
    };

    sendHeartbeat();

    heartbeatTimerRef.current = setInterval(sendHeartbeat, HEARTBEAT_INTERVAL_MS);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("focus", handleFocusChange);
      window.removeEventListener("blur", handleFocusChange);
      if (heartbeatTimerRef.current) {
        clearInterval(heartbeatTimerRef.current);
        heartbeatTimerRef.current = null;
      }
    };
  }, [projectId, userId, enabled]);

  return { isActive, lastHeartbeat };
}