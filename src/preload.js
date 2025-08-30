//preload.js - allows renderer.js to talk to main.js instance

const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("pogIDE", {
  runCode: (code) => ipcRenderer.invoke("run-code", code),
  onRunShortcut: (callback) => ipcRenderer.on('run-shortcut-pressed', callback),
  removeRunShortcutListener: () => ipcRenderer.removeAllListeners('run-shortcut-pressed'),
  onBuildShortcut: (callback) => ipcRenderer.on('build-shortcut-pressed', callback),
  removeBuildShortcutListener: () => ipcRenderer.removeAllListeners('build-shortcut-pressed'),
});
