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
        let timeFull = (savedConn.currentAudio.playbackDuration + savedConn.startMs) / 1000;
        let timeMinutes = Math.floor(timeFull / 60);
        let timeSeconds = Math.floor(timeFull - (timeMinutes * 60));
        if (timeSeconds < 10) timeSeconds = "0" + timeSeconds;
        message.reply("Stopped at " + timeMinutes + ":" + timeSeconds);
    }

    savedConn.player.pause();
}

async function playNext(connection, message)
{

    let nextStreamInfo = connection.upNext.shift();
    try
    {
        stream = await playdl.stream_from_info(nextStreamInfo, {});
    }
    catch (error)
    {
        connection.upNext = [];

        console.error("Failed to start next song:");
        console.error(error);
    }

    try
    {
        await playStream(connection, stream, 0);

        if (message)
        {
            let nowPlayingReply = "Now playing: '" + nextStreamInfo.name + "'";
            message.reply(nowPlayingReply);
        }
    }
    catch(error)
    {
        connection.upNext = []; 
        console.error("Failed to play next song"); 
        console.error(error);
    }
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

    newVoiceConn.player.on('stateChange', (oldState, newState) =>
        {
            //console.log("STATE " + oldState.status + " => " + newState.status);
            if (newState.status == discordVoice.AudioPlayerStatus.Idle)
            {
                if (newVoiceConn.upNext && newVoiceConn.upNext.length >= 1)
                {
                    playNext(newVoiceConn);
                }
            }
        });

    voiceConnection.subscribe(newVoiceConn.player);

    newVoiceConn.aloneTimer = setInterval(() =>
        {
            if (channel.members.size <= 1) leaveChannel(channel.id);
        },
        ALONE_CHECK_INTERVAL_MS);

    savedVoiceConns[channel.id] = newVoiceConn;

    return savedVoiceConns[channel.id];
}

function shuffleTracks(tracks)
{
    let shuffled = []
    while (tracks.length >= 1)
    {
        let randTrackNum = Math.floor(Math.random() * tracks.length);
        shuffled.push(tracks[randTrackNum]);
        tracks.splice(randTrackNum, 1);
    }
    return shuffled;
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

function playYtStream(connection, ytFile, startMs)
{
    const resource = discordVoice.createAudioResource(
        ytFile,
        {
            inputType: discordVoice.StreamType.Arbitrary
        });

    connection.currentAudio = resource;
    connection.startMs = startMs;
    connection.player.play(resource);

    return discordVoice.entersState(connection.player, discordVoice.AudioPlayerStatus.Playing, 30000);
}

function playStream(connection, stream, startMs)
{
    const resource = discordVoice.createAudioResource(
        stream.stream,
        {
            inputType: stream.type 
        });

    connection.currentAudio = resource;
    connection.startMs = startMs;
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


var playHelp =
    "**!play** [option] <youtube_link | search_phrase> \n" +
    "--- Plays the audio from the given youtube url. Options are:\n" +
    "    'stop' - Stops current music\n" +
    "    'resume' - Resumes the last music that was stopped\n" + 
    "    'leave' - Stop music and makes the bot leave the voice channel\n" + 
    "    'from <minutes:seconds>' - Plays from the given start timestamp\n";

async function playCmd(message, args)
{
    let queryIndex = args[0].length + 1;
    let startTime = 0;
    let query = "";
    let ytUrl = null;

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

    if (args[1] == 'from')
    {
        let startMs = timeStrToMs(args[2]);
        if (isNaN(startMs) || (startMs < 0))
        {
            message.reply("Please give a time in the format minutes:seconds");
            return;
        }

        startTime = Math.floor(startMs / 1000);
        queryIndex = message.content.indexOf(args[2]) + args[2].length + 1; 
    }

    query = message.content.slice(queryIndex);
    if (query.includes("youtube.com"))
    {
        ytUrl = query.trim();
    }
    else
    {
        // Not given a url, search this term instead
        ytUrl = await yt.search(query);
    }

    if (!query)
    {
        message.reply("Unable to find video specified");
        return;
    }

    // Stop audio to avoid hearing a hiccup while the new file downloads
    stopPlayer(channel.id);

    let dlResult;
    try
    {
        dlResult = await yt.download(ytUrl, "audio-" + channel.id);
    }
    catch (e)
    {
        message.reply("Failed to obtain video: " + e);
        return;
    }

    if (!dlResult || !dlResult.filename)
    {
        message.reply("Failed to obtain audio");
        return;
    }

    let audioFile = AUDIO_DIR + dlResult.filename;
    
    if (startTime != 0)
    {
        // trim video start time
        await trimAudio(audioFile, startTime);
    }


    if (connection)
    {
        connection.title = dlResult.title;
    }

    let nowPlayingReply = "Now playing: '" + dlResult.title + "'";
    if (startTime > 0)
    {
        nowPlayingReply += " starting from " + Math.floor(startTime / 60) + ":";
        if ((startTime % 60) < 10) nowPlayingReply += "0";
        nowPlayingReply += startTime % 60;
    }
    message.reply(nowPlayingReply);

    try
    {
        await playYtStream(connection, audioFile, startTime * 1000);
    }
    catch(error)
    {
        
        message.reply("Encountered an error...");
        console.error("Failed to play audio"); 
        console.error(error);
    }
}

var musicHelp =
    "**!music** [options] <search_phrase | soundcloud_link> \n" +
    "--- Plays the audio from the given soundcloud url or search term. Options are:\n" +
    "    'stop' - Stops current music\n" +
    "    'resume' - Resumes the last music that was stopped\n" + 
    "    'leave' - Stop music and makes the bot leave the voice channel\n" + 
    "    'from <minutes:seconds>' - Plays from the given start timestamp\n";

async function musicCmd(message, args)
{
    let streamInfo = null;
    let stream = null;
    let queryIndex = args[0].length + 1;
    let startMs = 0;
    let shuffle = false;

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

    if (args[1] == 'shuffle')
    {
        shuffle = true;
        queryIndex = message.content.indexOf(args[1]) + args[1].length + 1; 
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

    if (args[1] == 'next')
    {
        playNext(connection, message);
        return;
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
    
    connection.upNext = [];
    if (streamInfo.type == 'playlist')
    {
        connection.upNext = await streamInfo.all_tracks();
        if (!connection.upNext || connection.upNext.length <= 0)
        {
            message.reply("Problem loading playlist");
            return;
        }

        if (shuffle)
        {
            connection.upNext = shuffleTracks(connection.upNext);
        }
        streamInfo = connection.upNext.shift();
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
        await playStream(connection, stream, startMs);
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

exports.music=
{
    help: musicHelp,
    cmd: musicCmd
};

exports.playPokeCall = playPokeCall;
