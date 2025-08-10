import test from 'node:test';
import assert from 'node:assert';
import FoldersHttp from '../folders-http.js';
import * as route from '../route.js';
import { Readable } from 'stream';

test('FoldersHttp', async (t) => {
  const mockProvider = {
    ls: (path, cb) => {
      if (path === '/error') {
        return cb(new Error('ls error'));
      }
      cb(null, [{ name: 'file1.txt' }]);
    },
    cat: (path, cb) => {
      if (path === '/error') {
        return cb(new Error('cat error'));
      }
      const stream = new Readable();
      stream.push('file content');
      stream.push(null);
      cb(null, { stream, size: 12 });
    },
  };

  await t.test('should handle ls and cat messages', async () => {
    const originalOpen = route.open;
    const originalWatch = route.watch;
    const originalPost = route.post;

    route.open = async () => ({
      shareId: 'testShareId',
      token: 'testToken',
    });
    route.watch = async () => {};

    let postData = null;
    route.post = (streamId, data, headers, session) => {
      postData = { streamId, data, headers, session };
    };

    const foldersHttp = new FoldersHttp({ provider: mockProvider });
    await foldersHttp.start(); // wait for it to complete

    await foldersHttp.onMessage({
      type: 'DirectoryListRequest',
      data: { path: '/', streamId: 'lsStream' },
    });

    assert.deepStrictEqual(postData, {
      streamId: 'lsStream',
      data: JSON.stringify([{ name: 'file1.txt' }]),
      headers: {},
      session: foldersHttp.session,
    });

    await foldersHttp.onMessage({
      type: 'FileRequest',
      data: { path: '/file1.txt', streamId: 'catStream' },
    });

    assert.strictEqual(postData.streamId, 'catStream');
    assert.ok(postData.data instanceof Readable);
    assert.deepStrictEqual(postData.headers, { 'Content-Length': 12 });
    assert.deepStrictEqual(postData.session, foldersHttp.session);

    // restore original functions
    route.open = originalOpen;
    route.watch = originalWatch;
    route.post = originalPost;
  });
});
