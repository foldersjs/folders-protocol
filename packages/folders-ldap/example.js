var FoldersLdap = require('./src/folders-ldap');

var Fio = require('folders');
var FolderFs = Fio.fs();
var Provider = Fio.local(); // stub();
var backend = new Provider();

var ldap = new FoldersLdap("localhost-ldap", {
	connectionString: "ldap://localhost:1389",
	enableEmbeddedServer: true,
	backend: backend
});

// These two should match.
backend.ls('.', function(data) {
	// Crap.
	console.log("cool", data);
});

ldap.ls('.', function(data) {
	console.log("oh", data);
});

/*
ldap.ls('/test', function(data) {
	console.log('folder /test', data);
});
*/

/*
ldap.cat('/test/hello.txt', function(data, err) {
	if (data) {
		console.log('file name: ', data.name);
		console.log('file size: ', data.size);
		console.log('file content: ');
		data.stream.pipe(process.stdout);
	}
	else {
		console.log('error: ', err);
	}
});
*/
