'use strict';

var p = require('path');
// var Buffer = require('buffer');
var mime = require('mime');
var storage = {};

var getMetadata = function(data) {
  // remove the buf data and other data
  return {
    accessTime : data.accessTime,
    blockSize : data.blockSize,
    group : data.group,
    length : data.length,
    modificationTime : data.modificationTime,
    owner : data.owner,
    pathSuffix : data.pathSuffix,
    permission : data.permission,
    replication : data.replication,
    type : data.type
  };
}

// write a memory based hdfs proxy, data stored in Buffer.
module.exports = function memoryStorageHandler(err, path, operation, params, req, res, next) {
  // Forward error
  if (err) {
    return next(err);
  }

  switch (operation) {
  case 'mkdirs':
    if (storage.hasOwnProperty(path)) {
      return next(new Error('File already exists'));
    }

    storage[path] = {
      accessTime : (new Date()).getTime(),
      blockSize : 0,
      group : 'supergroup',
      length : 24930,
      modificationTime : (new Date()).getTime(),
      owner : params['user.name'],
      pathSuffix : '',
      permission : '644',
      replication : 1,
      type : 'DIRECTORY'
    };
    return next();
    break;

  case 'append':
  case 'create':
    var overwrite = true;
    var exists = storage.hasOwnProperty(path);
    var append = (operation === 'append');

    if (params.hasOwnProperty('overwrite') && !params.overwrite) {
      overwrite = false;
    }

    if (!append && !overwrite && exists) {
      return next(new Error('File already exists'));
    }

    if (!exists) {
      storage[path] = {
        accessTime : (new Date()).getTime(),
        blockSize : 0,
        group : 'supergroup',
        length : 0,
        modificationTime : (new Date()).getTime(),
        owner : params['user.name'],
        pathSuffix : '',
        permission : '644',
        replication : 1,
        type : 'FILE',
        data : new Buffer(0)
      };
    }

    var bufList = [];
    if (append && storage[path].data.length > 0) {
      bufList.push(storage[path].data);
    }

    req.on('data', function onData(data) {
      bufList.push(new Buffer(data));
    });

    req.on('end', function onFinish() {
      var totalLength = 0;
      for (var i = 0; i < bufList.length; i++)
        totalLength += bufList[i].length;
      storage[path].data = Buffer.concat(bufList, totalLength);
      ;

      storage[path].pathSuffix = p.basename(path);
      storage[path].length = storage[path].data.length;
      return next();
    });

    req.resume();
    break;

  case 'open':
    if (!storage.hasOwnProperty(path)) {
      return next(new Error('File doesn\'t exist'));
    }

    if (params.offset && params.length) {
      var tmp = new Buffer(params.length);
      var length = storage[path].data.copy(tmp, 0, params.offset, params.offset + params.length);
      var buf = tmp.slice(0, length);
      res.writeHead(200, {
        'content-length' : length,
        'content-type' : 'application/octet-stream'
      });

      res.end(buf);

    } else {
      res.writeHead(200, {
        'content-length' : storage[path].data.length,
        'content-type' : 'application/octet-stream'
      });
      var buf = new Buffer(storage[path].data);
      res.end(buf);
    }

    return next();
    break;

  case 'liststatus':
    var files = [];
    for ( var key in storage) {
      if (key !== path && p.dirname(key) === path) {
        files.push(getMetadata(storage[key]));
      }
    }

    var data = JSON.stringify({
      FileStatuses : {
        FileStatus : files
      }
    });

    res.writeHead(200, {
      'content-length' : data.length,
      'content-type' : 'application/json'
    });

    res.end(data);
    return next();
    break;

  case 'getfilestatus':
    if (!storage.hasOwnProperty(path)) {
      return next(new Error('File doesn\'t exist'));
    }

    var data = JSON.stringify({
      FileStatus : getMetadata(storage[path])
    });

    res.writeHead(200, {
      'content-length' : data.length,
      'content-type' : 'application/json'
    });

    res.end(data);
    return next();
    break;

  case 'rename':
    if (!storage.hasOwnProperty(path)) {
      return next(new Error('File doesn\'t exist'));
    }

    if (storage.hasOwnProperty(params.destination)) {
      return next(new Error('Destination path exist'));
    }

    storage[params.destination] = storage[path];
    delete storage[path];

    return next();
    break;

  case 'setpermission':
    if (!storage.hasOwnProperty(path)) {
      return next(new Error('File doesn\'t exist'));
    }

    storage[path].permission = params.permission;
    return next();
    break;

  case 'setowner':
    if (!storage.hasOwnProperty(path)) {
      return next(new Error('File doesn\'t exist'));
    }

    storage[path].owner = params.owner;
    storage[path].group = params.group;
    return next();
    break;

  case 'createsymlink':
    if (!storage.hasOwnProperty(path)) {
      return next(new Error('File doesn\'t exist'));
    }

    if (storage.hasOwnProperty(params.destination)) {
      return next(new Error('Destination path exist'));
    }

    storage[params.destination] = storage[path];
    return next();
    break;

  case 'delete':
    if (params.hasOwnProperty('recursive') && params.recursive) {
      var deleted = false;

      for ( var key in storage) {
        if (p.dirname(key) === path) {
          delete storage[key];
          deleted = true;
        }
      }

      if (!deleted && !storage.hasOwnProperty(path)) {
        return next(new Error('File doesn\'t exist'));
      }

    } else {
      console.log("delete path, ", path);
      delete storage[path];
    }

    return next();
    break;

  default:
    return next();
    break;
  }
};
