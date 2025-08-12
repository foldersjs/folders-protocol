import path from "path";
import gulp from "gulp";
import { z } from "zod";
import LsTo from "./helpers/ls-to.js";
import LsFrom from "./helpers/ls-from.js";
import CatTo from "./helpers/cat-to.js";
import CatFrom from "./helpers/cat-from.js";
import WriteFrom from "./helpers/write-from.js";
import WriteTo from "./helpers/write-to.js";

const FoldersGulpOptions = z
  .object({
    provider: z.string().optional().default("ftp"),
  })
  .passthrough();

class FoldersGulp {
  constructor(prefix, options) {
    const parsedOptions = FoldersGulpOptions.parse(options || {});
    this.prefix = prefix;
    this.options = parsedOptions;
    this.provider = parsedOptions.provider;
  }

  lsTo(path) {
    return new LsTo(path, this.provider, this.options);
  }

  lsFrom() {
    return new LsFrom(this.options);
  }

  catTo(path) {
    return new CatTo(path, this.provider, this.options);
  }

  catFrom() {
    return new CatFrom(this.options);
  }

  writeFrom(path, cb) {
    return new WriteFrom(path, this.provider, this.options, cb);
  }

  writeTo(path) {
    return new WriteTo(path, this.options);
  }
}

export default FoldersGulp;
