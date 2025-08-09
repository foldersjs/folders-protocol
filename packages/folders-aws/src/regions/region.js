import path from 'path';
import S3 from './services/S3.js';
import EC2 from './services/EC2.js';
import assert from 'assert';

let AWS;

const serviceToRegionMapper = {
  S3: ['us-west-2', 'us-west-1', 'eu-west-1', 'eu-central-1', 'ap-southeast-1', 'ap-southeast-2', 'ap-northeast-1', 'sa-east-1'],
  EC2: ['us-west-2', 'us-west-1', 'eu-west-1', 'eu-central-1', 'ap-southeast-1', 'ap-southeast-2', 'ap-northeast-1', 'sa-east-1'],
};

const getRegion = function (self, path) {
  let region;
  const parts = path.split('/');
  region = parts[0];
  path = parts.slice(1, parts.length).join('/');
  return [region.toLowerCase(), path];
};

const getServiceObject = async function (service, region, options) {
  const t = new AWS[service]({
    region: region,
  });
  // Dynamic import based on service name
  const s = await import(`./services/${service}.js`);
  return new s.default(AWS, t, options);
};

const regionAsFolders = function (region, dir) {
  const data = [];
  for (let i = 0; i < region.length; ++i) {
    const o = {};
    o.name = region[i];
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

class Region {
  constructor(aws, options) {
    assert.equal(typeof options, 'object', "argument 'options' must be a o9bject");
    AWS = aws;
    this.configure(options);
  }

  static dataVolume() {
    return S3.dataVolume();
  }

  configure(options) {
    assert.equal(typeof options, 'object', "argument 'options' must be a o9bject");

    if (typeof options.region == 'string') {
      this.singleRegion = true;
      this.region = options.region.toLowerCase();
    } else if (options.region instanceof Array) {
      this.multipleRegion = true;
      this.region = options.region.map(function (x) {
        return x.toLowerCase();
      });
    } else if (!options.region) {
      this.allRegion = true;
    }

    this.bucket = options.bucket;
    this.partSize = options.partSize;
    this.queueSize = options.queueSize;
  }

  updateRegion(region) {
    assert.ok(typeof region == 'string' || !region, "argument 'region' must be a string");
    AWS.config.update({
      region: region || 'us-west-2',
    });
  }

  static features = {
    cat: true,
    ls: true,
    write: true,
    server: false,
  };

  async ls(service, path, cb) {
    assert.equal(typeof service, 'string', "argument 'options' must be a string");
    assert.equal(typeof path, 'string', "argument 'path' must be a string");
    assert.equal(typeof cb, 'function', "argument 'cb' must be a function");

    path = path == '' ? null : path;
    let region, pathPrefix, arr;

    if (path == null) {
      region = this.region;
      pathPrefix = path;
    } else {
      arr = getRegion(this, path);
      region = arr[0];
      pathPrefix = arr[1];
    }

    if (this.allRegion) {
      if (path == null) {
        return cb(null, regionAsFolders(serviceToRegionMapper[service], '/' + service + '/'));
      }
    }

    if (this.multipleRegion) {
      if (path == null) {
        return cb(null, regionAsFolders(region, '/' + service + '/'));
      }
    }

    if (this.singleRegion) {
      if (path == null) {
        return cb(null, regionAsFolders([region], '/' + service + '/'));
      }
    }

    this.serviceObj = await getServiceObject(service, region, {
      bucket: this.bucket,
    });
    return this.serviceObj.ls(service, region, pathPrefix, cb);
  }

  async write(service, path, data, cb) {
    assert.equal(typeof service, 'string', "argument 'options' must be a string");
    assert.equal(typeof path, 'string', "argument 'path' must be a string");
    assert.equal(typeof cb, 'function', "argument 'cb' must be a function");

    let region, pathPrefix, arr;
    arr = getRegion(this, path);
    region = arr[0];
    pathPrefix = arr[1];

    this.serviceObj = await getServiceObject(service, region, {
      bucket: this.bucket,
      partSize: this.partSize,
      queueSize: this.queueSize,
    });
    return this.serviceObj.write(pathPrefix, data, cb);
  }

  async cat(service, path, cb) {
    assert.equal(typeof service, 'string', "argument 'options' must be a string");
    assert.equal(typeof path, 'string', "argument 'path' must be a string");
    assert.equal(typeof cb, 'function', "argument 'cb' must be a function");

    let region, pathPrefix, arr;
    arr = getRegion(this, path);
    region = arr[0];
    pathPrefix = arr[1];

    this.serviceObj = await getServiceObject(service, region, {
      bucket: this.bucket,
    });
    return this.serviceObj.cat(pathPrefix, cb);
  }

  async unlink(service, path, cb) {
    assert.equal(typeof service, 'string', "argument 'options' must be a string");
    assert.equal(typeof path, 'string', "argument 'path' must be a string");
    assert.equal(typeof cb, 'function', "argument 'cb' must be a function");

    let region, pathPrefix, arr;
    arr = getRegion(this, path);
    region = arr[0];
    pathPrefix = arr[1];

    this.serviceObj = await getServiceObject(service, region, {
      bucket: this.bucket,
    });
    return this.serviceObj.unlink(pathPrefix, cb);
  }

  async rmdir(service, path, cb) {
    assert.equal(typeof service, 'string', "argument 'options' must be a string");
    assert.equal(typeof path, 'string', "argument 'path' must be a string");
    assert.equal(typeof cb, 'function', "argument 'cb' must be a function");

    let region, pathPrefix, arr;
    arr = getRegion(this, path);
    region = arr[0];
    pathPrefix = arr[1];

    this.serviceObj = await getServiceObject(service, region, {
      bucket: this.bucket,
    });
    return this.serviceObj.rmdir(pathPrefix, cb);
  }

  async mkdir(service, path, cb) {
    assert.equal(typeof service, 'string', "argument 'options' must be a string");
    assert.equal(typeof path, 'string', "argument 'path' must be a string");
    assert.equal(typeof cb, 'function', "argument 'cb' must be a function");

    let region, pathPrefix, arr;
    arr = getRegion(this, path);
    region = arr[0];
    pathPrefix = arr[1];

    this.serviceObj = await getServiceObject(service, region, {
      bucket: this.bucket,
    });
    return this.serviceObj.mkdir(pathPrefix, cb);
  }
}

export default Region;
