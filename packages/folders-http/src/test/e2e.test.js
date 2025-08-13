import { test, mock } from "node:test";
import assert from "node:assert";
import FoldersHttp from "../folders-http.js";
import StandaloneServer from "../standaloneServer.js";
import { Readable, Writable } from "stream";
import http from "http";
import getPort from "get-port";
import Module from "module";
import stringify from "../util/json-stringify-safe.js";

const originalRequire = Module.prototype.require;
Module.prototype.require = function (id) {
  if (id === "json-stringify-safe") {
    return stringify;
  }
  return originalRequire.apply(this, arguments);
};

test("End-to-end encryption test", async () => {
  const port = await getPort();
  const server = new StandaloneServer({ listen: port, mode: "DEBUG", host: "localhost" });

  // Wait for the server to be ready
  await new Promise(resolve => setTimeout(resolve, 100));

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

  const route = await import("../route.js");
  // I need to modify the prefix in route.js to use the dynamic port.
  // This is not ideal, but it's the only way without major refactoring.
  route.prefix = `http://localhost:${port}`;

  const foldersHttp = new FoldersHttp({
    provider: mockProvider,
    route: route,
  });

  await foldersHttp.start();

  // TODO: Add assertions and properly close the server
});
