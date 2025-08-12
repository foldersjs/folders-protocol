import HiveThriftClient from "./hiveThriftClient.js";
import assert from "assert";
import { Readable } from "stream";
import { markdownTable } from "markdown-table";
import { z } from "zod";

const FoldersHiveOptions = z.object({
  host: z.string(),
  port: z.number(),
  username: z.string().optional().default("anonymous"),
  password: z.string().optional().default(""),
  auth: z.string().optional().default("none"),
  timeout: z.number().optional().default(10000),
  checkConfig: z.boolean().optional(),
});

const DEFAULT_HIVE_PREFIX = "/folders.io_0:hive/";

class FoldersHive {
  constructor(prefix, options) {
    const parsedOptions = FoldersHiveOptions.parse(options);
    this.prefix =
      (prefix && prefix.endsWith("/") ? prefix : `${prefix}/`) ||
      DEFAULT_HIVE_PREFIX;
    this.client = new HiveThriftClient(parsedOptions);
  }

  async connect() {
    await this.client.connect();
  }

  async disconnect() {
    await this.client.disconnect();
  }

  static features = {
    cat: true,
    ls: true,
    write: false,
    server: false,
  };

  static isConfigValid(config) {
    return FoldersHiveOptions.parse(config);
  }

  getHivePath(path) {
    path = path === "/" ? null : path.slice(1);
    if (path == null) {
      return {};
    }
    let parts = path.split("/");
    if (parts[0] + "/" === this.prefix) {
      parts = parts.slice(1);
    }
    const out = {};
    if (parts.length > 0) out.database = parts[0];
    if (parts.length > 1) out.table = parts[1];
    if (parts.length > 2) out.tableMetadata = parts[2];
    return out;
  }

  async ls(path) {
    const hivePath = this.getHivePath(path);

    if (!hivePath.database) {
      const dbs = await this.client.getSchemasNames();
      return dbs.map((db) => ({
        name: db,
        fullPath: db,
        uri: this.prefix + db,
        size: 0,
        extension: "+folder",
        modificationTime: 0,
        meta: {},
      }));
    }

    if (!hivePath.table) {
      const tables = await this.client.getTablesNames(hivePath.database);
      return tables.map((t) => ({
        name: t,
        fullPath: `${hivePath.database}/${t}`,
        uri: `${this.prefix}${hivePath.database}/${t}`,
        size: 0,
        extension: "+folder",
        modificationTime: 0,
        meta: {},
      }));
    }

    const metadatas = ["columns.md", "create_table.md", "select.md"];
    return metadatas.map((m) => ({
      name: m,
      fullPath: `${hivePath.database}/${hivePath.table}/${m}`,
      uri: `${this.prefix}${hivePath.database}/${hivePath.table}/${m}`,
      size: 0,
      extension: "md",
      type: "text/markdown",
      modificationTime: 0,
      meta: {},
    }));
  }

  async cat(path) {
    const hivePath = this.getHivePath(path);

    if (!hivePath.database || !hivePath.table || !hivePath.tableMetadata) {
      throw new Error(
        "please specify the the database,table and metadata you want in path",
      );
    }

    let content;
    let name;

    switch (hivePath.tableMetadata) {
      case "select.md":
        content = markdownTable(
          await this.client.getTableRecords(hivePath.database, hivePath.table),
        );
        name = "select.md";
        break;
      case "create_table.md":
        const sql = await this.client.showCreateTable(
          hivePath.database,
          hivePath.table,
        );
        content = "```sql\n" + sql + "\n```";
        name = "create_table.md";
        break;
      case "columns.md":
        content = markdownTable(
          await this.client.getTableColumns(hivePath.database, hivePath.table),
        );
        name = "columns.md";
        break;
      default:
        throw new Error("not supported yet");
    }

    const stream = new Readable();
    stream.push(content);
    stream.push(null);

    return {
      stream,
      size: content.length,
      name,
    };
  }
}

export default FoldersHive;
