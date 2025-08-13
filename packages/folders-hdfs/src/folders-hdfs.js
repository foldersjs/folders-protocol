import { resolve as urlResolve } from "url";
import { promisify } from "util";
import assert from "node:assert";
import mime from "mime";
import WebHDFSProxy from "webhdfs-proxy";
import { z } from "zod";
import { Stream, Readable } from "stream";

const FoldersHdfsOptions = z.object({
  baseurl: z.string(),
  username: z.string(),
  startEmbeddedProxy: z.boolean().optional(),
  backend: z
    .object({
      instance: z.any(),
      provider: z.string(),
      port: z.number().optional(),
    })
    .optional(),
  checkConfig: z.boolean().optional(),
});

const DEFAULT_HDFS_PREFIX = "/http_window.io_0:webhdfs/";

const WebHdfsOp = {
  LIST: "LISTSTATUS",
  DIRECTORY_SUMMARY: "GETCONTENTSUMMARY",
  CREATE: "CREATE",
  READ: "OPEN",
  GET_FILE_STATUS: "GETFILESTATUS",
  DELETE: "DELETE",
  MKDIRS: "MKDIRS",
};

const isSuccess = (res) => [200, 201].includes(res.status);

const parseError = async (res) => {
  const text = await res.text();
  try {
    const data = JSON.parse(text);
    if (data && data.RemoteException) {
      return new Error(data.RemoteException.message);
    }
  } catch (err) {
    // ignore
  }
  return new Error(`Unknown error: ${text}`);
};

const startEmbeddedProxy = async (options) => {
  let handler;
  if (options.backend?.instance) {
    const { default: FoldersStorageHandler } = await import(
      "./embedded-folders-based-proxy.js"
    );
    const foldersStorageHandler = new FoldersStorageHandler(
      options.backend.instance,
    );
    handler = foldersStorageHandler.storageHandler();
  } else {
    const { default: defaultHandler } = await import(
      "./embedded-memory-based-proxy.js"
    );
    handler = defaultHandler;
  }

  const port = options.backend?.port || 40050;
  const createServerAsync = promisify(WebHDFSProxy.createServer);

  try {
    const servers = await createServerAsync(
      { path: "/webhdfs/v1", validate: true, http: { port } },
      handler,
    );
    console.log("WebHDFS proxy server started successfully.");
    return servers;
  } catch (err) {
    console.error(`WebHDFS proxy server failed to start: ${err.message}`);
    throw err;
  }
};

class FoldersHdfs {
  constructor(prefix, options) {
    const parsedOptions = FoldersHdfsOptions.parse(options);
    this.prefix = (prefix && `${prefix}/`) || DEFAULT_HDFS_PREFIX;
    this.configure(parsedOptions);
  }

  configure(options) {
    this.baseurl = options.baseurl.endsWith("/")
      ? options.baseurl
      : `${options.baseurl}/`;
    this.username = options.username;
    this.options = options;
  }

  async start() {
    if (this.options.startEmbeddedProxy) {
      this.servers = await startEmbeddedProxy(this.options);
    }
  }

  async stop() {
    if (this.servers) {
      await Promise.all(this.servers.map((s) => promisify(s.close).call(s)));
    }
  }

  static features = {
    cat: true,
    range_cat: true,
    ls: true,
    write: true,
    mkdir: true,
    server: true,
  };

  static isConfigValid(config) {
    return FoldersHdfsOptions.parse(config);
  }

  getHdfsPath(path) {
    if (!path) return "";
    if (path.startsWith("/")) path = path.slice(1);
    const parts = path.split("/");
    let prefixPath = parts[0];
    if (this.prefix && this.prefix.startsWith("/"))
      prefixPath = `/${prefixPath}`;
    prefixPath = `${prefixPath}/`;
    if (prefixPath === this.prefix) path = `/${parts.slice(1).join("/")}`;
    return path;
  }

  op(path, op) {
    if (!path || path === "/") path = "";
    else if (path.startsWith("/")) path = path.substring(1);
    return urlResolve(
      this.baseurl,
      `${path}?op=${op}&user.name=${this.username}`,
    );
  }

  async mkdir(path) {
    const response = await fetch(this.op(path, WebHdfsOp.MKDIRS), {
      method: "PUT",
    });
    if (isSuccess(response)) return await response.json();
    throw await parseError(response);
  }

  async ls(path) {
    path = this.getHdfsPath(path);
    const response = await fetch(this.op(path, WebHdfsOp.LIST));
    const fileObj = await response.json();
    const files = fileObj.FileStatuses.FileStatus;
    if (files.length === 0) return [];
    return this.processListResponse(path, fileObj);
  }

  async write(uri, data) {
    uri = this.getHdfsPath(uri);
    const url = `${this.op(uri, WebHdfsOp.CREATE)}&overwrite=true`;

    const response = await fetch(url, { method: "PUT", redirect: "manual" });
    if (response.status !== 307) {
      throw new Error(`Expected redirect 307, got ${response.status}`);
    }
    const redirectedUri = response.headers.get("location");

    const putResponse = await fetch(redirectedUri, {
      method: "PUT",
      body: data,
      duplex: data instanceof Stream ? "half" : undefined,
    });
    if (isSuccess(putResponse)) {
      return data instanceof Buffer ? "created success" : "write uri success";
    }
    throw await parseError(putResponse);
  }

  async cat(data) {
    let path,
      offsetParams = "";
    if (typeof data === "string") {
      path = this.getHdfsPath(data);
    } else {
      path = this.getHdfsPath(data.path);
      if (data.offset) offsetParams += `&offset=${data.offset}`;
      if (data.length) offsetParams += `&length=${data.length}`;
    }

    const listUrl = this.op(path, WebHdfsOp.GET_FILE_STATUS);
    const listResponse = await fetch(listUrl);
    const fileStatus = (await listResponse.json()).FileStatus;

    if (!fileStatus || fileStatus.type === "DIRECTORY") {
      throw new Error("Cannot cat directory or file not found");
    }

    const readUrl = `${this.op(path, WebHdfsOp.READ)}${offsetParams}`;
    const readResponse = await fetch(readUrl, { redirect: "manual" });

    if (readResponse.status !== 307) {
      throw new Error(`Expected redirect 307, got ${readResponse.status}`);
    }

    const redirectedUri = readResponse.headers.get("location");
    const streamResponse = await fetch(redirectedUri);
    return {
      stream: Readable.fromWeb(streamResponse.body),
      size: fileStatus.length,
      name: path,
    };
  }

  async unlink(path) {
    path = this.getHdfsPath(path);
    const response = await fetch(
      `${this.op(path, WebHdfsOp.DELETE)}&recursive=true`,
      { method: "DELETE" },
    );
    if (isSuccess(response)) return await response.json();
    throw await parseError(response);
  }

  asHdfsFolders(dir, files) {
    return files.map((file) => {
      const o = {
        name: file.pathSuffix,
        fullPath: dir + file.pathSuffix,
        meta: {},
        uri: this.prefix + (dir + file.pathSuffix),
        size: file.length,
        extension: "txt",
        type: mime.getType(file.pathSuffix) || "text/plain",
        modificationTime: file.modificationTime
          ? +new Date(file.modificationTime)
          : 0,
      };
      if (file.type === "DIRECTORY") {
        o.extension = "+folder";
        o.type = "";
      }
      return o;
    });
  }

  async processListResponse(path, content) {
    const relPath = path === "" || path.endsWith("/") ? path : `${path}/`;
    const files = content.FileStatuses.FileStatus;
    const results = this.asHdfsFolders(
      relPath.startsWith("/") ? relPath.substring(1) : relPath,
      files,
    );

    const promises = files.map(async (file, i) => {
      if (file.type !== "DIRECTORY") return;
      try {
        const response = await fetch(
          this.op(path + file.pathSuffix, WebHdfsOp.DIRECTORY_SUMMARY),
        );
        const stats = (await response.json()).ContentSummary;
        if (stats) {
          results[i].size = stats.length;
          results[i].meta = {
            ...results[i].meta,
            directoryCount: stats.directoryCount,
            fileCount: stats.fileCount,
            spaceConsumed: stats.spaceConsumed,
            spaceQuota: stats.spaceQuota,
          };
        }
      } catch (e) {
        // ignore, best effort
      }
    });

    await Promise.all(promises);
    return results;
  }
}

export default FoldersHdfs;
