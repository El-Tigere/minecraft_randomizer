const fs = require('fs');

const config = JSON.parse(fs.readFileSync('./config.json'));

const features = {
    "lootTables": () => deepShuffleDirectory('/data/minecraft/loot_tables')
};

config.randomize.forEach(f => {
    if(features[f]) {
        let count = features[f]();
        console.log(`randomized ${count} ${f}`);
    } else {
        console.log(`${f} could not be randomized`);
    }
});
console.log('Finished ranomizing!');

function deepShuffleDirectory(relativeDir) {
    let fileArr = getFilePaths(relativeDir);
    randomizeFiles(fileArr);
    return fileArr.length;
}

function getFilePaths(relativeDir) {
    let paths = [];
    getSubFilePaths(relativeDir);
    
    function getSubFilePaths(relativeDir) {
        let names = fs.readdirSync(config.inputPath + relativeDir);
        names.forEach(n => {
            let subPath = relativeDir + '/' + n;
            let stat = fs.statSync(config.inputPath + subPath);
            if(stat.isDirectory()) getSubFilePaths(subPath);
            if(stat.isFile()) paths.push(subPath);
        });
    }
    
    return paths;
}

function randomizeFiles(fileArr) {
    let shuffledFiles = shuffle(fileArr);
    
    for(let i = 0; i < fileArr.length; i++)
    {
        copyFile(fileArr[i], shuffledFiles[i]);
    }
}

function copyFile(src, dest, jsonProcessor) {
    let dir = dest.match(/.+\//)[0];
    if(!fs.existsSync(config.outputPath + dir)) fs.mkdirSync(config.outputPath + dir, {recursive: true});
    
    if(jsonProcessor) {
        let jsonContent = JSON.parse(fs.readFileSync(config.inputPath + src));
        jsonContent = jsonProcessor(jsonContent);
        fs.writeFileSync(config.outputPath + dest, JSON.stringify(jsonContent));
    } else {
        fs.copyFileSync(config.inputPath + src, config.outputPath + dest);
    }
}

function shuffle(arr) {
    let shuffled = [...arr];
    let len = shuffled.length;
    if(len <= 1) return shuffled;
    
    for(let i = 0; i < len - 1; i++)
    {
        swap(shuffled, i, i + ((Math.random() * (len - i)) >> 0));
    }
    
    return shuffled;
}

function swap(arr, a, b) {
    let t = arr[a];
    arr[a] = arr[b];
    arr[b] = t;
}

// function arreq(arr1, arr2) {
//     if(arr1.length != arr2.length) return false;
//     for(let i = 0; i < arr1.length; i++) {
//         if(arr1[i] != arr2[i]) return false;
//     }
//     return true;
// }
// function testDistribution() {
//     let a = {};
//     for(let i = 0; i < 42000; i++) {
//         let x = shuffle('abc').join('');
//         if(a[x]) a[x]++;
//         else a[x] = 1;
//     }
//     console.log(a);
// }
// testDistribution();
