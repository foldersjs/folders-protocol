'use strict';

var p = require('path');
var mime = require('mime');

var convertFolderMetadataToHdfs = function(data) {
  // TODO
  return {
    // accessTime : data.modificationTime,
    // blockSize : data.blockSize,
    // group : data.group,
    length : data.size,
    modificationTime : data.modificationTime,
    // owner : data.owner,
    pathSuffix : data.name,
    // permission : data.permission,
    replication : data.replication,
    type : data.extension == '+folder' ? 'DIRECTORY' : 'FILE'
  };
}

var FoldersStorageHandler = function(foldersBackend) {
  this.backend = foldersBackend;
};

module.exports = FoldersStorageHandler;

// write a folders based hdfs proxy, data stored using the backend folders..
FoldersStorageHandler.prototype.storageHandler = function() {
  var backend = this.backend;

  return function(err, path, operation, params, req, res, next) {

    if (err) {
      return next(err);
    }

    switch (operation) {
    case 'mkdirs':
      return next(new Error('Not supported yet'));
      break;

    case 'append':
    case 'create':
      var overwrite = true;

      // The Req (http.IncomingMessage) has implements the Readable Stream
      // interface.
      // The folders support the stream input data
      backend.write(path, req, function(err, data) {
        if (err) {
          return next(new Error(err));
          console.log('write err,', err);
        } else {
          console.log('write success,', data);
          var result = JSON.stringify({
            'success' : true
          });

          res.writeHead(200, {
            'content-length' : result.length,
            'content-type' : 'application/json'
          });

          res.end(result);
          return next();
        }
      });

      break;

    case 'open':
      var catParam = path;
      if (backend.features && backend.features.range_cat) {
        catParam = {
          path : path,
          offset : params.offset,
          length : params.length
        };
      }

      backend.cat(catParam, function(err, data) {
        if (err) {

          return next(new Error(err));
        } else {
          data.stream.pipe(res);
          // return next();
        }

      });

      break;
    case 'getfilestatus':
      backend.ls(path, function(err, data) {
        if (err) {

          return next(new Error(err));

        } else {

          if (!data || data.length == 0) {
            return next(new Error('file not exist'));
          }

          var file = convertFolderMetadataToHdfs(data[0]);

          var result = JSON.stringify({
            FileStatus : file
          });

          res.writeHead(200, {
            'content-length' : result.length,
            'content-type' : 'application/json'
          });

          res.end(result);
          return next();
        }

      });
      break;

    case 'liststatus':
      backend.ls(path, function(err, data) {

        if (err) {

          return next(new Error(err));

        } else {
          var files = [];
          for (var idx = 0; idx < data.length; idx++) {
            files.push(convertFolderMetadataToHdfs(data[idx]));
          }

          var result = JSON.stringify({
            FileStatuses : {
              FileStatus : files
            }
          });

          res.writeHead(200, {
            'content-length' : result.length,
            'content-type' : 'application/json'
          });

          res.end(result);
          return next();
        }

      });

      break;

    case 'delete':
      backend.unlink(path, function(err, data) {

        if (err) {
          return next(new Error(err));
        } else {
          var result = JSON.stringify({
            'success' : true
          });

          res.writeHead(200, {
            'content-length' : result.length,
            'content-type' : 'application/json'
          });

          res.end(result);
          return next();
        }
      });

      break;

    case 'rename':
      return next(new Error('not support yet'));
      break;

    case 'setpermission':
      return next(new Error('not support yet'));
      break;

    case 'setowner':
      return next(new Error('not support yet'));
      break;

    case 'createsymlink':
      return next(new Error('not support yet'));
      break;

    default:
      return next(new Error('not support yet'));
      break;
    }
  };
};
