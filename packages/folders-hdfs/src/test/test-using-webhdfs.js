import FoldersHdfs from '../folders-hdfs.js';
import testFoldersHdfs from './test-folders-hdfs.js';

const prefix = '/http_window.io_0:webhdfs/';
const url = 'http://45.55.223.28/webhdfs/v1/data/';
const hdfs = new FoldersHdfs(prefix, {
  baseurl: url,
  username: 'hdfs',
});

const testFilePath = '/test.txt';

testFoldersHdfs(hdfs, '/', 'test.txt', function (error) {
  if (error) {
    console.warn('test hdfs for folder error, ', '/');
    return;
  }

  // test sub folders,
  // first create a dir
  const today = new Date().toISOString().slice(0, 10);
  const newDir = '/' + today + '/';
  hdfs.mkdir(newDir, function (error, result) {
    if (error) {
      return console.warn('test mkdir error,', error);
    }
    console.log('mkdir result, ', result);

    console.log('test sub folders, ', newDir);
    testFoldersHdfs(hdfs, newDir, 'test.txt', function (error) {
      if (error) {
        console.warn('test hdfs for folder error, ', '/');
        return;
      }

      // remove the new created folder after test
      hdfs.unlink(newDir, function cb(error, result) {
        if (error) {
          console.log('error in unlink directory', error);
        }

        console.log('result for unlink directory,', result);
        console.log('test success');
      });
    });
  });
});
