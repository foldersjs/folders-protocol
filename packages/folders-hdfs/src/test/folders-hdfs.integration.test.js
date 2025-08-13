import { test, before, after } from "node:test";
import assert from "node:assert";
import fs from "node:fs";
import FoldersHdfs from "../folders-hdfs.js";
import { Readable } from "stream";

let hdfs;

const prefix = "/http_window.io_0:webhdfs/";
const PORT = 9870; // Port exposed by the Docker container
const url = `http://localhost:${PORT}/webhdfs/v1/`;

before(() => {
  // The username 'testuser' is passed as a query parameter to WebHDFS.
  // The Hadoop container will create the user's home directory on the fly.
  const options = {
    baseurl: url,
    username: "testuser",
  };
  hdfs = new FoldersHdfs(prefix, options);
  // The HDFS container is started by an external script, so no hdfs.start() is needed here.
});

after(() => {
  // The HDFS container is stopped by an external script, so no hdfs.stop() is needed here.
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
