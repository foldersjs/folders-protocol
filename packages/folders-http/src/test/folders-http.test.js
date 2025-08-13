import { test, mock } from "node:test";
import assert from "node:assert";
import FoldersHttp from "../folders-http.js";
import { Readable, Writable } from "stream";
import Handshake from "folders/src/handshake.js";

test("FoldersHttp encryption integration test", async () => {
  const mockProvider = {
    ls: (path, cb) => {
      cb(null, [{ name: "file.txt" }]);
    },
    cat: (path, cb) => {
      const stream = new Readable();
      stream.push("file content");
      stream.push(null);
      cb(null, { stream, size: 12 });
    },
  };

  const mockRoute = {
    open: async () => ({
      token: "test-token",
      shareId: "test-share",
      publicKey: Handshake.stringify(Handshake.createKeypair().publicKey),
    }),
    handshake: async () => ({
      secretKey: new Uint8Array(32),
      publicKey: new Uint8Array(32),
    }),
    watch: async (session, onMessage) => {
      // Simulate receiving a message
      onMessage({
        type: "DirectoryListRequest",
        data: { path: "/", streamId: "stream-1" },
      });
      onMessage({
        type: "FileRequest",
        data: { path: "/file.txt", streamId: "stream-2" },
      });
    },
    post: mock.fn(async (streamId, dataStream, headers, session, transform) => {
      assert.ok(transform, "post should be called with a transform stream");

      // Consume the stream to complete the request
      const finalStream = dataStream.pipe(transform);
      let receivedData = "";
      for await (const chunk of finalStream) {
        receivedData += chunk.toString("hex");
      }

      // We won't check the exact encrypted content as the key is fixed,
      // but we can check that *something* was received.
      assert.ok(receivedData.length > 0, "Encrypted data should have been received");

      if (streamId === "stream-1") {
        // ls request
        // The original data is '[{"name":"file.txt"}]'
        // Just check it's not the plain text.
        assert.notEqual(receivedData, Buffer.from('[{"name":"file.txt"}]').toString('hex'));
      }
      if (streamId === "stream-2") {
        // cat request
        // The original data is 'file content'
        assert.notEqual(receivedData, Buffer.from('file content').toString('hex'));
      }
    }),
  };

  const foldersHttp = new FoldersHttp({
    provider: mockProvider,
    route: mockRoute,
  });

  await foldersHttp.start();

  // Check that post was called twice
  assert.strictEqual(mockRoute.post.mock.calls.length, 2, "route.post should be called twice");
});
