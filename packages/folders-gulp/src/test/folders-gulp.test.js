import { test, mock } from "node:test";
import assert from "node:assert";
import FoldersGulp from "../folders-gulp.js";
import LsTo from "../helpers/ls-to.js";
import LsFrom from "../helpers/ls-from.js";
import CatTo from "../helpers/cat-to.js";
import CatFrom from "../helpers/cat-from.js";
import WriteFrom from "../helpers/write-from.js";
import WriteTo from "../helpers/write-to.js";

test("FoldersGulp", async (t) => {
  const options = {
    provider: "ftp",
    connectionString: "ftp://user:pass@localhost:21",
  };

  await t.test("constructor should set default provider to ftp", () => {
    const foldersGulp = new FoldersGulp("test", {});
    assert.strictEqual(foldersGulp.provider, "ftp");
  });

  await t.test("constructor should use the provided provider", () => {
    const foldersGulp = new FoldersGulp("test", { provider: "s3" });
    assert.strictEqual(foldersGulp.provider, "s3");
  });

  await t.test("lsTo should return a new LsTo instance", () => {
    const foldersGulp = new FoldersGulp("test", options);
    const path = "/test";
    const lsTo = foldersGulp.lsTo(path);
    assert.ok(lsTo instanceof LsTo);
  });

  await t.test("lsFrom should return a new LsFrom instance", () => {
    const foldersGulp = new FoldersGulp("test", options);
    const lsFrom = foldersGulp.lsFrom();
    assert.ok(lsFrom instanceof LsFrom);
  });

  await t.test("catTo should return a new CatTo instance", () => {
    const foldersGulp = new FoldersGulp("test", options);
    const path = "/test";
    const catTo = foldersGulp.catTo(path);
    assert.ok(catTo instanceof CatTo);
  });

  await t.test("catFrom should return a new CatFrom instance", () => {
    const foldersGulp = new FoldersGulp("test", options);
    const catFrom = foldersGulp.catFrom();
    assert.ok(catFrom instanceof CatFrom);
  });

  await t.test("writeFrom should return a new WriteFrom instance", () => {
    const foldersGulp = new FoldersGulp("test", options);
    const path = "/test";
    const cb = () => {};
    const writeFrom = foldersGulp.writeFrom(path, cb);
    assert.ok(writeFrom instanceof WriteFrom);
  });

  await t.test("writeTo should return a new WriteTo instance", () => {
    const foldersGulp = new FoldersGulp("test", options);
    const path = "/test";
    const writeTo = foldersGulp.writeTo(path);
    assert.ok(writeTo instanceof WriteTo);
  });
});
