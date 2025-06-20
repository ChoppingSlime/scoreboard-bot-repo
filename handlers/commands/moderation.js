const db = require('../../services/database');
const helpers = require('../../utils/helpers');
const { isAdmin } = require('../../utils/helpers');


module.exports = (bot) => {

    function escapeMarkdownV2(text) {
        return text.replace(/[_*[\]()~`>#+\-=|{}.!]/g, '\\$&');
    }

    // 🔍 STATS COMMAND
    bot.onText(/[!\/]stats/, async (msg) => {
        const chatId = msg.chat.id;

        try {
            const stats = await db.getChatStats();

            const statsText = `📊 **Chat Statistics:**\n\n` +
                `👤 Active users: ${stats.total_users}\n` +
                `💬 Total messages tracked: ${stats.total_messages}\n` +
                `⚠️ Total warnings issued: ${stats.total_warnings}`;

            bot.sendMessage(chatId, statsText, { parse_mode: 'Markdown' });
        } catch (err) {
            helpers.sendErrorMessage(chatId, err);
        }
    });

    // 🔍 INFO COMMAND
    bot.onText(/[!\/]info(?:\s+@?(\w+))?/, async (msg, match) => {
        const chatId = msg.chat.id;
        const targetUsername = match[1];

        if (!targetUsername) {
            helpers.specifyUsername(bot, chatId);
            return;
        }
        try {
            const user = await db.findUserByUsername(targetUsername);

            if (!user) {
                userNotFound(bot, chatId, targetUsername)
                return;
            }

            const safeUsername = escapeMarkdownV2(targetUsername);

            const infoText = `📋 *User Info for ${safeUsername}:*\n\n` +
                `💬 Messages sent: ${user.message_count}\n` +
                `⚠️ Warnings: ${user.warnings}\n` +
                `📅 First seen: ${user.join_date ? new Date(user.join_date).toLocaleDateString() : 'Unknown'}\n` +
                `🕐 Last message: ${user.last_message ? new Date(user.last_message).toLocaleString() : 'Never'}\n`;


            bot.sendMessage(chatId, infoText, { parse_mode: 'MarkdownV2' });
        } catch (err) {
            helpers.sendErrorMessage(chatId, err);
        }
    });

    // ⚠️ WARN COMMAND
    bot.onText(/[!\/]warn\s+@?(\w+)(?:\s+(.+))?/, async (msg, match) => {
        if (!isAdmin(msg.from.id)) {
            helpers.specifyUsername(bot, chatId);
            return;
        }

        const chatId = msg.chat.id;
        const targetUsername = match[1];
        const reason = match[2] || 'Non hai specificato un motivo per il warn';

        try {
            const user = await db.findUserByUsername(targetUsername);
            if (!user) {
                userNotFound(bot, chatId, targetUsername)
                return;
            }

            const updatedUser = await db.addWarning(user.user_id);

            const totalWarns = updatedUser.warnings;
            const setsOfThree = Math.floor(totalWarns / 3);

            let warnText = `⚠️ **L'utente ${targetUsername} è stato warnato**\n\n` +
                `**Motivo:** ${reason}\n` +
                `**Numero totale di warn:** ${totalWarns}`;

            const lastMuteSet = Math.floor((totalWarns - 1) / 3); // before adding this warn

            if (setsOfThree > lastMuteSet) {
                const muteDurationMs = setsOfThree * 24 * 60 * 60 * 1000; // N days
                const muteUntil = new Date(Date.now() + muteDurationMs);
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

                warnText += `\n\n🔇 Ha raggiunto ${setsOfThree * 3} warn: è stato mutato per ${setsOfThree} giorno${setsOfThree > 1 ? 'i' : ''}.\n` +
                    `⏰ Mute fino al: ${muteUntil.toLocaleString()}`;
            }

            bot.sendMessage(chatId, warnText, { parse_mode: 'Markdown' });

        } catch (err) {
            helpers.sendErrorMessage(chatId, err);
        }
    });


    // ⚠️ MUTE COMMAND
    bot.onText(/[!\/]mute\s+@?(\w+)(?:\s+(\d+)([mhd]))?/, async (msg, match) => {
        if (!isAdmin(msg.from.id)) {
            helpers.specifyUsername(bot, chatId);
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
                userNotFound(bot, chatId, targetUsername)
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

            const muteText = `🔇 **@${targetUsername} è stato mutato**\n\n` +
                `**Durata:** ${duration}${unit}\n` +
                `**Il mute scadrà il:** ${muteUntil.toLocaleString()}`;

            bot.sendMessage(chatId, muteText, { parse_mode: 'Markdown' });
        } catch (err) {
            helpers.sendErrorMessage(chatId, err);
        }
    });

    bot.onText(/[!\/]unmute\s+@?(\w+)/, async (msg, match) => {
        console.log("🔧 Unmute command triggered.");

        if (!isAdmin(msg.from.id)) {
            console.log(`❌ User ${msg.from.id} is not an admin.`);
            bot.sendMessage(msg.chat.id, "❌ You don't have permission to use this command.");
            return;
        }

        const chatId = msg.chat.id;
        const targetUsername = match[1];

        if (!targetUsername) {
            helpers.specifyUsername(bot, chatId);
            return;
        }

        try {
            console.log(`🔍 Looking up user @${targetUsername} in the database...`);
            const user = await db.findUserByUsername(targetUsername);

            if (!user) {
                userNotFound(bot, chatId, targetUsername)
                return;
            }

            const userId = user.user_id;


            await bot.restrictChatMember(chatId, userId, {
                can_send_messages: true,
                can_send_media_messages: true,
                can_send_audios: true,
                can_send_documents: true,
                can_send_photos: true,
                can_send_videos: true,
                can_send_video_notes: true,
                can_send_voice_notes: true,
                can_send_polls: true,
                can_send_other_messages: true,
                can_add_web_page_previews: true,
                can_change_info: false,
                can_invite_users: true,
                can_pin_messages: false,
                can_manage_topics: false,
                until_date: 0
            });

            const text = `🔈 **@${targetUsername} è stato smutato con successo.**`;
     
            helpers.sendReply(bot, chatId, text}

        } catch (err) {
            console.error("🔥 ERROR in unmute command:", err);
            helpers.sendErrorMessage(chatId, err);
        }
    });




    // 🚫 PERMABAN COMMAND
    bot.onText(/[!\/]ban\s+@?(\w+)/, async (msg, match) => {
        if (!isAdmin(msg.from.id)) {
            
            return;
        }

        const chatId = msg.chat.id;
        const targetUsername = match[1];

        if (!targetUsername) {
            helpers.specifyUsername(bot, chatId);
            return;
        }

        try {
            const user = await db.findUserByUsername(targetUsername);
            if (!user) {
                userNotFound(bot, chatId, targetUsername)
                return;
            }

            await bot.banChatMember(chatId, user.user_id); // perma ban

            bot.sendMessage(bot, chatId, `🚫 User @${targetUsername} has been permanently banned.`);
        } catch (err) {
            helpers.sendErrorMessage(chatId, err);
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
            helpers.specifyUsername(bot, chatId);
            return;
        }

        try {
            const user = await db.findUserByUsername(targetUsername);
            if (!user) {
                userNotFound(bot, chatId, targetUsername)
                return;
            }

            await bot.unbanChatMember(chatId, user.user_id);

            bot.sendMessage(chatId, `✅ User @${targetUsername} has been unbanned.`);
        } catch (err) {
            helpers.sendErrorMessage(chatId, err);
        }
    });

     
};