var porybase = require('./porybase.js');

function remindInit(porybot)
{
    porybase.getReminders()
    .then((reminders) =>
        {
            reminders.map((reminder) =>
                {
                    if (!reminder || !reminder.channelId) return;

                    porybot.channels.map((channel) => 
                    {
                        if (channel.id !== reminder.channelId) return;

                        let timeRelative = reminder.time - Date.now()
                        if (timeRelative <= 0)
                        {
                            sendReminder(reminder.id, channel, reminder.message);
                            return;
                        }
                        
                        channel.send("Loaded for: " + reminder.message);

                        setTimeout(() =>
                            {
                                sendReminder(reminder.id, channel, reminder.message);
                            },
                            timeRelative);
                    });
                });
        })
    .catch((err) =>
        {
            console.log("Failed to init reminders");
            console.log(err);
        });
}

function sendReminder(reminderId, channel, text)
{
    channel.send(text);

    porybase.removeReminder(reminderId)
        .then(() => 
            {
//                porybase.getReminders()
//                    .then((reminders) => console.log(reminders))
//                    .catch((err) => console.log("ERROR: " + err));
            })
        .catch((err) =>
            {
                console.log("Failed to remove reminder: ");
                console.log(err);
            });
}

function setReminder(channel, reminderId, timeMs, immediateText, laterText)
{
    porybase.getReminders()
        .then((reminders) => console.log(reminders))
        .catch((err) => console.log("ERROR: " + err));

    channel.send(immediateText);

    setTimeout(() =>
        {
            sendReminder(reminderId, channel, laterText);
        },
        timeMs);
}

var remindHelp =
    "**!remind** <number> <unit> <message>\n" +
    "--- Send a reminder. Ex: !remind 3 days Dont't forget to subscribe!\n";

function remindCmd(message, args)
{
    if (args < 4)
    {
        message.channel.send(remindHelp);
        return;
    }

    let text = "";
    for (let i=3; i<args.length; i++)
    {
        text += args[i] + " ";
    }

    text = message.author + " reminder: " + text;

    let timeMs = 0;
    let number = Number(args[1]);
    if (number == NaN)
    {
        message.channel.send(remindHelp);
        return;
    }

    let unit = args[2].toLowerCase();
    if (unit === 'seconds' || unit === 'second')
    {
        timeMs = number * 1000;
    }
    else if (unit === 'minutes' || unit === 'minute')
    {
        timeMs = number * 60 * 1000;
    }
    else if (unit == 'hours' || unit === 'hour')
    {
        timeMs = number * 60 * 60 * 1000;
    }
    else if (unit === 'days' || unit === 'day')
    {
        timeMs = number * 24 * 60 * 60 * 1000;
    }
    else if (unit === 'weeks' || unit === 'week')
    {
        timeMs = number * 7 * 24 * 60 * 60 * 1000;
    }
    else
    {
        message.channel.send("Please use minutes, hours, days, or weeks");
        return;
    }

    // Remove any plural s, it will be re-added if needed
    if (unit[unit.length-1] == 's')
    {
        unit = unit.slice(0, unit.length-1);

    }

    let immediateText = "Sending reminder in " + number + " " + unit +
        (number > 1 ? "s" : "");

    let absoluteTime = Date.now() + timeMs;

    porybase.addReminder(
        absoluteTime,
        text, 
        message.channel.id
    )
    .then((reminderId) =>
        {
            setReminder(message.channel, reminderId, timeMs, immediateText, text);
        })
    .catch((err) =>
        {
            console.log("Error adding reminder:");
            console.log(err);
        });
}

exports.help = remindHelp;
exports.cmd = remindCmd;
exports.init = remindInit; 
