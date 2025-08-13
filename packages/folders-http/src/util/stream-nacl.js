/*
 * nacl-stream as a node.js stream.
 * Special thanks to TweetNacl public domain contributors.
 *
 */

import nacl from "nacl-stream";
import { Transform } from "stream";
import { Buffer } from "buffer";

// NOTES: This has several buffer copies as it uses Buffer.from(ArrayBuffer) and Buffer.concat.
class Nacl extends Transform {
  constructor({ key, nonce, unbox = false, length = 0 }, options) {
    super(options);

    if (!key || key.length !== 32) {
      throw new Error("key must be a 32-byte Uint8Array.");
    }
    if (!nonce || nonce.length !== 16) {
      throw new Error("nonce must be a 16-byte Uint8Array.");
    }

    const FIFTEEN_KB = 1 << 15; // 32KB, not 15KB. Original was 2 << 15 which is 64KB. Let's stick to a more standard chunk size.
    const NACL_STREAM_INTEGER_SIZE = 4;
    const NACL_STREAM_NONCE_SIZE = 16;
    const NACL_STREAM_CHUNK_OVERHEAD =
      NACL_STREAM_INTEGER_SIZE + NACL_STREAM_NONCE_SIZE;

    this.buf = null;
    this.CHUNK_LENGTH = FIFTEEN_KB;
    this.CHUNK_OVERHEAD = NACL_STREAM_CHUNK_OVERHEAD;
    this.overheadLength = 0;
    this.totalLength = length;

    if (unbox) {
      this.transform = nacl.stream.createDecryptor(
        key,
        nonce,
        this.CHUNK_LENGTH,
      );
      this.transformChunk = (data, i, chunkLen) =>
        Buffer.from(
          this.transform
            .decryptChunk(data.slice(i, i + chunkLen), false)
            .subarray(0, chunkLen + this.CHUNK_OVERHEAD),
        );
    } else {
      this.transform = nacl.stream.createEncryptor(
        key,
        nonce,
        this.CHUNK_LENGTH,
      );
      this.transformChunk = (data, i, chunkLen) =>
        Buffer.from(
          this.transform
            .encryptChunk(data.slice(i, i + chunkLen), false)
            .subarray(0, chunkLen + this.CHUNK_OVERHEAD),
        );
    }

    if (this.totalLength > 0) {
      this.overheadLength =
        this.CHUNK_OVERHEAD * Math.ceil(length / FIFTEEN_KB);
    }
  }

  _transform(data, encoding, callback) {
    const maxChunkLen = this.CHUNK_LENGTH;
    // TODO: Buffer to CHUNK_LENGTH to allow an accurate content-length.
    if (this.buf !== null) {
      data = Buffer.concat([this.buf, data]);
      this.buf = null;
    }
    for (let i = 0; i < data.length; i += maxChunkLen) {
      if (data.length - i < maxChunkLen) {
        this.buf = data.slice(i);
        break;
      }
      const chunkLen = maxChunkLen;
      if (!this.totalLength) this.overheadLength += this.CHUNK_OVERHEAD;
      this.push(this.transformChunk(data, i, chunkLen));
    }
    callback();
  }

  _flush(callback) {
    if (this.buf !== null) {
      const i = 0;
      const chunkLen = this.buf.length;
      const data = this.buf;
      this.buf = null;
      this.push(this.transformChunk(data, i, chunkLen));
    }
    this.push(null);
    if (this.transform) {
      this.transform.clean();
    }
    callback();
  }
}
export default Nacl;
