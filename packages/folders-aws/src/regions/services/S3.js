import path from 'path';
import mime from 'mime';
import assert from 'assert';

let s3, AWS;

const getBucketKey = function (self, path) {
  let bucket;
  const parts = path.split('/');
  bucket = parts[0];
  path = parts.slice(1, parts.length).join('/');
  return [bucket, path];
};

const lsBucket = function (bucket, pathPrefix, cb) {
  let result;

  s3.listObjects(
    {
      Bucket: bucket,
      Prefix: pathPrefix,
    },
    function (err, data) {
      if (err) {
        console.log('error occured in folders-aws lsBucket() ', err);
        return cb(err, null);
      } else {
        result = data.Contents;
        return cb(null, result);
      }
    },
  );
};

const listAllBuckets = function (cb) {
  s3.listBuckets(function (err, data) {
    if (err) {
      console.log(err, err.stack);
      cb(err, null);
    } else {
      const bucket = data.Buckets.map(function (item) {
        return item.Name;
      });
      cb(null, bucket);
    }
  });
};

const bucketAsFolders = function (bucket, dir) {
  const data = [];
  for (let i = 0; i < bucket.length; ++i) {
    const o = {};
    o.name = bucket[i];
    o.extension = '+folder';
    o.size = 0;
    o.type = '';
    o.fullPath = dir + o.name;
    o.uri = o.fullPath;
    if (!o.meta)
      o.meta = {
        group: 'aws',
        owner: 'aws',
        permission: 0,
      };
    o.modificationTime = Date.now();
    const cols = ['permission', 'owner', 'group'];
    data.push(o);
  }
  return data;
};

const listBucket = function (self, bucket, pathPrefix, dir, cb) {
  lsBucket(bucket, pathPrefix, function (err, data) {
    if (err) {
      console.log('error occured in services listBucket() ', err);
      return cb(err, null);
    }

    data = self.asFolders(pathPrefix, data, dir);
    return cb(null, data);
  });
};

const cat = function (bucket, key, cb) {
  const params = {
    Bucket: bucket,
    Key: key,
  };

  s3.headObject(params, function (err, data) {
    if (err) {
      console.log(err, err.stack);
      return cb(err);
    } else {
      const f = s3.getObject(params);
      const file = f.createReadStream();
      cb(null, {
        stream: file,
        size: data.ContentLength,
        name: path.basename(key),
      });
    }
  });
};

const write = function (bucket, key, stream, options, cb) {
  const params = {
      Bucket: bucket,
      Key: key,
      Body: stream,
    },
    loaded = 0;

  s3.upload(params, options)
    .on('httpUploadProgress', function (evt) {
      S3.RXOK = S3.TXOK += evt.loaded - loaded;
      loaded = evt.loaded;
      console.log(evt);
    })
    .on('httpError', function (evt) {
      console.log(evt);
    })
    .on('complete', function (evt) {
      console.log(evt);
    })
    .send(function (error, response) {
      if (error) {
        console.error(error);
        return cb(error, null);
      }
      return cb(null, 'created success');
    });
};

const unlink = function (bucket, path, cb) {
  const params = {
    Bucket: bucket,
    Key: path,
  };

  s3.deleteObject(params, function (err, data) {
    if (err) {
      console.log(err, err.stack);
      cb(err);
    } else {
      cb(null, data);
    }
  });
};

const rmfolder = function (bucket, path, cb) {
  lsBucket(bucket, path, function (err, data) {
    const objects = data.map(function (o) {
      return {
        Key: o.Key,
      };
    });

    if (objects.length > 0) {
      const params = {
        Bucket: bucket,
        Delete: {
          Objects: objects,
        },
      };

      s3.deleteObjects(params, function (err, data) {
        if (err) {
          console.log(err, err.stack);
          cb(err);
        }
        unlink(bucket, path, cb);
      });
    } else {
      unlink(bucket, path, cb);
    }
  });
};

const rmdir = function (bucket, path, cb) {
  rmfolder(bucket, path, cb);
};

const mkdir = function (bucket, path, cb) {
  const params = {
    Bucket: bucket,
    Key: path,
  };

  s3.headObject(params, function (err, data) {
    if (err) {
      if (err.code === 'NotFound') {
        s3.putObject(params, function (err, data) {
          if (err) {
            console.log(err, err.stack);
            return cb(err);
          } else {
            return cb();
          }
        });
      } else {
        return cb(err);
      }
    } else {
      return cb(new Error('mkdir: cannot create directory  File exists'));
    }
  });
};

class S3 {
  constructor(aws, service, options) {
    AWS = aws;
    s3 = service;
    this.configure(options);
  }

  static dataVolume() {
    return {
      RXOK: S3.RXOK,
      TXOK: S3.TXOK,
    };
  }

  static TXOK = 0;
  static RXOK = 0;

  configure(options) {
    if (typeof options.bucket == 'string') {
      this.singleBucket = true;
    } else if (options.bucket instanceof Array) {
      this.multipleBucket = true;
    } else if (!options.bucket) {
      this.allBucket = true;
    }

    this.bucket = options.bucket;
    this.partSize = options.partSize;
    this.queueSize = options.queueSize;
  }

  ls(service, region, path, cb) {
    assert.equal(typeof service, 'string', "argument 'service' must be a string");
    assert.equal(typeof region, 'string', "argument 'region' must be a string");
    assert.equal(typeof path, 'string', "argument 'path' must be a string");
    assert.equal(typeof cb, 'function', "argument 'cb' must be a function");

    AWS.config.update({
      region: region || 'us-west-2',
    });

    path = path == '' ? null : path;
    let bucket, pathPrefix, arr, result;
    if (path == null) {
      bucket = this.bucket;
      pathPrefix = path;
    } else {
      arr = getBucketKey(this, path);
      bucket = arr[0];
      pathPrefix = arr[1];
    }

    if (this.allBucket) {
      if (path == null) {
        listAllBuckets(function (err, data) {
          if (err) {
            return cb(err);
          }
          return cb(null, bucketAsFolders(data, '/' + service + '/' + region + '/'));
        });
      } else {
        listBucket(this, bucket, pathPrefix, '/' + service + '/' + region + '/' + bucket + '/', cb);
      }
    }

    if (this.multipleBucket) {
      if (path == null) {
        return cb(null, bucketAsFolders(bucket, '/' + service + '/' + region + '/'));
      } else {
        listBucket(this, bucket, pathPrefix, '/' + service + '/' + region + '/' + bucket + '/', cb);
      }
    }

    if (this.singleBucket) {
      if (path == null) {
        return cb(null, bucketAsFolders([bucket], '/' + service + '/' + region + '/'));
      } else {
        listBucket(this, bucket, pathPrefix, '/' + service + '/' + region + '/' + bucket + '/', cb);
      }
    }
  }

  asFolders(pathPrefix, data, dir) {
    if (pathPrefix && pathPrefix.length > 0) {
      if (pathPrefix[pathPrefix.length - 1] != '/') pathPrefix += '/';
    }

    const z = [];
    for (let i = 0; i < data.length; ++i) {
      if (data[i].Key != pathPrefix) {
        const name = data[i].Key.replace(pathPrefix, '');
        const res = name.split('/');

        if (!res[1]) {
          const o = {};
          o.name = name.charAt(name.length - 1) == '/' ? name.substr(0, name.length - 1) : name;
          o.extension = path.extname(name).substr(1, path.extname(name).length - 1) || '+folder';
          o.size = data[i].Size || 0;
          o.type = o.extension == '+folder' ? '' : mime.lookup(o.extension);
          if (o.extension == '+folder') {
            o.fullPath = dir + data[i].Key.substr(0, data[i].Key.length - 1);
          } else {
            o.fullPath = dir + data[i].Key;
          }

          o.uri = o.fullPath;
          if (!o.meta)
            o.meta = {
              group: 'aws',
              owner: 'aws',
              permission: 0,
            };
          o.modificationTime = Date.parse(data[i].LastModified);
          const cols = ['permission', 'owner', 'group'];

          z.push(o);
        }
      }
    }
    return z;
  }

  cat(path, cb) {
    assert.equal(typeof path, 'string', "argument 'path' must be a string");
    assert.equal(typeof cb, 'function', "argument 'cb' must be a function");

    let bucket, pathPrefix, arr;
    arr = getBucketKey(this, path);
    bucket = arr[0];
    pathPrefix = arr[1];
    cat(bucket, pathPrefix, cb);
  }

  write(path, data, cb) {
    assert.equal(typeof path, 'string', "argument 'path' must be a string");
    assert.equal(typeof cb, 'function', "argument 'cb' must be a function");

    let bucket, key, arr, options;
    arr = getBucketKey(this, path);
    bucket = arr[0];
    key = arr[1];

    options = {
      partSize: this.partSize,
      queueSize: this.queueSize,
    };
    write(bucket, key, data, options, cb);
  }

  unlink(path, cb) {
    assert.equal(typeof path, 'string', "argument 'path' must be a string");
    assert.equal(typeof cb, 'function', "argument 'cb' must be a function");
    let bucket, pathPrefix, arr;

    arr = getBucketKey(this, path);
    bucket = arr[0];
    pathPrefix = arr[1];
    unlink(bucket, pathPrefix, cb);
  }

  rmdir(path, cb) {
    assert.equal(typeof path, 'string', "argument 'path' must be a string");
    assert.equal(typeof cb, 'function', "argument 'cb' must be a function");
    let bucket, pathPrefix, arr;

    arr = getBucketKey(this, path);
    bucket = arr[0];
    pathPrefix = arr[1];

    rmdir(bucket, pathPrefix, cb);
  }

  mkdir(path, cb) {
    assert.equal(typeof path, 'string', "argument 'path' must be a string");
    assert.equal(typeof cb, 'function', "argument 'cb' must be a function");
    let bucket, pathPrefix, arr;

    arr = getBucketKey(this, path);
    bucket = arr[0];
    pathPrefix = arr[1];
    return mkdir(bucket, pathPrefix, cb);
  }
}

export default S3;
