const {
  app,
  BrowserWindow,
  ipcMain,
  Menu,
  dialog,
  globalShortcut,
  nativeTheme
} = require("electron");
const { spawn } = require("child_process");
const path = require("path");
const fs = require("fs");
const os = require("os");
const http = require('http');
const packageJson = require(path.join(__dirname, '..', 'package.json'));

const isMac = process.platform === "darwin";
const isWin = process.platform === "win32";

// Disable GPU cache to reduce cache conflicts
app.commandLine.appendSwitch('--disable-gpu-cache');
app.commandLine.appendSwitch('--disable-gpu-sandbox');
// Reduce some cache-related error messages
app.commandLine.appendSwitch('--no-sandbox');

let mainWindow;

// Track if code is currently running
let isCodeRunning = false;

// Single instance lock
const gotTheLock = app.requestSingleInstanceLock();

// Suppress some Chromium cache errors in console for cleaner output
if (!gotTheLock) {
  // Suppress error output for the brief second instance
  process.stderr.write = () => {};
  process.stdout.write = () => {};
}

if (!gotTheLock) {
  // Quit immediately without initializing anything to minimize cache conflicts
  app.exit(0);
} else {
  app.on('second-instance', (event, commandLine, workingDirectory) => {
    // Someone tried to run a second instance, we should focus our window instead
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
      // Create a new window instead of just focusing
      createWindow();
    } else {
      createWindow();
    }
  });
}

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

var fileSubMenu = [
    { label: "New Window", accelerator: "CmdOrCtrl+Shift+N", click: () => { createWindow(); } },
    { type: "separator" },
    { label: "Open Project...", accelerator: "CmdOrCtrl+O", click: () => { /* Open folder logic */ } }
  ];

function createWindow() {
  const newWindow = new BrowserWindow({
    width: 1000,
    height: 700,
    titleBarStyle: "default",
    backgroundColor: "#1e1e1e",
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: false, // Disable sandbox to allow npm modules in preload
    },
    show: false,
  });
  // Set mainWindow only if it's not already set (first window)
  if (!mainWindow) {
    mainWindow = newWindow;
  }

  if (isMac) {
    newWindow.setVibrancy("dark");
  }

  newWindow.once("ready-to-show", () => {
    newWindow.show();

    setTimeout(() => {
      newWindow.webContents.send("text-update", "Hello from main process!");
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
          : [...fileSubMenu, { type: "separator" }]),
        {
          label: "Quit",
          role: "quit",
          accelerator: isMac ? "Command+Q" : "Ctrl+Q"
        },
      ],
    },
    ...(isMac
      ? [{
        label: "File",
        submenu: fileSubMenu
      }] : []),
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
            const focusedWindow = BrowserWindow.getFocusedWindow();
            if (focusedWindow && !focusedWindow.isDestroyed()) {
              focusedWindow.webContents.send("run-shortcut-pressed");
            }
          },
          accelerator: isMac ? "CommandOrControl+R" : "F5",
        },
        { type: "separator" },
        {
          label: "Build",
          click: () => {
            const focusedWindow = BrowserWindow.getFocusedWindow();
            if (focusedWindow && !focusedWindow.isDestroyed()) {
              focusedWindow.webContents.send("build-shortcut-pressed");
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
            const focusedWindow = BrowserWindow.getFocusedWindow();
            if (focusedWindow && !focusedWindow.isDestroyed()) {
              focusedWindow.webContents.toggleDevTools();
            }
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

  newWindow.loadFile(path.join(__dirname, "index.html"));
  registerGlobalShortcuts(newWindow);

  // Handle window closing
  newWindow.on('closed', () => {
    // If the closed window was the main window, reassign mainWindow to another window
    if (newWindow === mainWindow) {
      const allWindows = BrowserWindow.getAllWindows();
      mainWindow = allWindows.length > 0 ? allWindows[0] : null;
    }
  });

  return newWindow;
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
  var buffer = 500;
  var splash = createSplash();
  splash.webContents.send("text-update", "Loading...");
  await new Promise(resolve => setTimeout(resolve, buffer));
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

      // const result = await dialog.showMessageBox(splash, {
      //   type: 'question',
      //   title: 'Missing Executable',
      //   message: 'Install missing executable?',
      //   detail: 'Do you want to download pogscript.exe?',
      //   buttons: ['Yes', 'No'],
      //   cancelId: 1
      // });

      if (true) {
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

  await new Promise(resolve => setTimeout(resolve, buffer));
  splash.close();
  nativeTheme.themeSource = "dark";
  createWindow();
});

ipcMain.handle("run-code", async (event, code) => {
  // Check if code is already running
  if (isCodeRunning) {
    return;
  }

  // Set the flag to indicate code is running
  isCodeRunning = true;

  const tempDir = os.tmpdir();
  const timestamp = Date.now();
  const filePath = path.join(tempDir, `temp_code_${timestamp}.txt`);

  fs.writeFileSync(filePath, code);

  return new Promise((resolve, reject) => {
    const finishExecution = (result) => {
      // Reset the flag when execution is complete
      isCodeRunning = false;
      resolve(result);
    };

    if (isWin) {
      let exePath;

      if (app.isPackaged) {
        exePath = path.join(process.resourcesPath, 'app', 'pogscript.exe');
      } else {
        exePath = path.join(__dirname, '..', 'app', 'pogscript.exe');
      }

      if (!fs.existsSync(exePath)) {
        try { fs.unlinkSync(filePath); } catch (err) { }
        finishExecution(`Error: pogscript.exe not found at: ${exePath}`);
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

        finishExecution(result);
      });

      customProcess.on("error", (error) => {
        try {
          fs.unlinkSync(filePath);
        } catch (err) {
          // Ignore cleanup errors
        }

        finishExecution("Error: " + error.message);
      });
    } else if (isMac) {
      finishExecution("Coming soon");
    } else {
      finishExecution("Error: Unsupported platform");
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

// IPC handler to check if code is running
ipcMain.handle("is-code-running", async (event) => {
  return isCodeRunning;
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
