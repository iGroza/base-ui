import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Check, ChevronDown, ChevronUp, Columns3, MoreHorizontal } from "lucide-react";
import { Chip, Avatar } from "@/components/ui/chip";
import { totalSp } from "@/lib/baserow/normalize";
import type { Task } from "@/lib/baserow/types";
import { splitList, type SortKey } from "@/lib/query";
import { TaskLinkButtons } from "@/components/task-links";
import { cn, displayTitle, formatDate, taskRef } from "@/lib/utils";

export const TABLE_COLUMNS: { id: string; label: string; sort: SortKey; filter?: FilterKey }[] = [
  { id: "id", label: "ID", sort: "id" },
  { id: "title", label: "Задача", sort: "title" },
  { id: "status", label: "Статус", sort: "status", filter: "status" },
  { id: "type", label: "Тип", sort: "type", filter: "type" },
  { id: "priority", label: "Приоритет", sort: "priority", filter: "priority" },
  { id: "client", label: "Клиент", sort: "client", filter: "client" },
  { id: "assignee", label: "Кто", sort: "assignee", filter: "who" },
  { id: "sp", label: "SP", sort: "sp" },
  { id: "updated", label: "Обновлено", sort: "updated" },
];

export type FilterKey = "status" | "type" | "priority" | "client" | "who";

export function visibleColumnIds(cols: string) {
  const picked = splitList(cols);
  const known = new Set(TABLE_COLUMNS.map((column) => column.id));
  const valid = picked.filter((id) => known.has(id));
  return valid.length ? valid : TABLE_COLUMNS.map((column) => column.id);
}

export function TaskTable({
  tasks,
  source,
  selectedKey,
  onOpen,
  sort,
  dir,
  onSort,
  filters,
  onFilter,
  cols,
  onCols,
}: {
  tasks: Task[];
  source: Task[];
  selectedKey: string;
  onOpen: (task: Task) => void;
  sort: SortKey;
  dir: "asc" | "desc";
  onSort: (sort: SortKey) => void;
  filters: Record<FilterKey, string>;
  onFilter: (key: FilterKey, value: string) => void;
  cols: string;
  onCols: (cols: string) => void;
}) {
  const [openFilter, setOpenFilter] = useState<string | null>(null);
  const [filterBox, setFilterBox] = useState({ top: 0, left: 0 });
  const [columnsOpen, setColumnsOpen] = useState(false);
  const visible = new Set(visibleColumnIds(cols));
  const columns = TABLE_COLUMNS.filter((column) => visible.has(column.id));

  useEffect(() => {
    if (!openFilter) return;
    const close = (event: Event) => {
      const target = event.target as Element | null;
      if (target?.closest("[data-filter-popover], [data-filter-trigger]")) return;
      setOpenFilter(null);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      event.stopPropagation();
      setOpenFilter(null);
    };
    document.addEventListener("pointerdown", close, true);
    document.addEventListener("keydown", onKey, true);
    return () => {
      document.removeEventListener("pointerdown", close, true);
      document.removeEventListener("keydown", onKey, true);
    };
  }, [openFilter]);

  return (
    <div className="neon-table glass flex h-full min-h-0 flex-col overflow-hidden rounded-[10px]">
      <div className="flex items-center justify-end px-3 pt-2">
        <button
          type="button"
          onClick={() => setColumnsOpen((value) => !value)}
          className="flex h-8 items-center gap-1.5 rounded-md px-2 text-xs font-medium text-fg-muted hover:bg-white/30"
        >
          <Columns3 className="size-3.5" />
          Колонки
        </button>
      </div>
      {columnsOpen ? (
        <div className="mx-3 mb-2 flex flex-wrap gap-1">
          {TABLE_COLUMNS.map((column) => {
            const on = visible.has(column.id);
            return (
              <button
                key={column.id}
                type="button"
                aria-pressed={on}
                onClick={() => {
                  const next = on
                    ? [...visible].filter((id) => id !== column.id)
                    : [...visible, column.id];
                  onCols(next.length === TABLE_COLUMNS.length ? "" : next.join(","));
                }}
                className={cn(
                  "h-8 rounded-md px-2.5 text-xs",
                  on ? "bg-white/55 text-fg" : "text-fg-subtle hover:bg-white/25",
                )}
              >
                {column.label}
              </button>
            );
          })}
        </div>
      ) : null}
      <div className="min-h-0 flex-1 overflow-auto scrollbar-thin md:hidden">
        {tasks.map((task) => {
          const key = String(task.id);
          return (
            <button
              key={task.id}
              type="button"
              onClick={() => onOpen(task)}
              className={cn(
                "flex w-full flex-col gap-1 border-t border-white/20 px-3 py-2 text-left",
                selectedKey.split(",").includes(key) && "bg-white/20",
              )}
            >
              <span className="flex items-center gap-2">
                <span className="font-mono text-xs text-fg-subtle">{taskRef(task)}</span>
                <TaskLinkButtons task={task} />
                {task.status ? <Chip color={task.status.color}>{task.status.value}</Chip> : null}
                {task.priority ? <Chip color={task.priority.color}>{task.priority.value}</Chip> : null}
              </span>
              <span className="line-clamp-2 text-sm font-medium">{displayTitle(task.title)}</span>
              <span className="truncate text-xs text-fg-muted">
                {task.assignees[0]?.value ?? "без ответственного"}
                {task.clients[0] ? ` · ${task.clients[0].value}` : ""}
              </span>
            </button>
          );
        })}
      </div>
      <div className="hidden min-h-0 flex-1 overflow-auto scrollbar-thin md:block">
        <table className="w-full table-fixed border-separate border-spacing-0 text-left">
          <thead className="glass-bar sticky top-0 z-10">
            <tr className="text-[11px] font-medium uppercase tracking-wide text-fg-subtle">
              {columns.map((column) => {
                const active = sort === column.sort;
                const selected = column.filter ? splitList(filters[column.filter]) : [];
                return (
                  <th key={column.id} className={cn("relative px-2.5 py-2 font-medium", columnWidth(column.id))}>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => onSort(column.sort)}
                        className="inline-flex min-w-0 items-center gap-0.5 truncate transition-colors duration-150 hover:text-fg"
                      >
                        {column.label}
                        {active ? (
                          dir === "asc" ? (
                            <ChevronUp className="size-3" />
                          ) : (
                            <ChevronDown className="size-3" />
                          )
                        ) : null}
                      </button>
                      {column.filter ? (
                        <button
                          type="button"
                          data-filter-trigger
                          aria-expanded={openFilter === column.id}
                          aria-label={`Фильтр ${column.label}`}
                          onClick={(event) => {
                            const rect = event.currentTarget.getBoundingClientRect();
                            setFilterBox({ top: rect.bottom + 6, left: rect.left });
                            setOpenFilter((value) => (value === column.id ? null : column.id));
                          }}
                          className={cn(
                            "grid size-6 place-items-center rounded-md text-fg-muted transition-colors hover:bg-white/15 hover:text-fg",
                            selected.length && "neon-dots text-sky-200",
                          )}
                        >
                          <MoreHorizontal className="size-4" />
                        </button>
                      ) : null}
                    </div>
                    {column.filter && openFilter === column.id
                      ? createPortal(
                          <ValueFilter
                            top={filterBox.top}
                            left={filterBox.left}
                            values={uniqueColumnValues(source, column.filter)}
                            selected={selected}
                            onToggle={(value) => {
                              const all = uniqueColumnValues(source, column.filter!);
                              const chosen = selected.length === 0 ? all : selected;
                              const next = chosen.includes(value)
                                ? chosen.filter((item) => item !== value)
                                : [...chosen, value];
                              onFilter(
                                column.filter!,
                                next.length === 0 || next.length === all.length ? "" : next.join(","),
                              );
                            }}
                          />,
                          document.body,
                        )
                      : null}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {tasks.map((task) => {
              const key = String(task.id);
              return (
                <tr
                  key={task.id}
                  onClick={() => onOpen(task)}
                  className={cn(
                    "cursor-pointer border-t border-white/20 text-[13px] transition-colors duration-150",
                    "hover:bg-white/35",
                    selectedKey.split(",").includes(key) && "bg-white/40",
                  )}
                >
                  {columns.map((column) => (
                    <td key={column.id} className="overflow-hidden px-2.5 py-1.5 align-middle">
                      <Cell column={column.id} task={task} />
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ValueFilter({
  top,
  left,
  values,
  selected,
  onToggle,
}: {
  top: number;
  left: number;
  values: string[];
  selected: string[];
  onToggle: (value: string) => void;
}) {
  const allOn = selected.length === 0;
  return (
    <div
      data-filter-popover
      className="glass-strong fixed z-[80] max-h-64 w-56 overflow-auto rounded-md p-1 text-left normal-case shadow-2xl scrollbar-thin"
      style={{ top, left: Math.min(left, window.innerWidth - 232) }}
    >
      {values.map((value) => {
        const on = allOn || selected.includes(value);
        return (
          <button
            key={value}
            type="button"
            onClick={() => onToggle(value)}
            className="flex h-8 w-full items-center gap-2 rounded-md px-2 text-xs text-fg hover:bg-white/10"
          >
            <span
              className={cn(
                "grid size-3.5 shrink-0 place-items-center rounded-[4px] border",
                on ? "border-sky-300 bg-sky-400/80 text-white" : "border-white/35",
              )}
            >
              {on ? <Check className="size-2.5" /> : null}
            </span>
            <span className="truncate">{value}</span>
          </button>
        );
      })}
    </div>
  );
}

function columnWidth(id: string) {
  if (id === "id") return "w-[7.75rem]";
  if (id === "title") return "w-auto";
  if (id === "sp") return "w-12";
  if (id === "status" || id === "type" || id === "priority" || id === "updated") return "w-[6.75rem]";
  return "w-[8.5rem]";
}

function Cell({ column, task }: { column: string; task: Task }) {
  if (column === "id") {
    return (
      <span className="inline-flex items-center gap-1.5">
        <span className="font-mono text-xs tabular-nums text-fg-subtle">{taskRef(task)}</span>
        <TaskLinkButtons task={task} />
      </span>
    );
  }
  if (column === "title") {
    return (
      <p className="max-w-md truncate font-medium" title={displayTitle(task.title)}>
        {displayTitle(task.title)}
      </p>
    );
  }
  if (column === "status") {
    return task.status ? <Chip color={task.status.color}>{task.status.value}</Chip> : <span>—</span>;
  }
  if (column === "type") {
    return task.type ? <Chip color={task.type.color}>{task.type.value}</Chip> : <span>—</span>;
  }
  if (column === "priority") {
    return task.priority ? <Chip color={task.priority.color}>{task.priority.value}</Chip> : <span>—</span>;
  }
  if (column === "client") {
    const label = task.clients.map((client) => client.value).join(", ") || "—";
    return (
      <span className="block max-w-[12rem] truncate text-fg-muted" title={label}>
        {label}
      </span>
    );
  }
  if (column === "assignee") {
    const name = task.assignees[0]?.value;
    return (
      <span className="flex items-center gap-1.5">
        {name ? <Avatar name={name} /> : null}
        <span className="max-w-[9rem] truncate text-fg-muted">{name ?? "—"}</span>
      </span>
    );
  }
  if (column === "sp") {
    const sp = totalSp(task);
    return <span className="tabular-nums text-fg-muted">{sp || "—"}</span>;
  }
  return <span className="whitespace-nowrap text-fg-subtle">{formatDate(task.updated)}</span>;
}

function uniqueColumnValues(tasks: Task[], key: FilterKey) {
  const values = new Set<string>();
  for (const task of tasks) {
    if (key === "status" && task.status?.value) values.add(task.status.value);
    if (key === "type" && task.type?.value) values.add(task.type.value);
    if (key === "priority" && task.priority?.value) values.add(task.priority.value.replace(/\s+$/, ""));
    if (key === "client") task.clients.forEach((client) => values.add(client.value));
    if (key === "who") task.assignees.forEach((person) => values.add(person.value));
  }
  return [...values].sort((a, b) => a.localeCompare(b, "ru"));
}
