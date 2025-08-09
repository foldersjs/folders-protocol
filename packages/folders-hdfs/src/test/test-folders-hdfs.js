import fs from 'fs';

export default function testFoldersHdfs(hdfs, testFolder, testFile, callback) {
  const testFilePath = testFolder + testFile;
  // Step 1: test ls the root path
  console.log('step 1: ls ,', testFolder);
  hdfs.ls(testFolder, function cb(error, files) {
    if (error) {
      console.log('error in ls directory/files');
      console.log(error);
      return callback(error);
    }

    console.log('hdfs result for ls /, ', files, '\n');

    // Step 2: test write file
    console.log('step 2: write, ', testFilePath);
    const stream = fs.createReadStream('packages/folders-hdfs/src/test/dat/test.txt');
    hdfs.write(testFilePath, stream, function cb(error, result) {
      if (error) {
        console.log('error in write file');
        console.log(error);
        return callback(error);
      }

      console.log('result for write, ', result, '\n');

      // ls after write success
      hdfs.ls(testFolder, function cb(error, files) {
        if (error) {
          console.log('error in ls directory/files');
          console.log(error);
          return callback(error);
        }

        console.log('hdfs ls result after write /, ', files, '\n');

        // Step 3: test cat file
        console.log('step 3: cat, ', testFilePath);
        hdfs.cat(
          {
            path: testFilePath,
            offset: 0,
            length: 10,
          },
          function cb(error, results) {
            if (error) {
              console.log('error in cat file');
              console.log(error);
              return callback(error);
            }

            console.log('results for cat,', results.name, results.size, '\n');

            // Step 4 : test delete/unlinke files
            console.log('step 4: unlink,', testFilePath);
            hdfs.unlink(testFilePath, function cb(error, result) {
              if (error) {
                console.log('error in unlink directory/files');
                console.log(error);
                return callback(error);
              }

              console.log('result for unlink,', result, '\n');
              return callback();
            });
          },
        );
      });
    });
  });
}
