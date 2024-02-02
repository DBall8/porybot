var https = require('https');

var API_URL = "https://pokeapi.co/api/v2/pokemon/";

var DATA_OPEN = "```ansi\n";
var DATA_CLOSE = "```";

const GRAY   = "\u001b[0;30m";
const RED    = "\u001b[0;31m";
const GREEN  = "\u001b[0;32m";
const YELLOW = "\u001b[0;33m";
const BLUE   = "\u001b[0;34m";
const PINK   = "\u001b[0;35m";
const CYAN   = "\u001b[0;36m";
const WHITE  = "\u001b[0;37m";

const BOLD = "\u001b[1;37m";
const CLEAR = WHITE;

var TYPE_COLOR_MAP =
    {
        "normal":   WHITE,
        "fire":     RED,
        "water":    BLUE,
        "electric": YELLOW,
        "grass":    GREEN,
        "ice":      CYAN,
        "fighting": RED,
        "poison":   PINK,
        "ground":   YELLOW,
        "flying":   WHITE,
        "psychic":  PINK,
        "bug":      GREEN,
        "rock":     RED,
        "ghost":    GRAY,
        "dragon":   BLUE,
        "dark":     GRAY,
        "steel":    WHITE,
        "fairy":    PINK
    };

function sendPokeData(channel, data, includeImage)
{
    let dataJson = JSON.parse(data);
    let name = dataJson.name;
    let types = [];

    // Capitalize the name
    name = name[0].toUpperCase() + name.slice(1);

    for (let i=0; i<dataJson.types.length; i++)
    {
        types.push(dataJson.types[i].type.name);
    }


    let basicInfo = BOLD + name + ": ";

    for (let i=0; i<types.length; i++)
    {

        basicInfo += TYPE_COLOR_MAP[types[i]] ? TYPE_COLOR_MAP[types[i]] : WHITE;
        basicInfo += (i == 0) ? "[" : "/";
        basicInfo += types[i];
    }

    basicInfo += "]" + CLEAR;

    for (let i=0; i<dataJson.abilities.length; i++)
    {
        basicInfo += (i==0) ? " " : "/";
        basicInfo += dataJson.abilities[i].ability.name;
        basicInfo += dataJson.abilities[i].is_hidden ? "(HA)" : "";
    }
    basicInfo += "\n";

    let stats = {};
    for (let i=0; i<dataJson.stats.length; i++)
    {
        stats[dataJson.stats[i].stat.name] = dataJson.stats[i].base_stat;
    }

    let statsInfo = "";
    statsInfo += " [Hp]:  " + stats["hp"] + "\n";
    statsInfo += " [Atk]: " + stats["attack"] + "\n";
    statsInfo += " [Def]: " + stats["defense"] + "\n";
    statsInfo += " [SpA]: " + stats["special-attack"] + "\n";
    statsInfo += " [SpD]: " + stats["special-defense"] + "\n";
    statsInfo += " [Spe]: " + stats["speed"] + "\n";
    statsInfo += "\n";

    if (includeImage && dataJson.sprites.other['official-artwork'].front_default)
    {
        channel.send(dataJson.sprites.other['official-artwork'].front_default);
    }

    channel.send(DATA_OPEN + basicInfo + statsInfo + DATA_CLOSE);
}

var dexHelp = 
    "**!dex** <pokemon> [-i]\n" +
    "---- Get the stats of a pokemon, include '-i' to show an image\n";

function dexCmd(message, args)
{
    if (args.length < 2)
    {
        message.channel.send(dexHelp);
        return;
    }

    let pokemon = args[1].toLowerCase();
    let includeImage = false;

    if (args.length >= 3 && args[2] === "-i")
    {
        includeImage = true;
    }

    let url = API_URL + pokemon;
    https.get(url, (response) =>
        {
            if (response.statusCode == 404)
            {
                message.channel.send("Pokemon [" + pokemon + "] not found.");
                return;
            }

            if (response.statusCode != 200)
            {
                message.channel.send("Failed due to unknown error.");
                return;
            }

            let pokeData = "";
            response.on("data", (data) =>
                {
                    pokeData += data;
                });

            response.on("end", () =>
                {
                    sendPokeData(message.channel, pokeData, includeImage);
                });

        }).on("error", (err) => 
            {
                console.log("HTTPS error:");
                console.log(err);
            });
}

exports.cmd = dexCmd;
exports.help = dexHelp;
