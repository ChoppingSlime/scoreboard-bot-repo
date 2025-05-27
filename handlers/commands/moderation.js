const db = require('../../services/database');
const { isAdmin } = require('../../utils/helpers');


module.exports = (bot) => {

    function escapeMarkdownV2(text) {
        return text.replace(/[_*[\]()~`>#+\-=|{}.!]/g, '\\$&');
    }
 

    // 🔍 INFO COMMAND
    bot.onText(/[!\/]info(?:\s+@?(\w+))?/, async (msg, match) => {
        const chatId = msg.chat.id;
        const targetUsername = match[1];

        if (!targetUsername) {
            bot.sendMessage(chatId, `❌ L'utente @${targetUsername} non ha ancora inviato nessun messaggio, pertanto è assente dal mio slime-database.`);
            return;
        }
        try {
            const user = await db.findUserByUsername(targetUsername);

            if (!user) {
                bot.sendMessage(chatId, `❌ User @${targetUsername} not found in records.`);
                return;
            }

            const safeUsername = escapeMarkdownV2(targetUsername);

            const infoText = `📋 *User Info for @${safeUsername}:*\n\n` +
                `💬 Messages sent: ${user.message_count}\n` +
                `⚠️ Warnings: ${user.warnings}\n` +
                `📅 First seen: ${user.join_date ? new Date(user.join_date).toLocaleDateString() : 'Unknown'}\n` +
                `🕐 Last message: ${user.last_message ? new Date(user.last_message).toLocaleString() : 'Never'}\n` +
                `🔇 Currently muted: ${user.is_muted ? 'Yes' : 'No'}`;

            bot.sendMessage(chatId, infoText, { parse_mode: 'MarkdownV2' });
        } catch (err) {
            console.error('Info command failed:', err);
            bot.sendMessage(chatId, '❌ Failed to get user info.');
        }
    });

    // ⚠️ WARN COMMAND
    bot.onText(/[!\/]warn\s+@?(\w+)(?:\s+(.+))?/, async (msg, match) => {
        if (!isAdmin(msg.from.id)) {
            bot.sendMessage(msg.chat.id, "❌ You don't have permission to use this command.");
            return;
        }

        const chatId = msg.chat.id;
        const targetUsername = match[1];
        const reason = match[2] || 'No reason provided';

        try {
            const user = await db.findUserByUsername(targetUsername);
            if (!user) {
                bot.sendMessage(chatId, `❌ L'utente @${targetUsername} non ha ancora inviato nessun messaggio, pertanto è assente dal mio slime-database.`);
                return;
            }

            const updatedUser = await db.addWarning(user.user_id, reason, msg.from.id);

            const warnText = `⚠️ **Warning issued to @${targetUsername}**\n\n` +
                `**Reason:** ${reason}\n` +
                `**Total warnings:** ${updatedUser.warnings}\n\n` +
                `${updatedUser.warnings >= 3 ? '🚨 **User has reached warning limit!**' : ''}`;

            bot.sendMessage(chatId, warnText, { parse_mode: 'Markdown' });

            // Auto-mute after 3 warnings
            if (updatedUser.warnings >= 3) {
                const muteUntil = new Date(Date.now() + (60 * 60 * 1000)); // 1 hour
                await db.muteUser(user.user_id, muteUntil);
                bot.sendMessage(chatId, `🔇 @${targetUsername} has been automatically muted for 1 hour due to excessive warnings.`);
            }
        } catch (err) {
            console.error('Warn command failed:', err);
            bot.sendMessage(chatId, '❌ Failed to warn user.');
        }
    });

    // 🔇 MUTE COMMAND
    bot.onText(/[!\/]mute\s+@?(\w+)(?:\s+(\d+)([mhd]))?/, async (msg, match) => {
        if (!isAdmin(msg.from.id)) {
            bot.sendMessage(msg.chat.id, "❌ You don't have permission to use this command.");
            return;
        }

        const chatId = msg.chat.id;
        const targetUsername = match[1];
        const duration = parseInt(match[2]) || 60;
        const unit = match[3] || 'm';

        let muteTime;
        switch (unit) {
            case 'h': muteTime = duration * 60 * 60 * 1000; break;
            case 'd': muteTime = duration * 24 * 60 * 60 * 1000; break;
            default: muteTime = duration * 60 * 1000;
        }

        try {
            const user = await db.findUserByUsername(targetUsername);
            if (!user) {
                bot.sendMessage(chatId, `❌ L'utente @${targetUsername} non ha ancora inviato nessun messaggio, pertanto è assente dal mio slime-database.`);
                return;
            }

            const muteUntil = new Date(Date.now() + muteTime);
            await db.muteUser(user.user_id, muteUntil);

            const muteText = `🔇 **@${targetUsername} has been muted**\n\n` +
                `**Duration:** ${duration}${unit}\n` +
                `**Unmute time:** ${muteUntil.toLocaleString()}`;

            bot.sendMessage(chatId, muteText, { parse_mode: 'Markdown' });
        } catch (err) {
            console.error('Mute command failed:', err);
            bot.sendMessage(chatId, '❌ Failed to mute user.');
        }
    });

    // 🔊 UNMUTE COMMAND
    bot.onText(/[!\/]unmute\s+@?(\w+)/, async (msg, match) => {
        if (!isAdmin(msg.from.id)) {
            bot.sendMessage(msg.chat.id, "❌ You don't have permission to use this command.");
            return;
        }

        const chatId = msg.chat.id;
        const targetUsername = match[1];

        try {
            const user = await db.findUserByUsername(targetUsername);
            if (!user) {
                bot.sendMessage(chatId, `❌ L'utente @${targetUsername} non ha ancora inviato nessun messaggio, pertanto è assente dal mio slime-database.`);
                return;
            }

            await db.unmuteUser(user.user_id);
            bot.sendMessage(chatId, `🔊 @${targetUsername} has been unmuted.`);
        } catch (err) {
            console.error('Unmute command failed:', err);
            bot.sendMessage(chatId, '❌ Failed to unmute user.');
        }
    });

    // 📊 STATS COMMAND
    bot.onText(/[!\/]stats/, async (msg) => {
        const chatId = msg.chat.id;

        try {
            const stats = await db.getChatStats();

            const statsText = `📊 **Chat Statistics:**\n\n` +
                `👤 Active users: ${stats.total_users}\n` +
                `💬 Total messages tracked: ${stats.total_messages}\n` +
                `🔇 Currently muted: ${stats.muted_users}\n` +
                `⚠️ Total warnings issued: ${stats.total_warnings}`;

            bot.sendMessage(chatId, statsText, { parse_mode: 'Markdown' });
        } catch (err) {
            console.error('Stats command failed:', err);
            bot.sendMessage(chatId, '❌ Failed to get chat statistics.');
        }
    });

    // 🏆 TOP CHATTERS COMMAND
    bot.onText(/[!\/]topchatters(?:\s+(\d+))?/, async (msg, match) => {
        const chatId = msg.chat.id;
        const limit = match[1] ? parseInt(match[1]) : 10;

        try {
            const topUsers = await db.getTopMessageSenders(limit);

            if (topUsers.length === 0) {
                bot.sendMessage(chatId, 'No message data available yet.');
                return;
            }

            let leaderboardText = `🏆 **Top ${limit} Most Active Chatters:**\n\n`;
            topUsers.forEach((user, index) => {
                const displayName = user.username ? `@${user.username}` : (user.first_name || 'Unknown');
                leaderboardText += `${index + 1}. ${displayName}: ${user.message_count} messages\n`;
            });

            bot.sendMessage(chatId, leaderboardText, { parse_mode: 'Markdown' });
        } catch (err) {
            console.error('Top chatters command failed:', err);
            bot.sendMessage(chatId, '❌ Failed to get top chatters.');
        }
    });

    

};