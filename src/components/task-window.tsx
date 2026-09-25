"use client";

import { useEffect, useLayoutEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { createPortal } from "react-dom";
import { LayoutGrid, Minus, Pin, PinOff, X } from "lucide-react";
import { HoverFab } from "@/components/hover-fab";
import { TaskLinkButtons } from "@/components/task-links";
import { playGenie, prefersReducedMotion, toRect, type Rect } from "@/lib/genie";
import { taskRef } from "@/lib/utils";
import { minimizedAfterFocus } from "@/lib/window-focus";
import { arrangeWindows, windowLayer, type WindowLayout } from "@/lib/window-layout";

type Box = { x: number; y: number; w: number; h: number };

const MIN_W = 420;
const MIN_H = 320;

export function TaskWindows({
  items,
  focusRequest,
  render,
  onClose,
  onCloseAll,
}: {
  items: { key: string; title: string; sharedNumber?: boolean; task: { id: number; incrId: number | null } }[];
  focusRequest: { key: string; tick: number } | null;
  render: (key: string) => React.ReactNode;
  onClose: (key: string) => void;
  onCloseAll: () => void;
}) {
  const [boxes, setBoxes] = useState<Record<string, Box>>({});
  const [order, setOrder] = useState<string[]>([]);
  const [minimized, setMinimized] = useState<Record<string, boolean>>({});
  const [leaving, setLeaving] = useState<Record<string, boolean>>({});
  const [restoring, setRestoring] = useState<Record<string, boolean>>({});
  const [popping, setPopping] = useState<Record<string, boolean>>({});
  const [concealed, setConcealed] = useState<Record<string, boolean>>({});
  const [closing, setClosing] = useState<Record<string, boolean>>({});
  const closingRef = useRef<Record<string, boolean>>({});
  const closeTimers = useRef<Record<string, number>>({});
  const openedAt = useRef<Record<string, number>>({});
  const seenKeys = useRef(new Set<string>());
  const [pinned, setPinned] = useState<Record<string, boolean>>({});
  const itemsRef = useRef(items);
  itemsRef.current = items;
  const orderRef = useRef(order);
  orderRef.current = order;
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  const windowRefs = useRef<Record<string, HTMLElement | null>>({});
  const plaqueRefs = useRef<Record<string, HTMLElement | null>>({});
  const minimizedRef = useRef(minimized);
  minimizedRef.current = minimized;
  const leavingRef = useRef(leaving);
  leavingRef.current = leaving;
  const restoringRef = useRef(restoring);
  restoringRef.current = restoring;
  const bornQuiet = useRef<Record<string, boolean>>({});
  const pendingMinimize = useRef<string | null>(null);
  const pendingRestore = useRef<{ key: string; plaque: Rect } | null>(null);
  const genieCancel = useRef<(() => void) | null>(null);
  const mounted = useRef(true);
  const signature = items.map((item) => item.key).join("\n");

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const front = orderRef.current.at(-1) ?? itemsRef.current.at(-1)?.key;
      if (!front || !itemsRef.current.some((item) => item.key === front)) return;
      const closeWithCtrl =
        event.code === "KeyW" && (event.ctrlKey || event.metaKey) && !event.altKey && !event.shiftKey;
      const closeWithEsc = event.key === "Escape";
      if (!closeWithCtrl && !closeWithEsc) return;
      if (closeWithEsc && document.querySelector(".task-window-active [aria-expanded='true']")) return;
      if (closeWithEsc && document.querySelector("[data-image-viewer]")) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      beginCloseRef.current(front);
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, []);

  useEffect(() => {
    const current = itemsRef.current;
    setBoxes((prev) => {
      const next = { ...prev };
      let fresh = 0;
      for (const item of current) {
        if (next[item.key]) continue;
        const offset = (Object.keys(prev).length + fresh) * 32;
        fresh += 1;
        const w = Math.min(860, Math.max(MIN_W, window.innerWidth - 80));
        const h = Math.min(720, Math.max(MIN_H, window.innerHeight - 96));
        next[item.key] = {
          x: clamp(Math.round((window.innerWidth - w) / 2) + offset, 8, window.innerWidth - 160),
          y: clamp(56 + offset, 8, Math.max(8, window.innerHeight - 120)),
          w,
          h,
        };
      }
      return next;
    });
    setOrder((prev) => {
      const keys = current.map((item) => item.key);
      const known = prev.filter((key) => keys.includes(key));
      const added = keys.filter((key) => !known.includes(key));
      const front = keys.at(-1);
      const rest = [...known, ...added].filter((key) => key !== front);
      return front ? [...rest, front] : rest;
    });
  }, [signature]);

  useLayoutEffect(() => {
    const keys = itemsRef.current.map((item) => item.key);
    const fresh = keys.filter((key) => !seenKeys.current.has(key));
    for (const key of fresh) {
      openedAt.current[key] = performance.now();
      const timer = closeTimers.current[key];
      if (!timer) continue;
      window.clearTimeout(timer);
      delete closeTimers.current[key];
    }
    for (const key of Object.keys(openedAt.current)) {
      if (!keys.includes(key)) delete openedAt.current[key];
    }
    seenKeys.current = new Set(keys);
    if (!fresh.length) return;
    setClosing((prev) => {
      let changed = false;
      const next = { ...prev };
      for (const key of fresh) {
        if (!next[key]) continue;
        delete next[key];
        changed = true;
      }
      if (!changed) return prev;
      closingRef.current = next;
      return next;
    });
  }, [signature]);

  useEffect(() => {
    const key = focusRequest?.key;
    if (!key) return;
    if (minimizedRef.current[key]) {
      beginRestoreRef.current(key);
      return;
    }
    setOrder((prev) => (prev.at(-1) === key ? prev : [...prev.filter((item) => item !== key), key]));
  }, [focusRequest]);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      genieCancel.current?.();
    };
  }, []);

  useLayoutEffect(() => {
    const key = pendingMinimize.current;
    if (!key || !leaving[key]) return;
    const source = windowRefs.current[key];
    const plaque = plaqueRefs.current[key];
    if (!source || !plaque) return;
    const genie = playGenie(source, toRect(source.getBoundingClientRect()), toRect(plaque.getBoundingClientRect()), "in", () => {
      source.style.visibility = "hidden";
      if (mounted.current) setConcealed((prev) => ({ ...prev, [key]: true }));
    });
    genieCancel.current = genie.cancel;
    let cancelled = false;
    void genie.done.then((finished) => {
      if (genieCancel.current === genie.cancel) genieCancel.current = null;
      if (!finished || cancelled || !mounted.current) return;
      pendingMinimize.current = null;
      source.style.visibility = "";
      setConcealed((prev) => ({ ...prev, [key]: false }));
      setMinimized((prev) => ({ ...prev, [key]: true }));
      setLeaving((prev) => ({ ...prev, [key]: false }));
      setPopping((prev) => ({ ...prev, [key]: true }));
      window.setTimeout(() => {
        if (!mounted.current) return;
        setPopping((prev) => ({ ...prev, [key]: false }));
      }, 460);
    });
    return () => {
      cancelled = true;
      genie.cancel();
    };
  }, [leaving]);

  useLayoutEffect(() => {
    const job = pendingRestore.current;
    if (!job || !restoring[job.key]) return;
    const source = windowRefs.current[job.key];
    if (!source) return;
    const genie = playGenie(
      source,
      toRect(source.getBoundingClientRect()),
      job.plaque,
      "out",
      () => {
        if (mounted.current) setConcealed((prev) => ({ ...prev, [job.key]: true }));
      },
      () => {
        source.classList.remove("task-window-hold");
        source.style.visibility = "visible";
      },
    );
    genieCancel.current = genie.cancel;
    let cancelled = false;
    void genie.done.then((finished) => {
      if (genieCancel.current === genie.cancel) genieCancel.current = null;
      if (!finished || cancelled || !mounted.current) return;
      pendingRestore.current = null;
      source.style.visibility = "";
      setConcealed((prev) => ({ ...prev, [job.key]: false }));
      setRestoring((prev) => ({ ...prev, [job.key]: false }));
    });
    return () => {
      cancelled = true;
      genie.cancel();
    };
  }, [restoring]);

  const beginCloseRef = useRef<(key: string) => void>(() => {});
  beginCloseRef.current = (key: string) => {
    if (closingRef.current[key]) return;
    closingRef.current = { ...closingRef.current, [key]: true };
    setClosing(closingRef.current);
    closeTimers.current[key] = window.setTimeout(() => {
      delete closeTimers.current[key];
      onCloseRef.current(key);
    }, 140);
  };

  function focus(key: string) {
    setOrder((prev) => [...prev.filter((item) => item !== key), key]);
  }

  const beginRestoreRef = useRef<(key: string) => void>(() => {});
  beginRestoreRef.current = (key: string) => {
    if (!minimizedRef.current[key] || restoringRef.current[key] || leavingRef.current[key]) {
      focus(key);
      return;
    }
    const plaque = plaqueRefs.current[key]?.getBoundingClientRect();
    if (!plaque || prefersReducedMotion()) {
      setMinimized((prev) => minimizedAfterFocus(prev, key));
      focus(key);
      return;
    }
    bornQuiet.current[key] = true;
    pendingRestore.current = { key, plaque: toRect(plaque) };
    setRestoring((prev) => ({ ...prev, [key]: true }));
    setMinimized((prev) => minimizedAfterFocus(prev, key));
    focus(key);
  };

  const minimizeRef = useRef<(key: string) => void>(() => {});
  minimizeRef.current = (key: string) => {
    if (minimizedRef.current[key] || leavingRef.current[key] || restoringRef.current[key]) return;
    if (performance.now() - (openedAt.current[key] ?? 0) < 350) return;
    if (prefersReducedMotion() || !windowRefs.current[key]) {
      setMinimized((prev) => ({ ...prev, [key]: true }));
      return;
    }
    pendingMinimize.current = key;
    setLeaving((prev) => ({ ...prev, [key]: true }));
  };

  function move(key: string, box: Box) {
    setBoxes((prev) => ({ ...prev, [key]: box }));
  }

  if (typeof document === "undefined") return null;

  return createPortal(
    <>
      {items.map((item) => {
        const box = boxes[item.key];
        if (!box || (minimized[item.key] && !restoring[item.key])) return null;
        const hiding = Boolean(concealed[item.key] || restoring[item.key]);
        const skipEnter = Boolean(bornQuiet.current[item.key]);
        const isPinned = Boolean(pinned[item.key]);
        const focused = order.at(-1) === item.key;
        return (
          <section
            key={item.key}
            ref={(node) => {
              windowRefs.current[item.key] = node;
            }}
            role="dialog"
            aria-label={item.title}
            className={`task-window fixed flex flex-col overflow-hidden rounded-[8px] ${
              hiding ? "task-window-hold" : skipEnter ? "" : "task-window-in"
            } ${focused ? "task-window-active" : "task-window-idle"} ${
              isPinned ? "task-window-pinned" : ""
            } ${closing[item.key] ? "task-window-out" : ""}`}
            style={{
              left: box.x,
              top: box.y,
              width: box.w,
              height: box.h,
              zIndex: windowLayer(item.key, order, pinned),
            }}
            onPointerDown={() => focus(item.key)}
          >
            <header
              className="relative z-50 flex h-10 shrink-0 cursor-grab items-center gap-1.5 border-b border-white/15 pr-11 pl-11 active:cursor-grabbing"
              onPointerDown={(event) => {
                if ((event.target as HTMLElement).closest("button, a")) return;
                focus(item.key);
                const startX = event.clientX;
                const startY = event.clientY;
                const origin = box;
                const onMove = (ev: PointerEvent) => {
                  move(item.key, {
                    ...origin,
                    x: clamp(origin.x + ev.clientX - startX, -origin.w + 140, window.innerWidth - 80),
                    y: clamp(origin.y + ev.clientY - startY, 0, window.innerHeight - 40),
                  });
                };
                const onUp = () => {
                  window.removeEventListener("pointermove", onMove);
                  window.removeEventListener("pointerup", onUp);
                };
                window.addEventListener("pointermove", onMove);
                window.addEventListener("pointerup", onUp);
              }}
            >
              <button
                type="button"
                onClick={() => {
                  if (performance.now() - (openedAt.current[item.key] ?? 0) < 350) return;
                  beginCloseRef.current(item.key);
                }}
                className="grid size-6 place-items-center rounded-md text-fg-muted hover:bg-white/15 hover:text-fg"
                aria-label="Закрыть окно"
              >
                <X className="size-3.5" />
              </button>
              <button
                type="button"
                onClick={() => minimizeRef.current(item.key)}
                className="grid size-6 place-items-center rounded-md text-fg-muted hover:bg-white/15 hover:text-fg"
                aria-label="Свернуть окно"
              >
                <Minus className="size-3.5" />
              </button>
              <button
                type="button"
                aria-pressed={isPinned}
                aria-label={isPinned ? "Открепить окно" : "Закрепить окно"}
                title={isPinned ? "Открепить" : "Закрепить"}
                onClick={() => setPinned((prev) => ({ ...prev, [item.key]: !prev[item.key] }))}
                className={`grid size-6 place-items-center rounded-md hover:bg-white/15 ${
                  isPinned ? "text-accent" : "text-fg-muted hover:text-fg"
                }`}
              >
                <Pin className={`size-3.5 ${isPinned ? "fill-current" : ""}`} />
              </button>
              <p className="min-w-0 flex-1 truncate text-xs">
                <span className="font-mono text-fg-subtle">{taskRefSafe(item.task, item.sharedNumber)}</span>
                <span className="ml-2 text-fg">{item.title}</span>
              </p>
              <TaskLinkButtons task={item.task} labeled />
            </header>
            <div className="min-h-0 flex-1 overflow-hidden">{render(item.key)}</div>
            <ResizeEdges box={box} onResize={(next) => move(item.key, next)} />
          </section>
        );
      })}
      {items.some((item) => minimized[item.key] || leaving[item.key] || restoring[item.key]) ? (
        <div className="fixed bottom-4 left-1/2 z-[35] flex max-w-[calc(100vw-2rem)] -translate-x-1/2 flex-wrap justify-center gap-1.5">
          {items
            .filter((item) => minimized[item.key] || leaving[item.key] || restoring[item.key])
            .map((item) => (
              <button
                key={item.key}
                ref={(node) => {
                  plaqueRefs.current[item.key] = node;
                }}
                type="button"
                onClick={() => beginRestoreRef.current(item.key)}
                className={`task-plaque flex h-9 max-w-64 items-center gap-2 rounded-[10px] px-2.5 text-left text-xs ${
                  leaving[item.key] && !minimized[item.key] ? "task-plaque-enter" : ""
                } ${popping[item.key] ? "task-plaque-pop" : ""}`}
                style={restoring[item.key] && concealed[item.key] ? { opacity: 0 } : undefined}
              >
                <span className="min-w-0 flex-1 truncate">
                  <span className="font-mono text-fg-subtle">{taskRef(item.task)}</span> {item.title}
                </span>
                <span
                  role="button"
                  aria-label="Закрыть"
                  className="grid size-5 place-items-center rounded-md text-fg-subtle hover:text-fg"
                  onClick={(event) => {
                    event.stopPropagation();
                    onClose(item.key);
                  }}
                >
                  <X className="size-3" />
                </span>
              </button>
            ))}
        </div>
      ) : null}
      <LayoutFab
        allPinned={items.length > 0 && items.every((item) => pinned[item.key])}
        onCloseAll={onCloseAll}
        onTogglePinAll={() => {
          setPinned((previous) => {
            const shouldPin = items.some((item) => !previous[item.key]);
            return {
              ...previous,
              ...Object.fromEntries(items.map((item) => [item.key, shouldPin])),
            };
          });
        }}
        onArrange={(layout) => {
          const visible = order.filter((key) => boxes[key] && !minimized[key]);
          const next = arrangeWindows(
            visible,
            layout,
            { width: window.innerWidth, height: window.innerHeight },
            visible.at(-1),
          );
          setBoxes((prev) => ({ ...prev, ...next }));
        }}
      />
    </>,
    document.body,
  );
}

const LAYOUTS: { id: WindowLayout; label: string; rects: [number, number, number, number][] }[] = [
  {
    id: "cascade",
    label: "Каскад",
    rects: [
      [8, 28, 62, 62],
      [22, 16, 62, 62],
      [36, 4, 62, 62],
    ],
  },
  {
    id: "grid",
    label: "Сетка",
    rects: [
      [4, 4, 44, 44],
      [52, 4, 44, 44],
      [4, 52, 44, 44],
      [52, 52, 44, 44],
    ],
  },
  {
    id: "split",
    label: "Две колонки",
    rects: [
      [4, 4, 44, 92],
      [52, 4, 44, 92],
    ],
  },
  {
    id: "trio",
    label: "Три колонки",
    rects: [
      [2, 4, 30, 92],
      [35, 4, 30, 92],
      [68, 4, 30, 92],
    ],
  },
  {
    id: "row",
    label: "Ряд",
    rects: [
      [2, 28, 30, 44],
      [35, 28, 30, 44],
      [68, 28, 30, 44],
    ],
  },
  {
    id: "column",
    label: "Колонка",
    rects: [
      [18, 2, 64, 30],
      [18, 35, 64, 30],
      [18, 68, 64, 30],
    ],
  },
  {
    id: "focus",
    label: "Главное сбоку",
    rects: [
      [2, 4, 62, 92],
      [68, 4, 30, 44],
      [68, 52, 30, 44],
    ],
  },
];

function LayoutFab({
  allPinned,
  onArrange,
  onCloseAll,
  onTogglePinAll,
}: {
  allPinned: boolean;
  onArrange: (layout: WindowLayout) => void;
  onCloseAll: () => void;
  onTogglePinAll: () => void;
}) {
  return (
    <HoverFab
      label="Раскладка окон"
      icon={<LayoutGrid className="size-5" />}
      className="right-[4.75rem] bottom-[calc(5.5rem+env(safe-area-inset-bottom))] lg:bottom-5"
    >
      <div className="task-plaque w-64 rounded-[10px] p-2">
        <div className="flex items-center justify-between gap-1 px-1.5 pt-1 pb-2">
          <p className="text-[11px] font-medium tracking-wide text-white/55">Раскладка</p>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={onTogglePinAll}
              className="grid size-7 place-items-center rounded-md text-white/65 hover:bg-white/10 hover:text-white"
              aria-label={allPinned ? "Открепить все окна" : "Закрепить все окна"}
              title={allPinned ? "Открепить все" : "Закрепить все"}
            >
              {allPinned ? <PinOff className="size-3.5" /> : <Pin className="size-3.5" />}
            </button>
            <button
              type="button"
              onClick={onCloseAll}
              className="grid size-7 place-items-center rounded-md text-white/65 hover:bg-white/10 hover:text-white"
              aria-label="Закрыть все окна"
              title="Закрыть все"
            >
              <X className="size-3.5" />
            </button>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-1">
          {LAYOUTS.map((layout) => (
            <button
              key={layout.id}
              type="button"
              onClick={() => onArrange(layout.id)}
              className="flex items-center gap-2 rounded-md px-1.5 py-1.5 text-left text-xs leading-tight hover:bg-white/10"
            >
              <span className="relative h-7 w-10 shrink-0">
                {layout.rects.map((rect, index) => (
                  <span
                    key={index}
                    className="absolute rounded-[2px] bg-white/75"
                    style={{ left: `${rect[0]}%`, top: `${rect[1]}%`, width: `${rect[2]}%`, height: `${rect[3]}%` }}
                  />
                ))}
              </span>
              {layout.label}
            </button>
          ))}
        </div>
      </div>
    </HoverFab>
  );
}

function ResizeEdges({ box, onResize }: { box: Box; onResize: (box: Box) => void }) {
  function start(event: ReactPointerEvent, edges: { n?: boolean; s?: boolean; e?: boolean; w?: boolean }) {
    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    const startX = event.clientX;
    const startY = event.clientY;
    const origin = box;
    const onMove = (ev: PointerEvent) => {
      let { x, y, w, h } = origin;
      const dx = ev.clientX - startX;
      const dy = ev.clientY - startY;
      if (edges.e) w = Math.max(MIN_W, origin.w + dx);
      if (edges.s) h = Math.max(MIN_H, origin.h + dy);
      if (edges.w) {
        w = Math.max(MIN_W, origin.w - dx);
        x = origin.x + origin.w - w;
      }
      if (edges.n) {
        h = Math.max(MIN_H, origin.h - dy);
        y = origin.y + origin.h - h;
      }
      onResize({
        x: clamp(x, -w + 140, window.innerWidth - 80),
        y: clamp(y, 0, window.innerHeight - 40),
        w: Math.min(w, window.innerWidth - 16),
        h: Math.min(h, window.innerHeight - 16),
      });
    };
    const onUp = () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  }

  return (
    <>
      <div className="window-edge window-edge-n" onPointerDown={(e) => start(e, { n: true })} />
      <div className="window-edge window-edge-s" onPointerDown={(e) => start(e, { s: true })} />
      <div className="window-edge window-edge-w" onPointerDown={(e) => start(e, { w: true })} />
      <div className="window-edge window-edge-e" onPointerDown={(e) => start(e, { e: true })} />
      <div className="window-corner window-corner-nw" onPointerDown={(e) => start(e, { n: true, w: true })} />
      <div className="window-corner window-corner-ne" onPointerDown={(e) => start(e, { n: true, e: true })} />
      <div className="window-corner window-corner-sw" onPointerDown={(e) => start(e, { s: true, w: true })} />
      <div className="window-corner window-corner-se" onPointerDown={(e) => start(e, { s: true, e: true })} />
    </>
  );
}

function taskRefSafe(task: { id: number; incrId: number | null }, shared = false) {
  if (task.id < 0) return "new";
  const number = task.incrId ?? task.id;
  return shared && task.id !== number ? `#${number} · ${task.id}` : `#${number}`;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), Math.max(min, max));
}
