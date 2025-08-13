import { test, before, after } from "node:test";
import assert from "node:assert";
import FoldersHive from "../folders-hive.js";
import HiveThriftClient from "../hiveThriftClient.js";

let foldersHive;
let hiveClient;

const testDB = "test_db_" + Date.now();
const testTable = "test_table";

before(async () => {
  const config = {
    host: "localhost",
    port: 10000,
  };
  foldersHive = new FoldersHive("hive", config);

  hiveClient = new HiveThriftClient(config);
  await hiveClient.connect();

  // Setup: Create a database and a table
  await hiveClient.execute(`CREATE DATABASE IF NOT EXISTS ${testDB}`);
  await hiveClient.execute(`USE ${testDB}`);
  await hiveClient.execute(`CREATE TABLE ${testTable} (id INT, name STRING)`);
  await hiveClient.execute(`INSERT INTO ${testTable} VALUES (1, 'foo'), (2, 'bar')`);
});

after(async () => {
  // Teardown: Drop the database
  if (hiveClient) {
    await hiveClient.execute(`DROP DATABASE IF EXISTS ${testDB} CASCADE`);
    await hiveClient.disconnect();
  }
});

test("FoldersHive integration tests", async (t) => {
  await t.test("should list databases", async () => {
    const dbs = await foldersHive.ls("/");
    assert.ok(Array.isArray(dbs));
    const db = dbs.find((db) => db.name === testDB.toLowerCase());
    assert.ok(db, `Database '${testDB}' should exist.`);
  });

  await t.test("should list tables in a database", async () => {
    const tables = await foldersHive.ls(`/${testDB}`);
    assert.ok(Array.isArray(tables));
    assert.strictEqual(tables.length, 1);
    assert.strictEqual(tables[0].name, testTable);
  });

  await t.test("should cat select.md to get table content", async () => {
    const { stream } = await foldersHive.cat(`/${testDB}/${testTable}/select.md`);
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
    const { stream } = await foldersHive.cat(`/${testDB}/${testTable}/columns.md`);
    const content = await new Promise((resolve, reject) => {
      let data = "";
      stream.on("data", (chunk) => (data += chunk));
      stream.on("end", () => resolve(data));
      stream.on("error", reject);
    });
    assert.ok(content.includes("| id | int |"), "Schema should include id column");
    assert.ok(
      content.includes("| name | string |"),
      "Schema should include name column"
    );
  });
});
