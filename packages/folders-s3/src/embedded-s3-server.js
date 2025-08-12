import S3rver from "s3rver";

class Server {
  constructor(conn, debug) {
    this.S3Conn = conn;
    this.debug = debug || true;
    this.s3Server = null;
    console.log("[S3 Server] : inin the S3 Server,");
  }

  close() {
    if (this.s3Server != null) {
      // no function provided to close the s3erver
    }
  }

  start(backend) {
    this.s3Server = new S3rver(this.S3Conn).run(function (err, host, port) {
      if (err) {
        console.log(err);
      }
      console.log("aws s3 test server running at : " + host + ":" + port);
    });
  }
}

export default Server;
