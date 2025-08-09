/*
 * (c) Folders.io - All rights reserved.
 * Software intended for internal use only.
 *
 * This is a proxy to assist with debugging.
 * It will also act as a server, in the absence of an endpoint.
 *
 */
/*
 * This file can be used as a replacement of standaloneProxy.js
 * This module can be used both in debug mode and live mode
 */
import express from 'express';
import bodyParser from 'body-parser';
import request from 'request';
import http from 'http';
import path from 'path';
import os from 'os';
//var publicIp = require('public-ip');
import compression from 'compression';
import stubApp from './app/stubApp.js';
var app = express();
import Annotation from './annotate.js';


//Allow CORS when withCredentials = true in client
//https://github.com/expressjs/cors
import cors from 'cors';
var corsOptions = {
    origin: ['http://localhost:9999', 'http://45.55.145.52:8000', 'http://localhost:8000'],
    credentials: true
};

var stats = {
    bytes_in: 0,
    bytes_out: 0,
    files: []
};


import Handshake from 'folders/src/handshake.js';
import Qs from 'qs';
import mime from 'mime';
import LocalFio from 'folders/src/folders-local.js';
import helpers from 'folders/src/util/helpers.js';

var HandshakeService = Handshake.HandshakeService;


var standaloneServer = function (argv, backend) {
    // a single static backend.
    this.backend = backend;
    this.annotate = new Annotation();
    //console.log(LocalFio);
    this.shadowFS = new LocalFio(); //create a shadow file system
    //console.log('shadow: ', this.shadow);
    /*
    this.shadow.ls('.', function(results) {
      for (var id in results) {
          console.log(results[id]);
      }
    });*/
    //this.annotate.reset(); //reset path on DB

    //FIXME
    this.configureAndStart(argv);

    /*
    this.shareId = ('shareId' in argv) ? argv['shareId'] : 'testshareid';

	*/

};

/*
 *
 * https://github.com/expressjs/compression#filter-1
 *
 */
function shouldCompress(req, res) {
    if (req.headers['x-no-compression']) {
        // don't compress responses with this request header
        return false;
    }

    // fallback to standard filter function
    return compression.filter(req, res);
};


var logger = function (req, res, next) {
    console.log("Timestamp : " + Date.now() + " " + req.method + " " + req.originalUrl);
    next();

};


standaloneServer.prototype.handshakeService = function (serverPublicKey, serverSecretKey) {
    var self = this;
    self.service = new HandshakeService();

    self.secured = true; //OK i'm in secure mode!
    //console.log('service = ', this.service);
    //FIXME: this should be loaded instead of generated
    if (serverPublicKey && serverPublicKey!='') {
      self.publicKey = serverPublicKey;
      //self.secretKey = serverSecretKey; //FIXME: not used for Intranet mode at the moment!
      self.keypair = {
        'publicKey': Handshake.decodeHexString(serverPublicKey),
        'secretKey': Handshake.decodeHexString(serverSecretKey)
      }
    }
    else {
      self.keypair = Handshake.createKeypair();
      self.publicKey = Handshake.stringify(self.keypair.publicKey);
    }

    console.log('>> Server : Public key: ', Handshake.stringify(self.keypair.publicKey));
    console.log('>> Server : Secret key: ', Handshake.stringify(self.keypair.secretKey));
    //console.log('>> Server : Public key: ', self.service.bob.publicKey);
    console.log('>> Server : Handshake service created');

};

/*
 *
 *
 */
standaloneServer.prototype.mountInstance = function (cb,clientUri) {
    var self = this;
	self.clientUri = clientUri;
	var addresses = findLocalIps();
	var localhost = addresses.length >= 1 ? addresses[0]:self.host;
	console.log('localhost = ', localhost);

    //if (self.clientUri) {

        publicIp.v4(function (err, ip) {

            var host = process.env.HOST == 'remote' ? ip : localhost;
            //FIXME:
            host = self.host;
            var port = self.port;

            var uri;
            if (self.secured){
		var alicePK = Handshake.stringify(self.service.bob.publicKey);
		console.log('service public key: ', alicePK);
		uri = self.clientUri + '/mount?instance=' + host + '&port=' + port + '&secured=' + self.secured + '&alice=' + alicePK;
            } else {
		uri = self.clientUri + '/mount?instance=' + host + '&port=' + port + '&secured=' + self.secured;
            }
            console.log(uri);

            http.get(uri, function (res) {
                var content = '';
                res.on('data', function (d) {
                    content += d.toString();
                });


                res.on('end', function () {
                    self.instanceId = JSON.parse(content).instance_id;
                    var instanceUrl = self.clientUri + '/instance/' + self.instanceId;
                    console.log("Browse files here -->" + instanceUrl);
                    return cb();
                });

                res.on('err', function (err) {

                    return cb(err);
                });


            });


        });

    /*
    } else {
        console.log('clientUri not defined, running Intranet mode');

        return cb();
    }
    */
};

standaloneServer.prototype.configureAndStart = function (argv) {
    var self = this;

    //Default argument are already set in folders-cli/src/cli.js
    argv = argv || {};
    var client = argv['client'];
    var clientPort = argv['clientPort'];
    var port = argv['listen'];
    var host = argv['host'];
    var compress = argv['compress'];
    var mode = argv['mode'];
    var log = argv['log'];
    var secured = argv['secured'];
    var userPublicKey = argv['userPublicKey'];

    var serverPublicKey = argv['serverPublicKey'];
    var serverSecretKey = argv['serverSecretKey'];

    self.instanceName = argv['instanceName'];

    var persisted = argv['persisted'];

    var serverBootStatus = '';

    if (!persisted) {
      self.annotate.reset();
    }

    console.log('client = ', client);

    if (compress == 'true') {

        // New call to compress content using gzip with default threshhold for
        // a file to be valid for compression is 1024 bytes
        app.use(compression({
            filter: shouldCompress
        }));
        serverBootStatus += '>> Server : Compression is On \n';
    } else {

        serverBootStatus += '>> Server : Compression is Off \n';
    }

    //FIXME: pass in bob's public key!
    self.secured = secured;
    if (secured) {
        self.userPublicKey = userPublicKey; //for Internet mode!
        self.handshakeService(serverPublicKey, serverSecretKey);
        serverBootStatus += '>> Server: Secured mode is On \n';
    }
    else {
        serverBootStatus += '>> Server: Secured mode is Off \n';
    }

    corsOptions.origin.push("http://" + host + ":" + clientPort);
    console.log('using CORS', corsOptions);
    app.use(cors(corsOptions));

    //app.use(express.static(__dirname + client));

    if (log == 'true') {

        app.use(logger);

        serverBootStatus += '>> Server : Logging is on \n';

    } else {

        serverBootStatus += '>> Server : Logging is off \n';
    }

    if (client) {
        serverBootStatus += '>> Mounted Client on http://'+host+':' + clientPort + '\n';

        if (secured) {
          self.instanceId = Handshake.stringify(Handshake.hash(self.keypair.publicKey)).substr(0, 32);
          //serverBootStatus += '>> Server Endpoint: http://localhost:' + clientPort + '/instance/' +  + '\n';
        }
        else {
          //serverBootStatus += '>> Server Endpoint: http://localhost:' + clientPort + '/instance/demo\n';
          self.instanceId = 'demo';
        }

        app_client = express();

        app_client.use(express.static(path.normalize(client)));

        //do this so that server still renders the site when accesssing from localhost:9999/instance/...
        app_client.use('/instance/*', express.static(path.normalize(client)));

        app_client.use('/g/*', express.static(path.normalize(client)));

        var clientServer = app_client.listen(clientPort, host, function() {
		serverBootStatus += '>> Server Endpoint: http://' + clientServer.address().address + ":" + clientServer.address().port + '/instance/' +  self.instanceId + '\n';

            var clientUrl = "http://" + clientServer.address().address + ":" + clientServer.address().port;
            if (corsOptions.origin[corsOptions.origin.length-1] != clientUrl){
                corsOptions.origin.push(clientUrl);
                console.log('using CORS', corsOptions);
            }
            console.log('Client mounted successfully!');
        });

    }
    /*
    else {

        app.get('/', function (req, res, next) {
            res.status(301).send("No Client Attached");
        });
    }
    */


    if ('DEBUG' != mode.toUpperCase()) {

        self.routerLive();

        serverBootStatus = '>> Server : Started in LIVE mode \n' + serverBootStatus;

    } else {

        self.routerDebug();
        serverBootStatus = '>> Server : Started in DEBUG mode \n' + serverBootStatus;

    }

    var server = app.listen(port, host, function () {

        self.host = server.address().address;
        self.port = server.address().port;

        if (!self.instanceName) {
          self.instanceName = self.host + ':' + self.port
        }
        serverBootStatus = '>> API Server : Listening at http://' + self.host + ":" + self.port + '\n' + serverBootStatus;
        console.log(serverBootStatus);
    });

    //    server.on('connection', function(socket) {
    //        Change this as you see fit. default 2 minutes in Node.
    //        socket.setTimeout(120 * 1000);
    //    })
};


standaloneServer.prototype.updateStats = function (cb) {
    var instanceId = this.instanceId;
	var self = this ;

    var body = stats;
    var headers = {

        'Content-type': 'application/json'
    };

    var options = {

        uri: self.clientUri + '/instance/' + instanceId + '/update_stats',
        method: 'POST',
        headers: headers,
        json: true,
        body: body
    };

    request(options, function (err, m, q) {
        if (err) {

            console.log("stats not updated");
            console.log(stats);
        } else if (q.success == false) {

            console.log("error" + q.error);
        } else {
            console.log(q);
        }

    });

};

standaloneServer.prototype.routerDebug = function () {
    var self = this,
        stub;
    var backend = self.backend;
    var annotate = self.annotate;

    //haipt: replaced this by cors module
    /*

    app.use(function (req, res, next) {

        res.header("Access-Control-Allow-Origin", "*");
        res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
        next();
    });
    */
    //NaCl request authorization middle-ware
    var authRequest = function(req, res, next) {
      console.log('authRequest');
      if (self.secured){
          ok = self.service.verifyRequest(req);
          if (!ok) {
            res.status(403).send("Unauthorized");
            return;
            //code
          }
        }
        next();
    }

    app.use(bodyParser.urlencoded({ extended: true }));

    app.get('/handshake', function (req, res) {
        //console.log('handshake: bob = ', self.service.bob);

        var token = req.query.token;
        console.log('token = ', token);

        var ok = false;

        if (self.userPublicKey) { //3-way handshake
          //FIXME: this should be passed in from console or from management page
          var userPublicKey = Handshake.decodeHexString(self.userPublicKey);

          token = Handshake.decodeHexString(token);
          token = Handshake.join([userPublicKey, token]);

          //expected: decoded input length is 72 bytes, first 24 bytes is nonce, last 48 bytes is signed public key
          console.log('token length: ', token.length);

          //422942744179B9600EBB2C9E4656BDB1FC6163A27A33C1C885B95C05C43F8B14

          //var pk = HandshakeService.decodeHexString('422942744179B9600EBB2C9E4656BDB1FC6163A27A33C1C885B95C05C43F8B14');
          //console.log('public key length: ', pk);

          //self.service.setUserPublicKey('');
          //combine user's public key with token
          //var nodeId = self.service.endpoint(userPublicKey);

          //try to unbox this token!?
          //FIXME: proper nodeId!?
          ok =  self.service.node('', token);
        }
        else {
          //var nodeId = Handshake.stringify(Handshake.hash(self.keypair.publicKey)).substr(0, 32);
          ok = self.service.node(self.instanceId, token);
        }

        if (!ok) {
          res.status(401).send('invalid token');
        }
        else {
          //OK!?
          res.status(200).json({ 'success' : true });
        }


        //var options = fio.createNode(self.service.bob);

        // sending Bob public key to client
        //res.send(options.body);


    });

    app.get('/dir/:shareId/*', authRequest, function (req, res, next) {
        var ok = true;
        //block this if i am in secured mode!?
        /*
        if (self.secured){
          ok = self.service.verifyRequest(req);
          if (!ok) {
            res.status(403).send("Unauthorized");
            return;
            //code
          }

          //res.status(401).send('Unauthorized');
          //FIXME: verify param
        }
        */
        //else {
        if (ok) {
          //code

          var shareId = req.params.shareId;

          //extra check if shareId matches with the instanceId for security
          /*
          if (shareId!=self.instanceId) {
            console.log('invalid shareId: ', shareId);
            res.status(401).send();
            return;
          }
          */

          // FIXME : appending of extra slash at end of path should be taken
          // care at backend itself
          var path = req.params[0] + '/';
          var path_no_slash = req.params[0];
          stub = function () {
              backend.ls(path, function (err, data) {
                  //FIXME: should return annotation & attachments info here as wel!?
                  //FIXME: check error!

                  //add in filter (starred) information for the data?

                  //FIXME: replace by using instanceId, also to remove your network
                  //var full_path = self.instanceName +  path.substring(0, path.length -1); //Note: no extra slash!
                  var annotationPath = self.instanceId + '/' + path_no_slash;

                  console.log('getting filter @', annotationPath);

                  annotate.getFilter(annotationPath, function(err, filter) {
                    if (err) {
                      console.log('get filter error: ', err);
                    }
                    else {
                      console.log('filter: ', filter);
                    }
                    var stub = data;
                    if (filter!='') {
                      var starred = JSON.parse(filter).starred;
                      console.log('starred:', starred);
                      for (ind in stub) {
                          console.log('f: ', stub[ind]);
                          if (starred.indexOf(stub[ind].name) >= 0) {
                            console.log('STARRED!');
                            stub[ind].starred = true;
                          }
                      }
                    }
                    res.status(200).json(stub);
                  })
              });
          }
        }
        next();
    });


    app.get('/dir/:shareId', function (req, res, next) {
        var shareId = req.params.shareId;
        var path = '/';

        //extra check if shareId matches with the instanceId for security
        /*
        if (shareId!=self.instanceId) {
          console.log('invalid shareId: ', shareId);
          res.status(401).send();
          return;
        }
        */

        stub = function () {
            backend.ls(path, function (err, data) {
                if (err) {

                    res.status(500).send({
                        error: err
                    });

                }
                else {
                  var stub = data;
                  res.status(200).json(stub);
                }
            });
        }
        next();
    });


    app.get('/file/:shareId/*', authRequest, function (req, res, next) {

        var shareId = req.params.shareId;
        // No extra slash at end of path in case of files
        // should be taken care at module itself
        var offset = req.query.offset;
        var length = req.query.length;
        var path = req.params[0];

        var catParam = path;
        if (typeof(offset) != 'undefined' || typeof(length) != 'undefined'){
            // range cat when provider support
            if (( backend.features && backend.features.range_cat) // for single provider
		    || backend.feature(path, 'range_cat') ) { // for union provider
            catParam = {
                path : path,
                offset : offset,
                length : length
            };
          }
        }

        stub = function () {
            backend.cat(catParam, function (err, result) {

                if (err) {


                    res.status(500).send({
                        error: err
                    });

                } else {
                    stats.bytes_out += parseInt(result.size);
                    stats.files.push({

                        'download': path.basename(path),
                        'datetime': Date.now(),
                        'size': result.size
                    });
                    self.updateStats();
                    res.setHeader('X-File-Name', result.name);
                    res.setHeader('X-File-Size', result.size);
                    res.setHeader('Content-Length', result.size);
                    res.setHeader('Content-disposition', 'attachment; filename=' + result.name);
                    res.setHeader('Content-type', mime.lookup(result.name));
                    //NOTES, sent header first.
                    //some src stream will overrider the content-type, content-length when pipe
                    res.writeHead(200);

                    result.stream.pipe(res);
                }

            });
        }
        next();
    });


    ///Allow user to add new annotation!
    app.post('/annotate', function(req, res) {
      var path = req.body.path || '';
      var note = req.body.note || '';
      console.log('annotate request: ', path, note);
      if (path == ''){
          //console.log('path not DEFINED');
          res.status(200).send({
                error: 'Path not defined!'
          });
          return;
      }
      annotate.addNote(path, note, function(err) {
        if (err) {
          res.status(200).send({
              error: err
          });
        }
        else {
          res.status(200).json({
            "success": true
          });
        };
      });
    });

    //Allow user to query annotation of a given path!
    app.get('/annotation', function(req, res) {
        var path = req.query.path;
        console.log('/annotation', path);
        if (path == ''){
            //console.log('path not DEFINED');
            res.status(200).json({
                  error: 'Path not defined!'
            });
            return;
        }
        annotate.getNote(path, function(err, note) {
          //ignore error, we do not really care!
          res.status(200).json({
            "success": true,
            "note": note
          })
        })
    });

    ///New API, allow user to add new attachment to a given path!
    ///We will write the file to a shadow file system
    app.post('/attach', function(req, res) {
        var path = req.query.path || '';
        console.log('attachment request @', path);

        //generate a random filename to save to
        //var fileName = helpers.getTmpFilename();

        //oops, why all the headers become low-case?!
        var orgFileName = req.headers['x-file-name'];
        var fileSize = req.headers['x-file-size'];
        var fileModifiedDate = req.headers['x-file-date'];

        console.log('headers: ', req.headers);


        console.log('file info', orgFileName, fileSize, fileModifiedDate);

        //var uri = 'tmp/random.tmp';
        var save_path = 'tmp/' + helpers.getTmpFilename();

        console.log('save path: ', save_path);

        //save the file to shadow file system
        self.shadowFS.write(save_path, req, function (err) {
            if (err) {
                res.status(500).send({
                    error: err
                });
            } else {
                //mark the database!
                annotate.addAttachment(path, orgFileName, fileSize, fileModifiedDate, save_path, function(err) {
                  if (err) {
                    console.log('failed to update database', err);
                    res.status(500).send({
                        error: err
                    });
                  }
                  else {
                    //return the updated attachment list so we can perform a refresh!
                    annotate.getAttachments(path, function(err, files) {
                      console.log('records: ', files)
                      files = files || [];
                      res.status(200).json({
                        "success": true,
                        "files": files
                      })
                    });
                  }
                })
            }
        });



        //update database record of the attachment
        /*
        res.status(200).json({
          "success": true
        });
        */
    });

    ///Allow user to query attachments on a given path!
    app.get('/attachments', function(req, res) {
        var path = req.query.path;
        console.log('/attachments', path);
        if (path == ''){
            //console.log('path not DEFINED');
            res.status(200).json({
                  error: 'Path not defined!'
            });
            return;
        }
        annotate.getAttachments(path, function(err, files) {
          console.log('records: ', files)
          res.status(200).json({
            "success": true,
            "files": files
          })
        });
    });


    ///When user wants to download an attachment
    app.get('/get_attachment', function(req, res, next) {
        //FIXME: use promise interface for cleaner
        //var saved_path = req.params[0];
        console.log('attachments download request');
        var saved_path = req.query.saved_path;
        console.log('saved_path: ', saved_path);
        stub = function () {
          //FIXME: check again with DB first!
          annotate.getAttachmentBySavedPath(saved_path, function(err, file) {
            if (!err) {
              self.shadowFS.cat(saved_path, function (err, result) {
                if (err) {
                    res.status(500).send({
                        error: err
                    });

                } else {
                    console.log('file found: ', file.file_name, result.size);
                    res.setHeader('X-File-Name', file.file_name); //use original file name
                    //res.setHeader('X-File-Name', 'abc.jpg');
                    res.setHeader('X-File-Size', result.size);
                    res.setHeader('Content-Length', result.size);
                    res.setHeader('Content-disposition', 'attachment; filename=' + file.file_name);
                    console.log('content type: ', mime.lookup(result.name));
                    res.setHeader('Content-type', mime.lookup(result.name));
                    //NOTES, sent header first.
                    //some src stream will overrider the content-type, content-length when pipe
                    res.writeHead(200);

                    result.stream.pipe(res);
                }
              });
            }
            else {
              res.status(500).send( {
                error : err
              });
            }
          });
      }
      next();
    })

    /* set file filters at a given location! */
    app.post('/set_filter', function(req, res) {

      var path = req.body.path || '';
      var files = req.body.files || [];

      var filter = JSON.stringify({'starred': files});

      console.log('set_filter request: ', path, filter);
      console.log('starred files count: ', files.length);
      if (path == ''){

          res.status(200).send({
                error: 'Path not defined!'
          });
          return;
      }
      annotate.setFilter(path, filter, function(err) {
        if (err) {
          res.status(200).send({
              error: err
          });
        }
        else {
          res.status(200).json({
            "success": true
          });
        };
      });
    });


    app.post('/signin', function (req, res) {

        var content = '';

        req.on('data', function (data) {
            content += data;
        });

        req.on('end', function () {
            var obj = Qs.parse(content);
            var username = obj.username;
            var password = obj.password;
            var keep = obj.keep;
            res.status(200).json({
                "success": true
            });
        });

    });

    app.options('/manually_upload_file', function (req, res) {
       console.log('OPTIONS cmd');
        var shareId = req.query.shareId;
        var fileId = req.query.fileId;
        res.status(200).end();
    });


    app.post('/manually_upload_file', function (req, res) {
        //console.log('POST cmd');
        var shareId = req.query.shareId;
        var fileId = req.query.fileId;
        var match = "web everything:web network:" + shareId + "/";
        var path = fileId.substr(match.length, fileId.length);
        var size = parseInt(req.headers['content-length']);


        stub = function () {


            backend.write(path, req, function (err) {

                if (err) {
                    res.status(500).send({
                        error: err
                    });
                } else {
                    stats.bytes_in += size;
                    stats.files.push({

                        'upload': path.basename(path),
                        'datetime': Date.now(),
                        'size': size
                    });

                    self.updateStats();

                    res.status(200).json({
                        'success': true
                    });
                }
            })
        }

    });

    app.options('/upload_file', function (req, res) {

        var fileId = req.query.fileId;
        res.status(200).end();
    });


    app.post('/upload_file', function (req, res, next) {
        console.log("got it");

        var fileId = req.query.fileId;
        if (fileId[0] != '/')
            fileId = '/' + fileId;
        var size = parseInt(req.headers['content-length']);

        stub = function () {
            var path = fileId;

            backend.write(path, req, function (err) {

                if (err) {
                    res.status(500).send({
                        error: err
                    });

                } else {
                    stats.bytes_in += size;
                    stats.files.push({

                        'upload': path.basename(path),
                        'datetime': Date.now(),
                        'size': size
                    });
                    self.updateStats();
                    res.status(200).json({
                        'success': true
                    });
                }
            })
        }

        next();

    });

    app.post('/clear_file', authRequest, function (req, res, next) {
      var shareId = req.body.shareId;
      var fileId = req.body.fileId;

      //console.log('clear_file, fileId = ', fileId)
      backend.unlink(fileId, function (err, data) {

          if (err) {
              res.status(500).json({
                  "success": false
              });

          } else {

              res.status(200).json({
                  "success": true
              });
          }
      });
      /*
        stub = function () {
            var content = '';

            req.on('data', function (data) {
              console.log('req data');
                content += data;
            });

            req.on('end', function () {
               console.log('req end');
                var obj = Qs.parse(content);
                var shareId = obj.shareId;
                var fileId = obj.fileId;

                backend.unlink(fileId, function (err, data) {

                    if (err) {

                        res.status(500).json({
                            "success": false
                        });

                    } else {

                        res.status(200).json({
                            "success": true
                        });
                    }
                });


            });
        }
        next();
        */
    });

    app.post('/set_files', function (req, res, next) {
        //FIXME: Return set_files from backend!
        stub = stubApp.getStubSetFiles();
        next();

    });

    app.get('/stats', function (req, res, next) {

        stub = function () {
            res.status(200).json(stats);
        }
        next();

    });

    app.get('/get_share', function (req, res, next) {

        stub = stubApp.getStubGetShare();
        next();

    });

    app.get('/session', function (req, res, next) {
        stub = stubApp.getStubSession(res);
        next();
    });

    app.get('/session/', function (req, res, next) {
        stub = stubApp.getStubSession(res);
        next();
    });

    // Event source
    app.get('/json', function (req, res, next) {

      if (req.headers.accept && req.headers.accept == 'text/event-stream') {
        // send the event-stream response header,
        res.writeHead(200, {
          'Content-Type': 'text/event-stream;charset=UTF-8',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive'
        });

        //set the timeout for event-stream socket. default 120 seconds is not enough.
        req.socket.setTimeout(0x7FFFFFFF);

        // send a stub keep-alive message
        stub = stubApp.getStubJson();
        res.write("data: " + JSON.stringify(stub) + '\n\n');

        // keep the connection alive.
        // next();

        // NOTES cache their connection
        // connections.push(res);
        // NOTES use the res.write() to continue send message to client when have new message.

        //// Example sending keep-alive message intervals.
        // setInterval(function() {
        // var data = stubApp.getStubJson();
        // res.write("data: " + JSON.stringify(data) + '\n\n');
        // }, 300*1000);

      }else{

        stub = stubApp.getStubJson();
        res.status(200).end(stub);
      }

    });

    // Long pull
    app.get('/signal_poll', function (req, res, next) {

        stub = stubApp.getStubSignalPoll();
        next();

    });

    app.get('/terms', function (req, res, next) {

        stub = stubApp.getStubDefault();
        next();

    });

    app.get('/instance/:instanceId/*', function(req, res, next) {


      var instanceId = req.params.instanceId;

      if (instanceId!=self.instanceId) {
        console.log('Invalid instance Id');
        res.status(401).send();
        return;
      }
      console.log('instanceId: ', instanceId);

      //if this instanceId does not match our instanceId we should just quit!?



      //FIXME: handle case for secured!
      //FIXME: hardcoded!
      stub = {"success": true,
        "instance": {
          "instance_id": instanceId,
          "mount_ip": "0.0.0.0",
          "mount_port": self.port,//"9999",
          "mount_name": self.instanceName,
          "user_name": null,
          "bytes_in": 0, "bytes_out": 0,
          "files": null,
          "secured": self.secured,
        }
      }
      /*
      if (self.secured) {
        //generate session key pair and return the private session key in stub as well!
        var sessionKeyPair = self.service.generateSessionKey();
        stub.instance["sessionPrivateKey"] = sessionKeyPair.secretKey;
        console.log('session secret key:', sessionKeyPair.secretKey);
      }*/
      next();
    });


    app.use(function (req, res, next) {
        // In case  'backend' is used
        //res.header("Access-Control-Allow-Origin", "*");
        //res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");


        if (typeof (stub) == "function") { //send back only when we have response
            stub();
        } else if (typeof(stub)!='undefined') {
            //console.log('sending stub: ', stub);
            res.status(200).json(stub);
        }
    });
};

//FIXME: routerLive does not seem to be in use anymore!
standaloneServer.prototype.routerLive = function () {

    var self = this;


    app.use(function (req, res, next) {
        console.log('Time:', Date.now());
        next();
    });



    /*
     * FIXME:implement proper endpoint to
     *  initiate handshake protocol
     */
    app.get('/handshake', function (req, res) {


        console.log('handshake: bob = ', self.service.bob);

        //var options = fio.createNode(self.service.bob);

        // sending Bob public key to client
        //res.send(options.body);

    });

    //FIXME: quick hack to handle PUT request for handshake
    app.put('/*', function (req, res) {

        var uri = req.path;
        var content = '';

        req.on('data', function (data) {

            content += data.toString();

        });

        req.on('end', function () {

            console.log('parsed content: ', content, typeof (content));
            var endpoint = uri.substring(1);

            if (typeof (content) != 'string') {
                console.log('invalid request!');
                res.writeHead(301);
            }

            content = Handshake.decodeHexString(content);
            //convert public key back to Uint8Array

            var resp = self.service.node(endpoint, content);
            if (resp) {
                console.log('request succeeded!')
                    //response.content = this.publicKey;
                    //response.end(200, this.publicKey);
                res.writeHead(200);
                res.end(self.publicKey);
            } else {
                //conn.status = 301;
                //response.end(301);
                console.log('invalid request!');
                res.writeHead(301);
                res.end();
            }

        });

        return;

    });

    app.post('/*', function (req, res) {

        //check if this is a handshaked session


        var uri = req.path.substring(1);

        console.log('POST', uri);
        rx = /^[0-9a-z]{64}\/(.+)$/;
        var match = rx.exec(uri);

        if (match != null && match.length >= 2) {
            var endpoint = uri.substring(0, 64);
            var path = match[1];
            //console.log('Matched group: ', match[1]);
            var content = '';
            req.on('data', function (data) {

                content += data.toString();

            });
            req.on('end', function () {

                content = JSON.parse(content);

                var signature = content['sign'];
                console.log('content: ', content);
                //test signature

                if (self.service.verifyRequest(endpoint, path, signature)) {
                    res.writeHead(200);
                    res.end(); //OK!
                } else {
                    console.log('invalid signature');
                    response.writeHead(301);
                    response.end();
                }
                //console.log('parsed content: ', content, typeof(content));

            });

            return;
        } else {
            console.log("not our request");
        }


    });

    app.post('/set_files', function (req, res) {

        var content = '';
        req.on('data', function (data) {

            content += data.toString();

        });


        req.on('end', function () {


            var obj = Qs.parse(content);

            if (obj.shareId.length == 0) {

                //As per old java api
                // FIXME:Create a new share or possibly use
                // fio.createNode.Not sure

            } else {

                // updating old share as per old java api

            }

        });

    });

    /*




  //FIXME: check provider.js again as getCurrentSession is not exported properly
  var currentSession = self.routeHandler.getCurrentSession();
  // currentToken

  // FIXME: Later.
  if(!currentSession) {
    response.end();
    return;
  }


// FIXME: Currently serving one route at the moment when proxying upstream.
  var currentToken = currentSession.token;
  var currentShareName = currentSession.shareName;
  var currentShareId = currentSession.shareId;



  // NOTES: restHandler will handle requests internally, the subsequent methods simply proxy requests to another server.


  var requestId = helpers.uuid();
  var result = restApp(conn, requestId,this.shareId);
  if(result) {
	console.log("sending a data packet through.");
	var streamId = result.data.streamId || result.streamId;
	self.routeHandler.once(streamId, function(stream, headers) {
	console.log("response", streamId, headers);
	// NOTES: Bug in the client, it tries to deserialize twice.
	if(headers) delete headers['Content-Type'];
		response.writeHead(200, headers);
		return stream.pipe(response);

	});

    // Request could be self-served from a provider or from a listening json stream.
	self.routeHandler.send(result);
	return result;

  }


  if(request.method == "GET") {

	// FIXME: These are still tuned to having one active shareId; the initial point of this proxy.
	// Scope has increased to handling multiple active shareIds.
	// Event stream.
	if(request.url.substr(0,5) == "/json") {
		var listen = {};
		// Listen for events from one ID:
		if(false) {
			eventFriendly(request, response, listen, currentShareId);
			// uses a global, passes to a submodule, broken.
			proxyListRequest = listen.onList;
			proxyBlobRequest = listen.onBlob;
			listen.onClose = function() { proxyListRequest = proxyBlobRequest = null; };
		}
			var shareId = eventFriendly(request, response, listen);
			self.routeHandler.until(shareId, listen);
		}

		else {
			defaultFriendly(request, response);
		}
		return;
	}

	*/
    app.get('/json', function (req, res) {

    });

    app.get('get_share', function (req, res) {

    });

    app.get('/file/:id', function (req, res) {

    });


    app.get('/terms', function (req, res) {

    });


    app.get('/dir/:id', function (req, res) {

    });

    app.get('/press', function (req, res) {

    });

};

var strToArr = function (str) {
    var arr = [];
    for (var i = 0, j = str.length; i < j; ++i) {
        arr.push(str.charCodeAt(i));
    }
    return new Uint8Array(arr);
};

var findLocalIps = function(){

	var interfaces = os.networkInterfaces();
	var addresses = [];
	for (var k in interfaces) {
	for (var k2 in interfaces[k]) {
		var address = interfaces[k][k2];
		if (address.family === 'IPv4' && !address.internal) {
		addresses.push(address.address);
		 }
	}
	}

return addresses;

};

export default standaloneServer;
