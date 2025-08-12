import path from 'path';
import Vinyl from 'vinyl';
import { Readable } from 'stream';

class LsTo extends Readable {
  constructor(filePath = '.', provider = 'ftp', options = {}) {
    options.objectMode = true;
    super(options);

    this.path = filePath;
    this.provider = null;
    this.ready = this.initializeProvider(provider, options);
    this.items = [];
  }

  async initializeProvider(provider, options) {
    const ProviderModule = await import(`folders-${provider}`);
    this.provider = new ProviderModule.default(provider, options);
  }

  static listToVinyl(listObj) {
    const size = listObj.size;
    const mtime = new Date(parseFloat(listObj.modificationTime));
    const stream = Buffer.from(JSON.stringify(listObj));
    const base = listObj.uri;
    const output = new Vinyl({
      stat: {
        size,
        mtime,
      },
      cwd: '/',
      base: path.dirname(base),
      path: base,
      contents: stream,
    });

    return output;
  }

  async _read() {
    try {
      await this.ready;

      if (!this.items.length) {
        this.provider.ls(this.path, (err, result) => {
          if (err) {
            this.emit('error', err);
            return;
          }
          if (result) {
            this.items = result;
          }
          this.pushItems();
        });
      } else {
        this.pushItems();
      }
    } catch (err) {
      this.emit('error', err);
    }
  }

  pushItems() {
    for (const item of this.items) {
      const output = LsTo.listToVinyl(item);
      this.push(output);
    }
    this.items = [];
    this.push(null);
  }
}

export default LsTo;
