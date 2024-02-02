var fetch = require('node-fetch')
// searches the Pexels API using the input search term
function getBackground(searchTerm) {
    return new Promise((resolve, reject) =>
    {
        let searchLink = "https://api.pexels.com/v1/search?per_page=80&query=" + searchTerm;
        if(searchTerm == "abstract art" || searchTerm == "random image") {
            // pick a random page for the default searches
            let page = Math.floor(Math.random() * 20) + 1; // 1 - 20
            searchLink += "&page=" + page;
        }

        // source: https://medium.com/star-gazers/how-to-work-pexels-api-with-javascript-9cda16bbece9
        fetch(searchLink, {
            headers: {
                Authorization: "563492ad6f917000010000012404ff7a49e54220b3d4e39dd68fe809"
            }
        })
        .then(response => {
            if(!response.ok) {
                reject("[Image API failed]");
            }
            return response.json();
        })
        .then(data => {
            if(data.photos.length <= 0) {
                reject("[No photo results]");
            }
            
            let photo = data.photos[Math.floor(Math.random() * data.photos.length)];
            resolve(photo.src.original);
        });
    });
    
}

exports.getBackground = getBackground;