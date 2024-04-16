var fetch = require('node-fetch');

async function cardCmd(message, args)
{
    let cardName = "";
    args.forEach(element => {
        cardName = cardName + element + " ";
    });
    message.channel.send(cardName);
    searchCard(cardName)
    .then((card) => {message.channel.send(card.image);})
    .catch((err) => {
        message.channel.send("Failed to find card image: " + err);
    });
}

function searchCard(searchTerm) {
    return new Promise((resolve, reject) =>
    {
        let searchLink = "https://api.scryfall.com/cards/named?fuzzy=" + searchTerm;
        fetch(searchLink)
        .then(response => {
            let data = response.json();
            resolve({image: data.image_uris.small});
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