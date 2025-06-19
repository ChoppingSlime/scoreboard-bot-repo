const githubService = require('../../services/github');
const helpers = require('../../utils/helpers');

module.exports = (bot) => {
    const pendingConfirmations = new Map();

    // Permission check middleware
    const requireAdmin = (msg, callback) => {
        if (!helpers.isAdmin(msg.from.id)) {
            bot.sendMessage(msg.chat.id, "❌ Non hai i permessi per usare questo comando.");
            return false;
        }
        return true;
    };

    // /add command (real admin command)
    bot.onText(/\/add (.+)/, async (msg, match) => {
        if (!requireAdmin(msg)) return;

        const chatId = msg.chat.id;
        const userId = msg.from.id;
        const input = match[1];

        const parsed = helpers.parsePointsCommand(input);
        if (!parsed) {
            bot.sendMessage(chatId, '⚠️ Usa: /add "Nome" +/-Punti');
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

                bot.sendMessage(chatId, `✅ ${name} aumentato di ${delta > 0 ? '+' : ''}${delta} punti.`);
            } else {
                // Store pending confirmation
                pendingConfirmations.set(userId, { name, delta, sha, data });
                bot.sendMessage(chatId, `⚠️ ${name} non esiste. Vuoi creare un nuovo utente con ${delta} punti? Rispondi con "SI" o "NO".`);
            }
        } catch (err) {
            console.error('Update failed:', err);
            bot.sendMessage(chatId, '❌ Errore. @ChoppingSlime controlla i logs.');
        }
    });


    // /rename command
    bot.onText(/\/rename (.+), (.+)/, async (msg, match) => {
        if (!requireAdmin(msg)) return;

        const chatId = msg.chat.id;
        const oldName = match[1].trim();
        const newName = match[2].trim();

        try {
            const { data, sha } = await githubService.fetchScoreboardData();

            const oldEntryIndex = data.findIndex(e => e.name.toLowerCase() === oldName.toLowerCase());
            if (oldEntryIndex === -1) {
                bot.sendMessage(chatId, `❌ L'utente' "${oldName}" non ha ancora inviato nessun messaggio, pertanto è assente dal mio slime-database.`);
                return;
            }

            const newNameExists = data.some(e => e.name.toLowerCase() === newName.toLowerCase());
            if (newNameExists) {
                bot.sendMessage(chatId, `❌ Il nome utente "${newName}" è gia in uso.`);
                return;
            }

            data[oldEntryIndex].name = newName;
            await githubService.updateFile(data, sha, undefined, `Renamed ${oldName} to ${newName}`);

            bot.sendMessage(chatId, `✅ Nome utente cambiato da "${oldName}" a "${newName}".`);
        } catch (err) {
            console.error('Rename failed:', err);
            bot.sendMessage(chatId, '❌ Errore. @ChoppingSlime controlla i logs.');
        }
    });

    // /removeuser command
    bot.onText(/\/removeuser (.+)/, async (msg, match) => {
        if (!requireAdmin(msg)) return;

        const chatId = msg.chat.id;
        const name = match[1].trim();

        try {
            const { data, sha } = await githubService.fetchScoreboardData();

            const index = data.findIndex(e => e.name.toLowerCase() === name.toLowerCase());
            if (index === -1) {
                bot.sendMessage(chatId, `❌ Utente "${name}" non trovato.`);
                return;
            }
            data.splice(index, 1);
            await githubService.updateFile(data, sha, undefined, `Removed user ${name}`);

            bot.sendMessage(chatId, `✅ Utente "${name}" rimosso dalla lista.`);
        } catch (err) {
            console.error('Delete failed:', err);
            bot.sendMessage(chatId, '❌ Errore. @ChoppingSlime controlla i logs.');
        }
    });

    // Handle confirmations for new user creation
    bot.on('message', async (msg) => {
        const chatId = msg.chat.id;
        const userId = msg.from.id;
        const text = msg.text?.toLowerCase();

        if (msg.from.is_bot) return;

        if (!pendingConfirmations.has(userId)) return;

        const { name, delta, sha, data } = pendingConfirmations.get(userId);

        if (text === 'si') {
            data.push({ name, points: delta });
            data.sort((a, b) => b.points - a.points);
            try {
                await githubService.updateFile(data, sha);
                await bot.sendMessage(chatId, `✅ Creato nuovo utente: ${name} con ${delta} punti.`);
            } catch (err) {
                console.error('Update failed:', err);
                bot.sendMessage(chatId, '❌ Errore. @ChoppingSlime controlla i logs.');
            }
        } else if (text === 'no') {
            bot.sendMessage(chatId, '❌ Update canceled.');
        } else {
            bot.sendMessage(chatId, '⚠️ Rispondi con "SI" o "NO". ');
            return;
        }

        pendingConfirmations.delete(userId);
    });

}