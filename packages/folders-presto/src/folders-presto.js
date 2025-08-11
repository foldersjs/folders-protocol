import presto from 'presto-client';
import assert from 'assert';
import { Readable } from 'stream';
import * as tableFormatter from 'markdown-table';
import { z } from 'zod';
import util from 'util';

const FoldersPrestoOptions = z.object({
  host: z.string(),
  port: z.number(),
  user: z.string(),
  catalog: z.string().optional(),
  schema: z.string().optional(),
  checkConfig: z.boolean().optional(),
});

const DEFAULT_PRESTO_PREFIX = '/folders.io_0:presto/';

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

const showTableMetas = function (prefix, path) {
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
  return out;
};

const showGenericResult = function (name, data, columns) {
  const title = [];
  for (let i = 0; i < columns.length; i++) {
    title.push(columns[i].name);
  }
  data.unshift(title);

  const formattedColumnsData = tableFormatter(data);
  const stream = new Readable();
  stream.push(formattedColumnsData);
  stream.push(null);

  return {
    stream: stream,
    size: formattedColumnsData.length,
    name: name,
  };
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

    this.client.execute = util.promisify(this.client.execute);
  }

  static features = {
    cat: true,
    ls: true,
    write: false,
    server: false,
  };

  static async isConfigValid(config) {
    const parsedConfig = FoldersPrestoOptions.parse(config);
    const { checkConfig } = parsedConfig;
    if (checkConfig == false) {
      return parsedConfig;
    }
    return parsedConfig;
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

  async ls(path) {
    path = this.getPrestoPath(path, this.prefix);
    if (path == null || !path.database) {
      const { data } = await this.client.execute('SHOW SCHEMAS');
      return dbAsFolders(this.prefix, data);
    } else if (!path.table) {
      const { data } = await this.client.execute(
        'SHOW TABLES FROM ' + path.database
      );
      return tbAsFolders(this.prefix, path.database, data);
    } else {
      return showTableMetas(this.prefix, path.database + '/' + path.table);
    }
  }

  async cat(path) {
    path = this.getPrestoPath(path, this.prefix);
    if (
      path == null ||
      !path.database ||
      !path.table ||
      !path.tableMetadata
    ) {
      throw new Error(
        'please specify the the database,table and metadata you want in path'
      );
    }

    if (path.tableMetadata == 'select.md') {
      const { data, columns } = await this.client.execute(
        'SELECT * FROM ' + path.database + '.' + path.table + ' LIMIT 10'
      );
      const name = path.database + '.' + path.table + '.select.md';
      return showGenericResult(name, data, columns);
    } else if (path.tableMetadata == 'columns.md') {
      const { data, columns } = await this.client.execute(
        'SHOW COLUMNS FROM ' + path.database + '.' + path.table
      );
      const name = path.database + '.' + path.table + '.columns.md';
      return showGenericResult(name, data, columns);
    } else {
      throw new Error('not supported yet');
    }
  }
}

export default FoldersPresto;
