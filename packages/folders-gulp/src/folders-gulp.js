import path from 'path';
import gulp from 'gulp';
import { z } from 'zod';
import LsTo from './helpers/LsTo.js';
import LsFrom from './helpers/LsFrom.js';
import CatTo from './helpers/CatTo.js';
import CatFrom from './helpers/CatFrom.js';
import WriteFrom from './helpers/WriteFrom.js';
import WriteTo from './helpers/WriteTo.js';

const FoldersGulpOptions = z.object({
  provider: z.string().optional().default('ftp'),
});

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
