import path from 'path';
import Vinyl from 'vinyl';
import { Readable } from 'stream';

const listToVinyl = function (listObj) {
  const size = listObj.size;
  const mtime = new Date(parseFloat(listObj.modificationTime));
  const stream = Buffer.from(JSON.stringify(listObj));
  const base = listObj.uri; // NOTES: May want to clean up this path.
  const output = new Vinyl({
    stat: {
      size: size,
      mtime: mtime,
    },
    cwd: '/',
    base: path.dirname(base),
    path: base,
    contents: stream,
  });

  return output;
};

class LsTo extends Readable {
  constructor(filePath, provider, options) {
    options = options || {};
    options.objectMode = true;
    super(options);

    this.path = filePath || '.';
    provider = provider || 'ftp';
    const prefix = provider;
    // Note: This is a dynamic import. This might cause issues.
    // It's better to pass the provider instance directly.
    // For now, I'll keep it as is to maintain the original logic.
    const providerModule = import(`folders-${provider}`);
    this.item = 0;
    providerModule.then((provider) => {
      this.provider = new provider.default(prefix, options);
    });
  }

  _read() {
    if (!this.provider) {
      // provider is not yet loaded
      setTimeout(() => this._read(), 100);
      return;
    }

    this.provider.ls(this.path, (err, result) => {
      if (err) {
        this.emit('error', err);
        return;
      }
      if (result) {
        for (; this.item < result.length; this.item = this.item + 1) {
          const output = listToVinyl(result[this.item]);
          this.push(output);
        }
      }

      this.push(null);
    });
  }
}

export default LsTo;
