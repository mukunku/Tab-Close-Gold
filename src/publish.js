const fs = require('fs');
const path = require('path');
const child_process = require("child_process");

console.log("Publishing extension");

fs.rmSync("publish", { force: true, recursive: true });
fs.rmSync("publish.chrome.zip", { force: true });
fs.rmSync("publish.firefox.zip", { force: true });
fs.mkdirSync("publish", { recursive: true });

copyFilesByExtension(".bundle.js", __dirname, "publish");
copyFilesByExtension(".html", __dirname, "publish");
copyFilesByExtension(".css", __dirname, "publish");
copyFilesByExtension(".png", __dirname, "publish");

fs.cpSync("manifest.json", "publish/manifest.json");
fs.cpSync("lib", "publish/lib", { recursive: true });
fs.cpSync("images", "publish/images", { recursive: true });

console.log("Packaging...");
package4Chrome();
package4Firefox(); //modifies manifest.json so must run after chrome packaging

//clean up publish folder
fs.rmSync("publish", { force: true, recursive: true });

function copyFilesByExtension(extension, sourceDir, targetDir) {
    var files = fs.readdirSync(sourceDir);
    var filesList = files.filter(function(file){
        return file.endsWith(extension);
    });
    filesList.forEach((file) => {
        fs.copyFileSync(file, path.join(targetDir, path.basename(file)));
    });
}

function package4Chrome() {
    try {
        child_process.execSync('zip -r ' + path.join(__dirname, "publish.chrome.zip") + ' *', {
            cwd: path.join(__dirname, "publish")
        });
        console.log("Chrome packaging succeeded: " + __dirname + "/publish.chrome.zip");
        return true;
    } catch (error) {
        console.warn("Chrome packaging failed.");
        return false;
    }
}

function package4Firefox() {
    try {
        
        fs.rmSync("publish/manifest.json");
        fs.cpSync("manifest.firefox.json", "publish/manifest.json");

        child_process.execSync('zip -r ' + path.join(__dirname, "publish.firefox.zip") + ' *', {
            cwd: path.join(__dirname, "publish")
        });
        console.log("Firefox packaging succeeded: " + __dirname + "/publish.firefox.zip");
        return true;
    } catch (error) {
        console.warn("Firefox packaging failed.");
        return false;
    }
}