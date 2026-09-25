import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { minimizedAfterFocus } from "./window-focus.ts";

describe("minimizedAfterFocus", () => {
  it("leaves other minimized windows collapsed when a new task is opened", () => {
    const minimized = { "12": true, "18": true };
    const next = minimizedAfterFocus(minimized, "34");
    assert.equal(next, minimized);
    assert.equal(next["12"], true);
    assert.equal(next["18"], true);
  });

  it("does not reopen the previous front window just because it is still last", () => {
    const minimized = { "12": true };
    const staleFront = "12";
    const next = minimizedAfterFocus(minimized, "34");
    assert.equal(next[staleFront], true);
  });

  it("restores only the task that was opened again", () => {
    const next = minimizedAfterFocus({ "12": true, "18": true }, "12");
    assert.deepEqual(next, { "12": false, "18": true });
  });

  it("ignores an empty request", () => {
    const minimized = { "12": true };
    assert.equal(minimizedAfterFocus(minimized, ""), minimized);
  });
});
