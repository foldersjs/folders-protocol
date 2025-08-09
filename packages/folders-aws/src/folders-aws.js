import AWS from 'aws-sdk';
import Region from './regions/region.js';
import path from 'path';
import assert from 'assert';
import { z } from 'zod';

const FoldersAwsOptions = z.object({
  accessKeyId: z.string().optional(),
  secretAccessKey: z.string().optional(),
  service: z.union([z.string(), z.array(z.string())]).optional(),
  region: z.string().optional(),
  bucket: z.union([z.string(), z.array(z.string())]).optional(),
  partSize: z.number().optional(),
  queueSize: z.number().optional(),
  endpoint: z.string().optional(),
  s3ForcePathStyle: z.boolean().optional(),
  checkConfig: z.boolean().optional(),
});

const ALL_SERVICES = ['S3', 'EC2'];

const getService = function (self, path) {
  let service;
  const parts = path.split('/');
  service = parts[0].toUpperCase();
  path = parts.slice(1, parts.length).join('/');

  return [service, path];
};

const getRegionObject = function (options) {
  return new Region(AWS, options);
};

const serviceAsFolders = function (serv) {
  assert.ok(serv instanceof Array, "argument 'serv' must be a array");

  const data = [];
  for (let i = 0; i < serv.length; ++i) {
    const o = {};
    o.name = serv[i];
    o.extension = '+folder';
    o.size = 0;
    o.type = '';
    o.fullPath = '/' + o.name;
    o.uri = o.fullPath;
    o.modificationTime = Date.now();
    if (!o.meta)
      o.meta = {
        group: 'aws',
        owner: 'aws',
        permission: 0,
      };
    const cols = ['permission', 'owner', 'group'];
    data.push(o);
  }
  return data;
};

class FoldersAws {
  constructor(prefix, options) {
    const parsedOptions = FoldersAwsOptions.parse(options);
    this.options = parsedOptions;
    this.configure(this.options);
    this.prefix = prefix || '/http_window.io_0:aws/';
    console.log('inin foldersAws,', this.bucket || 'All Buckets');
  }

  static dataVolume() {
    return Region.dataVolume();
  }

  configure(options) {
    const accessKeyIdEnv = process.env.AWS_ACCESS_KEY_ID;
    const secretAccessKeyEnv = process.env.AWS_SECRET_ACCESS_KEY;

    if (accessKeyIdEnv && secretAccessKeyEnv) {
      AWS.config.update({
        accessKeyId: accessKeyIdEnv,
        secretAccessKey: secretAccessKeyEnv,
      });
    } else if (options.accessKeyId && options.secretAccessKey) {
      AWS.config.update({
        accessKeyId: options.accessKeyId,
        secretAccessKey: options.secretAccessKey,
      });
    } else {
      throw new Error('Missing Credetials in Config');
    }

    if (options.endpoint) {
      AWS.config.update({
        endpoint: options.endpoint,
      });
    }

    if (options.s3ForcePathStyle) {
      AWS.config.update({
        s3ForcePathStyle: options.s3ForcePathStyle,
      });
    }

    if (typeof options.service == 'string') {
      this.singleService = true;
      this.service = options.service.toUpperCase();
    } else if (options.service instanceof Array) {
      this.multipleService = true;
      this.service = options.service.map(function (x) {
        return x.toUpperCase();
      });
    } else if (!options.service) {
      this.allService = true;
    }

    this.region = options.region;
    this.bucket = options.bucket;
    this.partSize = options.partSize;
    this.queueSize = options.queueSize;
  }

  static features = {
    cat: true,
    ls: true,
    write: true,
    server: false,
  };

  ls(filePath, cb) {
    assert.equal(typeof filePath, 'string', "argument 'path' must be a string");
    assert.equal(typeof cb, 'function', "argument 'cb' must be a function");

    let service, pathPrefix, arr;

    filePath = filePath == '/' ? null : filePath.slice(1);

    if (filePath == null) {
      service = this.service;
      pathPrefix = filePath;
    } else {
      arr = getService(this, filePath);
      service = arr[0];
      pathPrefix = arr[1];
    }

    if (this.allService) {
      if (filePath == null) {
        return cb(null, serviceAsFolders(ALL_SERVICES));
      }
    }

    if (this.multipleService) {
      if (filePath == null) {
        return cb(null, serviceAsFolders(service));
      }
    }

    if (this.singleService) {
      if (filePath == null) {
        return cb(null, serviceAsFolders([service]));
      }
    }

    this.regionObj = getRegionObject({
      region: this.region,
      bucket: this.bucket,
    });

    return this.regionObj.ls(service, pathPrefix, cb);
  }

  write(filePath, data, cb) {
    assert.equal(typeof filePath, 'string', "argument 'path' must be a string");
    assert.equal(typeof cb, 'function', "argument 'cb' must be a function");
    assert.equal(typeof data, 'object', "argument 'path' must be a string");

    let service, pathPrefix, arr;

    if (!filePath) {
      return cb(new Error('invalid url '), null);
    }

    filePath = filePath.slice(1);

    arr = getService(this, filePath);
    service = arr[0];
    pathPrefix = arr[1];
    this.regionObj = getRegionObject({
      region: this.region,
      bucket: this.bucket,
      partSize: this.partSize,
      queueSize: this.queueSize,
    });
    return this.regionObj.write(service, pathPrefix, data, cb);
  }

  cat(filePath, cb) {
    assert.equal(typeof filePath, 'string', "argument 'path' must be a string");
    assert.equal(typeof cb, 'function', "argument 'cb' must be a function");

    let service, pathPrefix, arr;

    if (!filePath) {
      return cb(new Error('invalid url '), null);
    }

    filePath = filePath.slice(1);

    arr = getService(this, filePath);
    service = arr[0];
    pathPrefix = arr[1];
    this.regionObj = getRegionObject({
      region: this.region,
      bucket: this.bucket,
    });
    return this.regionObj.cat(service, pathPrefix, cb);
  }

  unlink(filePath, cb) {
    assert.equal(typeof filePath, 'string', "argument 'path' must be a string");
    assert.equal(typeof cb, 'function', "argument 'cb' must be a function");

    let service, pathPrefix, arr;

    if (!filePath) {
      return cb(new Error('invalid url '), null);
    }

    filePath = filePath.slice(1);

    arr = getService(this, filePath);
    service = arr[0];
    pathPrefix = arr[1];
    this.regionObj = getRegionObject({
      region: this.region,
      bucket: this.bucket,
    });
    return this.regionObj.unlink(service, pathPrefix, cb);
  }

  rmdir(filePath, cb) {
    assert.equal(typeof filePath, 'string', "argument 'path' must be a string");
    assert.equal(typeof cb, 'function', "argument 'cb' must be a function");

    let service, pathPrefix, arr;

    if (filePath && filePath.length > 0) {
      if (filePath[filePath.length - 1] != '/') filePath += '/';
    } else {
      return cb(new Error('invalid url '), null);
    }

    if (filePath.split('/').length < 6) {
      return cb(new Error('Unable to delete configured services'), null);
    }

    filePath = filePath.slice(1);

    arr = getService(this, filePath);
    service = arr[0];
    pathPrefix = arr[1];
    this.regionObj = getRegionObject({
      region: this.region,
      bucket: this.bucket,
    });
    return this.regionObj.rmdir(service, pathPrefix, cb);
  }

  mkdir(filePath, cb) {
    assert.equal(typeof filePath, 'string', "argument 'path' must be a string");
    assert.equal(typeof cb, 'function', "argument 'cb' must be a function");

    let service, pathPrefix, arr;
    if (filePath && filePath.length > 0) {
      if (filePath[filePath.length - 1] != '/') filePath += '/';
    } else {
      return cb(new Error('invalid url '), null);
    }

    if (filePath.split('/').length < 6) {
      return cb(new Error('Unable to mkdir inside configured services'), null);
    }

    filePath = filePath.slice(1);

    arr = getService(this, filePath);
    service = arr[0];
    pathPrefix = arr[1];
    this.regionObj = getRegionObject({
      region: this.region,
      bucket: this.bucket,
    });
    return this.regionObj.mkdir(service, pathPrefix, cb);
  }

  dump() {
    return this.options;
  }

  static isConfigValid(config, cb) {
    const parsedConfig = FoldersAwsOptions.parse(config);
    const { accessKeyId, secretAccessKey, service, region = 'us-east-1', checkConfig } = parsedConfig;
    let { bucket } = parsedConfig;

    if (checkConfig == false) {
      return cb(null, parsedConfig);
    }

    AWS.config.update({
      accessKeyId: accessKeyId,
      secretAccessKey: secretAccessKey,
    });

    const s3 = new AWS.S3({ region: region });

    if (!bucket) {
      bucket = ['test'];
    } else if (typeof bucket == 'string') {
      bucket = [bucket];
    }

    let isValid = true;
    let bucketsChecked = 0;

    for (let i = 0; i < bucket.length; ++i) {
      const params = {
        Bucket: bucket[i],
      };

      s3.getBucketAcl(params, (err, data) => {
        bucketsChecked++;

        if (err) {
          console.log(err);
          if (err.code == 'SignatureDoesNotMatch' || err.code == 'InvalidAccessKeyId' || params.Bucket != 'test')
            isValid = false;
        }

        if (bucketsChecked == bucket.length) {
          if (!isValid) {
            return cb(new Error('Error in configuring buckets '));
          } else {
            return cb(null, parsedConfig);
          }
        }
      });
    }
  }
}

export default FoldersAws;
