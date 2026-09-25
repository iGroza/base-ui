import { F, RETAILER_F, SPRINT_F, TEAM_F } from "./schema";
import type {
  FileValue,
  LinkValue,
  Retailer,
  SelectValue,
  Sprint,
  Task,
  Teammate,
} from "./types";
import { toNumber } from "@/lib/utils";

function asSelect(value: unknown): SelectValue {
  if (!value || typeof value !== "object") return null;
  const v = value as { id?: number; value?: string; color?: string };
  if (typeof v.id !== "number" || typeof v.value !== "string") return null;
  return { id: v.id, value: v.value.trim(), color: v.color ?? "light-gray" };
}

function asLinks(value: unknown): LinkValue[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => {
      if (!item || typeof item !== "object") return null;
      const v = item as { id?: number; value?: string };
      if (typeof v.id !== "number" || typeof v.value !== "string") return null;
      return { id: v.id, value: v.value };
    })
    .filter((x): x is LinkValue => x !== null);
}

function asFiles(value: unknown): FileValue[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => {
      if (!item || typeof item !== "object") return null;
      const v = item as FileValue;
      if (typeof v.url !== "string") return null;
      return v;
    })
    .filter((x): x is FileValue => x !== null);
}

function asText(value: unknown) {
  return typeof value === "string" ? value : "";
}

export function normalizeTask(row: Record<string, unknown>): Task {
  return {
    id: Number(row.id),
    incrId: toNumber(row[F.incrId]),
    title: asText(row[F.title]).trim() || "Без названия",
    story: asText(row[F.story]),
    solution: asText(row[F.solution]),
    clientComments: asText(row[F.clientComments]),
    status: asSelect(row[F.status]),
    type: asSelect(row[F.type]),
    priority: asSelect(row[F.priority]),
    clients: asLinks(row[F.client]),
    assignees: asLinks(row[F.assignee]),
    requesters: asLinks(row[F.requester]),
    sprint: asLinks(row[F.sprint]),
    beSp: toNumber(row[F.beSp]),
    mbSp: toNumber(row[F.mbSp]),
    adminSp: toNumber(row[F.adminSp]),
    uiSp: toNumber(row[F.uiSp]),
    spentSp: toNumber(row[F.spentSp]),
    guideSp: toNumber(row[F.guideSp]),
    eta: asText(row[F.eta]) || null,
    created: asText(row[F.created]) || null,
    updated: asText(row[F.updated] ?? row[F.lastModified]) || null,
    impact: toNumber(row[F.impact]),
    canLaunch: asSelect(row[F.canLaunch]),
    needsDecomp: asSelect(row[F.needsDecomp]),
    refs: asFiles(row[F.refs]),
  };
}

export function normalizeRetailer(row: Record<string, unknown>): Retailer {
  return {
    id: Number(row.id),
    name: asText(row[RETAILER_F.name]) || "Без названия",
    industry: asSelect(row[RETAILER_F.industry])?.value ?? null,
    zone: asSelect(row[RETAILER_F.zone])?.value ?? null,
    product: asLinks(row[RETAILER_F.product]).map((p) => p.value),
    tariff: toNumber(row[RETAILER_F.tariff]),
  };
}

export function normalizeTeammate(row: Record<string, unknown>): Teammate {
  const photos = asFiles(row[TEAM_F.photo]);
  return {
    id: Number(row.id),
    name: asText(row[TEAM_F.name]) || "Без имени",
    role: asSelect(row[TEAM_F.role])?.value ?? null,
    squad: asSelect(row[TEAM_F.squad])?.value ?? null,
    photo: photos[0]?.thumbnails?.small?.url ?? photos[0]?.url ?? null,
  };
}

export function normalizeSprint(row: Record<string, unknown>): Sprint {
  return {
    id: Number(row.id),
    start: asText(row[SPRINT_F.start]) || null,
    goal: asText(row[SPRINT_F.goal]),
    achieved: asSelect(row[SPRINT_F.achieved])?.value ?? null,
    taskCount: asLinks(row[SPRINT_F.backlog]).length,
  };
}

export function totalSp(task: Task) {
  return [task.beSp, task.mbSp, task.adminSp, task.uiSp, task.guideSp]
    .filter((n): n is number => n != null)
    .reduce((sum, n) => sum + n, 0);
}
