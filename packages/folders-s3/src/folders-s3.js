import uriParse from 'url';
import path from 'path';
import local from 'folders/src/folders-local.js';
import Fs from 'folders/src/fs.js';
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
    console.log('FoldersS3');
    const parsedOptions = FoldersS3Options.parse(options || {});
    parsedOptions.connectionString = parsedOptions.connectionString || 'http://localhost:4568/';
    parsedOptions.directory = parsedOptions.directory || './bucket';
    parsedOptions.fs = parsedOptions.fs || new Fs(new local());
    this.prefix = prefix;
    this.client = null;

    const enableEmbeddedServer = parsedOptions.enableEmbeddedServer || true;
    if (enableEmbeddedServer) {
      const conn = parseConnString(parsedOptions.connectionString);
      conn.silent = parsedOptions.silent;
      conn.directory = parsedOptions.directory;
      conn.fs = parsedOptions.fs;
      this.server = new Server(conn);
      this.server.start(parsedOptions.backend);
    }
  }

  static features = {
    cat: true,
    ls: true,
    write: true,
    server: true,
  };

  prepare() {
    const config = {
      s3ForcePathStyle: true,
      accessKeyId: 'ACCESS_KEY_ID',
      secretAccessKey: 'SECRET_ACCESS_KEY',
      endpoint: new AWS.Endpoint('http://localhost:4568'),
    };
    this.client = new AWS.S3(config);
  }

  listObjects(bucket, pathPrefix, cb) {
    this.prepare();

    this.client.listObjects(
      {
        Bucket: bucket,
        Prefix: pathPrefix,
      },
      (err, data) => {
        if (err) {
          console.log('error occured in folders-s3 listObjects() ', err);
          return cb(err, null);
        } else {
          const result = data.Contents;
          return cb(null, result);
        }
      },
    );
  }

  download(filePath, cb) {
    this.prepare();
    const params = {
      Bucket: 'bucket',
      Key: 'Key',
    };
    const f = this.client.getObject(params);
    const file = f.createReadStream();

    cb(null, {
      stream: file,
      //size: data.ContentLength,
      //name: path.basename(key)
    });
  }

  upload(filePath, data, cb) {
    this.prepare();

    const params = {
      Key: 'Key',
      Bucket: 'bucket',
      Body: data,
    };

    this.client.upload(params, function uploadCallback(err, data) {
      console.log(err, data);
      cb(err, data);
    });
  }
}

export default FoldersS3;
