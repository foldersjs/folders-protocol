/*
 * Here we implement a simple Ftp server.
 * The FTP Server listen on a localhost address.
 */


var Server = function(credentials) {
	this.ldapCredentials = credentials;
	this.ldapServer = null;
};

export default Server;

Server.prototype.close = function(){
	if (this.ldapServer != null){
		this.ldapServer.close();
	}
};


import ldap from 'ldapjs';
Server.prototype.start = function(backend) {
	var ldapServer = ldap.createServer();
	var config = this.ldapCredentials || {};

	console.log("start the LDAP Embedded server: ", config);
	ldapServer.listen(config.port || 1389, function() {
		console.log('ldapjs listening at ' + ldapServer.url);
	});

	// Root folder.
	ldapServer.search('dc=example', function(req, res, next) {
		// These have gone insane.
		// data, err
		backend.ls(".", function(err, data) {
			if(err) {
				console.log("DERP!!!", err);
				next(new ldap.OperationsError(JSON.stringify(err)));
				return;
			}

			for(var i = 0, x = data.length; i < x; i++) {
			var obj = {
				dn: req.dn.toString(),
				attributes: {
					objectclass: ['organization', 'top'],
					o: 'example',
					foldersio: JSON.stringify(data[i])
				}
			};
			// if (req.filter.matches(obj.attributes))
			res.send(obj);
			}

			res.end();
		});
	});

};

// (new Server()).start();
