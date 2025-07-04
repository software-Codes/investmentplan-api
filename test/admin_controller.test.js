const assert = require('assert');
const { describe, it } = require('node:test');
const jwt = require('jsonwebtoken');

const AdminController = require('../src/authentication/src/controllers/admin/admin.controller');
const Admin = require('../src/authentication/src/models/admin/Admin');

process.env.JWT_SECRET = 'test-secret';

describe('AdminController.login', () => {
  it('returns token on successful login', async () => {
    // stub credential validation to succeed
    Admin.validateCredentials = async () => ({
      isValid: true,
      admin: { admin_id: '1', full_name: 'Admin', email: 'a@test.com', role: 'admin' }
    });

    const req = { body: { email: 'a@test.com', password: 'pass' } };
    const res = { status(code){ this.code = code; return this; }, json(payload){ this.body = payload; } };

    await AdminController.login(req, res, () => {});

    // ensure success response
    assert.strictEqual(res.code, 200);
    assert.strictEqual(res.body.success, true);
    // decode token using our jwt stub
    const decoded = jwt.verify(res.body.data.token, process.env.JWT_SECRET);
    assert.strictEqual(decoded.sub, '1');
  });

  it('returns 401 for invalid credentials', async () => {
    Admin.validateCredentials = async () => ({ isValid: false, admin: null });

    const req = { body: { email: 'a@test.com', password: 'bad' } };
    const res = { status(code){ this.code = code; return this; }, json(payload){ this.body = payload; } };

    await AdminController.login(req, res, () => {});

    assert.strictEqual(res.code, 401);
    assert.strictEqual(res.body.success, false);
  });
});
