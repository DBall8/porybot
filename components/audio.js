var discordVoice = require('@discordjs/voice');

var gnomeHelp =
    "**!gnome** [leave]\n" +
    "--- Joins a voice channel to periodically 'woo', use '!gnome leave' to make it stop\n";

const GNOME_WAV = __dirname + "/../audio/gnome-reverb.wav";
const gnomePlayer = discordVoice.createAudioPlayer();

const HOUR_MS = 1000 * 60 * 60;
const DEFAULT_MIN_TIME = HOUR_MS * 0.25;
const DEFAULT_MAX_TIME = HOUR_MS * 3;

var gnomeTimer = null;
var minTime = DEFAULT_MIN_TIME;
var maxTime = DEFAULT_MAX_TIME;

var activeGnomeChannels = [];

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

exports.playPokeCall = playPokeCall;
