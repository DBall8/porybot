var discordVoice = require('@discordjs/voice');
var yt = require('./yt.js');

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

var activeGnomeChannels = [];
var channelStates = {};

function addChannelState(channelId, voiceConn, player, title)
{
    channelStates[channelId] = 
        {
            voice: voiceConn,
            player: player,
            title:  title
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

    return discordVoice.entersState(player, discordVoice.AudioPlayerStatus.Playing, 5000);
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
    "**!play** <yt_url | search_term | 'stop' | 'leave'>\n" +
    "--- Plays the audio from the given youtube url. Use 'stop' or 'leave' to stop playing\n" 

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

    if (args[1] != 'play')
    {
        message.reply("Invalid command!");
        return;
    }
        
    if (args.length == 2) // Not given anything to play, so attemtp to resume previous
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

    let ytUrl = args[1];

    if (!ytUrl.includes("youtube.com"))
    {
        // Not given a url, search this term instead
        let query = message.content.slice(args[0].length + 1);
        ytUrl = await yt.search(query);
    }

    if (!ytUrl)
    {
        message.reply("Unable to find video specified");
        return;
    }

    let dlResult;
    try
    {
        dlResult = await yt.download(ytUrl, "audio-" + channel.id);
    }
    catch (e)
    {
        message.reply("Failed to obtain video");
        return;
    }

    if (!dlResult || !dlResult.filename)
    {
        message.reply("Failed to obtain audio");
        return;
    }

    let audioFile = AUDIO_DIR + dlResult.filename;

    let voiceConnection = null;
    let ytPlayer = discordVoice.createAudioPlayer();
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
    }

    message.reply("Now playing: '" + dlResult.title + "'");

    try
    {
        addChannelState(channel.id, voiceConnection, ytPlayer, dlResult.title);

        ytPlayer.on(discordVoice.AudioPlayerStatus.Idle, () =>
            {
                stopPlayer(channel.id, false);
            });
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
