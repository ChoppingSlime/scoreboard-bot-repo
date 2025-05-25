require('dotenv').config();
const TelegramBot = require('node-telegram-bot-api');

// 🔐 CONFIG
const TELEGRAM_TOKEN = process.env.TELEGRAM_TOKEN;
const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const OWNER_ID = parseInt(process.env.OWNER_ID, 10);
const REPO_OWNER = process.env.REPO_OWNER;
const REPO_NAME = 'SlimePoints';
const FILE_PATH = 'data.json'; // relative path in your repo
const BRANCH = 'main';

const bot = new TelegramBot(TELEGRAM_TOKEN, { polling: true });

const pendingConfirmations = new Map(); // Keeps track of pending new entries

async function getFile() {
    const res = await fetch(`https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/contents/${FILE_PATH}`, {
        headers: { Authorization: `token ${GITHUB_TOKEN}` },
    });
    return await res.json();
}

async function updateFile(newData, sha) {
    const content = Buffer.from(JSON.stringify(newData, null, 2)).toString('base64');

    const res = await fetch(`https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/contents/${FILE_PATH}`, {
        method: 'PUT',
        headers: {
            Authorization: `token ${GITHUB_TOKEN}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            message: `Update via Telegram bot`,
            content,
            sha,
            branch: BRANCH,
        }),
    });

    return await res.json();
}

async function fetchData() {
    const file = await getFile();
    const data = JSON.parse(Buffer.from(file.content, 'base64').toString());
    return { data, sha: file.sha };
}
function doesHavePermission(msg, bot) {
    if (msg.from.id !== OWNER_ID) {
        bot.sendMessage(msg.chat.id, "❌ You don't have permission to use this command.");
        return false;
    }
    return true;
}

bot.onText(/\/addpoints (.+)/, async (msg, match) => {
    if (!doesHavePermission(msg, bot)) return;
    const chatId = msg.chat.id;
    const userId = msg.from.id;
    const input = match[1];

    const split = input.match(/^(.+?)\s+([-+]?[0-9]+(?:\.[0-9]+)?)$/);
    if (!split) {
        bot.sendMessage(chatId, '⚠️ Use: /update "Name" +/-Points');
        return;
    }

    const name = split[1].trim();
    const delta = parseFloat(split[2]);

    try {
        const file = await getFile();
        const data = JSON.parse(Buffer.from(file.content, 'base64').toString());

        const existing = data.find(p => p.name.toLowerCase() === name.toLowerCase());

        if (existing) {
            existing.points = (existing.points || 0) + delta;
            data.sort((a, b) => b.points - a.points);
            await updateFile(data, file.sha);
            bot.sendMessage(chatId, `✅ ${name} updated by ${delta > 0 ? '+' : ''}${delta} points.`);
        } else {
            // Store pending confirmation
            pendingConfirmations.set(userId, { name, delta, sha: file.sha, data });
            bot.sendMessage(chatId, `⚠️ ${name} does not exist. Create new entry with ${delta} points? Reply with "yes" or "no".`);
        }
    } catch (err) {
        console.error('Update failed:', err);
        bot.sendMessage(chatId, '❌ Failed to update. Check bot logs.');
    }
});

bot.onText(/\/top(?:\s+(\d+))?/, async (msg, match) => {
    const chatId = msg.chat.id;
    const limit = match[1] ? parseInt(match[1]) : 10;

    try {
        const file = await getFile();
        const data = JSON.parse(Buffer.from(file.content, 'base64').toString());

        if (data.length === 0) {
            bot.sendMessage(chatId, 'Leaderboard is empty.');
            return;
        }

        // Sort descending by points
        data.sort((a, b) => b.points - a.points);

        const topUsers = data.slice(0, limit);
        let leaderboardText = `🏆 Top ${limit} DMTSO Choppers:\n\n`;
        topUsers.forEach((entry, index) => {
            leaderboardText += `${index + 1}. ${entry.name}: ${entry.points}\n`;
        });

        leaderboardText += `\n📄 Full leaderboard:\nhttps://choppingslime.github.io/SlimePoints/`;
        bot.sendMessage(chatId, leaderboardText);
    } catch (err) {
        console.error('Failed to fetch leaderboard:', err);
        bot.sendMessage(chatId, '❌ Failed to fetch leaderboard.');
    }
});

bot.onText(/\/list/, async (msg) => {
    const chatId = msg.chat.id;

    try {
        const file = await getFile();
        const data = JSON.parse(Buffer.from(file.content, 'base64').toString());

        if (data.length === 0) {
            bot.sendMessage(chatId, 'Leaderboard is empty.');
            return;
        }

        // Sort descending by points
        data.sort((a, b) => b.points - a.points);

        let listText = '📋 Full Slime Points List:\n\n';
        data.forEach((entry, index) => {
            listText += `${index + 1}. ${entry.name}: ${entry.points}\n`;
        });

        bot.sendMessage(chatId, listText);
    } catch (err) {
        console.error('Failed to fetch list:', err);
        bot.sendMessage(chatId, '❌ Failed to fetch list.');
    }
});

// /rename command: rename user
bot.onText(/\/rename (.+), (.+)/, async (msg, match) => {
    if (!doesHavePermission(msg, bot)) return;
    const chatId = msg.chat.id;

    const oldName = match[1].trim();
    const newName = match[2].trim();

    try {
        const { data, sha } = await fetchData();

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

        await updateFile(data, sha);
        bot.sendMessage(chatId, `✅ Renamed "${oldName}" to "${newName}".`);
    } catch (err) {
        console.error('Rename failed:', err);
        bot.sendMessage(chatId, '❌ Failed to rename user.');
    }
});


///deluser command: delete user entry
bot.onText(/\/removeuser (.+)/, async (msg, match) => {
    if (!doesHavePermission(msg, bot)) return;
    const chatId = msg.chat.id;
    const name = match[1].trim();

    try {
        const { data, sha } = await fetchData();

        const index = data.findIndex(e => e.name.toLowerCase() === name.toLowerCase());
        if (index === -1) {
            bot.sendMessage(chatId, `❌ User "${name}" not found.`);
            return;
        }

        data.splice(index, 1);
        await updateFile(data, sha);
        bot.sendMessage(chatId, `✅ Deleted user "${name}".`);
    } catch (err) {
        console.error('Delete failed:', err);
        bot.sendMessage(chatId, '❌ Failed to delete user.');
    }
});

bot.onText(/\/help/, (msg) => {

    let helpText = '🟢 *Available Commands:*\n\n';
    helpText += '*\/top* number — Show the top slime choppers. Optionally add a number (default is 10)\n';
    helpText += '  _e.g., /top 25_\n\n';
    helpText += '*\/list* — Show the full list of users and their slime points\n\n';

    helpText += '🔒 *Admin Commands:*\n\n';
    helpText += '*\/addpoints* name +/-points — Modify a user\'s points.\n';
    helpText += '  _Format: /addpoints name +/-points_\n';
    helpText += '  _e.g., /addpoints bob 10_\n\n';

    helpText += '*\/rename* old_name new_name — Rename a user.\n';
    helpText += '  _Format: /rename current_name new_name_\n';
    helpText += '  _e.g., /rename bob bober_\n\n';

    helpText += '*\/removeuser* name — Remove a user from the list.\n';
    helpText += '  _Format: /removeuser name_\n';
    helpText += '  _e.g., /removeuser bob_\n';

    bot.sendMessage(msg.chat.id, helpText, { parse_mode: 'Markdown' });
});
    

bot.on('message', async (msg) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;
    const text = msg.text?.toLowerCase();

    if (!pendingConfirmations.has(userId)) return;

    const { name, delta, sha, data } = pendingConfirmations.get(userId);

    if (text === 'yes') {
        data.push({ name, points: delta });
        data.sort((a, b) => b.points - a.points);
        try {
            await updateFile(data, sha);
            bot.sendMessage(chatId, `✅ New entry created: ${name} with ${delta} points.`);
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

bot.setMyCommands([
    { command: 'help', description: 'See more info and complete list of commands' },
    { command: 'top', description: 'Show the top choppers. Optionally add a number (default is 10) | e.g., /top 25' },
    { command: 'list', description: 'Show the full list of users and their slime points' }
])
bot.on("polling_error", (error) => {
    console.error("Polling error:", error);
});

console.log('🤖 Bot is running...');