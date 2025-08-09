import thrift from 'thrift';
import hive from '../lib/gen-nodejs/TCLIService.js';
import ttypes from '../lib/gen-nodejs/TCLIService_types.js';
import thriftSaslHelper from './thriftSaslHelper.js';

function openSessionThrift(client, config, callback) {
  const protocol = ttypes.TProtocolVersion.HIVE_CLI_SERVICE_PROTOCOL_V7;
  const openSessReq = new ttypes.TOpenSessionReq();
  openSessReq.username = config.username;
  openSessReq.password = config.password;
  openSessReq.client_protocol = protocol;
  client.OpenSession(openSessReq, function (error, response) {
    callback(error, response, protocol);
  });
}

function closeSessionThrift(client, session, callback) {
  const closeSessReq = new ttypes.TCloseSessionReq();
  closeSessReq.sessionHandle = session;
  client.CloseSession(closeSessReq, function (error, response) {
    callback(error, response);
  });
}

function getSchemasThrift(client, session, callback) {
  const request = new ttypes.TGetSchemasReq();
  request.sessionHandle = session;
  client.GetSchemas(request, callback);
}

function getTablesThrift(client, session, schemaName, callback) {
  const request = new ttypes.TGetTablesReq();
  request.sessionHandle = session;
  request.schemaName = schemaName;
  client.GetTables(request, function (error, response) {
    callback(error, response);
  });
}

function getColumnsThrift(client, session, schemaName, tableName, callback) {
  const request = new ttypes.TGetColumnsReq();
  request.sessionHandle = session;
  request.schemaName = schemaName;
  request.tableName = tableName;
  client.GetColumns(request, function (error, response) {
    callback(error, response);
  });
}

function executeStatementThrift(client, session, statement, callback) {
  const request = new ttypes.TExecuteStatementReq();
  request.sessionHandle = session;
  request.statement = statement;
  request.runAsync = false;
  client.ExecuteStatement(request, function (error, response) {
    callback(error, response);
  });
}

function getResultSetMetadataThrift(client, operation, callback) {
  const request = new ttypes.TGetResultSetMetadataReq();
  request.operationHandle = operation;
  client.GetResultSetMetadata(request, function (error, response) {
    callback(error, response);
  });
}

function fetchRowsThrift(client, operation, maxRows, callback) {
  const request = new ttypes.TFetchResultsReq();
  request.operationHandle = operation;
  request.orientation = ttypes.TFetchOrientation.FETCH_NEXT;
  request.maxRows = maxRows;
  client.FetchResults(request, function (error, response) {
    callback(error, response);
  });
}

function getRowColumnsByColumnName(client, operation, columnName, callback) {
  getResultSetMetadataThrift(client, operation, function (error, responseMeta) {
    if (error) {
      callback(error, null);
    } else {
      fetchRowsThrift(client, operation, 1000, function (error, responseFetch) {
        if (error) {
          callback(error, null);
        } else {
          let result;
          const metaColumns = responseMeta.schema.columns;
          const rowColumns = responseFetch.results.columns;
          let currentMeta, currentRow;
          let type = '';
          for (let i = 0; i < metaColumns.length; i++) {
            currentMeta = metaColumns[i];
            currentRow = rowColumns[i];
            type = getReverseTColumn(currentMeta.typeDesc.types[0].primitiveEntry.type);

            if (currentMeta.columnName === columnName) {
              result = currentRow[type].values;
              break;
            }
          }
          callback(error, result);
        }
      });
    }
  });
}

function getRowsByColumnNames(client, operation, columnNamesToSelect, callback) {
  getResultSetMetadataThrift(client, operation, function (error, responseMeta) {
    if (error) {
      return callback(error, null);
    }

    fetchRowsThrift(client, operation, 50, function (error, responseFetch) {
      if (error) {
        return callback(error, null);
      }

      const metaColumns = responseMeta.schema.columns;
      const rowColumns = responseFetch.results.columns;

      const columnNames = [];
      const columnPos = [];
      const columnTypes = [];
      let currentMeta;

      for (let i = 0; i < metaColumns.length; i++) {
        currentMeta = metaColumns[i];

        if (columnNamesToSelect && columnNamesToSelect.length > 0 && columnNamesToSelect.indexOf(currentMeta.columnName) < 0) {
          continue;
        }

        columnNames.push(currentMeta.columnName);
        columnTypes.push(getReverseTColumn(currentMeta.typeDesc.types[0].primitiveEntry.type));
        columnPos.push(i);
      }

      if (columnNames.length == 0) {
        return callback('no matched columns', null);
      }

      const columnSize = columnNames.length;
      const rowSize = rowColumns[columnPos[0]][columnTypes[0]].values.length;
      const result = [];
      let row = [];

      result.push(columnNames);

      for (let i = 0; i < rowSize; i++) {
        row = [];
        for (let j = 0; j < columnSize; j++) {
          row.push(rowColumns[columnPos[j]][columnTypes[j]].values[i]);
        }
        result.push(row);
      }

      callback(error, result);
    });
  });
}

function getReverseTColumn(numericValue) {
  switch (numericValue) {
    case ttypes.TTypeId.BOOLEAN_TYPE:
      return 'boolVal';
    case ttypes.TTypeId.TINYINT_TYPE:
      return 'byteVal';
    case ttypes.TTypeId.SMALLINT_TYPE:
      return 'i16Val';
    case ttypes.TTypeId.INT_TYPE:
      return 'i32Val';
    case ttypes.TTypeId.BIGINT_TYPE:
      return 'i64Val';
    case ttypes.TTypeId.FLOAT_TYPE:
      return 'doubleVal';
    case ttypes.TTypeId.DOUBLE_TYPE:
      return 'doubleVal';
    case ttypes.TTypeId.STRING_TYPE:
      return 'stringVal';
    case ttypes.TTypeId.TIMESTAMP_TYPE:
      return 'i64Val';
    case ttypes.TTypeId.BINARY_TYPE:
      return 'stringVal';
    case ttypes.TTypeId.ARRAY_TYPE:
      return 'stringVal';
    case ttypes.TTypeId.MAP_TYPE:
      return 'stringVal';
    case ttypes.TTypeId.STRUCT_TYPE:
      return 'stringVal';
    case ttypes.TTypeId.UNION_TYPE:
      return 'stringVal';
    case ttypes.TTypeId.USER_DEFINED_TYPE:
      return 'stringVal';
    case ttypes.TTypeId.DECIMAL_TYPE:
      return 'stringVal';
    case ttypes.TTypeId.NULL_TYPE:
      return 'stringVal';
    case ttypes.TTypeId.DATE_TYPE:
      return 'stringVal';
    case ttypes.TTypeId.VARCHAR_TYPE:
      return 'stringVal';
    case ttypes.TTypeId.CHAR_TYPE:
      return 'stringVal';
    case ttypes.TTypeId.INTERVAL_YEAR_MONTH_TYPE:
      return 'stringVal';
    case ttypes.TTypeId.INTERVAL_DAY_TIME_TYPE:
      return 'stringVal';
    default:
      return null;
  }
}
class HiveThriftClient {
  constructor(options, callback) {
    this.connect(options, callback);
  }

  connect(options, callback) {
    if (options.auth.toLowerCase() === 'none') {
      options.transport = thrift.TFramedTransport;
    } else if (options.auth.toLowerCase() === 'nosasl') {
      options.transport = thrift.TBufferedTransport;
    } else {
      callback('auth mode not supported');
    }

    this.connection = thrift.createConnection(options.host, options.port, options);
    this.client = thrift.createClient(hive, this.connection);

    this.connection.on('error', (error) => {
      console.error('connect error : ' + error);
      if (callback) return callback(error, null);
    });

    this.connection.on('connect', () => {
      const openSessionCb = () => {
        openSessionThrift(this.client, options, (error, response, protocol) => {
          if (error) {
            console.error('OpenSession error = ' + JSON.stringify(error));
            this.session = null;
          } else {
            console.info('Session opened for user ' + options.username + ' with protocol value = ' + protocol);
            this.session = response.sessionHandle;
          }
          if (callback) callback(error, response.sessionHandle);
        });
      };

      if (options.auth.toLowerCase() === 'none') {
        thriftSaslHelper.saslPlainHandleShake(this.connection.connection, options, (error) => {
          if (error) {
            console.error('sasl plain auth failed');
            return callback(error, null);
          }
          openSessionCb();
        });
      } else {
        openSessionCb();
      }
    });
  }

  disconnect(callback) {
    const session = this.session;
    const connection = this.connection;
    const client = this.client;

    closeSessionThrift(client, session, (status) => {
      if (status) {
        console.error('disconnect error = ' + JSON.stringify(status));
      } else {
        console.info('session closed');
      }

      connection.on('end', (error) => {
        logger.info('disconnect success');
      });

      connection.end();
      if (callback) callback(status);
    });

    this.client = null;
    this.connection = null;
    this.session = null;
  }

  getSchemasNames(cb) {
    const session = this.session;
    const client = this.client;

    getSchemasThrift(client, session, (error, response) => {
      if (error) {
        console.error('show shemas error', error);
        return cb(error, null);
      }

      getRowColumnsByColumnName(client, response.operationHandle, 'TABLE_SCHEM', (error, response) => {
        cb(error, response);
      });
    });
  }

  getTablesNames(schemaName, callback) {
    const session = this.session;
    const client = this.client;

    getTablesThrift(client, session, schemaName, (error, response) => {
      if (error) {
        console.error('getTablesNames error = ' + JSON.stringify(error));
        callback(error, response);
      } else {
        getRowColumnsByColumnName(client, response.operationHandle, 'TABLE_NAME', (error, response) => {
          callback(error, response);
        });
      }
    });
  }

  getTableColumns(schemaName, tableName, callback) {
    const session = this.session;
    const client = this.client;

    getColumnsThrift(client, session, schemaName, tableName, (error, response) => {
      if (error) {
        callback(error, response);
      } else {
        const tableColumnsToSelect = ['TABLE_SCHEM', 'TABLE_NAME', 'COLUMN_NAME', 'TYPE_NAME', 'IS_NULLABLE'];
        getRowsByColumnNames(client, response.operationHandle, tableColumnsToSelect, (error, response) => {
          callback(error, response);
        });
      }
    });
  }

  getTableRecords(schemaName, tableName, callback) {
    const sql = 'SELECT * FROM ' + schemaName + '.' + tableName + ' LIMIT 10';
    this.executeSelect(sql, callback);
  }

  showCreateTable(schemaName, tableName, callback) {
    const session = this.session;
    const client = this.client;
    const sql = 'SHOW CREATE TABLE ' + schemaName + '.' + tableName;

    this.rawExecuteStatement(sql, (error, response) => {
      if (error) {
        console.error('executeSelect error = ' + JSON.stringify(error));
        callback(error, response);
      } else {
        getRowColumnsByColumnName(client, response.operationHandle, 'createtab_stmt', (error, response) => {
          if (error) return callback(error, null);
          callback(error, response.join('\n'));
        });
      }
    });
  }

  executeSelect(selectStatement, callback) {
    const client = this.client;
    this.rawExecuteStatement(selectStatement, (error, response) => {
      if (error) {
        console.error('executeSelect error = ' + JSON.stringify(error));
        callback(error, response);
      } else {
        getRowsByColumnNames(client, response.operationHandle, null, (error, response) => {
          callback(error, response);
        });
      }
    });
  }

  rawExecuteStatement(statement, callback) {
    const session = this.session;
    const client = this.client;

    executeStatementThrift(client, session, statement, (error, response) => {
      if (error) {
        console.error('executeStatement error = ' + JSON.stringify(error));
        callback(error, null);
      } else if (response.status.statusCode == 3) {
        console.error('executeStatement error = ' + JSON.stringify(response.status));
        callback(response.status, null);
      } else {
        callback(null, response);
      }
    });
  }
}

export default HiveThriftClient;
