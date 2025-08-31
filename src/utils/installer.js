const { app } = require('electron');
const path = require('path');
const fs = require('fs');

let isMac = process.platform === "darwin";
let isMacARM = isMac && process.arch === "arm64";
let isWin = process.platform === "win32";

async function downloadFile(url, outputPath) {
  const { default: fetch } = await import('node-fetch');
  const res = await fetch(url);
  const fileStream = fs.createWriteStream(outputPath);

  return new Promise((resolve, reject) => {
    res.body.pipe(fileStream);
    res.body.on("error", reject);
    fileStream.on("finish", resolve);
  });
}

function checkExePath() {
    let exePath;

    if (isWin) {
        if (app.isPackaged) {
            exePath = path.join(process.resourcesPath, 'app', 'pogscript.exe');
        } else {
            exePath = path.join(__dirname, '..', '..', 'app', 'pogscript.exe');
        }
    } else if (isMacARM) {
        if (app.isPackaged) {
            exePath = path.join(process.resourcesPath, 'app', 'pogscript');
        } else {
            exePath = path.join(__dirname, '..', '..', 'app', 'pogscript');
        }
    }
    return exePath;
}

async function installExe(exePath) {
    const isOnline = await new Promise((resolve) => {
        require('dns').lookup('github.com', (err) => {
            resolve(!err);
        });
    });

    if (!isOnline) {
        return "No internet connection. Cannot download pogscript executable";
    } else {
        try {
            const appDir = path.dirname(exePath);
            if (!fs.existsSync(appDir)) {
                fs.mkdirSync(appDir, { recursive: true });
            }
            if (isWin) {
                await downloadFile("https://github.com/daniel4-scratch/pogger-script/releases/download/0.1.0a-b1/windows-x84_64.exe", exePath);
            } else if (isMacARM) {
                await downloadFile("https://github.com/daniel4-scratch/pogger-script/releases/download/0.1.0a-b1/macos-arm64", exePath);
                fs.chmodSync(exePath, 0o755); // Make the file executable on macOS
            }
            return "Successfully downloaded pogscript executable";
        } catch (error) {
            console.error('Download failed:', error);
            return "Download failed: " + error.message;
        }
    }
}

function uninstallExe(exePath) {
    return new Promise((resolve, reject) => {
        fs.unlink(exePath, (err) => {
            if (err) {
                console.error('Uninstall failed:', err);
                reject("Uninstall failed: " + err.message);
            } else {
                resolve("Successfully uninstalled pogscript executable");
            }
        });
    });
}

module.exports = { checkExePath, installExe, uninstallExe };