import ldap from "ldapjs";

class LdapServer {
  constructor(credentials) {
    this.ldapCredentials = credentials;
    this.ldapServer = null;
  }

  close() {
    if (this.ldapServer != null) {
      this.ldapServer.close();
    }
  }

  start(backend) {
    const ldapServer = ldap.createServer();
    const config = this.ldapCredentials || {};
    this.ldapServer = ldapServer;

    console.log("start the LDAP Embedded server: ", config);
    ldapServer.listen(config.port || 1389, function () {
      console.log("ldapjs listening at " + ldapServer.url);
    });

    ldapServer.search("dc=example", function (req, res, next) {
      backend.ls(".", function (err, data) {
        if (err) {
          console.log("DERP!!!", err);
          next(new ldap.OperationsError(JSON.stringify(err)));
          return;
        }

        for (let i = 0, x = data.length; i < x; i++) {
          const obj = {
            dn: req.dn.toString(),
            attributes: {
              objectclass: ["organization", "top"],
              o: "example",
              foldersio: JSON.stringify(data[i]),
            },
          };
          res.send(obj);
        }

        res.end();
      });
    });
  }
}

export default LdapServer;
