import { BASEROW_ORIGIN, TABLES } from "@/lib/baserow/schema";

const DATABASE_ID = 214;

export function taskKey(task: { id: number }) {
  return String(task.id);
}

export function baseTaskUrl(task: { id: number }) {
  if (task.id <= 0) return "";
  return `${BASEROW_ORIGIN}/database/${DATABASE_ID}/table/${TABLES.backlog}/row/${task.id}`;
}

export function siteTaskUrl(task: { id: number; incrId: number | null }) {
  const url = new URL(window.location.origin + window.location.pathname);
  url.searchParams.set("view", "list");
  url.searchParams.set("task", taskKey(task));
  return url.toString();
}
