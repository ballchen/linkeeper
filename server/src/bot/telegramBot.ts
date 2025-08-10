import { Telegraf, Context } from 'telegraf';
import axios from 'axios';
import dotenv from 'dotenv';
import logger from '../utils/logger';

dotenv.config();

// Check if required environment variables are set
const botToken = process.env.TELEGRAM_BOT_TOKEN;
const internalApiKey = process.env.INTERNAL_API_KEY;
const allowedUsers = process.env.TELEGRAM_ALLOWED_USERS;

if (!botToken) {
  logger.error('TELEGRAM_BOT_TOKEN must be provided in environment variables');
  throw new Error('TELEGRAM_BOT_TOKEN must be provided in environment variables');
}

if (!internalApiKey) {
  logger.error('INTERNAL_API_KEY must be provided in environment variables');
  throw new Error('INTERNAL_API_KEY must be provided in environment variables');
}

if (!allowedUsers) {
  logger.error('TELEGRAM_ALLOWED_USERS must be provided in environment variables');
  throw new Error('TELEGRAM_ALLOWED_USERS must be provided in environment variables');
}

// Create bot instance
const bot = new Telegraf(botToken);

// URL validation regex
const urlRegex = /https?:\/\/(www\.)?[-a-zA-Z0-9@:%._\+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_\+.~#?&//=]*)/;

// Parse allowed users list
const allowedUsersList = allowedUsers.split(',').map(user => user.trim()).filter(user => user.length > 0);

// User authorization helper
const isAuthorizedUser = (ctx: Context): boolean => {
  const userId = ctx.from?.id;
  const username = ctx.from?.username;
  
  if (!userId) return false;
  
  return allowedUsersList.some(allowedUser => {
    if (allowedUser.startsWith('@')) {
      return username && `@${username}` === allowedUser;
    } else {
      return userId.toString() === allowedUser;
    }
  });
};

const handleUnauthorizedUser = (ctx: Context) => {
  const userId = ctx.from?.id;
  const username = ctx.from?.username || 'Unknown';
  logger.warn(`Unauthorized access attempt from user: ${username} (ID: ${userId})`);
  ctx.reply('🚫 Sorry, you are not authorized to use this bot. Please contact the administrator for access.');
};

// Start handler
bot.start((ctx) => {
  if (!isAuthorizedUser(ctx)) {
    handleUnauthorizedUser(ctx);
    return;
  }
  
  const userId = ctx.from?.id;
  const username = ctx.from?.username || 'Unknown';
  logger.info(`Bot started by user: ${username} (ID: ${userId})`);
  ctx.reply('Welcome to LinkKeeper Bot! 🔗\n\nSend me any URL, and I will save it to your collection for easy access later.');
});

// Help handler
bot.help((ctx) => {
  if (!isAuthorizedUser(ctx)) {
    handleUnauthorizedUser(ctx);
    return;
  }
  
  const userId = ctx.from?.id;
  const username = ctx.from?.username || 'Unknown';
  logger.info(`Help requested by user: ${username} (ID: ${userId})`);
  ctx.reply('📚 How to use LinkKeeper Bot:\n\n• Simply send me any URL\n• I will automatically save it to your collection\n• Access your saved links through the web interface\n\nThat\'s it! No commands needed, just send URLs! 🚀');
});

// URL handler
bot.on('text', async (ctx) => {
  if (!isAuthorizedUser(ctx)) {
    handleUnauthorizedUser(ctx);
    return;
  }
  
  const text = ctx.message.text;
  const userId = ctx.from?.id;
  const username = ctx.from?.username || 'Unknown';

  if (ctx.from?.is_bot) {
    logger.debug(`Bot message from ${username}: ${text}`);
    return;
  }
  
  logger.debug(`Message received from ${username} (ID: ${userId}): ${text}`);
  
  // Check if the message contains a URL
  if (urlRegex.test(text)) {
    try {
      // Extract the URL from the message
      const url = text.match(urlRegex)?.[0] || '';
      
      logger.info(`Processing URL from ${username}: ${url}`);
      
      // Send URL to API with authentication
      const apiUrl = process.env.API_URL || 'http://localhost:4000/api/urls';
      await axios.post(apiUrl, 
        { url }, 
        {
          headers: {
            'x-api-key': internalApiKey,
            'Content-Type': 'application/json'
          }
        }
      );
      
      logger.info(`URL saved successfully: ${url}`);
      ctx.reply(`✅ Link saved to LinkKeeper!\n\n🔗 ${url}\n\nYou can access all your saved links through the web interface.`);
    } catch (error) {
      logger.error(`Error saving URL from ${username}: ${error}`);
      
      // Provide more specific error messages
      if (axios.isAxiosError(error)) {
        const status = error.response?.status;
        if (status === 401) {
          logger.error('API authentication failed - check INTERNAL_API_KEY');
          ctx.reply('❌ Authentication error. Please contact the administrator.');
        } else if (status && status >= 500) {
          ctx.reply('❌ Server error. Please try again later.');
        } else {
          ctx.reply('❌ Failed to save URL. Please try again.');
        }
      } else {
        ctx.reply('❌ Failed to save URL. Please try again.');
      }
    }
  } else {
    logger.debug(`Non-URL message from ${username}: ${text}`);
    ctx.reply('🤔 Please send a valid URL starting with http:// or https://\n\nExample: https://example.com');
  }
});

// Error handling
bot.catch((err, ctx) => {
  const userId = ctx.from?.id;
  const username = ctx.from?.username || 'Unknown';
  logger.error(`Bot error for user ${username} (ID: ${userId}): ${err}`);
});

export const startBot = () => {
  try {
    bot.launch();
    logger.info('LinkKeeper Telegram bot launched successfully');
    
    // Enable graceful stop
    process.once('SIGINT', () => {
      logger.info('Received SIGINT, stopping bot gracefully');
      bot.stop('SIGINT');
    });
    process.once('SIGTERM', () => {
      logger.info('Received SIGTERM, stopping bot gracefully');
      bot.stop('SIGTERM');
    });
  } catch (error) {
    logger.error(`Failed to launch Telegram bot: ${error}`);
    throw error;
  }
}; 