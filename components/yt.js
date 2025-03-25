var auth = require('../auth.json');
var ytdl = require('@distube/ytdl-core');
var fs = require('fs');
const {google} = require('googleapis');

const YT_URL = "https://www.youtube.com/watch?v=";
const DL_PATH = __dirname + "/../audio/"

const MAX_SEARCH_RES = 10;
const MAX_AUDIO_SIZE = (500 * 1024 * 1024); // 100 MB

var ytHelp =
    "**!yt** <search>\n" +
    "--- Gets the first result from Youtube for the given search\n";

const youtube = google.youtube({
    version: 'v3',
    auth: auth.google_api_key
});

async function deleteExistingAudio(filename)
{
    let audioFiles = fs.readdirSync(DL_PATH);
    await Promise.all(audioFiles.map(async (file) =>
        {
            if (file.substring(0, file.indexOf(".")) === filename)
            {
                await fs.unlinkSync(DL_PATH + file);
            }
        }));
}

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
        throw "Video not found";
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
        throw "Error retrieving video";
        return;
    }

    let title = info.player_response.videoDetails.title;

    let audioFormats = ytdl.filterFormats(info.formats, "audioonly");
    if (!audioFormats)
    {
        console.error("YTDL: Failed to get audio formats");
        throw "Valid download format not found";
        return;
    }

    let format = ytdl.chooseFormat(audioFormats, {quality: "highestaudio"});
    if (!format)
    {
        console.error("YTDL: Failed to select audio format");
        throw "Valid download format not found"
        return;
    }

    if (format.contentLength > MAX_AUDIO_SIZE)
    {
        console.error("YTDL: Requested audio is too large");
        throw "Requested audio is too large";
        return;
    }

    let fullFileName = filename + "." + format.container;
    deleteExistingAudio(filename); // Delete audio that shares this name

    let writeStream = fs.createWriteStream(DL_PATH + fullFileName);
    let dlStream = ytdl.downloadFromInfo(info, {format: format})
    
    return new Promise((resolve, reject) =>
        {
            dlStream.on("error", (error) => 
            {
                console.error("YTDL: Failed download.");
                console.error(error);
                reject("Download failed");
            });

            dlStream.on("progress", (size, num, total) => 
                {
                    console.log("Size: " + size);
                    console.log("Num: " + num);
                    console.log("Total: " + total);
                });
            let pipeStream = dlStream.pipe(writeStream);
            pipeStream.on("finish", () =>
                {
                    resolve({
                        filename: fullFileName,
                        title: title
                    });
                });
        });
}

async function search(query)
{
    try
    {
        let res = await youtube.search.list({
            part: 'id,snippet',
            type: 'video',
            maxResults: MAX_SEARCH_RES,
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

        for (let i=0; i<MAX_SEARCH_RES; i++)
        {
            if (res.data.items[i].snippet.liveBroadcastContent == "live")
            {
                // Exclude livestreams
                continue;
            }
            return YT_URL + res.data.items[i].id.videoId;
        }

        return null;
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
