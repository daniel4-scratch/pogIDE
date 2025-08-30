//preload.js - allows renderer.js to talk to main.js instance

const { contextBridge, ipcRenderer } = require("electron");
const { Terminal } = require('@xterm/xterm');
const { FitAddon } = require('@xterm/addon-fit');

// Create terminal and fitAddon instances here
let terminal = null;
let fitAddon = null;

contextBridge.exposeInMainWorld("pogIDE", {
  runCode: (code) => ipcRenderer.invoke("run-code", code),
  onRunShortcut: (callback) => ipcRenderer.on('run-shortcut-pressed', callback),
  removeRunShortcutListener: () => ipcRenderer.removeAllListeners('run-shortcut-pressed'),
  onBuildShortcut: (callback) => ipcRenderer.on('build-shortcut-pressed', callback),
  removeBuildShortcutListener: () => ipcRenderer.removeAllListeners('build-shortcut-pressed'),
});

// Expose xterm functions without passing objects across the bridge
contextBridge.exposeInMainWorld("xterm", {
  initialize: (elementId, options) => {
    terminal = new Terminal(options);
    fitAddon = new FitAddon();
    terminal.loadAddon(fitAddon);
    
    const element = document.getElementById(elementId);
    terminal.open(element);
    fitAddon.fit();
    
    return true;
  },
  writeln: (text) => {
    if (terminal) {
      terminal.writeln(text);
    }
  },
  write: (text) => {
    if (terminal) {
      terminal.write(text);
    }
  },
  clear: () => {
    if (terminal) {
      terminal.clear();
    }
  },
  fit: () => {
    if (fitAddon) {
      fitAddon.fit();
    }
  }
});
