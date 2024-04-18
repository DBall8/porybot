var fetch = require('node-fetch');

async function cardCmd(message, args)
{
    let cardName = "";
    for(let i = 1; i < args.length; i++) {
        cardName = cardName + args[i] + " ";
    }
    searchCard(cardName)
    .then((card) => {
        if(card && card.image_uris && card.image_uris.normal) {
            message.channel.send(card.image_uris.normal);
        } else {
            message.channel.send("Failed to find card image.");
        }
    })
    .catch((err) => {
        message.channel.send("Failed to find card image.");
    });
}

function searchCard(searchTerm) {
    return new Promise((resolve, reject) =>
    {
        let searchLink = "https://api.scryfall.com/cards/named?fuzzy=" + searchTerm;
        fetch(searchLink)
        .then(response => {
            if(response) {
                let data = response.json();
                resolve(data);
            } else {
                reject("No valid response.");
            }
        })
        .catch((err) => {
            reject("[Scryfall API failed]: " + err);
        });
    });
}

var cardHelp = 
    "**!card** <card name>\n" +
    "--- Get an image of a MTG card based on its name\n";

exports.card =
    {
        "help": cardHelp,
        "cmd": cardCmd
    };