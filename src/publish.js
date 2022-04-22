const fs = require('fs');
const path = require('path');
const child_process = require("child_process");

console.log("Publishing extension");

fs.rmSync("publish", { force: true, recursive: true });
fs.rmSync("publish.zip", { force: true });
fs.mkdirSync("publish", { recursive: true });

copyFilesByExtension(".bundle.js", __dirname, "publish");
copyFilesByExtension(".html", __dirname, "publish");
copyFilesByExtension(".css", __dirname, "publish");
copyFilesByExtension(".png", __dirname, "publish");

fs.cpSync("manifest.json", "publish/manifest.json");
fs.cpSync("lib", "publish/lib", { recursive: true });
fs.cpSync("images", "publish/images", { recursive: true });

console.log("Archiving...");
try {
    child_process.execSync('zip -r ' + path.join(__dirname, "publish.zip") + ' *', {
        cwd: path.join(__dirname, "publish")
    });
    console.log("Publish finished: " + __dirname + "/publish.zip");
    fs.rmSync("publish", { force: true, recursive: true });
} catch (error) {
    console.warn("Archiving failed. Publishing as folder instead.")
    console.log("Publish finished: " + __dirname + "/publish");
}

function copyFilesByExtension(extension, sourceDir, targetDir) {
    var files = fs.readdirSync(sourceDir);
    var filesList = files.filter(function(file){
        return file.endsWith(extension);
    });
    filesList.forEach((file) => {
        fs.copyFileSync(file, path.join(targetDir, path.basename(file)));
    });
}