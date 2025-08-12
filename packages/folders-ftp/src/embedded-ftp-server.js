/*
 * Here we implement a simple Ftp server.
 * The FTP Server listen on a localhost address.
 */
import ftpd from "ftpd";
import { fileURLToPath } from "url";
import path from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class Server {
  constructor(credentials) {
    this.FTPCredentials = credentials;
    this.ftpServer = null;
  }

  close() {
    if (this.ftpServer) {
      this.ftpServer.close();
    }
  }

  start(backend) {
    const FTPCredentials = this.FTPCredentials;
    if (FTPCredentials.host === "localhost") {
      const server = new ftpd.FtpServer("127.0.0.1", {
        getInitialCwd: () => "/",
        getRoot: () => {
          if (backend) return "/";
          return path.join(__dirname, "../test");
        },
        useReadFile: false,
        useWriteFile: false,
      });

      server.on("client:connected", (conn) => {
        let username;
        conn.on("command:user", (user, success, failure) => {
          username = user;
          if (user === FTPCredentials.user) {
            success();
          } else {
            failure();
          }
        });
        conn.on("command:pass", (pass, success, failure) => {
          if (pass === FTPCredentials.pass) {
            if (backend) {
              server.emit("backend", backend);
            }
            success(username, backend);
          } else {
            failure();
          }
        });
      });

      server.listen(FTPCredentials.port);
      this.ftpServer = server;
    }
  }
}

export default Server;
