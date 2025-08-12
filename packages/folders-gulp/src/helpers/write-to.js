import path from "path";
import Vinyl from "vinyl";
import { Readable } from "stream";

class WriteTo extends Readable {
  constructor(path, provider, options) {
    super(options);
    // FIXME: implement this function. function
    // prototyoe may be wrong
    // no valid design yet  for writeTo
  }

  _read() {
    // FIXME: implement this function. function
    // prototyoe may be wrong
    // no valid design yet  for writeTo
  }
}

const catToVinyl = function (blobStream, base) {
  // FIXME: implement this function
};

export default WriteTo;
