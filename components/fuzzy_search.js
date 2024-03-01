function init_matrix(n, m)
{
    let values = [];
    for (let j=0; j<n+1; j++)
    {
        let row = [];
        for (let i=0; i<m+1; i++)
        {
            if (j == 0)
            {
                row.push(i);
            }
            else if (i == 0)
            {
                row.push(j);
            }
            else
            {
                row.push(0);
            }
        }
        values.push(row);
    }

    return values;
}


function levenshtein_distance(stra, strb)
{
    let n = stra.length;
    let m = strb.length;

    let values = init_matrix(n, m);

    for (let j=1; j<n+1; j++)
    {
        for (let i=1; i<m+1; i++)
        {
            let indicator = (stra[j-1] == strb[i-1]) ? 0 : 1;
            values[j][i] = Math.min(
                values[j-1][i] + 1,
                values[j][i-1] + 1,
                values[j-1][i-1] + indicator);
        }
    }

//    for (let j=0; j<values.length; j++)
//    {
//        let str = "";
//        for (let i=0; i<values[j].length; i++)
//        {
//            str += values[j][i] + ' ';
//        }
//        console.log(str);
//    } 
    return values[n][m];
}

function fuzzy_search(input, validOutputs)
{
    let input_lower = input.toLowerCase();
    let minDistance = 255;
    let bestResult = "porygon2";

    for (let i=0; i<validOutputs.length; i++)
    {
        let distance = levenshtein_distance(input_lower, validOutputs[i]);
        if (distance < minDistance)
        {
            minDistance = distance;
            bestResult = validOutputs[i];
        }
    }

    return bestResult;
}

exports.search = fuzzy_search;
