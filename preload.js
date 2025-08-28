const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("cppIDE", {
  compileRun: (code) => ipcRenderer.invoke("compile-run", code),
});
