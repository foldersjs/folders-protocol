/*
 * nacl-stream as a node.js stream.
 * Special thanks to TweetNacl public domain contributors.
 *
 */

import nacl from 'nacl-stream';
import util from 'util';
import { Readable, Transform } from 'stream';
import { Buffer } from 'buffer';

// NOTES: This has several buffer copies as it uses new Buffer(ArrayBuffer) and Buffer.concat.
class Nacl extends Transform {
  constructor(options, len, hasUnbox) {
    super(options);
    var BOX_KEY = new Uint8Array(32);
  var BOX_NONCE = new Uint8Array(16);

  var FIFTEEN_KB = 2<<15;
  var NACL_STREAM_INTEGER_SIZE = 4;
  var NACL_STREAM_NONCE_SIZE = 16;
  var NACL_STREAM_CHUNK_OVERHEAD = NACL_STREAM_INTEGER_SIZE + NACL_STREAM_NONCE_SIZE;

  this.buf = null;
  this.CHUNK_LENGTH = FIFTEEN_KB;
  this.CHUNK_OVERHEAD = NACL_STREAM_CHUNK_OVERHEAD;
  this.overheadLength = 0;
  this.totalLength = len || 0;
  // FIXME: Needs a real key and nonce.
  if(hasUnbox) {
    this.transform = nacl.stream.createDecryptor(BOX_KEY, BOX_NONCE, this.CHUNK_LENGTH);
    this.transformChunk = function(data, i, chunkLen) {
      return new Buffer(this.transform.decryptChunk(data.slice(i, i+chunkLen), false).subarray(0,chunkLen + this.CHUNK_OVERHEAD));
    };
  }
  if(this.totalLength > 0) this.overheadLength = this.CHUNK_OVERHEAD * Math.ceil(len / FIFTEEN_KB);
  this.transform = nacl.stream.createEncryptor(BOX_KEY, BOX_NONCE, this.CHUNK_LENGTH);
  this.transformChunk = function(data, i, chunkLen) {
    return new Buffer(this.transform.encryptChunk(data.slice(i, i+chunkLen), false).subarray(0,chunkLen + this.CHUNK_OVERHEAD));
  };
  }

  _transform(data, encoding, callback) {
    var maxChunkLen = this.CHUNK_LENGTH;
    var transform = this.transform;
    // TODO: Buffer to CHUNK_LENGTH to allow an accurate content-length.
    if(this.buf !== null) {
      data = Buffer.concat([this.buf, data]);
      console.log("buffer", data);
      this.buf = null;
    }
    for (i = 0; i < data.length; i += maxChunkLen) {
      if(data.length - i < maxChunkLen) {
        this.buf = data.slice(i);
        break;
      }
      var chunkLen = maxChunkLen;
      if(!this.totalLength) this.overheadLength += this.CHUNK_OVERHEAD;
      this.push(this.transformChunk(data,i,chunkLen));
    }
    callback();
  }

  _flush(callback)  {
    if(this.buf !== null) {
      var i = 0; var chunkLen = this.buf.length; var data = this.buf; this.buf = null;
      this.push(this.transformChunk(data,i,chunkLen));
    }
    this.push(null);
    this.transform.clean();
    callback();
  }
}
export default Nacl;
