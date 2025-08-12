import presto from "presto-client";
import assert from "assert";
import { Readable } from "stream";
import { markdownTable } from "markdown-table";
import { z } from "zod";
import util from "util";

const FoldersPrestoOptions = z.object({
  host: z.string(),
  port: z.number(),
  user: z.string(),
  catalog: z.string().optional(),
  schema: z.string().optional(),
  checkConfig: z.boolean().optional(),
});

const DEFAULT_PRESTO_PREFIX = "/folders.io_0:presto/";

class FoldersPresto {
  constructor(prefix, options) {
    const parsedOptions = FoldersPrestoOptions.parse(options);
    if (prefix && prefix.length && !prefix.endsWith("/")) prefix += "/";
    this.prefix = prefix || DEFAULT_PRESTO_PREFIX;
    this.configure(parsedOptions);
  }

  configure(options) {
    this.client = new presto.Client({
      host: options.host,
      port: options.port,
      user: options.user,
      catalog: options.catalog || "hive",
      schema: options.schema || "default",
    });

    const originalExecute = this.client.execute.bind(this.client);
    this.client.execute = (query) => {
      return new Promise((resolve, reject) => {
        originalExecute(query, (error, data, columns) => {
          if (error) return reject(error);
          resolve({ data, columns });
        });
      });
    };
  }

  static features = {
    cat: true,
    ls: true,
    write: false,
    server: false,
  };

  static async isConfigValid(config) {
    const parsedConfig = FoldersPrestoOptions.parse(config);
    if (parsedConfig.checkConfig === false) {
      return parsedConfig;
    }
    return parsedConfig;
  }

  #getPrestoPath(path) {
    path = path === "/" ? null : path.slice(1);

    if (path == null) {
      return {};
    }

    let parts = path.split("/");
    if (this.prefix && path.startsWith(this.prefix)) {
      parts = path.substring(this.prefix.length).split("/");
    }

    const out = {};
    if (parts.length > 0 && parts[0]) out.database = parts[0];
    if (parts.length > 1 && parts[1]) out.table = parts[1];
    if (parts.length > 2 && parts[2]) out.tableMetadata = parts[2];

    return out;
  }

  #dbAsFolders(dbs) {
    return dbs.map((db) => ({
      name: db[0],
      fullPath: db[0],
      meta: {},
      uri: this.prefix + db[0],
      size: 0,
      extension: "+folder",
      modificationTime: 0,
    }));
  }

  #tbAsFolders(dbName, tbs) {
    return tbs.map((table) => ({
      name: table[0],
      fullPath: `${dbName}/${table[0]}`,
      meta: {},
      uri: `${this.prefix}${dbName}/${table[0]}`,
      size: 0,
      extension: "+folder",
      modificationTime: 0,
    }));
  }

  #showTableMetas(path) {
    const metadatas = ["columns", "select"];
    return metadatas.map((meta) => ({
      name: `${meta}.md`,
      fullPath: `${path}/${meta}.md`,
      meta: {},
      uri: `${this.prefix}${path}/${meta}.md`,
      size: 0,
      extension: "md",
      type: "text/markdown",
      modificationTime: 0,
    }));
  }

  #showGenericResult(name, data, columns) {
    const title = columns.map((c) => c.name);
    data.unshift(title);
    const formattedData = markdownTable(data);
    const stream = new Readable();
    stream.push(formattedData);
    stream.push(null);

    return {
      stream,
      size: formattedData.length,
      name,
    };
  }

  async ls(path) {
    const prestoPath = this.#getPrestoPath(path);
    if (!prestoPath.database) {
      const { data } = await this.client.execute("SHOW SCHEMAS");
      return this.#dbAsFolders(data);
    } else if (!prestoPath.table) {
      const { data } = await this.client.execute(
        `SHOW TABLES FROM ${prestoPath.database}`,
      );
      return this.#tbAsFolders(prestoPath.database, data);
    } else {
      return this.#showTableMetas(`${prestoPath.database}/${prestoPath.table}`);
    }
  }

  async cat(path) {
    const prestoPath = this.#getPrestoPath(path);
    if (
      !prestoPath.database ||
      !prestoPath.table ||
      !prestoPath.tableMetadata
    ) {
      throw new Error(
        "Please specify the database, table, and metadata in the path",
      );
    }

    const name = `${prestoPath.database}.${prestoPath.table}.${prestoPath.tableMetadata}`;
    if (prestoPath.tableMetadata === "select.md") {
      const { data, columns } = await this.client.execute(
        `SELECT * FROM ${prestoPath.database}.${prestoPath.table} LIMIT 10`,
      );
      return this.#showGenericResult(name, data, columns);
    } else if (prestoPath.tableMetadata === "columns.md") {
      const { data, columns } = await this.client.execute(
        `SHOW COLUMNS FROM ${prestoPath.database}.${prestoPath.table}`,
      );
      return this.#showGenericResult(name, data, columns);
    } else {
      throw new Error("Not supported yet");
    }
  }
}

export default FoldersPresto;
