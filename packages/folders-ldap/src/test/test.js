import test from 'node:test';
import assert from 'node:assert';
import FoldersLdap from '../folders-ldap.js';

test('FoldersLdap', async (t) => {
  await t.test('should instantiate with a valid connection string', () => {
    const foldersLdap = new FoldersLdap('ldap', {
      connectionString: 'ldap://localhost:389',
    });
    assert.ok(foldersLdap);
  });
});
