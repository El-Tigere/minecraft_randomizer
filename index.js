const fs = require('fs');
const sharp = require('sharp');

const config = JSON.parse(fs.readFileSync('./config.json'));

const features = {
    // data
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
        (j, n) => j[n],
        (j, n, v) => j[n] = v,
        ['result']
    ),
    
    'dimensionTypes': () => shuffleProperties( // TODO: randomized dimension types don't work in minecraft for some reason
        '/data/minecraft/dimension_type',
        (j, n) => j[n],
        (j, n, v) => j[n] = v,
        Object.keys(getJsonContent('/data/minecraft/dimension_type/overworld.json'))
    ),
    
    'tags': () => forEachFolder(
        '/data/minecraft/tags',
        (folder) => shuffleProperties(
            folder,
            (j, n) => j[n].filter((e) => e[0] != '#'), // get all tag entries that don't reference other tags (the ones not starting with #)
            (j, n, v) => j[n] = j[n].filter((e) => e[0] == '#').concat(v), // keep entries referencing tags from the original file and add the randomized non-tag-entries
            ['values']
        )
    ),
    
    // assets
    'blockStates': () => crossShuffleProperties(
        '/assets/minecraft/blockstates',
        (j) => {
            if(j.variants) return Object.values(j.variants); // get all blockstate variants
            else return [...j.multipart].map((e) => e.apply); // get all parts of the multipart
        },
        (j, v) => {
            if(j.variants) Object.keys(j.variants).forEach((k) => j.variants[k] = v.pop()); // set all blockstate variants to the next value in the list
            else j.multipart.forEach((k) => k.apply = v.pop()); // set all parts of the multipart to the next value in the list
        }
    ),
    'blockTextures': () => shuffleTextures('/assets/minecraft/textures/block'),
    'entityTextures': () => forEachFolder('/assets/minecraft/textures/entity', (folder) => shuffleTextures(folder)),
    'itemTextures': () => shuffleTextures('/assets/minecraft/textures/item'),
    'effectTextures': () => shuffleTextures('/assets/minecraft/textures/mob_effect'),
    'paintingTextures': () => shuffleTextures('/assets/minecraft/textures/painting'),
    'particleTextures': () => shuffleTextures('/assets/minecraft/textures/particle'),
    'trimTextures': () => forEachFolder('/assets/minecraft/textures/trims', (folder) => shuffleTextures(folder)),
    'font': () => shuffleTextureParts('/assets/minecraft/textures/font/ascii.png', 8, 8, 16, 16)
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

function forEachFolder(relativeDir, callback) {
    let folders = fs.readdirSync(config.inputPath + relativeDir);
    let randomizedCount = 0;
    folders.forEach((f) => {
        if(fs.statSync(config.inputPath + relativeDir + '/' + f).isDirectory()) {
            randomizedCount += callback(relativeDir + '/' + f);
        }
    });
    return randomizedCount;
}

async function shuffleTextureParts(relativeFile, sizeX, sizeY, countX, countY) {
    
    // seperate image into parts
    let image = await sharp(config.inputPath + relativeFile).toBuffer().catch((reason) => {
        console.log(`Image could not be loaded. reason: ${reason}`);
    });
    let parts = [];
    for(let i = 0; i < countY; i++) {
        for(let j = 0; j < countX; j++) {
            parts.push(await sharp(image)
                .extract({left: sizeX * j, top: sizeY * i, width: sizeX, height: sizeY})
                .toBuffer()
                .catch((reason) => {
                    console.log(`Image could not be extracted. reason: ${reason}`);
                })
            );
        }
    }
    
    // shuffle parts
    parts = shuffle(parts);
    
    // merge parts into output
    let output = sharp({
        create: {
            width: sizeX * countX,
            height: sizeY * countY,
            channels: 4,
            background: {r: 0, g: 0, b: 0, alpha: 0}
        }
    });
    for(let i = 0; i < countY; i++) {
        for(let j = 0; j < countX; j++) {
            let index = i * countX + j;
            parts[index] = {
                input: parts[index],
                left: sizeX * j,
                top: sizeY * i
            }
        }
    }
    output = output.composite(parts);
    
    // write output to file
    createDirForFile(relativeFile);
    output.toFile(config.outputPath + relativeFile, (err, info) => {
        if(err) throw err;
    });
    return 1; // 1 file was randomized
}

function shuffleTextures(relativeDir) {
    let fileArr = getFilePaths(relativeDir);
    
    let shuffledFiles = shuffle(fileArr);
    
    randomizedcounter = 0;
    for(let i = 0, j = 0; i < fileArr.length && j < fileArr.length; i++, j++) {
        // go to the next image file in the shuffled array
        while(shuffledFiles[j].endsWith('.mcmeta')) j++;
        
        // copy texture
        copyFile(fileArr[i], shuffledFiles[j]);
        randomizedcounter++;
        
        // if the texture is animated, copy mcmeta file
        if(i < fileArr.length - 1 && fileArr[i + 1] == fileArr[i] + '.mcmeta') {
            copyFile(fileArr[i + 1], shuffledFiles[j] + '.mcmeta');
            i++;
        }
    }
    
    return randomizedcounter;
}

function shuffleFiles(relativeDir, jsonProcessor) {
    let fileArr = getFilePaths(relativeDir);
    
    let shuffledFiles = shuffle(fileArr);
    
    for(let i = 0; i < fileArr.length; i++) {
        copyFile(fileArr[i], shuffledFiles[i], jsonProcessor);
    }
    
    return fileArr.length;
}

function crossShuffleProperties(relativeDir, jsonMultiGetter, jsonMultiSetter) {
    let fileArr = getFilePaths(relativeDir);
    let propertyArr = [];
    
    // get properties
    for(let i = 0; i < fileArr.length; i++) {
        let jsonContent = getJsonContent(fileArr[i]);
        propertyArr = propertyArr.concat(jsonMultiGetter(jsonContent));
    }
    
    // randomize
    propertyArr = shuffle(propertyArr);
    
    // write files with changed properties
    for(let i = 0; i < fileArr.length; i++) {
        let jsonContent = getJsonContent(fileArr[i]); // TODO: file is read twice (inefficient)
        
        jsonMultiSetter(jsonContent, propertyArr);
        
        writeJsonContent(fileArr[i], jsonContent);
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
    
    // write files with changed properties
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
            writeJsonContent(fileArr[i], jsonContent);
        }
    }
    return randomizedCount;
}

function getJsonContent(relativeFile) {
    let fileContent = fs.readFileSync(config.inputPath + relativeFile);
    return JSON.parse(fileContent);
}

function writeJsonContent(relativeFile, jsonContent) {
    createDirForFile(relativeFile);
    fs.writeFileSync(config.outputPath + relativeFile, JSON.stringify(jsonContent));
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
