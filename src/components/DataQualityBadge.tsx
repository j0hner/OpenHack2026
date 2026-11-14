import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { IconInfoCircle, IconX } from "@tabler/icons-react";
import { QUALITY_LABELS } from "../data/provenance";
import type { DataQuality } from "../lib/types";

type Position = { left: number; top: number; width: number; maxHeight: number };

/** The explanation lives above the page, so expanding it never changes a row. */
export default function DataQualityBadge({
  quality,
}: {
  quality: DataQuality;
}) {
  const meta = QUALITY_LABELS[quality];
  const id = useId();
  const anchor = useRef<HTMLButtonElement>(null);
  const popup = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState<Position | null>(null);
  const close = (restoreFocus: boolean) => {
    setOpen(false);
    if (restoreFocus) anchor.current?.focus({ preventScroll: true });
  };

  useEffect(() => {
    if (!open) {
      setPosition(null);
      return;
    }
    const reposition = () => {
      if (!anchor.current || !popup.current) return;
      const rect = anchor.current.getBoundingClientRect();
      const width = Math.min(290, window.innerWidth - 24);
      const contentHeight = popup.current.getBoundingClientRect().height;
      const below = window.innerHeight - rect.bottom - 20;
      const above = rect.top - 20;
      const down = below >= Math.min(contentHeight, 220) || below >= above;
      const maxHeight = Math.max(
        40,
        Math.min(300, down ? below : above, window.innerHeight - 24),
      );
      const height = Math.min(contentHeight, maxHeight);
      const next = {
        left: Math.max(
          12,
          Math.min(rect.right - width, window.innerWidth - width - 12),
        ),
        top: Math.max(
          12,
          Math.min(
            down ? rect.bottom + 8 : rect.top - height - 8,
            window.innerHeight - height - 12,
          ),
        ),
        width,
        maxHeight,
      };
      setPosition((previous) =>
        previous &&
        Object.keys(next).every(
          (key) =>
            previous[key as keyof Position] === next[key as keyof Position],
        )
          ? previous
          : next,
      );
    };
    const outside = (event: PointerEvent) => {
      const target = event.target as Node;
      if (!anchor.current?.contains(target) && !popup.current?.contains(target))
        setOpen(false);
    };
    const key = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      event.stopPropagation();
      setOpen(false);
      anchor.current?.focus({ preventScroll: true });
    };
    reposition();
    const focusFrame = requestAnimationFrame(() =>
      popup.current?.focus({ preventScroll: true }),
    );
    const observer = new ResizeObserver(reposition);
    if (popup.current) observer.observe(popup.current);
    window.addEventListener("resize", reposition);
    window.addEventListener("scroll", reposition, true);
    document.addEventListener("pointerdown", outside);
    document.addEventListener("keydown", key);
    return () => {
      cancelAnimationFrame(focusFrame);
      observer.disconnect();
      window.removeEventListener("resize", reposition);
      window.removeEventListener("scroll", reposition, true);
      document.removeEventListener("pointerdown", outside);
      document.removeEventListener("keydown", key);
    };
  }, [open]);

  return (
    <span className="quality-disclosure">
      <button
        ref={anchor}
        type="button"
        className={`badge ${meta.className} quality-disclosure-trigger`}
        aria-label={`${meta.label} – vysvětlení zdroje`}
        aria-expanded={open}
        aria-controls={open ? id : undefined}
        onClick={() => setOpen((value) => !value)}
      >
        {meta.label}
        <IconInfoCircle size={14} aria-hidden="true" />
      </button>
      {open &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            id={id}
            ref={popup}
            className="quality-disclosure-content quality-popover"
            role="dialog"
            aria-labelledby={`${id}-title`}
            tabIndex={-1}
            style={
              position
                ? { ...position, visibility: "visible" }
                : { left: 12, top: 12, width: 290, visibility: "hidden" }
            }
          >
            <div className="quality-popover-heading">
              <strong id={`${id}-title`}>{meta.label}</strong>
              <button
                type="button"
                className="icon-button"
                aria-label="Zavřít vysvětlení zdroje"
                onClick={() => close(true)}
              >
                <IconX size={17} aria-hidden="true" />
              </button>
            </div>
            <p>{meta.hint}</p>
          </div>,
          document.body,
        )}
    </span>
  );
}
