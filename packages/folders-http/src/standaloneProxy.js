/*
 * (c) Folders.io - All rights reserved.
 * Software intended for internal use only.
 *
 * It will also act as a server, in the absence of an endpoint.
 * This file will be deleted in future
 * Use ./standaloneServer.js in replacement for this
 */

// Favored utility libraries.
import stream from "event-stream";
import index from "./util/watchfile.js";
import serveapp from "./mach/utils/serveApp.js";
import createConnection from "./mach/utils/createConnection.js";
import stubApp from "./app/stubApp.js";
import restApp from "./app/restApp.js";
import helpers from "./util/helpers.js";
//var Fio = require('folders/src/handshake.js');

import Handshake from "folders/src/handshake.js";

var HandshakeService = Handshake.HandshakeService;

/*
 * Global Variables
 *
 */

/*
 *
 * mode 0:
 *  handle requests for a single provider.
 *  shareName and shareId are not processed.
 *  event data is not handled (not sent to the client).
 *
 */

// FIXME: Move the argv logic to the cli.js
var standaloneProxy = function (argv) {
  //FIXME : code will break if --port=invalidvalue example string
  argv = argv == undefined ? { listen: 8090, mode: 0 } : argv;
  this.port = "listen" in argv ? argv["listen"] : 8090;
  this.shareId = "shareId" in argv ? argv["shareId"] : "testshareid";
  this.mode = argv["mode"];
  switch (this.mode) {
    case 0:
      console.log(">> Server Running In Mode : " + this.mode);
      break;
    case 1:
      console.log(">> Server Running In Mode : " + this.mode);
      break;
    default:
      console.log(">> Server Running In Default Mode");
  }
  this.service = new HandshakeService();
  //console.log('service = ', this.service);
  //FIXME: this should be loaded instead of generated
  this.keypair = Handshake.createKeypair();
  this.publicKey = Handshake.stringify(this.keypair.publicKey);
  console.log("server public key: ", this.publicKey);
  console.log("Handshake service created");
};

// Forward requests to a single backend (stubApp).
standaloneProxy.prototype.mode0Handler = function (conn, nodeResponse) {
  var uri = conn.location.pathname;
  var app = stubApp(uri, this.backend);
  connHandler(app, conn, nodeResponse);
};

standaloneProxy.prototype.startProxy = function (routeHandler, backend) {
  var self = this;

  // Requests may be routed to a single static backend for simplicity or a channel based router for flexibility.

  // a channel based router.
  this.routeHandler = routeHandler;
  this.routeServer = new RouteServer(self);

  // a single static backend.
  this.backend = backend;

  // static file.
  index(__dirname + "\\static\\index.html", function (err, data) {
    if (err) {
      console.log("could not read static index file");
      return;
    }
    console.log(">> index file read: " + data.length + " bytes");
  });

  // Boot in mach http
  serveapp(self.routeServer.simpleServer, { port: self.port });
};

var RouteServer = function (o) {
  // mach http service hook.
  var simpleServer = function (nodeRequest, nodeResponse) {
    helpers.corsFriendly(nodeResponse);
    var conn = createConnection(nodeRequest);
    switch (o.mode) {
      case 1:
        o.routeFriendly(conn, nodeResponse);
        break;
      case 0:
      default:
        o.mode0Handler(conn, nodeResponse);
    }
  };
  this.simpleServer = simpleServer;
};

// static page
var defaultFriendly = function (request, response) {
  index(__dirname + "\\static\\index.html", function (err, data) {
    response.setHeader("Content-Type", "text/html");
    response.writeHead(200);
    response.end(data);
  });
};

// generic consumer of a "restApp" handler for HTTP.
/**
 * HTTP status codes that don't have entities.
 */
var STATUS_WITHOUT_CONTENT = {
  100: true,
  101: true,
  204: true,
  304: true,
};
var connHandler = function (app, conn, nodeResponse) {
  conn.call(app).then(
    function () {
      var isHead = conn.method === "HEAD";
      var isEmpty = isHead || STATUS_WITHOUT_CONTENT[conn.status] === true;
      var headers = conn.response.headers;

      // NOTES: Does not seem to work as intended: there is no content accessible here.
      var content = conn.response.content;

      if (isEmpty && !isHead) headers["Content-Length"] = 0;

      if (!headers.Date) headers.Date = new Date().toUTCString();

      //    console.dir(conn)

      nodeResponse.writeHead(conn.status, headers);

      if (isEmpty) {
        nodeResponse.end();
        if (typeof content.destroy === "function") content.destroy();
      } else {
        content.pipe(nodeResponse);
      }
    },
    function (error) {
      conn.onError(error);
      nodeResponse.writeHead(500, { "Content-Type": "text/plain" });
      nodeResponse.end("Internal Server Error");
    },
  );
};

var strToArr = function (str) {
  var arr = [];
  for (var i = 0, j = str.length; i < j; ++i) {
    arr.push(str.charCodeAt(i));
  }
  return new Uint8Array(arr);
};
// Pieces of a standalone server implementation.

standaloneProxy.prototype.routeFriendly = function (conn, response) {
  var self = this;

  //FIXME: quick hack to handle PUT request for handshake
  if (conn.method == "PUT") {
    var uri = conn.location.pathname;
    console.log("PUT method", uri);

    var self = this;
    conn.request.parseContent().then(function (content) {
      console.log("parsed content: ", content, typeof content);
      var endpoint = uri.substring(1);

      if (typeof content != "string") {
        console.log("invalid request!");
        response.writeHead(301);
      }

      content = Handshake.decodeHexString(content);
      //convert public key back to Uint8Array

      //var res= self.service.node(endpoint, Handshake.decodeHexString(content.key));
      var res = self.service.node(endpoint, content);
      if (res) {
        console.log("request succeeded!");
        //response.content = this.publicKey;
        //response.end(200, this.publicKey);
        response.writeHead(200);
        response.end(self.publicKey);
      } else {
        //conn.status = 301;
        //response.end(301);
        console.log("invalid request!");
        response.writeHead(301);
        response.end();
      }
    });
    //console.log('request: ', conn.request.contentType, conn.request.content, conn.request.parseContent());
    //conn.request.pipe(process.stdout);
    //conn.request.on('data', function(chunk) {
    //	console.log('data', chunk);
    //})
    //console.log('req content: ', conn.request.content);

    //this.service.node(endpoint, key.publicKey);
    return;
  } else if (conn.method == "POST") {
    //check if this is a handshaked session

    var uri = conn.location.pathname.substring(1);

    console.log("POST", uri);
    rx = /^[0-9a-z]{64}\/(.+)$/;
    var match = rx.exec(uri);

    if (match != null && match.length >= 2) {
      var endpoint = uri.substring(0, 64);
      var path = match[1];
      //console.log('Matched group: ', match[1]);
      conn.request.parseContent().then(function (content) {
        var signature = content["sign"];
        console.log("content: ", content);
        //test signature

        if (self.service.verifyRequest(endpoint, path, signature)) {
          response.writeHead(200);
          response.end(); //OK!
        } else {
          console.log("invalid signature");
          response.writeHead(301);
          response.end();
        }
        //console.log('parsed content: ', content, typeof(content));
      });
      return;
    } else {
      console.log("not our request");
    }
  }

  //FIXME: check provider.js again as getCurrentSession is not exported properly
  var currentSession = self.routeHandler.getCurrentSession();
  // currentToken

  // FIXME: Later.
  if (!currentSession) {
    response.end();
    return;
  }

  // FIXME: Currently serving one route at the moment when proxying upstream.
  var currentToken = currentSession.token;
  var currentShareName = currentSession.shareName;
  var currentShareId = currentSession.shareId;
  var requestMethod = conn.method;
  if (!(requestMethod == "GET" || requestMethod == "POST")) {
    response.end();
    return;
  }

  // NOTES: restHandler will handle requests internally, the subsequent methods simply proxy requests to another server.

  var requestId = helpers.uuid();
  var result = restApp(conn, requestId, this.shareId);
  if (result) {
    console.log("sending a data packet through.");
    var streamId = result.data.streamId || result.streamId;
    self.routeHandler.once(streamId, function (stream, headers) {
      console.log("response", streamId, headers);
      // NOTES: Bug in the client, it tries to deserialize twice.
      if (headers) delete headers["Content-Type"];
      response.writeHead(200, headers);
      return stream.pipe(response);
    });

    // Request could be self-served from a provider or from a listening json stream.
    self.routeHandler.send(result);
    return result;
  }

  console.log("method: ", request.method);
  if (request.method == "GET") {
    // FIXME: These are still tuned to having one active shareId; the initial point of this proxy.
    // Scope has increased to handling multiple active shareIds.
    // Event stream.
    if (request.url.substr(0, 5) == "/json") {
      var listen = {};
      // Listen for events from one ID:
      if (false) {
        eventFriendly(request, response, listen, currentShareId);
        // uses a global, passes to a submodule, broken.
        proxyListRequest = listen.onList;
        proxyBlobRequest = listen.onBlob;
        listen.onClose = function () {
          proxyListRequest = proxyBlobRequest = null;
        };
      }
      var shareId = eventFriendly(request, response, listen);
      self.routeHandler.until(shareId, listen);
    }

    // Handshake. set_files is a similar handshake.
    else if (request.url.indexOf("/get_share") === 0) {
      resumeFriendly(request, response, currentShareId, currentShareName);
    }

    // UTF-8 and Blob.
    else if (
      request.url.substr(0, 5) == "/file" ||
      request.url.indexOf("/dir") === 0 ||
      request.url.indexOf("/terms") === 0 ||
      request.url.indexOf("/press") === 0
    ) {
      getFriendly(request, response, currentToken);
    } else {
      defaultFriendly(request, response);
    }
    return;
  }
};

export default standaloneProxy;
