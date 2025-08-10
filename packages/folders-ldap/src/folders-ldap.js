import uriParse from 'url';
import ldap from 'ldapjs';
import { z } from 'zod';
import Server from './folders-ldap-server.js';
import { Readable } from 'stream';
import util from 'util';

const FoldersLdapOptions = z.object({
  connectionString: z.string(),
  enableEmbeddedServer: z.boolean().optional(),
  backend: z.any().optional(),
});

const parseConnString = function (connectionString) {
  const uri = uriParse.parse(connectionString, true);
  const conn = {
    host: uri.hostname || uri.host,
    port: uri.port || 389,
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

class FoldersLdap {
  constructor(prefix, options) {
    const parsedOptions = FoldersLdapOptions.parse(options);
    this.options = parsedOptions;
    this.prefix = prefix;
    this.connectionString = parsedOptions.connectionString;
    this.server = null;

    const enableEmbeddedServer = parsedOptions.enableEmbeddedServer || false;
    if (enableEmbeddedServer) {
      const conn = parseConnString(this.connectionString);
      this.server = new Server(conn);
      this.server.start(parsedOptions.backend);
    }
  }

  static dataVolume() {
    return { RXOK: FoldersLdap.RXOK, TXOK: FoldersLdap.TXOK };
  }

  static TXOK = 0;
  static RXOK = 0;

  static features = {
    cat: true,
    ls: true,
    write: true,
    server: true,
  };

  prepare() {
    if (this.ldap) {
      return this.ldap;
    }

    const conn = parseConnString(this.connectionString);

    const client = ldap.createClient({
      url: `ldap://${conn.host}:${conn.port}`,
    });

    this.ldap = client;
    return client;
  }

  async ls(path) {
    if (path != '.') {
      if (path.length && path.substr(0, 1) != '/') path = '/' + path;
      if (path.length && path.substr(-1) != '/') path = path + '/';
    }

    const ldapClient = this.prepare();

    const opts = {
      filter: '(objectclass=organization)',
      scope: 'one',
      paging: {
        pageSize: 250,
        pagePause: true,
      },
    };

    return new Promise((resolve, reject) => {
      const queue = [];
      ldapClient.search('dc=example', opts, (err, res) => {
        if (err) {
          return reject(err);
        }

        res.on('searchEntry', (entry) => {
          queue.push(entry.object);
        });
        res.on('page', (result, cb) => {
          if (cb) cb();
        });
        res.on('error', (err) => {
          reject(err);
        });
        res.on('end', (result) => {
          resolve(this.asFolders(path, queue));
        });
      });
    });
  }

  asFolders(dir, files) {
    const out = [];
    for (let i = 0; i < files.length; i++) {
      let file = files[i];
      if (file.foldersio) file = JSON.parse(file.foldersio);
      const o = {
        name: file.name || file.dn,
      };
      if (dir == '.') o.fullPath = '/' + (file.name || file.dn);
      else o.fullPath = dir + (file.name || file.dn);

      o.uri = o.fullPath;
      o.size = file.size || 0;
      o.extension = file.extension || 'txt';
      o.type = file.type || 'text/plain';
      if (file.modificationTime) o.modificationTime = file.modificationTime;

      if (file.type == '1') {
        o.extension = '+folder';
        o.type = '';
      }
      if (file.type == '2') {
        o.extension = '+folder';
        o.type = '';
      }

      out.push(o);
    }
    return out;
  }

  async cat(data) {
    const path = data;
    const ldapClient = this.prepare();

    const opts = {
      filter: '(objectclass=organization)',
      scope: 'sub',
      paging: {
        pageSize: 250,
        pagePause: true,
      },
    };

    return new Promise((resolve, reject) => {
      const queue = [];
      ldapClient.search('o=example', opts, (err, res) => {
        if (err) {
          return reject(err);
        }

        res.on('searchEntry', (entry) => {
          queue.push(entry);
        });
        res.on('page', (result, cb) => {
          if (cb) cb();
        });
        res.on('error', (resErr) => {
          reject(resErr);
        });
        res.on('end', (result) => {
          const blob = JSON.stringify(queue);
          const file = { size: blob.length, name: 'text.json' };
          const stream = new Readable();
          stream.push(blob);
          stream.push(null);
          resolve({
            stream: stream,
            size: file.size,
            name: file.name,
            meta: { mime: 'text/json', date: new Date() },
          });
        });
      });
    });
  }

  async write(uri, data) {
    const ldapClient = this.prepare();
    data.on('data', function (d) {
      FoldersLdap.RXOK += d.length;
    });

    const entry = {
      cn: 'foo',
      sn: 'bar',
      email: ['foo@bar.com', 'foo1@bar.com'],
      objectclass: 'fooPerson',
    };

    const addAsync = util.promisify(ldapClient.add).bind(ldapClient);
    await addAsync('cn=foo, o=example', entry);
    return 'write uri success';
  }

  dump() {
    return this.options;
  }
}

export default FoldersLdap;
