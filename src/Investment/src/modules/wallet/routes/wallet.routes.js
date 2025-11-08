'use strict';

const { Router } = require('express');
const { WalletController } = require('../controllers/wallet.controller');

function createWalletRouter({ transferService, walletService, authenticate, logger = console }) {
    if (!transferService || !walletService) throw new Error('createWalletRouter requires services');
    if (!authenticate) throw new Error('createWalletRouter requires authenticate middleware');

    const router = Router();
    const controller = new WalletController({ transferService, walletService, logger });

    // User wallet operations
    router.post('/transfer', authenticate, controller.transfer);
    router.get('/balances', authenticate, controller.balances);
    router.get('/transfers', authenticate, controller.transferHistory);
    router.get('/transactions', authenticate, controller.transactionHistory);
    router.get('/locked', authenticate, controller.lockedFunds);

    return router;
}

module.exports = { createWalletRouter };
