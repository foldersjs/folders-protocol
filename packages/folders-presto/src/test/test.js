import { test, before, after, mock } from "node:test";
import assert from "node:assert";
import FoldersPresto from "../folders-presto.js";
import presto from "presto-client";

let foldersPresto;

before(() => {
  const mockPrestoClient = class {
    constructor(options) {}
    async execute(query) {
      if (query === "SHOW SCHEMAS") {
        return { data: [["default"], ["testdb"]] };
      }
      if (query === "SHOW TABLES FROM testdb") {
        return { data: [["testtable"]] };
      }
      if (query.startsWith("SELECT *")) {
        return {
          data: [["val1", "val2"]],
          columns: [{ name: "col1" }, { name: "col2" }],
        };
      }
      if (query.startsWith("SHOW COLUMNS")) {
        return {
          data: [
            ["col1", "varchar", "", ""],
            ["col2", "varchar", "", ""],
          ],
          columns: [
            { name: "Column" },
            { name: "Type" },
            { name: "Extra" },
            { name: "Comment" },
          ],
        };
      }
    }
  };

  mock.method(presto, "Client", mockPrestoClient);

  foldersPresto = new FoldersPresto("presto", {
    host: "localhost",
    port: 8080,
    user: "test",
  });
});

after(() => {
  mock.restoreAll();
});

test("FoldersPresto unit tests", async (t) => {
  await t.test("should list databases", async () => {
    const dbs = await foldersPresto.ls("/");
    assert.strictEqual(dbs.length, 2);
    assert.strictEqual(dbs[0].name, "default");
  });

  await t.test("should list tables", async () => {
    const tables = await foldersPresto.ls("/testdb");
    assert.strictEqual(tables.length, 1);
    assert.strictEqual(tables[0].name, "testtable");
  });

  await t.test("should list table metadata", async () => {
    const metas = await foldersPresto.ls("/testdb/testtable");
    assert.strictEqual(metas.length, 2);
    assert.ok(metas.find((m) => m.name === "columns.md"));
  });

  await t.test("should cat select.md", async () => {
    const { stream, size } = await foldersPresto.cat(
      "/testdb/testtable/select.md",
    );
    assert.ok(stream);
    assert.ok(size > 0);
  });

  await t.test("should cat columns.md", async () => {
    const { stream, size } = await foldersPresto.cat(
      "/testdb/testtable/columns.md",
    );
    assert.ok(stream);
    assert.ok(size > 0);
  });
});
