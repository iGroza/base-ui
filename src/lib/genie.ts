export type Rect = { x: number; y: number; w: number; h: number };

type Row = { y: number; x0: number; x1: number };

const DURATION = 360;
const SLIDE_END = 0.5;
const TRANSLATE_START = 0.4;

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function easeInOutQuad(t: number) {
  return t < 0.5 ? 2 * t * t : 1 - ((-2 * t + 2) ** 2) / 2;
}

export function prefersReducedMotion() {
  return typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export function toRect(rect: DOMRect): Rect {
  return { x: rect.left, y: rect.top, w: rect.width, h: rect.height };
}

/**
 * macOS genie, in screen coordinates (y grows downward).
 * First the bottom edge shears toward the dock while the top stays put.
 * Then the window slides down the curved funnel those edges made.
 * `progress` 0 is the window, 1 is the dock slot.
 */
export function genieRows(progress: number, from: Rect, to: Rect, rows: number, coupled = false): Row[] {
  const fraction = clamp(progress, 0, 1);
  if (to.y <= from.y || rows < 1) return lerpRows(fraction, from, to, Math.max(1, rows));

  // Minimize shears first, then flies. Expand travels and unshears together
  // so the window is already a rectangle when it arrives, instead of
  // popping its bottom edge after it has landed.
  const slide = coupled ? fraction : clamp(fraction / SLIDE_END, 0, 1);
  const translate = coupled ? fraction : clamp((fraction - TRANSLATE_START) / (1 - TRANSLATE_START), 0, 1);
  const initialLeft = from.x;
  const initialRight = from.x + from.w;
  const initialTop = from.y;
  const initialBottom = from.y + from.h;
  const finalLeft = to.x;
  const finalRight = to.x + to.w;
  const finalTop = to.y;
  const finalBottom = to.y + to.h;
  const drop = translate * (finalTop - initialTop);
  const topEdge = initialTop + drop;
  let bottomEdge = initialBottom + drop;
  if (translate > 0 && bottomEdge > finalBottom) bottomEdge = finalBottom;

  const leftTopX = initialLeft;
  const rightTopX = initialRight;
  const leftBottomX = initialLeft + slide * (finalLeft - initialLeft);
  const rightBottomX = initialRight + slide * (finalRight - initialRight);
  const funnelTop = initialTop;
  const funnelBottom = finalTop;
  const funnelSpan = funnelBottom - funnelTop || 1;

  function side(y: number, topX: number, bottomX: number) {
    if (y <= funnelTop) return topX;
    if (y >= funnelBottom) return bottomX;
    const fromDock = 1 - (y - funnelTop) / funnelSpan;
    return bottomX + easeInOutQuad(clamp(fromDock, 0, 1)) * (topX - bottomX);
  }

  const out: Row[] = [];
  for (let i = 0; i <= rows; i += 1) {
    const y = topEdge + ((bottomEdge - topEdge) * i) / rows;
    out.push({ y, x0: side(y, leftTopX, leftBottomX), x1: side(y, rightTopX, rightBottomX) });
  }
  return out;
}

function lerpRows(progress: number, from: Rect, to: Rect, rows: number): Row[] {
  const x = from.x + (to.x - from.x) * progress;
  const y = from.y + (to.y - from.y) * progress;
  const w = from.w + (to.w - from.w) * progress;
  const h = from.h + (to.h - from.h) * progress;
  const out: Row[] = [];
  for (let i = 0; i <= rows; i += 1) {
    out.push({ y: y + (h * i) / rows, x0: x, x1: x + w });
  }
  return out;
}

function opacityFor(progress: number, direction: "in" | "out") {
  if (direction === "out" || progress < 0.93) return 1;
  return Math.max(0, 1 - (progress - 0.93) / 0.07);
}

const STRIPS = 48;

let cachedCss: string | null = null;

function pageCss() {
  if (cachedCss != null) return cachedCss;
  let css = "";
  for (const sheet of document.styleSheets) {
    try {
      for (const rule of sheet.cssRules) css += `${rule.cssText}\n`;
    } catch {
      // Cross-origin sheets are not readable and are not part of the app.
    }
  }
  cachedCss = css.replace(/<\/style/gi, "<\\/style");
  return cachedCss;
}

function motionBounds(from: Rect, to: Rect): Rect {
  const x = Math.min(from.x, to.x);
  const y = Math.min(from.y, to.y);
  const right = Math.max(from.x + from.w, to.x + to.w);
  const bottom = Math.max(from.y + from.h, to.y + to.h);
  return { x, y, w: right - x, h: bottom - y };
}

async function snapshot(source: HTMLElement, from: Rect): Promise<HTMLCanvasElement | null> {
  try {
    const clone = source.cloneNode(true) as HTMLElement;
    clone.querySelectorAll(".window-edge, .window-corner, script").forEach((node) => node.remove());
    clone.style.position = "relative";
    clone.style.left = "0";
    clone.style.top = "0";
    clone.style.margin = "0";
    clone.style.transform = "none";
    clone.style.animation = "none";
    clone.style.transition = "none";
    clone.style.boxShadow = "none";
    clone.style.filter = "none";
    clone.style.visibility = "visible";
    clone.style.opacity = "1";
    const painted = getComputedStyle(source);
    clone.style.background = painted.background;
    clone.style.color = painted.color;
    clone.style.borderRadius = painted.borderRadius;
    clone.setAttribute("xmlns", "http://www.w3.org/1999/xhtml");
    const markup = new XMLSerializer().serializeToString(clone);
    const tone = document.documentElement.dataset.tone ?? "";
    const scheme = tone === "dark" ? "dark" : "light";
    const svg = [
      `<svg xmlns="http://www.w3.org/2000/svg" width="${from.w}" height="${from.h}">`,
      `<foreignObject width="100%" height="100%">`,
      `<div xmlns="http://www.w3.org/1999/xhtml" data-tone="${tone}" style="width:${from.w}px;height:${from.h}px;overflow:hidden;margin:0;color-scheme:${scheme}">`,
      `<style><![CDATA[${pageCss().replace(/]]>/g, "]]]]><![CDATA[>")}]]></style>`,
      markup,
      `</div></foreignObject></svg>`,
    ].join("");
    const url = URL.createObjectURL(new Blob([svg], { type: "image/svg+xml;charset=utf-8" }));
    const image = new Image();
    image.src = url;
    await image.decode();
    URL.revokeObjectURL(url);
    if (!image.naturalWidth) return null;
    const bitmap = document.createElement("canvas");
    bitmap.width = Math.max(1, Math.round(from.w));
    bitmap.height = Math.max(1, Math.round(from.h));
    const ctx = bitmap.getContext("2d", { alpha: true });
    if (!ctx) return null;
    ctx.drawImage(image, 0, 0, bitmap.width, bitmap.height);
    return bitmap;
  } catch {
    return null;
  }
}

function paint(
  ctx: CanvasRenderingContext2D,
  bitmap: HTMLCanvasElement,
  progress: number,
  from: Rect,
  to: Rect,
  origin: Rect,
  coupled: boolean,
) {
  const lines = genieRows(progress, from, to, STRIPS, coupled);
  const band = from.h / STRIPS;
  const srcW = bitmap.width;
  const srcH = bitmap.height;
  const scaleY = srcH / from.h;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
  ctx.imageSmoothingEnabled = true;
  for (let i = 0; i < STRIPS; i += 1) {
    const top = lines[i];
    const bottom = lines[i + 1];
    if (!top || !bottom) continue;
    const x0 = Math.min(top.x0, bottom.x0);
    const x1 = Math.max(top.x1, bottom.x1);
    const y = top.y - origin.y;
    const height = Math.max(0.4, bottom.y - top.y + 1);
    ctx.drawImage(bitmap, 0, i * band * scaleY, srcW, band * scaleY + 1, x0 - origin.x, y, Math.max(0.4, x1 - x0), height);
  }
  ctx.globalCompositeOperation = "destination-in";
  ctx.beginPath();
  const first = lines[0];
  if (first) ctx.moveTo(first.x0 - origin.x, first.y - origin.y);
  for (let i = 1; i < lines.length; i += 1) {
    const row = lines[i];
    if (row) ctx.lineTo(row.x0 - origin.x, row.y - origin.y);
  }
  for (let i = lines.length - 1; i >= 0; i -= 1) {
    const row = lines[i];
    if (row) ctx.lineTo(row.x1 - origin.x, row.y - origin.y);
  }
  ctx.closePath();
  ctx.fill();
  ctx.globalCompositeOperation = "source-over";
}

export function playGenie(
  source: HTMLElement,
  from: Rect,
  to: Rect,
  direction: "in" | "out",
  onCover?: () => void,
  onReveal?: () => void,
): { cancel: () => void; done: Promise<boolean> } {
  let settled = false;
  let aborted = false;
  let raf = 0;
  let canvas: HTMLCanvasElement | null = null;
  let resolveDone: (finished: boolean) => void = () => {};
  const done = new Promise<boolean>((resolve) => {
    resolveDone = resolve;
  });

  function finish(finished: boolean) {
    if (settled) return;
    settled = true;
    aborted = true;
    if (raf) cancelAnimationFrame(raf);
    canvas?.remove();
    resolveDone(finished);
  }

  if (prefersReducedMotion() || from.w < 2 || from.h < 2 || to.w < 2 || to.h < 2) {
    queueMicrotask(() => finish(true));
    return { cancel: () => finish(false), done };
  }

  void Promise.race([
    snapshot(source, from),
    new Promise<HTMLCanvasElement | null>((resolve) => {
      window.setTimeout(() => resolve(null), 1000);
    }),
  ]).then((image) => {
    if (aborted || settled) return;
    if (!image) {
      finish(true);
      return;
    }
    const bounds = motionBounds(from, to);
    const origin = {
      x: Math.round(bounds.x),
      y: Math.round(bounds.y),
      w: Math.max(1, Math.round(bounds.w)),
      h: Math.max(1, Math.round(bounds.h)),
    };
    canvas = document.createElement("canvas");
    canvas.className = "task-genie";
    canvas.setAttribute("aria-hidden", "true");
    canvas.width = origin.w;
    canvas.height = origin.h;
    canvas.style.left = `${origin.x}px`;
    canvas.style.top = `${origin.y}px`;
    canvas.style.width = `${origin.w}px`;
    canvas.style.height = `${origin.h}px`;
    const ctx = canvas.getContext("2d", { alpha: true, desynchronized: true });
    if (!ctx) {
      finish(false);
      return;
    }
    document.body.appendChild(canvas);
    onCover?.();
    const started = performance.now();
    const frame = (now: number) => {
      if (settled || !canvas) return;
      const raw = Math.min(1, (now - started) / DURATION);
      const coupled = direction === "out";
      const progress = raw >= 1 ? (direction === "in" ? 1 : 0) : coupled ? (1 - raw) ** 3 : raw;
      paint(ctx, image, progress, from, to, origin, coupled);
      const opacity = opacityFor(progress, direction);
      if (canvas.style.opacity !== String(opacity)) canvas.style.opacity = String(opacity);
      if (raw < 1) {
        raf = requestAnimationFrame(frame);
        return;
      }
      // Show the real window under the last frame, then drop the bitmap
      // on the next frame so the expand doesn't blink or jump.
      if (direction === "out") onReveal?.();
      raf = requestAnimationFrame(() => finish(true));
    };
    frame(started);
  });

  return {
    cancel: () => finish(false),
    done,
  };
}
