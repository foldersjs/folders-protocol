import { Server as SshServer, utils as ssh2utils } from 'ssh2';
import fs from 'fs';
import crypto from 'crypto';
import Config from '../config.js';
import Fio from 'folders';
import { PassThrough } from 'stream';
import { Stats } from 'fs';
import constants from 'constants';
import path from 'path';

const home = function () {
  return process.env[process.platform == 'win32' ? 'USERPROFILE' : 'HOME'];
};

function randomValueHex(len) {
  len = len || 10;
  return crypto.randomBytes(Math.ceil(len / 2)).toString('hex').slice(0, len);
}

const constructLongName = function (file) {
  let permissions;
  const d = new Date(parseFloat(file.modificationTime));
  const date = [d.toString().substr(4, 6), d.getHours() + ':' + d.getMinutes()].join(' ');

  if (file.extension == '+folder') {
    permissions = 'drw-rw-r--';
  } else {
    permissions = '-rw-rw-r--';
  }
  const longname = [];
  longname[0] = permissions;
  longname[1] = 1;
  longname[2] = 'ssh';
  longname[3] = 'ssh';
  longname[4] = file.size;
  longname[5] = date;
  longname[6] = file.name;
  return longname.join(' ');
};

class Server {
  constructor(credentials, debug) {
    this.SSHCredentials = credentials;
    this.debug = debug || Config.server.debug;
    this.sshServer = null;
    console.log('[SSH Server] : inin the SSH Server,', this.SSHCredentials);
  }

  close() {
    if (this.sshServer != null) {
      this.sshServer.close();
    }
  }

  start(backend) {
    const SSHCredentials = this.SSHCredentials;
    backend = backend || Fio.provider('local').create('local');

    if (SSHCredentials.host !== 'localhost') {
      return;
    }

    let pubKey;
    if (Config.client.publickKeyPath) {
      pubKey = ssh2utils.genPublicKey(ssh2utils.parseKey(fs.readFileSync(Config.client.publickKeyPath)));
    } else if (Config.client.publicKey) {
      pubKey = ssh2utils.genPublicKey(ssh2utils.parseKey(Config.client.publicKey));
    } else {
      pubKey = ssh2utils.genPublicKey(ssh2utils.parseKey(fs.readFileSync(home() + '/.ssh/id_rsa.pub')));
    }

    let privateKey;
    if (Config.server.privateKeyPath) {
      privateKey = fs.readFileSync(Config.server.privateKeyPath);
    } else if (Config.server.privateKey) {
      privateKey = Config.server.privateKey;
    } else {
      privateKey = fs.readFileSync(home() + '/.ssh/id_rsa');
    }

    const sshServer = new SshServer(
      {
        privateKey: privateKey,
        debug: this.debug,
      },
      (client) => {
        console.log('[SSH Server] : authentication client');
        client.on('authentication', (ctx) => {
          console.log(ctx.method, ctx.username);
          if (ctx.method === 'publickey' && ctx.key.algo === pubKey.fulltype) {
            if (ctx.signature) {
              const verifier = crypto.createVerify(ctx.sigAlgo);
              verifier.update(ctx.blob);
              if (verifier.verify(pubKey.publicOrig, ctx.signature, 'binary')) {
                console.log('[SSH Server] : authentication client accept');
                ctx.accept();
              } else {
                console.log('[SSH Server] : authentication client reject');
                ctx.reject();
              }
            } else {
              console.log('[SSH Server] : authentication client accept');
              ctx.accept();
            }
          } else if (ctx.method === 'password') {
            const username = Config.client.username;
            const password = Config.client.password;
            if (ctx.username === username && ctx.password === password) {
              console.log('[SSH Server] : authentication client accept');
              ctx.accept();
            } else {
              console.log('[SSH Server] : authentication client reject');
              ctx.reject();
            }
          } else {
            console.log('[SSH Server] : authentication client reject');
            ctx.reject();
          }
        });

        const setSftpListener = (sftp) => {
          sftp.handles = {};
          sftp.cache = {};

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
            let out = [];
            for (let i = 0; i < files.length; i++) {
              const file = files[i];
              const mode = file.extension == '+folder' ? constants.S_IFDIR : constants.S_IFREG;
              const o = {
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
              out.push(o);
            }
            out = addParCurDir(out);
            return out;
          };

          function addParCurDir(out) {
            let isParDir = false;
            let isCurDir = false;
            for (let i = 0; i < out.length; ++i) {
              if (out[i].filename === '.') isCurDir = true;
              if (out[i].filename === '..') isParDir = true;
            }
            if (!isParDir) {
              out.push({
                filename: '..',
                longname: 'drwxr-xr-x   4 ssh   ssh      4096 May 16  2013 ..',
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
            if (!isCurDir) {
              out.push({
                filename: '.',
                longname: 'drwxr-xr-x  56 ssh   ssh      4096 Nov 10 01:05 .',
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
          }

          sftp.on('STAT', (id, path) => {
            const dirname = path.dirname(path);
            const basename = path.basename(path);
            let attrs_ = {};
            if (path == '/') {
              attrs_.mode = 0o664 | constants.S_IFDIR;
              sftp.attrs(id, attrs_);
              return;
            }
            backend.ls(dirname, (err, res) => {
              for (let i = 0; i < res.length; ++i) {
                const file = res[i];
                if (file.name == basename) {
                  const mode = file.extension == '+folder' ? constants.S_IFDIR : constants.S_IFREG;
                  attrs_ = new Stats({
                    mode: 0o644 | mode,
                    size: file.size,
                    uid: 9001,
                    gid: 8001,
                    atime: file.modificationTime,
                    mtime: file.modificationTime,
                  });
                  break;
                }
              }
              sftp.attrs(id, attrs_);
            });
          });

          sftp.on('LSTAT', (id, path) => {
            const attrs_ = new Stats({
              mode: 0o644 | constants.S_IFREG,
              size: 1024,
              uid: 9001,
              gid: 9001,
              atime: (Date.now() / 1000) | 0,
              mtime: (Date.now() / 1000) | 0,
            });
            sftp.attrs(id, attrs_);
          });

          sftp.on('OPENDIR', (id, path) => {
            const handle_ = Buffer.from(randomValueHex());
            sftp.handles[handle_] = { path: path, next_index: 0 };
            sftp.handle(id, handle_);
          });

          sftp.on('READDIR', (id, handle) => {
            const path = sftp.handles[handle].path;
            if (sftp.handles[handle].next_index > 0) {
              sftp.name(id, []);
              return;
            }
            backend.ls(path, (err, res) => {
              const list_ = asSSHFile(res);
              sftp.handles[handle].next_index = list_.length;
              sftp.name(id, list_);
            });
          });

          sftp.on('OPEN', (id, path, flags, attrs) => {
            if (flags == OPEN_MODE.READ) {
              backend.cat(path, (err, results) => {
                if (err) {
                  sftp.status(id, STATUS_CODE.NO_SUCH_FILE);
                  return;
                }
                const stream = results.stream;
                const handle_ = Buffer.from(randomValueHex());
                sftp.handles[handle_] = {
                  stream: stream,
                  transferred: 0,
                  hooked: false,
                  queuedRead: [],
                  readLength: 0,
                  isReadEnd: false,
                  buff: Buffer.alloc(0),
                };
                sftp.handle(id, handle_);
                stream.pause();
              });
            }
            if (flags == (OPEN_MODE.TRUNC | OPEN_MODE.CREAT | OPEN_MODE.WRITE)) {
              const handle_ = Buffer.from(randomValueHex());
              const pass = new PassThrough();
              sftp.handles[handle_] = { stream: pass, mode: 'w', queuedWrite: [], hooked: false };
              sftp.handle(id, handle_);
              backend.write(path, pass, (err, result) => {
                if (err) {
                  sftp.status(id, STATUS_CODE.FAILURE);
                }
              });
            }
          });

          sftp.on('CLOSE', (id, handle) => {
            if (sftp.handles[handle].mode == 'w') {
              sftp.handles[handle].stream.push(null);
            }
            if (sftp.handles[handle]) delete sftp.handles[handle];
            sftp.status(id, STATUS_CODE.OK);
          });

          sftp.on('READ', (id, handle, offset, length) => {
            const stream = sftp.handles[handle].stream;
            if (stream == null || typeof stream == 'undefined') {
              sftp.status(id, STATUS_CODE.NO_SUCH_FILE);
              return;
            }
            if (sftp.handles[handle].isReadEnd) {
              sftp.status(id, STATUS_CODE.EOF);
              sftp.handles[handle].isReadEnd = false;
              sftp.handles[handle].buff = null;
              return;
            }
            if (!sftp.handles[handle].hooked) {
              sftp.handles[handle].hooked = true;
              stream.once('end', () => {
                if (sftp.handles[handle].queuedRead.length > 0) {
                  const cmd = sftp.handles[handle].queuedRead[0];
                  const id = cmd.id;
                  sftp.data(id, sftp.handles[handle].buff);
                }
                sftp.handles[handle].queuedRead.shift();
                if (sftp.handles[handle].queuedRead.length > 0) {
                  const cmd = sftp.handles[handle].queuedRead[0];
                  const id = cmd.id;
                  sftp.status(id, STATUS_CODE.EOF);
                }
                sftp.handles[handle].isReadEnd = true;
              });
              stream.on('data', (chunk) => {
                sftp.handles[handle].buff = Buffer.concat([sftp.handles[handle].buff, chunk]);
                if (sftp.handles[handle].queuedRead.length > 0) {
                  const cmd = sftp.handles[handle].queuedRead[0];
                  const length = cmd.length;
                  const id = cmd.id;
                  if (sftp.handles[handle].buff.length >= length) {
                    const buf1 = sftp.handles[handle].buff.slice(0, length);
                    sftp.handles[handle].transferred += length;
                    sftp.data(id, buf1);
                    sftp.handles[handle].buff = sftp.handles[handle].buff.slice(length);
                    sftp.handles[handle].queuedRead.shift();
                  }
                }
                if (sftp.handles[handle].buff.length > 1e6) {
                  stream.pause();
                }
              });
            }
            if (sftp.handles[handle].buff.length >= length) {
              const buf1 = sftp.handles[handle].buff.slice(0, length);
              sftp.handles[handle].transferred += length;
              sftp.data(id, buf1);
              sftp.handles[handle].buff = sftp.handles[handle].buff.slice(length);
            } else {
              sftp.handles[handle].queuedRead.push({ id: id, length: length });
            }
            if (sftp.handles[handle].buff.length < 1e6 && !sftp.handles[handle].isReadEnd) {
              stream.resume();
            }
          });

          sftp.on('WRITE', (id, handle, offset, data) => {
            const rs = sftp.handles[handle].stream;
            if (rs == null || typeof rs == 'undefined') {
              sftp.status(id, STATUS_CODE.FAILURE);
              return;
            }
            if (!sftp.handles[handle].hooked) {
              sftp.handles[handle].hooked = true;
              rs._read = function () {
                const queueLength = sftp.handles[handle].queuedWrite.length;
                const limit = queueLength < 5 ? queueLength : 5;
                for (let i = 0; i < limit; ++i) {
                  const id = sftp.handles[handle].queuedWrite[i];
                  sftp.status(id, STATUS_CODE.OK);
                }
                for (let i = 0; i < limit; ++i) {
                  sftp.handles[handle].queuedWrite.shift();
                }
              };
            }
            if (rs.push(data)) {
              sftp.status(id, STATUS_CODE.OK);
            } else {
              sftp.handles[handle].queuedWrite.push(id);
            }
          });

          sftp.on('REMOVE', (id, path) => {
            backend.unlink(path, (err) => {
              if (err) sftp.status(id, STATUS_CODE.FAILURE);
              else sftp.status(id, STATUS_CODE.OK);
            });
          });

          sftp.on('RMDIR', (id, path) => {
            backend.rmdir(path, (err, res) => {
              if (err) sftp.status(id, STATUS_CODE.FAILURE);
              else sftp.status(id, STATUS_CODE.OK);
            });
          });

          sftp.on('REALPATH', (id, path) => {
            path = path.normalize(path);
            const name = {
              filename: '/',
              attrs: new Stats({
                mode: 0o644 | constants.S_IFDIR,
                size: 4096,
                uid: 9001,
                gid: 8001,
                atime: (Date.now() / 1000) | 0,
                mtime: (Date.now() / 1000) | 0,
              }),
            };
            if (path != '.') name.filename = path;
            sftp.name(id, name);
          });

          sftp.on('MKDIR', (id, path, attrs) => {
            backend.mkdir(path, (err) => {
              if (err) sftp.status(id, STATUS_CODE.FAILURE);
              else sftp.status(id, STATUS_CODE.OK);
            });
          });
        };

        client.on('ready', () => {
          client.on('session', (accept, reject) => {
            const session = accept();
            session.once('exec', (accept, reject, info) => {
              console.log('[SSH Server] : Client wants to execute: ' + require('util').inspect(info.command));
            });
            session.once('sftp', (accept, reject) => {
              if (accept) {
                const sftp = accept();
                setSftpListener(sftp);
              }
            });
          });
        });

        client.on('end', () => {
          console.log('[SSH Server] :  The client socket disconnected.');
        });

        client.on('close', (hadError) => {
          if (hadError) console.log('[SSH Server] :  The client socket was closed due to error');
          console.log('[SSH Server] :  The client socket was closed');
        });
      },
    );

    sshServer.listen(SSHCredentials.port, SSHCredentials.host, function () {
      console.log('[SSH Server] : Listening on port ' + this.address().port);
    });

    this.sshServer = sshServer;
  }
}

export default Server;
