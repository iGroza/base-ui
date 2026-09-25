import { isSceneId, type SceneId } from "@/lib/scenes";

export const VIEWS = ["board", "search", "list", "saved", "clients", "team"] as const;
export type DashView = (typeof VIEWS)[number];

export const SORTS = ["updated", "id", "title", "status", "type", "priority", "client", "assignee", "sp"] as const;
export type SortKey = (typeof SORTS)[number];

export type DashSearch = {
  view: DashView;
  q: string;
  type: string;
  priority: string;
  who: string;
  client: string;
  status: string;
  sort: SortKey;
  dir: "asc" | "desc";
  cols: string;
  task: string;
  scene: SceneId | "";
};

export const defaultDash: DashSearch = {
  view: "board",
  q: "",
  type: "",
  priority: "",
  who: "",
  client: "",
  status: "",
  sort: "updated",
  dir: "desc",
  cols: "",
  task: "",
  scene: "",
};

function text(value: unknown) {
  if (typeof value === "string") return value;
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return "";
}

export function parseDashSearch(search: Record<string, unknown>): DashSearch {
  const rawView = VIEWS.includes(search.view as DashView) ? (search.view as DashView) : "board";
  const view = rawView === "search" ? "list" : rawView;
  const sort = SORTS.includes(search.sort as SortKey) ? (search.sort as SortKey) : "updated";
  const scene = isSceneId(text(search.scene) || null) ? (text(search.scene) as SceneId) : "";
  return {
    view,
    q: text(search.q),
    type: text(search.type),
    priority: text(search.priority),
    who: text(search.who),
    client: text(search.client),
    status: text(search.status),
    sort,
    dir: search.dir === "asc" ? "asc" : "desc",
    cols: text(search.cols),
    task: text(search.task),
    scene,
  };
}

export function splitList(value: string) {
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

export function toggleList(current: string, value: string) {
  const items = splitList(current);
  const next = items.includes(value) ? items.filter((item) => item !== value) : [...items, value];
  return next.join(",");
}
