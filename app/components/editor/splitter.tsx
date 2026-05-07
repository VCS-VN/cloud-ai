import { useCallback, useEffect, useRef, useState } from "react"

interface SplitterProps {
  children: [React.ReactNode, React.ReactNode]
  initialLeftWidth?: number
  minLeftWidth?: number
  collapsedLeftWidth?: number
}

export function Splitter({
  children,
  initialLeftWidth = 30,
  minLeftWidth = 280,
  collapsedLeftWidth = 0,
}: SplitterProps) {
  const [leftWidth, setLeftWidth] = useState(initialLeftWidth)
  const [collapsed, setCollapsed] = useState(false)
  const [isDragging, setIsDragging] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const startXRef = useRef(0)
  const startWidthRef = useRef(0)

  const handlePointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (collapsed) return
      e.preventDefault()
      startXRef.current = e.clientX
      startWidthRef.current = leftWidth
      setIsDragging(true)
      ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
    },
    [collapsed, leftWidth]
  )

  const handlePointerMove = useCallback(
    (e: PointerEvent) => {
      if (!isDragging || !containerRef.current) return
      const delta = e.clientX - startXRef.current
      const containerWidth = containerRef.current.offsetWidth
      const newWidthPx = startWidthRef.current + delta
      const newWidthPercent = (newWidthPx / containerWidth) * 100
      const minPercent = (minLeftWidth / containerWidth) * 100
      const clamped = Math.max(minPercent, Math.min(newWidthPercent, 70))
      setLeftWidth(clamped)
    },
    [isDragging, minLeftWidth]
  )

  const handlePointerUp = useCallback(() => {
    setIsDragging(false)
  }, [])

  useEffect(() => {
    if (isDragging) {
      window.addEventListener("pointermove", handlePointerMove)
      window.addEventListener("pointerup", handlePointerUp)
      return () => {
        window.removeEventListener("pointermove", handlePointerMove)
        window.removeEventListener("pointerup", handlePointerUp)
      }
    }
  }, [isDragging, handlePointerMove, handlePointerUp])

  const toggleCollapse = useCallback(() => {
    setCollapsed((prev) => !prev)
  }, [])

  const leftStyle: React.CSSProperties = collapsed
    ? { width: collapsedLeftWidth, minWidth: 0, overflow: "hidden" }
    : { width: `${leftWidth}%`, minWidth: `${minLeftWidth}px` }

  return (
    <div
      ref={containerRef}
      className="flex h-full w-full overflow-hidden"
      style={{ "--splitter-left": `${leftWidth}%` } as React.CSSProperties}
    >
      {/* Left panel */}
      <div
        className="flex flex-col h-full transition-all duration-200 ease-out"
        style={leftStyle}
      >
        {children[0]}
      </div>

      {/* Splitter bar */}
      <div
        role="separator"
        aria-orientation="vertical"
        className={`relative z-10 flex w-[5px] cursor-col-resize select-none items-center justify-center transition-colors duration-150
          ${isDragging ? "bg-[var(--app-border-strong)]" : "bg-transparent hover:bg-[var(--app-border)]"}
          ${collapsed ? "pointer-events-none opacity-0" : ""}`}
        onPointerDown={handlePointerDown}
      >
        <div className="h-8 w-[1px] bg-[var(--app-border-strong)] transition-all duration-150" />
      </div>

      {/* Collapse/expand toggle */}
      <button
        type="button"
        aria-label={collapsed ? "Expand chat panel" : "Collapse chat panel"}
        onClick={toggleCollapse}
        className="absolute top-1/2 z-20 flex h-8 w-5 -translate-y-1/2 cursor-pointer items-center justify-center rounded-r-sm bg-[var(--app-surface)] border border-[var(--app-border)] border-l-0 text-[var(--app-muted)] hover:bg-[var(--app-panel-strong)] hover:text-[var(--app-text)] transition-colors duration-150"
        style={{ left: collapsed ? "0" : `${leftWidth}%`, transform: "translateY(-50%)" }}
      >
        {collapsed ? (
          <svg width="10" height="12" viewBox="0 0 10 12" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M1.5 1L6.5 6L1.5 11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        ) : (
          <svg width="10" height="12" viewBox="0 0 10 12" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M8.5 1L3.5 6L8.5 11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        )}
      </button>

      {/* Right panel */}
      <div className="flex flex-col flex-1 h-full min-w-0">
        {children[1]}
      </div>
    </div>
  )
}
