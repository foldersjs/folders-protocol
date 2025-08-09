import presto from 'presto-client';
import assert from 'assert';
import { Readable } from 'stream';
import tableFormatter from 'markdown-table';
import { z } from 'zod';

const FoldersPrestoOptions = z.object({
  host: z.string(),
  port: z.number(),
  user: z.string(),
  catalog: z.string().optional(),
  schema: z.string().optional(),
  checkConfig: z.boolean().optional(),
});

const DEFAULT_PRESTO_PREFIX = '/folders.io_0:presto/';

const showDatabases = function (client, prefix, cb) {
  client.execute('SHOW SCHEMAS', function (error, data, columns) {
    if (error) {
      console.log('show shemas error', error);
      return cb(error, null);
    }
    cb(null, dbAsFolders(prefix, data));
  });
};

const dbAsFolders = function (prefix, dbs) {
  const out = [];
  for (let i = 0; i < dbs.length; i++) {
    const db = dbs[i];
    const o = {
      name: db[0],
    };
    o.fullPath = o.name;
    o.meta = {};
    o.uri = prefix + o.fullPath;
    o.size = 0;
    o.extension = '+folder';
    o.modificationTime = 0;
    out.push(o);
  }
  return out;
};

const showTables = function (client, prefix, dbName, cb) {
  client.execute('SHOW TABLES FROM ' + dbName, function (error, data, columns) {
    if (error) {
      console.log('show TABLES error', error);
      return cb(error, null);
    }
    cb(null, tbAsFolders(prefix, dbName, data));
  });
};

const tbAsFolders = function (prefix, dbName, tbs) {
  const out = [];
  for (let i = 0; i < tbs.length; i++) {
    const table = tbs[i];
    const o = {
      name: table[0],
    };
    o.fullPath = dbName + '/' + o.name;
    o.meta = {};
    o.uri = prefix + o.fullPath;
    o.size = 0;
    o.extension = '+folder';
    o.modificationTime = 0;
    out.push(o);
  }
  return out;
};

const showTableMetas = function (prefix, path, cb) {
  const metadatas = ['columns', 'select'];
  const out = [];
  for (let i = 0; i < metadatas.length; i++) {
    const o = {
      name: metadatas[i] + '.md',
    };
    o.fullPath = path + '/' + o.name;
    o.meta = {};
    o.uri = prefix + o.fullPath;
    o.size = 0;
    o.extension = 'md';
    o.type = 'text/markdown';
    o.modificationTime = 0;
    out.push(o);
  }
  cb(null, out);
};

const showTableSelect = function (client, prefix, dbName, tbName, cb) {
  client.execute('SELECT * FROM ' + dbName + '.' + tbName + ' LIMIT 10', function (error, data, columns) {
    if (error) {
      console.log('SELECT * FROM error', error);
      return cb(error, null);
    }
    const name = dbName + '.' + tbName + '.select.md';
    showGenericResult(name, data, columns, cb);
  });
};

const showTableColumns = function (client, prefix, dbName, tbName, cb) {
  client.execute('SHOW COLUMNS FROM ' + dbName + '.' + tbName, function (error, data, columns) {
    if (error) {
      console.log('SHOW COLUMNS error', error);
      return cb(error, null);
    }
    const name = dbName + '.' + tbName + '.columns.md';
    showGenericResult(name, data, columns, cb);
  });
};

const showGenericResult = function (name, data, columns, cb) {
  const title = [];
  for (let i = 0; i < columns.length; i++) {
    title.push(columns[i].name);
  }
  data.unshift(title);

  const formattedColumnsData = tableFormatter(data);
  const stream = new Readable();
  stream.push(formattedColumnsData);
  stream.push(null);

  cb(null, {
    stream: stream,
    size: formattedColumnsData.length,
    name: name,
  });
};

class FoldersPresto {
  constructor(prefix, options) {
    const parsedOptions = FoldersPrestoOptions.parse(options);
    if (prefix && prefix.length && prefix.substr(-1) != '/') prefix += '/';
    this.prefix = prefix || DEFAULT_PRESTO_PREFIX;
    this.configure(parsedOptions);
  }

  configure(options) {
    this.host = options.host;
    this.port = options.port;
    this.user = options.user;
    this.catalog = options.catalog || 'hive';
    this.schema = options.schema || 'default';

    this.client = new presto.Client({
      host: this.host,
      port: this.port,
      user: this.user,
      catalog: this.catalog,
      schema: this.schema,
    });
  }

  static features = {
    cat: true,
    ls: true,
    write: false,
    server: false,
  };

  static isConfigValid(config, cb) {
    const parsedConfig = FoldersPrestoOptions.parse(config);
    assert.equal(typeof cb, 'function', "argument 'cb' must be a function");

    const { checkConfig } = parsedConfig;
    if (checkConfig == false) {
      return cb(null, parsedConfig);
    }
    return cb(null, parsedConfig);
  }

  getPrestoPath(path, prefix) {
    path = path == '/' ? null : path.slice(1);

    if (path == null) {
      return null;
    }

    let parts = path.split('/');
    let prefixPath = parts[0];
    if (prefix && prefix[0] == '/') prefixPath = '/' + prefixPath;
    prefixPath = prefixPath + '/';

    if (prefixPath == prefix) {
      parts = parts.slice(1, parts.length);
    }

    const out = {};
    if (parts.length > 0) out.database = parts[0];
    if (parts.length > 1) out.table = parts[1];
    if (parts.length > 2) out.tableMetadata = parts[2];

    return out;
  }

  ls(path, cb) {
    path = this.getPrestoPath(path, this.prefix);
    if (path == null || !path.database) {
      showDatabases(this.client, this.prefix, cb);
    } else if (!path.table) {
      showTables(this.client, this.prefix, path.database, cb);
    } else {
      showTableMetas(this.prefix, path.database + '/' + path.table, cb);
    }
  }

  cat(path, cb) {
    path = this.getPrestoPath(path, this.prefix);
    if (path == null || !path.database || !path.table || !path.tableMetadata) {
      const error = 'please specify the the database,table and metadata you want in path';
      console.log(error);
      cb(error, null);
    }

    if (path.tableMetadata == 'select.md') {
      showTableSelect(this.client, this.prefix, path.database, path.table, cb);
    } else if (path.tableMetadata == 'columns.md') {
      showTableColumns(this.client, this.prefix, path.database, path.table, cb);
    } else {
      cb('not supported yet', null);
    }
  }
}

export default FoldersPresto;
