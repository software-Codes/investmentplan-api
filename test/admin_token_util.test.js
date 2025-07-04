const assert = require('assert');
const { describe, it } = require('node:test');
const jwt = require('jsonwebtoken');
const { generateAdminToken } = require('../src/authentication/src/utils/admin/token.util');

process.env.JWT_SECRET = 'test-secret';

describe('generateAdminToken', () => {
  it('encodes admin details in the token', () => {
    // sample admin record
    const admin = { admin_id: '123', email: 'a@test.com', role: 'super' };

    const token = generateAdminToken(admin);
    // decode the token using our jwt stub
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // verify payload fields
    assert.strictEqual(decoded.sub, admin.admin_id);
    assert.strictEqual(decoded.email, admin.email);
    assert.strictEqual(decoded.role, admin.role);
    assert.strictEqual(decoded.type, 'admin');
  });
});
