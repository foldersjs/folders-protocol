/*
 * Here we implement a simple Ftp server.
 * The FTP Server listen on a localhost address.
 */


var Server = function(credentials){
	this.FTPCredentials = credentials;
	this.ftpServer = null;

	console.log("inin the FTP Embedded server,",credentials);
};

module.exports = Server;

Server.prototype.close = function(){
	if (this.sshServer != null){
		this.sshServer.close();
	}
};


Server.prototype.start = function(backend) {
	var FTPCredentials = this.FTPCredentials;
	console.log("start the FTP Embedded server,",FTPCredentials);
	//console.log("FTP Backend: ", backend);
	//console.log('readdir?' , typeof(backend.readdir));
	if (FTPCredentials.host === "localhost") {

		var ftpd = require("ftpd");
		ftpServer = ftpd;

		server = new ftpd.FtpServer('127.0.0.1', {
			getInitialCwd: function () {

				//FIXME: quickhack to test S#
				//if (backend)
				//	return '/S3/us-east-1/foldersio/';
				//else
				return '/';
			},
			getRoot: function () {
				// also sends conn string, may be better connect point.
				//console.log('getRoot __dirname: ', __dirname);
				if (backend)
					return '/';
				//else return process.cwd();
				//else return '/Users/hai/Websites/folders.io/folders-ftp/test'
				else  return __dirname + "/../test";
			},
			useReadFile:false,
			useWriteFile:false
		});


		server.on('client:connected', function(conn) {
			var username;
			// console.log(conn.socket.remoteAddress);
			conn.on('command:user', function(user, success, failure) {
				username = user;
				success();
				// failure();
			});
			conn.on('command:pass', function(pass, success, failure) {
				console.log('command:pass', pass);
				// FIXME: Flexibly handle backend.
				if (typeof(backend)!='undefined') {
					console.log("using backend", backend);
					//var mock = backend(username, pass);
					success(username, backend);
				}
				else {
					success(username);
				}

				// failure();
			});
		});

		server.listen(FTPCredentials.port);
	}
};
