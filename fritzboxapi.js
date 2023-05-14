const crypto = require('crypto');
const pbkdf2Sync = crypto.pbkdf2Sync;

async function getSid(boxUrl, username, password) {
    try {
        const response = await fetchResponse("http://fritz.box/?login_sid.lua?version=2", "GET");
        const responseText = await response.text();
        const regex = /"(\w+)":([^,]+)/g;
        const pairs = {};
        let match;
        while ((match = regex.exec(responseText)) !== null) {
            const key = match[1];
            const value = match[2];
            pairs[key] = value;
        }
        var challenge = pairs.challenge.replaceAll('"', '');
        var blocktime = pairs.blockTime;
        console.log(challenge)
    } catch (ex) {
        throw ex;
    }
    if (challenge.replace('"', '')
        .startsWith('2$')) {
        console.log('PBKDF2 supported');
        var challengeResponse = calculatePbkdf2Response(challenge, password);
    } else {
        console.log('Falling back to MD5');
        var challengeResponse = calculateMd5Response(challenge, password);
    }
    if (blocktime > 0) {
        console.log(`Waiting for ${blocktime} seconds...`);
        await new Promise(resolve => setTimeout(resolve, blocktime * 1000));
    }
    try {
        const response = await fetchResponse("http://fritz.box/index.lua", "POST", "response=" + challengeResponse + `&username=${username}`);
        const responseText = await response.text();
        const regex = /"sid":"(\w+)"/;
        const match = regex.exec(responseText);
        const sid = match[1];
        if (sid === '0000000000000000') {
            throw new Error('wrong username or password');
        }
        return sid;
    } catch (ex) {
        throw new Error('failed to login\n:' + ex);
       
    }
}

function fetchResponse(url, method, body) {
    try {
        const response = fetch(url, {
            "credentials": "omit",
            "headers": {
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:107.0) Gecko/20100101 Firefox/107.0",
                "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
                "Accept-Language": "de,en-US;q=0.7,en;q=0.3",
                "Content-Type": "application/x-www-form-urlencoded",
                "Upgrade-Insecure-Requests": "1"
            },
            "referrer": "http://fritz.box/",
            method: method,
            "body": body,
            mode: "cors",
        });
        return response;
    } catch (error) {
        console.error(error);
    }
}

function calculatePbkdf2Response(challenge, password) {
    const challengeParts = challenge.split('$');
    const iter1 = parseInt(challengeParts[1]);
    const salt1 = Buffer.from(challengeParts[2], 'hex');
    const iter2 = parseInt(challengeParts[3]);
    const salt2 = Buffer.from(challengeParts[4], 'hex');
    const hash1 = pbkdf2Sync(password, salt1, iter1, 32, 'sha256');
    const hash2 = pbkdf2Sync(hash1, salt2, iter2, 32, 'sha256');
    return `${challengeParts[4]}$${hash2.toString('hex')}`;
}

function calculateMd5Response(challenge, password) {
    const response = `${challenge}-${password}`;
    const md5Sum = crypto.createHash('md5');
    md5Sum.update(response, 'utf16le');
    return `${challenge}-${md5Sum.digest('hex')}`;
}

async function WlanOnOff(sid) {
    const response = await fetchResponse("http://fritz.box/data.lua", "POST", `xhr=1&sid=${sid}&lang=de&page=chan&xhrId=all`);
    const responseText = await response.text();
    JSONresponse = JSON.parse(responseText)
    const match = JSONresponse["data"]["24ghz"]["active"]
        switch (match) {
        case false:
            fetchResponse("http://fritz.box/data.lua", "POST", `xhr=1&channelSelectMode=manual&bandActive24ghz=on&chan24ghz=0&wlanMode24ghz=23&bandActive5ghz=off&autopowerlevel=4&use1213=off&bandsteering=on&coexist=off&iptv=on&airslot=1&apply=&sid=${sid}&lang=de&page=chan`);
            console.log("Wlan an")
            break;
        case true:
            fetchResponse("http://fritz.box/data.lua", "POST", `xhr=1&channelSelectMode=manual&bandActive24ghz=off&bandActive5ghz=off&autopowerlevel=4&bandsteering=on&iptv=on&airslot=1&apply=&sid=${sid}&lang=de&page=chan`);
            console.log("Wlan aus")
            break;
        default:
            break;
    }
}
async function IPv4Reset(sid) {
    console.log("IPv4 Reset")
            fetchResponse("http://fritz.box/data.lua", "POST", `xhr=1&sid=${sid}&lang=de&page=netMoni&xhrId=reconnect&disconnect=true&useajax=1&no_sidrenew=`);
        
}
async function main() {
    const boxUrl = "https://fritz.box/"
    const username = ""
    const password = ""
    try {
        const sid = await getSid(boxUrl, username, password);
        if (sid) {
            
            console.log(`Successfully logged in with SID: ${sid}`);
            const args = process.argv.slice(2);
            switch(args[0]){
                case "wlanswitch":
             
                    await WlanOnOff(sid)
                break;
                case "ipv4reset":
                    await IPv4Reset(sid)
                    break
            }
           
        }
    } catch (ex) {
        console.error(ex);
    }
}


main();
