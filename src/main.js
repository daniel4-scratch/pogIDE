const { app, nativeTheme, globalShortcut } = require('./shared/utils/constants');
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
    splash.webContents.on('did-finish-load', async () => {
        splash.webContents.send("text-update", "Loading...");
        await new Promise(resolve => setTimeout(resolve, 500));
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

        await new Promise(resolve => setTimeout(resolve, 500));
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
  app.quit();
});

app.on("activate", () => {
  const { mainWindow } = require('./shared/utils/window');
  if (!mainWindow) {
    const mainWin = createWindow();
    setMainWindow(mainWin);
  }
});

app.on("will-quit", () => {
  globalShortcut.unregisterAll();
});
