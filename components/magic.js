async function cardCmd(message, args)
{
    searchCard(args[0])
    .then((card) => {message.channel.send(card.image);})
}

function searchCard(searchTerm) {
    return new Promise((resolve, reject) =>
    {
        let searchLink = "https://api.scryfall.com/cards/named?fuzzy=" + searchTerm;
        fetch(searchLink)
        .then(response => {
            if(!response.ok) {
                reject("[Scryfall API failed]");
            }
            return response.json();
        })
        .then(data => {
            resolve({image: data.image_uris.small});
        });
    });
}

var cardHelp = 
    "**!card** <card name>\n" +
    "---- Get an image of a MTG card based on its name\n";

exports.card =
    {
        "help": cardHelp,
        "cmd": cardCmd
    };