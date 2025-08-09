import path from 'path';
import Vinyl from 'vinyl';
import { Readable } from 'stream';

// this will work on output of ftp.cat.
const catToVinyl = function (blobStream, base) {
  // Headers ain't so nice!

  const headers = {};
  const headerMap = blobStream.headers;
  if (headerMap)
    for (let i = 0; i < headerMap.length; i++) {
      const x = headerMap[i].split(':', 2);
      headers[x[0]] = x[1];
    }
  const size = headers['X-File-Size'];
  const name = headers['X-File-Name'];
  let stream = blobStream.data;
  if (typeof stream == 'string') stream = Buffer.from(stream);
  const output = new Vinyl({
    stat: {
      size: size,
    },
    cwd: '/',
    base: '/',
    path: '/' + name,
    contents: stream,
  });
  return output;
};

class CatTo extends Readable {
  constructor(filePath, provider, options) {
    options = options || {};
    options.objectMode = true;
    super(options);

    this.path = filePath;
    this.waiting = false;
    provider = provider || 'ftp';
    const Provider = import(`folders-${provider}`);
    Provider.then((ProviderModule) => {
      this.provider = new ProviderModule.default(provider, options);
    });
  }

  _read() {
    if (!this.provider) {
      setTimeout(() => this._read(), 100);
      return;
    }

    if (this.waiting === false) {
      this.provider.cat(this.path, (err, result) => {
        if (err) {
          this.emit('error', err);
          return;
        }
        if (result) {
            const output = catToVinyl(result);
            this.push(output);
        }
        this.push(null);
      });

      this.waiting = true;
    }
  }
}

export default CatTo;
