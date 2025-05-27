module.exports = {
    TELEGRAM_TOKEN: process.env.TELEGRAM_TOKEN,
    GITHUB_TOKEN: process.env.GITHUB_TOKEN,
    OWNER_ID: parseInt(process.env.OWNER_ID, 10),
    REPO_OWNER: process.env.REPO_OWNER,
    REPO_NAME: 'SlimePointsScoreboard',
    FILE_PATH: 'data.json',
    LOGS_PATH: 'logs.json',
    BRANCH: 'main',
    ADMIN_IDS: [parseInt(process.env.OWNER_ID, 10)], // Add more admin IDs here
    WEBSITE_URL: 'https://choppingslime.github.io/SlimePointsScoreboard/'
};