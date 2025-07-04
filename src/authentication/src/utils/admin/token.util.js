const jwt = require('jsonwebtoken');
function generateAdminToken (admin)
{
    return jwt.sign(
        {
            sub: admin.admin_id,
            email: admin.email,
            role: admin.role,
            type: 'admin'
        },
        process.env.JWT_SECRET,
        {expiresIn: '24h'}
    )
}

module.exports = {generateAdminToken};