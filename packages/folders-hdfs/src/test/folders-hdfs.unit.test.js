import { test, before, after } from "node:test";
import assert from "node:assert";
import fs from "node:fs";
import FoldersHdfs from "../folders-hdfs.js";
import { Readable } from "stream";

let hdfs;

const prefix = "/http_window.io_0:webhdfs/";
const PORT = 40051; // Use a different port to avoid conflict with other tests
const url = `http://localhost:${PORT}/webhdfs/v1/`;

before(async () => {
  const options = {
    baseurl: url,
    username: "testuser",
    startEmbeddedProxy: true,
    backend: {
      provider: "memory",
      port: PORT,
    },
  };
  hdfs = new FoldersHdfs(prefix, options);
  await hdfs.start();
});

after(async () => {
  if (hdfs) {
    await hdfs.stop();
  }
});

test("FoldersHdfs integration tests", async (t) => {
  const testFolder = "test-folder";
  const testFile = "test.txt";
  const testFilePath = `${testFolder}/${testFile}`;
  const testContent = "hello world";

  await t.test("should create a directory", async () => {
    const result = await hdfs.mkdir(testFolder);
    assert.strictEqual(result.boolean, true);
  });

  await t.test("should write a file", async () => {
    const stream = Readable.from(testContent);
    const result = await hdfs.write(testFilePath, stream);
    assert.strictEqual(result, "write uri success");
  });

  await t.test("should list files in a directory", async () => {
    const files = await hdfs.ls(testFolder);
    assert.strictEqual(files.length, 1);
    assert.strictEqual(files[0].name, testFile);
    assert.strictEqual(files[0].size, testContent.length);
  });

  await t.test("should cat a file", async () => {
    const { stream, size } = await hdfs.cat(testFilePath);
    const content = await new Promise((resolve, reject) => {
      let data = "";
      stream.on("data", (chunk) => (data += chunk));
      stream.on("end", () => resolve(data));
      stream.on("error", reject);
    });
    assert.strictEqual(size, testContent.length);
    assert.strictEqual(content, testContent);
  });

  await t.test("should unlink a file", async () => {
    const result = await hdfs.unlink(testFilePath);
    assert.strictEqual(result.boolean, true);
  });

  await t.test("should unlink a directory", async () => {
    const result = await hdfs.unlink(testFolder);
    assert.strictEqual(result.boolean, true);
  });
});
