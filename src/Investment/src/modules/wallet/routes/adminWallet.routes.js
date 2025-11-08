'use strict';

const { Router } = require('express');
const { AdminWalletController } = require('../controllers/adminWallet.controller');

function createAdminWalletRouter({ walletService, adminAuthenticate, logger = console }) {
    if (!walletService) throw new Error('createAdminWalletRouter requires walletService');
    if (!adminAuthenticate) throw new Error('createAdminWalletRouter requires adminAuthenticate middleware');

    const router = Router();
    const controller = new AdminWalletController({ walletService, logger });

    // Admin wallet monitoring
    router.get('/users', adminAuthenticate, controller.getAllUsers);
    router.get('/users/:userId', adminAuthenticate, controller.getUserWallet);
    router.get('/transfers', adminAuthenticate, controller.getAllTransfers);
    router.get('/locked', adminAuthenticate, controller.getLockedFunds);
    router.get('/stats', adminAuthenticate, controller.getWalletStats);

    return router;
}

module.exports = { createAdminWalletRouter };
