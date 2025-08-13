import { test, before, after, mock } from "node:test";
import assert from "node:assert";
import FoldersPresto from "../folders-presto.js";
import presto from "presto-client";

let foldersPresto;

// This is the mock data we'll use to respond to queries
const mockData = {
  "SHOW SCHEMAS": {
    data: [["default"], ["test_schema"]],
    columns: [{ name: "Schema" }],
  },
  "SHOW TABLES FROM test_schema": {
    data: [["test_table"]],
    columns: [{ name: "Table" }],
  },
  "SELECT * FROM test_schema.test_table LIMIT 10": {
    data: [
      [1, "hello"],
      [2, "world"],
    ],
    columns: [{ name: "id" }, { name: "value" }],
  },
  "SHOW COLUMNS FROM test_schema.test_table": {
    data: [
      ["id", "integer", "", ""],
      ["value", "varchar", "", ""],
    ],
    columns: [
      { name: "Column" },
      { name: "Type" },
      { name: "Extra" },
      { name: "Comment" },
    ],
  },
};

before(() => {
  // Mock the execute method on the prototype. This is more robust.
  mock.method(
    presto.Client.prototype,
    "execute",
    function (query, callback) {
      const result = mockData[query];
      if (result) {
        callback(null, result.data, result.columns);
      } else {
        callback(new Error(`Unhandled mock query: ${query}`), [], []);
      }
    },
  );

  const config = {
    host: "localhost",
    port: 8080,
    user: "test",
    catalog: "hive",
    schema: "default",
  };
  const prefix = "presto:";
  foldersPresto = new FoldersPresto(prefix, config);
});

after(() => {
  mock.restoreAll();
});

test("FoldersPresto ls tests", async (t) => {
  await t.test("should list schemas (databases)", async () => {
    const dbs = await foldersPresto.ls("/");
    assert.strictEqual(dbs.length, 2);
    assert.ok(dbs.find((db) => db.name === "test_schema"));
  });

  await t.test("should list tables", async () => {
    const tables = await foldersPresto.ls("/test_schema");
    assert.strictEqual(tables.length, 1);
    assert.strictEqual(tables[0].name, "test_table");
  });

  await t.test("should list table metadata files", async () => {
    const metas = await foldersPresto.ls("/test_schema/test_table");
    assert.strictEqual(metas.length, 2);
    assert.ok(metas.find((m) => m.name === "columns.md"));
    assert.ok(metas.find((m) => m.name === "select.md"));
  });
});

test("FoldersPresto cat tests", async (t) => {
  await t.test("should cat select.md", async () => {
    const { stream, size } = await foldersPresto.cat(
      "/test_schema/test_table/select.md",
    );
    assert.ok(stream);
    assert.ok(size > 0);
    const content = await new Promise((resolve) => {
      let data = "";
      stream.on("data", (chunk) => (data += chunk));
      stream.on("end", () => resolve(data));
    });
    assert.ok(content.includes("| id | value |"));
    assert.ok(content.includes("| 2  | world |"));
  });

  await t.test("should cat columns.md", async () => {
    const { stream, size } = await foldersPresto.cat(
      "/test_schema/test_table/columns.md",
    );
    assert.ok(stream);
    assert.ok(size > 0);
    const content = await new Promise((resolve) => {
      let data = "";
      stream.on("data", (chunk) => (data += chunk));
      stream.on("end", () => resolve(data));
    });
    assert.ok(content.includes("| Column | Type    | Extra | Comment |"));
    assert.ok(content.includes("| value  | varchar |"));
  });
});
