import { test, before, after, mock } from "node:test";
import assert from "node:assert";
import FoldersLdap from "../folders-ldap.js";
import ldap from "ldapjs";
import { Readable } from "stream";

let foldersLdap;

before(() => {
  const mockLdapClient = {
    search: async function* (base, options) {
      yield {
        dn: "cn=foo,o=example",
        foldersio: JSON.stringify({ name: "foo" }),
      };
      yield {
        dn: "cn=bar,o=example",
        foldersio: JSON.stringify({ name: "bar" }),
      };
    },
    add: async (dn, entry) => {
      return;
    },
  };

  mock.method(ldap, "createClient", () => mockLdapClient);

  foldersLdap = new FoldersLdap("ldap", {
    connectionString: "ldap://localhost:389",
  });
});

after(() => {
  mock.restoreAll();
});

test("FoldersLdap unit tests", async (t) => {
  await t.test("should list entries", async () => {
    const entries = await foldersLdap.ls("/");
    assert.ok(Array.isArray(entries));
    assert.strictEqual(entries.length, 2);
    assert.strictEqual(entries[0].name, "foo");
  });

  await t.test("should cat entries", async () => {
    const { stream, size } = await foldersLdap.cat("/");
    assert.ok(stream);
    assert.ok(size > 0);
  });

  await t.test("should write an entry", async () => {
    const stream = new Readable();
    stream.push("some data");
    stream.push(null);
    const result = await foldersLdap.write("/", stream);
    assert.strictEqual(result, "write uri success");
  });
});
