'use strict';

const { MongoClient } = require('mongodb');

/**
 * AuditService
 * ------------
 * MongoDB-based audit logging for wallet operations with complete traceability.
 */

class AuditService {
    constructor({ db, logger = console } = {}) {
        this.db = db;
        this.log = logger;
        this.mongoClient = null;
        this.mongoDb = null;
        this.collection = null;
        this.isConnected = false;
        this._connectMongo();
    }

    async _connectMongo() {
        try {
            const uri = process.env.MONGODB_URI;
            if (!uri) return;

            this.mongoClient = new MongoClient(uri);
            await this.mongoClient.connect();
            this.mongoDb = this.mongoClient.db(process.env.MONGODB_DB_NAME || 'investmentplan');
            this.collection = this.mongoDb.collection('wallet_audit_logs');
            this.isConnected = true;
            this.log.info('[AuditService] Connected to MongoDB');
        } catch (err) {
            this.log.error('[AuditService] MongoDB connection failed:', err.message);
        }
    }

    async logTransfer(userId, payload) {
        this.log.info({ userId, ...payload }, 'AUDIT wallet transfer');

        // PostgreSQL audit (admin_actions)
        if (this.db) {
            try {
                await this.db.query(
                    `INSERT INTO admin_actions (user_id, action_type, action_meta, created_at)
                     VALUES ($1, $2, $3, NOW())`,
                    [userId, 'wallet_transfer', JSON.stringify(payload)]
                );
            } catch (e) {
                this.log.warn({ e }, 'PostgreSQL audit failed');
            }
        }

        // MongoDB detailed audit
        if (this.isConnected) {
            try {
                const { rows } = await this.db.query(
                    'SELECT full_name, email FROM users WHERE user_id = $1',
                    [userId]
                );
                const user = rows[0] || {};

                await this.collection.insertOne({
                    userId,
                    userName: user.full_name || 'Unknown',
                    userEmail: user.email || 'Unknown',
                    action: 'wallet_transfer',
                    transferId: payload.transferId,
                    fromWallet: payload.from,
                    toWallet: payload.to,
                    amount: payload.amount,
                    balances: payload.balances,
                    transferType: payload.transferType || 'principal',
                    lockedUntil: payload.lockedUntil || null,
                    timestamp: new Date(),
                    environment: process.env.NODE_ENV || 'development'
                });
            } catch (err) {
                this.log.warn({ err }, 'MongoDB audit failed');
            }
        }
    }

    async close() {
        if (this.mongoClient) {
            await this.mongoClient.close();
            this.isConnected = false;
        }
    }
}

module.exports = { AuditService };
