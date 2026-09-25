import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { arrangeWindows, windowLayer } from "./window-layout.ts";

const viewport = { width: 1280, height: 800 };

describe("windowLayer", () => {
  it("puts the selected window above pinned ones", () => {
    const order = ["pinned", "plain"];
    const pinned = { pinned: true };
    assert.ok(windowLayer("plain", order, pinned) > windowLayer("pinned", order, pinned));
    assert.equal(windowLayer("plain", order, pinned), 170);
    assert.ok(windowLayer("plain", order, pinned) < 180);
  });
});

describe("arrangeWindows", () => {
  it("places two windows side by side without overlap", () => {
    const boxes = arrangeWindows(["a", "b"], "split", viewport);
    assert.ok(boxes.a && boxes.b);
    assert.ok(boxes.a.x + boxes.a.w <= boxes.b.x);
    assert.ok(boxes.b.x + boxes.b.w <= viewport.width - 16);
  });

  it("gives the focused window the wide pane", () => {
    const boxes = arrangeWindows(["a", "b", "c"], "focus", viewport, "b");
    assert.ok(boxes.b && boxes.a && boxes.c);
    assert.ok(boxes.b.w > boxes.a.w);
    assert.equal(boxes.a.x, boxes.c.x);
  });
});
