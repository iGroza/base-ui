import type { DashSearch, DashView } from "@/lib/query";

const KEY = "base-ui-boards";

export type SavedBoard = {
  id: string;
  name: string;
  view: Extract<DashView, "board" | "list" | "search">;
  q: string;
  type: string;
  priority: string;
  who: string;
  client: string;
  status: string;
  sort: DashSearch["sort"];
  dir: DashSearch["dir"];
  cols: string;
};

export function readBoards(): SavedBoard[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as SavedBoard[];
    return Array.isArray(parsed) ? parsed.filter((item) => item && typeof item.name === "string") : [];
  } catch {
    return [];
  }
}

export function writeBoards(boards: SavedBoard[]) {
  window.localStorage.setItem(KEY, JSON.stringify(boards));
}

export function boardFromDash(name: string, dash: DashSearch): SavedBoard {
  const view = dash.view === "board" ? "board" : "list";
  return {
    id: crypto.randomUUID(),
    name: name.trim(),
    view,
    q: dash.q,
    type: dash.type,
    priority: dash.priority,
    who: dash.who,
    client: dash.client,
    status: dash.status,
    sort: dash.sort,
    dir: dash.dir,
    cols: dash.cols,
  };
}

export function describeBoard(board: SavedBoard) {
  const bits = [
    board.q,
    board.who,
    board.client,
    board.status.replaceAll(",", " · "),
    board.type,
    board.priority,
  ].filter(Boolean);
  const where = board.view === "board" ? "Доска" : "Список";
  return bits.length ? `${where} · ${bits.join(" · ")}` : where;
}
