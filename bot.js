require('dotenv').config();
const TelegramBot = require('node-telegram-bot-api');
const config = require('./config/config');

// Import handlers
const scoreboardCommands = require('./handlers/commands/scoreboard');
const adminCommands = require('./handlers/commands/admin');
const moderationCommands = require('./handlers/commands/moderation');
const moderationService = require('./services/moderation')
const db = require('./services/database');
console.log('db module keys:', Object.keys(db));

const bot = new TelegramBot(config.TELEGRAM_TOKEN, { polling: true });

// Register command handlers
scoreboardCommands(bot);
adminCommands(bot);
moderationCommands(bot);

// Message tracking for moderation
bot.on('message', async (msg) => {
    const userId = msg.from.id;
    const chatId = msg.chat.id;

    // Skip private chats and commands for tracking
    if (
        msg.chat.type === 'private' ||
        msg.text?.startsWith('/') ||
        msg.text?.startsWith('!')
    ) {
        return;
    
    }

    // Track user message stats
    try {
        await db.trackMessage(userId, msg.from.username);
    } catch (e) {
        console.error('Failed to track message:', e);
    }
    console.log('received a message');


// Check if user is muted and delete message
if (moderationService.isMuted(userId)) {
    try {
        await bot.deleteMessage(chatId, msg.message_id);
    } catch (err) {
        console.log('Failed to delete message from muted user:', err.message);
    }
}
});

// /help command
bot.onText(/\/help/, (msg) => {
    const isUserAdmin = config.ADMIN_IDS.includes(msg.from.id);

    let helpText = '🟢 **Available Commands:**\n\n';
    helpText += '*/top* [number] — Show the top slime choppers (default: 10)\n';
    helpText += '*/list* — Show the full list of users and their slime points\n\n';

    if (isUserAdmin) {
        helpText += '🔒 **Admin Commands:**\n\n';
        helpText += '*!add* name +/-points — Modify a user\'s points\n';
        helpText += '*!rename* old_name, new_name — Rename a user\n';
        helpText += '*!removeuser* name — Remove a user from the list\n\n';
    }

    bot.sendMessage(msg.chat.id, helpText, { parse_mode: 'Markdown' });
});

// Set bot commands
bot.setMyCommands([
    { command: 'help', description: 'See more info and complete list of commands' },
    { command: 'top', description: 'Show the top choppers' },
    { command: 'list', description: 'Show the full list of users and their slime points' }
]);

bot.on("polling_error", (error) => {
    console.error("Polling error:", error);
});

console.log('🤖 Modular bot is running...');