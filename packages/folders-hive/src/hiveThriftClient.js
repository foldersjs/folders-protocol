import thrift from "thrift";
import hive from "../lib/gen-nodejs/TCLIService.cjs";
import ttypes from "../lib/gen-nodejs/TCLIService_types.cjs";
import thriftSaslHelper from "./thriftSaslHelper.js";
import { promisify } from "util";

const getReverseTColumn = (numericValue) => {
  switch (numericValue) {
    case ttypes.TTypeId.BOOLEAN_TYPE:
      return "boolVal";
    case ttypes.TTypeId.TINYINT_TYPE:
      return "byteVal";
    case ttypes.TTypeId.SMALLINT_TYPE:
      return "i16Val";
    case ttypes.TTypeId.INT_TYPE:
      return "i32Val";
    case ttypes.TTypeId.BIGINT_TYPE:
      return "i64Val";
    case ttypes.TTypeId.FLOAT_TYPE:
    case ttypes.TTypeId.DOUBLE_TYPE:
      return "doubleVal";
    case ttypes.TTypeId.STRING_TYPE:
    case ttypes.TTypeId.BINARY_TYPE:
    case ttypes.TTypeId.ARRAY_TYPE:
    case ttypes.TTypeId.MAP_TYPE:
    case ttypes.TTypeId.STRUCT_TYPE:
    case ttypes.TTypeId.UNION_TYPE:
    case ttypes.TTypeId.USER_DEFINED_TYPE:
    case ttypes.TTypeId.DECIMAL_TYPE:
    case ttypes.TTypeId.NULL_TYPE:
    case ttypes.TTypeId.DATE_TYPE:
    case ttypes.TTypeId.VARCHAR_TYPE:
    case ttypes.TTypeId.CHAR_TYPE:
    case ttypes.TTypeId.INTERVAL_YEAR_MONTH_TYPE:
    case ttypes.TTypeId.INTERVAL_DAY_TIME_TYPE:
      return "stringVal";
    default:
      return null;
  }
};

const saslPlainHandleShake = promisify(thriftSaslHelper.saslPlainHandleShake);

class HiveThriftClient {
  constructor(options) {
    this.options = options;
    this.client = null;
    this.connection = null;
    this.session = null;
  }

  async connect() {
    const options = this.options;
    if (options.auth.toLowerCase() === "none") {
      options.transport = thrift.TFramedTransport;
    } else if (options.auth.toLowerCase() === "nosasl") {
      options.transport = thrift.TBufferedTransport;
    } else {
      throw new Error("auth mode not supported");
    }

    this.connection = thrift.createConnection(
      options.host,
      options.port,
      options,
    );
    this.client = thrift.createClient(hive, this.connection);

    const clientMethodsToPromisify = [
      "OpenSession",
      "CloseSession",
      "GetSchemas",
      "GetTables",
      "GetColumns",
      "ExecuteStatement",
      "GetResultSetMetadata",
      "FetchResults",
    ];

    for (const method of clientMethodsToPromisify) {
      this.client[method] = promisify(this.client[method]).bind(this.client);
    }

    const connectPromise = new Promise((resolve, reject) => {
      this.connection.once("error", reject);
      this.connection.once("connect", resolve);
    });

    try {
      await connectPromise;

      if (this.options.auth.toLowerCase() === "none") {
        await saslPlainHandleShake(this.connection.connection, this.options);
      }

      const protocol = ttypes.TProtocolVersion.HIVE_CLI_SERVICE_PROTOCOL_V7;
      const openSessReq = new ttypes.TOpenSessionReq({
        username: this.options.username,
        password: this.options.password,
        client_protocol: protocol,
      });
      const response = await this.client.OpenSession(openSessReq);
      this.session = response.sessionHandle;
      return this.session;
    } catch (error) {
      this.session = null;
      if (this.connection) {
        this.connection.end();
      }
      throw error;
    }
  }

  async disconnect() {
    if (this.session) {
      const closeSessReq = new ttypes.TCloseSessionReq({
        sessionHandle: this.session,
      });
      await this.client.CloseSession(closeSessReq);
    }
    if (this.connection) {
      this.connection.end();
    }
    this.client = null;
    this.connection = null;
    this.session = null;
  }

  async getRowColumnsByColumnName(operation, columnName) {
    const responseMeta = await this.client.GetResultSetMetadata(
      new ttypes.TGetResultSetMetadataReq({ operationHandle: operation }),
    );
    const responseFetch = await this.client.FetchResults(
      new ttypes.TFetchResultsReq({
        operationHandle: operation,
        orientation: ttypes.TFetchOrientation.FETCH_NEXT,
        maxRows: 1000,
      }),
    );

    const metaColumns = responseMeta.schema.columns;
    const rowColumns = responseFetch.results.columns;

    for (let i = 0; i < metaColumns.length; i++) {
      const currentMeta = metaColumns[i];
      if (currentMeta.columnName === columnName) {
        const type = getReverseTColumn(
          currentMeta.typeDesc.types[0].primitiveEntry.type,
        );
        return rowColumns[i][type].values;
      }
    }
    return [];
  }

  async getRowsByColumnNames(operation, columnNamesToSelect) {
    const responseMeta = await this.client.GetResultSetMetadata(
      new ttypes.TGetResultSetMetadataReq({ operationHandle: operation }),
    );
    const responseFetch = await this.client.FetchResults(
      new ttypes.TFetchResultsReq({
        operationHandle: operation,
        orientation: ttypes.TFetchOrientation.FETCH_NEXT,
        maxRows: 50,
      }),
    );

    const metaColumns = responseMeta.schema.columns;
    const rowColumns = responseFetch.results.columns;

    const columnNames = [];
    const columnPos = [];
    const columnTypes = [];

    for (let i = 0; i < metaColumns.length; i++) {
      const currentMeta = metaColumns[i];
      if (
        columnNamesToSelect &&
        columnNamesToSelect.length > 0 &&
        columnNamesToSelect.indexOf(currentMeta.columnName) < 0
      ) {
        continue;
      }
      columnNames.push(currentMeta.columnName);
      columnTypes.push(
        getReverseTColumn(currentMeta.typeDesc.types[0].primitiveEntry.type),
      );
      columnPos.push(i);
    }

    if (columnNames.length === 0) {
      throw new Error("no matched columns");
    }

    const columnSize = columnNames.length;
    const rowSize = rowColumns[columnPos[0]][columnTypes[0]].values.length;
    const result = [columnNames];

    for (let i = 0; i < rowSize; i++) {
      const row = [];
      for (let j = 0; j < columnSize; j++) {
        row.push(rowColumns[columnPos[j]][columnTypes[j]].values[i]);
      }
      result.push(row);
    }
    return result;
  }

  async getSchemasNames() {
    const request = new ttypes.TGetSchemasReq({ sessionHandle: this.session });
    const response = await this.client.GetSchemas(request);
    return this.getRowColumnsByColumnName(
      response.operationHandle,
      "TABLE_SCHEM",
    );
  }

  async getTablesNames(schemaName) {
    const request = new ttypes.TGetTablesReq({
      sessionHandle: this.session,
      schemaName,
    });
    const response = await this.client.GetTables(request);
    return this.getRowColumnsByColumnName(
      response.operationHandle,
      "TABLE_NAME",
    );
  }

  async getTableColumns(schemaName, tableName) {
    const request = new ttypes.TGetColumnsReq({
      sessionHandle: this.session,
      schemaName,
      tableName,
    });
    const response = await this.client.GetColumns(request);
    const tableColumnsToSelect = [
      "TABLE_SCHEM",
      "TABLE_NAME",
      "COLUMN_NAME",
      "TYPE_NAME",
      "IS_NULLABLE",
    ];
    return this.getRowsByColumnNames(
      response.operationHandle,
      tableColumnsToSelect,
    );
  }

  async getTableRecords(schemaName, tableName) {
    const sql = `SELECT * FROM ${schemaName}.${tableName} LIMIT 10`;
    return this.executeSelect(sql);
  }

  async showCreateTable(schemaName, tableName) {
    const sql = `SHOW CREATE TABLE ${schemaName}.${tableName}`;
    const response = await this.rawExecuteStatement(sql);
    const result = await this.getRowColumnsByColumnName(
      response.operationHandle,
      "createtab_stmt",
    );
    return result.join("\n");
  }

  async executeSelect(selectStatement) {
    const response = await this.rawExecuteStatement(selectStatement);
    return this.getRowsByColumnNames(response.operationHandle, null);
  }

  async rawExecuteStatement(statement) {
    const request = new ttypes.TExecuteStatementReq({
      sessionHandle: this.session,
      statement,
      runAsync: false,
    });
    const response = await this.client.ExecuteStatement(request);
    if (response.status.statusCode === 3) {
      throw new Error(JSON.stringify(response.status));
    }
    return response;
  }
}

export default HiveThriftClient;
