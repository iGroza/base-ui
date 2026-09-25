/** Row id from an original Base task URL or path. */
export function taskIdFromBaseLink(input: string): string | null {
  const raw = input.trim();
  if (!raw) return null;
  let path = raw;
  try {
    path = new URL(raw, "https://base.local").pathname;
  } catch {
    path = raw.split(/[?#]/)[0] ?? raw;
  }
  const match = path.match(/\/database\/\d+\/table\/\d+(?:\/\d+)?\/row\/(\d+)\/?$/i);
  return match?.[1] ?? null;
}
