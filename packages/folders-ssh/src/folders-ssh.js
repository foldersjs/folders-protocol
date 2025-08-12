import ssh2 from "ssh2";
const { Client } = ssh2;
import path from "path";
import mime from "mime";
import { z } from "zod";
import fs from "fs";
import { promisify } from "util";

import Config from "../config.js";
import SSHServer from "./embedded-ssh-server.js";

const FoldersSshOptions = z.object({
  connectionString: z.string().url(),
  enableEmbeddedServer: z.boolean().optional(),
  backend: z.any().optional(),
  privateKeyPath: z.string().optional(),
  privateKey: z.string().optional(),
});

const home = () =>
  process.env[process.platform === "win32" ? "USERPROFILE" : "HOME"];

const parseConnString = (connectionString) => {
  const uri = new URL(connectionString);
  return {
    host: uri.hostname,
    port: uri.port || 22,
    user: uri.username,
    pass: uri.password,
  };
};

class FoldersSsh {
  constructor(prefix, options) {
    const parsedOptions = FoldersSshOptions.parse(options);
    this.options = parsedOptions;
    this.prefix = prefix || Config.prefix;
    this.connectionString = parsedOptions.connectionString;

    if (parsedOptions.enableEmbeddedServer) {
      const conn = parseConnString(this.connectionString);
      this.credentials = conn;

      this.server = new SSHServer(conn);
      this.server.start(parsedOptions.backend);
    }
  }

  static dataVolume() {
    return { RXOK: FoldersSsh.RXOK, TXOK: FoldSsh.TXOK };
  }

  static TXOK = 0;
  static RXOK = 0;

  static features = {
    cat: true,
    ls: true,
    write: true,
    server: true,
    unlink: true,
    rmdir: true,
    mkdir: true,
    stat: true,
  };

  async #connect() {
    const conn = new Client();
    const connectionDetails = this.#getConnectionDetails();
    const readyPromise = new Promise((resolve, reject) => {
      conn.on("ready", () => resolve(conn)).on("error", reject);
    });
    conn.connect(connectionDetails);
    return readyPromise;
  }

  #getConnectionDetails() {
    let privateKey;
    if (this.options.privateKeyPath) {
      privateKey = fs.readFileSync(this.options.privateKeyPath);
    } else if (this.options.privateKey) {
      privateKey = this.options.privateKey;
    } else if (fs.existsSync(path.join(home(), ".ssh", "id_rsa"))) {
      privateKey = fs.readFileSync(path.join(home(), ".ssh", "id_rsa"));
    }

    const conn = parseConnString(this.connectionString);

    const connectionDetails = {
      host: conn.host,
      port: conn.port,
      username: conn.user,
    };

    if (privateKey) {
      connectionDetails.privateKey = privateKey;
    }
    if (conn.pass) {
      connectionDetails.password = conn.pass;
    }

    return connectionDetails;
  }

  async ls(filePath) {
    const conn = await this.#connect();
    try {
      const sftp = await promisify(conn.sftp.bind(conn))();
      const list = await promisify(sftp.readdir.bind(sftp))(filePath, {
        full: true,
      });
      return this.#asFolders(filePath, list);
    } finally {
      conn.end();
    }
  }

  #asFolders(dir, files) {
    return files.map((file) => {
      const isDirectory = file.longname.startsWith("d");
      const extension = isDirectory ? "+folder" : path.extname(file.filename);
      const type = isDirectory
        ? ""
        : mime.getType(extension) || "application/octet-stream";

      return {
        name: file.filename,
        extension,
        size: file.attrs.size || 0,
        type,
        fullPath: path.join(dir, file.filename),
        uri: path.join(dir, file.filename),
        meta: {
          mode: file.attrs.mode,
          permissions: file.attrs.permissions,
          uid: file.attrs.uid,
          gid: file.attrs.gid,
        },
        modificationTime: file.attrs.mtime,
      };
    });
  }

  async cat(filePath) {
    const conn = await this.#connect();
    try {
      const sftp = await promisify(conn.sftp.bind(conn))();
      const attrs = await promisify(sftp.stat.bind(sftp))(filePath);
      const stream = sftp.createReadStream(filePath);
      return {
        stream,
        size: attrs.size,
        name: path.basename(filePath),
      };
    } catch (err) {
      conn.end();
      throw err;
    }
  }

  async write(filePath, data) {
    const conn = await this.#connect();
    try {
      const sftp = await promisify(conn.sftp.bind(conn))();
      const writeStream = sftp.createWriteStream(filePath);
      data.pipe(writeStream);
      await new Promise((resolve, reject) => {
        writeStream.on("finish", resolve);
        writeStream.on("error", reject);
        data.on("error", reject);
      });
      return "write uri success";
    } finally {
      conn.end();
    }
  }

  async unlink(filePath) {
    const conn = await this.#connect();
    try {
      const sftp = await promisify(conn.sftp.bind(conn))();
      await promisify(sftp.unlink.bind(sftp))(filePath);
    } finally {
      conn.end();
    }
  }

  async rmdir(filePath) {
    const conn = await this.#connect();
    try {
      const sftp = await promisify(conn.sftp.bind(conn))();
      await promisify(sftp.rmdir.bind(sftp))(filePath);
    } finally {
      conn.end();
    }
  }

  async mkdir(filePath) {
    const conn = await this.#connect();
    try {
      const sftp = await promisify(conn.sftp.bind(conn))();
      await promisify(sftp.mkdir.bind(sftp))(filePath);
    } finally {
      conn.end();
    }
  }

  async stat(filePath) {
    const conn = await this.#connect();
    try {
      const sftp = await promisify(conn.sftp.bind(conn))();
      return await promisify(sftp.stat.bind(sftp))(filePath);
    } finally {
      conn.end();
    }
  }

  dump() {
    return this.options;
  }
}

export default FoldersSsh;
