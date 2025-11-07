'use strict';

/**
 * Deposit routes
 *
 * Secured with user auth middleware.
 * If you later add admin-only endpoints, chain adminAuth on those routes.
 */

const { Router } = require('express');
const { DepositController } = require('../controllers/deposit.controller');
const { DepositInstructionsController } = require('../controllers/depositInstructions.controller');

function createDepositRouter({ depositService, authenticate, logger }) {
    if (!depositService) throw new Error('createDepositRouter requires depositService');
    if (!authenticate) throw new Error('createDepositRouter requires authenticate middleware');

    const router = Router();
    const controller = new DepositController({ depositService, logger });
    const instructionsController = new DepositInstructionsController({ logger });

    // Public endpoint - no auth required
    router.get('/instructions', instructionsController.getInstructions);

    // Protected endpoints - require authentication
    router.post('/submit', authenticate, controller.submit);
    router.get('/status/:txId', authenticate, controller.status);

    // Example (future) admin-only route:
    // router.get('/admin/recent', authenticate, adminAuthenticate, controller.adminListRecent);

    return router;
}

module.exports = { createDepositRouter };
