import nacl from "tweetnacl";
import Nacl from "./util/stream-nacl.js";

function decodeHexString(str) {
  const arr = [];
  for (let i = 0; i < str.length; i += 2) {
    arr.push(parseInt(str.substring(i, i + 2), 16));
  }
  return new Uint8Array(arr);
}

/**
 * @typedef {Object} NaclTransforms
 * @property {import('stream').Transform} encryptor - The encryption transform.
 * @property {import('stream').Transform} decryptor - The decryption transform.
 */

/**
 * Creates a pair of NaCl encryption and decryption streams.
 *
 * FIXME: This uses a hardcoded, insecure key and nonce for demonstration
 * purposes. In a real application, you must use a secure key exchange
 * mechanism (like Diffie-Hellman) to generate a shared secret, and then
 * derive the key and nonce from that secret.
 *
 * @returns {NaclTransforms} An object containing the encryptor and decryptor streams.
 */
export function createNaclTransforms(serverPublicKeyStr, sessionKey) {
  const serverPublicKey = decodeHexString(serverPublicKeyStr);
  const sharedSecret = nacl.box.before(serverPublicKey, sessionKey.secretKey);

  const key = sharedSecret.slice(0, 32);
  const nonce = sharedSecret.slice(0, 16);

  const encryptor = new Nacl({ key, nonce });
  const decryptor = new Nacl({ key, nonce, unbox: true });

  return { encryptor, decryptor };
}
