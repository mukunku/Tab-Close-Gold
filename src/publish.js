const fs = require('fs');
const path = require('path');
const child_process = require("child_process");
const { ZipArchive } = require("archiver");

async function main() {
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

    await package4Chrome();
    await package4Firefox();  //modifies manifest.json so must run after chrome packaging

    //clean up publish folder
    fs.rmSync("publish", { force: true, recursive: true });
}

main().catch(err => {
    console.error(err);
    process.exit(1);
});

function copyFilesByExtension(extension, sourceDir, targetDir) {
    var files = fs.readdirSync(sourceDir);
    var filesList = files.filter(function(file){
        return file.endsWith(extension);
    });
    filesList.forEach((file) => {
        fs.copyFileSync(file, path.join(targetDir, path.basename(file)));
    });
}

function zipDirectory(sourceDir, outPath) {
    return new Promise((resolve, reject) => {
        const output = fs.createWriteStream(outPath);

        const archive = new ZipArchive({
            zlib: { level: 9 }
        });

        output.on("close", resolve);
        output.on("error", reject);

        archive.on("error", reject);

        archive.pipe(output);

        // Zip the contents of the directory, not the directory itself
        archive.directory(sourceDir, false);

        archive.finalize();
    });
}

async function package4Chrome() {

    try {
        await zipDirectory(path.join(__dirname, "publish"), path.join(__dirname, "publish.chrome.zip"));
        console.log("Chrome packaging succeeded: " + __dirname + "/publish.chrome.zip");
        return true;
    } catch (error) {
        console.warn("Chrome packaging failed: " + error?.message);
        return false;
    }
}


async function package4Firefox() {

    try {
        fs.rmSync("publish/manifest.json");
        fs.cpSync("manifest.firefox.json", "publish/manifest.json");

        await zipDirectory(path.join(__dirname, "publish"), path.join(__dirname, "publish.firefox.zip"));
        console.log("Firefox packaging succeeded: " + __dirname + "/publish.firefox.zip");
        return true;
    } catch (error) {
        console.warn("Firefox packaging failed: " + error?.message);
        return false;
    }
}
