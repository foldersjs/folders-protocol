import ssh2 from "ssh2";
const { Server: SshServer, utils: ssh2utils } = ssh2;
import fs from "fs";
import crypto from "crypto";
import Config from "../config.js";
import { PassThrough } from "stream";
import { Stats } from "fs";
import constants from "constants";
import path from "path";

const home = () =>
  process.env[process.platform === "win32" ? "USERPROFILE" : "HOME"];

const randomValueHex = (len = 10) =>
  crypto
    .randomBytes(Math.ceil(len / 2))
    .toString("hex")
    .slice(0, len);

const constructLongName = (file) => {
  const d = new Date(parseFloat(file.modificationTime));
  const date = `${d.toString().substr(4, 6)} ${d.getHours()}:${d.getMinutes()}`;
  const permissions =
    file.extension === "+folder" ? "drw-rw-r--" : "-rw-rw-r--";

  return [permissions, 1, "ssh", "ssh", file.size, date, file.name].join(" ");
};

class Server {
  constructor(credentials, debug) {
    this.SSHCredentials = credentials;
    this.debug = debug || Config.server.debug;
    this.sshServer = null;
  }

  close() {
    if (this.sshServer) {
      this.sshServer.close();
    }
  }

  start(backend) {
    if (!backend) {
      throw new Error("Backend must be provided for embedded SSH server.");
    }
    const { host, port } = this.SSHCredentials;

    if (host !== "localhost") {
      return;
    }

    let pubKey;
    if (Config.client.publickKeyPath) {
      pubKey = ssh2utils.genPublicKey(
        ssh2utils.parseKey(fs.readFileSync(Config.client.publickKeyPath)),
      );
    } else if (Config.client.publicKey) {
      pubKey = ssh2utils.genPublicKey(
        ssh2utils.parseKey(Config.client.publicKey),
      );
    } else if (fs.existsSync(path.join(home(), ".ssh", "id_rsa.pub"))) {
      pubKey = ssh2utils.genPublicKey(
        ssh2utils.parseKey(
          fs.readFileSync(path.join(home(), ".ssh", "id_rsa.pub")),
        ),
      );
    }

    let privateKey;
    if (Config.server.privateKeyPath) {
      privateKey = fs.readFileSync(Config.server.privateKeyPath);
    } else if (Config.server.privateKey) {
      privateKey = Config.server.privateKey;
    } else if (fs.existsSync(path.join(home(), ".ssh", "id_rsa"))) {
      privateKey = fs.readFileSync(path.join(home(), ".ssh", "id_rsa"));
    }

    this.sshServer = new SshServer(
      {
        privateKey,
        debug: this.debug,
      },
      (client) => {
        client.on("authentication", (ctx) => {
          if (ctx.method === "publickey" && ctx.key.algo === pubKey.fulltype) {
            if (ctx.signature) {
              const verifier = crypto.createVerify(ctx.sigAlgo);
              verifier.update(ctx.blob);
              if (verifier.verify(pubKey.publicOrig, ctx.signature, "binary")) {
                ctx.accept();
              } else {
                ctx.reject();
              }
            } else {
              ctx.accept();
            }
          } else if (ctx.method === "password") {
            const { username, password } = Config.client;
            if (ctx.username === username && ctx.password === password) {
              ctx.accept();
            } else {
              ctx.reject();
            }
          } else {
            ctx.reject();
          }
        });

        const setSftpListener = (sftp) => {
          sftp.handles = {};

          const STATUS_CODE = {
            OK: 0,
            EOF: 1,
            NO_SUCH_FILE: 2,
            PERMISSION_DENIED: 3,
            FAILURE: 4,
            BAD_MESSAGE: 5,
            NO_CONNECTION: 6,
            CONNECTION_LOST: 7,
            OP_UNSUPPORTED: 8,
          };

          const OPEN_MODE = {
            READ: 0x00000001,
            WRITE: 0x00000002,
            APPEND: 0x00000004,
            CREAT: 0x00000008,
            TRUNC: 0x00000010,
            EXCL: 0x00000020,
          };

          const asSSHFile = (files) => {
            const out = files.map((file) => {
              const mode =
                file.extension === "+folder"
                  ? constants.S_IFDIR
                  : constants.S_IFREG;
              return {
                filename: file.name,
                longname: constructLongName(file),
                attrs: new Stats({
                  mode: 0o644 | mode,
                  size: file.size,
                  uid: 9001,
                  gid: 8001,
                  atime: file.modificationTime,
                  mtime: file.modificationTime,
                }),
              };
            });
            return addParCurDir(out);
          };

          const addParCurDir = (out) => {
            const hasParDir = out.some((f) => f.filename === "..");
            const hasCurDir = out.some((f) => f.filename === ".");

            if (!hasParDir) {
              out.push({
                filename: "..",
                longname: "drwxr-xr-x   4 ssh   ssh      4096 May 16  2013 ..",
                attrs: new Stats({
                  mode: 0o755 | constants.S_IFDIR,
                  size: 4096,
                  uid: 0,
                  gid: 0,
                  atime: 1368729954,
                  mtime: 1368729999,
                }),
              });
            }
            if (!hasCurDir) {
              out.push({
                filename: ".",
                longname: "drwxr-xr-x  56 ssh   ssh      4096 Nov 10 01:05 .",
                attrs: new Stats({
                  mode: 0o755 | constants.S_IFDIR,
                  size: 4096,
                  uid: 9001,
                  gid: 8001,
                  atime: 1415599549,
                  mtime: 1415599590,
                }),
              });
            }
            return out;
          };

          sftp.on("STAT", (id, filePath) => {
            const dirname = path.dirname(filePath);
            const basename = path.basename(filePath);
            let attrs = {};
            if (filePath === "/") {
              attrs.mode = 0o664 | constants.S_IFDIR;
              sftp.attrs(id, attrs);
              return;
            }
            backend.ls(dirname, (err, res) => {
              const file = res.find((f) => f.name === basename);
              if (file) {
                const mode =
                  file.extension === "+folder"
                    ? constants.S_IFDIR
                    : constants.S_IFREG;
                attrs = new Stats({
                  mode: 0o644 | mode,
                  size: file.size,
                  uid: 9001,
                  gid: 8001,
                  atime: file.modificationTime,
                  mtime: file.modificationTime,
                });
              }
              sftp.attrs(id, attrs);
            });
          });

          sftp.on("LSTAT", (id, filePath) => {
            const attrs = new Stats({
              mode: 0o644 | constants.S_IFREG,
              size: 1024,
              uid: 9001,
              gid: 9001,
              atime: (Date.now() / 1000) | 0,
              mtime: (Date.now() / 1000) | 0,
            });
            sftp.attrs(id, attrs);
          });

          sftp.on("OPENDIR", (id, dirPath) => {
            const handle = Buffer.from(randomValueHex());
            sftp.handles[handle] = { path: dirPath, next_index: 0 };
            sftp.handle(id, handle);
          });

          sftp.on("READDIR", (id, handle) => {
            const dirPath = sftp.handles[handle].path;
            if (sftp.handles[handle].next_index > 0) {
              sftp.name(id, []);
              return;
            }
            backend.ls(dirPath, (err, res) => {
              const list = asSSHFile(res);
              sftp.handles[handle].next_index = list.length;
              sftp.name(id, list);
            });
          });

          sftp.on("OPEN", (id, filePath, flags, attrs) => {
            if (flags === OPEN_MODE.READ) {
              backend.cat(filePath, (err, results) => {
                if (err) {
                  sftp.status(id, STATUS_CODE.NO_SUCH_FILE);
                  return;
                }
                const { stream } = results;
                const handle = Buffer.from(randomValueHex());
                sftp.handles[handle] = {
                  stream,
                  transferred: 0,
                  hooked: false,
                  queuedRead: [],
                  readLength: 0,
                  isReadEnd: false,
                  buff: Buffer.alloc(0),
                };
                sftp.handle(id, handle);
                stream.pause();
              });
            }
            if (
              flags ===
              (OPEN_MODE.TRUNC | OPEN_MODE.CREAT | OPEN_MODE.WRITE)
            ) {
              const handle = Buffer.from(randomValueHex());
              const pass = new PassThrough();
              sftp.handles[handle] = {
                stream: pass,
                mode: "w",
                queuedWrite: [],
                hooked: false,
              };
              sftp.handle(id, handle);
              backend.write(filePath, pass, (err, result) => {
                if (err) {
                  sftp.status(id, STATUS_CODE.FAILURE);
                }
              });
            }
          });

          sftp.on("CLOSE", (id, handle) => {
            if (sftp.handles[handle]?.mode === "w") {
              sftp.handles[handle].stream.push(null);
            }
            delete sftp.handles[handle];
            sftp.status(id, STATUS_CODE.OK);
          });

          sftp.on("READ", (id, handle, offset, length) => {
            const h = sftp.handles[handle];
            if (!h || !h.stream) {
              sftp.status(id, STATUS_CODE.NO_SUCH_FILE);
              return;
            }
            if (h.isReadEnd) {
              sftp.status(id, STATUS_CODE.EOF);
              h.isReadEnd = false;
              h.buff = null;
              return;
            }
            if (!h.hooked) {
              h.hooked = true;
              h.stream.once("end", () => {
                if (h.queuedRead.length > 0) {
                  const cmd = h.queuedRead.shift();
                  sftp.data(cmd.id, h.buff);
                }
                if (h.queuedRead.length > 0) {
                  const cmd = h.queuedRead.shift();
                  sftp.status(cmd.id, STATUS_CODE.EOF);
                }
                h.isReadEnd = true;
              });
              h.stream.on("data", (chunk) => {
                h.buff = Buffer.concat([h.buff, chunk]);
                if (h.queuedRead.length > 0) {
                  const cmd = h.queuedRead[0];
                  if (h.buff.length >= cmd.length) {
                    const buf1 = h.buff.slice(0, cmd.length);
                    h.transferred += cmd.length;
                    sftp.data(cmd.id, buf1);
                    h.buff = h.buff.slice(cmd.length);
                    h.queuedRead.shift();
                  }
                }
                if (h.buff.length > 1e6) {
                  h.stream.pause();
                }
              });
            }
            if (h.buff.length >= length) {
              const buf1 = h.buff.slice(0, length);
              h.transferred += length;
              sftp.data(id, buf1);
              h.buff = h.buff.slice(length);
            } else {
              h.queuedRead.push({ id, length });
            }
            if (h.buff.length < 1e6 && !h.isReadEnd) {
              h.stream.resume();
            }
          });

          sftp.on("WRITE", (id, handle, offset, data) => {
            const h = sftp.handles[handle];
            if (!h || !h.stream) {
              sftp.status(id, STATUS_CODE.FAILURE);
              return;
            }
            if (!h.hooked) {
              h.hooked = true;
              h.stream._read = () => {
                const limit = Math.min(h.queuedWrite.length, 5);
                for (let i = 0; i < limit; i++) {
                  sftp.status(h.queuedWrite.shift(), STATUS_CODE.OK);
                }
              };
            }
            if (h.stream.push(data)) {
              sftp.status(id, STATUS_CODE.OK);
            } else {
              h.queuedWrite.push(id);
            }
          });

          sftp.on("REMOVE", (id, filePath) => {
            backend.unlink(filePath, (err) => {
              sftp.status(id, err ? STATUS_CODE.FAILURE : STATUS_CODE.OK);
            });
          });

          sftp.on("RMDIR", (id, dirPath) => {
            backend.rmdir(dirPath, (err, res) => {
              sftp.status(id, err ? STATUS_CODE.FAILURE : STATUS_CODE.OK);
            });
          });

          sftp.on("REALPATH", (id, filePath) => {
            const normalizedPath = path.normalize(filePath);
            const name = {
              filename: "/",
              attrs: new Stats({
                mode: 0o644 | constants.S_IFDIR,
                size: 4096,
                uid: 9001,
                gid: 8001,
                atime: (Date.now() / 1000) | 0,
                mtime: (Date.now() / 1000) | 0,
              }),
            };
            if (normalizedPath !== ".") name.filename = normalizedPath;
            sftp.name(id, name);
          });

          sftp.on("MKDIR", (id, dirPath, attrs) => {
            backend.mkdir(dirPath, (err) => {
              sftp.status(id, err ? STATUS_CODE.FAILURE : STATUS_CODE.OK);
            });
          });
        };

        client.on("ready", () => {
          client.on("session", (accept, reject) => {
            const session = accept();
            session.once("sftp", (accept, reject) => {
              if (accept) {
                const sftp = accept();
                setSftpListener(sftp);
              }
            });
          });
        });
      },
    );

    this.sshServer.listen(port, host);
  }
}

export default Server;
