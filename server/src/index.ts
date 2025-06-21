import express from 'express';
import { Server } from 'http';
import mongoose from 'mongoose';
import cors from 'cors';
import dotenv from 'dotenv';
import { createUrlRoutes } from './infrastructure/web/routes/urlRoutes';
import { createAuthRoutes } from './infrastructure/web/routes/authRoutes';
import { DependencyContainer } from './infrastructure/config/DependencyContainer';
import { startBot } from './bot/telegramBot';
import logger from './utils/logger';
import { requestLogger } from './middleware/requestLogger';

// Load environment variables
dotenv.config();

// Create Express app
const app = express();
const PORT = process.env.PORT || 4000;
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/url-saver';
let server: Server;

// Middleware
app.use(cors());
app.use(express.json());

// Request logging middleware
app.use(requestLogger);

// Initialize dependency container
const container = DependencyContainer.getInstance();

// Routes
app.use('/api/urls', createUrlRoutes(container.urlController));
app.use('/api/auth', createAuthRoutes(container.authController));

// Health check endpoint
app.get('/health', (req, res) => {
  logger.info('Health check requested');
  res.status(200).json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

// Connect to MongoDB
mongoose.connect(MONGODB_URI)
  .then(() => {
    logger.info('Connected to MongoDB successfully');
    
    // Start Express server
    server = app.listen(PORT, () => {
      logger.info(`Server running on port ${PORT}`);
      logger.info(`Environment: ${process.env.NODE_ENV || 'development'}`);
      
      // Start Telegram bot
      try {
        startBot();
        logger.info('Telegram bot started successfully');
      } catch (error) {
        logger.error(`Failed to start Telegram bot: ${error}`);
      }
    });
  })
  .catch((error) => {
    logger.error(`MongoDB connection error: ${error.message}`);
    process.exit(1);
  });

const gracefulShutdown = (signal: NodeJS.Signals) => {
  logger.info(`Received ${signal}. Shutting down gracefully`);
  if (server) {
    logger.info('Closing HTTP server');
    server.close(() => {
      logger.info('HTTP server closed');
      mongoose.disconnect()
        .then(() => {
          logger.info('Disconnected from MongoDB');
          process.exit(0);
        })
        .catch((err) => {
          logger.error(`Error during MongoDB disconnect: ${err}`);
          process.exit(1);
        });
    });
  } else {
    mongoose.disconnect()
      .then(() => {
        logger.info('Disconnected from MongoDB');
        process.exit(0);
      })
      .catch((err) => {
        logger.error(`Error during MongoDB disconnect: ${err}`);
        process.exit(1);
      });
  }
};

process.once('SIGINT', () => gracefulShutdown('SIGINT'));
process.once('SIGTERM', () => gracefulShutdown('SIGTERM'));

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  logger.error(`Unhandled Rejection at: ${promise}, reason: ${reason}`);
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  logger.error(`Uncaught Exception: ${error.message}`);
  process.exit(1);
}); 
