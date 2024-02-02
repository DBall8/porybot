var coinflipHelp =
    "**!coinflip**\n" +
    "--- Flips a coin\n";

function coinflipCmd(message, args)
{
    let number = Math.random();
    let result = "Flipping a coin... and its... ";
    result = result + ((number >= 0.5) ? "HEADS" : "TAILS");

    message.channel.send(result);
}

var randomHelp = 
    "**!random** <bottom_range> <top_range>\n" +
    "--- Generates a random number between the two numbers given\n";

function randomCmd(message, args)
{
    if (args.length < 2)
    {
        message.channel.send(randomHelp);
        return;
    }

    let min = 0;
    let max = 0;

    if (args.length == 2)
    {
        max = args[1];
    }
    else
    {
        min = Math.min(args[1], args[2]);
        max = Math.max(args[1], args[2]);
    }

    let rand = Math.random();
    rand = rand * (max - min);
    rand = rand + min;
    rand = Math.round(rand);

    message.channel.send("Your random value between " + min + " and " + max + " is: " + rand);
}

var shouldHelp =
    "**!should** <question>\n" +
    "--- Answers a yes or no question\n";

function shouldCmd(message, args)
{
    if (args.length < 2)
    {
        message.channel.send(shouldHelp);
        return;
    }

    let rand = Math.random();

    if (rand >= 0.5)
    {
        message.channel.send("Yes, defintely!");
    }
    else
    {
        message.channel.send("No, abslutely not");
    }
}

exports.coinflip =
    {
        "help": coinflipHelp,
        "cmd": coinflipCmd
    };
exports.random = 
    {
        "help": randomHelp,
        "cmd": randomCmd
    };
exports.should =
    {
        "help": shouldHelp,
        "cmd": shouldCmd
    };
