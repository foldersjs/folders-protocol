import uriParse from 'url';
import { Client } from 'ssh2';
import path from 'path';
import mime from 'mime';
import { z } from 'zod';
import fs from 'fs';

import Config from '../config.js';
import SSHServer from './embedded-ssh-server.js';

const FoldersSshOptions = z.object({
  connectionString: z.string(),
  enableEmbeddedServer: z.boolean().optional(),
  backend: z.any().optional(),
});

const home = function () {
  return process.env[process.platform == 'win32' ? 'USERPROFILE' : 'HOME'];
};

const parseConnString = function (connectionString) {
  const uri = uriParse.parse(connectionString, true);
  const conn = {
    host: uri.hostname || uri.host,
    port: uri.port || 21,
  };
  if (uri.auth) {
    const auth = uri.auth.split(':', 2);
    conn.user = auth[0];
    if (auth.length == 2) {
      conn.pass = auth[1];
    }
  }
  conn.debugMode = true;

  return conn;
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
    return { RXOK: FoldersSsh.RXOK, TXOK: FoldersSsh.TXOK };
  }

  static TXOK = 0;
  static RXOK = 0;

  static features = {
    cat: true,
    ls: true,
    write: true,
    server: true,
  };

  connect(conn) {
    let privateKey;
    if (Config.client.privateKeyPath) {
      privateKey = fs.readFileSync(Config.client.privateKeyPath);
    } else if (Config.client.privateKey) {
      privateKey = Config.client.privateKey;
    } else {
      privateKey = fs.readFileSync(home() + '/.ssh/id_rsa');
    }

    const connectionDetails = {
      host: this.credentials.host,
      port: this.credentials.port,
      username: this.credentials.user,
      privateKey: privateKey,
    };

    if (this.credentials.pass) {
      connectionDetails.password = this.credentials.pass;
    }
    conn.connect(connectionDetails);
  }

  ls(filePath, cb) {
    console.log('[folders-ssh ls] folders-ssh, ls ', filePath);
    if (filePath.length && filePath.substr(0, 1) != '/') filePath = '/' + filePath;
    if (filePath.length && filePath.substr(-1) != '/') filePath = filePath + '/';

    const conn = new Client();
    conn
      .on('ready', () => {
        console.log('[folders-ssh ls] Client :: ready');

        conn.sftp((err, sftp) => {
          if (err) {
            console.error('[folders-ssh ls] error in sftp,', err);
            return cb(err);
          }

          sftp.opendir(filePath, (err, handle) => {
            if (err) {
              console.error('[folders-ssh ls] error in opendir,', err);
              return cb(err);
            }

            sftp.readdir(handle, { full: true }, (err, list) => {
              if (err) {
                console.error('[folders-ssh ls] error in readdir,', err);
                return cb(err);
              }

              cb(null, this.asFolders(filePath, list));
              conn.end();
            });
          });
        });
      })
      .on('error', (err) => {
        cb(err);
      });

    this.connect(conn);
  }

  asFolders(dir, files) {
    const z = [];

    for (let i = 0; i < files.length; ++i) {
      const file = files[i];
      const o = {};
      o.name = file.filename;
      o.extension = path.extname(o.name);
      o.size = file.attrs.size || 0;
      if (file.longname.substr(0, 1) == 'd') {
        o.extension = '+folder';
        o.type = '';
      }
      o.type = o.extension == '+folder' ? '' : mime.lookup(o.extension);
      o.fullPath = dir + file.filename;

      o.uri = o.fullPath;
      if (!o.meta) o.meta = {};
      const cols = ['mode', 'permissions', 'uid', 'gid'];
      for (const meta in cols) o.meta[cols[meta]] = file.attrs[cols[meta]];
      o.modificationTime = file.attrs.mtime;
      z.push(o);
    }

    return z;
  }

  cat(filePath, cb) {
    console.log('[folders-ssh cat] folders-ssh, cat ', filePath);

    const conn = new Client();
    conn
      .on('ready', () => {
        console.log('[folders-ssh cat] Client :: ready');

        conn.sftp((err, sftp) => {
          if (err) {
            console.error('[folders-ssh cat] error in sftp conn,', err);
            return cb(err);
          }

          sftp.stat(filePath, (err, attrs) => {
            if (err) {
              console.error('[folders-ssh cat] error in stat ,', err);
              return cb(err);
            }

            const stream = sftp.createReadStream(filePath);
            cb(null, {
              stream: stream,
              size: attrs.size,
              name: path.basename(filePath),
            });
          });
        });
      })
      .on('error', (err) => {
        cb(err);
      });

    this.connect(conn);
  }

  write(filePath, data, cb) {
    console.log('[folders-ssh write] folders-ssh, write ', filePath);

    const conn = new Client();
    conn
      .on('ready', () => {
        console.log('[folders-ssh write] Client :: ready');

        conn.sftp((err, sftp) => {
          if (err) {
            console.error('[folders-ssh write] error in sftp conn,', err);
            return cb(err);
          }

          try {
            if (data instanceof Buffer) {
              const stream = sftp.createWriteStream(filePath);
              stream.write(data, () => {
                stream.end(() => {
                  cb('write uri success');
                  conn.end();
                });
              });
            } else {
              const errHandle = (e) => {
                cb(e.message);
                conn.end();
              };

              sftp.open(filePath, 'w', (err, handle) => {
                if (err) {
                  return errHandle(err);
                }

                data.on('data', (buf) => {
                  FoldersSsh.RXOK += buf.length;
                  sftp.write(handle, buf, 0, buf.length, 0, (err) => {
                    if (err) {
                      return errHandle(err);
                    }
                  });
                });

                data.on('end', () => {
                  // sftp.end();
                });

                data.on('close', () => {
                  sftp.close(handle, (err) => {
                    if (err) {
                      return errHandle(err);
                    }
                    cb(null, 'write uri success');
                    conn.end();
                  });
                });
              });
            }
          } catch (e) {
            cb('unable to write uri,' + e.message);
            conn.end();
          }
        });
      })
      .on('error', (err) => {
        cb(err);
      });

    this.connect(conn);
  }

  unlink(filePath, cb) {
    console.log('[folders-ssh unlink] folders-ssh, unlink ', filePath);

    const conn = new Client();
    conn
      .on('ready', () => {
        console.log('[folders-ssh unlink] Client :: ready');

        conn.sftp((err, sftp) => {
          if (err) {
            console.error('[folders-ssh unlink] error in sftp conn,', err);
            return cb(err);
          }

          sftp.unlink(filePath, (err) => {
            if (err) {
              console.error('[folders-ssh unlink] error in sftp unlink,', err);
              return cb(err);
            }
            cb();
            conn.end();
          });
        });
      })
      .on('error', (err) => {
        cb(err);
      });

    this.connect(conn);
  }

  rmdir(filePath, cb) {
    console.log('[folders-ssh rmdir] folders-ssh, rmdir ', filePath);

    const conn = new Client();
    conn
      .on('ready', () => {
        console.log('[folders-ssh rmdir] Client :: ready');
        conn.sftp((err, sftp) => {
          if (err) {
            console.error('[folders-ssh rmdir] error in sftp conn,', err);
            return cb(err);
          }

          sftp.rmdir(filePath, (err) => {
            if (err) {
              console.error('[folders-ssh rmdir] error in sftp rmdir,', err);
              return cb(err);
            }
            cb();
            conn.end();
          });
        });
      })
      .on('error', (err) => {
        cb(err);
      });

    this.connect(conn);
  }

  mkdir(filePath, cb) {
    console.log('[folders-ssh mkdir] folders-ssh, mkdir ', filePath);

    const conn = new Client();
    conn
      .on('ready', () => {
        console.log('[folders-ssh mkdir] Client :: ready');
        conn.sftp((err, sftp) => {
          if (err) {
            console.error('[folders-ssh mkdir] error in sftp conn,', err);
            return cb(err);
          }

          sftp.mkdir(filePath, (err) => {
            if (err) {
              console.error('[folders-ssh mkdir] error in sftp mkdir,', err);
              return cb(err);
            }
            cb();
            conn.end();
          });
        });
      })
      .on('error', (err) => {
        cb(err);
      });

    this.connect(conn);
  }

  stat(filePath, cb) {
    console.log('[folders-ssh stat] folders-ssh, stat ', filePath);

    const conn = new Client();
    conn
      .on('ready', () => {
        console.log('[folders-ssh stat] Client :: ready');
        conn.sftp((err, sftp) => {
          if (err) {
            console.error('[folders-ssh stat] error in sftp conn,', err);
            return cb(err);
          }

          sftp.stat(filePath, (err, stats) => {
            if (err) {
              console.error('[folders-ssh stat] error in sftp stat,', err);
              return cb(err);
            }
            cb(null, stats);
            conn.end();
          });
        });
      })
      .on('error', (err) => {
        cb(err);
      });

    this.connect(conn);
  }

  dump() {
    return this.options;
  }
}

export default FoldersSsh;
