const config = require('../config/config');

class Helpers {
    static isAdmin(userId) {
        return config.ADMIN_IDS.includes(userId);
    }

    static isOwner(userId) {
        return userId === config.OWNER_ID;
    }




    static specifyUsername(bot, chatId) {
        return this.sendReply(bot, chatId, "❌ Per favore specifica il nome utente.");
    }

    static userNotFound(bot, chatId, targetUsername) {
        return this.sendReply(bot, chatId, `❌ Utente @${targetUsername} non ha ancora inviato nessun messaggio.`);
    }





    static formatLeaderboard(data, limit = 10, title = "Top Choppers") {
        if (data.length === 0) {
            return 'Leaderboard is empty.';
        }

        data.sort((a, b) => b.points - a.points);
        const topUsers = data.slice(0, limit);

        let text = `🏆 ${title}:\n\n`;
        topUsers.forEach((entry, index) => {
            text += `${index + 1}. ${entry.name}: ${entry.points}\n`;
        });

        
        


        if (limit < data.length) {
            text += `\n📄 Full leaderboard: \n${config.WEBSITE_URL}`;
        }

        return text;
    }

    static parsePointsCommand(input) {
        const match = input.match(/^(.+?)\s+([-+]?[0-9]+(?:\.[0-9]+)?)$/);
        if (!match) {
            return null;
        }

        return {
            name: match[1].trim(),
            delta: parseFloat(match[2])
        };
    }

    static findUserByName(data, name) {
        return data.find(p => p.name.toLowerCase() === name.toLowerCase());
    }
}

module.exports = Helpers;