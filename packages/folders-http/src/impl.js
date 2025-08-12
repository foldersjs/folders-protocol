// Not yet used, not used here.
// var backoff = require('backoff');
// stream can be moved out. postal interface is mostly limited in this use.

/*
 * Polyfill for promises: let's just implement a subset.
 */
import Promise from "promise";

/*
 * Messaging library: security and verification.
 * Special thanks to TweetNaCl public domain contributors.
 */
import nf from "tweetnacl";
var handshakePub = nf.util.encodeBase64(nf.box.keyPair().publicKey);
// var Nacl = require('nacl-stream');
import Nacl from "./util/stream-nacl.js";

import outbound from "request";
import postal from "postal";
import * as route from "./route.js";
route.channel = function (uri) {
  var channel = postal.channel(namespace);
  return channel;
};
route.post = function (uri, opts) {
  return outbound.post(uri, { headers: headers });
};
route.Promise = Promise;

// NOTES: This is currently just a singleton transfom, we are not managing multiple states.
route.transform = Nacl;
route.metaTransform = handshakePub;
/*
 *
 * Fio().watch returns a Promise for a postaljs channel and provides a post method which pipes to request.post, optionally using a transform.
 *
 */
