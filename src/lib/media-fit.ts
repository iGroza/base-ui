export type MediaBox = { width: number; height: number };

/** Shrink a photo so both sides fit in the view. Never enlarges. */
export function fitInside(view: MediaBox, natural: MediaBox): MediaBox {
  const viewWidth = Math.max(0, Math.floor(view.width));
  const viewHeight = Math.max(0, Math.floor(view.height));
  if (viewWidth <= 0 || viewHeight <= 0) return { width: 0, height: 0 };
  if (!(natural.width > 0) || !(natural.height > 0)) return { width: 0, height: 0 };

  const scale = Math.min(1, viewWidth / natural.width, viewHeight / natural.height);
  const width = Math.min(viewWidth, Math.max(1, Math.round(natural.width * scale)));
  const height = Math.min(viewHeight, Math.max(1, Math.round(natural.height * scale)));
  return { width, height };
}
