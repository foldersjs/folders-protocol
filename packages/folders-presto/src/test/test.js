import test from 'node:test';
import assert from 'node:assert';
import FoldersPresto from '../folders-presto.js';

test('FoldersPresto', async (t) => {
  await t.test('should instantiate with a valid configuration', () => {
    const foldersPresto = new FoldersPresto('presto', {
      host: 'localhost',
      port: 8080,
      user: 'test',
    });
    assert.ok(foldersPresto);
  });
});
