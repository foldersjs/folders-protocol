import HiveThriftClient from './hiveThriftClient.js';
import assert from 'assert';
import { Readable } from 'stream';
import tableFormatter from 'markdown-table';
import { z } from 'zod';

const FoldersHiveOptions = z.object({
  host: z.string(),
  port: z.number(),
  username: z.string().optional(),
  password: z.string().optional(),
  auth: z.string().optional(),
  timeout: z.number().optional(),
  checkConfig: z.boolean().optional(),
});

const DEFAULT_HIVE_PREFIX = '/folders.io_0:hive/';

const showDatabases = function (client, prefix, cb) {
  client.getSchemasNames(function (error, databases) {
    if (error) {
      console.log('show shemas error', error);
      return cb(error, null);
    }
    if (!databases) {
      return cb('databases null', null);
    }
    cb(null, dbAsFolders(prefix, databases));
  });
};

const dbAsFolders = function (prefix, dbs) {
  const out = [];
  for (let i = 0; i < dbs.length; i++) {
    const db = dbs[i];
    const o = {
      name: db,
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
  client.getTablesNames(dbName, function (error, tables) {
    if (error) {
      return cb(error, null);
    }
    if (!tables) {
      return cb('null tables,', tables);
    }
    cb(null, tbAsFolders(prefix, dbName, tables));
  });
};

const tbAsFolders = function (prefix, dbName, tbs) {
  const out = [];
  for (let i = 0; i < tbs.length; i++) {
    const table = tbs[i];
    const o = {
      name: table,
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
  const metadatas = ['columns', 'create_table', 'select'];
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
  client.getTableRecords(dbName, tbName, function (error, records) {
    if (error) {
      return cb(error, null);
    }
    if (!records) {
      return cb('null tables data,', null);
    }
    const formattedData = tableFormatter(records);
    callbackCatResult('select.md', formattedData, cb);
  });
};

const showCreateTable = function (client, prefix, dbName, tbName, cb) {
  client.showCreateTable(dbName, tbName, function (error, createTableSQL) {
    if (error) {
      return cb(error, null);
    }
    if (!createTableSQL) {
      return cb('null tables,', null);
    }
    const foramttedCreateTableSQL = '```sql' + '\n' + createTableSQL + '\n' + '```';
    callbackCatResult('create_table.md', foramttedCreateTableSQL, cb);
  });
};

const showTableColumns = function (client, prefix, dbName, tbName, cb) {
  client.getTableColumns(dbName, tbName, function (error, columns) {
    if (error) {
      return cb(error, null);
    }
    if (!columns) {
      return cb('null tables,', null);
    }
    const formattedColumnsData = tableFormatter(columns);
    callbackCatResult('columns.md', formattedColumnsData, cb);
  });
};

const callbackCatResult = function (name, data, cb) {
  const stream = new Readable();
  stream.push(data);
  stream.push(null);
  cb(null, {
    stream: stream,
    size: data.length,
    name: name,
  });
};

class FoldersHive {
  constructor(prefix, options, callback) {
    const parsedOptions = FoldersHiveOptions.parse(options);
    if (prefix && prefix.length && prefix.substr(-1) != '/') prefix += '/';
    this.prefix = prefix || DEFAULT_HIVE_PREFIX;
    this.configure(parsedOptions, callback);
  }

  configure(options, callback) {
    this.host = options.host;
    this.port = options.port;
    this.username = options.username = options.username || 'anonymous';
    this.password = options.password = options.password || '';
    this.auth = options.auth = options.auth || 'none';
    this.timeout = options.timeout = 10000;
    this.client = new HiveThriftClient(options, callback);
  }

  disconnect(callback) {
    this.client.disconnect(callback);
  }

  static features = {
    cat: true,
    ls: true,
    write: false,
    server: false,
  };

  static isConfigValid(config, cb) {
    const parsedConfig = FoldersHiveOptions.parse(config);
    assert.equal(typeof cb, 'function', "argument 'cb' must be a function");
    const { checkConfig } = parsedConfig;
    if (checkConfig == false) {
      return cb(null, parsedConfig);
    }
    return cb(null, parsedConfig);
  }

  getHivePath(path, prefix) {
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
    path = this.getHivePath(path, this.prefix);
    if (path == null || !path.database) {
      showDatabases(this.client, this.prefix, cb);
    } else if (!path.table) {
      showTables(this.client, this.prefix, path.database, cb);
    } else {
      showTableMetas(this.prefix, path.database + '/' + path.table, cb);
    }
  }

  cat(path, cb) {
    path = this.getHivePath(path, this.prefix);
    if (path == null || !path.database || !path.table || !path.tableMetadata) {
      const error = 'please specify the the database,table and metadata you want in path';
      console.log(error);
      return cb(error, null);
    }
    if (path.tableMetadata == 'select.md') {
      showTableSelect(this.client, this.prefix, path.database, path.table, cb);
    } else if (path.tableMetadata == 'create_table.md') {
      showCreateTable(this.client, this.prefix, path.database, path.table, cb);
    } else if (path.tableMetadata == 'columns.md') {
      showTableColumns(this.client, this.prefix, path.database, path.table, cb);
    } else {
      cb('not supported yet', null);
    }
  }
}

export default FoldersHive;
