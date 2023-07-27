const fs = require('fs');

const config = JSON.parse(fs.readFileSync('./config.json'));

const features = {
    'lootTables': () => shuffleFiles(
        '/data/minecraft/loot_tables',
        (j) => {
            if(j.pools) {
                j.pools.forEach((e) => {
                    if(e.conditions) delete e.conditions;
                });
            }
            return j;
        }
    ),
    
    'recipes': () => shuffleProperties(
        '/data/minecraft/recipes',
        (j, n) => j[n], (j, n, v) => j[n] = v,
        ['result']
    ),
    
    'dimensionTypes': () => shuffleProperties(
        '/data/minecraft/dimension_type',
        (j, n) => j[n], (j, n, v) => j[n] = v,
        Object.keys(getJsonContent('/data/minecraft/dimension_type/overworld.json'))
    )
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

function shuffleFiles(relativeDir, jsonProcessor) {
    let fileArr = getFilePaths(relativeDir);
    
    let shuffledFiles = shuffle(fileArr);
    
    for(let i = 0; i < fileArr.length; i++) {
        copyFile(fileArr[i], shuffledFiles[i], jsonProcessor);
    }
    
    return fileArr.length;
}

function shuffleProperties(relativeDir, jsonGetter, jsonSetter, nameArr) {
    let fileArr = getFilePaths(relativeDir);
    
    let propertyArrs = [];
    nameArr.forEach((e) => propertyArrs.push([]));
    
    // get properties (if the jsonGetter returns undefined nothing is added to the array)
    for(let i = 0; i < fileArr.length; i++) {
        let jsonContent = getJsonContent(fileArr[i]);
        
        for(let j = 0; j < nameArr.length; j++) {
            let property = jsonGetter(jsonContent, nameArr[j]);
            if(property) propertyArrs[j].push(property);
        }
    }
    
    // randomize
    for(let i = 0; i < propertyArrs.length; i++) {
        propertyArrs[i] = shuffle(propertyArrs[i]);
    }
    
    // write files with changed property
    let randomizedCount = 0;
    for(let i = 0; i < fileArr.length; i++) {
        let jsonContent = getJsonContent(fileArr[i]); // TODO: file is read twice (inefficient)
        
        let changed = false;
        for(let j = 0; j < nameArr.length; j++) {
            if(jsonGetter(jsonContent, nameArr[j])) {
                changed = true;
                jsonSetter(jsonContent, nameArr[j], propertyArrs[j].pop());
            }
        }
        
        if(changed) {
            randomizedCount++;
            createDirForFile(fileArr[i]);
            fs.writeFileSync(config.outputPath + fileArr[i], JSON.stringify(jsonContent));
        }
    }
    return randomizedCount;
}

function getJsonContent(relativeFile) {
    let fileContent = fs.readFileSync(config.inputPath + relativeFile);
    return JSON.parse(fileContent);
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

function copyFile(src, dest, jsonProcessor) {
    createDirForFile(dest);
    
    if(jsonProcessor) {
        let jsonContent = getJsonContent(src);
        jsonContent = jsonProcessor(jsonContent);
        fs.writeFileSync(config.outputPath + dest, JSON.stringify(jsonContent));
    } else {
        fs.copyFileSync(config.inputPath + src, config.outputPath + dest);
    }
}

function createDirForFile(dest) {
    let dir = dest.match(/.+\//)[0];
    if(!fs.existsSync(config.outputPath + dir)) fs.mkdirSync(config.outputPath + dir, {recursive: true});
}

function shuffle(arr) {
    let shuffled = [...arr];
    let len = shuffled.length;
    if(len <= 1) return shuffled;
    
    for(let i = 0; i < len - 1; i++) {
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
