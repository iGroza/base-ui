"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Bookmark, Trash2, X } from "lucide-react";
import { describeBoard, type SavedBoard } from "@/lib/saved-boards";

export function SavedBoardsView({
  boards,
  onOpen,
  onDelete,
}: {
  boards: SavedBoard[];
  onOpen: (board: SavedBoard) => void;
  onDelete: (id: string) => void;
}) {
  if (!boards.length) {
    return (
      <div className="glass grid h-full place-items-center rounded-[10px] p-8 text-center">
        <div className="max-w-sm">
          <p className="text-sm font-medium">Сохранённых подборок пока нет</p>
          <p className="mt-1 text-xs leading-5 text-fg-muted">
            Настройте фильтры и нажмите «Сохранить подборку». В окне задайте имя.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="grid h-full min-h-0 auto-rows-min grid-cols-1 gap-2.5 overflow-y-auto pb-2 scrollbar-thin sm:grid-cols-2 xl:grid-cols-3">
      {boards.map((board) => (
        <article key={board.id} className="glass flex min-w-0 flex-col rounded-[10px] p-3.5">
          <button type="button" onClick={() => onOpen(board)} className="min-w-0 text-left">
            <h3 className="truncate text-sm font-semibold">{board.name}</h3>
            <p className="mt-1 line-clamp-2 text-xs leading-5 text-fg-muted">{describeBoard(board)}</p>
          </button>
          <button
            type="button"
            onClick={() => onDelete(board.id)}
            className="mt-3 inline-flex h-8 items-center gap-1 self-start rounded-md px-2 text-xs text-fg-subtle hover:bg-white/40 hover:text-fg"
          >
            <Trash2 className="size-3.5" />
            Удалить
          </button>
        </article>
      ))}
    </div>
  );
}

export function SaveBoardControl({ onSave }: { onSave: (name: string) => void }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");

  function close() {
    setOpen(false);
    setName("");
  }

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") close();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        title="Сохранить текущие фильтры как подборку"
        className="toolbar-control inline-flex items-center gap-1.5 px-3 font-medium text-fg"
      >
        <Bookmark className="size-3.5" />
        Сохранить подборку
      </button>
      {open
        ? createPortal(
        <div
          className="modal-scrim fixed inset-0 z-[120] grid place-items-center p-4"
          onMouseDown={close}
        >
          <form
            role="dialog"
            aria-modal="true"
            aria-labelledby="save-board-title"
            className="dialog-in glass-strong w-full max-w-sm rounded-[10px] p-5"
            onMouseDown={(event) => event.stopPropagation()}
            onSubmit={(event) => {
              event.preventDefault();
              const next = name.trim();
              if (!next) return;
              onSave(next);
              close();
            }}
          >
            <div className="mb-4 flex items-start justify-between gap-3">
              <div>
                <h2 id="save-board-title" className="text-lg font-semibold">
                  Новая подборка
                </h2>
                <p className="mt-1 text-sm text-fg-muted">Имя для текущего поиска и фильтров.</p>
              </div>
              <button
                type="button"
                onClick={close}
                className="grid size-8 place-items-center rounded-md text-fg-muted hover:bg-white/15 hover:text-fg"
                aria-label="Закрыть"
              >
                <X className="size-4" />
              </button>
            </div>
            <label className="text-xs font-medium uppercase tracking-wide text-fg-subtle" htmlFor="save-board-name">
              Название
            </label>
            <input
              id="save-board-name"
              autoFocus
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Например, мои баги"
              className="glass-input mt-1 h-9 w-full rounded-[10px] px-3 text-[13px]"
            />
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={close}
                className="h-9 rounded-[10px] px-4 text-[13px] font-medium text-fg-muted"
              >
                Отмена
              </button>
              <button
                type="submit"
                disabled={!name.trim()}
                className="h-9 rounded-[10px] bg-accent px-4 text-[13px] font-semibold text-accent-fg disabled:opacity-50"
              >
                Сохранить
              </button>
            </div>
          </form>
        </div>,
            document.body,
          )
        : null}
    </>
  );
}
