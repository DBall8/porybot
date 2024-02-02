var sqlite = require('sqlite3');

var DB_PATH = "./porybase.db";

var Database = null;

function initTables()
{
    return new Promise((resolve, reject) =>
        {
            if (Database == null)
            {
                reject("DB init failed.");
                return;
            }

            Database.run(
                "CREATE TABLE IF NOT EXISTS reminders (" +
                "id INTEGER PRIMARY KEY AUTOINCREMENT, " +
                "channelId TEXT, " +
                "time INTEGER, " +
                "message TEXT);",
                (err) =>
                {
                    if (err)
                    {
                        reject(err);
                        return;
                    }
                    resolve();
                });
        });
}

function init()
{
    return new Promise((resolve, reject) =>
        {
            Database = new sqlite.Database(DB_PATH,
                sqlite.OPEN_CREATE | sqlite.OPEN_READWRITE,
                (err) =>
                {
                    if (err)
                    {
                        reject(err);
                        return
                    }
                    initTables().then(() => resolve()).catch((err) => reject(err));
                });
        });
}

function getReminders()
{
    return new Promise((resolve, reject) =>
        {
            if (Database == null)
            {
                reject("Database not initialized.");
                return;
            }

            Database.all("SELECT * FROM reminders;",
                (err, reminders) =>
                {
                    if (err)
                    {
                        reject(err);
                        return;
                    }
                    resolve(reminders)
                });
        });
}

function addReminder(time, message, channelId)
{
    return new Promise((resolve, reject) =>
        {
            if (Database == null)
            {
                reject("Database not initialized");
                return;
            }

            Database.run(`INSERT INTO reminders (channelId, time, message) VALUES ('${channelId}', '${time}', '${message}');`,
                (err) =>
                {
                    if (err)
                    {
                        reject(err);
                        return;
                    }
                    Database.get("SELECT LAST_INSERT_ROWID();",
                        (err, reminderId) =>
                        {
                            if (err)
                            {
                                reject(err);
                                return;
                            }

                            if (!reminderId || !reminderId['LAST_INSERT_ROWID()'])
                            {
                                reject("Could not get ID for new reminder");
                                return;
                            }

                            resolve(reminderId['LAST_INSERT_ROWID()']);
                        });
                });
        });
}

function removeReminder(reminderId)
{
    return new Promise((resolve, reject) =>
        {
            if (Database == null)
            {
                reject("Database not initialized");
                return;
            }

            Database.run(`DELETE FROM reminders WHERE id=${reminderId};`,
                (err) =>
                {
                    if (err)
                    {
                        reject(err);
                        return;
                    }
                    resolve();
                });
        });
}

exports.init = init;
exports.getReminders = getReminders;
exports.addReminder = addReminder;
exports.removeReminder = removeReminder;
