/*
 * (c) Folders.io - All rights reserved.
 * Software intended for internal use only.
 *
 * This is a proxy to assist with debugging.
 * It forwards requests for basic API services to a remote endpoint.
 * It will also act as a server, in the absence of an endpoint.
 *
 */

// Favored utility libraries.

import parseQuery from "../mach/utils/parseQuery.js";
import Promise from "promise";

/*
 * convert post data to object and return promise
 *
 */

var objectifyPostData = function (stream) {
  return new Promise(function (fulfil, reject) {
    var strData = "";

    stream.resume();

    stream.on("data", function (data) {
      strData += data.toString();
    });

    stream.on("end", function () {
      try {
        fulfil(parseQuery(strData));
      } catch (err) {
        reject(err);
      }
    });

    stream.on("error", function (err) {
      reject(err);
    });
  });
};

/*
 * Be generous with CORS as this is
 * primarily a developer library.
 *
 */
var corsFriendly = function (response, origin) {
  origin = origin || "http://localhost:8000";
  response.setHeader("Access-Control-Allow-Origin", origin);
  response.setHeader("Access-Control-Allow-Credentials", "true");
  response.setHeader(
    "Access-Control-Allow-Headers",
    [
      "x-file-name",
      "x-file-type",
      "x-file-size",
      "x-file-date",
      "content-disposition",
      "content-type",
    ].join(","),
  );
  response.setHeader("Access-Control-Allow-Methods", "HEAD,GET,POST");
  response.setHeader("Access-Control-Expose-Headers", "Content-Disposition");
};

var requestObject = function (headers, uri, method, postObj, baseHost) {
  var options = {};
  baseHost = baseHost || "https://folders.io";
  options.rejectUnauthorized = false;

  options.uri = uri ? baseHost + uri : baseHost;

  if (headers) options.headers = headers;

  if (method) options.method = method;

  if (postObj) options.form = postObj;

  return options;
};

import jsonSafeStringify from "json-stringify-safe";

/*
 *
 *
 */

function safeStringify(obj) {
  var ret;
  try {
    ret = JSON.stringify(obj);
  } catch (e) {
    ret = jsonSafeStringify(obj);
  }
  return ret;
}

/*
 *
 *
 */
var uuid = function () {
  var id = "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(
    /[xy]/g,
    function (c) {
      var r = (Math.random() * 16) | 0,
        v = c == "x" ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    },
  );
  return id;
};

/*
 * Exit process if required string
 * is empty
 */
var isStringEmpty = function (string) {
  if (typeof string == "undefined" || string.length < 1) {
    console.log("Wrong configuration during start up :");
    process.exit(1);
  }
};

export {
  safeStringify,
  uuid,
  isStringEmpty,
  objectifyPostData,
  requestObject,
  corsFriendly,
};
