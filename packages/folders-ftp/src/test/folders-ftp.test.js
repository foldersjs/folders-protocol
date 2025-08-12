import { test, mock } from "node:test";
import assert from "node:assert";
import FoldersFtp from "../folders-ftp.js";

test("FoldersFtp", async (t) => {
  let ftp;
  const mockFtp = {
    raw: {
      cwd: (path, cb) => cb(null),
    },
    ls: (path, cb) => cb(null, []),
  };

  t.beforeEach(() => {
    const options = {
      connectionString: "ftp://user:pass@localhost:21",
    };
    ftp = new FoldersFtp("test", options);
    mock.method(ftp, "prepare", () => mockFtp);
  });

  await t.test("ls should list files in a directory", (t, done) => {
    const path = "/";
    const files = [
      { name: "file1.txt", type: "0", size: 123 },
      { name: "folder1", type: "1", size: 0 },
    ];

    mockFtp.raw.cwd = (p, cb) => cb(null);
    mockFtp.ls = (p, cb) => cb(null, files);

    ftp.ls(path, (err, result) => {
      assert.strictEqual(err, null);
      assert.strictEqual(result.length, 2);
      assert.strictEqual(result[0].name, "file1.txt");
      assert.strictEqual(result[1].name, "folder1");
      assert.strictEqual(result[1].extension, "+folder");
      done();
    });
  });

  await t.test("ls should return an error if cwd fails", (t, done) => {
    const path = "/";
    const error = new Error("CWD failed");

    mockFtp.raw.cwd = (p, cb) => cb(error);

    ftp.ls(path, (err, result) => {
      assert.deepStrictEqual(err, error);
      assert.strictEqual(result, undefined);
      done();
    });
  });

  await t.test("ls should return an error if ls fails", (t, done) => {
    const path = "/";
    const error = new Error("LS failed");

    mockFtp.raw.cwd = (p, cb) => cb(null);
    mockFtp.ls = (p, cb) => cb(error);

    ftp.ls(path, (err, result) => {
      assert.deepStrictEqual(err, error);
      assert.strictEqual(result, undefined);
      done();
    });
  });
});
