import { test, before, after } from "node:test";
import assert from "node:assert";
import FoldersPresto from "../folders-presto.js";
import { Client } from "presto-client";

let foldersPresto;
let prestoClient;

const testSchema = "test_schema_" + Date.now();
const testTable = "test_table";
const qualifiedTableName = `memory.${testSchema}.${testTable}`;

// Helper function to execute queries with the callback-based presto-client
const executeQuery = (query) => {
  return new Promise((resolve, reject) => {
    prestoClient.execute({
      query,
      user: "test",
      schema: "default",
      catalog: "memory",
      source: "test",
      state: (err, queryId, stats) => {
        if (err) console.error("Query state error:", err);
      },
      columns: (err, columns) => {
        if (err) console.error("Query columns error:", err);
      },
      data: (err, data, columns, stats) => {
        // This callback is for SELECT queries, but we can ignore it for DDL
      },
      success: (err, stats) => {
        if (err) return reject(err);
        resolve(stats);
      },
      error: (err) => {
        reject(err);
      },
    });
  });
};

before(async () => {
  foldersPresto = new FoldersPresto("presto", {
    host: "localhost",
    port: 8080,
    user: "test",
    catalog: "memory",
  });

  prestoClient = new Client({
    host: "localhost",
    port: 8080,
    user: "test",
    catalog: "memory",
    schema: "default",
  });

  // Setup: Create a schema and a table
  await executeQuery(`CREATE SCHEMA IF NOT EXISTS memory.${testSchema}`);
  await executeQuery(`CREATE TABLE ${qualifiedTableName} (id INTEGER, name VARCHAR)`);
  await executeQuery(`INSERT INTO ${qualifiedTableName} VALUES (1, 'foo'), (2, 'bar')`);
});

after(async () => {
  // Teardown: Drop the schema
  await executeQuery(`DROP SCHEMA IF EXISTS memory.${testSchema} CASCADE`);
  prestoClient.close();
});

test("FoldersPresto integration tests", async (t) => {
  await t.test("should list schemas (databases)", async () => {
    const dbs = await foldersPresto.ls("/");
    assert.ok(Array.isArray(dbs));
    const schema = dbs.find((db) => db.name === testSchema);
    assert.ok(schema, `Schema '${testSchema}' should exist.`);
  });

  await t.test("should list tables in a schema", async () => {
    const tables = await foldersPresto.ls(`/${testSchema}`);
    assert.ok(Array.isArray(tables));
    assert.strictEqual(tables.length, 1);
    assert.strictEqual(tables[0].name, testTable);
  });

  await t.test("should cat select.md to get table content", async () => {
    const { stream } = await foldersPresto.cat(
      `/${testSchema}/${testTable}/select.md`
    );
    const content = await new Promise((resolve, reject) => {
      let data = "";
      stream.on("data", (chunk) => (data += chunk));
      stream.on("end", () => resolve(data));
      stream.on("error", reject);
    });
    assert.ok(content.includes("| 1 | foo |"), "Content should include first row");
    assert.ok(content.includes("| 2 | bar |"), "Content should include second row");
  });

  await t.test("should cat columns.md to get table schema", async () => {
    const { stream } = await foldersPresto.cat(
      `/${testSchema}/${testTable}/columns.md`
    );
    const content = await new Promise((resolve, reject) => {
      let data = "";
      stream.on("data", (chunk) => (data += chunk));
      stream.on("end", () => resolve(data));
      stream.on("error", reject);
    });
    assert.ok(content.includes("| id | integer |"), "Schema should include id column");
    assert.ok(content.includes("| name | varchar |"), "Schema should include name column");
  });
});
