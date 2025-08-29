const {
  app,
  BrowserWindow,
  ipcMain,
  Menu,
  dialog,
  globalShortcut,
} = require("electron");
const { spawn } = require("child_process");
const path = require("path");
const fs = require("fs");
const os = require("os");

const isMac = process.platform === "darwin";
const isWin = process.platform === "win32";

function createWindow() {
  const win = new BrowserWindow({
    width: 1000,
    height: 700,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
    },
  });

  const template = [
    {
      label: "File",
      submenu: [
        ...(isMac
          ? [{
              label: "About",
              role: "about"
            },
            { type: "separator" }
            ]
          : []),
        {
          label: "Quit",
          role: "quit",
        },
      ],
    },
    {
      label: "Edit",
      submenu: [{ role: "undo" }, { role: "redo" }],
    },
    {
      label: "Run",
      submenu: [
        {
          label: "Run",
          click: () => {
            if (win && !win.isDestroyed()) {
              win.webContents.send("run-shortcut-pressed");
            }
          },
          accelerator: isMac ? "CommandOrControl+R" : "F5",
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
            win.webContents.toggleDevTools();
          },
        },
        ...(!isMac ? [
          { type: "separator" },
          {
            label: "About",
            role: "about"
          }] : []),
      ],
    },
  ];

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);

  win.loadFile(path.join(__dirname, "index.html"));

  // Register global shortcuts
  registerGlobalShortcuts(win);
}

function registerGlobalShortcuts(win) {
  // DevTools shortcut
  const devToolsShortcut = isMac
    ? "CommandOrControl+Alt+I"
    : "CommandOrControl+Shift+I";
  globalShortcut.register(devToolsShortcut, () => {
    if (win && !win.isDestroyed()) {
      win.webContents.toggleDevTools();
    }
  });

  // Run Python code shortcut (F5 or Cmd+R)
  const runShortcut = isMac ? "CommandOrControl+R" : "F5";
  globalShortcut.register(runShortcut, () => {
    if (win && !win.isDestroyed()) {
      win.webContents.send("run-shortcut-pressed");
    }
  });
}

app.whenReady().then(() => {
  createWindow();
});

ipcMain.handle("run-python", async (event, code) => {
  // Use system temporary directory instead of app directory
  const tempDir = os.tmpdir();
  const timestamp = Date.now();
  const filePath = path.join(tempDir, `temp_python_${timestamp}.py`);

  fs.writeFileSync(filePath, code);

  return new Promise((resolve, reject) => {
    const pythonProcess = spawn("python3", [filePath]);

    let output = "";
    let errorOutput = "";

    pythonProcess.stdout.on("data", (data) => {
      output += data.toString();
    });

    pythonProcess.stderr.on("data", (data) => {
      errorOutput += data.toString();
    });

    pythonProcess.on("close", (code) => {
      // Clean up the temporary file
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

    pythonProcess.on("error", (error) => {
      // Clean up the temporary file
      try {
        fs.unlinkSync(filePath);
      } catch (err) {
        // Ignore cleanup errors
      }

      resolve(
        "Error: " +
          error.message +
          "\nMake sure Python 3 is installed and available in your PATH."
      );
    });
  });
});

// Cleanup global shortcuts when app quits
app.on("will-quit", () => {
  globalShortcut.unregisterAll();
});

app.on("window-all-closed", () => {
  globalShortcut.unregisterAll();
  if (isMac) {
    app.quit();
  }
});

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});
