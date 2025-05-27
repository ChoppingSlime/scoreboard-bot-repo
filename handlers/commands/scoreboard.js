const githubService = require('../../services/github');
const helpers = require('../../utils/helpers');

module.exports = (bot) => {
    // /top command
    bot.onText(/\/top(?:\s+(\d+))?/, async (msg, match) => {
        const chatId = msg.chat.id;
        const limit = match[1] ? parseInt(match[1]) : 10;

        try {
            const { data } = await githubService.fetchScoreboardData();
            const leaderboardText = helpers.formatLeaderboard(data, limit, `Top ${limit} DMTSO Choppers`);
            bot.sendMessage(chatId, leaderboardText);
        } catch (err) {
            console.error('Failed to fetch leaderboard:', err);
            bot.sendMessage(chatId, '❌ Failed to fetch leaderboard.');
        }
    });

    // /list command
    bot.onText(/\/list/, async (msg) => {
        const chatId = msg.chat.id;

        try {
            const { data } = await githubService.fetchScoreboardData();
            const listText = helpers.formatLeaderboard(data, data.length, 'Full Slime Points List');
            bot.sendMessage(chatId, listText);
        } catch (err) {
            console.error('Failed to fetch list:', err);
            bot.sendMessage(chatId, '❌ Failed to fetch list.');
        }
    });
};
