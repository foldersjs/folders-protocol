/*
 *
 * Folders.io provider: share an FTP endpoint.
 *
 */

var uriParse = require('url');
var ldap = require('ldapjs');

var FoldersLdap = function(prefix,options) {
	console.log('FoldersLdap');
	this.options = options || {};
	this.prefix = prefix;
	this.connectionString = options.connectionString;
	this.server = null;

	var enableEmbeddedServer = options.enableEmbeddedServer || false;
	if (enableEmbeddedServer) {
		var conn = parseConnString(this.connectionString);
		var Server = require('./folders-ldap-server');
		this.server = new Server(conn);
		this.server.start(options.backend);
	}
};

FoldersLdap.dataVolume = function(){
	return {RXOK:FoldersLdap.RXOK,TXOK:FoldersLdap.TXOK};
};

FoldersLdap.TXOK = 0 ;
FoldersLdap.RXOK = 0 ;
module.exports = FoldersLdap;

FoldersLdap.prototype.features = FoldersLdap.features = {
	cat : true,
	ls : true,
	write : true,
	server : true
};

FoldersLdap.prototype.prepare = function() {
	var self = this;
	if (typeof (self.ldap) != 'undefined' && self.ldap != null) {
		return self.ldap;
	}

	var connectionString = this.connectionString;
	var conn = parseConnString(connectionString);

	console.log("folders-ldap, conn to server",conn);

	var client = ldap.createClient({
		url: 'ldap://127.0.0.1:1389'
	});
	/*
	client.bind('cn=root', 'secret', function(err) {
		// Oh.
	});
	*/
	return client;
};

FoldersLdap.prototype.ls = function(path, cb) {
	var self = this;
	if (path!='.') {
		if (path.length && path.substr(0, 1) != "/")
			path = "/" + path;
		if (path.length && path.substr(-1) != "/")
			path = path + "/";
	}
	var cwd = path || "";
	self.ldap = this.prepare();
	// subOUsearcher.SearchScope = SearchScope.OneLevel

	var opts = {
		filter: '(objectclass=organization)',
		scope: 'one',
		paging: {
			pageSize: 250,
			pagePause: true
		},
		// sizeLimit: 200
	};

	// Streaming would be nice, but we do not support yet.
	// Drain the buffer.
	// self.ftp.ls(dirName, function(err, content) { }

	var queue = [];
	self.ldap.search('dc=example', opts, function(err, res) {
		if (err) {
			console.error(err);
			cb(null, err);
		}
		// console.log('ls START');
		res.on('searchEntry', function(entry) {
			queue.push(entry.object);
		});
		res.on('page', function(result, cb) {
			cb();
		});
		res.on('error', function(err) {
			console.error(err);
			cb(null, err);
		});
		res.on('end', function(result) {
			// console.log('ls DONE');
			// console.log('ls returns: ', self.asFolders(path, queue));
			cb(self.asFolders(path, queue));
		});
	});
	/*
	self.ftp.raw.cwd(path, function(err, data) {
		if (err){
			console.error(err);
			return cb(null,err);
		}
		self.ftp.ls(".", function(err, content) {
			if (err) {
				console.error(err);
				//return cb(null, err);
				return cb(err);
			}

			cb(null, self.asFolders(path, content));

			// FIXME there is a socket error when use this module after socket.end()
			// self.ftp.socket.end();
		});
	});
	*/
};

FoldersLdap.prototype.asFolders = function(dir, files) {
	// console.log('asFolders', dir, files);
	var out = [];
	for (var i = 0; i < files.length; i++) {
		var file = files[i];
		if(file.foldersio) file = JSON.parse(file.foldersio);
		var o = {
			name : file.name || file.dn
		};
		if (dir=='.')
			o.fullPath = "/" + file.name || file.dn;
		else
			o.fullPath = dir + (file.name || file.dn);

		//FIXME: restore prefix logic later
		//o.uri = "#" + this.prefix + o.fullPath;
		o.uri = o.fullPath;
		o.size = file.size || 0;

		//FIXME: does not look right here!
		o.extension = file.extension || "txt";
		o.type = file.type || "text/plain";
		if(file.modificationTime) o.modificationTime = file.modificationTime;

		if (file.type == '1') {
			o.extension = '+folder';
			o.type = "";
		}
		if (file.type == '2') {
			// symlink/redirection.
			o.extension = '+folder';
			o.type = "";
		}

		out.push(o);
	}
	return out;
};


FoldersLdap.prototype.cat = function(data, cb) {
	var self = this;
	var path = data;

	var dirName = path.substring(0,path.lastIndexOf("/")+1);
	var fileName = path.substring(path.lastIndexOf('/') + 1);
	console.log('dirName: ', dirName);
	console.log('fileName: ', fileName);

	self.ldap = this.prepare();

	var opts = {
		filter: '(objectclass=organization)',
		scope: 'sub',
		paging: {
			pageSize: 250,
			pagePause: true
		},
		// sizeLimit: 200
	};

	// Streaming would be nice, but we do not support yet.
	// Drain the buffer.
	// self.ftp.ls(dirName, function(err, content) { }

	var queue = [];
	self.ldap.search('o=example', opts, function(err, res) {
		if (err) {
			console.error(err);
			cb(null, err);
		}
		console.log('ls START');
		res.on('searchEntry', function(entry) {
			// Submit incoming objects to queue
			queue.push(entry);
		});
		res.on('page', function(result, cb) {
			// request next batch.
			cb();
		});
		res.on('error', function(resErr) {
			if (err) {
				console.error(err);
				cb(null, err);
			}
		});
		res.on('end', function(result) {
			console.log('ls DONE');
			var blob = JSON.stringify(queue);
			var Readable = require('stream').Readable;
			var file = { size: blob.length, name: "text.json" };
			var data = new Readable();
			data.push(blob);
			data.push(null);
			cb({
				stream: data,
				size: file.size,
				name: file.name,
				meta: { mime:"text/json", date: (0+new Date()) }
			});
		});
	});
};

FoldersLdap.prototype.write = function(uri, data, cb) {
	var self = this;
	self.ldap = this.prepare();
	data.on('data',function(d) {
		FoldersFtp.RXOK +=d.length;
	});

	// Incoming data must be JSON.
	// FIXME: Back-pressure/drain per JSON record.
	var entry = {
		cn: 'foo',
		sn: 'bar',
		email: ['foo@bar.com', 'foo1@bar.com'],
		objectclass: 'fooPerson'
	};
	// data, uri,
	// self.ldap.add(data, uri, function(err) {
	self.ldap.add('cn=foo, o=example', entry, function(err) {
		if (err) {
			console.error("File transferred failed,", err);
			return cb(null, err);
		}
		console.log("File transferred successfully!");
		cb("write uri success");
		/*
		client.unbind(function(err) {
		  assert.ifError(err);
		});
		*/
	});
};

FoldersLdap.prototype.dump = function(){
	return this.options;
};

var parseConnString = function(connectionString){
	var uri = uriParse.parse(connectionString, true);
	var conn = {
		host : uri.hostname || uri.host,
		port : uri.port || 389
	};
	if (uri.auth) {
		var auth = uri.auth.split(":", 2);
		conn.user = auth[0];
		if (auth.length == 2) {
			conn.pass = auth[1];
		}
	}
	conn.debugMode = true;

	return conn;
}
