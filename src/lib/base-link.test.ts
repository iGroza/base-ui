import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { taskIdFromBaseLink } from "./base-link.ts";

describe("taskIdFromBaseLink", () => {
  it("reads the row id from an original Base link with a view", () => {
    assert.equal(
      taskIdFromBaseLink("https://base.imshop.io/database/214/table/757/3357/row/9753"),
      "9753",
    );
    assert.equal(
      taskIdFromBaseLink("https://base.igroza.su/database/214/table/757/3357/row/9753"),
      "9753",
    );
  });

  it("reads the row id when the view segment is absent", () => {
    assert.equal(taskIdFromBaseLink("/database/214/table/757/row/9753"), "9753");
  });

  it("ignores a trailing slash and a query", () => {
    assert.equal(
      taskIdFromBaseLink("https://base.igroza.su/database/214/table/757/3357/row/9753/?foo=1"),
      "9753",
    );
  });

  it("does not treat other pages as a task", () => {
    assert.equal(taskIdFromBaseLink("https://base.imshop.io/database/214/table/757"), null);
    assert.equal(taskIdFromBaseLink("починить оплату"), null);
    assert.equal(taskIdFromBaseLink(""), null);
  });
});
