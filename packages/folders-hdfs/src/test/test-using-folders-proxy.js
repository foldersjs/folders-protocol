var fs = require('fs');
var FoldersHdfs = new require('../folders-hdfs');
var testFoldersHdfs = new require('./test-folders-hdfs');

var backendPrefix = '/http_window.io_0:webhdfs/';
var backendUrl = "http://45.55.223.28/webhdfs/v1/data/";
var backendFolder = new FoldersHdfs(backendPrefix, {
  baseurl : backendUrl,
  username : 'hdfs'
});

var PORT = 40050;
var prefix = '/http_window.io_0:webhdfs/';
var url = "http://localhost:" + PORT + "/webhdfs/v1/";
var hdfs = new FoldersHdfs(prefix, {
  "baseurl" : url,
  "startEmbeddedProxy" : true,
  "backend" : {
    "instance" : backendFolder,
    "port" : PORT
  }
});

// begin to show test case.
testFoldersHdfs(hdfs, '/', 'test.txt', function(error) {
  if (error) {
    console.warning('test hdfs for folder error, ', '/');
    return;
  }

  console.log("test success");
});
