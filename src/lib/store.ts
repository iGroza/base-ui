import { create } from "zustand";
import { STATUSES } from "@/lib/baserow/schema";
import type { Task } from "@/lib/baserow/types";
import { isSceneId, SCENE_STORAGE_KEY, type SceneId } from "@/lib/scenes";

export type AppView = "board" | "search" | "list" | "saved" | "clients" | "team";

const LOCAL_KEY = "base-ui-local";

type LocalBundle = {
  adds: Task[];
  patches: Record<string, Partial<Task>>;
};

function readLocal(): LocalBundle {
  if (typeof window === "undefined") return { adds: [], patches: {} };
  try {
    const raw = window.localStorage.getItem(LOCAL_KEY);
    if (!raw) return { adds: [], patches: {} };
    const parsed = JSON.parse(raw) as LocalBundle;
    return {
      adds: Array.isArray(parsed.adds) ? parsed.adds : [],
      patches: parsed.patches && typeof parsed.patches === "object" ? parsed.patches : {},
    };
  } catch {
    return { adds: [], patches: {} };
  }
}

function writeLocal(adds: Task[], patches: Record<string, Partial<Task>>) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(LOCAL_KEY, JSON.stringify({ adds, patches }));
}

export function mergeLocalTasks(
  remote: Task[],
  adds: Task[],
  patches: Record<string, Partial<Task>>,
): Task[] {
  const patched = remote.map((task) => {
    const extra = patches[String(task.id)];
    if (!extra) return task;

    // Comments are shared through Base. A previous local optimistic value must
    // never hide a newer value received from another dashboard or Base itself.
    const { clientComments: _clientComments, updated: _updated, ...fields } = extra;
    if (Object.keys(fields).length === 0) return task;
    const patch = extra.updated === undefined ? fields : { ...fields, updated: extra.updated };
    return !remoteHasCaughtUp(task, patch) ? { ...task, ...patch } : task;
  });
  const seen = new Set(patched.map((task) => task.id));
  const extras = adds
    .filter((task) => !seen.has(task.id))
    .map((task) => {
      const extra = patches[String(task.id)];
      return extra ? { ...task, ...extra } : task;
    });
  return [...extras, ...patched];
}

function remoteHasCaughtUp(task: Task, patch: Partial<Task>) {
  const remoteUpdated = Date.parse(task.updated ?? "");
  const localUpdated = Date.parse(patch.updated ?? "");
  return Number.isFinite(remoteUpdated) && Number.isFinite(localUpdated) && remoteUpdated >= localUpdated;
}

export function withoutTaskPatchFields(
  patches: Record<string, Partial<Task>>,
  id: number,
  fields: readonly (keyof Task)[],
) {
  const key = String(id);
  const current = patches[key];
  if (!current) return patches;
  const next = { ...current };
  for (const field of fields) delete next[field];
  if (Object.keys(next).length === 1 && "updated" in next) delete next.updated;
  const result = { ...patches };
  if (Object.keys(next).length) result[key] = next;
  else delete result[key];
  return result;
}

export function makeLocalTask(
  title: string,
  story: string,
  extra?: Partial<Pick<Task, "status" | "type" | "priority" | "clients" | "assignees" | "requesters" | "beSp" | "mbSp" | "uiSp" | "spentSp" | "impact" | "eta">>,
): Task {
  const todo = STATUSES.find((item) => item.value === "Todo")!;
  return {
    id: -Date.now(),
    incrId: null,
    title,
    story,
    solution: "",
    clientComments: "",
    status: { id: todo.id, value: todo.value, color: todo.color },
    type: null,
    priority: null,
    clients: [],
    assignees: [],
    requesters: [],
    sprint: [],
    beSp: null,
    mbSp: null,
    adminSp: null,
    uiSp: null,
    spentSp: null,
    guideSp: null,
    eta: null,
    created: new Date().toISOString(),
    updated: new Date().toISOString(),
    impact: null,
    ...extra,
    canLaunch: null,
    needsDecomp: null,
    refs: [],
  };
}

type AppState = {
  hydrated: boolean;
  scene: SceneId;
  view: AppView;
  search: string;
  typeFilter: string;
  priorityFilter: string;
  assigneeFilter: string;
  clientFilter: string;
  hideDone: boolean;
  selectedId: number | null;
  settingsOpen: boolean;
  createOpen: boolean;
  localAdds: Task[];
  localPatches: Record<string, Partial<Task>>;
  hydrate: () => void;
  setScene: (scene: SceneId) => void;
  setView: (view: AppView) => void;
  setSearch: (search: string) => void;
  setTypeFilter: (value: string) => void;
  setPriorityFilter: (value: string) => void;
  setAssigneeFilter: (value: string) => void;
  setClientFilter: (value: string) => void;
  setHideDone: (value: boolean) => void;
  setSelectedId: (id: number | null) => void;
  setSettingsOpen: (open: boolean) => void;
  setCreateOpen: (open: boolean) => void;
  clearFilters: () => void;
  patchTask: (id: number, patch: Partial<Task>) => void;
  clearTaskPatchFields: (id: number, fields: readonly (keyof Task)[]) => void;
  addLocalTask: (task: Task) => void;
};

export const useAppStore = create<AppState>((set, get) => ({
  hydrated: false,
  scene: "summit",
  view: "board",
  search: "",
  typeFilter: "all",
  priorityFilter: "all",
  assigneeFilter: "all",
  clientFilter: "all",
  hideDone: true,
  selectedId: null,
  settingsOpen: false,
  createOpen: false,
  localAdds: [],
  localPatches: {},
  hydrate: () => {
    if (typeof window === "undefined") return;
    const local = readLocal();
    const savedScene = window.localStorage.getItem(SCENE_STORAGE_KEY);
    set({
      hydrated: true,
      scene: isSceneId(savedScene) ? savedScene : "summit",
      localAdds: local.adds,
      localPatches: local.patches,
    });
  },
  setScene: (scene) => {
    if (typeof window !== "undefined") {
      window.localStorage.setItem(SCENE_STORAGE_KEY, scene);
    }
    set({ scene });
  },
  setView: (view) => set({ view, selectedId: null }),
  setSearch: (search) => set({ search }),
  setTypeFilter: (typeFilter) => set({ typeFilter }),
  setPriorityFilter: (priorityFilter) => set({ priorityFilter }),
  setAssigneeFilter: (assigneeFilter) => set({ assigneeFilter }),
  setClientFilter: (clientFilter) => set({ clientFilter }),
  setHideDone: (hideDone) => set({ hideDone }),
  setSelectedId: (selectedId) => set({ selectedId }),
  setSettingsOpen: (settingsOpen) => set({ settingsOpen }),
  setCreateOpen: (createOpen) => set({ createOpen }),
  clearFilters: () =>
    set({
      search: "",
      typeFilter: "all",
      priorityFilter: "all",
      assigneeFilter: "all",
      clientFilter: "all",
    }),
  patchTask: (id, patch) => {
    const key = String(id);
    const localPatches = {
      ...get().localPatches,
      [key]: { ...get().localPatches[key], ...patch, updated: new Date().toISOString() },
    };
    writeLocal(get().localAdds, localPatches);
    set({ localPatches });
  },
  clearTaskPatchFields: (id, fields) => {
    const localPatches = withoutTaskPatchFields(get().localPatches, id, fields);
    writeLocal(get().localAdds, localPatches);
    set({ localPatches });
  },
  addLocalTask: (task) => {
    const localAdds = [task, ...get().localAdds];
    writeLocal(localAdds, get().localPatches);
    set({ localAdds, selectedId: task.id, createOpen: false });
  },
}));
