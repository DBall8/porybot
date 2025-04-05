var discordVoice = require('@discordjs/voice');
var yt = require('./yt.js');
var ffmpeg = require('fluent-ffmpeg');
var path = require('path');
var fs = require('fs');
var playdl = require('play-dl');

var gnomeHelp =
    "**!gnome** [leave]\n" +
    "--- Joins a voice channel to periodically 'woo', use '!gnome leave' to make it stop\n";

const AUDIO_DIR = __dirname + "/../audio/";
const GNOME_WAV = AUDIO_DIR + "gnome-reverb.wav";
const gnomePlayer = discordVoice.createAudioPlayer();

const HOUR_MS = 1000 * 60 * 60;
const DEFAULT_MIN_TIME = HOUR_MS * 0.25;
const DEFAULT_MAX_TIME = HOUR_MS * 1;

var gnomeTimer = null;
var minTime = DEFAULT_MIN_TIME;
var maxTime = DEFAULT_MAX_TIME;

var ALONE_CHECK_INTERVAL_MS = 5 * 60 * 1000;

var savedVoiceConns = {};

playdl.getFreeClientID().then((clientID) => {
    playdl.setToken({
      soundcloud : {client_id : clientID}
    });
    console.log("Soundcloud ready");
})

function getSavedConnection(channelId)
{
    if (!(channelId in savedVoiceConns) ||
        !savedVoiceConns[channelId])
    {
        return null;
    }
    
    return savedVoiceConns[channelId];
}

function stopPlayer(channelId, message)
{
    let savedConn = getSavedConnection(channelId);
    if (!savedConn) return;
    if (!savedConn.player) return;

    if (savedConn.currentAudio && message)
    {
        let timeFull = savedConn.currentAudio.playbackDuration / 1000;
        let timeMinutes = Math.floor(timeFull / 60);
        let timeSeconds = Math.floor(timeFull - (timeMinutes * 60));
        if (timeSeconds < 10) timeSeconds = "0" + timeSeconds;
        message.reply("Stopped at " + timeMinutes + ":" + timeSeconds);
    }

    savedConn.player.pause();
}

function leaveChannel(channelId)
{
    let savedConn = getSavedConnection(channelId);
    if (!savedConn) return;

    if (savedConn.player)
    {
        savedConn.player.stop();
    }

    if (savedConn.voice)
    {
        savedConn.voice.destroy();
    }

    if (savedConn.aloneTimer)
    {
        clearTimeout(savedVoiceConns[channelId].aloneTimer);
    }

    delete savedVoiceConns[channelId];
}

async function joinChannel(channel)
{
    let existingConn = getSavedConnection(channel.id);
    if (existingConn)
    {
        return existingConn;
    }

    let voiceConnection = discordVoice.joinVoiceChannel({
        channelId: channel.id,
        guildId: channel.guild.id,
        adapterCreator: channel.guild.voiceAdapterCreator
    });

    try
    {
        await discordVoice.entersState(voiceConnection, discordVoice.VoiceConnectionStatus.Ready, 30000);
    }
    catch (error)
    {
        connection.destroy();
        throw error;
        return;
    }

    let newVoiceConn = {};
    newVoiceConn.voice = voiceConnection;

    voiceConnection.on(discordVoice.VoiceConnectionStatus.Disconnected, (oldState, newState) =>
        {
            stopPlayer(channel.id);
        });


    newVoiceConn.player = discordVoice.createAudioPlayer();
    newVoiceConn.player.on('error', (error) =>
        {
            console.error("Player error:");
            console.error(error);
        });

//    newVoiceConn.player.on('stateChange', (oldState, newState) =>
//        {
//            console.log("STATE " + oldState.status + " => " + newState.status);
//        });

    voiceConnection.subscribe(newVoiceConn.player);

    newVoiceConn.aloneTimer = setInterval(() =>
        {
            if (channel.members.size <= 1) leaveChannel(channel.id);
        },
        ALONE_CHECK_INTERVAL_MS);

    savedVoiceConns[channel.id] = newVoiceConn;

    return savedVoiceConns[channel.id];
}

async function playSound(channelId, soundFile)
{
    let wasAudioPaused = false;
    let conn = getSavedConnection(channelId);
    if (!conn)
    {
        console.error("Could not play audio, channel does not exist");
        return;
    }

    const resource = discordVoice.createAudioResource(
        soundFile,
        {
            inputType: discordVoice.StreamType.Arbitrary
        });

    if (conn.player && conn.player.state.status === 'playing')
    {
        conn.player.pause()
        wasAudioPaused = true;
    }

    let tempPlayer = discordVoice.createAudioPlayer();
    conn.voice.subscribe(tempPlayer);
    tempPlayer.play(resource);

    try
    {
        await discordVoice.entersState(tempPlayer, discordVoice.AudioPlayerStatus.Playing, 30000);
        await discordVoice.entersState(tempPlayer, discordVoice.AudioPlayerStatus.Idle, 30000);
    }
    catch (error)
    {
        console.error("Short audio error:");
        console.error(error);
    }

    if (conn.player)
    {
        conn.voice.subscribe(conn.player);
        if (wasAudioPaused) conn.player.unpause();
    }

    tempPlayer.stop();
}

function playGnomeSound(connection)
{
}

function playStream(connection, stream)
{
    const resource = discordVoice.createAudioResource(
        stream.stream,
        {
            inputType: stream.type 
        });

    connection.currentAudio = resource;
    connection.player.play(resource);

    return discordVoice.entersState(connection.player, discordVoice.AudioPlayerStatus.Playing, 30000);
}

async function trimAudio(audioFilePath, startS)
{
    audioFilePath = path.resolve(audioFilePath);
    let extensionIndex = audioFilePath.indexOf(".");
    let newFilePath = audioFilePath.substring(0, extensionIndex) + "-cut" + audioFilePath.substring(extensionIndex);

    try
    {
        await new Promise((res, rej) =>
            {
                ffmpeg({source: audioFilePath})
                    .setStartTime(startS)
                    .output(newFilePath)
                    .on('error', (error) =>
                        {
                            console.error("Trim error");
                            console.error(error);
                            rej(null);
                        })
                    .on('end', () =>
                        {
                            res();
                        })
                    .run();
            });

        // Move new cut file back to the original location
        fs.renameSync(newFilePath, audioFilePath);
    }
    catch (e) { return; }
}

function timeStrToMs(timeStr)
{
    let timeComponents = timeStr.split(':');
    if (timeComponents.length != 2)
    {
        return NaN;
    }

    let timeMs = (parseInt(timeComponents[0], 10) * 60) + parseInt(timeComponents[1], 10);
    timeMs *= 1000;
    return timeMs;
}

function isGnomeActive(channelId)
{
    for (let i=0; i<activeGnomeChannels.length; i++)
    {
        if (activeGnomeChannels[i] === channelId)
        {
            return true;
        }
    }

    return false;
}

async function gnomeLoop(channelId)
{
    let conn = getSavedConnection(channelId);
    if (!conn) return;

    if (conn.gnomeTimer)
    {
        clearTimeout(conn.gnomeTimer);
    }

    playSound(channelId, GNOME_WAV);

    let delay = (Math.random() * (maxTime - minTime)) + minTime;
    conn.gnomeTimer = setTimeout(
        () => {gnomeLoop(channelId)},
        delay);
}


async function gnomeCommand(message, args)
{
    let channel = message.member?.voice.channel;
    if (!channel)
    {
        message.reply("Please join the voice channel you would wish to start gnoming in.");
        return;
    }

    if (args[1] === "leave")
    {
        leaveChannel(channel.id);
        return;
    }

    minTime = DEFAULT_MIN_TIME;
    maxTime = DEFAULT_MAX_TIME;

    if (args.length >= 3)
    {
        let newMin = Number(args[1]);
        let newMax = Number(args[2]);
        if (newMin != NaN && newMax != NaN)
        {
            message.reply("Random: [" + newMin + "," + newMax + "] hours");
            minTime = newMin * HOUR_MS;
            maxTime = newMax * HOUR_MS;
        }
    } 

    let connection;
    try
    {
        connection = await joinChannel(channel);
    }
    catch (error)
    {
        message.reply("Encountered an error, sorry");
        console.error("Failed to join voice channel:");
        console.error(error);
        return;
    }

    gnomeLoop(channel.id);
}


//var playHelp =
//    "**!music** <option>\n" +
//    "--- Plays the audio from the given youtube url. Options are:\n" +
//    "    play [youtube_link | search_phrase] - starts playing music from a link or search term\n" +
//    "    playfrom <start_time_minutes> <youtube_link | search_phrase> - Plays starting from given minute mark\n" +
//    "    stop - Stops current music. Enter '!music play' to resume\n" +
//    "    leave - Stop music and makes the bot leave the voice channel\n";
//
//async function playCmd(message, args)
//{
//    if (args.length < 2)
//    {
//        message.reply("Please include a youtube linke, or 'stop' or 'leave' to stop playing music");
//        return;
//    }
//
//    let channel = message.member?.voice.channel;
//    if (!channel)
//    {
//        message.reply("Please join a voice channel first.");
//        return;
//    }
//
//    if (args[1] === 'stop')
//    {
//        stopPlayer(channel.id);
//        return;
//    }
//
//    if (args[1] === 'leave')
//    {
//        leaveChannel(channel.id);
//        return;
//    }
//
//    if ((args[1] != 'play') && (args[1] != 'playfrom'))
//    {
//        message.reply("Invalid command!");
//        return;
//    }
//        
//    if ((args[1] === 'play') && (args.length == 2)) // Not given anything to play, so attemtp to resume previous
//    {
//        let connection = getSavedConnection(channel.id);
//        if (connection && connection.player)
//        {
//            connection.player.unpause();
//            message.reply("Resuming: " + connection.title);
//        }
//        else
//        {
//            message.reply("Nothing to play, please give a youtube link or search phrase");
//        }
//        return;
//    }
//
//    let ytUrl = args[2];
//    let startTime = 0;
//    let queryIndex = args[0].length + 1 + args[1].length + 1;
//
//    if (args[1] === 'playfrom')
//    {
//        // Factor in the additional time argument
//        let timeComponents = args[2].split(':');
//        if (timeComponents.length != 2)
//        {
//            message.reply("Please give a time in the format minutes:seconds");
//            return;
//        }
//
//        startTime = (parseInt(timeComponents[0], 10) * 60) + parseInt(timeComponents[1], 10);
//        if (isNaN(startTime))
//        {
//            message.reply("Please give a time in the format minutes:seconds");
//            return;
//        }
//
//        ytUrl = args[3];
//        queryIndex += args[2].length + 1; 
//    }
//
//    if (!ytUrl.includes("youtube.com"))
//    {
//        // Not given a url, search this term instead
//        let query = message.content.slice(queryIndex);
//        ytUrl = await yt.search(query);
//    }
//
//    if (!ytUrl)
//    {
//        message.reply("Unable to find video specified");
//        return;
//    }
//
//    // Stop audio to avoid hearing a hiccup while the new file downloads
//    stopPlayer(channel.id);
//
//    let dlResult;
//    try
//    {
//        dlResult = await yt.download(ytUrl, "audio-" + channel.id);
//    }
//    catch (e)
//    {
//        message.reply("Failed to obtain video: " + e);
//        return;
//    }
//
//    if (!dlResult || !dlResult.filename)
//    {
//        message.reply("Failed to obtain audio");
//        return;
//    }
//
//    let audioFile = AUDIO_DIR + dlResult.filename;
//    
//    if (startTime != 0)
//    {
//        // trim video start time
//        await trimAudio(audioFile, startTime);
//    }
//
//    let connection = getSavedConnection(channel.id);
//    if (!connection)
//    {
//        try
//        {
//            connection = await joinChannel(channel);
//        }
//        catch (error)
//        {
//            message.reply("Encountered an error...");
//            console.error("Failed to subscribe call player");
//            console.error(error);
//            return;
//        }
//    }
//
//    if (connection)
//    {
//        connection.title = dlResult.title;
//    }
//
//    let nowPlayingReply = "Now playing: '" + dlResult.title + "'";
//    if (startTime > 0)
//    {
//        nowPlayingReply += " starting from " + Math.floor(startTime / 60) + ":";
//        if ((startTime % 60) < 10) nowPlayingReply += "0";
//        nowPlayingReply += startTime % 60;
//    }
//    message.reply(nowPlayingReply);
//
//    try
//    {
//        await playSound(connection.player, audioFile);
//    }
//    catch(error)
//    {
//        
//        message.reply("Encountered an error...");
//        console.error("Failed to play audio"); 
//        console.error(error);
//    }
//}

var playHelp =
    "**!play** [options] <search_phrase | soundcloud_link> \n" +
    "--- Plays the audio from the given soundcloud url or search term. Options are:\n" +
    "    'stop' - Stops current music\n" +
    "    'resume' - Resumes the last music that was stopped\n" + 
    "    'leave' - Stop music and makes the bot leave the voice channel\n" + 
    "    'from <minutes:seconds>' - Plays from the given start timestamp\n";

async function playCmd(message, args)
{
    let streamInfo = null;
    let stream = null;
    let queryIndex = args[0].length + 1;
    let startMs = 0;

    if (args.length < 2)
    {
        message.reply("Please include a youtube linke, or 'stop' or 'leave' to stop playing music");
        return;
    }

    let channel = message.member?.voice.channel;
    if (!channel)
    {
        message.reply("Please join a voice channel first.");
        return;
    }

    if (args[1] === 'stop')
    {
        stopPlayer(channel.id, message);
        return;
    }

        

    if (args[1] === 'leave')
    {
        leaveChannel(channel.id);
        return;
    }

    if (args[1] == 'from')
    {
        startMs = timeStrToMs(args[2]);
        if (isNaN(startMs) || (startMs < 0))
        {
            message.reply("Please give a time in the format minutes:seconds");
            return;
        }

        queryIndex = message.content.indexOf(args[2]) + args[2].length + 1; 
    }

    // Stop audio to avoid hearing a hiccup while the new file downloads
    stopPlayer(channel.id);

    let connection = getSavedConnection(channel.id);
    if (!connection)
    {
        try
        {
            connection = await joinChannel(channel);
        }
        catch (error)
        {
            message.reply("Encountered an error...");
            console.error("Failed to subscribe call player");
            console.error(error);
            return;
        }
    }

    if (args[1] === 'resume')
    {
        connection.player.unpause();
        return;
    }

    let query = message.content.slice(queryIndex);
    if (query.includes("soundcloud.com"))
    {
        try
        {
            streamInfo = await playdl.soundcloud(query);
        }
        catch (error)
        {
            message.reply("Could not find link on soundcloud");
            console.error("Soundcloud url lookup failed:");
            console.error(error);
        }
    }
    else
    {
        try
        {
            let searchResults = await playdl.search(query, {
                source: { soundcloud: 'tracks' }});
            streamInfo = searchResults[0];
        }
        catch (error)
        {
            message.reply("Could not find search on Soundcloud");
            console.error("Soundcloud search failed:");
            console.error(error);
        }
    }

    let nowPlayingReply = "Now playing: '" + streamInfo.name + "'";
    message.reply(nowPlayingReply);

    let streamOptions = {};
    if (startMs > 0)
    {
        streamOptions.seek = Math.floor(startMs / 1000);
    }

    try
    {
        stream = await playdl.stream_from_info(streamInfo, streamOptions);
    }
    catch (error)
    {
        message.reply("Failed to stream from soundcloud");
        console.error("Get stream from soundcloud failed:");
        console.error(error);
    }

    try
    {
        await playStream(connection, stream);
    }
    catch(error)
    {
        
        message.reply("Encountered an error...");
        console.error("Failed to play audio"); 
        console.error(error);
    }
}
async function playPokeCall(message, audioFile)
{

    let channel = message.member?.voice.channel;
    if (!channel)
    {
        message.reply("Please join a voice channel first.");
        return;
    }

    let connection = null;
    try
    {
        connection = await joinChannel(channel);
    }
    catch (error)
    {
        message.reply("Encountered an error...");
        console.error("Failed to join voice channel");
        console.error(error);
        return;
    }

    if (!connection)
    {
        message.reply("Something went wrong, try again later...");
        return;
    }

    try
    {
        await playSound(channel.id, audioFile);
    }
    catch(error)
    {
        
        message.reply("Encountered an error...");
        console.error("Failed to play audio"); 
        console.error(error);
    }
}

exports.gnome =
{
    help: gnomeHelp,
    cmd:  gnomeCommand
};

exports.play =
{
    help: playHelp,
    cmd: playCmd
};

exports.playPokeCall = playPokeCall;
