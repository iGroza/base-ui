"use client";

import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { createPortal } from "react-dom";
import { Check, ChevronDown, Search } from "lucide-react";
import { cn } from "@/lib/utils";

type Option = { value: string; label: string };

export function MenuSelect({
  value,
  onChange,
  options,
  placeholder,
  emptyLabel = "Все",
  emptyValue = "all",
  hideEmpty = false,
  className,
}: {
  value: string;
  onChange: (value: string) => void;
  options: Option[];
  placeholder: string;
  emptyLabel?: string;
  emptyValue?: string;
  hideEmpty?: boolean;
  className?: string;
}) {
  const listId = useId();
  const buttonRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const [box, setBox] = useState({ top: 0, left: 0, width: 220, maxHeight: 280, up: false });

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter((option) => option.label.toLowerCase().includes(q));
  }, [options, query]);

  const current = options.find((option) => option.value === value);

  function place() {
    const rect = buttonRef.current?.getBoundingClientRect();
    if (!rect) return;
    const width = Math.max(rect.width, 240);
    const below = window.innerHeight - rect.bottom - 16;
    const above = rect.top - 16;
    const up = below < 220 && above > below;
    const maxHeight = Math.max(180, Math.min(340, up ? above : below));
    const left = Math.min(Math.max(8, rect.left), window.innerWidth - width - 8);
    setBox({
      top: up ? rect.top - 8 : rect.bottom + 8,
      left,
      width,
      maxHeight,
      up,
    });
  }

  useEffect(() => {
    if (!open) return;
    place();
    inputRef.current?.focus();
    const onPointer = (event: MouseEvent) => {
      const target = event.target as Node;
      if (buttonRef.current?.contains(target) || panelRef.current?.contains(target)) return;
      setOpen(false);
    };
    const onKey = (event: globalThis.KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", onPointer, true);
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    window.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointer, true);
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  function choose(next: string) {
    onChange(next);
    setOpen(false);
    setQuery("");
  }

  function onSearchKey(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActive((index) => Math.min(index + 1, filtered.length - 1));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActive((index) => Math.max(index - 1, 0));
    } else if (event.key === "Enter") {
      event.preventDefault();
      const option = filtered[active];
      if (option) choose(option.value);
    }
  }

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        onClick={() => {
          setQuery("");
          setActive(0);
          setOpen((next) => !next);
        }}
        className={cn(
          "glass-input flex h-9 min-w-0 items-center justify-between gap-2 rounded-[10px] px-2.5 text-left text-[13px]",
          className,
        )}
      >
        <span className={cn("truncate", !current && "text-fg-subtle")}>
          {current?.label ?? placeholder}
        </span>
        <ChevronDown className={cn("size-4 shrink-0 text-fg-subtle", open && "rotate-180")} />
      </button>
      {open
        ? createPortal(
            <div
              ref={panelRef}
              className="glass-strong fixed z-[180] flex flex-col overflow-hidden rounded-md p-2"
              style={{
                top: box.up ? undefined : box.top,
                bottom: box.up ? window.innerHeight - box.top : undefined,
                left: box.left,
                width: box.width,
                maxHeight: box.maxHeight,
              }}
            >
              <div className="relative mb-1 shrink-0">
                <Search className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-fg-subtle" />
                <input
                  ref={inputRef}
                  value={query}
                  onChange={(event) => {
                    setQuery(event.target.value);
                    setActive(0);
                  }}
                  onKeyDown={onSearchKey}
                  placeholder="Поиск"
                  className="glass-input h-9 w-full rounded-[10px] pr-3 pl-8 text-[13px]"
                  aria-label={`Поиск: ${placeholder}`}
                  autoComplete="off"
                />
              </div>
              <div
                id={listId}
                role="listbox"
                className="min-h-0 flex-1 overflow-y-auto scrollbar-thin"
              >
                {hideEmpty ? null : (
                <button
                  type="button"
                  role="option"
                  aria-selected={value === emptyValue}
                  onClick={() => choose(emptyValue)}
                  className="flex h-10 w-full items-center rounded-md px-3 text-left text-sm text-fg-muted hover:bg-white/45"
                >
                  {emptyLabel}
                </button>
                )}
                {filtered.map((option, index) => {
                  const selected = option.value === value;
                  return (
                    <button
                      key={option.value}
                      type="button"
                      role="option"
                      aria-selected={selected}
                      onMouseEnter={() => setActive(index)}
                      onClick={() => choose(option.value)}
                      className={cn(
                        "flex h-10 w-full items-center justify-between gap-2 rounded-md px-3 text-left text-sm",
                        index === active ? "bg-white/55" : "hover:bg-white/35",
                      )}
                    >
                      <span className="truncate">{option.label}</span>
                      {selected ? <Check className="size-4 shrink-0 text-accent" /> : null}
                    </button>
                  );
                })}
                {filtered.length === 0 ? (
                  <p className="px-3 py-4 text-center text-sm text-fg-subtle">Ничего не нашлось</p>
                ) : null}
              </div>
            </div>,
            document.body,
          )
        : null}
    </>
  );
}
