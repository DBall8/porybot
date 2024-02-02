var RiTa = require('./rita-full.js');

const poemWords = {
    "pronoun" : [ // 0-3: singular
        "she","he","one","it","we","they","I","people"
    ],

    "object" : [ // must have article "a" or "the" or be plural
        "storm","wind","name","river","chapter","forest","heart","pain","feeling",
        "philosopher","wave","tear","face","lie","tree","rock","bell","window","miracle",
        "question","flower","idea","leaf","doubt","man","woman","world","eye","hand","word",
        "child","phantom","fear","song","truth","day","image","illusion",
    ],

    "concept" : [ // no article, only singular. no adjectives
        "dust","life","fate","hope","love","air","death","night","light","humanity",
        "time","snow","rain","Spring","wisdom","water","nature","day","age","happiness",
        "everything","dignity","depression","temptation","nothing","existence",
    ],

    "actionVerb" : [
        "remember","fall","warn","know","decieve","speak","trust","read","write","stay",
        "ponder","persist","run","forgive","forget","answer","hide","return","see","spin",
        "rest","sway","wait","bleed","understand","paint","burn","wish","call","turn","leave",
        "sleep","think","dance"
    ],

    "affectVerb" : [ // needs direct object
        "remember", "warn", "know","tell","deceive","trust","write","ponder","forgive",
        "forget","answer","want","hide","meet","find","destroy","humiliate","disrespect",
        "hate","reject","contradict","receive","accept","befriend","chase","wake","understand",
        "respect","paint","burn","call","follow","grab","welcome"
    ],

    "linkingVerb" : ["become","appear","remain","feel","act"], // "is" is a special case

    "adverb" : [
        "sometimes","never","always","quickly","gracefully","almost",
        "awkwardly","boldy","bravely","calmly","carefully","deliberately","easily","elegantly",
        "furiously","happily","instantly","innocently","inwardly","mysteriously",
        "often","patiently","quietly","randomly","reluctantly","repeatedly","silently",
        "slowly","soon","suddenly","unexpectedly","usually", "now"
    ],

    "adjective" : [
        "large","small","strange","sad","happy","good","bad","unusual","wild","disappointed",
        "old","new","different","important","angry","annoyed","bored","tired","blurry",
        "busy","charming","clever","cruel","dull","elegant","evil","foolish","friendly",
        "gentle","glorious","helpless","lonely","lucky","mysterious","odd","proud",   
    ],

    "preposition" : [
        "among","opposite","near","after","against","because of",
        "before","beneath","despite","for","instead of","like","with","without"
    ],

    "negative" : ["cannot", "will not", "would not", "could not", "should not"],

    "comparison" : ["like", "different from", "better than", "worse than"],

    "relation" : ["as as", "more than", "less than"], // use adjective between

    "conjunction" : ["however, ", "and", "but", "or", "yet", "so", "because"],

    "clarification" : ["why do", "why can", "how do", "how can", "do", "can"],

    "unknownNoun" : ["what", "who"]
};

const codeToPOS = {
    "concept" : "nn",
    "object" : "nn",
    "adjective" : "jj",
    "actionVerb" : "vb",
    "adverb" : "rb"
}

let sentence = new RiTa.RiGrammar();
sentence.addRule("<start>", "<standard> [5] | <description> [2] | <question> [1]");
    sentence.addRule("<subject>", "<noun> | pronoun");
    sentence.addRule("<noun>", "concept | <object>");
    sentence.addRule("<object>", "adjective object | object");

sentence.addRule("<standard>", "<subject> <action> [7] | <subject> <action> conjunction <subject> <action> [2] | conjunction <subject> <action> [1]");
    sentence.addRule("<action>", "actionVerb [3] | affectVerb <object> [2] | affectVerb pronoun [1] | negative actionVerb [1] | actionVerb adverb [1] | adverb actionVerb [1] | actionVerb preposition <object> [1] | actionVerb preposition pronoun [0]");

sentence.addRule("<description>", "<subject> <quality>");
    sentence.addRule("<quality>", "<linkingVerb> adjective [2] | <linkingVerb> comparison <noun> [1] | <linkingVerb> relation <noun> [1] | is <noun> [1]");    
    sentence.addRule("<linkingVerb>", "linkingVerb | is");

sentence.addRule("<question>", "<clarification> | <vague>");
    sentence.addRule("<clarification>", "clarification <simpleSubject> <simpleAction>");
    sentence.addRule("<simpleSubject>", "pronoun | concept | object");
    sentence.addRule("<simpleAction>", "actionVerb [3] | affectVerb <object> [2] | affectVerb pronoun [1] | actionVerb adverb [1]");
    sentence.addRule("<vague>", "unknownNoun <action> [2] | unknownNoun <quality> [2] | unknownNoun is object [1] | unknownNoun is concept [1]");

// generate a poem using the above grammar and get a background image
function generatePoem(topic = null, isRandom = false) {
    return new Promise((resolve, reject) =>
    {
        // create sentence structure, then replace with real words
        let poem = "";
        let objects = [];
        let concepts = [];
        let pronouns = [];
        let random;
        let topicUsed = false;
        let lines = Math.floor(Math.random() * 3 + 3);

        // topic option
        if(topic != null) {
            topic = topic.trim();
            if(topic.includes(" ")) {
                reject("Enter only one word");
                return;
            }
            else if(topic == "") {
                reject("Enter a noun");
                return;
            }

            if(RiTa.isNoun(topic)) {
                topic = RiTa.singularize(topic);
                topic = topic.toLowerCase();
                concepts.push(topic);
                objects.push(topic);
            }
            else if(topic.charAt(0) == topic.charAt(0).toUpperCase()) {
                // entered proper noun
                concepts.push(topic);
            } else {
                reject("Enter a valid noun");
                return;
            }
        }

        // make 3 - 6 sentences
        for(let line = 0; line < lines; line++) {
            let wordCodes = RiTa.RiString(sentence.expand()).words();
            let singularNoun = false;
            let subject = null;
            let isQuestion = false;

            console.log("RiString: " + wordCodes);

            // make a sentence
            for(let i = 0; i < wordCodes.length; i++) {
                let word;
                let wordList;
                
                // handle special cases
                if(wordCodes[i] == "is") {
                    word = "is";
                }
                else if(isRandom && Object.keys(codeToPOS).includes(wordCodes[i])) {
                    word = RiTa.randomWord(codeToPOS[wordCodes[i]]);

                    // don't use concepts with random
                    if(wordCodes[i] == "concept") {
                        wordCodes[i] = "object";
                    }
                } 
                else {
                    wordList = poemWords[wordCodes[i]];
                    word = wordList[Math.floor(Math.random() * wordList.length)];
                }     
                
                // each part of speech has variations
                switch(wordCodes[i]) {
                    case "object":
                        // potentially reuse noun
                        random = Math.floor(Math.random() * (objects.length + 0.5));
                        if(topic && !topicUsed) {
                            // always use topic first
                            word = topic;
                            topicUsed = true;
                        }
                        else if(random >= objects.length) {
                            // use new word
                            objects.push(word);
                        } else {
                            // reuse old word
                            let oldWord = objects[random];

                            // don't let direct objects match the subject
                            if(oldWord != subject) {
                                word = oldWord;
                            }
                        }

                        subject = word;

                        // randomly choose singular or plural
                        if(Math.random() < 0.5) {
                            singularNoun = true;

                            if(i >= 1 && wordCodes[i - 1] == "adjective") {
                                // put adjective between word and article
                                let lastSpace = poem.lastIndexOf(" ", poem.length - 2);
                                let lastBreak = poem.lastIndexOf(">", poem.length - 2);
                                let spot = lastSpace;
                                if(lastBreak > lastSpace) {
                                    spot = lastBreak;
                                }

                                // maintain capitalization
                                let adj = poem.slice(spot + 1);
                                let article = GrammarHelp.getArticle(adj);
                                if(adj.charAt(0) == adj.charAt(0).toUpperCase()) {
                                    adj = adj.charAt(0).toLowerCase() + adj.slice(1);
                                    article = article.charAt(0).toUpperCase() + article.slice(1);
                                }

                                poem = poem.slice(0, spot + 1) + article + " " + adj;
                            } else {
                                word = GrammarHelp.getArticle(word) + " " + word;
                            }
                        } else {
                            word = RiTa.pluralize(word);

                            // for questions, replace "is" with "are" if plural
                            if(isQuestion && i >= 1 && wordCodes[i - 1] == "is") {
                                poem = poem.substring(0, poem.length - 3) + "are ";
                            }
                        }

                        // fix verb forms for questions
                        if(i >= 1 && wordCodes[i - 1] == "clarification") {
                            if(singularNoun && poem.substring(poem.length - 3).toLowerCase() == "do ") {
                                poem = poem.substring(0, poem.length - 1) + "es ";
                            }
                            
                            singularNoun = false;
                        }
                        break;

                    case "concept":
                        // potentially reuse noun
                        random = Math.floor(Math.random() * (concepts.length + 0.5));
                        if(topic && !topicUsed) {
                            // always use topic first
                            word = topic;
                            topicUsed = true;
                        }
                        else if(random >= concepts.length) {
                            // use new word
                            concepts.push(word);
                        } else {
                            // reuse old word
                            let oldWord = concepts[random];
                            // don't let direct objects match the subject
                            if(oldWord != subject) {
                                word = oldWord;
                            }
                        }

                        subject = word;
                        singularNoun = true;

                        // fix verb forms for questions
                        if(i >= 1 && wordCodes[i - 1] == "clarification") {
                            singularNoun = false;

                            if(poem.substring(poem.length - 3).toLowerCase() == "do ") {
                                poem = poem.substring(0, poem.length - 1) + "es ";
                            }
                        }
                        break;

                    case "pronoun":
                        // potentially reuse noun
                        random = Math.floor(Math.random() * (pronouns.length + 0.5));
                        if(random >= pronouns.length) {
                            // use new word
                            pronouns.push(word);
                        } else {
                            // reuse old word
                            let oldWord = pronouns[random];

                            // don't let direct objects match the subject
                            if(oldWord != subject) {
                                word = oldWord;
                            }
                        }

                        if(wordList.indexOf(word) <= 3) {
                            singularNoun = true;
                        }

                        subject = word;

                        // make pronoun accusative if direct object
                        if(i >= 1 && (wordCodes[i - 1] == "affectVerb" || wordCodes[i - 1] == "comparison"  || wordCodes[i - 1] == "preposition")) {
                            word = GrammarHelp.getAccusativePronoun(word);
                        }

                        // fix verb forms for questions
                        if(i >= 1 && wordCodes[i - 1] == "clarification") {
                            if(singularNoun && poem.substring(poem.length - 3).toLowerCase() == "do ") {
                                poem = poem.substring(0, poem.length - 1) + "es ";
                            }
                            
                            singularNoun = false;
                        }
                        break;

                    case "negative":
                        // override noun tense. This is how English grammar actually works
                        singularNoun = false;
                        break;

                    case "conjunction":
                        singularNoun = false; // reset variable for second part of sentence
                        if(i > 0) {
                            word = ",\n" + word;
                            poem = poem.slice(0, poem.length - 1); // remove previous space
                        }

                        subject = null;
                        break;

                    case "linkingVerb":
                    case "affectVerb":
                    case "actionVerb":
                        if(singularNoun) {
                            word = RiTa.pluralize(word); // uses pluralize because verbs are the opposite of nouns in terms of plurality
                        }
                        break;

                    case "is":
                        // get correct form of to be
                        if(poem.slice(poem.lastIndexOf(">") + 1) == "I ") {
                            word = "am";
                        }
                        else if(!singularNoun) {
                            word = "are"; // uses pluralize because verbs are the opposite of nouns in terms of plurality
                        }               
                        break;

                    case "relation":
                        // add random adjective to relation
                        let adj = poemWords["adjective"][Math.floor(Math.random() * poemWords["adjective"].length)];
                        if(word == "more than" && adj != GrammarHelp.getComparativeAdjective(adj), isRandom) {
                            // some adjectives change form when comparative 
                            word = GrammarHelp.getComparativeAdjective(adj, isRandom) + " than";
                        } else {
                            word = word.replace(" ", " " + adj + " ");
                        }
                        break;

                    case "unknownNoun":
                        isQuestion = true;
                        singularNoun = true;
                        break;
                    
                    case "clarification":
                        isQuestion = true;
                        break;
                }

                // capitalize beginning of sentence
                if(i == 0) {
                    word = word.charAt(0).toUpperCase() + word.slice(1);
                }

                poem += word;

                if(i < wordCodes.length - 1) {
                    if(i >= wordCodes.length / 2.0 && Math.random() <= 0.1) {
                        // randomly add line breaks 
                        poem += "\n";
                    }
                    else {
                        // add spaces between words
                        poem += " ";
                    }
                }
                
            } // end of sentence maker
                
            // add random punctuation at the end of each line
            random = Math.random();
            if(isQuestion) {
                poem += "?";
            }
            else if(random >= 0.66) {
                poem += ".";
            }
            else if(random >= 0.33) {
                poem += ",";
            }
            else if(random >= 0.22) {
                poem += ":"
            }
            else if(random >= 0.11) {
                poem += ";"
            }
            // else no punctuation

            if(line < lines - 1) {
                // add line breaks
                poem += "\n";

                // add random stanza breaks
                if(Math.random() <= 0.1) {
                    poem += "\n";
                }
            }
        } // end of poem maker

        // end poem with a period
        let lastChar = poem.charAt(poem.length - 1);
        if(lastChar != "?") {
            if(lastChar == ":" || lastChar == "," || lastChar == ";" || lastChar == ".") {
                poem = poem.substring(0, poem.length - 1) + ".";
            } else {
                poem += ".";
            }
        }
        
        // change background
        let searchWord = "abstract art";
        if(topic && topic == topic.toLowerCase()) {
            searchWord = topic;
        }
        else if(isRandom) {
            searchWord = "random image";
        }

        resolve({
            poem: poem,
            imageWord: searchWord
        });
    })   
}

class GrammarHelp {
    static getArticle(word) {
        // randomly choose "the" or "a"
        if(Math.random() < 0.5) {
            return "the";
        } else {
            let letter = word.charAt(0).toLowerCase();
            if(letter == 'a' || letter == 'e' || letter == 'i' || letter == 'o' || letter == 'u') {
                return "an";
            } else {
                return "a";
            }
        }
    }

    // returns the accusative form of the input pronoun
    static getAccusativePronoun(pronoun) {
        switch(pronoun) {
            case "he":
                return "him";

            case "she":
                return "her";

            case "they":
                return "them";

            case "I":
                return "me";

            case "we":
                return "us";
        }

        return pronoun;
    }

    // returns the comparative form of the input adjective
    static getComparativeAdjective(adjective, isRandom) {
        if(isRandom) {
            return RiTa.randomWord("jjr");
        }

        switch(adjective) {
            case "large":
                return "larger";

            case "small":
                return "smaller";

            case "strange":
                return "stranger";

            case "sad":
                return "sadder";

            case "happy":
                return "happier";

            case "good":
                return "better";
            
            case "bad":
                return "worse";

            case "wild":
                return "wilder";

            case "old":
                return "older";

            case "new":
                return "newer";

            case "angry":
                return "angrier";

            case "busy":
                return "busier";

            case "cruel":
                return "crueller";

            case "dull":
                return "duller";

            case "friendly":
                return "friendlier";

            case "gentle":
                return "gentler";

            case "lonely":
                return "lonelier";

            case "lucky":
                return "luckier";

            case "odd":
                return "odder";

            case "proud":
                return "prouder";
        }

        return adjective;
    }
}

exports.generatePoem = generatePoem;