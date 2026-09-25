"use client";

import { useState, type ReactNode } from "react";
import { X } from "lucide-react";
import { clearBaseToken, saveBaseToken, type CreateTaskInput } from "@/lib/baserow/client";
import { PRIORITIES, STATUSES, TYPES } from "@/lib/baserow/schema";
import type { BaseAccount } from "@/lib/baserow/types";
import { MenuSelect } from "@/components/ui/menu-select";
import { SCENES, type SceneId } from "@/lib/scenes";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

export function TokenGate({
  pending,
  error,
  onSaved,
}: {
  pending: boolean;
  error?: string;
  onSaved: (account: BaseAccount) => void;
}) {
  const [value, setValue] = useState("");
  const [reveal, setReveal] = useState(false);
  const [checking, setChecking] = useState(false);
  const [localError, setLocalError] = useState("");

  async function save() {
    const next = value.trim();
    if (next.length < 8) {
      setLocalError("Вставьте токен базы");
      return;
    }
    setChecking(true);
    setLocalError("");
    const result = await saveBaseToken(next);
    setChecking(false);
    if (!result.ok) {
      setLocalError(result.error ?? "Токен не принят");
      return;
    }
    onSaved(result.account);
  }

  const message = localError || error;

  return (
    <div className="modal-scrim fixed inset-0 z-[200] grid place-items-center p-4">
      <form
        role="dialog"
        aria-modal="true"
        aria-labelledby="token-gate-title"
        className="dialog-in glass-strong w-full max-w-md rounded-[10px] p-5"
        onSubmit={(event) => {
          event.preventDefault();
          if (!pending) void save();
        }}
      >
        <h2 id="token-gate-title" className="text-lg font-semibold">
          Нужен токен Base
        </h2>
        <p className="mt-1 text-sm text-fg-muted">
          {pending
            ? "Проверяем сохранённый токен. Пока он не подтверждён, доска закрыта."
            : "Без токена разделы, поиск и задачи недоступны. Токен останется только в этом браузере."}
        </p>
        {pending ? null : (
          <>
            <label className="mt-4 block text-xs font-medium uppercase tracking-wide text-fg-subtle" htmlFor="token-gate-input">
              Database token
            </label>
            <div className="relative mt-1">
              <input
                id="token-gate-input"
                autoFocus
                value={value}
                onChange={(event) => setValue(event.target.value)}
                placeholder="Токен базы"
                type={reveal ? "text" : "password"}
                className="glass-input h-9 w-full rounded-[10px] pr-24 pl-3 text-[13px]"
                autoComplete="off"
                spellCheck={false}
              />
              <button
                type="button"
                onClick={() => setReveal((next) => !next)}
                className="absolute top-1/2 right-1.5 h-7 -translate-y-1/2 rounded-[8px] px-2 text-xs font-medium text-fg-muted"
              >
                {reveal ? "Скрыть" : "Показать"}
              </button>
            </div>
            {message ? <p className="mt-2 text-xs text-danger">{message}</p> : null}
            <button
              type="submit"
              disabled={checking}
              className="mt-4 h-9 w-full rounded-[10px] bg-accent text-[13px] font-semibold text-accent-fg disabled:opacity-50"
            >
              {checking ? "Проверяем…" : "Подключить"}
            </button>
          </>
        )}
      </form>
    </div>
  );
}

export function SettingsDialog({
  hint,
  scene,
  onScene,
  onClose,
  onSaved,
}: {
  hint?: string;
  scene: SceneId;
  onScene: (scene: SceneId) => void;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [value, setValue] = useState("");
  const [reveal, setReveal] = useState(false);
  const [checking, setChecking] = useState(false);

  async function save() {
    const next = value.trim();
    setChecking(true);
    if (!next) {
      await clearBaseToken();
      setChecking(false);
      toast.success("База отключена");
      onSaved();
      onClose();
      return;
    }
    const result = await saveBaseToken(next);
    setChecking(false);
    if (!result.ok) {
      toast.error(result.error ?? "Токен не принят");
      return;
    }
    setValue("");
    toast.success("Токен сохранён в этом браузере");
    onSaved();
    onClose();
  }

  return (
    <div className="modal-scrim fixed inset-0 z-[120] grid place-items-center p-4">
      <div className="glass-strong w-full max-w-lg rounded-[10px] p-5">
        <div className="mb-4 flex items-start justify-between">
          <div>
            <h2 className="text-lg font-semibold">Подключение Base</h2>
            <p className="mt-1 text-sm text-fg-muted">
              Токен лежит только в этом браузере и не попадает в код. Запросы идут прямо в Base.
              {hint ? ` Сейчас подключён ····${hint}.` : " База не подключена."}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="grid size-8 place-items-center rounded-md text-fg-muted hover:bg-white/15 hover:text-fg"
            aria-label="Закрыть"
          >
            <X className="size-4" />
          </button>
        </div>
        <p className="mb-2 text-[11px] font-medium uppercase tracking-[0.16em] text-fg-subtle">Фон</p>
        <div className="mb-4 flex gap-2">
          {SCENES.map((item) => (
            <button
              key={item.id}
              type="button"
              title={item.label}
              aria-label={item.label}
              aria-pressed={scene === item.id}
              onClick={() => onScene(item.id)}
              className={cn(
                "size-11 overflow-hidden rounded-full border border-white/70",
                scene === item.id && "ring-2 ring-accent ring-offset-2",
              )}
            >
              <img src={item.image} alt="" className="size-full object-cover" />
            </button>
          ))}
        </div>
        <label className="text-xs font-medium uppercase tracking-wide text-fg-subtle">
          Database token
        </label>
        <div className="relative mt-1">
          <input
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder="Новый токен"
            type={reveal ? "text" : "password"}
            className="glass-input h-11 w-full rounded-md pr-20 pl-3 text-sm"
            autoComplete="off"
            spellCheck={false}
          />
          <button
            type="button"
            onClick={() => setReveal((next) => !next)}
            className="absolute top-1/2 right-2 h-8 -translate-y-1/2 rounded-md px-2 text-xs font-medium text-fg-muted"
          >
            {reveal ? "Скрыть" : "Показать"}
          </button>
        </div>
        <p className="mt-2 text-xs leading-relaxed text-fg-subtle">
          Database token подключает данные доски. Пустое поле отключает базу.
        </p>
        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="h-11 rounded-md px-4 text-sm font-medium text-fg-muted"
          >
            Отмена
          </button>
          <button
            type="button"
            onClick={() => void save()}
            disabled={checking}
            className="h-11 rounded-md bg-accent px-5 text-sm font-semibold text-accent-fg disabled:opacity-50"
          >
            {checking ? "Проверяем…" : "Сохранить"}
          </button>
        </div>
      </div>
    </div>
  );
}

export function CreateTaskDialog({
  people,
  clients,
  onClose,
  onCreate,
  creating,
}: {
  people: { id: number; name: string }[];
  clients: { id: number; name: string }[];
  onClose: () => void;
  onCreate: (input: CreateTaskInput) => void;
  creating: boolean;
}) {
  const [title, setTitle] = useState("");
  const [story, setStory] = useState("");
  const [statusId, setStatusId] = useState("3110");
  const [typeId, setTypeId] = useState("");
  const [priorityId, setPriorityId] = useState("");
  const [assigneeIds, setAssigneeIds] = useState<number[]>([]);
  const [requesterIds, setRequesterIds] = useState<number[]>([]);
  const [clientIds, setClientIds] = useState<number[]>([]);
  const [be, setBe] = useState("");
  const [mb, setMb] = useState("");
  const [ui, setUi] = useState("");
  const [spent, setSpent] = useState("");
  const [impact, setImpact] = useState("");
  const [eta, setEta] = useState("");

  return (
    <div className="modal-scrim fixed inset-0 z-[120] grid place-items-center p-4">
      <form
        className="glass-strong flex max-h-[min(860px,calc(100dvh-2rem))] w-full max-w-lg flex-col rounded-[10px] p-5"
        onSubmit={(event) => {
          event.preventDefault();
          if (title.trim().length < 3) return;
          onCreate({
            title: title.trim(),
            story: story.trim(),
            statusId: Number(statusId) || 3110,
            typeId: typeId ? Number(typeId) : undefined,
            priorityId: priorityId ? Number(priorityId) : undefined,
            assigneeIds,
            requesterIds,
            clientIds,
            be: numberOrNull(be),
            mb: numberOrNull(mb),
            ui: numberOrNull(ui),
            spent: numberOrNull(spent),
            impact: numberOrNull(impact),
            eta: eta.trim(),
          });
        }}
      >
        <div className="mb-4 flex items-start justify-between">
          <h2 className="text-lg font-semibold">Новая задача</h2>
          <button
            type="button"
            onClick={onClose}
            className="grid size-8 place-items-center rounded-md text-fg-muted hover:bg-white/15 hover:text-fg"
            aria-label="Закрыть"
          >
            <X className="size-4" />
          </button>
        </div>
        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto pr-1">
          <Field label="Какую проблему решаем?">
            <textarea
              required
              minLength={3}
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              rows={3}
              className="glass-input w-full rounded-md px-3 py-2 text-sm"
            />
          </Field>
          <Field label="User story / баг">
            <textarea
              value={story}
              onChange={(event) => setStory(event.target.value)}
              rows={4}
              className="glass-input w-full rounded-md px-3 py-2 text-sm"
            />
          </Field>
          <div className="grid grid-cols-3 gap-2">
            <Field label="Статус">
              <MenuSelect
                value={statusId}
                onChange={setStatusId}
                options={STATUSES.map((item) => ({ value: String(item.id), label: item.value }))}
                placeholder="Статус"
                hideEmpty
                className="h-9 w-full rounded-md px-2 text-[13px]"
              />
            </Field>
            <Field label="Тип">
              <MenuSelect
                value={typeId || "all"}
                onChange={(value) => setTypeId(value === "all" ? "" : value)}
                options={TYPES.map((item) => ({ value: String(item.id), label: item.value }))}
                placeholder="Тип"
                emptyLabel="Не задан"
                className="h-9 w-full rounded-md px-2 text-[13px]"
              />
            </Field>
            <Field label="Приоритет">
              <MenuSelect
                value={priorityId || "all"}
                onChange={(value) => setPriorityId(value === "all" ? "" : value)}
                options={PRIORITIES.map((item) => ({ value: String(item.id), label: item.value }))}
                placeholder="Приоритет"
                emptyLabel="Не задан"
                className="h-9 w-full rounded-md px-2 text-[13px]"
              />
            </Field>
          </div>
          <IdPicker label="Ответственные" catalog={people} selected={assigneeIds} onChange={setAssigneeIds} />
          <IdPicker label="Запросили" catalog={people} selected={requesterIds} onChange={setRequesterIds} />
          <IdPicker label="Клиенты" catalog={clients} selected={clientIds} onChange={setClientIds} />
          <div className="grid grid-cols-4 gap-2">
            <Field label="BE">
              <input value={be} onChange={(event) => setBe(event.target.value)} inputMode="decimal" className="glass-input h-9 w-full rounded-md px-2 text-sm" />
            </Field>
            <Field label="MB">
              <input value={mb} onChange={(event) => setMb(event.target.value)} inputMode="decimal" className="glass-input h-9 w-full rounded-md px-2 text-sm" />
            </Field>
            <Field label="UI">
              <input value={ui} onChange={(event) => setUi(event.target.value)} inputMode="decimal" className="glass-input h-9 w-full rounded-md px-2 text-sm" />
            </Field>
            <Field label="Потрачено">
              <input value={spent} onChange={(event) => setSpent(event.target.value)} inputMode="decimal" className="glass-input h-9 w-full rounded-md px-2 text-sm" />
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Field label="Влияние">
              <input value={impact} onChange={(event) => setImpact(event.target.value)} inputMode="decimal" className="glass-input h-9 w-full rounded-md px-2 text-sm" />
            </Field>
            <Field label="ETA">
              <input value={eta} onChange={(event) => setEta(event.target.value)} placeholder="2026-06-09" className="glass-input h-9 w-full rounded-md px-2 text-sm" />
            </Field>
          </div>
        </div>
        <div className="mt-4 flex justify-end">
          <button
            type="submit"
            disabled={creating || title.trim().length < 3}
            className="h-9 rounded-md bg-accent px-5 text-sm font-semibold text-accent-fg disabled:opacity-50"
          >
            {creating ? "Создаём…" : "Создать"}
          </button>
        </div>
      </form>
    </div>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block text-xs font-medium uppercase tracking-wide text-fg-subtle">
      {label}
      <div className="mt-1 normal-case tracking-normal">{children}</div>
    </label>
  );
}

function IdPicker({
  label,
  catalog,
  selected,
  onChange,
}: {
  label: string;
  catalog: { id: number; name: string }[];
  selected: number[];
  onChange: (ids: number[]) => void;
}) {
  const chosen = selected
    .map((id) => catalog.find((item) => item.id === id))
    .filter((item): item is { id: number; name: string } => Boolean(item));
  return (
    <div>
      <p className="text-xs font-medium uppercase tracking-wide text-fg-subtle">{label}</p>
      <div className="mt-1 flex flex-wrap gap-1">
        {chosen.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => onChange(selected.filter((id) => id !== item.id))}
            className="inline-flex h-7 max-w-full items-center gap-1 rounded-md bg-white/10 px-2 text-[12px] text-fg"
          >
            <span className="truncate">{item.name}</span>
            <span className="text-fg-subtle">×</span>
          </button>
        ))}
      </div>
      <MenuSelect
        value=""
        onChange={(next) => {
          const id = Number(next);
          if (!id || selected.includes(id)) return;
          onChange([...selected, id]);
        }}
        options={catalog.filter((item) => !selected.includes(item.id)).map((item) => ({ value: String(item.id), label: item.name }))}
        placeholder="Добавить"
        hideEmpty
        className="mt-1 h-9 w-full rounded-md px-2 text-[13px]"
      />
    </div>
  );
}

function numberOrNull(value: string) {
  const trimmed = value.trim().replace(",", ".");
  if (!trimmed) return null;
  const number = Number(trimmed);
  return Number.isFinite(number) ? number : null;
}
