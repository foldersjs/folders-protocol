import { test, mock } from "node:test";
import assert from "node:assert";
import { Client } from "ssh2";
import FoldersSsh from "../folders-ssh.js";
import stream from "node:stream";
import fs from "fs";

test("FoldersSsh", async (t) => {
  let ssh;
  let sftpMock;

  t.beforeEach(() => {
    const options = {
      connectionString: "ssh://user:pass@localhost:22",
    };
    ssh = new FoldersSsh("test", options);

    sftpMock = {
      readdir: mock.fn(),
      stat: mock.fn(),
      createReadStream: mock.fn(),
      createWriteStream: mock.fn(),
      unlink: mock.fn(),
      rmdir: mock.fn(),
      mkdir: mock.fn(),
    };

    const clientMock = {
      on: (event, callback) => {
        if (event === "ready") {
          callback();
        }
        return clientMock;
      },
      sftp: (callback) => {
        callback(null, sftpMock);
      },
      connect: mock.fn(),
      end: mock.fn(),
    };

    mock.method(fs, "readFileSync", () => "private key");
    mock.method(Client.prototype, "on", clientMock.on);
    mock.method(Client.prototype, "connect", clientMock.connect);
    mock.method(Client.prototype, "sftp", clientMock.sftp);
    mock.method(Client.prototype, "end", clientMock.end);
  });

  t.afterEach(() => {
    mock.restoreAll();
  });

  await t.test("ls should list files in a directory", async () => {
    const files = [
      { filename: "file1.txt", longname: "-rw-r--r--", attrs: { size: 123 } },
      { filename: "folder1", longname: "drwxr-xr-x", attrs: { size: 0 } },
    ];
    sftpMock.readdir.mock.mockImplementation((path, options, cb) =>
      cb(null, files),
    );

    const result = await ssh.ls("/");

    assert.strictEqual(result.length, 2);
    assert.strictEqual(result[0].name, "file1.txt");
    assert.strictEqual(result[1].name, "folder1");
    assert.strictEqual(result[1].extension, "+folder");
  });

  await t.test("cat should return a stream for a file", async () => {
    const fileStat = { size: 123 };
    const fileStream = new stream.Readable();
    fileStream.push("file content");
    fileStream.push(null);

    sftpMock.stat.mock.mockImplementation((path, cb) => cb(null, fileStat));
    sftpMock.createReadStream.mock.mockImplementation(() => fileStream);

    const result = await ssh.cat("/file1.txt");

    assert.strictEqual(result.size, 123);
    assert.strictEqual(result.name, "file1.txt");
    assert.ok(result.stream instanceof stream.Readable);
  });

  await t.test("write should upload a file", async () => {
    const writeStream = new stream.PassThrough();
    sftpMock.createWriteStream.mock.mockImplementation(() => writeStream);

    const data = new stream.Readable();
    data.push("file content");
    data.push(null);

    const promise = ssh.write("/file1.txt", data);
    writeStream.emit("finish");
    const result = await promise;

    assert.strictEqual(result, "write uri success");
  });

  await t.test("unlink should delete a file", async () => {
    sftpMock.unlink.mock.mockImplementation((path, cb) => cb(null));
    await ssh.unlink("/file1.txt");
    assert.strictEqual(
      sftpMock.unlink.mock.calls[0].arguments[0],
      "/file1.txt",
    );
  });

  await t.test("rmdir should delete a directory", async () => {
    sftpMock.rmdir.mock.mockImplementation((path, cb) => cb(null));
    await ssh.rmdir("/folder1");
    assert.strictEqual(sftpMock.rmdir.mock.calls[0].arguments[0], "/folder1");
  });

  await t.test("mkdir should create a directory", async () => {
    sftpMock.mkdir.mock.mockImplementation((path, cb) => cb(null));
    await ssh.mkdir("/folder1");
    assert.strictEqual(sftpMock.mkdir.mock.calls[0].arguments[0], "/folder1");
  });

  await t.test("stat should return file stats", async () => {
    const fileStat = { size: 123 };
    sftpMock.stat.mock.mockImplementation((path, cb) => cb(null, fileStat));
    const result = await ssh.stat("/file1.txt");
    assert.deepStrictEqual(result, fileStat);
  });
});
