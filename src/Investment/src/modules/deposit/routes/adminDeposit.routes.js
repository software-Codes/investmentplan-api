'use strict';

const { Router } = require('express');
const { AdminDepositController } = require('../controllers/adminDeposit.controller');

function createAdminDepositRouter({ depositService, adminAuthenticate, logger }) {
    if (!depositService) throw new Error('createAdminDepositRouter requires depositService');
    if (!adminAuthenticate) throw new Error('createAdminDepositRouter requires adminAuthenticate middleware');

    const router = Router();
    const controller = new AdminDepositController({ depositService, logger });

    // Admin only - fetch all Binance deposits
    router.get('/binance', adminAuthenticate, controller.listBinanceDeposits);
    
    // Admin only - fetch all user deposits from database
    router.get('/users', adminAuthenticate, controller.listUserDeposits);

    return router;
}

module.exports = { createAdminDepositRouter };
