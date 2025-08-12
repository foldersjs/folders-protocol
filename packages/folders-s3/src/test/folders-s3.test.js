import { test, mock } from "node:test";
import assert from "node:assert";
import stream from "node:stream";
import FoldersS3 from "../folders-s3.js";
import Server from "../embedded-s3-server.js";
import {
  S3Client,
  ListObjectsV2Command,
  GetObjectCommand,
  PutObjectCommand,
} from "@aws-sdk/client-s3";

test("FoldersS3", async (t) => {
  let s3;
  let mockSend;

  t.beforeEach(() => {
    const options = {
      connectionString: "s3://bucket",
      accessKeyId: "test",
      secretAccessKey: "test",
      endpoint: "http://localhost:4568",
    };
    s3 = new FoldersS3("test", options);

    mockSend = mock.fn(() => Promise.resolve({}));
    mock.method(S3Client.prototype, "send", mockSend);
  });

  t.afterEach(() => {
    mock.restoreAll();
  });

  await t.test("ls should list files and folders in a directory", async () => {
    const s3Response = {
      Contents: [
        { Key: "folder1/file1.txt", Size: 123 },
        { Key: "folder1/image.jpg", Size: 456 },
      ],
      CommonPrefixes: [{ Prefix: "folder1/folder2/" }],
    };
    mockSend.mock.mockImplementation(() => Promise.resolve(s3Response));

    const result = await s3.ls("folder1/");

    assert.strictEqual(result.length, 3);
    assert.deepStrictEqual(
      result.find((r) => r.name === "folder2"),
      {
        name: "folder2",
        fullPath: "folder1/folder2/",
        meta: {},
        uri: "folder1/folder2/",
        size: 0,
        extension: "+folder",
        type: "",
      },
    );
    assert.deepStrictEqual(
      result.find((r) => r.name === "file1.txt"),
      {
        name: "file1.txt",
        fullPath: "folder1/file1.txt",
        meta: {},
        uri: "folder1/file1.txt",
        size: 123,
        extension: "txt",
        type: "application/octet-stream",
      },
    );
    const sendCall = mockSend.mock.calls[0];
    assert.ok(sendCall.arguments[0] instanceof ListObjectsV2Command);
    assert.deepStrictEqual(sendCall.arguments[0].input, {
      Bucket: "bucket",
      Prefix: "folder1/",
      Delimiter: "/",
    });
  });

  await t.test("ls should return an error if S3 call fails", async () => {
    const error = new Error("S3 error");
    mockSend.mock.mockImplementation(() => Promise.reject(error));
    await assert.rejects(() => s3.ls("folder1/"), error);
  });

  await t.test("cat should return a stream for a file", async () => {
    const body = new stream.Readable();
    body.push("file content");
    body.push(null);
    const s3Response = {
      Body: body,
      ContentLength: 12,
    };
    mockSend.mock.mockImplementation(() => Promise.resolve(s3Response));

    const result = await s3.cat("folder1/file1.txt");

    assert.ok(result.stream instanceof stream.Readable);
    assert.strictEqual(result.size, 12);
    assert.strictEqual(result.name, "file1.txt");
    const sendCall = mockSend.mock.calls[0];
    assert.ok(sendCall.arguments[0] instanceof GetObjectCommand);
    assert.deepStrictEqual(sendCall.arguments[0].input, {
      Bucket: "bucket",
      Key: "folder1/file1.txt",
    });
  });

  await t.test("cat should return an error if S3 call fails", async () => {
    const error = new Error("S3 error");
    mockSend.mock.mockImplementation(() => Promise.reject(error));
    await assert.rejects(() => s3.cat("folder1/file1.txt"), error);
  });

  await t.test("write should upload a file", async () => {
    const data = new stream.Readable();
    data.push("file content");
    data.push(null);
    const s3Response = {
      ETag: '"123"',
      VersionId: "456",
    };
    mockSend.mock.mockImplementation(() => Promise.resolve(s3Response));

    const result = await s3.write("folder1/file1.txt", data);

    assert.deepStrictEqual(result, { ETag: '"123"', VersionId: "456" });
    const sendCall = mockSend.mock.calls[0];
    assert.ok(sendCall.arguments[0] instanceof PutObjectCommand);
    assert.deepStrictEqual(sendCall.arguments[0].input, {
      Bucket: "bucket",
      Key: "folder1/file1.txt",
      Body: data,
    });
  });

  await t.test("write should return an error if S3 call fails", async () => {
    const error = new Error("S3 error");
    mockSend.mock.mockImplementation(() => Promise.reject(error));
    const data = new stream.Readable();
    data.push("file content");
    data.push(null);
    await assert.rejects(() => s3.write("folder1/file1.txt", data), error);
  });

  await t.test("should start an embedded server", async () => {
    const startMock = mock.fn();
    mock.method(Server.prototype, "start", startMock);

    const options = {
      connectionString: "s3://bucket",
      enableEmbeddedServer: true,
    };
    new FoldersS3("test", options);

    assert.strictEqual(startMock.mock.calls.length, 1);
  });
});
