import path from 'path';
import { Transform } from 'stream';

class CatFrom extends Transform {
  constructor(options = {}) {
    options.objectMode = true;
    super(options);
  }

  static vinylToCat(vinylObj) {
    const result = vinylObj.stat;
    const name = path.basename(vinylObj.path);
    const data = vinylObj.contents;
    const headers = {
      'Content-Length': result.size,
      'Content-Type': 'application/octet-stream',
      'X-File-Type': 'application/octet-stream',
      'X-File-Size': result.size,
      'X-File-Name': name,
    };
    const output = {
      data,
      headers,
    };
    return output;
  }

  _transform(chunk, encoding, callback) {
    const output = CatFrom.vinylToCat(chunk);
    this.push(output);
    callback();
  }
}

export default CatFrom;
