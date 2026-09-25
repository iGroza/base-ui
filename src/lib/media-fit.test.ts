import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { fitInside } from "./media-fit.ts";

describe("fitInside", () => {
  it("shrinks a wide photo to the view width", () => {
    assert.deepEqual(fitInside({ width: 800, height: 600 }, { width: 4000, height: 1000 }), {
      width: 800,
      height: 200,
    });
  });

  it("shrinks a tall photo to the view height", () => {
    assert.deepEqual(fitInside({ width: 800, height: 600 }, { width: 1000, height: 4000 }), {
      width: 150,
      height: 600,
    });
  });

  it("leaves a smaller photo at its own size", () => {
    assert.deepEqual(fitInside({ width: 800, height: 600 }, { width: 100, height: 80 }), {
      width: 100,
      height: 80,
    });
  });

  it("stays inside the view for awkward ratios", () => {
    const samples = [
      [390, 700, 5000, 800],
      [320, 480, 900, 4000],
      [1280, 800, 2400, 900],
      [100, 100, 1, 10000],
      [176, 640, 8000, 4500],
    ];
    for (const [viewWidth, viewHeight, naturalWidth, naturalHeight] of samples) {
      const fitted = fitInside(
        { width: viewWidth, height: viewHeight },
        { width: naturalWidth, height: naturalHeight },
      );
      assert.ok(fitted.width >= 1 && fitted.width <= viewWidth);
      assert.ok(fitted.height >= 1 && fitted.height <= viewHeight);
      assert.ok(fitted.width <= naturalWidth);
      assert.ok(fitted.height <= naturalHeight);
    }
  });

  it("returns an empty box when the view or the photo has no size", () => {
    assert.deepEqual(fitInside({ width: 0, height: 400 }, { width: 800, height: 600 }), {
      width: 0,
      height: 0,
    });
    assert.deepEqual(fitInside({ width: 400, height: 300 }, { width: 0, height: 0 }), {
      width: 0,
      height: 0,
    });
  });
});
