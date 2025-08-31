const {
  app,
  BrowserWindow,
  ipcMain,
  Menu,
  dialog,
  globalShortcut,
  nativeTheme,
  clipboard
} = require("electron");
const { spawn } = require("child_process");
const path = require("path");
const fs = require("fs");
const os = require("os");
const http = require('http');
const { checkExePath, installExe, uninstallExe } = require("./utils/installer.js");
const packageJson = require(path.join(__dirname, '..', 'package.json'));

let isMac = process.platform === "darwin";
let isMacARM = isMac && process.arch === "arm64";
let isWin = process.platform === "win32";

// Config
let configData;
let configPath;

// Chromium flags
app.commandLine.appendSwitch('--disable-gpu-cache');
app.commandLine.appendSwitch('--disable-gpu-sandbox');
app.commandLine.appendSwitch('--no-sandbox');

let mainWindow;

// Run-state flag
let isCodeRunning = false;

// Track active run sessions per window (for interactive stdin/stdout)
const runSessions = new Map(); // key: webContents.id -> { proc, filePath }

// Single instance lock
const gotTheLock = app.requestSingleInstanceLock();

// Silence output if a second instance is rejected
if (!gotTheLock) {
  process.stderr.write = () => { };
  process.stdout.write = () => { };
}

if (!gotTheLock) {
  // Quit immediately without initializing anything to minimize cache conflicts
  app.exit(0);
} else {
  app.on('second-instance', (event, commandLine, workingDirectory) => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
      createWindow();
    } else {
      createWindow();
    }
  });
}

async function about() {
  var info = `Version: ${packageJson.version}
OS: ${os.platform()} ${os.release()} ${os.arch()}
Electron: ${process.versions.electron}
ElectronBuildID: ${process.versions.electronBuildId}
Nodejs: ${process.versions.node}
Chromium: ${process.versions.chrome}`
  //copy details dialog
  const result = await dialog.showMessageBox(mainWindow, {
    type: 'info',
    title: 'About Pogscript IDE',
    message: 'Pogscript IDE',
    detail: info,
    defaultId: 0,
    buttons: ["Copy", "OK"]
  });
  if (result.response === 0) {
    clipboard.writeText(info);
  }
}

var fileSubMenu = [
  { label: "New Window", accelerator: "CmdOrCtrl+Shift+N", click: () => { createWindow(); } },
  { label: "Close Window", accelerator: isMac ? "Cmd+W" : "Alt+F4", click: () => {
      const focusedWindow = BrowserWindow.getFocusedWindow();
      if (focusedWindow && !focusedWindow.isDestroyed()) {
        focusedWindow.close();
      }
    } },
  { type: "separator" },
  { label: "Open Project...", enabled: false, accelerator: "CmdOrCtrl+O", click: () => { /* Open folder logic */ } }
];

function createWindow() {
  const newWindow = new BrowserWindow({
    width: 1000,
    height: 700,
    minHeight: 500,
    minWidth: 500,
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
  // Set first window as mainWindow
  if (!mainWindow) {
    mainWindow = newWindow;
  }

  if (isMac) {
    newWindow.setVibrancy("dark");
  }

  newWindow.once("ready-to-show", () => {
    newWindow.show();
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
        { 
          label: "Undo", 
          accelerator: "CmdOrCtrl+Z", 
          click: () => {
            const focusedWindow = BrowserWindow.getFocusedWindow();
            if (focusedWindow && !focusedWindow.isDestroyed()) {
              focusedWindow.webContents.send("edit-action", "undo");
            }
          }
        },
        { 
          label: "Redo", 
          accelerator: "Shift+CmdOrCtrl+Z", 
          click: () => {
            const focusedWindow = BrowserWindow.getFocusedWindow();
            if (focusedWindow && !focusedWindow.isDestroyed()) {
              focusedWindow.webContents.send("edit-action", "redo");
            }
          }
        },
        { type: "separator" },
        { 
          label: "Cut", 
          accelerator: "CmdOrCtrl+X", 
          click: () => {
            const focusedWindow = BrowserWindow.getFocusedWindow();
            if (focusedWindow && !focusedWindow.isDestroyed()) {
              focusedWindow.webContents.send("edit-action", "cut");
            }
          }
        },
        { 
          label: "Copy", 
          accelerator: "CmdOrCtrl+C", 
          click: () => {
            const focusedWindow = BrowserWindow.getFocusedWindow();
            if (focusedWindow && !focusedWindow.isDestroyed()) {
              focusedWindow.webContents.send("edit-action", "copy");
            }
          }
        },
        { 
          label: "Paste", 
          accelerator: "CmdOrCtrl+V", 
          click: () => {
            const focusedWindow = BrowserWindow.getFocusedWindow();
            if (focusedWindow && !focusedWindow.isDestroyed()) {
              focusedWindow.webContents.send("edit-action", "paste");
            }
          }
        },
        { 
          label: "Select All", 
          accelerator: "CmdOrCtrl+A", 
          click: () => {
            const focusedWindow = BrowserWindow.getFocusedWindow();
            if (focusedWindow && !focusedWindow.isDestroyed()) {
              focusedWindow.webContents.send("edit-action", "selectAll");
            }
          }
        }
      ]
    },
    {
      label: "View",
      submenu: [
        {
          label: "Toggle Controls Bar",
          accelerator: isMac ? "Cmd+Shift+C" : "Ctrl+Shift+C",
          click: () => {
            const focusedWindow = BrowserWindow.getFocusedWindow();
            if (focusedWindow && !focusedWindow.isDestroyed()) {
              focusedWindow.webContents.send("toggle-controls-bar");
            }
          }
        },
        {
          label: "Toggle Terminal",
          accelerator: isMac ? "Cmd+Shift+T" : "Ctrl+Shift+T",
          click: () => {
            const focusedWindow = BrowserWindow.getFocusedWindow();
            if (focusedWindow && !focusedWindow.isDestroyed()) {
              focusedWindow.webContents.send("toggle-terminal");
            }
          }
        }
      ]
    },
    {
      label: "Run",
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
        { type: "separator" },
        {
          type: "submenu",
          label: "Pogscript",
          submenu: [
            {
              type: "checkbox",
              label: "Auto Install",
              checked: configData.autoInstallPogscript,
              click: (item) => {
                configData.autoInstallPogscript = item.checked;
                saveConfig();
              }
            },
            {
              label: !fs.existsSync(checkExePath()) ? "Reinstall" : "Install",
              click: async () => {
                var splash = createSplash();
                if (isWin || isMacARM) {
                  const exePath = checkExePath();

                  const isOnline = await new Promise((resolve) => {
                    require('dns').lookup('github.com', (err) => {
                      resolve(!err);
                    });
                  });

                  if (!isOnline) {
                    splash.webContents.send("text-update", "No internet connection. Cannot download pogscript executable");
                  } else {
                    splash.webContents.send("text-update", "Downloading pogscript executable");
                    const result = await installExe(exePath, splash);
                    splash.webContents.send("text-update", result);
                  }
                } else {
                  splash.webContents.send("text-update", "Unsupported platform");
                }
                setTimeout(() => {
                  splash.close();
                }, 500);
              }
            },
            {
              label: "Uninstall",
              click: async () => {
                var splash = createSplash();
                splash.webContents.send("text-update", "Uninstalling pogscript...");
                const exePath = checkExePath();
                const result = await uninstallExe(exePath);
                splash.webContents.send("text-update", result);
                setTimeout(() => {
                  splash.close();
                }, 500);
              }
            },
            {
              label: "Github",
              click: () => {
                require("electron").shell.openExternal("https://github.com/daniel4-scratch/pogger-script");
              }
            }

          ]
        }
      ],
    },
    {
      label: "Help",
      role: "help",
      submenu: [
        {
          label: "Documentation",
          click: () => {
            require("electron").shell.openExternal("https://daniel4-scratch.is-a.dev/pogger-script/Programming.html");
          }
        },
        {type: "separator"},
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

  // Ensure keybinds work consistently (even when renderer captures keys)
  newWindow.webContents.on('before-input-event', (event, input) => {
    const isCmdOrCtrl = input.control || input.meta;
    const key = String(input.key || '').toLowerCase();
    // View toggles: Ctrl/Cmd+Shift+C and Ctrl/Cmd+Shift+T
    if (isCmdOrCtrl && input.shift && (key === 'c' || key === 't')) {
      const channel = key === 'c' ? 'toggle-controls-bar' : 'toggle-terminal';
      try { newWindow.webContents.send(channel); } catch (_) {}
      event.preventDefault();
      return;
    }

    // Edit shortcuts
    if (isCmdOrCtrl && !input.alt && !input.shift) {
      switch (key) {
        case 'a': // Select All
          try { newWindow.webContents.send('edit-action', 'selectAll'); } catch (_) {}
          event.preventDefault();
          return;
        case 'c': // Copy
          try { newWindow.webContents.send('edit-action', 'copy'); } catch (_) {}
          event.preventDefault();
          return;
        case 'v': // Paste
          try { newWindow.webContents.send('edit-action', 'paste'); } catch (_) {}
          event.preventDefault();
          return;
        case 'x': // Cut
          try { newWindow.webContents.send('edit-action', 'cut'); } catch (_) {}
          event.preventDefault();
          return;
        case 'z': // Undo
          try { newWindow.webContents.send('edit-action', 'undo'); } catch (_) {}
          event.preventDefault();
          return;
      }
    }
    if (isCmdOrCtrl && input.shift && key === 'z') {
      try { newWindow.webContents.send('edit-action', 'redo'); } catch (_) {}
      event.preventDefault();
      return;
    }
  });

  // Cleanup on window close
  const wcId = newWindow.webContents.id;
  newWindow.on('closed', () => {
    // Cleanup run session for this window
    const id = wcId;
    const session = runSessions.get(id);
    if (session && session.proc && !session.proc.killed) {
      try { session.proc.kill(); } catch (_) { }
    }
    runSessions.delete(id);
    // Reassign mainWindow if needed
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

  // Register build shortcut
  const buildShortcut = isMac ? "CommandOrControl+B" : "F6";
  globalShortcut.register(buildShortcut, () => {
    if (win && !win.isDestroyed()) {
      win.webContents.send("build-shortcut-pressed");
    }
  });
}

function getConfigPath() {
  if (app.isPackaged) {
    return path.join(process.resourcesPath, 'app', 'config.json');
  } else {
    return path.join(__dirname, '..', 'app', 'config.json');
  }
}

function saveConfig() {
  if (configData && configPath) {
    fs.writeFileSync(configPath, JSON.stringify(configData, null, 2));
  }
}

function config() {
  //create config.json if cant find
  const jsonTemplate = {
    autoInstallPogscript: true
  };
  
  configPath = getConfigPath();

  if (!fs.existsSync(configPath)) {
    // Create the directory if it doesn't exist
    const dirPath = path.dirname(configPath);
    if (!fs.existsSync(dirPath)) {
      fs.mkdirSync(dirPath, { recursive: true });
    }
    fs.writeFileSync(configPath, JSON.stringify(jsonTemplate));
    configData = jsonTemplate;
    return jsonTemplate;
  } else {
    configData = JSON.parse(fs.readFileSync(configPath));
    return configData;
  }
}app.whenReady().then(async () => {
  try {
    config(); // Initialize global configData and configPath
    var buffer = 500;
    var splash = createSplash();
    splash.webContents.send("text-update", "Loading...");
    await new Promise(resolve => setTimeout(resolve, buffer));
  splash.webContents.send("text-update", "Checking app folder...");

  // Determine path based on whether app is packaged
  if (isWin || isMacARM) {
    const exePath = checkExePath();

    if (configData.autoInstallPogscript) {
      if (!fs.existsSync(exePath)) {
  splash.webContents.send("text-update", "Error: pogscript executable not found");

        const isOnline = await new Promise((resolve) => {
          require('dns').lookup('github.com', (err) => {
            resolve(!err);
          });
        });

        if (!isOnline) {
          splash.webContents.send("text-update", "No internet connection. Cannot download pogscript executable");
        } else {
          splash.webContents.send("text-update", "Downloading pogscript executable");
          const result = await installExe(exePath, splash);
          splash.webContents.send("text-update", result);
        }

      } else {
        splash.webContents.send("text-update", "Found pogscript executable");
      }
    } else {
      splash.webContents.send("text-update", "Pogscript auto-install disabled");
    }
  }else{
    splash.webContents.send("text-update", "Unsupported platform");
  }

  await new Promise(resolve => setTimeout(resolve, buffer));
  splash.close();
  nativeTheme.themeSource = "dark";
  createWindow();
  } catch (error) {
    console.error('Error during app initialization:', error);
    // You can also show an error dialog to the user if needed
    if (splash && !splash.isDestroyed()) {
      splash.webContents.send("text-update", "Error during initialization: " + error.message);
    }
  }
});

ipcMain.handle("build-code", async (event, code) => {
  const tempDir = os.tmpdir();
  const timestamp = Date.now();
  const filePath = path.join(tempDir, `main.pog`);

  // Show save dialog to let user choose where to save build.pogx
  const focusedWindow = BrowserWindow.getFocusedWindow();
  const saveDialogResult = await dialog.showSaveDialog(focusedWindow, {
    title: 'Save Build Archive',
    defaultPath: 'build.pogx',
    filters: [
      { name: 'Pogscript Archive', extensions: ['pogx'] },
      { name: 'All Files', extensions: ['*'] }
    ]
  });

  if (saveDialogResult.canceled) {
    return "Build canceled by user";
  }

  const outputPath = saveDialogResult.filePath;

  fs.writeFileSync(filePath, code);

  return new Promise((resolve, reject) => {
    if (isWin || isMacARM) {
      const exePath = checkExePath();

      if (!fs.existsSync(exePath)) {
        try { fs.unlinkSync(filePath); } catch (err) { }
        resolve(`Error: pogscript.exe not found at: ${exePath}`);
        return;
      }

      // Use --archive flag for build command with user-selected output path
      const customProcess = spawn(exePath, ['--archive', outputPath, filePath]);

      let output = "";
      let errorOutput = "";

      customProcess.stdout.on("data", (data) => {
        output += data.toString();
      });

      customProcess.stderr.on("data", (data) => {
        errorOutput += data.toString();
      });

      customProcess.on("close", (code) => {
  try { fs.unlinkSync(filePath); } catch (err) {}

        let result = "";
        if (errorOutput) {
          result += "Build Error:\n" + errorOutput;
        }
        if (output) {
          result += (result ? "\n" : "") + "Build Output:\n" + output;
        }
        if (!result) {
          result = `Build completed successfully!\nArchive saved to: ${outputPath}`;
        } else {
          result += `\nArchive saved to: ${outputPath}`;
        }

        resolve(result);
      });

      customProcess.on("error", (error) => {
  try { fs.unlinkSync(filePath); } catch (err) {}

        resolve("Build Error: " + error.message);
      });
    } else {
      resolve("Error: Unsupported platform for build");
    }
  });
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

    if (isWin || isMacARM) {
      const exePath = checkExePath();

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
  try { fs.unlinkSync(filePath); } catch (err) {}

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
  try { fs.unlinkSync(filePath); } catch (err) {}

        finishExecution("Error: " + error.message);
      });
    } else {
      finishExecution("Error: Unsupported platform");
    }
  });
});

// Start a streaming/interactive run. Streams stdout/stderr to renderer and accepts stdin from renderer.
ipcMain.handle('start-run', async (event, code) => {
  if (isCodeRunning) {
    return { started: false, reason: 'A program is already running' };
  }

  const tempDir = os.tmpdir();
  const timestamp = Date.now();
  const filePath = path.join(tempDir, `temp_code_${timestamp}.txt`);
  fs.writeFileSync(filePath, code);

  if (!(isWin || isMacARM)) {
    try { fs.unlinkSync(filePath); } catch (_) { }
    return { started: false, reason: 'Unsupported platform' };
  }

  const exePath = checkExePath();
  if (!fs.existsSync(exePath)) {
    try { fs.unlinkSync(filePath); } catch (_) { }
    return { started: false, reason: `pogscript.exe not found at: ${exePath}` };
  }

  try {
    const child = spawn(exePath, [filePath]);
    isCodeRunning = true;
    const sender = event.sender;
    runSessions.set(sender.id, { proc: child, filePath });

    child.stdout.on('data', (data) => {
      try { sender.send('run-output', data.toString()); } catch (_) { }
    });
    child.stderr.on('data', (data) => {
      try { sender.send('run-error', data.toString()); } catch (_) { }
    });
    child.on('close', (code) => {
      try { fs.unlinkSync(filePath); } catch (_) { }
      isCodeRunning = false;
      runSessions.delete(sender.id);
      try { sender.send('run-exit', code); } catch (_) { }
    });
    child.on('error', (err) => {
      try { fs.unlinkSync(filePath); } catch (_) { }
      isCodeRunning = false;
      runSessions.delete(sender.id);
      try { sender.send('run-error', String(err?.message || err)); } catch (_) { }
      try { sender.send('run-exit', -1); } catch (_) { }
    });

    return { started: true };
  } catch (err) {
    try { fs.unlinkSync(filePath); } catch (_) { }
    isCodeRunning = false;
    return { started: false, reason: String(err?.message || err) };
  }
});

// Receive stdin data from renderer for active run
ipcMain.on('run-input', (event, data) => {
  const session = runSessions.get(event.sender.id);
  if (session && session.proc && !session.proc.killed) {
    try { session.proc.stdin.write(data); } catch (_) { }
  }
});

// Stop the currently running process (if any)
ipcMain.handle('stop-run', async (event) => {
  const session = runSessions.get(event.sender.id);
  if (session && session.proc && !session.proc.killed) {
    try { session.proc.kill(); } catch (_) { }
    return { stopped: true };
  }
  return { stopped: false };
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
  app.quit(); // Always quit when all windows are closed
});

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});
