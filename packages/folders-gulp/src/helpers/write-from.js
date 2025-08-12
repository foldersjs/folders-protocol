import path from "path";
import { Writable } from "stream";

const vinylToWrite = function (vinylObj) {
  const result = vinylObj.stat;
  const name = path.basename(vinylObj.path);
  const data = vinylObj.contents;
  const headers = {
    "Content-Length": result.size,
    "Content-Type": "application/octet-stream",
    "X-File-Type": "application/octet-stream",
    "X-File-Size": result.size,
    "X-File-Name": name,
  };
  const output = {
    data: data,
    headers: headers,
  };
  return output;
};

class WriteFrom extends Writable {
  constructor(filePath, provider, options, cb) {
    options = options || {};
    options.objectMode = true;
    super(options);

    this.path = filePath;
    this.cb = cb || function (err, result) {};
    provider = provider || "ftp";
    const Provider = import(`folders-${provider}`);
    Provider.then((ProviderModule) => {
      this.provider = new ProviderModule.default(provider, options);
    });
  }

  _write(chunk, encoding, callback) {
    if (!this.provider) {
      setTimeout(() => this._write(chunk, encoding, callback), 100);
      return;
    }

    const output = vinylToWrite(chunk);
    const path = this.path;
    const data = output.data;
    this.provider.write(path, data, this.cb);
    callback();
  }
}

export default WriteFrom;
