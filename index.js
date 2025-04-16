/**
 * @file index.js
 * @description Entry point for the application. This file initializes the server and handles global error events.
 */

const createApp = require('./src/app')
const dotenv = require('dotenv');

// Load environment variables
dotenv.config();
// Set the port for the server. Default is 3000 if not specified in the environment variables.
const PORT = process.env.PORT || 3000;

const startServer = async () => {
    try {
      const { app, server, initialize } = createApp();
      await initialize();
  
      server.listen(PORT, () => {
        console.log(`Server is running successsfully on http://localhost:${PORT}`);
  
      });
    } catch (error) {
      console.error('Failed to start server:', error);
      process.exit(1);
    }
  };

// Handle uncaught exceptions to prevent the application from crashing unexpectedly.
process.on("uncaughtException", (err) => {
  console.error("Uncaught exception:", err);
  process.exit(1); // Exit the process with a failure code.
});

// Handle unhandled promise rejections to ensure proper error handling.
process.on("unhandledRejection", (reason, promise) => {
  console.error("Unhandled rejection at:", promise, "reason:", reason);
  process.exit(1); // Exit the process with a failure code.
});

startServer();
