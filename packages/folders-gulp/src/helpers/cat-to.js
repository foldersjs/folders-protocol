import path from "path";
import Vinyl from "vinyl";
import { Readable } from "stream";

class CatTo extends Readable {
  constructor(filePath, provider = "ftp", options = {}) {
    options.objectMode = true;
    super(options);

    this.path = filePath;
    this.provider = null;
    this.ready = this.initializeProvider(provider, options);
  }

  async initializeProvider(provider, options) {
    const ProviderModule = await import(`folders-${provider}`);
    this.provider = new ProviderModule.default(provider, options);
  }

  static catToVinyl(blobStream) {
    const headers = {};
    const headerMap = blobStream.headers;
    if (headerMap) {
      for (const header of headerMap) {
        const [key, value] = header.split(":", 2);
        headers[key] = value;
      }
    }
    const size = headers["X-File-Size"];
    const name = headers["X-File-Name"];
    let stream = blobStream.data;
    if (typeof stream === "string") {
      stream = Buffer.from(stream);
    }
    const output = new Vinyl({
      stat: {
        size: size,
      },
      cwd: "/",
      base: "/",
      path: "/" + name,
      contents: stream,
    });
    return output;
  }

  async _read() {
    try {
      await this.ready;
      this.provider.cat(this.path, (err, result) => {
        if (err) {
          this.emit("error", err);
          return;
        }
        if (result) {
          const output = CatTo.catToVinyl(result);
          this.push(output);
        }
        this.push(null);
      });
    } catch (err) {
      this.emit("error", err);
    }
  }
}

export default CatTo;
