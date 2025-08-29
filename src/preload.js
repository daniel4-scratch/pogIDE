const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("pythonIDE", {
  runCode: (code) => ipcRenderer.invoke("run-python", code),
  onRunShortcut: (callback) => ipcRenderer.on('run-shortcut-pressed', callback),
  removeRunShortcutListener: () => ipcRenderer.removeAllListeners('run-shortcut-pressed'),
  onBuildShortcut: (callback) => ipcRenderer.on('build-shortcut-pressed', callback),
  removeBuildShortcutListener: () => ipcRenderer.removeAllListeners('build-shortcut-pressed'),
});
