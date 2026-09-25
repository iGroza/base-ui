export type WindowBox = { x: number; y: number; w: number; h: number };

export type WindowLayout = "cascade" | "grid" | "split" | "trio" | "row" | "column" | "focus";

const PAD_X = 16;
const PAD_TOP = 72;
const PAD_RIGHT = 88;
const PAD_BOTTOM = 24;
const GAP = 12;

function area(viewport: { width: number; height: number }) {
  return {
    x: PAD_X,
    y: PAD_TOP,
    w: Math.max(160, viewport.width - PAD_X - PAD_RIGHT),
    h: Math.max(160, viewport.height - PAD_TOP - PAD_BOTTOM),
  };
}

function placeGrid(keys: string[], cols: number, viewport: { width: number; height: number }) {
  const frame = area(viewport);
  const columns = Math.max(1, Math.min(cols, keys.length));
  const rows = Math.max(1, Math.ceil(keys.length / columns));
  const w = Math.floor((frame.w - GAP * (columns - 1)) / columns);
  const h = Math.floor((frame.h - GAP * (rows - 1)) / rows);
  const boxes: Record<string, WindowBox> = {};
  keys.forEach((key, index) => {
    const column = index % columns;
    const row = Math.floor(index / columns);
    boxes[key] = {
      x: frame.x + column * (w + GAP),
      y: frame.y + row * (h + GAP),
      w,
      h,
    };
  });
  return boxes;
}

export function arrangeWindows(
  keys: string[],
  layout: WindowLayout,
  viewport: { width: number; height: number },
  focusKey?: string,
): Record<string, WindowBox> {
  if (!keys.length) return {};
  if (layout === "cascade") {
    const frame = area(viewport);
    const w = Math.min(860, frame.w);
    const h = Math.min(720, frame.h);
    const boxes: Record<string, WindowBox> = {};
    keys.forEach((key, index) => {
      boxes[key] = {
        x: frame.x + 24 + index * 28,
        y: frame.y + index * 28,
        w,
        h,
      };
    });
    return boxes;
  }
  if (layout === "grid") {
    const cols = keys.length <= 1 ? 1 : keys.length <= 4 ? 2 : 3;
    return placeGrid(keys, cols, viewport);
  }
  if (layout === "split") return placeGrid(keys, 2, viewport);
  if (layout === "trio") return placeGrid(keys, 3, viewport);
  if (layout === "row") return placeGrid(keys, keys.length, viewport);
  if (layout === "column") return placeGrid(keys, 1, viewport);

  const frame = area(viewport);
  const main = focusKey && keys.includes(focusKey) ? focusKey : keys[keys.length - 1]!;
  const rest = keys.filter((key) => key !== main);
  if (!rest.length) {
    return { [main]: { x: frame.x, y: frame.y, w: frame.w, h: frame.h } };
  }
  const sideW = Math.max(160, Math.floor(frame.w * 0.32));
  const mainW = frame.w - GAP - sideW;
  const sideH = Math.floor((frame.h - GAP * (rest.length - 1)) / rest.length);
  const boxes: Record<string, WindowBox> = {
    [main]: { x: frame.x, y: frame.y, w: mainW, h: frame.h },
  };
  rest.forEach((key, index) => {
    boxes[key] = {
      x: frame.x + mainW + GAP,
      y: frame.y + index * (sideH + GAP),
      w: sideW,
      h: sideH,
    };
  });
  return boxes;
}

/** Focused window sits above pinned ones, and every window stays under popovers (z 180+). */
export function windowLayer(key: string, order: string[], pinned: Record<string, boolean>) {
  const focused = order.at(-1);
  if (key === focused) return 170;
  const peers = order.filter((item) => item !== focused && Boolean(pinned[item]) === Boolean(pinned[key]));
  const index = Math.min(50, Math.max(0, peers.indexOf(key)));
  return (pinned[key] ? 100 : 40) + index;
}
