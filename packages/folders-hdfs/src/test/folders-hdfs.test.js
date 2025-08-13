import { test, before, after } from "node:test";
import assert from "node:assert";
import fs from "node:fs";
import FoldersHdfs from "../folders-hdfs.js";
import { Readable, PassThrough } from "stream";
import memoryStorageHandler from "../embedded-memory-based-proxy.js";

let hdfs;

const prefix = "/http_window.io_0:webhdfs/";
const url = `http://localhost:9870/webhdfs/v1/`;

before(() => {
  const options = {
    baseurl: url,
    username: "testuser",
  };
  hdfs = new FoldersHdfs(prefix, options);
});

test("FoldersHdfs unit tests", async (t) => {
  const mockFetch = async (url, options) => {
    const urlObj = new URL(url);
    const operation = urlObj.searchParams.get("op");
    const path = urlObj.pathname;
    const params = Object.fromEntries(urlObj.searchParams.entries());

    if (
      options?.redirect === "manual" &&
      (operation === "CREATE" || operation === "OPEN" || operation === "APPEND")
    ) {
      return {
        status: 307,
        headers: {
          get: (header) => {
            if (header.toLowerCase() === "location") {
              return url.toString(); // Redirect to the same URL for the mock
            }
            return null;
          },
        },
      };
    }

    const req = new PassThrough();
    if (options?.body) {
      if (options.body instanceof Readable) {
        options.body.pipe(req);
      } else {
        req.end(options.body);
      }
    } else {
      req.end();
    }
    req.method = options?.method || "GET";

    return new Promise((resolve, reject) => {
      const res = {
        _headers: {},
        _statusCode: 200,
        _body: null,
        writeHead: function (statusCode, headers) {
          this._statusCode = statusCode;
          this._headers = headers;
        },
        end: function (body) {
          this._body = body;
        },
      };

      const next = (err) => {
        if (err) return reject(err);

        const response = {
          status: res._statusCode,
          headers: {
            get: (header) => res._headers[header.toLowerCase()],
          },
          async json() {
            return JSON.parse(res._body || "{}");
          },
          async text() {
            return res._body;
          },
          body: res._body ? Readable.from(res._body) : null,
        };
        resolve(response);
      };

      memoryStorageHandler(null, path, operation, params, req, res, next);
    });
  };

  t.mock.method(globalThis, "fetch", mockFetch);
  t.beforeEach(() => {
    memoryStorageHandler.clear();
  });

  const testFolder = "test-folder";
  const testFile = "test.txt";
  const testFilePath = `${testFolder}/${testFile}`;
  const testContent = "hello world";

  await t.test("should create a directory", async () => {
    const result = await hdfs.mkdir(testFolder);
    assert.strictEqual(result.boolean, true);
  });

  await t.test("should write a file", async () => {
    await hdfs.mkdir(testFolder);
    const stream = Readable.from(testContent);
    const result = await hdfs.write(testFilePath, stream);
    assert.strictEqual(result, "write uri success");
  });

  await t.test("should list files in a directory", async () => {
    await hdfs.mkdir(testFolder);
    const stream = Readable.from(testContent);
    await hdfs.write(testFilePath, stream);
    const files = await hdfs.ls(testFolder);
    assert.strictEqual(files.length, 1);
    assert.strictEqual(files[0].name, testFile);
    assert.strictEqual(files[0].size, testContent.length);
  });

  await t.test("should cat a file", async () => {
    await hdfs.mkdir(testFolder);
    const stream = Readable.from(testContent);
    await hdfs.write(testFilePath, stream);
    const { stream: catStream, size } = await hdfs.cat(testFilePath);
    const content = await new Promise((resolve, reject) => {
      let data = "";
      catStream.on("data", (chunk) => (data += chunk));
      catStream.on("end", () => resolve(data));
      catStream.on("error", reject);
    });
    assert.strictEqual(size, testContent.length);
    assert.strictEqual(content, testContent);
  });

  await t.test("should unlink a file", async () => {
    await hdfs.mkdir(testFolder);
    const stream = Readable.from(testContent);
    await hdfs.write(testFilePath, stream);
    const result = await hdfs.unlink(testFilePath);
    assert.strictEqual(result.boolean, true);
  });

  await t.test("should unlink a directory", async () => {
    await hdfs.mkdir(testFolder);
    const result = await hdfs.unlink(testFolder);
    assert.strictEqual(result.boolean, true);
  });
});
