const sqlite3 = require('sqlite3').verbose(); const path = require('path'); const dbPath = path.resolve(__dirname, 'botdata.sqlite'); const db = new sqlite3.Database(dbPath);

// Create the users table if it doesn't exist
db.serialize(() => {
    db.run(` CREATE
    TABLE IF
    NOT EXISTS
    users (
    user_id INTEGER
    PRIMARY KEY,
    username TEXT
    UNIQUE,
    message_count INTEGER
    DEFAULT 0,
    warnings INTEGER
    DEFAULT 0,
    join_date INTEGER,
    last_message INTEGER,
    mute_until INTEGER
    ) `);
});

// Track user messages
function trackMessage(userId, username) {
    const now
    = Date.now();
    return new
    Promise((resolve,
    reject) =>
    {
        db.run( `INSERT
        INTO users
        ( user_id,
        username,
        message_count,
        join_date,
        last_message )
        VALUES (?,
        ?,
        1,
        ?,
        ?) ON
        CONFLICT(user_id) DO
        UPDATE SET
        message_count =
        message_count +
        1,
        last_message =
        excluded.last_message,
        username =
        excluded.username`,
        [ userId, username, now, now ],
        function (err)
        {
            if (err)
            return reject(err);
            resolve();
        }
        );
    }
    );
}

// Find a user by username
function findUserByUsername(username) {
    return new
    Promise((resolve,
    reject) =>
    {
        db.get(`SELECT *
        FROM users
        WHERE username
        = ?`,
        [ username ],
        (err,
        row) =>
        {
            if (err)
            return reject(err);
            resolve(row);
        }
        );
    }
    );
}

// Add a warning to a user
function addWarning(userId) {
    return new
    Promise((resolve,
    reject) =>
    {
        db.run( `UPDATE
        users SET
        warnings =
        warnings +
        1 WHERE
        user_id =
        ?`,
        [ userId ],
        function (err)
        {
            if (err)
            return reject(err);

            db.get(`SELECT *
            FROM users
            WHERE user_id
            = ?`,
            [ userId ],
            (err,
            user) =>
            {
                if (err)
                return reject(err);
                resolve(user);
            }
            );
        }
        );
    }
    );
}




function getChatStats() {
    return new Promise((resolve, reject) => {
        db.get(
            `SELECT 
                COUNT(*) as total_users,
                SUM(message_count) as total_messages,
                SUM(warnings) as total_warnings
            FROM users`,
            [],
            (err, stats) => {
                if (err) return reject(err);
                resolve(stats);
            }
        );
    });
}


// Get a user by ID
function getUserById(userId) {
    return new
    Promise((resolve,
    reject) =>
    {
        db.get(`SELECT *
        FROM users
        WHERE user_id
        = ?`,
        [ userId ],
        (err,
        row) =>
        {
            if (err)
            return reject(err);
            resolve(row);
        }
        );
    }
    );
}

// Export everything
module.exports = {
    trackMessage,
    findUserByUsername,
    addWarning,
    getUserById,
    getChatStats
};
