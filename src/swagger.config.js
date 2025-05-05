const swaggerJsdoc = require('swagger-jsdoc');

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Investment Platform API Documentation',
      version: '1.0.0',
      description: `
        Complete API documentation for the investment platform with Binance integration.
        Features include user management, multi-wallet system, investments, deposits/withdrawals,
        and referral program.
      `,
      contact: {
        name: 'API Support',
        email: 'support@yourplatform.com'
      },
      license: {
        name: 'MIT',
        url: 'https://opensource.org/licenses/MIT'
      }
    },
    servers: [
      {
        url: 'http://localhost:3000',
        description: 'Development server'
      },
      {
        url: 'https://api.yourplatform.com',
        description: 'Production server'
      }
    ],
    tags: [
      { name: 'Auth', description: 'Authentication endpoints' },
      { name: 'Wallet', description: 'Wallet management' },
      { name: 'Investment', description: 'Investment operations' },
      { name: 'Deposit', description: 'Deposit management' },
      { name: 'Withdrawal', description: 'Withdrawal operations' },
      { name: 'Referral', description: 'Referral system' },
      { name: 'Admin', description: 'Admin operations' },
      { name: 'KYC', description: 'KYC verification' }
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT'
        }
      },
      schemas: {
        User: {
          type: 'object',
          properties: {
            userId: { type: 'string', format: 'uuid' },
            fullName: { type: 'string' },
            email: { type: 'string', format: 'email' },
            phoneNumber: { type: 'string' },
            accountStatus: { type: 'string', enum: ['pending', 'active', 'suspended'] }
          }
        },
        Wallet: {
          type: 'object',
          properties: {
            walletId: { type: 'string', format: 'uuid' },
            type: { type: 'string', enum: ['account', 'trading', 'referral'] },
            balance: { type: 'number' },
            lockedBalance: { type: 'number' }
          }
        },
        Investment: {
          type: 'object',
          properties: {
            investmentId: { type: 'string', format: 'uuid' },
            amount: { type: 'number' },
            profit: { type: 'number' },
            status: { type: 'string', enum: ['active', 'completed', 'withdrawn'] }
          }
        },
        Transaction: {
          type: 'object',
          properties: {
            transactionId: { type: 'string', format: 'uuid' },
            type: { type: 'string', enum: ['deposit', 'withdrawal'] },
            amount: { type: 'number' },
            status: { type: 'string' },
            binanceTxId: { type: 'string' }
          }
        }
      }
    }
  },
  apis: [
    './authentication/src/routes/*.js',
    './authentication/src/routes/*/*.js',
    './authentication/src/controllers/*.js',
    './Investment/src/routes/*.js',
    './Investment/src/controllers/*.js'
  ]
};

const swaggerSpec = swaggerJsdoc(options);

module.exports = swaggerSpec;