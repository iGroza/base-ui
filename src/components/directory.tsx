import { Chip, Avatar } from "@/components/ui/chip";
import type { Retailer, Task, Teammate } from "@/lib/baserow/types";

export function ClientsView({
  retailers,
  tasks,
  onOpenClient,
}: {
  retailers: Retailer[];
  tasks: Task[];
  onOpenClient: (name: string) => void;
}) {
  const derived = new Map<string, { id: number; name: string; count: number; open: number }>();
  for (const task of tasks) {
    for (const client of task.clients) {
      const current = derived.get(client.value) ?? {
        id: client.id,
        name: client.value,
        count: 0,
        open: 0,
      };
      current.count += 1;
      if (task.status?.value !== "Done" && task.status?.value !== "Отменен") current.open += 1;
      derived.set(client.value, current);
    }
  }

  const cards =
    retailers.length > 0
      ? retailers.map((retailer) => {
          const stats = derived.get(retailer.name);
          return {
            id: retailer.id,
            name: retailer.name,
            meta: [retailer.industry, retailer.zone, retailer.product[0]]
              .filter(Boolean)
              .join(" · "),
            count: stats?.count ?? 0,
            open: stats?.open ?? 0,
            extra: retailer.tariff != null ? `тариф ${retailer.tariff}` : null,
          };
        })
      : [...derived.values()].map((item) => ({
          id: item.id,
          name: item.name,
          meta: "из бэклога",
          count: item.count,
          open: item.open,
          extra: null as string | null,
        }));

  const sorted = cards.sort((a, b) => b.open - a.open || b.count - a.count || a.name.localeCompare(b.name, "ru"));

  return (
    <div className="grid h-full min-h-0 auto-rows-min grid-cols-1 gap-3 overflow-y-auto pb-4 scrollbar-thin sm:grid-cols-2 xl:grid-cols-3">
      {sorted.map((card) => (
        <button
          key={card.id}
          type="button"
          onClick={() => onOpenClient(card.name)}
          className="glass min-w-0 rounded-[10px] p-4 text-left transition-[transform,background-color] duration-200 ease-out hover:-translate-y-px"
        >
          <div className="flex min-w-0 items-start justify-between gap-3">
            <div className="min-w-0">
              <h3 className="truncate text-sm font-semibold">{card.name}</h3>
              <p className="mt-0.5 truncate text-xs text-fg-subtle">{card.meta || "—"}</p>
            </div>
            <Chip>{card.open} открытых</Chip>
          </div>
          <p className="mt-4 text-sm text-fg-muted">
            {card.count} задач{card.extra ? ` · ${card.extra}` : ""}
          </p>
        </button>
      ))}
      {sorted.length === 0 ? (
        <p className="col-span-full py-16 text-center text-sm text-fg-subtle">
          Клиентов в текущей выборке нет
        </p>
      ) : null}
    </div>
  );
}

export function TeamView({
  team,
  tasks,
  onOpenPerson,
}: {
  team: Teammate[];
  tasks: Task[];
  onOpenPerson: (name: string) => void;
}) {
  const load = new Map<string, { name: string; open: number; done: number }>();
  for (const task of tasks) {
    for (const person of task.assignees) {
      const current = load.get(person.value) ?? { name: person.value, open: 0, done: 0 };
      if (task.status?.value === "Done") current.done += 1;
      else current.open += 1;
      load.set(person.value, current);
    }
  }

  const people =
    team.length > 0
      ? team
      : [...load.values()].map((item) => ({
          id: item.name,
          name: item.name,
          role: null,
          squad: null,
          photo: null,
        }));

  return (
    <div className="grid h-full min-h-0 auto-rows-min grid-cols-1 gap-3 overflow-y-auto pb-4 scrollbar-thin sm:grid-cols-2 xl:grid-cols-3">
      {people.map((person) => {
        const stats = load.get(person.name);
        return (
          <button
            key={person.id}
            type="button"
            onClick={() => onOpenPerson(person.name)}
            className="glass flex min-w-0 items-center gap-3 rounded-[10px] p-3.5 text-left transition-[transform,background-color] duration-200 ease-out hover:-translate-y-px"
          >
            <Avatar name={person.name} src={person.photo} size="md" />
            <div className="min-w-0 flex-1">
              <h3 className="truncate font-semibold">{person.name}</h3>
              <p className="truncate text-xs text-fg-subtle">
                {[person.role, person.squad].filter(Boolean).join(" · ") || "участник"}
              </p>
              <p className="mt-1 text-xs text-fg-muted">
                {stats ? `${stats.open} в работе · ${stats.done} done` : "нет задач в выборке"}
              </p>
            </div>
          </button>
        );
      })}
      {people.length === 0 ? (
        <p className="col-span-full py-16 text-center text-sm text-fg-subtle">
          Команда появится после подключения токена
        </p>
      ) : null}
    </div>
  );
}
