import path from 'path';
import { Transform } from 'stream';

const vinylToList = function (vinlyObj) {
  const modificationTime = vinlyObj.stat.mtime.getTime() + '';
  const name = path.basename(vinlyObj.path);
  const size = vinlyObj.stat.size;
  const uri = vinlyObj.base + '/' + name;
  const output = {
    name: name,
    uri: uri,
    modificationTime: modificationTime,
    fullPath: '/' + name,
    size: size,
    extension: 'txt',
    type: 'text/plain',
  };
  return output;
};

class LsFrom extends Transform {
  constructor(options) {
    options = options || {};
    options.objectMode = true;
    super(options);
  }

  _transform(chunk, encoding, callback) {
    const output = vinylToList(chunk);
    this.push(output);
    callback();
  }
}

export default LsFrom;
