const config = require('../config/config');
const { Octokit } = require("@octokit/rest");

class GitHubService {
    constructor() {
        this.octokit = new Octokit({ auth: config.GITHUB_TOKEN });
    }

    async getFile(filePath = config.FILE_PATH) {
        const res = await fetch(`https://api.github.com/repos/${config.REPO_OWNER}/${config.REPO_NAME}/contents/${filePath}`, {
            headers: { Authorization: token ${ config.GITHUB_TOKEN } },
});
return await res.json();
    }

    async updateFile(newData, sha, filePath = config.FILE_PATH, commitMessage = 'Update via Telegram bot') {
    const content = Buffer.from(JSON.stringify(newData, null, 2)).toString('base64');

    const res = await fetch(`https://api.github.com/repos/${config.REPO_OWNER}/${config.REPO_NAME}/contents/${filePath}`, {
        method: 'PUT',
        headers: {
        Authorization: token ${ config.GITHUB_TOKEN },
        'Content-Type': 'application/json',
            },
body: JSON.stringify({
    message: commitMessage,
    content,
    sha,
    branch: config.BRANCH,
}),
        });

return await res.json();
    }

    async fetchScoreboardData() {
    const file = await this.getFile();
    const data = JSON.parse(Buffer.from(file.content, 'base64').toString());
    return { data, sha: file.sha };
}

    async logCommand({ user, name, delta }) {
    let logs = [];
    let sha;

    try {
        const { data } = await this.octokit.repos.getContent({
            owner: config.REPO_OWNER,
            repo: config.REPO_NAME,
            path: config.LOGS_PATH,
        });

        const content = Buffer.from(data.content, 'base64').toString();
        logs = content.trim() ? JSON.parse(content) : [];
        sha = data.sha;
    } catch (err) {
        if (err.status === 404) {
            logs = [];
        } else {
            console.error("Failed to read log file:", err);
            return;
        }
    }

    const now = new Date();
    const formattedDate = now.toLocaleString('en-GB', { timeZone: 'UTC' });

    logs.push({
        date: formattedDate,
        user: user.username ? `@${user.username}` : `${user.first_name} ${user.last_name || ''}`.trim(),
        name,
        value: delta
        });

const updatedContent = Buffer.from(JSON.stringify(logs, null, 2)).toString('base64');

await this.octokit.repos.createOrUpdateFileContents({
    owner: config.REPO_OWNER,
    repo: config.REPO_NAME,
    path: config.LOGS_PATH,
    message: `log: ${user.username || user.first_name} used /add`,
    content: updatedContent,
    sha,
        });
    }
}

module.exports = new GitHubService();