const githubService = require('../../services/github');
const helpers = require('../../utils/helpers');

module.exports = (bot) => {
    const pendingConfirmations = new Map();

    // Permission check middleware
    const requireAdmin = (msg, callback) => {
        if (!helpers.isAdmin(msg.from.id)) {
            bot.sendMessage(msg.chat.id, "❌ You don't have permission to use this command.");
            return false;
        }
        return true;
    };

    // /add command (real admin command)
    bot.onText(/!add (.+)/, async (msg, match) => {
        if (!requireAdmin(msg)) return;

        const chatId = msg.chat.id;
        const userId = msg.from.id;
        const input = match[1];

        const parsed = helpers.parsePointsCommand(input);
        if (!parsed) {
            bot.sendMessage(chatId, '⚠️ Use: /add "Name" +/-Points');
            return;
        }

        const { name, delta } = parsed;

        try {
            const { data, sha } = await githubService.fetchScoreboardData();
            const existing = helpers.findUserByName(data, name);

            if (existing) {
                existing.points = (existing.points || 0) + delta;
                data.sort((a, b) => b.points - a.points);

                await githubService.updateFile(data, sha);
                await githubService.logCommand({ user: msg.from, name, delta });

                bot.sendMessage(chatId, `✅ ${name} updated by ${delta > 0 ? '+' : ''}${delta} points.`);
            } else {
                // Store pending confirmation
                pendingConfirmations.set(userId, { name, delta, sha, data });
                bot.sendMessage(chatId, `⚠️ ${name} does not exist. Create new entry with ${delta} points? Reply with "yes" or "no".`);
            }
        } catch (err) {
            console.error('Update failed:', err);
            bot.sendMessage(chatId, '❌ Failed to update. Check bot logs.');
        }
    });


    // /rename command
    bot.onText(/!rename (.+), (.+)/, async (msg, match) => {
        if (!requireAdmin(msg)) return;

        const chatId = msg.chat.id;
        const oldName = match[1].trim();
        const newName = match[2].trim();

        try {
            const { data, sha } = await githubService.fetchScoreboardData();

            const oldEntryIndex = data.findIndex(e => e.name.toLowerCase() === oldName.toLowerCase());
            if (oldEntryIndex === -1) {
                bot.sendMessage(chatId, `❌ User "${oldName}" not found.`);
                return;
            }

            const newNameExists = data.some(e => e.name.toLowerCase() === newName.toLowerCase());
            if (newNameExists) {
                bot.sendMessage(chatId, `❌ Name "${newName}" is already taken.`);
                return;
            }

            data[oldEntryIndex].name = newName;
            await githubService.updateFile(data, sha, undefined, `Renamed ${oldName} to ${newName}`);

            bot.sendMessage(chatId, `✅ Renamed "${oldName}" to "${newName}".`);
        } catch (err) {
            console.error('Rename failed:', err);
            bot.sendMessage(chatId, '❌ Failed to rename user.');
        }
    });

    // /removeuser command
    bot.onText(/!removeuser (.+)/, async (msg, match) => {
        if (!requireAdmin(msg)) return;

        const chatId = msg.chat.id;
        const name = match[1].trim();

        try {
            const { data, sha } = await githubService.fetchScoreboardData();

            const index = data.findIndex(e => e.name.toLowerCase() === name.toLowerCase());
            if (index === -1) {
                bot.sendMessage(chatId, `❌ User "${name}" not found.`);
                return;
            }
            data.splice(index, 1);
            await githubService.updateFile(data, sha, undefined, `Removed user ${name}`);

            bot.sendMessage(chatId, `✅ Deleted user "${name}".`);
        } catch (err) {
            console.error('Delete failed:', err);
            bot.sendMessage(chatId, '❌ Failed to delete user.');
        }
    });

    // Handle confirmations for new user creation
    bot.on('message', async (msg) => {
        const chatId = msg.chat.id;
        const userId = msg.from.id;
        const text = msg.text?.toLowerCase();

        if (!pendingConfirmations.has(userId) || msg.chat.type !== 'private') return;

        const { name, delta, sha, data } = pendingConfirmations.get(userId);

        if (text === 'yes') {
            data.push({ name, points: delta });
            data.sort((a, b) => b.points - a.points);
            try {
                await githubService.updateFile(data, sha);
                await bot.sendMessage(chatId, `✅ New entry created: ${name} with ${delta} points.`);
            } catch (err) {
                console.error('Update failed:', err);
                bot.sendMessage(chatId, '❌ Failed to create entry.');
            }
        } else if (text === 'no') {
            bot.sendMessage(chatId, '❌ Update canceled.');
        } else {
            bot.sendMessage(chatId, '⚠️ Please reply with "yes" or "no".');
            return;
        }

        pendingConfirmations.delete(userId);
    });

}