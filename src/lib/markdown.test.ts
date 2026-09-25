import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { richTextToHtml } from "./utils.ts";

describe("richTextToHtml", () => {
  it("renders markdown in task text and comments", () => {
    const html = richTextToHtml("**жирный**\n\n- пункт\n\n`код`");
    assert.match(html, /<strong>жирный<\/strong>/);
    assert.match(html, /<li>пункт<\/li>/);
    assert.match(html, /<code>код<\/code>/);
  });

  it("keeps images clickable and links safe", () => {
    const html = richTextToHtml("![схема](https://cdn.example/a.png)\nhttps://cdn.example/b.jpg");
    assert.match(html, /class="rich-image"/);
    assert.match(html, /src="https:\/\/cdn\.example\/a\.png"/);
    assert.match(html, /src="https:\/\/cdn\.example\/b\.jpg"/);
    const hostile = richTextToHtml("[клик](javascript:alert(1))\n\n<script>alert(1)</script>");
    assert.doesNotMatch(hostile, /<script>/);
    assert.doesNotMatch(hostile, /javascript:/);
  });
});
