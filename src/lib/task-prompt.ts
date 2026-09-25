import type { LinkValue, SelectValue, Task } from "./baserow/types";

export type PromptAsset = {
  name: string;
  url: string;
};

const IMAGE_URL = /https?:\/\/[^\s<>"']+\.(?:png|jpe?g|gif|webp|avif|svg)(?:\?[^\s<>"']*)?/gi;

function names(items: LinkValue[]) {
  return items.map((item) => item.value.trim()).filter(Boolean);
}

function choice(item: SelectValue) {
  return item?.value.trim() ?? "";
}

function section(title: string, body: string) {
  const text = body.trim();
  if (!text) return "";
  return `## ${title}\n${text}`;
}

function safeName(name: string, index: number) {
  const cleaned = name.replace(/[\\/:*?"<>|]+/g, " ").replace(/\s+/g, " ").trim() || `file-${index + 1}`;
  return `${String(index + 1).padStart(2, "0")}-${cleaned}`;
}

function fileNameFromUrl(url: string) {
  try {
    const path = new URL(url).pathname.split("/").pop() ?? "";
    return decodeURIComponent(path) || "file";
  } catch {
    return "file";
  }
}

export function collectTaskAssets(task: Task, texts: string[] = []): PromptAsset[] {
  const assets: PromptAsset[] = [];
  const seen = new Set<string>();
  const push = (url: string, name: string) => {
    if (!url || seen.has(url)) return;
    seen.add(url);
    assets.push({ url, name: safeName(name, assets.length) });
  };
  for (const file of task.refs) {
    push(file.url, file.visible_name || file.name || fileNameFromUrl(file.url));
  }
  for (const text of texts) {
    for (const match of text.matchAll(IMAGE_URL)) {
      const url = match[0].replace(/[),.;:]+$/g, "");
      push(url, fileNameFromUrl(url));
    }
  }
  return assets;
}

export function buildTaskPrompt(
  task: Task,
  details: {
    title: string;
    story: string;
    solution: string;
    comments: string;
    status: string;
    type: string;
    priority: string;
    clients: string[];
    assignees: string[];
    requesters: string[];
    be: string;
    mb: string;
    ui: string;
    spent: string;
    impact: string;
    eta: string;
    baseUrl: string;
    siteUrl: string;
    assets: string[];
  },
) {
  const number = task.incrId ?? task.id;
  const facts = [
    details.status && `Статус: ${details.status}`,
    details.type && `Тип: ${details.type}`,
    details.priority && `Приоритет: ${details.priority}`,
    details.clients.length && `Клиенты: ${details.clients.join(", ")}`,
    details.assignees.length && `Ответственные: ${details.assignees.join(", ")}`,
    details.requesters.length && `Запросили: ${details.requesters.join(", ")}`,
    names(task.sprint).length && `Спринт: ${names(task.sprint).join(", ")}`,
    details.be && `BE: ${details.be}`,
    details.mb && `MB: ${details.mb}`,
    details.ui && `UI: ${details.ui}`,
    details.spent && `Потрачено: ${details.spent}`,
    details.impact && `Влияние: ${details.impact}`,
    details.eta && `ETA: ${details.eta}`,
  ].filter(Boolean);

  const parts = [
    `# Задача #${number}`,
    `Строка: ${task.id}`,
    details.baseUrl && `Base: ${details.baseUrl}`,
    details.siteUrl && `Доска: ${details.siteUrl}`,
    "",
    `Заголовок: ${details.title.trim() || "Без названия"}`,
    facts.join("\n"),
    section("Описание", details.story),
    section("Решение", details.solution),
    section("Комментарии", details.comments),
    section(
      "Файлы",
      details.assets.length
        ? details.assets.map((name) => `- ${name}`).join("\n")
        : "Вложений нет",
    ),
    "Собери контекст этой задачи. Построй план выполнения",
  ];
  return parts.filter((part) => part !== "").join("\n\n").replace(/\n{3,}/g, "\n\n");
}

function localMediaUrl(url: string) {
  const path = new URL(url).pathname;
  if (!path.startsWith("/media/")) throw new Error(url);
  const base = (import.meta.env.BASE_URL || "/").replace(/\/$/, "");
  return `${base}${path.replace(/^\/media\//, "/media-file/")}`;
}

function crc32(data: Uint8Array) {
  let crc = ~0;
  for (const byte of data) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
  }
  return ~crc >>> 0;
}

function zipStore(files: { name: string; data: Uint8Array }[]) {
  const parts: Uint8Array[] = [];
  const centrals: Uint8Array[] = [];
  let offset = 0;
  const encoder = new TextEncoder();
  for (const file of files) {
    const name = encoder.encode(file.name);
    const crc = crc32(file.data);
    const local = new Uint8Array(30 + name.length);
    const view = new DataView(local.buffer);
    view.setUint32(0, 0x04034b50, true);
    view.setUint16(4, 20, true);
    view.setUint32(14, crc, true);
    view.setUint32(18, file.data.length, true);
    view.setUint32(22, file.data.length, true);
    view.setUint16(26, name.length, true);
    local.set(name, 30);
    const central = new Uint8Array(46 + name.length);
    const centralView = new DataView(central.buffer);
    centralView.setUint32(0, 0x02014b50, true);
    centralView.setUint16(4, 20, true);
    centralView.setUint16(6, 20, true);
    centralView.setUint32(16, crc, true);
    centralView.setUint32(20, file.data.length, true);
    centralView.setUint32(24, file.data.length, true);
    centralView.setUint16(28, name.length, true);
    centralView.setUint32(42, offset, true);
    central.set(name, 46);
    parts.push(local, file.data);
    centrals.push(central);
    offset += local.length + file.data.length;
  }
  const centralSize = centrals.reduce((sum, part) => sum + part.length, 0);
  const end = new Uint8Array(22);
  const endView = new DataView(end.buffer);
  endView.setUint32(0, 0x06054b50, true);
  endView.setUint16(8, files.length, true);
  endView.setUint16(10, files.length, true);
  endView.setUint32(12, centralSize, true);
  endView.setUint32(16, offset, true);
  const bytes = [...parts, ...centrals, end].map(
    (part) => part.buffer.slice(part.byteOffset, part.byteOffset + part.byteLength) as ArrayBuffer,
  );
  return new Blob(bytes, { type: "application/zip" });
}

function saveBlob(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 2000);
}

async function readAsset(url: string) {
  const response = await fetch(localMediaUrl(url), { signal: AbortSignal.timeout(20_000) });
  if (!response.ok) throw new Error(`${response.status}`);
  return new Uint8Array(await response.arrayBuffer());
}

export async function downloadAsset(asset: PromptAsset) {
  const data = await readAsset(asset.url);
  saveBlob(new Blob([data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength) as ArrayBuffer]), asset.name);
}

export async function downloadTaskAssets(assets: PromptAsset[], archiveName: string) {
  const files = await Promise.all(assets.map(async (asset) => ({ name: asset.name, data: await readAsset(asset.url) })));
  if (files.length === 1) {
    await downloadAsset(assets[0]);
    return;
  }
  saveBlob(zipStore(files), archiveName);
}

export function copyText(text: string) {
  const area = document.createElement("textarea");
  area.value = text;
  area.setAttribute("readonly", "");
  area.style.position = "fixed";
  area.style.top = "0";
  area.style.left = "0";
  area.style.opacity = "0";
  document.body.appendChild(area);
  area.focus();
  area.select();
  const copied = document.execCommand("copy");
  area.remove();
  return copied;
}
