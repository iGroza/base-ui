"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { keepPreviousData, useMutation, useQueries, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Columns3,
  List,
  Building2,
  Users,
  Plus,
  Bookmark,
  FilterX,
  Search,
  Settings2,
  RefreshCw,
  ChevronDown,
  History,
  PanelLeftClose,
  PanelLeftOpen,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { HoverFab } from "@/components/hover-fab";
import { KanbanBoard } from "@/components/kanban";
import { TaskTable } from "@/components/task-list";
import { TaskDetail } from "@/components/task-detail";
import { TaskWindows } from "@/components/task-window";
import { ClientsView, TeamView } from "@/components/directory";
import { CreateTaskDialog, SettingsDialog, TokenGate } from "@/components/settings-dialog";
import { SaveBoardControl, SavedBoardsView } from "@/components/saved-boards";
import { MenuSelect } from "@/components/ui/menu-select";
import {
  createTaskRow,
  type CreateTaskInput,
  fetchAccount,
  fetchOneTask,
  fetchRetailers,
  fetchTasks,
  fetchTeam,
  publishTaskComment,
  uploadTaskAssets,
  updateTaskFields,
} from "@/lib/baserow/client";
import { totalSp } from "@/lib/baserow/normalize";
import { F, PRIORITIES, STATUSES, TYPES } from "@/lib/baserow/schema";
import { makeLocalTask, mergeLocalTasks, useAppStore, type AppView } from "@/lib/store";
import type { BaseAccount, Task, TasksPayload } from "@/lib/baserow/types";
import { sceneById, SCENES, type SceneId } from "@/lib/scenes";
import { splitList, type DashSearch, type SortKey } from "@/lib/query";
import { boardFromDash, readBoards, writeBoards, type SavedBoard } from "@/lib/saved-boards";
import { taskIdFromBaseLink } from "@/lib/base-link";
import { taskKey } from "@/lib/task-links";
import { cn, displayTitle } from "@/lib/utils";

const NAV_KEY = "base-ui-nav";

const NAV: { id: AppView; label: string; icon: typeof Columns3 }[] = [
  { id: "board", label: "Доска", icon: Columns3 },
  { id: "list", label: "Список", icon: List },
  { id: "saved", label: "Подборки", icon: Bookmark },
  { id: "clients", label: "Клиенты", icon: Building2 },
  { id: "team", label: "Команда", icon: Users },
];

export function App({
  dash,
  setDash,
}: {
  dash: DashSearch;
  setDash: (patch: Partial<DashSearch>) => void;
}) {
  const store = useAppStore();
  const queryClient = useQueryClient();
  const [boards, setBoards] = useState<SavedBoard[]>([]);
  const [recent, setRecent] = useState<{ key: string; title: string }[]>([]);
  const [focusRequest, setFocusRequest] = useState<{ key: string; tick: number } | null>(null);
  const [draftSearch, setDraftSearch] = useState(dash.q);
  const [navCompact, setNavCompact] = useState(false);
  const [commentSaving, setCommentSaving] = useState(false);
  const [assetUploading, setAssetUploading] = useState(false);
  const scene = sceneById(dash.scene || store.scene);

  useEffect(() => {
    useAppStore.getState().hydrate();
    setBoards(readBoards());
    setRecent(readRecent());
    setNavCompact(window.localStorage.getItem(NAV_KEY) === "compact");
  }, []);

  useEffect(() => {
    setDraftSearch(dash.q);
  }, [dash.q]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const next = draftSearch.trim();
      const taskFromLink = taskIdFromBaseLink(next);
      if (taskFromLink) {
        const task = [...splitList(dash.task).filter((item) => item !== taskFromLink), taskFromLink].join(",");
        setDraftSearch("");
        setDash({
          q: "",
          view: dash.view === "board" || dash.view === "list" ? dash.view : "list",
          task,
        });
        requestFocus(taskFromLink);
        return;
      }
      if (next === dash.q) return;
      setDash(next ? { q: next, view: "list" } : { q: "" });
    }, 280);
    return () => window.clearTimeout(timer);
  }, [draftSearch, dash.q, dash.task, dash.view, setDash]);

  useEffect(() => {
    document.documentElement.dataset.tone = scene.tone;
  }, [scene.tone]);

  const accountQuery = useQuery({
    queryKey: ["account"],
    queryFn: () => fetchAccount(),
    enabled: store.hydrated,
    staleTime: 60_000,
    refetchInterval: 60_000,
    refetchIntervalInBackground: true,
  });
  const unlocked = accountQuery.data?.connected === true;

  const tasksQuery = useQuery({
    queryKey: ["tasks", dash.q, dash.who, dash.client],
    queryFn: () =>
      fetchTasks({
        query: dash.q || undefined,
        assignee: dash.who || undefined,
        client: dash.client || undefined,
      }),
    enabled: store.hydrated && unlocked,
    placeholderData: keepPreviousData,
    refetchInterval: 60_000,
    refetchIntervalInBackground: true,
  });

  const retailersQuery = useQuery({
    queryKey: ["retailers"],
    queryFn: () => fetchRetailers(),
    enabled: store.hydrated && unlocked,
    staleTime: 60_000,
    refetchInterval: 60_000,
    refetchIntervalInBackground: true,
  });

  const teamQuery = useQuery({
    queryKey: ["team"],
    queryFn: () => fetchTeam(),
    enabled: store.hydrated && unlocked,
    staleTime: 60_000,
    refetchInterval: 60_000,
    refetchIntervalInBackground: true,
  });

  const payload = tasksQuery.data;
  const remoteTasks = payload?.tasks ?? [];
  const synced = payload?.source === "token" && !payload.error;
  const tasks = mergeLocalTasks(remoteTasks, store.localAdds, store.localPatches);
  const canEdit = true;

  const filtered = useMemo(
    () => filterTasks(tasks, dash, payload?.query ?? "", payload?.scope ?? "recent"),
    [tasks, dash, payload?.query, payload?.scope],
  );
  const sorted = useMemo(
    () => sortRows(filtered, dash.sort, dash.dir),
    [filtered, dash.sort, dash.dir],
  );
  const openKeys = splitList(dash.task);
  const missingKeys = openKeys.filter((key) => !findTask(tasks, key));
  const missingQueries = useQueries({
    queries: missingKeys.map((key) => ({
      queryKey: ["one-task", key],
      queryFn: () => fetchOneTask(key),
      enabled: store.hydrated && unlocked,
      refetchInterval: 60_000,
      refetchIntervalInBackground: true,
    })),
  });
  const opened = openKeys
    .map((key) => findTask(tasks, key) ?? missingQueries.find((query) => query.data?.task && taskKeyOf(query.data.task) === key)?.data?.task ?? null)
    .filter((task): task is Task => task != null);

  function requestFocus(key: string) {
    setFocusRequest((current) => ({ key, tick: (current?.tick ?? 0) + 1 }));
  }

  function openTask(task: Task) {
    const key = taskKeyOf(task);
    const next = [...openKeys.filter((item) => item !== key), key];
    setDash({ task: next.join(",") });
    requestFocus(key);
    rememberRecent(setRecent, { key, title: displayTitle(task.title) });
  }

  function openRecent(key: string) {
    const known = findTask(tasks, key);
    if (known) {
      openTask(known);
      return;
    }
    setDash({ task: [...openKeys.filter((item) => item !== key), key].join(",") });
    requestFocus(key);
  }

  function closeTask(key: string) {
    setDash({ task: openKeys.filter((item) => item !== key).join(",") });
  }

  function closeAllTasks() {
    setDash({ task: "" });
  }

  function onSort(sort: SortKey) {
    setDash({
      sort,
      dir: dash.sort === sort && dash.dir === "desc" ? "asc" : "desc",
    });
  }

  const assignees = useMemo(() => {
    const fromTeam = (teamQuery.data?.team ?? []).map((person) => person.name.trim()).filter(Boolean);
    if (fromTeam.length) {
      return [...new Set(fromTeam)].sort((a, b) => a.localeCompare(b, "ru"));
    }
    return uniqueNames(tasks, (t) => t.assignees);
  }, [teamQuery.data?.team, tasks]);
  const clients = useMemo(() => {
    const fromBase = (retailersQuery.data?.retailers ?? [])
      .map((retailer) => retailer.name.trim())
      .filter(Boolean);
    if (fromBase.length) {
      return [...new Set(fromBase)].sort((a, b) => a.localeCompare(b, "ru"));
    }
    return uniqueNames(tasks, (t) => t.clients);
  }, [retailersQuery.data?.retailers, tasks]);
  const types = useMemo(
    () => [...new Set(tasks.map((t) => t.type?.value).filter(Boolean))] as string[],
    [tasks],
  );

  const updateMutation = useMutation({
    mutationFn: (input: { id: number; fields: Record<string, unknown> }) =>
      updateTaskFields({ id: input.id, fields: input.fields }),
    onSuccess: (result) => {
      if (result.task && !result.error) void queryClient.invalidateQueries({ queryKey: ["tasks"] });
    },
  });

  const createMutation = useMutation({
    mutationFn: (input: CreateTaskInput) => createTaskRow(input),
    onSuccess: (result) => {
      if (result.error || !result.task) {
        toast.error(result.error ?? "Не создалось в Base — задача осталась локально");
        return;
      }
      toast.success("Задача в Base");
      store.setCreateOpen(false);
      store.setSelectedId(result.task.id);
      void queryClient.invalidateQueries({ queryKey: ["tasks"] });
    },
  });

  function moveTask(taskId: number, status: string) {
    const option = STATUSES.find((item) => item.value === status);
    if (!option) return;
    store.patchTask(taskId, {
      status: { id: option.id, value: option.value, color: option.color },
    });
    if (!synced) {
      toast.success("Перемещено на этом устройстве");
      return;
    }
    if (taskId < 0) return;
    updateMutation.mutate(
      { id: taskId, fields: { [F.status]: option.id } },
      {
        onSuccess: (result) => {
          if (result.error || !result.task) {
            toast.error(result.error ?? "Не сохранилось в Base — оставлено на устройстве");
            return;
          }
          queryClient.setQueriesData<TasksPayload>({ queryKey: ["tasks"] }, (cached) =>
            cached
              ? { ...cached, tasks: cached.tasks.map((task) => (task.id === taskId ? result.task! : task)) }
              : cached,
          );
          store.clearTaskPatchFields(taskId, ["status"]);
          toast.success("Сохранено в Base");
        },
      },
    );
  }

  async function saveTask(
    id: number,
    input: {
      fields: Record<string, unknown>;
      patch: Partial<Task>;
      commentEntry?: string;
      commentNote?: string;
    },
  ) {
    const current = tasks.find((item) => item.id === id);
    const commentOnly =
      Object.keys(input.fields).length === 1 &&
      typeof input.fields[F.clientComments] === "string";
    if (!synced) {
      store.patchTask(id, input.patch);
      toast.success("Сохранено на этом устройстве");
      return true;
    }
    if (id < 0) return true;
    if (commentOnly) {
      queryClient.setQueriesData<TasksPayload>({ queryKey: ["tasks"] }, (cached) =>
        cached
          ? { ...cached, tasks: cached.tasks.map((task) => (task.id === id ? { ...task, ...input.patch } : task)) }
          : cached,
      );
      setCommentSaving(true);
      try {
        if (!input.commentEntry) {
          const result = await updateMutation.mutateAsync({ id, fields: input.fields });
          if (result.error || !result.task) {
            queryClient.setQueriesData<TasksPayload>({ queryKey: ["tasks"] }, (cached) =>
              cached
                ? { ...cached, tasks: cached.tasks.map((task) => (task.id === id ? current ?? task : task)) }
                : cached,
            );
            toast.error(result.error ?? "Не сохранилось в Base");
            return false;
          }
          queryClient.setQueriesData<TasksPayload>({ queryKey: ["tasks"] }, (cached) =>
            cached
              ? { ...cached, tasks: cached.tasks.map((task) => (task.id === id ? result.task! : task)) }
              : cached,
          );
          store.clearTaskPatchFields(id, ["clientComments"]);
          toast.success("Комментарий удалён из Base");
          void queryClient.invalidateQueries({ queryKey: ["tasks"] });
          return true;
        }
        const published = await publishTaskComment({
          id,
          next: String(input.fields[F.clientComments]),
          entry: input.commentEntry ?? "",
          note: input.commentNote ?? input.commentEntry ?? "",
          solution: current?.solution ?? "",
        });
        if (!published.ok) {
          queryClient.setQueriesData<TasksPayload>({ queryKey: ["tasks"] }, (cached) =>
            cached
              ? { ...cached, tasks: cached.tasks.map((task) => (task.id === id ? current ?? task : task)) }
              : cached,
          );
          toast.error(published.error);
          return false;
        }
        queryClient.setQueriesData<TasksPayload>({ queryKey: ["tasks"] }, (cached) =>
          cached
            ? {
                ...cached,
                tasks: cached.tasks.map((task) => (task.id === id ? { ...task, ...published.patch } : task)),
              }
            : cached,
        );
        store.clearTaskPatchFields(id, ["clientComments", "solution"]);
        toast.success(published.notice);
        void queryClient.invalidateQueries({ queryKey: ["tasks"] });
        return true;
      } finally {
        setCommentSaving(false);
      }
    }
    store.patchTask(id, input.patch);
    const result = await updateMutation.mutateAsync({ id, fields: input.fields });
    if (result.error || !result.task) {
      toast.error(result.error ?? "Не сохранилось в Base — оставлено на устройстве");
      return false;
    }
    queryClient.setQueriesData<TasksPayload>({ queryKey: ["tasks"] }, (cached) =>
      cached
        ? { ...cached, tasks: cached.tasks.map((task) => (task.id === id ? result.task! : task)) }
        : cached,
    );
    store.clearTaskPatchFields(id, Object.keys(input.patch) as (keyof Task)[]);
    toast.success("Сохранено в Base");
    return true;
  }

  async function uploadAssets(task: Task, files: File[]) {
    if (!synced) {
      toast.error("Для загрузки ассетов подключите Base");
      return false;
    }
    if (task.id < 0) {
      toast.error("Сначала сохраните задачу в Base");
      return false;
    }
    setAssetUploading(true);
    try {
      const result = await uploadTaskAssets({ id: task.id, files, existing: task.refs });
      if (result.error || !result.task) {
        toast.error(result.error ?? "Не удалось загрузить ассеты");
        return false;
      }
      const patch = { refs: result.task.refs };
      queryClient.setQueriesData<TasksPayload>({ queryKey: ["tasks"] }, (cached) =>
        cached
          ? { ...cached, tasks: cached.tasks.map((item) => (item.id === task.id ? { ...item, ...patch } : item)) }
          : cached,
      );
      store.patchTask(task.id, patch);
      store.clearTaskPatchFields(task.id, ["refs"]);
      toast.success(files.length === 1 ? "Ассет загружен в Base" : "Ассеты загружены в Base");
      void queryClient.invalidateQueries({ queryKey: ["tasks"] });
      return true;
    } finally {
      setAssetUploading(false);
    }
  }

  function createTask(input: CreateTaskInput) {
    if (!synced) {
      const status = STATUSES.find((item) => item.id === input.statusId);
      const type = TYPES.find((item) => item.id === input.typeId);
      const priority = PRIORITIES.find((item) => item.id === input.priorityId);
      const people = (teamQuery.data?.team ?? []).map((person) => ({ id: person.id, name: person.name }));
      const clientCatalog = (retailersQuery.data?.retailers ?? []).map((retailer) => ({
        id: retailer.id,
        name: retailer.name,
      }));
      const link = (ids: number[] | undefined, catalog: { id: number; name: string }[]) =>
        (ids ?? []).map((id) => ({ id, value: catalog.find((item) => item.id === id)?.name ?? "" }));
      store.addLocalTask(
        makeLocalTask(input.title, input.story ?? "", {
          ...(status ? { status: { id: status.id, value: status.value, color: status.color } } : {}),
          type: type ? { id: type.id, value: type.value, color: "" } : null,
          priority: priority ? { id: priority.id, value: priority.value, color: "" } : null,
          assignees: link(input.assigneeIds, people),
          requesters: link(input.requesterIds, people),
          clients: link(input.clientIds, clientCatalog),
          beSp: input.be ?? null,
          mbSp: input.mb ?? null,
          uiSp: input.ui ?? null,
          spentSp: input.spent ?? null,
          impact: input.impact ?? null,
          eta: input.eta || null,
        }),
      );
      toast.success("Задача создана на этом устройстве");
      store.setCreateOpen(false);
      return;
    }
    createMutation.mutate(input);
  }

  const taskSurface = dash.view === "board" || dash.view === "list";
  const openCount = filtered.filter(
    (task) => task.status?.value !== "Done" && task.status?.value !== "Отменен",
  ).length;

  const locked = !unlocked;

  return (
    <>
    <div
      className={cn("fixed inset-0 flex flex-col overflow-hidden", locked && "pointer-events-none")}
      inert={locked}
    >
      <div className="ambient" data-scene={scene.id} aria-hidden="true">
        <img src={scene.image} alt="" className="ambient-photo" />
        <div className="ambient-light" />
        <div className="ambient-veil" />
      </div>

      <div className="relative z-10 flex min-h-0 flex-1 overflow-hidden lg:flex-row">
        <aside
          className={cn(
            "nav-shell hidden shrink-0 flex-col p-3 lg:flex",
            navCompact ? "w-[84px]" : "w-[240px]",
          )}
        >
          <div className="glass flex h-full min-h-0 flex-col overflow-hidden rounded-[10px] p-2">
            <div
              className={cn(
                "flex items-center pt-2 pb-3",
                navCompact ? "justify-center" : "justify-between px-2",
              )}
            >
              <h1
                className={cn(
                  "nav-label font-display text-2xl font-semibold tracking-tight",
                  navCompact ? "max-w-0 opacity-0" : "max-w-32 opacity-100",
                )}
              >
                Base
              </h1>
              <button
                type="button"
                className="icon-btn"
                aria-label={navCompact ? "Развернуть меню" : "Свернуть меню"}
                title={navCompact ? "Развернуть меню" : "Свернуть меню"}
                onClick={() =>
                  setNavCompact((value) => {
                    const next = !value;
                    window.localStorage.setItem(NAV_KEY, next ? "compact" : "wide");
                    return next;
                  })
                }
              >
                {navCompact ? <PanelLeftOpen className="size-4" /> : <PanelLeftClose className="size-4" />}
              </button>
            </div>
            <nav className="flex flex-col gap-1">
              {NAV.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  title={item.label}
                  aria-label={item.label}
                  onClick={() => setDash({ view: item.id })}
                  className={cn(
                    "nav-item flex h-11 items-center rounded-md text-sm font-medium",
                    navCompact ? "justify-center px-0" : "gap-3 px-3",
                    dash.view === item.id ? "nav-item-active" : "text-fg-muted",
                  )}
                >
                  <item.icon className="size-4 shrink-0" />
                  <span className={cn("nav-label", navCompact ? "max-w-0 opacity-0" : "max-w-40 opacity-100")}>
                    {item.label}
                  </span>
                </button>
              ))}
            </nav>
            <div className={cn("mt-auto min-w-0 pt-4 pb-1", navCompact ? "px-0" : "space-y-2.5 px-1.5")}>
              <ScenePicker
                compact={navCompact}
                scene={scene.id}
                onChange={(next) => {
                  store.setScene(next);
                  setDash({ scene: next });
                }}
              />
              <div
                className={cn(
                  "nav-label",
                  navCompact ? "mt-0 max-h-0 max-w-0 opacity-0" : "mt-2.5 max-h-24 max-w-full opacity-100",
                )}
              >
                <AccountCard account={accountQuery.data} />
                <p className="mt-2 line-clamp-2 px-1 text-[11px] leading-relaxed text-fg-subtle">
                  {boardCaption(payload, filtered.length, openCount, synced)}
                </p>
                {payload?.error ? <p className="px-1 text-xs text-danger">{payload.error}</p> : null}
              </div>
            </div>
          </div>
        </aside>

        <main className="flex min-h-0 min-w-0 flex-1 flex-col px-3 pt-3 pb-24 lg:py-3 lg:pr-3 lg:pl-0">
          <header className="glass mb-3 min-w-0 rounded-[10px] p-2.5">
            <div className="flex min-w-0 items-center gap-2">
              <div className="relative min-w-0 flex-1">
                <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-fg-subtle" />
                <input
                  value={draftSearch}
                  onChange={(e) => setDraftSearch(e.target.value)}
                  placeholder="Поиск по задаче, клиенту, человеку"
                  className="neon-search glass-input h-9 w-full rounded-[10px] pr-9 pl-9 text-[13px]"
                  suppressHydrationWarning
                />
                {draftSearch ? (
                  <button
                    type="button"
                    aria-label="Очистить поиск"
                    onClick={() => {
                      setDraftSearch("");
                      setDash({ q: "" });
                    }}
                    className="absolute top-1/2 right-2 grid size-6 -translate-y-1/2 place-items-center rounded-md text-fg-subtle hover:bg-white/40 hover:text-fg"
                  >
                    <X className="size-3.5" />
                  </button>
                ) : null}
              </div>
              <button
                type="button"
                onClick={() => void tasksQuery.refetch()}
                className="icon-btn"
                aria-label="Обновить"
              >
                <RefreshCw className={cn("size-4", tasksQuery.isFetching && "animate-spin")} />
              </button>
              <button
                type="button"
                onClick={() => store.setSettingsOpen(true)}
                className="icon-btn"
                aria-label="Настройки"
              >
                <Settings2 className="size-4" />
              </button>
              <button
                type="button"
                onClick={() => store.setCreateOpen(true)}
                className="neon-accent flex h-9 items-center gap-2 rounded-[10px] bg-accent px-3 text-[13px] font-semibold text-accent-fg"
              >
                <Plus className="size-4" />
                <span className="hidden sm:inline">Задача</span>
              </button>
            </div>
            <div className="mt-2 flex h-9 items-center gap-1.5 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              <MenuSelect
                value={dash.type || "all"}
                onChange={(value) => setDash({ type: value === "all" ? "" : value })}
                options={types.map(toOption)}
                placeholder="Тип"
                emptyLabel="Все типы"
                className="toolbar-control w-[7.5rem] shrink-0"
              />
              <MenuSelect
                value={dash.priority || "all"}
                onChange={(value) => setDash({ priority: value === "all" ? "" : value })}
                options={["Must", "Should", "Could", "Would"].map(toOption)}
                placeholder="Приоритет"
                emptyLabel="Любой"
                className="toolbar-control w-[8.5rem] shrink-0"
              />
              <MenuSelect
                value={dash.client || "all"}
                onChange={(value) => setDash({ client: value === "all" ? "" : value })}
                options={clients.map(toOption)}
                placeholder="Клиент"
                emptyLabel="Все клиенты"
                className="toolbar-control w-36 shrink-0"
              />
              <MenuSelect
                value={dash.who || "all"}
                onChange={(value) => setDash({ who: value === "all" ? "" : value })}
                options={assignees.map(toOption)}
                placeholder="Ответственный"
                emptyLabel="Все"
                className="toolbar-control w-44 shrink-0"
              />
              <div className="ml-auto flex shrink-0 items-center gap-1.5 pl-1.5">
                <ActiveFilters dash={dash} setDash={setDash} />
                <button
                  type="button"
                  disabled={!hasActiveFilters(dash)}
                  onClick={() => {
                    setDraftSearch("");
                    setDash({ q: "", type: "", priority: "", who: "", client: "", status: "" });
                  }}
                  className="toolbar-control inline-flex shrink-0 items-center gap-1.5 px-3 text-fg disabled:opacity-40"
                >
                  <FilterX className="size-3.5" />
                  Сбросить
                </button>
                <SaveBoardControl
                  onSave={(name) => {
                    const next = [boardFromDash(name, dash), ...boards];
                    writeBoards(next);
                    setBoards(next);
                    toast.success("Подборка сохранена");
                  }}
                />
              </div>
            </div>
          </header>

          <div className="flex min-h-0 min-w-0 flex-1 gap-3">
            <section className="min-h-0 min-w-0 flex-1">
              {taskSurface && tasksQuery.isPending && remoteTasks.length === 0 && store.localAdds.length === 0 ? (
                <SkeletonBoard />
              ) : taskSurface && payload?.error && remoteTasks.length === 0 && store.localAdds.length === 0 ? (
                <div className="glass grid h-full place-items-center rounded-[10px] p-8 text-center">
                  <p className="max-w-sm text-sm text-fg-muted">{payload.error}</p>
                  <button
                    type="button"
                    className="mt-4 h-11 rounded-md bg-accent px-5 text-sm font-semibold text-accent-fg"
                    onClick={() => void tasksQuery.refetch()}
                  >
                    Повторить
                  </button>
                </div>
              ) : taskSurface && tasksQuery.isFetching && filtered.length === 0 ? (
                <SearchingBoard />
              ) : filtered.length === 0 &&
                (dash.view === "board" || dash.view === "list") ? (
                <EmptyBoard />
              ) : dash.view === "board" ? (
                <KanbanBoard
                  tasks={sorted}
                  selectedId={opened[opened.length - 1]?.id ?? null}
                  onOpen={(id) => {
                    const task = sorted.find((item) => item.id === id);
                    if (task) openTask(task);
                  }}
                  canEdit={canEdit}
                  onMove={moveTask}
                />
              ) : dash.view === "list" ? (
                <TaskTable
                  tasks={sorted}
                  source={tasks}
                  selectedKey={dash.task}
                  onOpen={openTask}
                  sort={dash.sort}
                  dir={dash.dir}
                  onSort={onSort}
                  filters={{
                    status: dash.status,
                    type: dash.type,
                    priority: dash.priority,
                    client: dash.client,
                    who: dash.who,
                  }}
                  onFilter={(key, value) => setDash({ [key]: value })}
                  cols={dash.cols}
                  onCols={(cols) => setDash({ cols })}
                />
              ) : dash.view === "saved" ? (
                <SavedBoardsView
                  boards={boards}
                  onOpen={(board) =>
                    setDash({
                      view: board.view === "search" ? "list" : board.view,
                      q: board.q,
                      type: board.type,
                      priority: board.priority,
                      who: board.who,
                      client: board.client,
                      status: board.status,
                      sort: board.sort,
                      dir: board.dir,
                      cols: board.cols,
                    })
                  }
                  onDelete={(id) => {
                    const next = boards.filter((board) => board.id !== id);
                    writeBoards(next);
                    setBoards(next);
                  }}
                />
              ) : dash.view === "clients" ? (
                <ClientsView
                  retailers={retailersQuery.data?.retailers ?? []}
                  tasks={sorted}
                  onOpenClient={(name) => setDash({ view: "list", client: name })}
                />
              ) : (
                <TeamView
                  team={teamQuery.data?.team ?? []}
                  tasks={sorted}
                  onOpenPerson={(name) => setDash({ view: "list", who: name })}
                />
              )}
            </section>

            <TaskWindows
              focusRequest={focusRequest}
              items={opened.map((task) => ({
                key: taskKeyOf(task),
                title: displayTitle(task.title),
                sharedNumber: tasks.some(
                  (other) => other.id !== task.id && other.incrId != null && other.incrId === task.incrId,
                ),
                task,
              }))}
              onClose={closeTask}
              onCloseAll={closeAllTasks}
              render={(key) => {
                const task = opened.find((item) => taskKeyOf(item) === key);
                if (!task) return null;
                return (
                  <TaskDetail
                    task={task}
                    canEdit={canEdit}
                    saving={(updateMutation.isPending || commentSaving) && synced}
                    uploadingAssets={assetUploading}
                    people={(teamQuery.data?.team ?? []).map((person) => ({
                      id: person.id,
                      name: person.name,
                    }))}
                    clients={(retailersQuery.data?.retailers ?? []).map((retailer) => ({
                      id: retailer.id,
                      name: retailer.name,
                    }))}
                    onSave={(input) => saveTask(task.id, input)}
                    onUploadAssets={(files) => uploadAssets(task, files)}
                  />
                );
              }}
            />
          </div>
        </main>
      </div>

      <RecentFab items={recent} onOpen={openRecent} />

      <nav className="glass-strong fixed right-3 bottom-[max(0.75rem,env(safe-area-inset-bottom))] left-3 z-20 flex h-14 items-center justify-around rounded-md px-2 lg:hidden">
        {NAV.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setDash({ view: item.id })}
            className={cn(
              "flex min-w-12 flex-col items-center gap-0.5 text-[10px] font-medium",
              dash.view === item.id ? "text-fg" : "text-fg-subtle",
            )}
          >
            <item.icon className="size-4" />
            {item.label}
          </button>
        ))}
      </nav>

      {store.settingsOpen ? (
        <SettingsDialog
          hint={accountQuery.data?.hint}
          scene={scene.id}
          onScene={(next) => {
            store.setScene(next);
            setDash({ scene: next });
          }}
          onClose={() => store.setSettingsOpen(false)}
          onSaved={() => {
            void queryClient.invalidateQueries({ queryKey: ["account"] });
            void queryClient.invalidateQueries({ queryKey: ["tasks"] });
          }}
        />
      ) : null}
      {store.createOpen && unlocked ? (
        <CreateTaskDialog
          creating={createMutation.isPending}
          people={(teamQuery.data?.team ?? []).map((person) => ({ id: person.id, name: person.name }))}
          clients={(retailersQuery.data?.retailers ?? []).map((retailer) => ({
            id: retailer.id,
            name: retailer.name,
          }))}
          onClose={() => store.setCreateOpen(false)}
          onCreate={(input) => createTask(input)}
        />
      ) : null}
    </div>
    {locked ? (
      <TokenGate
        pending={!accountQuery.data && (accountQuery.isPending || accountQuery.isFetching)}
        error={accountQuery.error instanceof Error ? accountQuery.error.message : undefined}
        onSaved={(result) => {
          queryClient.setQueryData(["account"], result);
          void queryClient.invalidateQueries({ queryKey: ["tasks"] });
        }}
      />
    ) : null}
    </>
  );
}

function toOption(value: string) {
  return { value, label: value };
}

function ScenePicker({
  scene,
  compact,
  onChange,
}: {
  scene: SceneId;
  compact: boolean;
  onChange: (scene: SceneId) => void;
}) {
  return (
    <div className={compact ? "" : "px-1"}>
      <p
        className={cn(
          "nav-label mb-2 text-[11px] font-medium uppercase tracking-[0.16em] text-fg-subtle",
          compact ? "mb-0 max-h-0 max-w-0 opacity-0" : "max-h-6 max-w-full opacity-100",
        )}
      >
        Фон
      </p>
      <div className={cn("flex gap-1.5", compact && "flex-col items-center")}>
        {SCENES.map((item) => (
          <button
            key={item.id}
            type="button"
            title={item.label}
            aria-label={item.label}
            aria-pressed={scene === item.id}
            onClick={() => onChange(item.id)}
            className={cn(
              "size-7 overflow-hidden rounded-full border border-white/70 transition-[box-shadow,transform] duration-200",
              scene === item.id && "ring-2 ring-accent ring-offset-2 ring-offset-transparent",
            )}
          >
            <img src={item.image} alt="" className="size-full object-cover" />
          </button>
        ))}
      </div>
    </div>
  );
}

function AccountCard({ account }: { account?: BaseAccount }) {
  if (!account?.connected) {
    return <p className="truncate px-1 text-[11px] text-fg-subtle">Подключите токен в настройках</p>;
  }
  return (
    <p className="truncate px-1 text-[11px] text-fg-subtle">
      {account.host}
      <span className="mx-1">·</span>
      {account.backlog.toLocaleString("ru-RU")} задач
    </p>
  );
}

function hasActiveFilters(dash: DashSearch) {
  return Boolean(dash.q || dash.who || dash.client || dash.type || dash.priority || dash.status);
}

function activeFilters(dash: DashSearch) {
  const chips: { label: string; clear: Partial<DashSearch> }[] = [];
  if (dash.q) chips.push({ label: `Поиск: ${dash.q}`, clear: { q: "" } });
  if (dash.who) chips.push({ label: dash.who, clear: { who: "" } });
  if (dash.client) chips.push({ label: dash.client, clear: { client: "" } });
  if (dash.type) chips.push({ label: dash.type, clear: { type: "" } });
  if (dash.priority) chips.push({ label: dash.priority, clear: { priority: "" } });
  for (const status of splitList(dash.status)) {
    chips.push({
      label: status,
      clear: { status: splitList(dash.status).filter((item) => item !== status).join(",") },
    });
  }
  return chips;
}

function ActiveFilters({
  dash,
  setDash,
}: {
  dash: DashSearch;
  setDash: (patch: Partial<DashSearch>) => void;
}) {
  const [open, setOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const [box, setBox] = useState({ top: 0, left: 0 });
  const chips = activeFilters(dash);

  useEffect(() => {
    if (!open) return;
    const place = () => {
      const rect = buttonRef.current?.getBoundingClientRect();
      if (!rect) return;
      const width = 280;
      setBox({
        top: rect.bottom + 6,
        left: Math.max(8, Math.min(rect.right - width, window.innerWidth - width - 8)),
      });
    };
    place();
    const onPointer = (event: PointerEvent) => {
      const target = event.target as Node;
      if (buttonRef.current?.contains(target) || panelRef.current?.contains(target)) return;
      setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", onPointer, true);
    window.addEventListener("resize", place);
    window.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointer, true);
      window.removeEventListener("resize", place);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
        className="toolbar-control inline-flex shrink-0 items-center gap-2 px-3 text-fg"
      >
        Активные фильтры
        <span className="tabular-nums text-fg-subtle">{chips.length}</span>
        <ChevronDown className={cn("size-3.5 text-fg-subtle", open && "rotate-180")} />
      </button>
      {open
        ? createPortal(
            <div
              ref={panelRef}
              className="glass-strong fixed z-[80] w-[280px] p-2"
              style={{ top: box.top, left: box.left }}
            >
              <p className="px-2 py-1 text-[11px] font-medium uppercase tracking-[0.12em] text-fg-subtle">
                Активные фильтры
              </p>
              {chips.length === 0 ? (
                <p className="px-2 py-2 text-[13px] text-fg-muted">Ничего не выбрано</p>
              ) : (
                <ul className="max-h-64 overflow-y-auto">
                  {chips.map((chip) => (
                    <li key={chip.label}>
                      <button
                        type="button"
                        onClick={() => setDash(chip.clear)}
                        className="flex h-8 w-full items-center justify-between gap-2 px-2 text-left text-[13px] hover:bg-white/10"
                      >
                        <span className="truncate">{chip.label}</span>
                        <X className="size-3.5 shrink-0 text-fg-subtle" />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>,
            document.body,
          )
        : null}
    </>
  );
}

function boardCaption(
  payload: TasksPayload | undefined,
  shown: number,
  openCount: number,
  synced: boolean,
) {
  if (!synced) return "Нет связи с Base";
  if (payload?.scope === "search") return `Поиск по всей базе · ${shown}`;
  if (payload?.scope === "filtered") return `Фильтр по всей базе · ${shown}`;
  const total = payload?.count ? ` · в базе ${payload.count}` : "";
  return `Последние изменения · ${openCount} открытых${total}`;
}

function SearchingBoard() {
  return (
    <div className="glass grid h-full place-items-center rounded-[10px] p-8 text-center">
      <p className="text-sm text-fg-muted">Ищем по всей базе…</p>
    </div>
  );
}

function EmptyBoard() {
  return (
    <div className="glass grid h-full place-items-center rounded-[10px] p-8 text-center">
      <p className="text-sm text-fg-muted">Таких задач нет</p>
    </div>
  );
}

function SkeletonBoard() {
  return (
    <div className="flex h-full gap-3 overflow-hidden">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="glass h-full w-[300px] shrink-0 rounded-[10px] p-3">
          <div className="mb-3 h-5 w-24 rounded-md bg-white/50" />
          <div className="space-y-2">
            <div className="h-28 rounded-[8px] bg-white/40" />
            <div className="h-24 rounded-[8px] bg-white/35" />
            <div className="h-32 rounded-[8px] bg-white/30" />
          </div>
        </div>
      ))}
    </div>
  );
}

function uniqueNames(tasks: Task[], pick: (task: Task) => { value: string }[]) {
  return [...new Set(tasks.flatMap((task) => pick(task).map((item) => item.value)))].sort((a, b) =>
    a.localeCompare(b, "ru"),
  );
}

const RECENT_KEY = "base-ui-recent";

function readRecent() {
  if (typeof window === "undefined") return [];
  try {
    const parsed = JSON.parse(window.localStorage.getItem(RECENT_KEY) ?? "[]") as {
      key: string;
      title: string;
    }[];
    return Array.isArray(parsed) ? parsed.filter((item) => item?.key && item?.title) : [];
  } catch {
    return [];
  }
}

function rememberRecent(
  setRecent: (value: { key: string; title: string }[]) => void,
  entry: { key: string; title: string },
) {
  const next = [entry, ...readRecent().filter((item) => item.key !== entry.key)].slice(0, 12);
  window.localStorage.setItem(RECENT_KEY, JSON.stringify(next));
  setRecent(next);
}

function RecentFab({
  items,
  onOpen,
}: {
  items: { key: string; title: string }[];
  onOpen: (key: string) => void;
}) {
  return (
    <HoverFab
      label="Недавние задачи"
      icon={<History className="size-5" />}
      className="right-4 bottom-[calc(5.5rem+env(safe-area-inset-bottom))] lg:bottom-5"
    >
      <div className="recent-stack flex w-72 flex-col-reverse gap-1">
        {items.length === 0 ? (
          <p className="task-plaque px-3 py-2 text-xs text-fg-subtle">Пока пусто</p>
        ) : (
          items.map((item, index) => (
            <button
              key={item.key}
              type="button"
              onClick={() => onOpen(item.key)}
              style={{ animationDelay: `${index * 28}ms` }}
              className="task-plaque recent-item flex h-9 w-full items-center gap-2 px-3 text-left text-xs"
            >
              <span className="shrink-0 font-mono text-fg-subtle">#{item.key}</span>
              <span className="truncate">{item.title}</span>
            </button>
          ))
        )}
      </div>
    </HoverFab>
  );
}

function taskKeyOf(task: Task) {
  return taskKey(task);
}

function findTask(tasks: Task[], key: string) {
  const byId = tasks.find((task) => String(task.id) === key);
  if (byId) return byId;
  const byNumber = tasks.filter((task) => task.incrId != null && String(task.incrId) === key);
  return byNumber.length === 1 ? byNumber[0] : null;
}

function listedMatch(selected: string, value: string | undefined) {
  const items = splitList(selected);
  if (!items.length) return true;
  return items.includes((value ?? "").replace(/\s+$/, ""));
}

function filterTasks(
  tasks: Task[],
  dash: DashSearch,
  serverQuery: string,
  scope: TasksPayload["scope"],
) {
  const q = dash.q.trim().toLowerCase();
  const serverAlreadyMatched = scope === "search" && serverQuery.trim().toLowerCase() === q && q.length > 0;
  const statuses = splitList(dash.status);
  return tasks.filter((task) => {
    if (!statuses.length && dash.view === "board") {
      if (task.status?.value === "Done" || task.status?.value === "Отменен") return false;
    } else if (statuses.length && !statuses.includes(task.status?.value ?? "")) {
      return false;
    }
    if (!listedMatch(dash.type, task.type?.value)) return false;
    if (!listedMatch(dash.priority, task.priority?.value)) return false;
    if (
      splitList(dash.client).length &&
      !task.clients.some((client) => splitList(dash.client).includes(client.value.trim()))
    ) {
      return false;
    }
    if (
      splitList(dash.who).length &&
      !task.assignees.some((person) => splitList(dash.who).includes(person.value.trim()))
    ) {
      return false;
    }
    if (!q || (serverAlreadyMatched && task.id > 0)) return true;
    const hay = [
      task.title,
      task.story,
      task.solution,
      task.incrId != null ? String(task.incrId) : "",
      ...task.clients.map((c) => c.value),
      ...task.assignees.map((a) => a.value),
      ...task.requesters.map((a) => a.value),
    ]
      .join(" ")
      .toLowerCase();
    return hay.includes(q);
  });
}

function sortRows(tasks: Task[], sort: SortKey, dir: "asc" | "desc") {
  const sign = dir === "asc" ? 1 : -1;
  const value = (task: Task) => {
    if (sort === "id") return task.incrId ?? task.id;
    if (sort === "title") return displayTitle(task.title);
    if (sort === "status") return task.status?.value ?? "";
    if (sort === "type") return task.type?.value ?? "";
    if (sort === "priority") return task.priority?.value ?? "";
    if (sort === "client") return task.clients[0]?.value ?? "";
    if (sort === "assignee") return task.assignees[0]?.value ?? "";
    if (sort === "sp") return totalSp(task);
    return task.updated ?? "";
  };
  return [...tasks].sort((a, b) => {
    const left = value(a);
    const right = value(b);
    if (typeof left === "number" && typeof right === "number") return (left - right) * sign;
    return String(left).localeCompare(String(right), "ru") * sign;
  });
}
