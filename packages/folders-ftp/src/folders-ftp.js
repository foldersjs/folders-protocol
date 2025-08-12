/*
 *
 * Folders.io provider: share an FTP endpoint.
 *
 */

import uriParse from "url";
import jsftp from "jsftp";
import { z } from "zod";
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

  ls(path, cb) {
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

    ftp.raw.cwd(normalizedPath, (err) => {
      if (err) {
        return cb(err);
      }
      ftp.ls(".", (err, content) => {
        if (err) {
          return cb(err);
        }
        cb(null, this.asFolders(normalizedPath, content));
      });
    });
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

  cat(path, cb) {
    const dirName = path.substring(0, path.lastIndexOf("/") + 1);
    const ftp = this.prepare();

    ftp.ls(dirName, (err, content) => {
      if (err) {
        return cb(err);
      }

      const files = this.asFolders(dirName, content);
      const file = files.find((f) => f.fullPath === path);

      if (!file) {
        return cb(new Error("File not found"));
      }

      ftp.get(path, (err, socket) => {
        if (err) {
          return cb(err);
        }
        socket.resume();
        cb(null, {
          stream: socket,
          size: file.size,
          name: file.name,
        });
      });
    });
  }

  write(uri, data, cb) {
    const ftp = this.prepare();
    data.on("data", (d) => {
      FoldersFtp.RXOK += d.length;
    });

    ftp.put(data, uri, (err) => {
      if (err) {
        return cb(err);
      }
      cb(null, "write uri success");
    });
  }

  dump() {
    return this.options;
  }
}

export default FoldersFtp;
