const assert = require('assert');
const { describe, it } = require('node:test');
const { addTokenToBlacklist, isTokenBlacklisted } = require('../src/authentication/src/helpers/blacklist-auth');

describe('blacklist-auth helper', () => {
  it('adds and removes token after expiry', async () => {
    const token = 'testToken';
    addTokenToBlacklist(token, 1); // expire in 1 second
    assert.strictEqual(isTokenBlacklisted(token), true);
    await new Promise(res => setTimeout(res, 1100));
    assert.strictEqual(isTokenBlacklisted(token), false);
  });
});
