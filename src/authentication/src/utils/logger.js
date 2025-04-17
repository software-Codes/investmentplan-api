//logging utility for authentication module to be used in in the controller and service

/**
 * @file logger.js
 * @description Advanced logging system with colored output, alerting, and user-friendly formatting
 * @implements Logging levels, audit trails, and response correlation
 */

const { createLogger, format, transports } = require('winston');
const chalk = require('chalk');
const util = require('util');
const { combine, timestamp, printf } = format;

// Custom color palette
const LOG_COLORS = {
    error: chalk.redBright,
    warn: chalk.yellowBright,
    info: chalk.cyanBright,
    debug: chalk.magentaBright,
    http: chalk.greenBright,
    alert: chalk.bgRed.whiteBright
};

// Custom format for console output
const consoleFormat = printf(({ level, message, timestamp, ...metadata }) => {
    const color = LOG_COLORS[level] || chalk.white;
    const symbol = {
        error: '⛔',
        warn: '⚠️',
        info: 'ℹ️',
        debug: '🐛',
        http: '🌐'
    }[level] || '➤';

    let logMessage = [
        `${chalk.gray(timestamp)}`,
        `${color(`${symbol} ${level.toUpperCase()}`)}:`,
        `${chalk.white(message)}`
    ].join(' ');

    if (metadata && Object.keys(metadata).length) {
        logMessage += `\n${chalk.gray('↳ ')}${util.inspect(metadata, { colors: true, depth: 3 })}`;
    }

    return logMessage;
});

// Central logger instance
const logger = createLogger({
    level: process.env.LOG_LEVEL || 'info',
    format: combine(
        timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
        consoleFormat
    ),
    transports: [
        new transports.Console(),
        // Add file transports as needed
    ],
    exceptionHandlers: [
        new transports.Console({
            format: consoleFormat
        })
    ],
    exitOnError: false
});

// Enhanced alerting system
const alertSystem = {
    critical: (message, metadata) => {
        logger.log({
            level: 'alert',
            message: `🚨 CRITICAL: ${message}`,
            ...metadata
        });
        // Integrate with external alerting (Slack/PagerDuty)
    },

    security: (message, metadata) => {
        logger.log({
            level: 'alert',
            message: `🛡️ SECURITY ALERT: ${message}`,
            ...metadata
        });
        // Trigger security protocols
    }
};

// API Response Logger Middleware
const responseLogger = (req, res, next) => {
    const startTime = Date.now();

    res.on('finish', () => {
        const duration = Date.now() - startTime;
        const statusColor = res.statusCode >= 400 ? chalk.red : chalk.green;

        logger.http(`${req.method} ${req.originalUrl}`, {
            status: statusColor(res.statusCode),
            duration: `${duration}ms`,
            ip: req.ip,
            user: req.user?.id || 'anonymous'
        });
    });

    next();
};

// Enhanced error handling
const errorLogger = (error, context = {}) => {
    logger.error({
        message: `💥 ${error.message}`,
        stack: error.stack,
        ...context
    });

    if (error.isOperational) {
        alertSystem.critical(`Operational Error: ${error.message}`, context);
    }
};

// Custom inspection for deep object logging
const inspect = (obj, depth = 5) => {
    return util.inspect(obj, { colors: true, depth, breakLength: Infinity });
};

module.exports = {
    logger,
    alertSystem,
    responseLogger,
    errorLogger,
    inspect
};