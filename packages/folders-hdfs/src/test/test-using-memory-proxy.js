var fs = require('fs');
var FoldersHdfs = new require('../folders-hdfs');
var testFoldersHdfs = new require('./test-folders-hdfs');

var prefix = '/http_window.io_0:webhdfs/';
var PORT = 40050;
var url = "http://localhost:" + PORT + "/webhdfs/v1/";
var hdfs = new FoldersHdfs(prefix, {
  "baseurl" : url,
  "startEmbeddedProxy" : true,
  "backend" : {
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
