const { app, BrowserWindow, ipcMain, Menu, dialog } = require("electron");
const { spawn } = require("child_process");
const path = require("path");

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
      submenu: [{ role: "quit" }],
    },
    {
      label: "Edit",
      submenu: [
        { role: "undo" },
        { role: "redo" },
      ],
    },
    {
      label: 'Custom',
      submenu: [
        {
          label: 'Run JS Thing',
          click: () => {
            dialog.showMessageBox({
              type: 'info',
              message: 'Menu button clicked!',
              buttons: ['OK']
            });
          }
        }
      ]
    }
  ];

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);

  win.loadFile("index.html");
}

app.whenReady().then(createWindow);

ipcMain.handle("compile-run", async (event, code) => {
  const fs = require("fs");
  const filePath = path.join(__dirname, "temp.cpp");
  fs.writeFileSync(filePath, code);

  return new Promise((resolve, reject) => {
    const exePath = path.join(__dirname, "temp.out");
    const compile = spawn("g++", [filePath, "-o", exePath]);

    let output = "";
    compile.stderr.on("data", (data) => {
      output += data.toString();
    });

    compile.on("close", (code) => {
      if (code !== 0) {
        resolve("Compilation failed:\n" + output);
      } else {
        const run = spawn(exePath);
        run.stdout.on("data", (data) => {
          output += data.toString();
        });
        run.stderr.on("data", (data) => {
          output += data.toString();
        });
        run.on("close", () => resolve(output));
      }
    });
  });
});
