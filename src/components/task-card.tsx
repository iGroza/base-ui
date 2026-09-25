import { Chip, Avatar } from "@/components/ui/chip";
import { totalSp } from "@/lib/baserow/normalize";
import type { Task } from "@/lib/baserow/types";
import { TaskLinkButtons } from "@/components/task-links";
import { cn, displayTitle, taskRef } from "@/lib/utils";

export function TaskCard({
  task,
  active,
  sharedNumber,
  onOpen,
  draggable,
}: {
  task: Task;
  active?: boolean;
  sharedNumber?: boolean;
  onOpen: () => void;
  draggable?: boolean;
}) {
  const cover = task.refs.find((f) => f.is_image);
  const coverUrl = cover?.thumbnails?.card_cover?.url ?? cover?.url;
  const sp = totalSp(task);

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={(event) => {
        if (event.key !== "Enter" && event.key !== " ") return;
        event.preventDefault();
        onOpen();
      }}
      draggable={draggable}
      onDragStart={(event) => {
        if (!draggable) return;
        event.dataTransfer.setData("text/task-id", String(task.id));
        event.dataTransfer.effectAllowed = "move";
      }}
      className={cn(
        "glass w-full cursor-pointer rounded-[8px] p-3 text-left transition-[transform,box-shadow] duration-200 ease-[cubic-bezier(0.22,1,0.36,1)]",
        "hover:-translate-y-0.5 hover:shadow-[0_18px_36px_-18px_rgba(32,48,78,0.38)]",
        active && "ring-2 ring-accent/50",
      )}
    >
      <div className="mb-2 flex min-w-0 items-center justify-between gap-2">
        <span className="flex shrink-0 items-center gap-0.5">
          <span className="font-mono text-[11px] tabular-nums text-fg-subtle">{taskRef(task, sharedNumber)}</span>
          <TaskLinkButtons task={task} />
        </span>
        <div className="flex min-w-0 items-center justify-end gap-1 overflow-hidden">
          {task.priority ? (
            <Chip color={task.priority.color}>{task.priority.value}</Chip>
          ) : null}
          {task.type ? <Chip color={task.type.color}>{task.type.value}</Chip> : null}
        </div>
      </div>
      <p className="line-clamp-3 text-sm font-medium leading-snug text-fg">
        {displayTitle(task.title)}
      </p>
      {coverUrl ? (
        <img
          src={coverUrl}
          alt=""
          className="mt-2 h-24 w-full rounded-md object-cover outline outline-1 -outline-offset-1 outline-black/10"
          onError={(event) => {
            event.currentTarget.style.display = "none";
          }}
        />
      ) : null}
      <div className="mt-2.5 flex flex-wrap gap-1">
        {task.clients.slice(0, 3).map((client) => (
          <Chip key={client.id}>{client.value}</Chip>
        ))}
        {task.clients.length > 3 ? <Chip>+{task.clients.length - 3}</Chip> : null}
      </div>
      <div className="mt-3 flex items-center justify-between">
        <div className="flex -space-x-1">
          {task.assignees.slice(0, 3).map((person) => (
            <Avatar key={person.id} name={person.value} />
          ))}
        </div>
        {sp > 0 ? (
          <span className="text-[11px] font-medium tabular-nums text-fg-subtle">
            {sp} SP
          </span>
        ) : null}
      </div>
    </div>
  );
}
