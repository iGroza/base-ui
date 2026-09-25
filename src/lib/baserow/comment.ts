export type CommentDoc = {
  type: "doc";
  content: Array<{ type: "paragraph"; content?: Array<{ type: "text"; text: string }> }>;
};

/** Baserow row comments accept only a ProseMirror document, not a plain string. */
export function commentDocument(text: string): CommentDoc {
  const lines = text.replaceAll("\r\n", "\n").split("\n");
  const content = lines.map((line) =>
    line
      ? { type: "paragraph" as const, content: [{ type: "text" as const, text: line }] }
      : { type: "paragraph" as const },
  );
  return { type: "doc", content: content.length > 0 ? content : [{ type: "paragraph" }] };
}

export function commentLanded(sent: string, returned: string | null | undefined, entry?: string) {
  const back = normalizeComment(returned ?? "");
  if (!back) return false;
  if (back === normalizeComment(sent)) return true;
  const piece = normalizeComment(entry ?? "");
  return piece.length > 0 && back.includes(piece);
}

export function appendComment(existing: string, entry: string) {
  const block = entry.trim();
  if (!block) return chronologicalComments(existing);
  if (normalizeComment(existing).includes(normalizeComment(block))) return chronologicalComments(existing);
  return chronologicalComments([existing.trim(), block].filter(Boolean).join("\n\n"));
}

const MONTHS: Record<string, number> = {
  янв: 1,
  фев: 2,
  мар: 3,
  апр: 4,
  ма: 5,
  мая: 5,
  май: 5,
  июн: 6,
  июл: 7,
  авг: 8,
  сен: 9,
  окт: 10,
  ноя: 11,
  дек: 12,
};

/** Oldest first, so a new note stays at the bottom of the thread. */
export function chronologicalComments(text: string) {
  const blocks = commentBlocks(text);
  if (blocks.length < 2) return normalizeComment(text);
  const plain: string[] = [];
  const stamped: { block: string; index: number; key: number }[] = [];
  blocks.forEach((block, index) => {
    const key = commentSortKey(block);
    if (key == null) plain.push(block);
    else stamped.push({ block, index, key });
  });
  stamped.sort((a, b) => a.key - b.key || a.index - b.index);
  return [...plain, ...stamped.map((item) => item.block)].join("\n\n");
}

export function commentBlocks(text: string) {
  const normalized = normalizeComment(text);
  if (!normalized) return [];
  return normalized
    .split(/\n{2,}(?=—\s)/)
    .map((block) => block.trim())
    .filter(Boolean);
}

export function removeComment(text: string, index: number) {
  const blocks = commentBlocks(text);
  if (index < 0 || index >= blocks.length) return chronologicalComments(text);
  return chronologicalComments(blocks.filter((_, itemIndex) => itemIndex !== index).join("\n\n"));
}

function commentSortKey(block: string) {
  const line = block.split("\n")[0] ?? "";
  const match = line.match(/^—\s+(\d{1,2})\s+([а-яё]+)\.?,?\s*(?:(\d{4}),?\s*)?(\d{1,2}):(\d{2})/i);
  if (!match) return null;
  const month = MONTHS[match[2].slice(0, 3).toLowerCase()];
  if (!month) return null;
  const year = match[3] ? Number(match[3]) : 0;
  return year * 1e8 + month * 1e6 + Number(match[1]) * 1e4 + Number(match[4]) * 1e2 + Number(match[5]);
}

function normalizeComment(value: string) {
  return value.replaceAll("\r\n", "\n").trim();
}
