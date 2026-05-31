import { useEffect, useRef } from "react";

type RevealOptions = {
  /** Fraction of the element visible before it reveals. */
  threshold?: number;
  /** Margin around the root viewport; negative bottom triggers earlier. */
  rootMargin?: string;
};

/**
 * Reveal-once on scroll. Attach the returned ref to an element carrying
 * `data-reveal`; the hook flips `data-reveal-ready="true"` the first time it
 * enters the viewport, then stops observing. CSS in globals.css handles the
 * rise+fade and respects prefers-reduced-motion.
 */
export function useReveal<T extends HTMLElement = HTMLDivElement>({
  threshold = 0.15,
  rootMargin = "0px 0px -10% 0px",
}: RevealOptions = {}) {
  const ref = useRef<T | null>(null);

  useEffect(() => {
    const element = ref.current;
    if (!element) return undefined;

    if (typeof IntersectionObserver === "undefined") {
      element.dataset.revealReady = "true";
      return undefined;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            element.dataset.revealReady = "true";
            observer.unobserve(element);
          }
        }
      },
      { threshold, rootMargin },
    );

    observer.observe(element);
    return () => observer.disconnect();
  }, [threshold, rootMargin]);

  return ref;
}
