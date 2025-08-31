const { app, nativeTheme, globalShortcut, BrowserWindow } = require('./shared/utils/constants');
const { initializeConfig } = require('./shared/utils/config');
const { createWindow, createSplash, setMainWindow, setCodeRunning, checkOnlineStatus } = require('./shared/utils/window');
const { setupIpcHandlers } = require('./shared/utils/ipc');
const { checkExePath, installExe } = require("./shared/utils/installer.js");
const { isWin, isMacARM } = require('./shared/utils/window');

// Single instance lock
const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    const { mainWindow } = require('./shared/utils/window');
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });
}

app.whenReady().then(async () => {
  try {
    const { configData } = initializeConfig();
    const splash = createSplash();
    var buffer = 500;
    splash.webContents.on('did-finish-load', async () => {
        splash.webContents.send("text-update", "Loading...");
        await new Promise(resolve => setTimeout(resolve, buffer));
        splash.webContents.send("text-update", "Checking for updates...");

        if (isWin || isMacARM) {
            if (configData.autoInstallPogscript) {
                const exePath = checkExePath();
                if (!require('./shared/utils/constants').fs.existsSync(exePath)) {
                    const isOnline = await checkOnlineStatus();
                    if (isOnline) {
                        splash.webContents.send("text-update", "Downloading pogscript...");
                        const result = await installExe(exePath, splash);
                        splash.webContents.send("text-update", result);
                    } else {
                        splash.webContents.send("text-update", "No internet connection.");
                    }
                }
            }
        } else {
            splash.webContents.send("text-update", "Unsupported platform");
        }

        await new Promise(resolve => setTimeout(resolve, buffer));
        splash.close();
        nativeTheme.themeSource = "dark";
        const mainWin = createWindow();
        setMainWindow(mainWin);
    });
  } catch (error) {
    console.error('Error during app initialization:', error);
  }
});

setupIpcHandlers();

app.on("window-all-closed", () => {
  globalShortcut.unregisterAll();
  // On macOS, keep the app running even when all windows are closed
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on("activate", () => {
  // Check if there are any existing windows first
  const allWindows = BrowserWindow.getAllWindows();
  
  if (allWindows.length > 0) {
    // Focus the first existing window
    const existingWindow = allWindows[0];
    if (existingWindow.isMinimized()) {
      existingWindow.restore();
    }
    existingWindow.show();
    existingWindow.focus();
  } else {
    // Only create a new window if no windows exist
    const mainWin = createWindow();
    setMainWindow(mainWin);
  }
});

app.on("will-quit", () => {
  globalShortcut.unregisterAll();
});
