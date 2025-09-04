// window.js - Manages window creation, menu building, global shortcuts, and main window state for the Electron app.
const {
    app,
    BrowserWindow,
    ipcMain,
    Menu,
    dialog,
    globalShortcut,
    nativeTheme,
    clipboard,
    spawn,
    path,
    fs,
    os,
    http
} = require('./constants');
const { checkExePath, installExe, uninstallExe } = require("./installer.js");
const { initializeConfig, saveConfig, getConfigData, setConfigData } = require('./config');
const packageJson = require(path.join(__dirname, '..', '..', '..', 'package.json'));

let isMac = process.platform === "darwin";
let isMacARM = isMac && process.arch === "arm64";
let isWin = process.platform === "win32";

let mainWindow;
let isCodeRunning = false;
const runSessions = new Map();

function createWindow() {
    const newWindow = new BrowserWindow({
        width: 1000,
        height: 700,
        minHeight: 500,
        minWidth: 500,
        titleBarStyle: "default",
        backgroundColor: "#1e1e1e",
        webPreferences: {
            preload: path.join(__dirname, '..', '..', 'preload.js'),
            nodeIntegration: false,
            contextIsolation: true,
            sandbox: false,
        },
        show: false,
    });

    if (!mainWindow) {
        mainWindow = newWindow;
    }

    if (isMac) {
        newWindow.setVibrancy("dark");
    }

    newWindow.once("ready-to-show", () => {
        newWindow.show();
    });

    const template = buildMenu();
    const menu = Menu.buildFromTemplate(template);
    Menu.setApplicationMenu(menu);

    newWindow.loadFile(path.join(__dirname, '..', '..', 'index.html'));
    registerGlobalShortcuts(newWindow);
    setupWindowEvents(newWindow);

    return newWindow;
}

function createSplash() {
    const splash = new BrowserWindow({
        width: 400,
        height: 300,
        resizable: false,
        alwaysOnTop: true,
        roundedCorners: true,
        skipTaskbar: true,
        hasShadow: true,
        titleBarStyle: "hidden",
        webPreferences: {
            preload: path.join(__dirname, '..', '..', 'splash', 'preload.js'),
        },
    });
    if(isMac){
        splash.setWindowButtonVisibility(false);
    }
    splash.setMenu(null);
    splash.loadFile(path.join(__dirname, '..', '..', 'splash', 'splash.html'));
    return splash;
}

function setupWindowEvents(win) {
    win.webContents.on('before-input-event', (event, input) => {
        handleInput(event, input, win);
    });

    const wcId = win.webContents.id;
    win.on('closed', () => {
        const session = runSessions.get(wcId);
        if (session && session.proc && !session.proc.killed) {
            try { session.proc.kill(); } catch (_) { }
        }
        runSessions.delete(wcId);

        if (win === mainWindow) {
            mainWindow = null;
        }
    });
}

function handleInput(event, input, win) {
    const isCmdOrCtrl = input.control || input.meta;
    const key = String(input.key || '').toLowerCase();

    if (isCmdOrCtrl && input.shift && (key === 'c' || key === 't')) {
        const channel = key === 'c' ? 'toggle-controls-bar' : 'toggle-terminal';
        try { win.webContents.send(channel); } catch (_) { }
        event.preventDefault();
        return;
    }

    if (isCmdOrCtrl && !input.alt && !input.shift) {
        const editActions = { 'a': 'selectAll', 'c': 'copy', 'v': 'paste', 'x': 'cut', 'z': 'undo' };
        if (editActions[key]) {
            try { win.webContents.send('edit-action', editActions[key]); } catch (_) { }
            event.preventDefault();
            return;
        }
    }

    if (isCmdOrCtrl && input.shift && key === 'z') {
        try { win.webContents.send('edit-action', 'redo'); } catch (_) { }
        event.preventDefault();
        return;
    }
}

function registerGlobalShortcuts(win) {
    const shortcuts = {
        "CommandOrControl+Alt+I": () => win.webContents.toggleDevTools(),
        "CommandOrControl+R": () => win.webContents.send("run-shortcut-pressed"),
        "CommandOrControl+B": () => win.webContents.send("build-shortcut-pressed")
    };

    for (const [accelerator, callback] of Object.entries(shortcuts)) {
        globalShortcut.register(accelerator, () => {
            if (win && !win.isDestroyed()) {
                callback();
            }
        });
    }
}

async function about() {
    const info = `Version: ${packageJson.version}
OS: ${os.platform()} ${os.release()} ${os.arch()}
Electron: ${process.versions.electron}
Nodejs: ${process.versions.node}
Chromium: ${process.versions.chrome}`;

    const result = await dialog.showMessageBox(mainWindow, {
        type: 'info',
        title: 'About Pogscript IDE',
        message: 'Pogscript IDE',
        detail: info,
        buttons: ["Copy", "OK"]
    });

    if (result.response === 0) {
        clipboard.writeText(info);
    }
}

function buildMenu() {
    const { configData } = initializeConfig();
    const fileSubMenu = [
        { label: "New Window", accelerator: "CmdOrCtrl+Shift+N", click: () => { createWindow(); } },
        { label: "Close Window", accelerator: isMac ? "Cmd+Shift+W" : "Alt+F4", click: () => {
            const focusedWindow = BrowserWindow.getFocusedWindow();
            if (focusedWindow && !focusedWindow.isDestroyed()) {
                focusedWindow.close();
            }
        }},
        { type: "separator" },
        { label: "Open Project...", enabled: false, accelerator: "CmdOrCtrl+O", click: () => {} }
    ];

    const template = [
        {
            label: "File",
            submenu: [
                ...(isMac ? [{ label: "About", click: about }, { type: "separator" }] : [...fileSubMenu, { type: "separator" }]),
                { label: "Quit", role: "quit", accelerator: isMac ? "Command+Q" : "Ctrl+Q" },
            ],
        },
        ...(isMac ? [{ label: "File", submenu: fileSubMenu }] : []),
        {
            label: "Edit",
            submenu: [
                { label: "Undo", accelerator: "CmdOrCtrl+Z", click: () => sendEditAction("undo") },
                { label: "Redo", accelerator: "Shift+CmdOrCtrl+Z", click: () => sendEditAction("redo") },
                { type: "separator" },
                { label: "Cut", accelerator: "CmdOrCtrl+X", click: () => sendEditAction("cut") },
                { label: "Copy", accelerator: "CmdOrCtrl+C", click: () => sendEditAction("copy") },
                { label: "Paste", accelerator: "CmdOrCtrl+V", click: () => sendEditAction("paste") },
                { label: "Select All", accelerator: "CmdOrCtrl+A", click: () => sendEditAction("selectAll") }
            ]
        },
        {
            label: "View",
            submenu: [
                { label: "Toggle Controls Bar", accelerator: "Cmd+Shift+C", click: () => sendViewAction("toggle-controls-bar") },
                { label: "Toggle Terminal", accelerator: "Cmd+Shift+T", click: () => sendViewAction("toggle-terminal") }
            ]
        },
        {
            label: "Run",
            submenu: [
                { label: "Run", accelerator: "CmdOrCtrl+R", click: () => sendRunAction("run-shortcut-pressed") },
                { label: "Build", accelerator: "CmdOrCtrl+B", click: () => sendRunAction("build-shortcut-pressed") },
                { type: "separator" },
                {
                    label: "Pogscript",
                    submenu: [
                        {
                            type: "checkbox",
                            label: "Auto Install",
                            checked: configData.autoInstallPogscript,
                            click: (item) => {
                                let currentConfig = getConfigData();
                                currentConfig.autoInstallPogscript = item.checked;
                                setConfigData(currentConfig);
                                saveConfig();
                            }
                        },
                        {
                            label: !fs.existsSync(checkExePath()) ? "Reinstall" : "Install",
                            click: handlePogscriptInstall
                        },
                        { label: "Uninstall", click: handlePogscriptUninstall },
                        { label: "Github", click: () => require("electron").shell.openExternal("https://github.com/daniel4-scratch/pogger-script") }
                    ]
                }
            ]
        },
        {
            label: "Help",
            role: "help",
            submenu: [
                { label: "Documentation", click: () => require("electron").shell.openExternal("https://daniel4-scratch.is-a.dev/pogger-script/Programming.html") },
                { type: "separator" },
                { label: "Toggle Developer Tools", accelerator: "Cmd+Option+I", click: () => BrowserWindow.getFocusedWindow()?.webContents.toggleDevTools() },
                ...(!isMac ? [{ type: "separator" }, { label: "About", click: about }] : []),
            ],
        },
    ];
    return template;
}

function sendEditAction(action) {
    const focusedWindow = BrowserWindow.getFocusedWindow();
    if (focusedWindow && !focusedWindow.isDestroyed()) {
        focusedWindow.webContents.send("edit-action", action);
    }
}

function sendViewAction(action) {
    const focusedWindow = BrowserWindow.getFocusedWindow();
    if (focusedWindow && !focusedWindow.isDestroyed()) {
        focusedWindow.webContents.send(action);
    }
}

function sendRunAction(action) {
    const focusedWindow = BrowserWindow.getFocusedWindow();
    if (focusedWindow && !focusedWindow.isDestroyed()) {
        focusedWindow.webContents.send(action);
    }
}

async function handlePogscriptInstall() {
    const splash = createSplash();
    if (isWin || isMacARM) {
        const exePath = checkExePath();
        const isOnline = await checkOnlineStatus();
        if (!isOnline) {
            splash.webContents.send("text-update", "No internet connection.");
        } else {
            splash.webContents.send("text-update", "Downloading pogscript...");
            const result = await installExe(exePath, splash);
            splash.webContents.send("text-update", result);
        }
    } else {
        splash.webContents.send("text-update", "Unsupported platform");
    }
    setTimeout(() => splash.close(), 500);
}

async function handlePogscriptUninstall() {
    const splash = createSplash();
    splash.webContents.send("text-update", "Uninstalling pogscript...");
    const exePath = checkExePath();
    const result = await uninstallExe(exePath);
    splash.webContents.send("text-update", result);
    setTimeout(() => splash.close(), 500);
}

function checkOnlineStatus() {
    return new Promise((resolve) => {
        require('dns').lookup('github.com', (err) => resolve(!err));
    });
}

module.exports = {
    createWindow,
    createSplash,
    isMac,
    isMacARM,
    isWin,
    isCodeRunning,
    runSessions,
    mainWindow,
    about,
    buildMenu,
    registerGlobalShortcuts,
    setupWindowEvents,
    checkOnlineStatus,
    setMainWindow: (win) => { mainWindow = win; },
    setCodeRunning: (running) => { isCodeRunning = running; }
};
