var discordVoice = require('@discordjs/voice');
var yt = require('./yt.js');
var ffmpeg = require('fluent-ffmpeg');
var path = require('path');
var fs = require('fs');

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

var ALONE_CHECK_INTERVAL_MS = 5000;

var activeGnomeChannels = [];
var channelStates = {};

function checkAlone(channelId)
{
    if (!channelStates[channelId] || !channelStates[channelId].voice)
    {
        return;
    }
//    console.log(channelStates[channelId].voice);
    console.log(channelStates[channelId].voice.members);
}

function addChannelState(channelId, voiceConn, player, title)
{

    voiceConn.on(discordVoice.VoiceConnectionStatus.Disconnected, (oldState, newState) =>
        {
            stopPlayer(channelId, true);
        });

    aloneTimer = setInterval(() => checkAlone(channelId), ALONE_CHECK_INTERVAL_MS);

    channelStates[channelId] = 
        {
            voice: voiceConn,
            player: player,
            title:  title,
            aloneTimer: aloneTimer 
        };
}

function stopPlayer(channelId, shouldLeave)
{
    if (!(channelId in channelStates))
    {
        return;
    }

    if (!channelStates[channelId])
    {
        delete channelStates[channelId];
        return;
    }

    if (channelStates[channelId].player)
    {
        channelStates[channelId].player.pause();
    }

    if (shouldLeave && channelStates[channelId].voice)
    {
        channelStates[channelId].player.stop();
        channelStates[channelId].voice.destroy();
        channelStates[channelId].title = "";
        clearTimeout(channelStates[channelId].aloneTimer);
        delete channelStates[channelId];
    }
}


function getChannelState(channelId)
{
    if (!(channelId in channelStates) ||
        !channelStates[channelId])
    {
        return null;
    }
    
    return channelStates[channelId];
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

async function gnomeLoop()
{
    if (gnomeTimer)
    {
        clearTimeout(gnomeTimer);
    }

    try
    {
        await playSound(gnomePlayer, GNOME_WAV);
    }
    catch(error)
    {
        console.error("Failed to play audio:");
        console.error(error);
    }

    let delay = (Math.random() * (maxTime - minTime)) + minTime;
    gnomeTimer = setTimeout(gnomeLoop, delay);
}

function playSound(player, soundFile)
{
    const resource = discordVoice.createAudioResource(
        soundFile,
        {
            inputType: discordVoice.StreamType.Arbitrary
        });

    player.play(resource);

    return discordVoice.entersState(player, discordVoice.AudioPlayerStatus.Playing, 30000);
}

async function joinChannel(channel)
{
    let connection = discordVoice.joinVoiceChannel({
        channelId: channel.id,
        guildId: channel.guild.id,
        adapterCreator: channel.guild.voiceAdapterCreator
    });

    try
    {
        await discordVoice.entersState(connection, discordVoice.VoiceConnectionStatus.Ready, 30000);
        return connection;
    }
    catch (error)
    {
        connection.destroy();
        throw error;
    }
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
        let voiceConnection = discordVoice.getVoiceConnection(message.guild.id);
        if (voiceConnection)
        {
            voiceConnection.destroy();
        }
        activeGnomeChannels = activeGnomeChannels.filter((id) => { return id != channel.id; });
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

    try
    {
        voiceConnection = await joinChannel(channel);
        voiceConnection.subscribe(gnomePlayer);
    }
    catch (error)
    {
        message.reply("Encountered an error, sorry");
        console.error("Failed to join voice channel:");
        console.error(error);
    }

    activeGnomeChannels.push(channel.id);
    gnomeLoop(message.guild.id);
}


var playHelp =
    "**!music** <option>\n" +
    "--- Plays the audio from the given youtube url. Options are:\n" +
    "    play [youtube_link | search_phrase] - starts playing music from a link or search term\n" +
    "    playfrom <start_time_minutes> <youtube_link | search_phrase> - Plays starting from given minute mark\n" +
    "    stop - Stops current music. Enter '!music play' to resume\n" +
    "    leave - Stop music and makes the bot leave the voice channel\n";

async function playCmd(message, args)
{
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
        stopPlayer(channel.id, false);
        return;
    }

    if (args[1] === 'leave')
    {
        stopPlayer(channel.id, true);
        return;
    }

    if ((args[1] != 'play') && (args[1] != 'playfrom'))
    {
        message.reply("Invalid command!");
        return;
    }
        
    if ((args[1] === 'play') && (args.length == 2)) // Not given anything to play, so attemtp to resume previous
    {
        let channelState = getChannelState(channel.id);
        if (channelState && channelState.player)
        {
            channelState.player.unpause();
            message.reply("Resuming: " + channelState.title);
        }
        else
        {
            message.reply("Nothing to play, please give a youtube link or search phrase");
        }
        return;
    }

    let ytUrl = args[2];
    let startTime = 0;
    let queryIndex = args[0].length + 1 + args[1].length + 1;

    if (args[1] === 'playfrom')
    {
        // Factor in the additional time argument
        let timeComponents = args[2].split(':');
        if (timeComponents.length != 2)
        {
            message.reply("Please give a time in the format minutes:seconds");
            return;
        }

        startTime = (parseInt(timeComponents[0], 10) * 60) + parseInt(timeComponents[1], 10);
        if (isNaN(startTime))
        {
            message.reply("Please give a time in the format minutes:seconds");
            return;
        }

        ytUrl = args[3];
        queryIndex += args[2].length + 1; 
    }

    if (!ytUrl.includes("youtube.com"))
    {
        // Not given a url, search this term instead
        let query = message.content.slice(queryIndex);
        ytUrl = await yt.search(query);
    }

    if (!ytUrl)
    {
        message.reply("Unable to find video specified");
        return;
    }

    let channelState = getChannelState(channel.id);
    if (channelState && channelState.player)
    {
        // Stop audio to avoid hearing a hiccup while the new file downloads
        channelState.player.stop();
    }

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

    let voiceConnection = null;
    let ytPlayer = null;

    if (channelState && channelState.player)
    {
        ytPlayer = channelState.player;
    }
    else
    {
        ytPlayer = discordVoice.createAudioPlayer();
        ytPlayer.on('error', (error) =>
            {
                console.error("Player error:");
                console.error(error);
            });

        ytPlayer.on('stateChange', (oldState, newState) =>
            {
                console.log("STATE " + oldState.status + " => " + newState.status);
            });
    }

    if (channelState && channelState.voice)
    {
        voiceConnection = channelState.voice;
    }
    else
    {
        try
        {
            voiceConnection = await joinChannel(channel);
            voiceConnection.subscribe(ytPlayer);
        }
        catch (error)
        {
            message.reply("Encountered an error...");
            console.error("Failed to subscribe call player");
            console.error(error);
            return;
        }
    }

    if (channelState)
    {
        channelState.title = dlResult.title;
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
        if (!channelState)
        {
            addChannelState(channel.id, voiceConnection, ytPlayer, dlResult.title);
        }
        await playSound(ytPlayer, audioFile);
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

    let voiceConnection = null;
    let callPlayer = discordVoice.createAudioPlayer();
    try
    {
        voiceConnection = await joinChannel(channel);
        voiceConnection.subscribe(callPlayer);
    }
    catch (err)
    {
        message.reply("Encountered an error...");
        console.error("Failed to subscribe call player");
        console.error(error);
    }

    try
    {
        callPlayer.on(discordVoice.AudioPlayerStatus.Idle, () =>
            {
                callPlayer.stop();
                if (!isGnomeActive(channel.id))
                {
                    voiceConnection.destroy();
                } 

            });
        await playSound(callPlayer, audioFile);
    }
    catch(error)
    {
        
        message.reply("Encountered an error...");
        console.error("Failed to play poke call"); 
        console.error(error);
    }
}



exports.gnome =
{
    help: gnomeHelp,
    cmd:  gnomeCommand
};

exports.playYt =
{
    help: playHelp,
    cmd: playCmd
};

exports.playPokeCall = playPokeCall;
