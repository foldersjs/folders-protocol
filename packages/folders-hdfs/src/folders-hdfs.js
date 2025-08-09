import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const uriParse = require('url');
const assert = require('assert');
const mime = require('mime');
const WebHDFSProxy = require('webhdfs-proxy');
import { z } from 'zod';

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

const DEFAULT_HDFS_PREFIX = '/http_window.io_0:webhdfs/';

const WebHdfsOp = {
  LIST: 'LISTSTATUS',
  DIRECTORY_SUMMARY: 'GETCONTENTSUMMARY',
  CREATE: 'CREATE',
  READ: 'OPEN',
  GET_FILE_STATUS: 'GETFILESTATUS',
  DELETE: 'DELETE',
  MKDIRS: 'MKDIRS',
};

const isRedirect = (res) => [301, 307].includes(res.status) && res.headers.get('location');
const isSuccess = (res) => [200, 201].includes(res.status);
const isError = (res) => [400, 401, 402, 403, 404, 500].includes(res.status);

const parseError = async (res) => {
  let error = null;
  const text = await res.text();
  try {
    const data = JSON.parse(text);
    if (data && data.RemoteException) {
      error = data.RemoteException;
    }
  } catch (err) {
    // ignore
  }
  return error;
};

const startEmbeddedProxy = (options) => {
  let _handler;
  if (options.backend && options.backend.instance) {
    const FoldersStorageHandler = require('./embedded-folders-based-proxy.js');
    const foldersStorageHandler = new FoldersStorageHandler(options.backend.instance);
    _handler = foldersStorageHandler.storageHandler();
  } else {
    _handler = require('./embedded-memory-based-proxy.js');
  }
  const PORT = (options.backend && options.backend.port) || 40050;
  WebHDFSProxy.createServer(
    { path: '/webhdfs/v1', validate: true, http: { port: PORT } },
    _handler,
    (err, servers) => {
      if (err) return console.log(`WebHDFS proxy server started failed: ${err.message}`);
      console.log('WebHDFS proxy server started success.');
    },
  );
};

class FoldersHdfs {
  constructor(prefix, options) {
    const parsedOptions = FoldersHdfsOptions.parse(options);
    this.prefix = (prefix && `${prefix}/`) || DEFAULT_HDFS_PREFIX;
    this.configure(parsedOptions);
  }

  configure(options) {
    this.baseurl = options.baseurl.endsWith('/') ? options.baseurl : `${options.baseurl}/`;
    this.username = options.username;
    if (options.startEmbeddedProxy) startEmbeddedProxy(options);
    console.log('init foldersHdfs,', this.baseurl, this.username, this.prefix);
  }

  static features = {
    cat: true,
    range_cat: true,
    ls: true,
    write: true,
    mkdir: true,
    server: true,
  };

  static isConfigValid(config, cb) {
    const parsedConfig = FoldersHdfsOptions.parse(config);
    assert.equal(typeof cb, 'function', "argument 'cb' must be a function");
    if (parsedConfig.checkConfig === false) return cb(null, parsedConfig);
    return cb(null, parsedConfig);
  }

  getHdfsPath(path) {
    if (!path) return '';
    if (path.startsWith('/')) path = path.slice(1);
    const parts = path.split('/');
    let prefixPath = parts[0];
    if (this.prefix && this.prefix.startsWith('/')) prefixPath = `/${prefixPath}`;
    prefixPath = `${prefixPath}/`;
    if (prefixPath === this.prefix) path = `/${parts.slice(1).join('/')}`;
    return path;
  }

  op(path, op) {
    if (!path || path === '/') path = '';
    else if (path.startsWith('/')) path = path.substr(1);
    return uriParse.resolve(this.baseurl, `${path}?op=${op}&user.name=${this.username}`);
  }

  async mkdir(path, cb) {
    try {
      const response = await fetch(this.op(path, WebHdfsOp.MKDIRS), { method: 'PUT' });
      if (isSuccess(response)) return cb(null, await response.json());
      if (isError(response)) return cb(await parseError(response));
      cb(`Unknown response: ${await response.text()}`);
    } catch (err) {
      cb(err);
    }
  }

  async ls(path, cb) {
    path = this.getHdfsPath(path);
    try {
      const response = await fetch(this.op(path, WebHdfsOp.LIST));
      const fileObj = await response.json();
      const files = fileObj.FileStatuses.FileStatus;
      if (files.length === 0) return cb(null, files);
      this.processListResponse(path, fileObj, cb);
    } catch (e) {
      cb({ errorMsg: 'parse result error in server' });
    }
  }

  async write(uri, data, cb) {
    uri = this.getHdfsPath(uri);
    const url = `${this.op(uri, WebHdfsOp.CREATE)}&overwrite=true`;
    try {
      const response = await fetch(url, { method: 'PUT', redirect: 'manual' });
      if (response.status !== 307) return cb(`Expected redirect 307, got ${response.status}`);
      const redirectedUri = response.headers.get('location');
      if (data instanceof Buffer) {
        const putResponse = await fetch(redirectedUri, { method: 'PUT', body: data });
        if (isSuccess(putResponse)) return cb(null, 'created success');
        cb(`Unknown response: ${await putResponse.text()}`);
      } else {
        const stream = data;
        const putResponse = await fetch(redirectedUri, { method: 'PUT', body: stream, duplex: 'half' });
        if (isSuccess(putResponse)) return cb(null, 'write uri success');
        cb(`Unknown response: ${await putResponse.text()}`);
      }
    } catch (error) {
      cb(error);
    }
  }

  async cat(data, cb) {
    let path, offsetParams = '';
    if (typeof data === 'string') path = this.getHdfsPath(data);
    else {
      path = this.getHdfsPath(data.path);
      if (data.offset) offsetParams += `&offset=${data.offset}`;
      if (data.length) offsetParams += `&length=${data.length}`;
    }
    try {
      const listUrl = this.op(path, WebHdfsOp.GET_FILE_STATUS);
      const listResponse = await fetch(listUrl);
      const fileStatus = (await listResponse.json()).FileStatus;
      if (!fileStatus || fileStatus.type === 'DIRECTORY') return cb('Cannot cat directory or file not found');
      const readUrl = `${this.op(path, WebHdfsOp.READ)}${offsetParams}`;
      const readResponse = await fetch(readUrl, { redirect: 'manual' });
      if (readResponse.status !== 307) return cb(`Expected redirect 307, got ${readResponse.status}`);
      const redirectedUri = readResponse.headers.get('location');
      const streamResponse = await fetch(redirectedUri);
      cb(null, { stream: streamResponse.body, size: fileStatus.length, name: path });
    } catch (error) {
      cb(error);
    }
  }

  async unlink(path, cb) {
    path = this.getHdfsPath(path);
    try {
      const response = await fetch(`${this.op(path, WebHdfsOp.DELETE)}&recursive=true`, { method: 'DELETE' });
      if (isSuccess(response)) return cb(null, await response.json());
      cb(`Unknown response: ${await response.text()}`);
    } catch (err) {
      cb(err);
    }
  }

  asHdfsFolders(dir, files) {
    return files.map(file => {
      const o = { name: file.pathSuffix, fullPath: dir + file.pathSuffix, meta: {}, uri: this.prefix + (dir + file.pathSuffix), size: file.length, extension: 'txt', type: mime.lookup(file.pathSuffix) || 'text/plain', modificationTime: file.modificationTime ? +new Date(file.modificationTime) : 0 };
      if (file.type === 'DIRECTORY') {
        o.extension = '+folder';
        o.type = '';
      }
      return o;
    });
  }

  processListResponse(path, content, cb) {
    const relPath = path === '' || path.endsWith('/') ? path : `${path}/`;
    const files = content.FileStatuses.FileStatus;
    const results = this.asHdfsFolders(relPath.startsWith('/') ? relPath.substring(1) : relPath, files);
    if (files.length === 0) return cb(null, []);
    let latch = files.length;
    const latchDecrementAndCb = () => {
      latch--;
      if (latch === 0) cb(null, results);
    };
    files.forEach(async (file, i) => {
      if (file.type !== 'DIRECTORY') return latchDecrementAndCb();
      try {
        const response = await fetch(this.op(path + file.pathSuffix, WebHdfsOp.DIRECTORY_SUMMARY));
        const stats = (await response.json()).ContentSummary;
        if (stats) {
          results[i].size = stats.length;
          ['directoryCount', 'fileCount', 'spaceConsumed', 'spaceQuota'].forEach(prop => {
            if (!results[i].meta) results[i].meta = {};
            results[i].meta[prop] = stats[prop];
          });
        }
      } catch (e) {
        // ignore
      } finally {
        latchDecrementAndCb();
      }
    });
  }
}

export default FoldersHdfs;
