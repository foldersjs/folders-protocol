import uriParse from 'url';
import path from 'path';
import AWS from 'aws-sdk';
import { z } from 'zod';
import Server from './embedded-s3-server.js';

const FoldersS3Options = z.object({
  connectionString: z.string().optional(),
  silent: z.boolean().optional(),
  directory: z.string().optional(),
  fs: z.any().optional(),
  enableEmbeddedServer: z.boolean().optional(),
  backend: z.any().optional(),
});

const parseConnString = function (connectionString) {
  const uri = uriParse.parse(connectionString, true);
  const conn = {
    hostname: uri.hostname || uri.host,
    port: uri.port || 21,
  };
  if (uri.auth) {
    const auth = uri.auth.split(':', 2);
    conn.user = auth[0];
    if (auth.length == 2) {
      conn.pass = auth[1];
    }
  }

  return conn;
};

class FoldersS3 {
  constructor(prefix, options) {
    const parsedOptions = FoldersS3Options.parse(options || {});
    parsedOptions.connectionString = parsedOptions.connectionString || 'http://localhost:4568/';
    parsedOptions.directory = parsedOptions.directory || './bucket';
    this.prefix = prefix;
    this.client = null;

    const enableEmbeddedServer = parsedOptions.enableEmbeddedServer || true;
    if (enableEmbeddedServer) {
      const conn = parseConnString(parsedOptions.connectionString);
      conn.silent = parsedOptions.silent;
      conn.directory = parsedOptions.directory;
      this.server = new Server(conn);
      this.server.start(parsedOptions.backend);
    }
  }

  async close() {
    if (this.server) {
      return new Promise((resolve) => this.server.close(resolve));
    }
  }

  static features = {
    cat: true,
    ls: true,
    write: true,
    server: true,
  };

  prepare() {
    if (this.client) {
      return;
    }
    const config = {
      s3ForcePathStyle: true,
      accessKeyId: 'ACCESS_KEY_ID',
      secretAccessKey: 'SECRET_ACCESS_KEY',
      endpoint: new AWS.Endpoint('http://localhost:4568'),
    };
    this.client = new AWS.S3(config);
  }

  async listObjects(bucket, pathPrefix) {
    this.prepare();

    const data = await this.client
      .listObjects({
        Bucket: bucket,
        Prefix: pathPrefix,
      })
      .promise();
    return data.Contents;
  }

  async download(filePath) {
    this.prepare();
    const params = {
      Bucket: 'bucket',
      Key: 'Key',
    };
    const f = this.client.getObject(params);
    const file = f.createReadStream();

    return {
      stream: file,
      //size: data.ContentLength,
      //name: path.basename(key)
    };
  }

  async upload(filePath, data) {
    this.prepare();

    const params = {
      Key: 'Key',
      Bucket: 'bucket',
      Body: data,
    };

    return this.client.upload(params).promise();
  }
}

export default FoldersS3;
