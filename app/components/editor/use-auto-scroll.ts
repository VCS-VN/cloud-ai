import { useCallback, useEffect, useRef, useState } from "react";

interface UseAutoScrollProps {
  enabled?: boolean;
  threshold?: number;
}

export function useAutoScroll({
  enabled = true,
  threshold = 150,
}: UseAutoScrollProps = {}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isNearBottom, setIsNearBottom] = useState(true);
  const prevScrollHeightRef = useRef(0);
  const userScrolledUpRef = useRef(false);

  // Check if currently near bottom
  const checkNearBottom = useCallback(() => {
    const el = containerRef.current;
    if (!el) return false;
    const { scrollTop, scrollHeight, clientHeight } = el;
    const distanceFromBottom = scrollHeight - scrollTop - clientHeight;
    return distanceFromBottom <= threshold;
  }, [threshold]);

  // Listen for user scroll to detect if they scrolled up
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const onScroll = () => {
      const near = checkNearBottom();
      setIsNearBottom(near);
      if (!near) {
        userScrolledUpRef.current = true;
      } else {
        userScrolledUpRef.current = false;
      }
    };

    el.addEventListener("scroll", onScroll, { passive: true });
    return () => el.removeEventListener("scroll", onScroll);
  }, [checkNearBottom]);

  // Observe scrollHeight changes for auto-scroll during streaming
  useEffect(() => {
    if (!enabled) return;

    const el = containerRef.current;
    if (!el) return;

    const observer = new ResizeObserver(() => {
      if (!enabled || !containerRef.current) return;

      const currentScrollHeight = containerRef.current.scrollHeight;
      const prevScrollHeight = prevScrollHeightRef.current;

      // Only auto-scroll if:
      // 1. Content grew (streaming delta appended)
      // 2. User hasn't scrolled up to read old messages
      if (
        currentScrollHeight > prevScrollHeight &&
        !userScrolledUpRef.current
      ) {
        requestAnimationFrame(() => {
          if (containerRef.current) {
            containerRef.current.scrollTop = containerRef.current.scrollHeight;
          }
        });
      }

      prevScrollHeightRef.current = currentScrollHeight;
    });

    observer.observe(el);

    // Initialize scroll height
    prevScrollHeightRef.current = el.scrollHeight;

    return () => observer.disconnect();
  }, [enabled]);

  const scrollToBottom = useCallback(() => {
    if (containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
      userScrolledUpRef.current = false;
    }
  }, []);

  return { containerRef, isNearBottom, scrollToBottom };
}
