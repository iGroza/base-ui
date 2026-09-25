import { TaskCard } from "@/components/task-card";
import { BOARD_COLUMNS } from "@/lib/baserow/schema";
import type { Task } from "@/lib/baserow/types";
import { cn } from "@/lib/utils";

const PRIMARY = new Set<string>(BOARD_COLUMNS);

export function KanbanBoard({
  tasks,
  selectedId,
  onOpen,
  canEdit,
  onMove,
}: {
  tasks: Task[];
  selectedId: number | null;
  onOpen: (id: number) => void;
  canEdit: boolean;
  onMove: (taskId: number, status: string) => void;
}) {
  const columns: { name: string; items: Task[] }[] = BOARD_COLUMNS.map((name) => ({
    name,
    items: tasks.filter((task) => task.status?.value === name),
  }));
  const other = tasks.filter((task) => !task.status || !PRIMARY.has(task.status.value));
  const extraGroups = new Map<string, Task[]>();
  for (const task of other) {
    const key = task.status?.value ?? "Без статуса";
    extraGroups.set(key, [...(extraGroups.get(key) ?? []), task]);
  }
  const allColumns = [
    ...columns,
    ...[...extraGroups.entries()].map(([name, items]) => ({ name, items })),
  ];

  return (
    <div className="board-scroll flex h-full min-h-0 min-w-0 snap-x snap-mandatory flex-nowrap gap-3">
      {allColumns.map((column) => (
        <section
          key={column.name}
          onDragOver={(event) => {
            if (!canEdit) return;
            event.preventDefault();
          }}
          onDrop={(event) => {
            if (!canEdit) return;
            event.preventDefault();
            const id = Number(event.dataTransfer.getData("text/task-id"));
            if (Number.isFinite(id) && id > 0) onMove(id, column.name);
          }}
          className="glass flex h-full min-h-0 w-72 shrink-0 snap-start flex-col rounded-[10px] p-2"
        >
          <header className="flex items-center justify-between px-3 py-2">
            <h2 className="text-sm font-semibold tracking-tight text-fg">{column.name}</h2>
            <span className="rounded-md bg-white/50 px-2 py-0.5 text-xs tabular-nums text-fg-muted">
              {column.items.length}
            </span>
          </header>
          <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto px-1 pb-1 scrollbar-thin">
            {column.items.length === 0 ? (
              <div
                className={cn(
                  "grid h-24 place-items-center rounded-[8px] border border-dashed border-white/50 text-xs text-fg-subtle",
                )}
              >
                {canEdit ? "Перетащите карточку" : "Пусто"}
              </div>
            ) : (
              column.items.map((task) => (
                <TaskCard
                  key={task.id}
                  task={task}
                  sharedNumber={tasks.some(
                    (other) => other.id !== task.id && other.incrId != null && other.incrId === task.incrId,
                  )}
                  active={task.id === selectedId}
                  onOpen={() => onOpen(task.id)}
                  draggable={canEdit}
                />
              ))
            )}
          </div>
        </section>
      ))}
    </div>
  );
}
