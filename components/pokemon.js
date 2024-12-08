var fuzzySearch = require('./fuzzy_search.js');
var audio = require('./audio.js');

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

var POKE_NAMES = [];

function getPokeData(pokemon)
{
    return new Promise((resolve, reject) =>
    {
        let url = API_URL + pokemon;
        https.get(url, (response) =>
            {
                if (response.statusCode == 404)
                {
                    reject("Pokemon [" + pokemon + "] not found.");
                    return;
                }

                if (response.statusCode != 200)
                {
                    reject("Pokemon GET failed due to unknown error.");
                    return;
                }

                let pokeData = "";
                response.on("data", (data) =>
                    {
                        pokeData += data;
                    });

                response.on("end", () =>
                    {
                        resolve(pokeData);
                    });

            }).on("error", (err) => 
                {
                    reject(err);
                });
    });
}

function collectValidNames(nextUrl)
{
    https.get(nextUrl, (response) =>
        {
            if (response.statusCode != 200)
            {
                console.log
                return;
            }

            let pokeData = "";
            response.on("data", (data) =>
                {
                    pokeData += data;
                });

            response.on("end", () =>
                {
                    let result = JSON.parse(pokeData);
                    result.results.map(pokemon => POKE_NAMES.push(pokemon.name));
                    
                    if (result.next)
                    {
                        collectValidNames(result.next);
                    }
                    else
                    {
                        console.log("Poke names loaded.");
                    }
                });
        })
    .on("error", (error) =>
        {
            console.error("Error collectiong pokemon names:");
            console.error(error);
        });
}


function sendPokeData(message, data, includeImage)
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
        message.channel.send(dataJson.sprites.other['official-artwork'].front_default);
    }

    message.channel.send(DATA_OPEN + basicInfo + statsInfo + DATA_CLOSE);
}

var dexHelp = 
    "**!dex** <pokemon> [-i]\n" +
    "---- Get the stats of a pokemon, include '-i' to show an image\n";

async function dexCmd(message, args)
{
    if (args.length < 2)
    {
        message.reply(dexHelp);
        return;
    }

    let pokemon = args[1];
    if (pokemon && (POKE_NAMES.length > 0))
    {
        pokemon = fuzzySearch.search(pokemon, POKE_NAMES);
    }

    let includeImage = false;

    if (args.length >= 3 && args[2] === "-i")
    {
        includeImage = true;
    }

    try
    {
        let pokeData = await getPokeData(pokemon);
        sendPokeData(message, pokeData, includeImage);
    }
    catch (error)
    {
        message.reply("Sorry, encountered an error...");
        console.error("Failed to get pokemon data:");
        console.error(error);
    }
}

var callHelp =
    "**!call** <pokemon>\n" +
    "--- Play a pokemon call into your current voice channel\n"

async function callCmd(message, args)
{
    let pokemon = "";
    if (args.length == 1)
    {
        let randomNum = Math.round(Math.random() * POKE_NAMES.length);
        pokemon = POKE_NAMES[randomNum];
        message.reply("Playing: " + pokemon);
    }
    else
    {
        pokemon = args[1];
    }

    if (pokemon && (POKE_NAMES.length > 0))
    {
        pokemon = fuzzySearch.search(pokemon, POKE_NAMES);
    }
    
    try
    {
        let pokeRaw = await getPokeData(pokemon);
        let pokeData = JSON.parse(pokeRaw);
        if (!pokeData || !pokeData.cries || !pokeData.cries.latest)
        {
            message.reply("Error: pokemon is missing data.");
            console.log("Pokemon missing cry data: " + pokemon);
            return;
        }
        console.log(pokeData.cries.latest);
        audio.playPokeCall(message, pokeData.cries.latest);
    }
    catch (error)
    {
        message.reply("Failed to retrieve pokemon call for " + pokemon);
        console.error("Failed to load pokemon data:");
        console.error(error);
    }

}

function pokeInit()
{
    //fuzzySearch.search("Treeko", ["terapagos-stellar"])
    collectValidNames(API_URL);
}

exports.init = pokeInit;

exports.dex =
    {
        cmd: dexCmd,
        help: dexHelp
    };

exports.call =
    {
        cmd: callCmd,
        help: callHelp
    };

