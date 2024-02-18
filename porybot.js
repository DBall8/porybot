var discord = require('discord.js'),
    auth = require('./auth.json'),
    porybase = require('./components/porybase.js'),
    poetry = require('./components/poetry.js'),
    images = require('./components/images.js'),
    random = require('./components/random.js'),
    remind = require('./components/remind.js'),
    dex = require('./components/dex.js'),
    yt = require('./components/yt.js'),
    audio = require('./components/audio.js')

var commands = [];

function addCommand(name, command, help)
{
    commands.push(
        {
            "name": name,
            "cmd": command,
            "help": help
        }
    );
}

function helpCmd(message) 
{
    let helpText = ""
    for (let i=0; i<commands.length; i++)
    {
        if (commands[i].help)
        {
            helpText = helpText + "\n" + commands[i].help;
        }
    }
    message.reply(helpText);
}
    

var echoHelp = 
    "**!echo** <text>\n" +
    "--- Repeats the given text\n";

function echoCmd(message, args)
{
    let cmdNameLen = args[0].length;
    let echoString = message.content.slice(cmdNameLen+1);
    if (echoString.length > 0)
    {
        message.reply(echoString);
    }
}

var poemHelp = 
    "**!poem** [topic] [-i]\n" +
    "--- Generates a random poem, with an optional topic. Include -i to add an image\n";

function poemCmd(message, args)
{
    let topic = null;
    let includeImage = false;
    let random = false;

    for (let i=1; i<args.length; i++)
    {
        if (args[i] === '-i')
        {
            includeImage = true;
            continue;
        }

        if (args[i] === 'random')
        {
            random = true;
            continue;
        }
        
        if (!topic)
        {
            topic = args[i];
        }
    }

    poetry.generatePoem(topic, random)
    .then((result) =>
    {
        if (includeImage)
        {
            images.getBackground(result.imageWord)
            .then((url) =>
            {
                message.channel.send(url);
                message.channel.send(result.poem);
            })
            .catch((error) => 
            {
                message.reply(error);
                message.reply(result.poem);
            });
        }
        else
        {
            message.reply(result.poem);
        }

    })
    .catch((error) =>
    {
        message.reply("Could not create poem: " + error);
    })
}

function handleMessage(message)
{
    if (message.author.bot) return;
    if (message.content[0] != '!') return;

    let argv = message.content.split(' ');
    if (argv.length <= 0) return;

    // Remove the leading !
    let cmdName = argv[0].slice(1).toLowerCase();
    
    // Filter for a matching command name, and then call that command
    commands.filter((command) => (command.name === cmdName))
        .map((command) => (command.cmd(message, argv)));
}

function startBot()
{
    var poryBot = new discord.Client(
        {
            intents: [discord.Intents.FLAGS.GUILDS, discord.Intents.FLAGS.GUILD_MESSAGES, discord.Intents.FLAGS.GUILD_VOICE_STATES]
        });

    poryBot.on("ready", () =>
    {
        console.log("Connected!");
        remind.init(poryBot);
    })

    poryBot.on("messageCreate", handleMessage);

    poryBot.login(auth.token);
}

addCommand("help",     helpCmd);
//addCommand("echo",     echoC                echoHelp);
addCommand("remind",   remind.cmd,          remind.help);
addCommand("poem",     poemCmd,             poemHelp);
addCommand("coinflip", random.coinflip.cmd, random.coinflip.help);
addCommand("random",   random.random.cmd,   random.random.help);
addCommand("should",   random.should.cmd,   random.should.help);
addCommand("dex",      dex.cmd,             dex.help);
addCommand("yt",       yt.cmd,              yt.help);
addCommand("gnome",    audio.gnome.cmd,     audio.gnome.help);

porybase.init()
    .then(() =>
    {
        startBot();
    })
    .catch((err) =>
    {
        console.log("Failed to start porybase:");
        console.log(err);
    });

