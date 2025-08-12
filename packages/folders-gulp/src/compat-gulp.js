/*
 *
 * Provide translation layers and compatibility for the popular gulpjs ecosystem.
 *
 */

import path from "path";
import Vinyl from "vinyl";
import folders from "folders";
import { Writable, Readable } from "stream";

class Cat {
  to(blobStream, base) {
    const headers = {};
    const headerMap = blobStream.headers;
    if (headerMap) {
      for (const header of headerMap) {
        const x = header.split(":", 2);
        headers[x[0]] = x[1];
      }
    }
    const size = headers["X-File-Size"];
    const name = headers["X-File-Name"];
    let stream = blobStream.data;
    if (typeof stream === "string") stream = Buffer.from(stream);
    const output = new Vinyl({
      stat: { size: size },
      cwd: "/",
      base: "/",
      path: "/" + name,
      contents: stream,
    });
    return output;
  }

  from(vinylObj) {
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
    return {
      data: data,
      headers: headers,
    };
  }
}

class Ls {
  to(listObj) {
    const size = listObj.size;
    const mtime = new Date(parseFloat(listObj.modificationTime));
    const stream = Buffer.from(JSON.stringify(listObj));
    const base = listObj.uri;
    return new Vinyl({
      stat: { size: size, mtime: mtime },
      cwd: "/",
      base: path.dirname(base),
      path: base,
      contents: stream,
    });
  }

  from(vinylObj) {
    const modificationTime = vinylObj.stat.mtime.getTime().toString();
    const name = path.basename(vinylObj.path);
    const size = vinylObj.stat.size;
    const uri = `${vinylObj.base}/${name}`;
    return {
      name: name,
      uri: uri,
      modificationTime: modificationTime,
      fullPath: `/${name}`,
      size: size,
      extension: "txt",
      type: "text/plain",
    };
  }
}

class Write extends Writable {
  constructor(opt = {}) {
    opt.objectMode = true;
    super(opt);
  }

  _write(chunk, encoding, callback) {
    callback();
    return true;
  }
}

class Read extends Readable {
  constructor(opt = {}) {
    opt.objectMode = true;
    super(opt);
    this.listing = false;
    this.waiting = false;
  }

  _read(size) {
    if (this.listing === false) {
      new folders.stub().ls(".", (data) => {
        const v = new Ls();
        for (const item of data) {
          this.push(v.to(item));
        }
        this.waiting = false;
      });
      this.listing = true;
      this.waiting = true;
    } else {
      if (this.waiting !== true) {
        this.push(null);
      }
    }
  }
}
