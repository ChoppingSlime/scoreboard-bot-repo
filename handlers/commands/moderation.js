
const moderationService = require('../../services/moderation');

function parseDuration(arg) {
    const match = arg.match(/^(\d+)([mhd]?)$/);
    if (!match) return null;
    return {
        duration: parseInt(match[1], 10),
        unit: match[2] || 'm'
    };
}


bot.onText(/\/info(?:\s+(.+))?/, (msg, match) => {
    console.log('[DEBUG] msg received:', JSON.stringify(msg, null, 2));
    if (!msg.from) {
        console.warn('Command triggered without `msg.from`:', msg);
        return;
    }
    const chatId = msg.chat.id;
    const target = match[1] || msg.from.username;

    const user = moderationService.findUserByUsername(target);
    if (!user) {
        bot.sendMessage(chatId, `❌ User "${target}" not found.`);
        return;
    }

    const isMuted = moderationService.isMuted(user.id);
    bot.sendMessage(chatId, `👤 ${user.username} - Messages: ${user.messageCount}, Warnings: ${user.warnings}, Muted: ${isMuted}`);
});

bot.onText(/\/warn (.+)/, (msg, match) => {
    if (!msg.from) {
        console.warn('Command triggered without `msg.from`:', msg);
        return;
    }
    const chatId = msg.chat.id;
    const target = match[1];

    const user = moderationService.findUserByUsername(target);
    if (!user) {
        bot.sendMessage(chatId, `❌ User "${target}" not found.`);
        return;
    }

    const result = moderationService.warnUser(user.id);
    const response = result.autoMuted
        ? `⚠️ ${target} warned (total: ${result.warnings}). Auto-muted for 1 hour.`
        : `⚠️ ${target} warned (total: ${result.warnings}).`;

    bot.sendMessage(chatId, response);
});

bot.onText(/\/mute (\S+)(?:\s+(\S+))?/, (msg, match) => {
    if (!msg.from) {
        console.warn('Command triggered without `msg.from`:', msg);
        return;
    }
    const chatId = msg.chat.id;
    const target = match[1];
    const durationArg = match[2] || '10m';

    const user = moderationService.findUserByUsername(target);
    if (!user) {
        bot.sendMessage(chatId, `❌ User "${target}" not found.`);
        return;
    }

    const parsed = parseDuration(durationArg);
    if (!parsed) {
        bot.sendMessage(chatId, `⚠️ Invalid duration format. Use like "10m", "1h", "1d".`);
        return;
    }

    const unmuteAt = moderationService.muteUser(user.id, parsed.duration, parsed.unit);
    bot.sendMessage(chatId, `🔇 ${target} muted until ${unmuteAt.toLocaleTimeString()}`);
});

bot.onText(/\/unmute (.+)/, (msg, match) => {
    if (!msg.from) {
        console.warn('Command triggered without `msg.from`:', msg);
        return;
    }
    const chatId = msg.chat.id;
    const target = match[1];

    const user = moderationService.findUserByUsername(target);
    if (!user) {
        bot.sendMessage(chatId, `❌ User "${target}" not found.`);
        return;
    }

    moderationService.unmuteUser(user.id);
    bot.sendMessage(chatId, `🔊 ${target} has been unmuted.`);
});
