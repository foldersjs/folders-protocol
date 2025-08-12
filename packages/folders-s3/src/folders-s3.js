import uriParse from 'url';
import path from 'path';
import stream from 'stream';
import AWS from 'aws-sdk';
import { z } from 'zod';
import mime from 'mime-types';
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
    this.prefix = prefix;
    this.client = null;
    this.options = parsedOptions;

    if (this.options.enableEmbeddedServer) {
      this.options.connectionString = this.options.connectionString || 'http://localhost:4568/';
      this.options.directory = this.options.directory || './bucket';
      const conn = parseConnString(this.options.connectionString);
      conn.silent = this.options.silent;
      conn.directory = this.options.directory;
      this.server = new Server(conn);
      this.server.start(this.options.backend);
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
    return this.cat(filePath);
  }

  async upload(filePath, data) {
    return this.write(filePath, data);
  }

  async ls(path) {
    const uri = uriParse.parse(this.options.connectionString);
    const bucket = uri.hostname;
    const data = await this.listObjects(bucket, path);
    return this.asFolders(path, data);
  }

  asFolders(dir, files) {
    return files.map((file) => {
      const fileName = file.Key.substring(dir.length);
      if (!fileName || fileName === '/') {
        return null;
      }
      const isFolder = fileName.endsWith('/');
      const name = isFolder
        ? fileName.slice(0, -1).split('/').pop()
        : fileName.split('/').pop();

      const extension = isFolder ? '+folder' : path.extname(fileName).slice(1);
      const type = isFolder ? '' : mime.lookup(fileName) || 'application/octet-stream';

      return {
        name: name,
        fullPath: file.Key,
        meta: {},
        uri: file.Key,
        size: file.Size || 0,
        extension,
        type,
      };
    }).filter(Boolean);
  }

  async cat(filePath) {
    this.prepare();
    const uri = uriParse.parse(this.options.connectionString);
    const bucket = uri.hostname;
    const params = {
      Bucket: bucket,
      Key: filePath,
    };
    const { Body, ContentLength } = await this.client.getObject(params).promise();
    const readable = new stream.Readable();
    readable.push(Body);
    readable.push(null);
    return {
      stream: readable,
      size: ContentLength,
      name: path.basename(filePath),
    };
  }

  async write(uri, data) {
    this.prepare();
    const UrifilePath = uriParse.parse(this.options.connectionString);
    const bucket = UrifilePath.hostname;
    const params = {
      Key: uri,
      Bucket: bucket,
      Body: data,
    };

    await this.client.upload(params).promise();
    return 'write uri success';
  }
}

export default FoldersS3;
