/*
 *
 * Folders.io provider: share an FTP endpoint.
 *
 */

import uriParse from "url";
import jsftp from "jsftp";
import { z } from "zod";
import util from "util";
import Server from "./embedded-ftp-server.js";

const OptionsSchema = z.object({
  connectionString: z.string(),
  enableEmbeddedServer: z.boolean().optional(),
  backend: z.any().optional(),
});

const parseConnString = (connectionString) => {
  const uri = uriParse.parse(connectionString, true);
  const conn = {
    host: uri.hostname || uri.host,
    port: uri.port || 21,
  };
  if (uri.auth) {
    const auth = uri.auth.split(":", 2);
    conn.user = auth[0];
    if (auth.length === 2) {
      conn.pass = auth[1];
    }
  }
  conn.debugMode = true;
  return conn;
};

class FoldersFtp {
  constructor(prefix, options) {
    const validatedOptions = OptionsSchema.parse(options);

    this.options = validatedOptions;
    this.prefix = prefix;
    this.connectionString = validatedOptions.connectionString;
    this.server = null;
    this.ftp = null;

    if (validatedOptions.enableEmbeddedServer) {
      const conn = parseConnString(this.connectionString);
      this.server = new Server(conn);
      this.server.start(validatedOptions.backend);
    }
  }

  static TXOK = 0;
  static RXOK = 0;

  static dataVolume() {
    return { RXOK: FoldersFtp.RXOK, TXOK: FoldersFtp.TXOK };
  }

  static features = {
    cat: true,
    ls: true,
    write: true,
    server: true,
  };

  prepare() {
    if (this.ftp) {
      return this.ftp;
    }

    const conn = parseConnString(this.connectionString);
    // NOTES: Could use rush; PWD/CWD needs to be known.
    this.ftp = new jsftp(conn);
    return this.ftp;
  }

  async ls(path) {
    let normalizedPath = path;
    if (normalizedPath !== ".") {
      if (normalizedPath.length && !normalizedPath.startsWith("/")) {
        normalizedPath = `/${normalizedPath}`;
      }
      if (normalizedPath.length && !normalizedPath.endsWith("/")) {
        normalizedPath = `${normalizedPath}/`;
      }
    }

    const ftp = this.prepare();
    const cwdAsync = util.promisify(ftp.raw.cwd).bind(ftp.raw);
    const lsAsync = util.promisify(ftp.ls).bind(ftp);

    await cwdAsync(normalizedPath);
    const content = await lsAsync(".");
    return this.asFolders(normalizedPath, content);
  }

  asFolders(dir, files) {
    return files.map((file) => {
      const fullPath = dir === "." ? file.name : `${dir}${file.name}`;
      let extension = "txt";
      let type = "text/plain";

      if (file.type === "1" || file.type === "2") {
        extension = "+folder";
        type = "";
      }

      return {
        name: file.name,
        fullPath,
        meta: {
          permission: 0,
          owner: file.owner,
          group: file.group,
        },
        uri: fullPath,
        size: file.size || 0,
        extension,
        type,
      };
    });
  }

  async cat(path) {
    const dirName = path.substring(0, path.lastIndexOf("/") + 1);
    const ftp = this.prepare();
    const lsAsync = util.promisify(ftp.ls).bind(ftp);
    const getAsync = util.promisify(ftp.get).bind(ftp);

    const content = await lsAsync(dirName);
    const files = this.asFolders(dirName, content);
    const file = files.find((f) => f.fullPath === path);

    if (!file) {
      throw new Error("File not found");
    }

    const socket = await getAsync(path);
    socket.resume();
    return {
      stream: socket,
      size: file.size,
      name: file.name,
    };
  }

  async write(uri, data) {
    const ftp = this.prepare();
    const putAsync = util.promisify(ftp.put).bind(ftp);

    data.on("data", (d) => {
      FoldersFtp.RXOK += d.length;
    });

    await putAsync(data, uri);
    return "write uri success";
  }

  dump() {
    return this.options;
  }
}

export default FoldersFtp;
