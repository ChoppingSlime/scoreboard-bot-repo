class ModerationService {
    constructor() {
        this.userStats = new Map(); // userId -> { messageCount, warnings, lastMessage, username }
        this.mutedUsers = new Map(); // userId -> unmuteTime
    }

    getUserStats(userId) {
        if (!this.userStats.has(userId)) {
            this.userStats.set(userId, {
                messageCount: 0,
                warnings: 0,
                lastMessage: null,
                username: null
            });
        }
        return this.userStats.get(userId);
    }

    trackMessage(userId, username) {
        const stats = this.getUserStats(userId);
        stats.messageCount++;
        stats.lastMessage = new Date();
        if (username) stats.username = username;
    }

    isMuted(userId) {
        if (!this.mutedUsers.has(userId)) return false;

        const unmuteTime = this.mutedUsers.get(userId);
        if (Date.now() >= unmuteTime) {
            this.mutedUsers.delete(userId);
            return false;
        }
        return true;
    }

    muteUser(userId, duration, unit = 'm') {
        let muteTime;
        switch (unit) {
            case 'h': muteTime = duration * 60 * 60 * 1000; break;
            case 'd': muteTime = duration * 24 * 60 * 60 * 1000; break;
            default: muteTime = duration * 60 * 1000; // minutes
        }

        this.mutedUsers.set(userId, Date.now() + muteTime);
        return new Date(Date.now() + muteTime);
    }

    unmuteUser(userId) {
        return this.mutedUsers.delete(userId);
    }

    warnUser(userId) {
        const stats = this.getUserStats(userId);
        stats.warnings++;

        // Auto-mute after 3 warnings
        if (stats.warnings >= 3) {
            this.muteUser(userId, 60); // 1 hour
            return { warnings: stats.warnings, autoMuted: true };
        }

        return { warnings: stats.warnings, autoMuted: false };
    }

    findUserByUsername(username) {
        for (const [userId, stats] of this.userStats.entries()) {
            if (stats.username && stats.username.toLowerCase() === username.toLowerCase()) {
                return { id: userId, ...stats };
            }
        }
        return null;
    }

    getStats() {
        const totalUsers = this.userStats.size;
        const totalMessages = Array.from(this.userStats.values())
            .reduce((sum, stats) => sum + stats.messageCount, 0);
        const mutedCount = this.mutedUsers.size;
        const totalWarnings = Array.from(this.userStats.values())
            .reduce((sum, stats) => sum + stats.warnings, 0);

        return { totalUsers, totalMessages, mutedCount, totalWarnings };
    }
}

module.exports = new ModerationService();