import { clsx, type ClassValue } from "clsx";
import { Marked } from "marked";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return (parts[0]![0]! + parts[parts.length - 1]![0]!).toUpperCase();
}

export function formatDate(value: string | null | undefined) {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return new Intl.DateTimeFormat("ru-RU", {
    day: "numeric",
    month: "short",
    year: d.getFullYear() === new Date().getFullYear() ? undefined : "numeric",
  }).format(d);
}

export function formatDateTime(value: string | null | undefined) {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return new Intl.DateTimeFormat("ru-RU", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);
}

export function toNumber(value: unknown): number | null {
  if (value == null || value === "") return null;
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : null;
}

const AMP = "\u0026";

export function escapeHtml(input: string) {
  return input
    .replaceAll("&", `${AMP}amp;`)
    .replaceAll("<", `${AMP}lt;`)
    .replaceAll(">", `${AMP}gt;`)
    .replaceAll('"', `${AMP}quot;`);
}

function safeUrl(href: string | null | undefined) {
  if (!href) return "";
  try {
    const url = new URL(href, "https://base.local");
    if (url.protocol === "http:" || url.protocol === "https:" || url.protocol === "mailto:") return href.trim();
  } catch {
    return "";
  }
  return "";
}

const markdown = new Marked({ gfm: true, breaks: true });
markdown.use({
  renderer: {
    html({ text }) {
      return escapeHtml(text);
    },
    link(token) {
      const inner = token.autolink || !token.tokens ? escapeHtml(token.text) : this.parser.parseInline(token.tokens);
      const href = safeUrl(token.href);
      if (!href) return inner;
      const title = token.title ? ` title="${escapeHtml(token.title)}"` : "";
      return `<a href="${escapeHtml(href)}"${title} target="_blank" rel="noreferrer" class="rich-link">${inner}</a>`;
    },
    image(token) {
      const alt = token.tokens ? this.parser.parseInline(token.tokens, this.parser.textRenderer) : token.text;
      const href = safeUrl(token.href);
      if (!href) return escapeHtml(alt);
      const title = token.title ? ` title="${escapeHtml(token.title)}"` : "";
      return `<img class="rich-image" src="${escapeHtml(href)}" alt="${escapeHtml(alt)}"${title} />`;
    },
  },
});

function promoteBareImages(source: string) {
  return source.replace(
    /(^|[\s])(?<![(])(https?:\/\/[^\s<)]+?\.(?:png|jpe?g|gif|webp|avif|svg)(?:\?[^\s<)]*)?)/gi,
    "$1![]($2)",
  );
}

let cachedMarkdown = "";
let cachedHtml = "";

export function richTextToHtml(raw: string) {
  if (raw === cachedMarkdown) return cachedHtml;
  const prepared = promoteBareImages(raw.replaceAll("\\\n", "\n"));
  const html = markdown.parse(prepared, { async: false });
  cachedMarkdown = raw;
  cachedHtml = html;
  return html;
}

export function displayTitle(value: string) {
  return value
    .replaceAll("**", "")
    .replaceAll("\\", "")
    .replace(/^\s*Какую проблему решаем\??\s*/i, "")
    .trim();
}

export function taskRef(task: { id: number; incrId: number | null }, shared = false) {
  if (task.id < 0) return "new";
  const number = task.incrId ?? task.id;
  return shared && task.id !== number ? `#${number} · ${task.id}` : `#${number}`;
}
