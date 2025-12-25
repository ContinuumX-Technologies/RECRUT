import { useRef, useState } from "react";

type Props = {
  left: React.ReactNode;
  right: React.ReactNode;
  minLeftPx?: number;
  minRightPx?: number;
};

export default function ResizableSplit({
  left,
  right,
  minLeftPx = 320,
  minRightPx = 420
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [leftWidth, setLeftWidth] = useState(50); // %

  const onMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();

    const startX = e.clientX;
    const startWidth = leftWidth;

    const onMove = (ev: MouseEvent) => {
      if (!containerRef.current) return;

      const dx = ev.clientX - startX;
      const total = containerRef.current.offsetWidth;

      let next = startWidth + (dx / total) * 100;

      const minLeft = (minLeftPx / total) * 100;
      const minRight = (minRightPx / total) * 100;

      next = Math.max(minLeft, Math.min(100 - minRight, next));
      setLeftWidth(next);
    };

    const stop = () => {
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", stop);
    };

    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", stop);
  };

  return (
    <div ref={containerRef} className="resizable-split">
      <div className="resizable-left" style={{ width: `${leftWidth}%` }}>
        {left}
      </div>

      <div className="resizable-divider" onMouseDown={onMouseDown} />

      <div className="resizable-right">{right}</div>
    </div>
  );
}
