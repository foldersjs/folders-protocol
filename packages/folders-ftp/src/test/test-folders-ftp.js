var FoldersFtp = new require('../folders-ftp');

// This test suite will use a embedded localhost FTP server
// If you want to test against a remote server,
// simply change the `host` and `port` properties as well or specify the
// hostname.
var FTPCredentials = {
	// hostname : test-ftp-server
	host : "localhost",
	port : 3333,
	user : "test",
	pass : "123456"
};

// "ftp://user:123456@localhost:3333";
var FTPCredentialsConnString = "ftp://";
if (typeof (FTPCredentials.user) != 'undefined' && typeof (FTPCredentials.pass) != 'undefined') {
	FTPCredentialsConnString += FTPCredentials.user + ":" + FTPCredentials.pass + "@";
}
if (typeof (FTPCredentials.host) != 'undefined' && typeof (FTPCredentials.port) != 'undefined') {
	FTPCredentialsConnString += FTPCredentials.host + ":" + FTPCredentials.port;
} else if (typeof (FTPCredentials.hostname) != 'undefined') {
	FTPCredentialsConnString += FTPCredentials.hostname;
}

console.log("FTPCredentialsConnString",FTPCredentialsConnString);

// start the folder-ftp provider.
var ftp = new FoldersFtp("localhost-ftp",{
	connectionString: FTPCredentialsConnString,
	enableEmbeddedServer: true
});
// test file uri,
// TODO may want use a /tmp dir file or a special dir in codebase for
// testing.
var testFileUri = "/test.dat";

console.log("connect ftp server success");

// step 1: ls command, show the files in current dir
ftp.ls('/', function(data) {
	console.log("ftp server: ls /");
	console.log(data);

	// step 2: write command, put data to ftp server
	var buf = new Buffer((new Array(960 + 1)).join("Z"));
	ftp.write(testFileUri,data, function(data) {

		console.log("\nwrite buffer(960 Z) to the ftp server,result ",data);

		// step 3: cat command, get the file we put to ftp server
	//		var readReq = {
	//			data : {
	//				fileId : testFileUri,
	//				streamId : "test-stream-id",
	//			},
	//			shareId : "test-share-id"
	//		};
		ftp.cat(testFileUri, function(result) {
			console.log("\nget file on ftp server,result");
			console.log(data);

			var socket = result.data;
			// TODO consume socket stream here
			// var str = "";
			// socket.on("data", function(d) {str += d;});
			// socket.on("close", function(hadErr) {});
			console.log("\nclose the socket stream");
			socket.end();

			// stop the test ftp server
			// FIXME there still is a `Error: read ECONNRESET` in stop the server.
			if (server != null) {
				// server.stop();
				console.log("server close");
				server.close();
			}
		});
	});

});


// });
