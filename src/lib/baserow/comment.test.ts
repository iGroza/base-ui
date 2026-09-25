import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { appendComment, chronologicalComments, commentDocument, commentLanded } from "./comment.ts";

describe("comment publishing", () => {
  it("builds a prose document Base can store as a row comment", () => {
    assert.deepEqual(commentDocument("Первая\n\nВторая"), {
      type: "doc",
      content: [
        { type: "paragraph", content: [{ type: "text", text: "Первая" }] },
        { type: "paragraph" },
        { type: "paragraph", content: [{ type: "text", text: "Вторая" }] },
      ],
    });
  });

  it("treats an echoed field as saved and an empty echo as missed", () => {
    assert.equal(commentLanded("было\n\n— сегодня\nтекст", "было\n\n— сегодня\nтекст"), true);
    assert.equal(commentLanded("было\n\n— сегодня\nтекст", "", "— сегодня\nтекст"), false);
    assert.equal(commentLanded("полный", "другой текст\n\n— сегодня\nтекст", "— сегодня\nтекст"), true);
  });

  it("appends a comment without duplicating it", () => {
    assert.equal(appendComment("решение", "— сегодня\nтекст"), "решение\n\n— сегодня\nтекст");
    assert.equal(appendComment("решение\n\n— сегодня\nтекст", "— сегодня\nтекст"), "решение\n\n— сегодня\nтекст");
  });

  it("puts the newest comment at the bottom", () => {
    const reversed = "— 24 сент., 22:44\ntest\n\n— 23 сент., 18:25\nраньше";
    assert.equal(chronologicalComments(reversed), "— 23 сент., 18:25\nраньше\n\n— 24 сент., 22:44\ntest");
    assert.equal(
      appendComment(reversed, "— 25 сент., 09:01\nещё"),
      "— 23 сент., 18:25\nраньше\n\n— 24 сент., 22:44\ntest\n\n— 25 сент., 09:01\nещё",
    );
  });
});
