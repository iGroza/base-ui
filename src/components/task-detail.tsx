"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { createPortal } from "react-dom";
import {
  BookOpen,
  ChevronLeft,
  ChevronRight,
  ClipboardCopy,
  Download,
  ExternalLink,
  FileText,
  Loader2,
  PanelLeft,
  PanelLeftClose,
  Pencil,
  Play,
  Plus,
  Save,
  X,
} from "lucide-react";
import { Chip } from "@/components/ui/chip";
import { MenuSelect } from "@/components/ui/menu-select";
import { PRIORITIES, STATUSES, TYPES } from "@/lib/baserow/schema";
import { totalSp } from "@/lib/baserow/normalize";
import type { FileValue, Task } from "@/lib/baserow/types";
import { chronologicalComments } from "@/lib/baserow/comment";
import { fitInside, type MediaBox } from "@/lib/media-fit";
import { displayTitle, formatDate, formatDateTime, richTextToHtml } from "@/lib/utils";
import { baseTaskUrl, siteTaskUrl } from "@/lib/task-links";
import { buildTaskPrompt, collectTaskAssets, copyText, downloadAsset, downloadTaskAssets } from "@/lib/task-prompt";
import { toast } from "sonner";

export function TaskDetail({
  task,
  canEdit,
  people,
  clients,
  onSave,
  onUploadAssets,
  saving,
  uploadingAssets,
}: {
  task: Task;
  canEdit: boolean;
  people: { id: number; name: string }[];
  clients: { id: number; name: string }[];
  onSave: (input: {
    fields: Record<string, unknown>;
    patch: Partial<Task>;
    commentEntry?: string;
    commentNote?: string;
  }) => Promise<boolean> | boolean;
  onUploadAssets: (files: File[]) => Promise<boolean> | boolean;
  saving: boolean;
  uploadingAssets: boolean;
}) {
  const [title, setTitle] = useState(task.title);
  const [story, setStory] = useState(task.story);
  const [solution, setSolution] = useState(task.solution);
  const [comments, setComments] = useState(task.clientComments);
  const [draftComment, setDraftComment] = useState("");
  const [statusId, setStatusId] = useState(task.status?.id ?? 0);
  const [typeId, setTypeId] = useState(task.type?.id ?? 0);
  const [priorityId, setPriorityId] = useState(task.priority?.id ?? 0);
  const [assigneeIds, setAssigneeIds] = useState(task.assignees.map((item) => item.id));
  const [requesterIds, setRequesterIds] = useState(task.requesters.map((item) => item.id));
  const [clientIds, setClientIds] = useState(task.clients.map((item) => item.id));
  const [beSp, setBeSp] = useState(numText(task.beSp));
  const [mbSp, setMbSp] = useState(numText(task.mbSp));
  const [uiSp, setUiSp] = useState(numText(task.uiSp));
  const [spentSp, setSpentSp] = useState(numText(task.spentSp));
  const [impact, setImpact] = useState(numText(task.impact));
  const [eta, setEta] = useState(task.eta?.slice(0, 10) ?? "");
  const [editing, setEditing] = useState(false);
  const [mediaIndex, setMediaIndex] = useState(0);
  const [copying, setCopying] = useState(false);
  const [viewerOpen, setViewerOpen] = useState(false);
  const media = useMemo(() => collectMedia(task), [task]);
  const assetInputRef = useRef<HTMLInputElement>(null);
  const [narrow, setNarrow] = useState(false);
  const [manual, setManual] = useState<"open" | "closed" | null>(null);
  const frameRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setTitle(task.title);
    setStory(task.story);
    setSolution(task.solution);
    setComments(task.clientComments);
    setStatusId(task.status?.id ?? 0);
    setTypeId(task.type?.id ?? 0);
    setPriorityId(task.priority?.id ?? 0);
    setAssigneeIds(task.assignees.map((item) => item.id));
    setRequesterIds(task.requesters.map((item) => item.id));
    setClientIds(task.clients.map((item) => item.id));
    setBeSp(numText(task.beSp));
    setMbSp(numText(task.mbSp));
    setUiSp(numText(task.uiSp));
    setSpentSp(numText(task.spentSp));
    setImpact(numText(task.impact));
    setEta(task.eta?.slice(0, 10) ?? "");
    setMediaIndex(0);
    setViewerOpen(false);
  }, [task]);

  useEffect(() => {
    const node = frameRef.current;
    if (!node) return;
    const observer = new ResizeObserver(([entry]) => {
      const next = entry.contentRect.width < 680;
      setNarrow((prev) => {
        if (prev !== next) setManual(null);
        return next;
      });
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  const sideVisible = manual ? manual === "open" : !narrow;

  const dirty = useMemo(() => {
    return (
      title !== task.title ||
      story !== task.story ||
      solution !== task.solution ||
      comments !== task.clientComments ||
      statusId !== (task.status?.id ?? 0) ||
      typeId !== (task.type?.id ?? 0) ||
      priorityId !== (task.priority?.id ?? 0) ||
      !sameIds(assigneeIds, task.assignees) ||
      !sameIds(requesterIds, task.requesters) ||
      !sameIds(clientIds, task.clients) ||
      beSp !== numText(task.beSp) ||
      mbSp !== numText(task.mbSp) ||
      uiSp !== numText(task.uiSp) ||
      spentSp !== numText(task.spentSp) ||
      impact !== numText(task.impact) ||
      eta !== (task.eta?.slice(0, 10) ?? "")
    );
  }, [
    title,
    story,
    solution,
    comments,
    statusId,
    typeId,
    priorityId,
    assigneeIds,
    requesterIds,
    clientIds,
    beSp,
    mbSp,
    uiSp,
    spentSp,
    impact,
    eta,
    task,
  ]);

  const sp = totalSp(task);

  const shownTitle = displayTitle(title);

  async function copyAgentPrompt() {
    const assets = collectTaskAssets(task, [story, solution, comments]);
    const status = STATUSES.find((item) => item.id === statusId);
    const type = TYPES.find((item) => item.id === typeId);
    const priority = PRIORITIES.find((item) => item.id === priorityId);
    const prompt = buildTaskPrompt(task, {
      title,
      story,
      solution,
      comments,
      status: status?.value ?? "",
      type: type?.value ?? "",
      priority: priority?.value ?? "",
      clients: linksFrom(clientIds, clients, task.clients).map((item) => item.value).filter(Boolean),
      assignees: linksFrom(assigneeIds, people, task.assignees).map((item) => item.value).filter(Boolean),
      requesters: linksFrom(requesterIds, people, task.requesters).map((item) => item.value).filter(Boolean),
      be: beSp,
      mb: mbSp,
      ui: uiSp,
      spent: spentSp,
      impact,
      eta,
      baseUrl: baseTaskUrl(task),
      siteUrl: siteTaskUrl(task),
      assets: assets.map((item) => item.name),
    });
    setCopying(true);
    try {
      const copied = copyText(prompt);
      if (!copied) {
        toast.error("Не удалось скопировать промпт");
        return;
      }
      if (assets.length) await downloadTaskAssets(assets, `task-${task.incrId ?? task.id}.zip`);
      toast.success(assets.length > 1 ? "Промпт скопирован, архив скачан" : assets.length ? "Промпт скопирован, файл скачан" : "Промпт скопирован");
    } catch {
      toast.error("Промпт скопирован, файлы не скачались");
    } finally {
      setCopying(false);
    }
  }

  return (
    <div ref={frameRef} className="relative flex h-full min-h-0 flex-col bg-inherit">
      <div className="relative flex min-h-0 flex-1">
        <aside
          className={
            narrow
              ? `absolute inset-y-0 left-0 z-20 w-56 overflow-hidden border-r border-white/10 bg-[#f4f7fb] shadow-xl transition-transform duration-300 ease-out dark-side ${sideVisible ? "translate-x-0" : "pointer-events-none -translate-x-full"}`
              : `shrink-0 overflow-hidden border-white/10 transition-[width,opacity] duration-300 ease-out ${sideVisible ? "w-56 border-r opacity-100" : "w-0 border-r-0 opacity-0"}`
          }
        >
          <div className="flex h-full w-56 flex-col text-xs">
          <div className="flex shrink-0 justify-end px-1.5 pt-1.5">
            <button
              type="button"
              aria-label="Скрыть сведения"
              title="Скрыть сведения"
              onClick={() => setManual("closed")}
              className="grid size-7 place-items-center rounded-md text-fg-muted hover:bg-black/5"
            >
              <PanelLeftClose className="size-3.5" />
            </button>
          </div>
          <div className="min-h-0 flex-1 space-y-2.5 overflow-y-auto px-2.5 pt-1 pb-2.5 scrollbar-thin">
          {canEdit ? (
            <div className="space-y-1.5">
              <FieldMenu label="Статус" value={statusId} onChange={setStatusId} options={STATUSES.map((item) => ({ value: String(item.id), label: item.value }))} compact />
              <FieldMenu label="Тип" value={typeId} onChange={setTypeId} options={TYPES.map((item) => ({ value: String(item.id), label: item.value }))} compact />
              <FieldMenu label="Приоритет" value={priorityId} onChange={setPriorityId} options={PRIORITIES.map((item) => ({ value: String(item.id), label: item.value }))} compact />
            </div>
          ) : (
            <div className="flex flex-wrap gap-1">
              {task.status ? <Chip color={task.status.color}>{task.status.value}</Chip> : null}
              {task.type ? <Chip color={task.type.color}>{task.type.value}</Chip> : null}
              {task.priority ? <Chip color={task.priority.color}>{task.priority.value}</Chip> : null}
            </div>
          )}
          <LinkEdit
            label="Ответственные"
            selected={assigneeIds}
            catalog={people}
            fallback={task.assignees}
            disabled={!canEdit}
            onChange={setAssigneeIds}
          />
          <LinkEdit
            label="Запросили"
            selected={requesterIds}
            catalog={people}
            fallback={task.requesters}
            disabled={!canEdit}
            onChange={setRequesterIds}
          />
          <LinkEdit
            label="Клиенты"
            selected={clientIds}
            catalog={clients}
            fallback={task.clients}
            disabled={!canEdit}
            onChange={setClientIds}
          />
          <div className="grid grid-cols-3 gap-1">
            <NumField label="BE" value={beSp} onChange={setBeSp} disabled={!canEdit} />
            <NumField label="MB" value={mbSp} onChange={setMbSp} disabled={!canEdit} />
            <NumField label="UI" value={uiSp} onChange={setUiSp} disabled={!canEdit} />
          </div>
          <NumField label="Потрачено" value={spentSp} onChange={setSpentSp} disabled={!canEdit} />
          <NumField label="Влияние" value={impact} onChange={setImpact} disabled={!canEdit} />
          <label className="block text-[10px] uppercase tracking-[0.12em] text-fg-subtle">
            ETA
            <input
              value={eta}
              disabled={!canEdit}
              onChange={(event) => setEta(event.target.value)}
              placeholder="2026-06-09"
              className="glass-input mt-1 h-8 w-full rounded-[10px] px-2 text-xs normal-case tracking-normal text-fg disabled:opacity-70"
            />
          </label>
          <p className="text-[10px] text-fg-subtle">Обновлено {formatDateTime(task.updated)} · SP {sp || "—"}</p>
          </div>
          </div>
        </aside>
        {narrow && sideVisible ? (
          <button type="button" className="absolute inset-0 z-10 bg-black/25 transition-opacity duration-300" aria-label="Закрыть сведения" onClick={() => setManual("closed")} />
        ) : null}
        {!sideVisible ? (
          <button
            type="button"
            aria-label="Сведения"
            title="Сведения"
            onClick={() => setManual("open")}
            className="absolute top-2.5 left-2 z-20 grid size-7 place-items-center rounded-md text-fg-muted hover:bg-black/5"
          >
            <PanelLeft className="size-3.5" />
          </button>
        ) : null}
        <article className={`min-h-0 overflow-y-auto py-3 scrollbar-thin ${sideVisible ? "px-4 md:px-5" : "pr-4 pl-11 md:pr-5"}`}>
          {editing ? (
            <textarea
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              rows={2}
              className="glass-input mb-3 w-full rounded-md px-3 py-2 text-sm font-semibold leading-snug"
            />
          ) : (
            <h2 className="mb-3 text-base font-semibold leading-snug">{shownTitle}</h2>
          )}
          {media.length > 0 || canEdit ? (
            <MediaGallery
              items={media}
              index={mediaIndex}
              onIndex={setMediaIndex}
              onOpen={() => setViewerOpen(true)}
              onUpload={canEdit ? () => assetInputRef.current?.click() : undefined}
              uploading={uploadingAssets}
            />
          ) : null}
          {canEdit ? (
            <input
              ref={assetInputRef}
              type="file"
              multiple
              className="sr-only"
              onChange={(event) => {
                const files = Array.from(event.target.files ?? []);
                event.target.value = "";
                if (files.length) void onUploadAssets(files);
              }}
            />
          ) : null}
          <Prose
            title="Описание"
            text={story}
            editing={editing}
            onChange={setStory}
            empty="Описания нет"
            onImage={(src) => openMedia(src, media, setMediaIndex, setViewerOpen)}
          />
          <Prose
            title="Решение"
            text={solution}
            editing={editing}
            onChange={setSolution}
            empty="Решения пока нет"
            onImage={(src) => openMedia(src, media, setMediaIndex, setViewerOpen)}
          />
          <section className="mt-4">
            <h3 className="mb-1.5 text-[11px] font-medium uppercase tracking-[0.14em] text-fg-subtle">
              Комментарии
            </h3>
            {editing ? (
              <textarea
                value={comments}
                onChange={(event) => setComments(event.target.value)}
                rows={5}
                className="glass-input w-full rounded-md px-3 py-2 text-[13px] leading-5"
              />
            ) : (
              <div
                className="reading text-[13px] leading-5 text-fg"
                onClick={(event) => openRichImage(event, (src) => openMedia(src, media, setMediaIndex, setViewerOpen))}
                dangerouslySetInnerHTML={{
                  __html: comments.trim() ? richTextToHtml(chronologicalComments(comments)) : "Комментариев пока нет",
                }}
              />
            )}
            {canEdit ? (
              <form
                className="mt-2 flex items-end gap-2"
                onSubmit={(event) => {
                  event.preventDefault();
                  const text = draftComment.trim();
                  if (!text) return;
                  const stamp = new Date().toLocaleString("ru-RU", {
                    day: "numeric",
                    month: "short",
                    hour: "2-digit",
                    minute: "2-digit",
                  });
                  const entry = `— ${stamp}\n${text}`;
                  const next = chronologicalComments([comments.trim(), entry].filter(Boolean).join("\n\n"));
                  const previous = comments;
                  setComments(next);
                  setDraftComment("");
                  void Promise.resolve(
                    onSave({
                      fields: { field_7251: next },
                      patch: { clientComments: next },
                      commentEntry: entry,
                      commentNote: text,
                    }),
                  ).then((saved) => {
                    if (saved !== false) return;
                    setComments(previous);
                    setDraftComment(text);
                  });
                }}
              >
                <textarea
                  value={draftComment}
                  onChange={(event) => setDraftComment(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key !== "Enter" || !(event.metaKey || event.ctrlKey)) return;
                    event.preventDefault();
                    event.currentTarget.form?.requestSubmit();
                  }}
                  rows={3}
                  placeholder="Комментарий"
                  className="glass-input min-h-20 min-w-0 flex-1 resize-y rounded-md px-3 py-2 text-xs leading-5"
                />
                <button
                  type="submit"
                  disabled={!draftComment.trim() || saving}
                  className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-md bg-accent px-3 text-xs font-semibold text-accent-fg disabled:opacity-40"
                >
                  <Plus className="size-3.5" />
                  Добавить
                </button>
              </form>
            ) : null}
          </section>

        </article>
      </div>
      {canEdit ? (
        <footer className="flex shrink-0 items-center justify-between gap-2 border-t border-white/30 px-4 py-3">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setEditing((value) => !value)}
              className="inline-flex h-9 items-center gap-1.5 rounded-md px-3 text-sm text-fg-muted hover:bg-white/40"
            >
              {editing ? <BookOpen className="size-4" /> : <Pencil className="size-4" />}
              {editing ? "Читать" : "Править текст"}
            </button>
            <button
              type="button"
              disabled={copying}
              onClick={() => void copyAgentPrompt()}
              className="inline-flex h-9 items-center gap-1.5 rounded-md px-3 text-sm text-fg-muted hover:bg-white/40 disabled:opacity-40"
            >
              {copying ? <Loader2 className="size-4 animate-spin" /> : <ClipboardCopy className="size-4" />}
              {copying ? "Готовим…" : "Скопировать промпт"}
            </button>
          </div>
          <button
            type="button"
            disabled={!dirty || saving}
            onClick={() => {
              const status = STATUSES.find((item) => item.id === statusId) ?? null;
              const type = TYPES.find((item) => item.id === typeId) ?? null;
              const priority = PRIORITIES.find((item) => item.id === priorityId) ?? null;
              onSave({
                fields: {
                  field_7196: title,
                  field_7200: story,
                  field_7232: solution,
                  field_7251: comments,
                  field_7199: statusId || null,
                  field_7197: typeId || null,
                  field_7203: priorityId || null,
                  field_7206: assigneeIds,
                  field_7205: requesterIds,
                  field_7198: clientIds,
                  field_7201: parseNum(beSp),
                  field_7202: parseNum(mbSp),
                  field_7235: parseNum(uiSp),
                  field_7207: parseNum(spentSp),
                  field_7219: parseNum(impact),
                  field_7210: eta || null,
                },
                patch: {
                  title,
                  story,
                  solution,
                  clientComments: comments,
                  assignees: linksFrom(assigneeIds, people, task.assignees),
                  requesters: linksFrom(requesterIds, people, task.requesters),
                  clients: linksFrom(clientIds, clients, task.clients),
                  beSp: parseNum(beSp),
                  mbSp: parseNum(mbSp),
                  uiSp: parseNum(uiSp),
                  spentSp: parseNum(spentSp),
                  impact: parseNum(impact),
                  eta: eta || null,
                  status: status ? { id: status.id, value: status.value, color: status.color } : null,
                  type: type ? { id: type.id, value: type.value, color: "light-gray" } : null,
                  priority: priority ? { id: priority.id, value: priority.value, color: "light-red" } : null,
                },
              });
            }}
            className="inline-flex h-9 items-center gap-1.5 rounded-md bg-accent px-4 text-sm font-semibold text-accent-fg disabled:opacity-40"
          >
            {saving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
            {saving ? "Сохраняем…" : "Сохранить"}
          </button>
        </footer>
      ) : null}

      {viewerOpen && media[mediaIndex] ? (
        <ImageViewer
          items={media}
          index={mediaIndex}
          onIndex={setMediaIndex}
          onClose={() => setViewerOpen(false)}
        />
      ) : null}
    </div>
  );
}

function FieldMenu({
  label,
  value,
  onChange,
  options,
  compact,
}: {
  label: string;
  value: number;
  onChange: (id: number) => void;
  options: { value: string; label: string }[];
  compact?: boolean;
}) {
  return (
    <label className="flex min-w-0 flex-col gap-1 text-[11px] text-fg-subtle">
      {label}
      <MenuSelect
        value={value ? String(value) : "all"}
        onChange={(next) => onChange(next === "all" ? 0 : Number(next))}
        options={options}
        placeholder={label}
        emptyLabel="Не задан"
        emptyValue="all"
        className={compact ? "h-8 rounded-[10px] px-2 text-xs" : undefined}
      />
    </label>
  );
}

function Prose({
  title,
  text,
  editing,
  onChange,
  empty,
  onImage,
}: {
  title: string;
  text: string;
  editing: boolean;
  onChange: (value: string) => void;
  empty: string;
  onImage: (src: string) => void;
}) {
  return (
    <section className="mt-5">
      <h3 className="mb-1.5 text-[11px] font-medium uppercase tracking-[0.14em] text-fg-subtle">{title}</h3>
      {editing ? (
        <textarea
          value={text}
          onChange={(event) => onChange(event.target.value)}
          rows={6}
          className="glass-input w-full rounded-md px-3 py-2 text-[13px] leading-5"
        />
      ) : (
        <div
          className="reading text-[13px] leading-5 text-fg"
          onClick={(event) => openRichImage(event, onImage)}
          dangerouslySetInnerHTML={{ __html: text.trim() ? richTextToHtml(text) : empty }}
        />
      )}
    </section>
  );
}

function openRichImage(event: { target: EventTarget | null }, onImage: (src: string) => void) {
  const target = event.target;
  if (!(target instanceof HTMLImageElement)) return;
  if (!target.src) return;
  onImage(target.currentSrc || target.src);
}

type MediaKind = "image" | "video" | "file";

type MediaItem = {
  key: string;
  kind: MediaKind;
  name: string;
  preview: string;
  src: string;
};

function collectMedia(task: Task): MediaItem[] {
  const items: MediaItem[] = [];
  for (const file of task.refs) {
    const name = file.visible_name || file.name || "Файл";
    const kind = fileKind(file);
    const preview =
      file.thumbnails?.card_cover?.url || file.thumbnails?.small?.url || (kind === "image" ? file.url : "");
    items.push({
      key: file.url || name,
      kind,
      name,
      preview: preview || file.url,
      src: file.url || preview,
    });
  }
  for (const src of textImageUrls(task.story, task.solution, task.clientComments)) {
    if (items.some((item) => item.src === src || item.preview === src)) continue;
    items.push({ key: src, kind: "image", name: "Изображение", preview: src, src });
  }
  return items;
}

function fileKind(file: FileValue): MediaKind {
  const mime = file.mime_type ?? "";
  const name = `${file.visible_name ?? ""} ${file.name ?? ""} ${file.url}`;
  if (
    file.is_image ||
    mime.startsWith("image/") ||
    /\.(png|jpe?g|gif|webp|avif|svg)(?:\?|#|$)/i.test(name) ||
    Boolean(file.thumbnails?.card_cover?.url || file.thumbnails?.small?.url)
  ) {
    return "image";
  }
  if (mime.startsWith("video/") || /\.(mp4|webm|mov|m4v|ogv)(?:\?|#|$)/i.test(name)) return "video";
  return "file";
}

function textImageUrls(...chunks: string[]) {
  const found: string[] = [];
  const re = /https?:\/\/[^\s<>"']+\.(?:png|jpe?g|gif|webp|avif|svg)(?:\?[^\s<>"']*)?/gi;
  for (const chunk of chunks) {
    for (const match of chunk.matchAll(re)) {
      const href = match[0].replace(/[),.;:]+$/g, "");
      if (!found.includes(href)) found.push(href);
    }
  }
  return found;
}

function openMedia(
  src: string,
  items: MediaItem[],
  setIndex: (index: number) => void,
  setOpen: (open: boolean) => void,
) {
  const index = items.findIndex((item) => item.src === src || item.preview === src);
  setIndex(index >= 0 ? index : 0);
  setOpen(true);
}

function MediaGallery({
  items,
  index,
  onIndex,
  onOpen,
  onUpload,
  uploading,
}: {
  items: MediaItem[];
  index: number;
  onIndex: (index: number) => void;
  onOpen: () => void;
  onUpload?: () => void;
  uploading?: boolean;
}) {
  const current = items[Math.min(index, items.length - 1)] ?? items[0];
  const several = items.length > 1;

  return (
    <section className="mb-4">
      {current ? (
        <div className="relative h-44 overflow-hidden rounded-md bg-black/5">
          <FitBox className="absolute inset-0 grid place-items-center">
            {(box) => <Stage item={current} onOpen={onOpen} box={box} />}
          </FitBox>
          {several ? (
            <>
              <ArrowButton label="Предыдущий файл" className="left-2 z-20" onClick={() => onIndex(step(index, -1, items.length))} />
              <ArrowButton label="Следующий файл" className="right-2 z-20" onClick={() => onIndex(step(index, 1, items.length))} />
            </>
          ) : null}
        </div>
      ) : null}
      <MediaStrip items={items} index={index} onIndex={onIndex} onOpen={onOpen} onUpload={onUpload} uploading={uploading} />
    </section>
  );
}

function Stage({ item, onOpen, box }: { item: MediaItem; onOpen: () => void; box: MediaBox }) {
  const [natural, setNatural] = useState<{ src: string; box: MediaBox } | null>(null);
  const known = natural?.src === item.src ? natural.box : null;
  const report = (size: MediaBox) => {
    setNatural((prev) =>
      prev && prev.src === item.src && prev.box.width === size.width && prev.box.height === size.height
        ? prev
        : { src: item.src, box: size },
    );
  };
  const style = mediaFrame(box, known);

  if (item.kind === "video") {
    return (
      <video
        key={item.src}
        src={item.src}
        controls
        style={style}
        className="block bg-black object-contain"
        onLoadedMetadata={(event) => {
          const video = event.currentTarget;
          if (video.videoWidth > 0) report({ width: video.videoWidth, height: video.videoHeight });
        }}
        onClick={(event) => event.stopPropagation()}
      />
    );
  }
  if (item.kind === "file") {
    return (
      <a
        href={item.src}
        target="_blank"
        rel="noreferrer"
        onClick={(event) => event.stopPropagation()}
        className="flex max-w-sm flex-col items-center gap-2 px-4 text-center text-sm"
      >
        <FileText className="size-8" />
        <span className="break-all">{item.name}</span>
        <span className="inline-flex items-center gap-1 text-xs text-fg-muted">
          <ExternalLink className="size-3.5" />
          Открыть файл
        </span>
      </a>
    );
  }
  return (
    <button type="button" onClick={onOpen} className="block">
      <SafeImage
        src={item.src}
        fallback={item.preview}
        alt={item.name}
        className="block object-contain"
        style={style}
        onNatural={report}
      />
    </button>
  );
}

function mediaFrame(box: MediaBox, natural: MediaBox | null): CSSProperties {
  const limit = { maxWidth: box.width, maxHeight: box.height, width: "auto", height: "auto" } as const;
  if (!natural) return limit;
  const fitted = fitInside(box, natural);
  if (fitted.width <= 0 || fitted.height <= 0) return limit;
  return { width: fitted.width, height: fitted.height, maxWidth: box.width, maxHeight: box.height };
}

function FitBox({ className, children }: { className?: string; children: (box: MediaBox) => ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const [box, setBox] = useState<MediaBox>({ width: 0, height: 0 });

  useLayoutEffect(() => {
    const node = ref.current;
    if (!node) return;
    const measure = () => {
      const next = contentBox(node);
      setBox((prev) => (prev.width === next.width && prev.height === next.height ? prev : next));
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  return (
    <div ref={ref} className={className}>
      {box.width > 0 && box.height > 0 ? children(box) : null}
    </div>
  );
}

function contentBox(node: HTMLElement): MediaBox {
  const style = getComputedStyle(node);
  const width = node.clientWidth - px(style.paddingLeft) - px(style.paddingRight);
  const height = node.clientHeight - px(style.paddingTop) - px(style.paddingBottom);
  return { width: Math.max(0, Math.floor(width)), height: Math.max(0, Math.floor(height)) };
}

function px(value: string) {
  const number = Number.parseFloat(value);
  return Number.isFinite(number) ? number : 0;
}

function SafeImage({
  src,
  fallback,
  alt,
  className,
  style,
  onNatural,
}: {
  src: string;
  fallback: string;
  alt: string;
  className?: string;
  style?: CSSProperties;
  onNatural?: (size: MediaBox) => void;
}) {
  const [current, setCurrent] = useState(src);
  const ref = useRef<HTMLImageElement>(null);
  const onNaturalRef = useRef(onNatural);
  onNaturalRef.current = onNatural;
  useEffect(() => setCurrent(src), [src]);
  useEffect(() => {
    const img = ref.current;
    if (!img?.complete || img.naturalWidth <= 0) return;
    onNaturalRef.current?.({ width: img.naturalWidth, height: img.naturalHeight });
  }, [current]);
  return (
    <img
      ref={ref}
      src={current}
      alt={alt}
      className={className}
      style={style}
      onLoad={(event) => {
        const img = event.currentTarget;
        if (img.naturalWidth > 0) onNaturalRef.current?.({ width: img.naturalWidth, height: img.naturalHeight });
      }}
      onError={() => {
        if (fallback && current !== fallback) setCurrent(fallback);
      }}
    />
  );
}

function MediaStrip({
  items,
  index,
  onIndex,
  onOpen,
  onUpload,
  uploading,
  centered = false,
}: {
  items: MediaItem[];
  index: number;
  onIndex: (index: number) => void;
  onOpen?: () => void;
  onUpload?: () => void;
  uploading?: boolean;
  centered?: boolean;
}) {
  return (
    <div className={centered ? "mt-2 flex justify-center" : "mt-2"}>
      <div className="flex max-w-full gap-2 overflow-x-auto px-1.5 py-1.5">
        {items.map((item, itemIndex) => {
          const selected = itemIndex === index;
          return (
            <div key={item.key} className="group/thumb relative size-16 shrink-0">
              <button
                type="button"
                aria-label={item.name}
                aria-current={selected}
                onClick={() => {
                  onIndex(itemIndex);
                  onOpen?.();
                }}
                className={`size-full rounded-md p-[3px] ${selected ? "bg-accent" : "bg-transparent"}`}
              >
                <span className="flex size-full items-center justify-center overflow-hidden rounded-[5px] bg-black/10">
                  <Thumb item={item} />
                </span>
              </button>
              <DownloadButton
                item={item}
                className="right-1 bottom-1 size-5 opacity-0 group-hover/thumb:opacity-100"
              />
            </div>
          );
        })}
        {onUpload ? (
          <button
            type="button"
            aria-label="Загрузить ассеты"
            title="Загрузить ассеты"
            disabled={uploading}
            onClick={onUpload}
            className="grid size-16 shrink-0 place-items-center rounded-md border border-dashed border-fg-subtle/50 text-fg-muted hover:border-accent hover:text-accent disabled:opacity-50"
          >
            {uploading ? <Loader2 className="size-5 animate-spin" /> : <Plus className="size-5" />}
          </button>
        ) : null}
      </div>
    </div>
  );
}

function Thumb({ item }: { item: MediaItem }) {
  if (item.kind === "image") {
    return <SafeImage src={item.preview || item.src} fallback={item.src} alt="" className="size-full object-contain" />;
  }
  if (item.kind === "video") {
    return (
      <span className="grid size-full place-items-center bg-black/70 text-white">
        <Play className="size-4 fill-current" />
      </span>
    );
  }
  return (
    <span className="flex flex-col items-center gap-0.5 px-1 text-fg-muted">
      <FileText className="size-4" />
      <span className="line-clamp-2 text-[9px] leading-tight">{item.name}</span>
    </span>
  );
}

function assetOf(item: MediaItem): { name: string; url: string } {
  return { name: item.name, url: item.src };
}

function DownloadButton({ item, className }: { item: MediaItem; className?: string }) {
  return (
    <a
      href={item.src}
      download={item.name}
      aria-label={`Скачать ${item.name}`}
      title="Скачать"
      onClick={(event) => {
        event.stopPropagation();
        event.preventDefault();
        downloadAsset(assetOf(item));
      }}
      className={`absolute z-10 grid place-items-center rounded-md bg-[#102033]/80 text-white shadow ${className ?? "size-7"}`}
    >
      <Download className="size-3.5" />
    </a>
  );
}

function ArrowButton({ label, className, onClick }: { label: string; className: string; onClick: () => void }) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={(event) => {
        event.stopPropagation();
        onClick();
      }}
      className={`media-arrow absolute top-1/2 grid size-9 -translate-y-1/2 place-items-center rounded-md ${className}`}
    >
      {label.startsWith("Пред") ? <ChevronLeft className="size-5" /> : <ChevronRight className="size-5" />}
    </button>
  );
}

function step(index: number, delta: number, length: number) {
  return (index + delta + length) % length;
}

function ImageViewer({
  items,
  index,
  onIndex,
  onClose,
}: {
  items: MediaItem[];
  index: number;
  onIndex: (index: number) => void;
  onClose: () => void;
}) {
  const current = items[index];

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        onClose();
        return;
      }
      if (event.key === "ArrowRight") onIndex(step(index, 1, items.length));
      if (event.key === "ArrowLeft") onIndex(step(index, -1, items.length));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [index, items.length, onClose, onIndex]);

  if (!current || typeof document === "undefined") return null;

  return createPortal(
    <div
      data-image-viewer
      role="dialog"
      aria-modal="true"
      aria-label="Просмотр файлов"
      className="modal-scrim fixed inset-0 z-[220] flex flex-col"
      onClick={onClose}
    >
      <button
        type="button"
        aria-label="Закрыть просмотр"
        onClick={onClose}
        className="absolute top-4 right-4 z-10 grid size-9 place-items-center rounded-md bg-white/15 text-white"
      >
        <X className="size-4" />
      </button>
      <div className="relative min-h-0 flex-1">
        <FitBox className="absolute inset-0 grid place-items-center px-14 pt-16 pb-3">
          {(box) => (
            <div onClick={(event) => event.stopPropagation()}>
              <Stage item={current} onOpen={() => undefined} box={box} />
            </div>
          )}
        </FitBox>
        {items.length > 1 ? (
          <>
            <ArrowButton label="Предыдущий файл" className="left-3 z-20" onClick={() => onIndex(step(index, -1, items.length))} />
            <ArrowButton label="Следующий файл" className="right-3 z-20" onClick={() => onIndex(step(index, 1, items.length))} />
          </>
        ) : null}
      </div>
      <div className="px-4 pb-5" onClick={(event) => event.stopPropagation()}>
        <MediaStrip items={items} index={index} onIndex={onIndex} centered />
      </div>
    </div>,
    document.body,
  );
}

function numText(value: number | null) {
  return value == null ? "" : String(value);
}

function parseNum(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const number = Number(trimmed.replace(",", "."));
  return Number.isFinite(number) ? number : null;
}

function sameIds(ids: number[], links: { id: number }[]) {
  const current = links.map((item) => item.id);
  return ids.length === current.length && ids.every((id, index) => id === current[index]);
}

function linksFrom(
  ids: number[],
  catalog: { id: number; name: string }[],
  fallback: { id: number; value: string }[],
) {
  return ids.map((id) => ({
    id,
    value: catalog.find((item) => item.id === id)?.name ?? fallback.find((item) => item.id === id)?.value ?? "",
  }));
}

function LinkEdit({
  label,
  selected,
  catalog,
  fallback,
  disabled,
  onChange,
}: {
  label: string;
  selected: number[];
  catalog: { id: number; name: string }[];
  fallback: { id: number; value: string }[];
  disabled: boolean;
  onChange: (ids: number[]) => void;
}) {
  const chosen = linksFrom(selected, catalog, fallback);
  const options = catalog.filter((item) => !selected.includes(item.id));
  return (
    <div>
      <p className="text-[10px] uppercase tracking-[0.12em] text-fg-subtle">{label}</p>
      <div className="mt-1 flex flex-wrap gap-1">
        {chosen.map((person) => (
          <button
            key={person.id}
            type="button"
            disabled={disabled}
            onClick={() => onChange(selected.filter((id) => id !== person.id))}
            className="inline-flex h-6 max-w-full items-center gap-1 rounded-md bg-white/10 px-2 text-[11px] text-fg disabled:opacity-70"
          >
            <span className="truncate">{person.value}</span>
            {disabled ? null : <span className="text-fg-subtle">×</span>}
          </button>
        ))}
        {chosen.length === 0 ? <span className="text-[11px] text-fg-subtle">Никто</span> : null}
      </div>
      {disabled ? null : (
        <MenuSelect
          value=""
          onChange={(next) => {
            if (!next) return;
            onChange([...selected, Number(next)]);
          }}
          options={options.map((item) => ({ value: String(item.id), label: item.name }))}
          placeholder="Добавить"
          hideEmpty
          className="mt-1 h-8 rounded-[10px] px-2 text-[11px]"
        />
      )}
    </div>
  );
}

function NumField({
  label,
  value,
  onChange,
  disabled,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  disabled: boolean;
}) {
  return (
    <label className="block text-[10px] uppercase tracking-[0.12em] text-fg-subtle">
      {label}
      <input
        value={value}
        disabled={disabled}
        inputMode="decimal"
        onChange={(event) => onChange(event.target.value)}
        className="glass-input mt-1 h-8 w-full rounded-[10px] px-2 text-xs normal-case tracking-normal text-fg disabled:opacity-70"
      />
    </label>
  );
}

