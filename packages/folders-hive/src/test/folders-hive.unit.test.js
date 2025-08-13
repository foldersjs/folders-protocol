import { test, before, after, mock } from "node:test";
import assert from "node:assert";
import FoldersHive from "../folders-hive.js";
import HiveThriftClient from "../hiveThriftClient.js";

let foldersHive;

before(() => {
  mock.method(HiveThriftClient.prototype, "connect", async () => {});
  mock.method(HiveThriftClient.prototype, "disconnect", async () => {});

  mock.method(HiveThriftClient.prototype, "getSchemasNames", async () => {
    return ["default", "folders"];
  });

  mock.method(HiveThriftClient.prototype, "getTablesNames", async (db) => {
    if (db === "folders") {
      return ["test", "users"];
    }
    return [];
  });

  mock.method(
    HiveThriftClient.prototype,
    "getTableRecords",
    async (db, table) => {
      if (db === "folders" && table === "test") {
        return [
          ["col1", "col2"],
          ["val1", "val2"],
        ];
      }
      return [];
    },
  );

  mock.method(
    HiveThriftClient.prototype,
    "showCreateTable",
    async (db, table) => {
      if (db === "folders" && table === "test") {
        return "CREATE TABLE test (col1 string, col2 string)";
      }
      return "";
    },
  );

  mock.method(
    HiveThriftClient.prototype,
    "getTableColumns",
    async (db, table) => {
      if (db === "folders" && table === "test") {
        return [
          ["col_name", "data_type", "comment"],
          ["col1", "string", ""],
          ["col2", "string", ""],
        ];
      }
      return [];
    },
  );

  const config = {
    host: "localhost",
    port: 10000,
  };
  const prefix = "folders.io_0:hive";
  foldersHive = new FoldersHive(prefix, config);
});

after(() => {
  mock.restoreAll();
});

test("FoldersHive unit tests", async (t) => {
  await t.test("should list databases", async () => {
    const databases = await foldersHive.ls("/");
    assert.ok(Array.isArray(databases));
    assert.strictEqual(databases.length, 2);
    assert.ok(databases.find((d) => d.name === "folders"));
  });

  await t.test("should list tables", async () => {
    const tables = await foldersHive.ls("/folders");
    assert.ok(Array.isArray(tables));
    assert.strictEqual(tables.length, 2);
    assert.ok(tables.find((t) => t.name === "test"));
  });

  await t.test("should list table metadata", async () => {
    const metadata = await foldersHive.ls("/folders/test");
    assert.ok(Array.isArray(metadata));
    assert.strictEqual(metadata.length, 3);
  });

  await t.test("should cat columns.md", async () => {
    const { stream, size } = await foldersHive.cat("/folders/test/columns.md");
    assert.ok(stream);
    assert.ok(size > 0);
  });

  await t.test("should cat create_table.md", async () => {
    const { stream, size } = await foldersHive.cat(
      "/folders/test/create_table.md",
    );
    assert.ok(stream);
    assert.ok(size > 0);
  });

  await t.test("should cat select.md", async () => {
    const { stream, size } = await foldersHive.cat("/folders/test/select.md");
    assert.ok(stream);
    assert.ok(size > 0);
  });
});
