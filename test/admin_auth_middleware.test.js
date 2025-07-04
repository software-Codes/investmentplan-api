const assert = require('assert');
const { describe, it } = require('node:test');
const jwt = require('jsonwebtoken');
const { adminAuthenticate } = require('../src/authentication/src/middleware/admin/adminAuth.middleware');

process.env.JWT_SECRET = 'test-secret';

describe('adminAuthenticate middleware', () => {
  it('populates req.admin for a valid token', async () => {
    // create a valid token for our stubbed middleware
    const token = jwt.sign({ sub: '1', email: 'a@test.com', role: 'admin', type: 'admin' }, process.env.JWT_SECRET);

    const req = { headers: { authorization: `Bearer ${token}` } };
    const res = { status(){ return this; }, json(){ } };
    let called = false;

    await adminAuthenticate(req, res, () => { called = true; });

    assert.ok(called, 'next should be called');
    assert.deepStrictEqual(req.admin, {
      adminId: '1',
      email: 'a@test.com',
      role: 'admin',
      type: 'admin'
    });
  });

  it('responds with 401 for invalid token', async () => {
    const req = { headers: { authorization: 'Bearer invalid-token' } };
    let statusCode;
    const res = { status(code){ statusCode = code; return this; }, json(payload){ this.body = payload; } };

    await adminAuthenticate(req, res, () => {});

    assert.strictEqual(statusCode, 401);
    assert.strictEqual(res.body.success, false);
  });
});
