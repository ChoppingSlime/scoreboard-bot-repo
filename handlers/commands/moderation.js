const db = require('../../services/database');
const helpers = require('../../utils/helpers');
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
        bot.sendMessage(msg.chat.id, "❌ Non hai i permessi per usare questo comando.");
        return;
    }

    const chatId = msg.chat.id;
    const targetUsername = match[1];
    const reason = match[2] || 'Non hai specificato un motivo per il warn';

    try {
        const user = await db.findUserByUsername(targetUsername);
        if (!user) {
            bot.sendMessage(chatId, `❌ L'utente @${targetUsername} non ha ancora inviato nessun messaggio, pertanto è assente dal mio slime-database.`);
            return;
        }

        const updatedUser = await db.addWarning(user.user_id, reason, msg.from.id);

        const warnText = `⚠️ **L'utente @${targetUsername} è stato warnato**\n\n` +
            `**Motivo:** ${reason}\n` +
            `**Numero di warn:** ${updatedUser.warnings}\n\n` +
            `${updatedUser.warnings >= 3 ? '🚨 **User has reached warning limit!**' : ''}`;

        bot.sendMessage(chatId, warnText, { parse_mode: 'Markdown' });

        // Auto-mute after 3 warnings
        if (updatedUser.warnings >= 3) {
            const muteDurationMs = 24 * 60 * 60 * 1000; // 1 day
            const muteUntil = new Date(Date.now() + muteDurationMs);
            const muteUntilTimestamp = Math.floor(muteUntil.getTime() / 1000); // seconds

            // Mute user on Telegram
            await bot.restrictChatMember(chatId, user.user_id, {
                permissions: {
                    can_send_messages: false,
                    can_send_media_messages: false,
                    can_send_polls: false,
                    can_send_other_messages: false,
                    can_add_web_page_previews: false,
                    can_change_info: false,
                    can_invite_users: false,
                    can_pin_messages: false,
                },
                until_date: muteUntilTimestamp,
            });
            // Reset warns to 0 in DB
            await db.resetWarnings(user.user_id);

            // Save mute info in DB
            await db.muteUser(user.user_id, muteUntil);

            bot.sendMessage(chatId, `🔇 @${targetUsername} è stato mutato automaticamente per 1 giorno, causa 3 warn.\n` +
                `⏰ Il mute scadrà il: ${muteUntil.toLocaleString()}`);
        }
    } catch (err) {
        console.error('Warn command failed:', err);
        bot.sendMessage(chatId, '❌ Failed to warn user.');
    }
});

    // ⚠️ MUTE COMMAND
    bot.onText(/[!\/]mute\s+@?(\w+)(?:\s+(\d+)([mhd]))?/, async (msg, match) => {
        if (!isAdmin(msg.from.id)) {
            bot.sendMessage(msg.chat.id, "❌ You don't have permission to use this command.");
            return;
        }

        const chatId = msg.chat.id;
        const targetUsername = match[1];
        if (!targetUsername) {
            bot.sendMessage(chatId, "❌ Please specify a username.");
            return;
        }

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
                bot.sendMessage(chatId, `❌ User @${targetUsername} not found in the database.`);
                return;
            }

            const muteUntil = new Date(Date.now() + muteTime);
            const muteUntilTimestamp = Math.floor(muteUntil.getTime() / 1000);

            await bot.restrictChatMember(chatId, user.user_id, {
                permissions: {
                    can_send_messages: false,
                    can_send_media_messages: false,
                    can_send_polls: false,
                    can_send_other_messages: false,
                    can_add_web_page_previews: false,
                    can_change_info: false,
                    can_invite_users: false,
                    can_pin_messages: false,
                },
                until_date: muteUntilTimestamp,
            });

            await db.muteUser(user.user_id, muteUntil); // store mute info

            const muteText = `🔇 **@${targetUsername} è stato mutato**\n\n` +
                `**Durata:** ${duration}${unit}\n` +
                `**Il mute scadrà il:** ${muteUntil.toLocaleString()}`;

            bot.sendMessage(chatId, muteText, { parse_mode: 'Markdown' });
        } catch (err) {
            console.error('Mute command failed:', err);
            bot.sendMessage(chatId, `❌ Failed to mute @${targetUsername}. They might be an admin or I lack permissions.`);
        }
    });

    // ⚠️ UNMUTE COMMAND
    bot.onText(/[!\/]unmute\s+@?(\w+)/, async (msg, match) => {
        if (!isAdmin(msg.from.id)) {
            bot.sendMessage(msg.chat.id, "❌ You don't have permission to use this command.");
            return;
        }

        const chatId = msg.chat.id;
        const targetUsername = match[1];
        if (!targetUsername) {
            bot.sendMessage(chatId, "❌ Please specify a username.");
            return;
        }

        try {
            const user = await db.findUserByUsername(targetUsername);
            if (!user) {
                bot.sendMessage(chatId, `❌ User @${targetUsername} not found in the database.`);
                return;
            }

            await bot.restrictChatMember(chatId, user.user_id, {
                permissions: {
                    can_send_messages: true,
                    can_send_media_messages: true,
                    can_send_polls: false,
                    can_send_other_messages: true,
                    can_add_web_page_previews: true,
                    can_change_info: false,    // Usually false for regular members
                    can_invite_users: false,
                    can_pin_messages: false,
                },
                until_date: 0, // removes restrictions immediately
            });

            await db.unmuteUser(user.user_id);

            bot.sendMessage(chatId, `🔊 @${targetUsername} è stato smutato.`);
        } catch (err) {
            console.error('Unmute command failed:', err);
            bot.sendMessage(chatId, `❌ Failed to unmute @${targetUsername}.`);
        }
    });

    // 🚫 PERMABAN COMMAND
    bot.onText(/[!\/]ban\s+@?(\w+)/, async (msg, match) => {
        if (!isAdmin(msg.from.id)) {
            bot.sendMessage(msg.chat.id, "❌ You don't have permission to use this command.");
            return;
        }

        const chatId = msg.chat.id;
        const targetUsername = match[1];

        if (!targetUsername) {
            bot.sendMessage(chatId, "❌ Please specify a username to ban.");
            return;
        }

        try {
            const user = await db.findUserByUsername(targetUsername);
            if (!user) {
                bot.sendMessage(chatId, `❌ User @${targetUsername} not found in the database.`);
                return;
            }

            await bot.banChatMember(chatId, user.user_id); // perma ban

            bot.sendMessage(chatId, `🚫 User @${targetUsername} has been permanently banned.`);
        } catch (err) {
            console.error('Ban command failed:', err);
            bot.sendMessage(chatId, `❌ Failed to ban @${targetUsername}. They might be an admin or I lack permissions.`);
        }
    });

    // ✅ UNBAN COMMAND
    bot.onText(/[!\/]unban\s+@?(\w+)/, async (msg, match) => {
        if (!isAdmin(msg.from.id)) {
            bot.sendMessage(msg.chat.id, "❌ You don't have permission to use this command.");
            return;
        }

        const chatId = msg.chat.id;
        const targetUsername = match[1];

        if (!targetUsername) {
            bot.sendMessage(chatId, "❌ Please specify a username to unban.");
            return;
        }

        try {
            const user = await db.findUserByUsername(targetUsername);
            if (!user) {
                bot.sendMessage(chatId, `❌ User @${targetUsername} not found in the database.`);
                return;
            }

            await bot.unbanChatMember(chatId, user.user_id);

            bot.sendMessage(chatId, `✅ User @${targetUsername} has been unbanned.`);
        } catch (err) {
            console.error('Unban command failed:', err);
            bot.sendMessage(chatId, `❌ Failed to unban @${targetUsername}.`);
        }
    });

     
};