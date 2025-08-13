import nacl from "tweetnacl";
import Nacl from "./util/stream-nacl.js";

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
export function createNaclTransforms() {
  const key = new Uint8Array(32).fill(1); // INSECURE: Replace with a derived shared secret
  const nonce = new Uint8Array(16).fill(2); // INSECURE: Replace with a derived nonce

  const encryptor = new Nacl({ key, nonce });
  const decryptor = new Nacl({ key, nonce, unbox: true });

  return { encryptor, decryptor };
}
