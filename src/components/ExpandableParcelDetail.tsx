import {
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent,
  type ReactNode,
} from "react";
import { IconArrowsDiagonal } from "@tabler/icons-react";

interface Size {
  width: number;
  height: number;
}
interface Drag extends Size {
  id: number;
  x: number;
  y: number;
  mobile: boolean;
  maxWidth: number;
  maxHeight: number;
  moved: boolean;
  previous: Size | null;
}

/** Expansion is local to the open card. CSS keeps it inside the map on resize. */
export default function ExpandableParcelDetail({
  children,
}: {
  children: ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const drag = useRef<Drag | null>(null);
  const suppressClick = useRef(false);
  const [size, setSize] = useState<Size | null>(null);

  const bounds = () => {
    const panel = ref.current;
    const map = panel?.parentElement;
    if (!panel || !map) return null;
    const rect = panel.getBoundingClientRect();
    const parent = map.getBoundingClientRect();
    const mobile = window.matchMedia("(max-width: 900px)").matches;
    return {
      width: rect.width,
      height: rect.height,
      mobile,
      maxWidth: mobile
        ? rect.width
        : Math.max(rect.width, parent.right - rect.left - 18),
      maxHeight: mobile
        ? Math.max(rect.height, parent.height - 24)
        : Math.max(rect.height, parent.bottom - rect.top - 18),
    };
  };

  const expand = (width = 140, height = 120) => {
    const current = bounds();
    if (!current) return;
    setSize({
      width: Math.min(
        current.maxWidth,
        current.width + (current.mobile ? 0 : width),
      ),
      height: Math.min(current.maxHeight, current.height + height),
    });
  };
  const start = (event: PointerEvent<HTMLButtonElement>) => {
    if (!event.isPrimary || event.button !== 0) return;
    const current = bounds();
    if (!current) return;
    suppressClick.current = false;
    drag.current = {
      ...current,
      id: event.pointerId,
      x: event.clientX,
      y: event.clientY,
      moved: false,
      previous: size,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
    event.stopPropagation();
  };
  const move = (event: PointerEvent<HTMLButtonElement>) => {
    const current = drag.current;
    if (!current || current.id !== event.pointerId) return;
    const dx = event.clientX - current.x;
    const dy = (event.clientY - current.y) * (current.mobile ? -1 : 1);
    if (Math.abs(dx) + Math.abs(dy) < 4 && !current.moved) return;
    current.moved = true;
    suppressClick.current = true;
    // Each gesture can only grow the card from the size at its start.
    setSize({
      width: Math.min(
        current.maxWidth,
        current.width + (current.mobile ? 0 : Math.max(0, dx)),
      ),
      height: Math.min(current.maxHeight, current.height + Math.max(0, dy)),
    });
    event.stopPropagation();
  };
  const finish = (event: PointerEvent<HTMLButtonElement>, cancel = false) => {
    const current = drag.current;
    if (!current || current.id !== event.pointerId) return;
    if (cancel) {
      setSize(current.previous);
      suppressClick.current = false;
    }
    drag.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId))
      event.currentTarget.releasePointerCapture(event.pointerId);
  };

  return (
    <div
      ref={ref}
      className={`floating-detail expandable-parcel-detail${size ? " is-expanded" : ""}`}
      style={
        size
          ? ({
              "--parcel-detail-width": `${size.width}px`,
              "--parcel-detail-height": `${size.height}px`,
            } as CSSProperties)
          : undefined
      }
    >
      {children}
      <button
        type="button"
        className="icon-button parcel-expand"
        aria-label="Zvětšit detail pozemku"
        title="Kliknutím zvětšíte detail. Na počítači táhněte doprava či dolů, na mobilu nahoru."
        onClick={(event) => {
          if (suppressClick.current && event.detail > 0) {
            suppressClick.current = false;
            return;
          }
          expand();
        }}
        onKeyDown={(event) => {
          if (event.key === "ArrowRight") {
            event.preventDefault();
            expand(40, 0);
          }
          if (event.key === "ArrowDown" || event.key === "ArrowUp") {
            event.preventDefault();
            expand(0, 40);
          }
        }}
        onPointerDown={start}
        onPointerMove={move}
        onPointerUp={(event) => finish(event)}
        onPointerCancel={(event) => finish(event, true)}
        onLostPointerCapture={() => {
          drag.current = null;
        }}
      >
        <IconArrowsDiagonal size={18} aria-hidden="true" />
      </button>
    </div>
  );
}
