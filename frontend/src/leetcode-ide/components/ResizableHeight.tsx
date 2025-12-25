import { useState } from "react";

export default function ResizableHeight({
  children,
  minHeight = 240
}: {
  children: React.ReactNode;
  minHeight?: number;
}) {
  const [height, setHeight] = useState(420);

  const onMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    const startY = e.clientY;
    const startHeight = height;

    const onMove = (ev: MouseEvent) => {
      setHeight(Math.max(minHeight, startHeight + (ev.clientY - startY)));
    };

    const stop = () => {
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", stop);
    };

    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", stop);
  };

  return (
    <div style={{ height }}>
      {children}
      <div className="resize-handle-vertical" onMouseDown={onMouseDown} />
    </div>
  );
}
