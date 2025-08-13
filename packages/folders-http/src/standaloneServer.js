import express from "express";
import bodyParser from "body-parser";
import request from "request";
import http from "http";
import path from "path";
import os from "os";
//var publicIp = require('public-ip');
import compression from "compression";
import stubApp from "./util/stubApp.js";
import Annotation from "./annotate.js";
import cors from "cors";
import Handshake from "folders/src/handshake.js";
import Qs from "qs";
import mime from "mime";
import LocalFio from "folders/src/folders-local.js";
import helpers from "folders/src/util/helpers.js";
import Nacl from "./util/stream-nacl.js";

const app = express();
const HandshakeService = Handshake.HandshakeService;

class StandaloneServer {
  constructor(argv, backend) {
    this.backend = backend;
    this.annotate = new Annotation();
    this.shadowFS = new LocalFio();
    this.configureAndStart(argv);
  }

  static shouldCompress(req, res) {
    if (req.headers["x-no-compression"]) {
      return false;
    }
    return compression.filter(req, res);
  }

  handshakeService(serverPublicKey, serverSecretKey) {
    this.service = new HandshakeService();
    if (serverPublicKey && serverPublicKey != "") {
      this.keypair = {
        publicKey: Handshake.decodeHexString(serverPublicKey),
        secretKey: Handshake.decodeHexString(serverSecretKey),
      };
    } else {
      //
      this.keypair = Handshake.createKeypair();
    }
    this.service.bob = this.keypair;
    this.publicKey = Handshake.stringify(this.keypair.publicKey);
    this.secured = true;
  }

  mountInstance(cb, clientUri) {
    this.clientUri = clientUri;
    const addresses = this.#findLocalIps();
    const localhost = addresses.length >= 1 ? addresses[0] : this.host;

    publicIp.v4((err, ip) => {
      let host = process.env.HOST == "remote" ? ip : localhost;
      host = this.host;
      const port = this.port;

      let uri;
      if (this.secured) {
        const alicePK = Handshake.stringify(this.service.bob.publicKey);
        uri = `${this.clientUri}/mount?instance=${host}&port=${port}&secured=${this.secured}&alice=${alicePK}`;
      } else {
        uri = `${this.clientUri}/mount?instance=${host}&port=${port}&secured=${this.secured}`;
      }

      http.get(uri, (res) => {
        let content = "";
        res.on("data", (d) => {
          content += d.toString();
        });
        res.on("end", () => {
          this.instanceId = JSON.parse(content).instance_id;
          return cb();
        });
        res.on("err", (err) => {
          return cb(err);
        });
      });
    });
  }

  configureAndStart(argv = {}) {
    const {
      client,
      clientPort,
      listen: port,
      host,
      compress,
      mode,
      log,
      secured,
      userPublicKey,
      serverPublicKey,
      serverSecretKey,
      instanceName,
      persisted,
    } = argv;

    let serverBootStatus = "";

    if (!persisted) {
      this.annotate.reset();
    }

    if (compress == "true") {
      app.use(compression({ filter: StandaloneServer.shouldCompress }));
      serverBootStatus += ">> Server : Compression is On \n";
    } else {
      serverBootStatus += ">> Server : Compression is Off \n";
    }

    this.secured = secured;
    if (secured) {
      this.userPublicKey = userPublicKey;
      this.handshakeService(serverPublicKey, serverSecretKey);
      serverBootStatus += ">> Server: Secured mode is On \n";
    } else {
      serverBootStatus += ">> Server: Secured mode is Off \n";
    }

    const corsOptions = {
      origin: [
        "http://localhost:9999",
        "http://45.55.145.52:8000",
        "http://localhost:8000",
        `http://${host}:${clientPort}`,
      ],
      credentials: true,
    };
    app.use(cors(corsOptions));

    if (log == "true") {
      app.use((req, res, next) => next());
      serverBootStatus += ">> Server : Logging is on \n";
    } else {
      serverBootStatus += ">> Server : Logging is off \n";
    }

    if (client) {
      serverBootStatus += `>> Mounted Client on http://${host}:${clientPort}\n`;

      if (secured) {
        this.instanceId = Handshake.stringify(
          Handshake.hash(this.keypair.publicKey),
        ).substr(0, 32);
      } else {
        this.instanceId = "demo";
      }

      const app_client = express();
      app_client.use(express.static(path.normalize(client)));
      app_client.use("/instance/*", express.static(path.normalize(client)));
      app_client.use("/g/*", express.static(path.normalize(client)));

      const clientServer = app_client.listen(clientPort, host, () => {
        serverBootStatus += `>> Server Endpoint: http://${clientServer.address().address}:${clientServer.address().port}/instance/${this.instanceId}\n`;
        const clientUrl = `http://${clientServer.address().address}:${clientServer.address().port}`;
        if (corsOptions.origin[corsOptions.origin.length - 1] != clientUrl) {
          corsOptions.origin.push(clientUrl);
        }
      });
    }

    if ("DEBUG" != mode.toUpperCase()) {
      this.routerLive();
      serverBootStatus =
        ">> Server : Started in LIVE mode \n" + serverBootStatus;
    } else {
      this.routerDebug();
      serverBootStatus =
        ">> Server : Started in DEBUG mode \n" + serverBootStatus;
    }

    const server = app.listen(port, host, () => {
      this.host = server.address().address;
      this.port = server.address().port;
      if (!this.instanceName) {
        this.instanceName = `${this.host}:${this.port}`;
      }
      serverBootStatus = `>> API Server : Listening at http://${this.host}:${this.port}\n${serverBootStatus}`;
    });
  }

  updateStats(cb) {
    const options = {
      uri: `${this.clientUri}/instance/${this.instanceId}/update_stats`,
      method: "POST",
      headers: { "Content-type": "application/json" },
      json: true,
      body: stats,
    };
    request(options, (err, m, q) => {});
  }

  routerDebug() {
    let stub;
    const backend = this.backend;
    const annotate = this.annotate;

    const authRequest = (req, res, next) => {
      if (this.secured) {
        const ok = this.service.verifyRequest(req);
        if (!ok) {
          return res.status(403).send("Unauthorized");
        }
      }
      next();
    };

    app.use(bodyParser.urlencoded({ extended: true }));

    app.get("/handshake", (req, res) => {
      let token = req.query.token;
      let ok = false;

      if (this.userPublicKey) {
        const userPublicKey = Handshake.decodeHexString(this.userPublicKey);
        token = Handshake.decodeHexString(token);
        token = Handshake.join([userPublicKey, token]);
        ok = this.service.node("", token);
      } else {
        ok = this.service.node(this.instanceId, token);
      }

      if (!ok) {
        res.status(401).send("invalid token");
      } else {
        const sessionKey =
          this.service.session[this.instanceId][
            this.service.session[this.instanceId].length - 1
          ];
        const sharedSecret = nacl.box.before(sessionKey, this.keypair.secretKey);
        if (!this.sharedSecrets) {
          this.sharedSecrets = {};
        }
        this.sharedSecrets[this.instanceId] = sharedSecret;
        res.status(200).json({ success: true });
      }
    });

    app.post("/set_files", (req, res) => {
      // TODO: Implement proper session management
      const shareId = "testshareid";
      const shareName = "testshare";
      const token = "testtoken";

      res.status(200).json({
        shareId,
        shareName,
        token,
        publicKey: this.publicKey,
      });
    });

    app.post("/upload_file", (req, res) => {
      const streamId = req.query.streamId;
      const sharedSecret = this.sharedSecrets[this.instanceId];
      const key = sharedSecret.slice(0, 32);
      const nonce = sharedSecret.slice(0, 16);
      const decryptor = new Nacl({ key, nonce, unbox: true });

      const decryptedStream = req.pipe(decryptor);

      // TODO: Do something with the decrypted stream
      decryptedStream.on("data", (chunk) => {
        // console.log('decrypted data:', chunk.toString());
      });

      res.status(200).send("OK");
    });
  }

  routerLive() {
    // ... routes from routerLive
  }

  #strToArr(str) {
    const arr = [];
    for (let i = 0, j = str.length; i < j; ++i) {
      arr.push(str.charCodeAt(i));
    }
    return new Uint8Array(arr);
  }

  #findLocalIps() {
    const interfaces = os.networkInterfaces();
    const addresses = [];
    for (const k in interfaces) {
      for (const k2 in interfaces[k]) {
        const address = interfaces[k][k2];
        if (address.family === "IPv4" && !address.internal) {
          addresses.push(address.address);
        }
      }
    }
    return addresses;
  }
}

export default StandaloneServer;
