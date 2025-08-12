import { test, mock } from 'node:test';
import assert from 'node:assert';
import stream from 'node:stream';
import FoldersS3 from '../folders-s3.js';
import Server from '../embedded-s3-server.js';

test('FoldersS3', async (t) => {
  let s3;
  const mockS3Client = {
    listObjects: () => ({
      promise: () => Promise.resolve({ Contents: [] }),
    }),
    getObject: () => ({
      promise: () =>
        Promise.resolve({
          Body: 'file content',
          ContentLength: 12,
        }),
    }),
    upload: () => ({
      promise: () => Promise.resolve({}),
    }),
  };

  t.beforeEach(() => {
    const options = {
      connectionString: 's3://bucket',
      enableEmbeddedServer: false,
    };
    s3 = new FoldersS3('test', options);
    mock.method(s3, 'prepare', () => {
      s3.client = mockS3Client;
    });
  });

  await t.test('ls should list files in a directory', async () => {
    const files = [
      { Key: 'folder1/file1.txt', Size: 123 },
      { Key: 'folder1/image.jpg', Size: 456 },
      { Key: 'folder1/folder2/', Size: 0 },
    ];
    mockS3Client.listObjects = () => ({
      promise: () => Promise.resolve({ Contents: files }),
    });

    const result = await s3.ls('folder1/');

    assert.strictEqual(result.length, 3);
    assert.strictEqual(result[0].name, 'file1.txt');
    assert.strictEqual(result[0].extension, 'txt');
    assert.strictEqual(result[0].type, 'text/plain');
    assert.strictEqual(result[1].name, 'image.jpg');
    assert.strictEqual(result[1].extension, 'jpg');
    assert.strictEqual(result[1].type, 'image/jpeg');
    assert.strictEqual(result[2].name, 'folder2');
    assert.strictEqual(result[2].extension, '+folder');
  });

  await t.test('ls should return an error if listObjects fails', async () => {
    const error = new Error('S3 error');
    mockS3Client.listObjects = () => ({
      promise: () => Promise.reject(error),
    });
    await assert.rejects(() => s3.ls('folder1/'), error);
  });

  await t.test('cat should return a stream for a file', async () => {
    const result = await s3.cat('folder1/file1.txt');
    assert.ok(result.stream instanceof stream.Readable);
    assert.strictEqual(result.size, 12);
    assert.strictEqual(result.name, 'file1.txt');
  });

  await t.test('upload should upload a file', async () => {
    const data = new stream.Readable();
    data.push('file content');
    data.push(null);

    const result = await s3.upload('folder1/file1.txt', data);
    assert.strictEqual(result, 'write uri success');
  });

  await t.test('should start an embedded server', async () => {
    const startMock = mock.fn();
    mock.method(Server.prototype, 'start', startMock);

    const options = {
      enableEmbeddedServer: true,
    };
    new FoldersS3('test', options);

    assert.strictEqual(startMock.mock.calls.length, 1);
  });

  await t.test('write should upload a file', async () => {
    const data = new stream.Readable();
    data.push('file content');
    data.push(null);

    const result = await s3.write('folder1/file1.txt', data);
    assert.strictEqual(result, 'write uri success');
  });

  await t.test('download should return a stream for a file', async () => {
    const result = await s3.download('folder1/file1.txt');
    assert.ok(result.stream instanceof stream.Readable);
    assert.strictEqual(result.size, 12);
    assert.strictEqual(result.name, 'file1.txt');
  });
});
