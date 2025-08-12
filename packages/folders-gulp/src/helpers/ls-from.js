import path from "path";
import { Transform } from "stream";

class LsFrom extends Transform {
  constructor(options = {}) {
    options.objectMode = true;
    super(options);
  }

  static vinylToList(vinlyObj) {
    const modificationTime = vinlyObj.stat.mtime.getTime() + "";
    const name = path.basename(vinlyObj.path);
    const size = vinlyObj.stat.size;
    const uri = vinlyObj.base + "/" + name;
    const output = {
      name,
      uri,
      modificationTime,
      fullPath: "/" + name,
      size,
      extension: "txt",
      type: "text/plain",
    };
    return output;
  }

  _transform(chunk, encoding, callback) {
    const output = LsFrom.vinylToList(chunk);
    this.push(output);
    callback();
  }
}

export default LsFrom;
