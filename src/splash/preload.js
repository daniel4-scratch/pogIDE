const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("pogIDE", {
  onTextUpdate: (callback) => ipcRenderer.on("text-update", callback),
  removeTextUpdateListener: () => ipcRenderer.removeAllListeners("text-update"),
});
