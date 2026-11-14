import { useEffect, useRef, type ReactNode } from "react";

/** Dismiss the analysis only when a deliberate click starts and ends outside. */
export default function AnalysisBackdrop({
  enabled,
  onClose,
  children,
}: {
  enabled: boolean;
  onClose: () => void;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const pointer = useRef<{ id: number; x: number; y: number } | null>(null);
  useEffect(() => {
    if (!enabled) return;
    const previous = document.activeElement as HTMLElement | null;
    ref.current?.querySelector<HTMLButtonElement>("button")?.focus();
    return () => {
      pointer.current = null;
      if (previous?.isConnected) previous.focus();
    };
  }, [enabled]);
  if (!enabled) return <>{children}</>;
  return (
    <div
      ref={ref}
      className="analysis-backdrop"
      onPointerDown={(event) => {
        pointer.current =
          event.target === event.currentTarget && event.button === 0
            ? { id: event.pointerId, x: event.clientX, y: event.clientY }
            : null;
      }}
      onPointerCancel={() => { pointer.current = null; }}
      onPointerUp={(event) => {
        const start = pointer.current;
        pointer.current = null;
        if (
          start &&
          start.id === event.pointerId &&
          event.target === event.currentTarget &&
          document.elementFromPoint(event.clientX, event.clientY) === event.currentTarget &&
          Math.hypot(event.clientX - start.x, event.clientY - start.y) <= 8
        ) onClose();
      }}
      onKeyDown={(event) => {
        if (
          event.key === "Escape" &&
          !event.defaultPrevented &&
          (event.target as HTMLElement).tagName !== "SELECT"
        ) {
          event.stopPropagation();
          onClose();
        }
      }}
    >
      {children}
    </div>
  );
}
