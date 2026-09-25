import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { genieRows, type Rect } from "./genie.ts";

const from: Rect = { x: 100, y: 80, w: 400, h: 300 };
const to: Rect = { x: 500, y: 700, w: 160, h: 36 };

function width(row: { x0: number; x1: number }) {
  return row.x1 - row.x0;
}

describe("genieRows", () => {
  it("starts as the window rectangle", () => {
    const rows = genieRows(0, from, to, 8);
    assert.equal(rows[0]?.y, 80);
    assert.equal(rows[0]?.x0, 100);
    assert.equal(rows[0]?.x1, 500);
    assert.equal(rows.at(-1)?.y, 380);
    assert.equal(rows.at(-1)?.x0, 100);
    assert.equal(rows.at(-1)?.x1, 500);
  });

  it("ends as the dock rectangle", () => {
    const rows = genieRows(1, from, to, 8);
    assert.ok(Math.abs((rows[0]?.y ?? 0) - 700) < 0.01);
    assert.ok(Math.abs((rows[0]?.x0 ?? 0) - 500) < 0.01);
    assert.ok(Math.abs((rows[0]?.x1 ?? 0) - 660) < 0.01);
    assert.ok(Math.abs((rows.at(-1)?.y ?? 0) - 736) < 0.01);
    assert.ok(Math.abs((rows.at(-1)?.x0 ?? 0) - 500) < 0.01);
    assert.ok(Math.abs((rows.at(-1)?.x1 ?? 0) - 660) < 0.01);
  });

  it("expand arrives as a rectangle with the top already traveling", () => {
    const landed = genieRows(0, from, to, 8, true);
    assert.equal(landed[0]?.y, 80);
    assert.equal(landed[0]?.x0, 100);
    assert.equal(landed.at(-1)?.y, 380);
    assert.equal(width(landed.at(-1) ?? { x0: 0, x1: 0 }), 400);
    const moving = genieRows(0.25, from, to, 8, true);
    assert.ok((moving[0]?.y ?? 0) > 80);
  });

  it("shears the bottom toward the dock before the top moves", () => {
    const rows = genieRows(0.25, from, to, 8);
    const top = rows[0];
    const bottom = rows.at(-1);
    assert.ok(top && bottom);
    assert.equal(top.y, 80);
    assert.ok(Math.abs(width(top) - 400) < 0.01);
    assert.ok(width(bottom) < width(top) - 20);
    assert.ok(bottom.x0 > top.x0);
    assert.equal(bottom.y, 380);
  });

  it("keeps rows ordered from top to bottom", () => {
    for (const progress of [0, 0.2, 0.45, 0.7, 1]) {
      const rows = genieRows(progress, from, to, 12);
      for (let i = 1; i < rows.length; i += 1) {
        assert.ok(rows[i]!.y >= rows[i - 1]!.y);
        assert.ok(rows[i]!.x1 > rows[i]!.x0);
      }
    }
  });
});
