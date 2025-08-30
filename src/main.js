const {
  app,
  BrowserWindow,
  ipcMain,
  Menu,
  dialog,
  globalShortcut,
  nativeTheme,
} = require("electron");
const { spawn } = require("child_process");
const path = require("path");
const fs = require("fs");
const os = require("os");
const http = require('http');
const packageJson = require(path.join(__dirname, '..', 'package.json'));

const isMac = process.platform === "darwin";
const isWin = process.platform === "win32";

let mainWindow;

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

function about() {
  const targetWindow = mainWindow || BrowserWindow.getFocusedWindow();
  dialog.showMessageBox(targetWindow, {
    type: 'info',
    title: 'About Pogscript IDE',
    message: 'Pogscript IDE',
    detail: `Version: ${packageJson.version}
OS: ${os.platform()} ${os.release()}
Electron: ${process.versions.electron}
Nodejs: ${process.versions.node}`,
    buttons: ['OK']
  });
}

var fileSubMenu = [{
  label: "File",
  submenu: [
    { label: "New Window", accelerator: "CmdOrCtrl+Shift+N", click: () => { createWindow(); } },
    { type: "separator" },
    { label: "Open Project...", accelerator: "CmdOrCtrl+O", click: () => { /* Open folder logic */ } }
  ]
}];

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1000,
    height: 700,
    titleBarStyle: "default",
    backgroundColor: "#1e1e1e",
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
    },
    show: false,
  });

  if (isMac) {
    mainWindow.setVibrancy("dark");
  }

  mainWindow.once("ready-to-show", () => {
    mainWindow.show();

    setTimeout(() => {
      mainWindow.webContents.send("text-update", "Hello from main process!");
    }, 1000);
  });

  const template = [
    {
      label: "File",
      submenu: [
        ...(isMac
          ? [
            {
              label: "About",
              click: () => { about() }
            },
            { type: "separator" },
          ]
          : fileSubMenu),
        {
          label: "Quit",
          role: "quit",
        },
      ],
    },
    ...(isMac
      ? fileSubMenu : []),
    {
      label: "Edit",
      submenu: [
        { label: "Undo", accelerator: "CmdOrCtrl+Z", selector: "undo:" },
        { label: "Redo", accelerator: "Shift+CmdOrCtrl+Z", selector: "redo:" },
        { type: "separator" },
        { label: "Cut", accelerator: "CmdOrCtrl+X", selector: "cut:" },
        { label: "Copy", accelerator: "CmdOrCtrl+C", selector: "copy:" },
        { label: "Paste", accelerator: "CmdOrCtrl+V", selector: "paste:" },
        { label: "Select All", accelerator: "CmdOrCtrl+A", selector: "selectAll:" }
      ]
    },
    {
      label: "Debug",
      submenu: [
        {
          label: "Run",
          click: () => {
            if (mainWindow && !mainWindow.isDestroyed()) {
              mainWindow.webContents.send("run-shortcut-pressed");
            }
          },
          accelerator: isMac ? "CommandOrControl+R" : "F5",
        },
        { type: "separator" },
        {
          label: "Build",
          click: () => {
            if (mainWindow && !mainWindow.isDestroyed()) {
              mainWindow.webContents.send("build-shortcut-pressed");
            }
          },
          accelerator: isMac ? "CommandOrControl+B" : "F6",
        },
      ],
    },
    {
      label: "Help",
      submenu: [
        {
          label: "Toggle Developer Tools",
          accelerator: isMac ? "Cmd+Option+I" : "Ctrl+Shift+I",
          click: () => {
            mainWindow.webContents.toggleDevTools();
          },
        },
        ...(!isMac
          ? [
            { type: "separator" },
            {
              label: "About",
              click: () => { about() }
            },
          ]
          : []),
      ],
    },
  ];

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);

  mainWindow.loadFile(path.join(__dirname, "index.html"));
  registerGlobalShortcuts(mainWindow);

  return mainWindow;
}

function createSplash() {
  const splash = new BrowserWindow({
    width: 400,
    height: 300,
    frame: false,
    resizable: false,
    alwaysOnTop: false,
    webPreferences: {
      preload: path.join(__dirname, "splash", "preload.js"),
    },
  });

  splash.loadFile(path.join(__dirname, "splash", "splash.html"));
  return splash;
}

function registerGlobalShortcuts(win) {
  const devToolsShortcut = isMac
    ? "CommandOrControl+Alt+I"
    : "CommandOrControl+Shift+I";
  globalShortcut.register(devToolsShortcut, () => {
    if (win && !win.isDestroyed()) {
      win.webContents.toggleDevTools();
    }
  });

  const runShortcut = isMac ? "CommandOrControl+R" : "F5";
  globalShortcut.register(runShortcut, () => {
    if (win && !win.isDestroyed()) {
      win.webContents.send("run-shortcut-pressed");
    }
  });
}

app.whenReady().then(async () => {
  var splash = createSplash();
  splash.webContents.send("text-update", "Loading...");
  await new Promise(resolve => setTimeout(resolve, 500));
  splash.webContents.send("text-update", "Checking app folder...");

  let exePath;

  // Determine path based on whether app is packaged
  if (isWin) {
    if (app.isPackaged) {
      exePath = path.join(process.resourcesPath, 'app', 'pogscript.exe');
    } else {
      exePath = path.join(__dirname, '..', 'app', 'pogscript.exe');
    }


    if (!fs.existsSync(exePath)) {
      splash.webContents.send("text-update", "Error: pogscript.exe not found");

      const result = await dialog.showMessageBox(splash, {
        type: 'question',
        title: 'Missing Executable',
        message: 'Install missing executable?',
        detail: 'Do you want to download pogscript.exe?',
        buttons: ['Yes', 'No'],
        cancelId: 1
      });

      if (result.response == 0) {
        splash.webContents.send("text-update", "Downloading pogscript.exe");
        try {
          const appDir = path.dirname(exePath);
          if (!fs.existsSync(appDir)) {
            fs.mkdirSync(appDir, { recursive: true });
          }

          await downloadFile("https://github.com/daniel4-scratch/pogger-script/releases/download/0.1.0a-b1/windows-x84_64.exe", exePath);
          splash.webContents.send("text-update", "Successfully downloaded pogscript.exe");
        } catch (error) {
          console.error('Download failed:', error);
          splash.webContents.send("text-update", "Download failed: " + error.message);
        }
      }
    } else {
      splash.webContents.send("text-update", "Found pogscript.exe");
    }
  } else {
    splash.webContents.send("text-update", "Unsupported platform");
  }

  await new Promise(resolve => setTimeout(resolve, 500));
  splash.close();
  nativeTheme.themeSource = "dark";
  createWindow();
});

ipcMain.handle("run-code", async (event, code) => {
  const tempDir = os.tmpdir();
  const timestamp = Date.now();
  const filePath = path.join(tempDir, `temp_code_${timestamp}.txt`);

  fs.writeFileSync(filePath, code);

  return new Promise((resolve, reject) => {
    if (isWin) {
      let exePath;

      if (app.isPackaged) {
        exePath = path.join(process.resourcesPath, 'app', 'pogscript.exe');
      } else {
        exePath = path.join(__dirname, '..', 'app', 'pogscript.exe');
      }

      if (!fs.existsSync(exePath)) {
        try { fs.unlinkSync(filePath); } catch (err) { }
        resolve(`Error: pogscript.exe not found at: ${exePath}`);
        return;
      }

      const customProcess = spawn(exePath, [filePath]);

      let output = "";
      let errorOutput = "";

      customProcess.stdout.on("data", (data) => {
        output += data.toString();
      });

      customProcess.stderr.on("data", (data) => {
        errorOutput += data.toString();
      });

      customProcess.on("close", (code) => {
        try {
          fs.unlinkSync(filePath);
        } catch (err) {
          // Ignore cleanup errors
        }

        let result = "";
        if (errorOutput) {
          result += "Error:\n" + errorOutput;
        }
        if (output) {
          result += (result ? "\n" : "") + "Output:\n" + output;
        }
        if (!result) {
          result = "No output";
        }

        resolve(result);
      });

      customProcess.on("error", (error) => {
        try {
          fs.unlinkSync(filePath);
        } catch (err) {
          // Ignore cleanup errors
        }

        resolve("Error: " + error.message);
      });
    } else if (isMac) {
      resolve("Coming soon");
    } else {
      resolve("Error: Unsupported platform");
    }
  });
});

// IPC handler for setting text
ipcMain.handle("set-text", async (event, text) => {
  BrowserWindow.getAllWindows().forEach(win => {
    win.webContents.send("text-update", text);
  });
  return "Text sent successfully";
});

app.on("will-quit", () => {
  globalShortcut.unregisterAll();
});

app.on("window-all-closed", () => {
  globalShortcut.unregisterAll();
  app.quit();
});

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

// Cleanup global shortcuts when app quits
app.on("will-quit", () => {
  globalShortcut.unregisterAll();
});

app.on("window-all-closed", () => {
  globalShortcut.unregisterAll();
  app.quit(); // Always quit when all windows are closed
});

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});
