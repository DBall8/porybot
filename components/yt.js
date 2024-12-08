var auth = require('../auth.json');
var ytdl = require('@distube/ytdl-core');
var fs = require('fs');
const {google} = require('googleapis');

const YT_URL = "https://www.youtube.com/watch?v=";
const DL_PATH = __dirname + "/../audio/"

const MAX_AUDIO_SIZE = (100 * 1024 * 1024); // 100 MB

var ytHelp =
    "**!yt** <search>\n" +
    "--- Gets the first result from Youtube for the given search\n";

const youtube = google.youtube({
    version: 'v3',
    auth: auth.google_api_key
});

async function download(url, filename)
{
    let videoId;
    let info;

    try
    {
        videoId = await ytdl.getVideoID(url);
    }
    catch (e)
    {
        console.error("YTDL: Failed to get video ID");
        console.error(e);
        return;
    }

    try
    {
        info = await ytdl.getInfo(videoId);
    }
    catch (e)
    {
        console.error("YTDL: Failed to get video metadata");
        console.error(e);
        return;
    }

    let title = info.player_response.videoDetails.title;

    let audioFormats = ytdl.filterFormats(info.formats, "audioonly");
    if (!audioFormats)
    {
        console.error("YTDL: Failed to get audio formats");
        return;
    }

    let format = ytdl.chooseFormat(audioFormats, {quality: "highestaudio"});
    if (!format)
    {
        console.error("YTDL: Failed to select audio format");
        return;
    }

    if (format.contentLength > MAX_AUDIO_SIZE)
    {
        console.error("YTDL: Requested audio is too large");
        return;
    }

    let fullFileName = filename + "." + format.container;
    let writeStream = fs.createWriteStream(DL_PATH + fullFileName);
    let dlStream = ytdl.downloadFromInfo(info, {format: format})
    
    dlStream.on("error", (error) => 
        {
            console.error("YTDL: Failed download.");
            console.error(error);
        });
    await dlStream.pipe(writeStream);

    return {
        filename: fullFileName,
        title: title
    };
}

async function search(query)
{

    try
    {
        let res = await youtube.search.list({
            part: 'id,snippet',
            type: 'video',
            maxResults: 1,
            q: query
        });

        if (!res || (res.status != 200)) 
        {
            console.error("YT search bad result:");
            console.error(res);
            return;
        }

        if (!res.data || !res.data.items || (res.data.items.length < 1))
        {
            console.error("YT search bad data");
            console.error(res);
            return;
        }

        let url = YT_URL + res.data.items[0].id.videoId;
        return url;
    } 
    catch(err)
    {
        console.error("YT search error:");
        console.error(err);
        return null;
    }
}

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
exports.download = download;
exports.search = search;
