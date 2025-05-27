const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.resolve(__dirname, 'botdata.sqlite');
const db = new sqlite3.Database(dbPath);

db.serialize(() => {
  // Create users table if not exists
  db.run(`
    CREATE TABLE IF NOT EXISTS users (
      user_id INTEGER PRIMARY KEY,
      username TEXT UNIQUE,
      message_count INTEGER DEFAULT 0,
      warnings INTEGER DEFAULT 0,
      join_date INTEGER,
      last_message INTEGER,
      is_muted INTEGER DEFAULT 0,
      mute_until INTEGER
    )
  `);
});

module.exports = {
  findUserByUsername: (username) => {
    return new Promise((resolve, reject) => {
      db.get(`SELECT * FROM users WHERE username = ?`, [username], (err, row) => {
        if (err) return reject(err);
        resolve(row);
      });
    });
  },

  addWarning: (userId, reason, issuerId) => {
    return new Promise((resolve, reject) => {
      // Increase warning count
      db.run(`UPDATE users SET warnings = warnings + 1 WHERE user_id = ?`, [userId], function(err) {
        if (err) return reject(err);

        db.get(`SELECT * FROM users WHERE user_id = ?`, [userId], (err, user) => {
          if (err) return reject(err);
          // Optionally, insert the warning reason somewhere else, or log it
          resolve(user);
        });
      });
    });
  },

  muteUser: (userId, muteUntil) => {
    return new Promise((resolve, reject) => {
      const muteUntilTs = muteUntil.getTime();
      db.run(`UPDATE users SET is_muted = 1, mute_until = ? WHERE user_id = ?`, [muteUntilTs, userId], function(err) {
        if (err) return reject(err);
        resolve();
      });
    });
  },

  unmuteUser: (userId) => {
    return new Promise((resolve, reject) => {
      db.run(`UPDATE users SET is_muted = 0, mute_until = NULL WHERE user_id = ?`, [userId], function(err) {
        if (err) return reject(err);
        resolve();
      });
    });
  },

  getChatStats: () => {
    return new Promise((resolve, reject) => {
      db.get(`SELECT 
                COUNT(*) as total_users,
                SUM(message_count) as total_messages,
                SUM(CASE WHEN is_muted = 1 THEN 1 ELSE 0 END) as muted_users,
                SUM(warnings) as total_warnings
              FROM users`, [], (err, stats) => {
        if (err) return reject(err);
        resolve(stats);
      });
    });
  },

  getTopMessageSenders: (limit) => {
    return new Promise((resolve, reject) => {
      db.all(`SELECT * FROM users ORDER BY message_count DESC LIMIT ?`, [limit], (err, rows) => {
        if (err) return reject(err);
        resolve(rows);
      });
    });
  }
};
