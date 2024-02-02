var discord = require('discord.js'),
    auth = require('./auth.json'),
    porybase = require('./components/porybase.js'),
    poetry = require('./components/poetry.js'),
    images = require('./components/images.js'),
    random = require('./components/random.js'),
    remind = require('./components/remind.js'),
    dex = require('./components/dex.js')

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
    message.channel.send(helpText);
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
        message.channel.send(echoString);
    }
}

var remindHelp = 
    "**!remind** <person> <number> <minutes | hours | days ...> <message>\n" +
    "--- Have a reminder sent after a certain period of time. Use 'me' to ping yourself\n";

function remindCmd(message, args)
{
    if (args.length < 5)
    {
        remindHelp(message.channel);
        return;
    }

    let remindMsg = message.author + " " + args[4];
    message.channel.send(remindMsg);
}

var poemHelp = 
    "**!poem** [topic] [-i]\n" +
    "--- Generates a random poem, with an optional topic. Include -i to add an image\n";

function poemCmd(message, args)
{
    let topic = null;
    let includeImage = false;

    for (let i=1; i<args.length; i++)
    {
        if (args[i] === '-i')
        {
            includeImage = true;
            continue;
        }
        
        if (!topic)
        {
            topic = args[i];
        }
    }

    poetry.generatePoem(topic)
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
                message.channel.send(error);
                message.channel.send(result.poem);
            });
        }
        else
        {
            message.channel.send(result.poem);
        }

    })
    .catch((error) =>
    {
        message.channel.send("Could not create poem: " + error);
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
    var poryBot = new discord.Client();

    poryBot.on("ready", () =>
    {
        console.log("Connected!");
        remind.init(poryBot);
    })

    poryBot.on("message", handleMessage);

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

