var auth = require('../auth.json');
const {google} = require('googleapis');

const YT_URL = "https://www.youtube.com/watch?v=";

var ytHelp =
    "**!yt** <search>\n" +
    "--- Gets the first result from Youtube for the given search\n";

const youtube = google.youtube({
    version: 'v3',
    auth: auth.google_api_key
});

function ytCmd(message, args)
{
    if (args.length <= 1)
    {
        message.reply(ytHelp);
        return;
    }

    let query = message.content.slice(args[0].length + 1); // +1 for space

    youtube.search.list({
        part: 'id,snippet',
        type: 'video',
        maxResults: 1,
        q: query
    }).then((res) =>
    {
        if (!res || (res.status != 200)) 
        {
            console.log(res);
            message.reply("Sorry, could not reach youtube.\n");
            return;
        }

        if (!res.data || !res.data.items || (res.data.items.length < 1))
        {
            console.log(res);
            message.reply("Sorry, something went wrong.");
            return;
        }

        let url = YT_URL + res.data.items[0].id.videoId;
        message.reply(url);
        
    }).catch((err) =>
    {
        console.error(err);
    });
}

exports.help = ytHelp;
exports.cmd = ytCmd;
