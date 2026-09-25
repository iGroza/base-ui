"use client";

import { useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";

export function HoverFab({
  label,
  icon,
  className,
  children,
}: {
  label: string;
  icon: ReactNode;
  className?: string;
  children: ReactNode;
}) {
  const [hover, setHover] = useState(false);
  const [stuck, setStuck] = useState(false);
  const open = hover || stuck;

  return (
    <div
      className={cn("fixed z-[320]", className)}
      onPointerEnter={(event) => {
        if (event.pointerType === "mouse") setHover(true);
      }}
      onPointerLeave={(event) => {
        if (event.pointerType !== "mouse") return;
        setHover(false);
        setStuck(false);
      }}
    >
      <div className="flex flex-col items-end gap-2">
        {open ? children : null}
        <button
          type="button"
          aria-label={label}
          aria-expanded={open}
          className="recent-fab grid size-12 place-items-center rounded-md"
          onClick={(event) => {
            if ((event.nativeEvent as PointerEvent).pointerType === "mouse") return;
            setStuck((value) => !value);
          }}
        >
          {icon}
        </button>
      </div>
    </div>
  );
}
