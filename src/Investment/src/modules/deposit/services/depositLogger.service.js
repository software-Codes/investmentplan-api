'use strict';

const { MongoClient } = require('mongodb');

class DepositLoggerService {
    constructor() {
        this.client = null;
        this.db = null;
        this.collection = null;
        this.isConnected = false;
    }

    async connect() {
        if (this.isConnected) return;

        try {
            const uri = process.env.MONGODB_URI;
            if (!uri) {
                console.warn('[DepositLogger] MONGODB_URI not set, logging disabled');
                return;
            }

            this.client = new MongoClient(uri);
            await this.client.connect();
            this.db = this.client.db(process.env.MONGODB_DB_NAME || 'investmentplan');
            this.collection = this.db.collection('deposit_logs');
            this.isConnected = true;
            console.log('[DepositLogger] Connected to MongoDB');
        } catch (err) {
            console.error('[DepositLogger] Connection failed:', err.message);
        }
    }

    async createLog({ userId, userName, userEmail, txId }) {
        if (!this.isConnected) return null;

        try {
            const result = await this.collection.insertOne({
                userId,
                userName,
                userEmail,
                txId,
                depositId: null,
                stages: [],
                status: 'in_progress',
                startedAt: new Date(),
                completedAt: null,
                environment: process.env.NODE_ENV || 'development'
            });
            return result.insertedId.toString();
        } catch (err) {
            console.error('[DepositLogger] Create log failed:', err.message);
            return null;
        }
    }

    async addStage({ logId, stage, status, data = {}, error = null }) {
        if (!this.isConnected || !logId) return;

        try {
            const stageEntry = {
                stage,
                status,
                data,
                error: error ? { 
                    message: error.message, 
                    code: error.code,
                    description: this._getErrorDescription(error.code)
                } : null,
                timestamp: new Date()
            };

            await this.collection.updateOne(
                { _id: require('mongodb').ObjectId.createFromHexString(logId) },
                { 
                    $push: { stages: stageEntry },
                    $set: { 
                        status: status === 'error' ? 'failed' : status === 'success' && stage === 'DEPOSIT_COMPLETED' ? 'completed' : 'in_progress'
                    }
                }
            );
        } catch (err) {
            console.error('[DepositLogger] Add stage failed:', err.message);
        }
    }

    async updateDepositId({ logId, depositId }) {
        if (!this.isConnected || !logId) return;

        try {
            await this.collection.updateOne(
                { _id: require('mongodb').ObjectId.createFromHexString(logId) },
                { $set: { depositId, completedAt: new Date() } }
            );
        } catch (err) {
            console.error('[DepositLogger] Update depositId failed:', err.message);
        }
    }

    _getErrorDescription(code) {
        const descriptions = {
            'ERR_TXID_INVALID': 'Transaction hash format is invalid. Must be 66 characters starting with 0x.',
            'ERR_TXID_ALREADY_CLAIMED': 'This transaction has already been claimed by another user.',
            'ERR_TXID_NOT_FOUND': 'Transaction not found in Binance deposit history within the last 90 days.',
            'ERR_ADDRESS_MISMATCH': 'Deposit was sent to incorrect address. Must match platform deposit address.',
            'ERR_PENDING_CONFIRMATION': 'Transaction is pending blockchain confirmation. Please wait and try again.',
            'ERR_PROVIDER_STATUS': 'Deposit status on Binance is not SUCCESS. Cannot credit failed deposits.',
            'ERR_AMOUNT_OUT_OF_RANGE': 'Deposit amount is below minimum ($10) or above maximum allowed.',
        };
        return descriptions[code] || 'An unexpected error occurred during deposit processing.';
    }

    async close() {
        if (this.client) {
            await this.client.close();
            this.isConnected = false;
        }
    }
}

module.exports = { DepositLoggerService };

module.exports = { DepositLoggerService };
