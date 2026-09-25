import { appendComment, commentDocument, commentLanded } from "./comment";
import {
  BACKLOG_INCLUDE,
  BASEROW_ORIGIN,
  F,
  RETAILER_INCLUDE,
  TABLES,
  TEAM_INCLUDE,
  TOKEN_STORAGE_KEY,
} from "./schema";
import {
  normalizeRetailer,
  normalizeTask,
  normalizeTeammate,
} from "./normalize";
import type { BaseAccount, FileValue, Retailer, RowComment, Task, TasksPayload, Teammate } from "./types";

type Page<T> = {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
};

const TOKEN_REQUIRED = "Подключите токен Base в настройках";

function rewriteNext(url: string | null) {
  if (!url) return null;
  return url.replace(/^http:\/\//, "https://");
}

export function readBaseToken() {
  if (typeof window === "undefined") return "";
  return window.localStorage.getItem(TOKEN_STORAGE_KEY)?.trim() ?? "";
}

function writeBaseToken(token: string) {
  window.localStorage.setItem(TOKEN_STORAGE_KEY, token);
}

function baserowAuthorization(token: string) {
  const raw = token.trim().replace(/^(?:Token|JWT|Bearer)\s+/i, "");
  // A database token is not a JWT. Base accepts it only as `Authorization: Token …`.
  // `Bearer` is ignored, which is why comment calls returned "credentials were not provided".
  return raw.split(".").length === 3 ? `JWT ${raw}` : `Token ${raw}`;
}

function authHeaders(token?: string): Array<Record<string, string>> {
  const base: Record<string, string> = { Accept: "application/json" };
  if (!token) return [base];
  return [{ ...base, Authorization: baserowAuthorization(token) }];
}

async function getJson<T>(url: string, token?: string): Promise<T> {
  let lastError: Error | null = null;
  for (const headers of authHeaders(token)) {
    try {
      const res = await fetch(url, { headers, signal: AbortSignal.timeout(12_000) });
      if (res.ok) return (await res.json()) as T;
      const body = await res.text();
      lastError = new Error(`Baserow ${res.status}: ${body.slice(0, 280)}`);
      if (res.status !== 401 && res.status !== 403) break;
    } catch (error) {
      lastError = error instanceof Error ? error : new Error("Сеть недоступна");
    }
  }
  throw lastError ?? new Error("Не удалось загрузить данные");
}

async function sendJson<T>(
  url: string,
  token: string,
  method: "POST" | "PATCH",
  body: unknown,
): Promise<T> {
  let lastError: Error | null = null;
  for (const headers of authHeaders(token)) {
    try {
      const res = await fetch(url, {
        method,
        headers: { ...headers, "Content-Type": "application/json" },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(12_000),
      });
      if (res.ok) return (await res.json()) as T;
      const text = await res.text();
      lastError = new Error(`Baserow ${res.status}: ${text.slice(0, 280)}`);
      if (res.status !== 401 && res.status !== 403) break;
    } catch (error) {
      lastError = error instanceof Error ? error : new Error("Сеть недоступна");
    }
  }
  throw lastError ?? new Error("Не удалось сохранить");
}

async function uploadFile(token: string, file: File): Promise<FileValue> {
  let lastError: Error | null = null;
  for (const headers of authHeaders(token)) {
    try {
      const body = new FormData();
      body.append("file", file, file.name);
      const res = await fetch(`${BASEROW_ORIGIN}/api/user-files/upload-file/`, {
        method: "POST",
        headers,
        body,
        signal: AbortSignal.timeout(60_000),
      });
      if (res.ok) return (await res.json()) as FileValue;
      const text = await res.text();
      lastError = new Error(`Baserow ${res.status}: ${text.slice(0, 280)}`);
      if (res.status !== 401 && res.status !== 403) break;
    } catch (error) {
      lastError = error instanceof Error ? error : new Error("Сеть недоступна");
    }
  }
  throw lastError ?? new Error("Не удалось загрузить файл");
}

async function fetchPages<T extends Record<string, unknown>>(
  startUrl: string,
  token: string | undefined,
  maxPages: number,
) {
  const rows: T[] = [];
  let url: string | null = startUrl;
  let count = 0;
  let pages = 0;
  while (url && pages < maxPages) {
    let page: Page<T>;
    try {
      page = await getJson<Page<T>>(url, token);
    } catch (error) {
      if (pages === 0) throw error;
      return { rows, count, truncated: true };
    }
    count = page.count;
    rows.push(...page.results);
    url = rewriteNext(page.next);
    pages += 1;
  }
  return { rows, count, truncated: Boolean(url) };
}

function resolveToken() {
  return readBaseToken() || null;
}

async function countRows(token: string, tableId: number) {
  const page = await getJson<Page<Record<string, unknown>>>(
    `${BASEROW_ORIGIN}/api/database/rows/table/${tableId}/?size=1`,
    token,
  );
  return page.count ?? 0;
}

function emptyAccount(): BaseAccount {
  return {
    connected: false,
    host: "Base",
    workspaceId: null,
    databaseId: null,
    backlog: 0,
    retailers: 0,
    team: 0,
    hint: "",
    stored: "browser",
  };
}

async function loadAccount(token: string): Promise<BaseAccount> {
  let workspaceId: number | null = null;
  let databaseId: number | null = null;
  try {
    const fields = await getJson<Array<{ workspace_id?: number; database_id?: number }>>(
      `${BASEROW_ORIGIN}/api/database/fields/table/${TABLES.backlog}/`,
      token,
    );
    workspaceId = fields[0]?.workspace_id ?? null;
    databaseId = fields[0]?.database_id ?? null;
  } catch {
    workspaceId = null;
  }
  const [backlog, retailers, team] = await Promise.all([
    countRows(token, TABLES.backlog),
    countRows(token, TABLES.retailers),
    countRows(token, TABLES.team),
  ]);
  return {
    connected: true,
    host: "Base",
    workspaceId,
    databaseId,
    backlog,
    retailers,
    team,
    hint: token.slice(-4),
    stored: "browser",
  };
}

function rowsUrl(extra: Record<string, string>) {
  const params = new URLSearchParams({
    size: "200",
    include: BACKLOG_INCLUDE,
    ...extra,
  });
  return `${BASEROW_ORIGIN}/api/database/rows/table/${TABLES.backlog}/?${params.toString()}`;
}

async function tryRows(token: string, extra: Record<string, string>) {
  const url = rowsUrl(extra);
  try {
    return await fetchPages<Record<string, unknown>>(url, token, 1);
  } catch {
    try {
      return await fetchPages<Record<string, unknown>>(url, token, 1);
    } catch {
      return null;
    }
  }
}

function mergeRowSets(
  sets: Array<{ rows: Record<string, unknown>[]; count: number; truncated: boolean } | null>,
) {
  const byId = new Map<number, Record<string, unknown>>();
  let truncated = false;
  for (const set of sets) {
    if (!set) continue;
    if (set.truncated || set.count > set.rows.length) truncated = true;
    for (const row of set.rows) byId.set(Number(row.id), row);
  }
  const rows = [...byId.values()].sort(
    (a, b) => Number(b[F.incrId] ?? b.id) - Number(a[F.incrId] ?? a.id),
  );
  return { rows, count: rows.length, truncated };
}

async function loadBacklog(
  token: string,
  input: { query?: string; assignee?: string; client?: string },
) {
  const query = input.query?.trim() ?? "";
  const assignee = input.assignee?.trim() ?? "";
  const client = input.client?.trim() ?? "";

  if (query) {
    const numeric = query.replace(/^#/, "");
    const jobs = [
      tryRows(token, { search: query }),
      tryRows(token, { "filter__field_7206__link_row_contains": query }),
      tryRows(token, { "filter__field_7205__link_row_contains": query }),
      tryRows(token, { "filter__field_7198__link_row_contains": query }),
    ];
    if (/^\d{1,8}$/.test(numeric)) {
      jobs.push(tryRows(token, { "filter__field_7240__equal": numeric }));
    }
    const sets = await Promise.all(jobs);
    if (sets.every((set) => set == null)) {
      throw new Error("Не удалось выполнить поиск");
    }
    return { ...mergeRowSets(sets), scope: "search" as const, query };
  }

  if (assignee && assignee !== "all") {
    const set = await tryRows(token, { "filter__field_7206__link_row_contains": assignee });
    if (!set) throw new Error("Не удалось отфильтровать по человеку");
    return { ...set, scope: "filtered" as const, query: "" };
  }

  if (client && client !== "all") {
    const set = await tryRows(token, { "filter__field_7198__link_row_contains": client });
    if (!set) throw new Error("Не удалось отфильтровать по клиенту");
    return { ...set, scope: "filtered" as const, query: "" };
  }

  try {
    const set = await fetchPages<Record<string, unknown>>(
      rowsUrl({ order_by: "-field_7240" }),
      token,
      1,
    );
    return { ...set, scope: "recent" as const, query: "" };
  } catch {
    const set = await fetchPages<Record<string, unknown>>(rowsUrl({}), token, 1);
    return { ...set, scope: "recent" as const, query: "" };
  }
}

function tableRowsUrl(tableId: number, include?: string) {
  const params = new URLSearchParams({ size: "200" });
  if (include) params.set("include", include);
  return `${BASEROW_ORIGIN}/api/database/rows/table/${tableId}/?${params.toString()}`;
}

async function fetchTable<T extends Record<string, unknown>>(
  tableId: number,
  include: string,
  token: string,
  maxPages: number,
) {
  try {
    return await fetchPages<T>(tableRowsUrl(tableId, include), token, maxPages);
  } catch {
    return await fetchPages<T>(tableRowsUrl(tableId), token, maxPages);
  }
}

export async function fetchOneTask(task: string): Promise<{ task: Task | null }> {
  const key = task.trim().replace(/^#/, "");
  if (!/^\d{1,8}$/.test(key)) return { task: null };
  try {
    const token = resolveToken();
    if (!token) return { task: null };
    const byNumber = await tryRows(token, { "filter__field_7240__equal": key });
    const matches = (byNumber?.rows ?? []).filter((row) => String(row[F.incrId]) === key);
    const exact = matches.find((row) => String(row.id) === key);
    if (exact) return { task: normalizeTask(exact) };
    if (matches.length === 1) return { task: normalizeTask(matches[0]) };
    const row = await getJson<Record<string, unknown>>(
      `${BASEROW_ORIGIN}/api/database/rows/table/${TABLES.backlog}/${key}/?include=${BACKLOG_INCLUDE}`,
      token,
    );
    return { task: normalizeTask(row) };
  } catch {
    return { task: null };
  }
}

export async function fetchTasks(input: {
  query?: string;
  assignee?: string;
  client?: string;
}): Promise<TasksPayload> {
  const query = input.query?.trim() ?? "";
  try {
    const token = resolveToken();
    if (!token) {
      return {
        tasks: [],
        source: "token",
        scope: query ? "search" : "recent",
        query,
        count: 0,
        truncated: false,
        error: TOKEN_REQUIRED,
      };
    }
    const loaded = await loadBacklog(token, input);
    return {
      tasks: loaded.rows.map(normalizeTask),
      source: "token",
      scope: loaded.scope,
      query: loaded.query,
      count: loaded.count,
      truncated: loaded.truncated,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Не удалось загрузить задачи";
    return {
      tasks: [],
      source: "token",
      scope: query ? "search" : "recent",
      query,
      count: 0,
      truncated: false,
      error: message,
    };
  }
}

export async function fetchRetailers(): Promise<{ retailers: Retailer[]; error?: string }> {
  try {
    const token = resolveToken();
    if (!token) return { retailers: [], error: TOKEN_REQUIRED };
    const { rows } = await fetchTable<Record<string, unknown>>(
      TABLES.retailers,
      RETAILER_INCLUDE,
      token,
      8,
    );
    return { retailers: rows.map(normalizeRetailer) };
  } catch (error) {
    return {
      retailers: [],
      error: error instanceof Error ? error.message : "Не удалось загрузить клиентов",
    };
  }
}

export async function fetchTeam(): Promise<{ team: Teammate[]; error?: string }> {
  try {
    const token = resolveToken();
    if (!token) return { team: [], error: TOKEN_REQUIRED };
    const { rows } = await fetchTable<Record<string, unknown>>(
      TABLES.team,
      TEAM_INCLUDE,
      token,
      3,
    );
    return { team: rows.map(normalizeTeammate) };
  } catch (error) {
    return {
      team: [],
      error: error instanceof Error ? error.message : "Не удалось загрузить команду",
    };
  }
}

export async function createRowComment(
  rowId: number,
  text: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const note = text.trim();
  if (!note) return { ok: false, error: "Пустой комментарий" };
  try {
    const token = resolveToken();
    if (!token) return { ok: false, error: TOKEN_REQUIRED };
    await sendJson(
      `${BASEROW_ORIGIN}/api/row_comments/${TABLES.backlog}/${rowId}/`,
      token,
      "POST",
      { message: commentDocument(note) },
    );
    return { ok: true };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Не удалось опубликовать комментарий",
    };
  }
}

type RawRowComment = {
  id: number;
  first_name?: string;
  message?: { content?: Array<{ content?: Array<{ text?: string }> }> };
  created_on?: string;
  edited?: boolean;
  trashed?: boolean;
};

function rowCommentText(message: RawRowComment["message"]) {
  return (message?.content ?? [])
    .map((paragraph) => (paragraph.content ?? []).map((part) => part.text ?? "").join(""))
    .join("\n")
    .trim();
}

export async function fetchRowComments(rowId: number): Promise<{
  rowId: number;
  comments: RowComment[];
  error?: string;
}> {
  const token = resolveToken();
  if (!token) return { rowId, comments: [] };
  try {
    const payload = await getJson<Page<RawRowComment> | RawRowComment[]>(
      `${BASEROW_ORIGIN}/api/row_comments/${TABLES.backlog}/${rowId}/`,
      token,
    );
    const rows = Array.isArray(payload) ? payload : payload.results;
    return {
      rowId,
      comments: rows
        .filter((comment) => !comment.trashed)
        .map((comment) => ({
          id: comment.id,
          author: comment.first_name?.trim() || "Base",
          message: rowCommentText(comment.message),
          createdOn: comment.created_on ?? null,
          edited: Boolean(comment.edited),
        })),
    };
  } catch (error) {
    return {
      rowId,
      comments: [],
      error: error instanceof Error ? error.message : "Не удалось загрузить комментарии Base",
    };
  }
}

export async function publishTaskComment(input: {
  id: number;
  next: string;
  entry: string;
  note: string;
  solution: string;
}): Promise<{ ok: true; patch: Partial<Task>; notice: string } | { ok: false; error: string }> {
  const field = await updateTaskFields({
    id: input.id,
    fields: { [F.clientComments]: input.next },
  });
  const fieldOk = Boolean(
    field.task && commentLanded(input.next, field.task.clientComments, input.entry),
  );
  const thread = await createRowComment(input.id, input.note);
  if (fieldOk || thread.ok) {
    return {
      ok: true,
      patch: { clientComments: fieldOk && field.task ? field.task.clientComments : input.next },
      notice: thread.ok ? "Комментарий опубликован в Base" : "Комментарий сохранён в Base",
    };
  }

  const solutionNext = appendComment(input.solution, input.entry);
  const solution = await updateTaskFields({
    id: input.id,
    fields: { [F.solution]: solutionNext },
  });
  if (solution.task && commentLanded(solutionNext, solution.task.solution, input.entry)) {
    return {
      ok: true,
      patch: { clientComments: input.next, solution: solution.task.solution },
      notice: "Комментарий записан в техническое решение в Base",
    };
  }

  const reason = [field.error, solution.error]
    .map(readableBaseError)
    .filter(Boolean)
    .join(" ");
  return { ok: false, error: reason || "Base не сохранил комментарий" };
}

function readableBaseError(error: string | undefined) {
  if (!error) return "";
  if (/authentication credentials|ERROR_NO_PERMISSION|ERROR_USER_NOT_IN_GROUP/i.test(error)) return "";
  return error.replace(/^Baserow \d+: /, "").slice(0, 180);
}

export async function updateTaskFields(input: {
  id: number;
  fields: Record<string, unknown>;
}): Promise<{ task: Task | null; error?: string }> {
  try {
    const token = resolveToken();
    if (!token) return { task: null, error: TOKEN_REQUIRED };
    const row = await sendJson<Record<string, unknown>>(
      `${BASEROW_ORIGIN}/api/database/rows/table/${TABLES.backlog}/${input.id}/`,
      token,
      "PATCH",
      input.fields,
    );
    return { task: normalizeTask(row) };
  } catch (error) {
    return {
      task: null,
      error: error instanceof Error ? error.message : "Не удалось сохранить",
    };
  }
}

export async function uploadTaskAssets(input: {
  id: number;
  files: File[];
  existing: FileValue[];
}): Promise<{ task: Task | null; error?: string }> {
  try {
    const token = resolveToken();
    if (!token) return { task: null, error: TOKEN_REQUIRED };
    const uploaded = await Promise.all(input.files.map((file) => uploadFile(token, file)));
    return updateTaskFields({
      id: input.id,
      fields: {
        [F.refs]: [
          ...input.existing.map((file) => ({ name: file.name })),
          ...uploaded,
        ],
      },
    });
  } catch (error) {
    return {
      task: null,
      error: error instanceof Error ? error.message : "Не удалось загрузить файлы",
    };
  }
}

export type CreateTaskInput = {
  title: string;
  story?: string;
  statusId?: number;
  typeId?: number;
  priorityId?: number;
  assigneeIds?: number[];
  requesterIds?: number[];
  clientIds?: number[];
  be?: number | null;
  mb?: number | null;
  ui?: number | null;
  spent?: number | null;
  impact?: number | null;
  eta?: string;
};

export async function createTaskRow(input: CreateTaskInput): Promise<{ task: Task | null; error?: string }> {
  try {
    const payload: Record<string, unknown> = {
      [F.title]: input.title,
    };
    if (input.story) payload[F.story] = input.story;
    if (input.statusId) payload[F.status] = input.statusId;
    if (input.typeId) payload[F.type] = input.typeId;
    if (input.priorityId) payload[F.priority] = input.priorityId;
    if (input.assigneeIds?.length) payload[F.assignee] = input.assigneeIds;
    if (input.requesterIds?.length) payload[F.requester] = input.requesterIds;
    if (input.clientIds?.length) payload[F.client] = input.clientIds;
    if (input.be != null) payload[F.beSp] = input.be;
    if (input.mb != null) payload[F.mbSp] = input.mb;
    if (input.ui != null) payload[F.uiSp] = input.ui;
    if (input.spent != null) payload[F.spentSp] = input.spent;
    if (input.impact != null) payload[F.impact] = input.impact;
    if (input.eta) payload[F.eta] = input.eta;
    const token = resolveToken();
    if (!token) return { task: null, error: TOKEN_REQUIRED };
    const row = await sendJson<Record<string, unknown>>(
      `${BASEROW_ORIGIN}/api/database/rows/table/${TABLES.backlog}/`,
      token,
      "POST",
      payload,
    );
    return { task: normalizeTask(row) };
  } catch (error) {
    return {
      task: null,
      error: error instanceof Error ? error.message : "Не удалось создать задачу",
    };
  }
}

export async function fetchAccount(): Promise<BaseAccount> {
  const token = resolveToken();
  if (!token) return emptyAccount();
  return loadAccount(token);
}

export async function saveBaseToken(
  token: string,
): Promise<{ ok: true; account: BaseAccount } | { ok: false; error: string }> {
  const next = token.trim();
  if (next.length < 8 || next.length > 400) {
    return { ok: false, error: "Токен не принят" };
  }
  try {
    await getJson(
      `${BASEROW_ORIGIN}/api/database/rows/table/${TABLES.backlog}/?size=1&include=${F.title}`,
      next,
    );
    writeBaseToken(next);
    return { ok: true, account: await loadAccount(next) };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Токен не принят",
    };
  }
}

export async function clearBaseToken(): Promise<BaseAccount> {
  if (typeof window !== "undefined") {
    window.localStorage.removeItem(TOKEN_STORAGE_KEY);
  }
  return emptyAccount();
}
